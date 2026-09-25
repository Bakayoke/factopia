import { customAlphabet } from 'nanoid'
import { categoriesForPack, normalizePackId, type CategoryPackId } from './packs.js'
import { pickQuestions } from './questions.js'
import { trackFunnel } from './metrics.js'
import {
  QUESTION_MS,
  REVEAL_MS,
  SUDDEN_DEATH_MARGIN,
  normalizeMode,
  questionDurationMs,
  scoreCorrectAnswer,
} from './scoring.js'
import {
  limitsFor,
  lookupPass,
  redeemPassCode,
  sanitizeCustomQuestions,
  tierFromExpiry,
  type CustomQuestionInput,
} from './premium.js'
import type {
  AdvanceMode,
  Player,
  PublicRoom,
  QuizLanguage,
  RankDrama,
  Room,
  RoomStatus,
  RoundResult,
} from './types.js'

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 4)
const DISCONNECT_GRACE_MS = 60_000
const HOST_TRANSFER_AFTER_MS = 90_000
const ROOM_IDLE_MS = 12 * 60 * 60 * 1000

const rooms = new Map<string, Room>()
const socketToPlayer = new Map<string, { code: string; playerId: string }>()
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

let onPersist: (() => void) | null = null

export function setPersistHook(fn: (() => void) | null) {
  onPersist = fn
}

function touch(room?: Room) {
  if (room) room.updatedAt = Date.now()
  onPersist?.()
}

function playerKey(code: string, playerId: string) {
  return `${code}:${playerId}`
}

function cancelDisconnectTimer(code: string, playerId: string) {
  const key = playerKey(code, playerId)
  const t = disconnectTimers.get(key)
  if (t) {
    clearTimeout(t)
    disconnectTimers.delete(key)
  }
}

function roomLimits(room: Room) {
  return limitsFor(tierFromExpiry(room.premiumExpiresAt))
}

function clampQuestionCount(count: number, allowed: number[]) {
  return allowed.includes(count) ? count : allowed[0] ?? 10
}

export function getAllowedCounts(premiumExpiresAt: number | null = null) {
  return limitsFor(tierFromExpiry(premiumExpiresAt)).questionCounts
}

function uniqueCode(): string {
  let code = makeCode()
  while (rooms.has(code)) code = makeCode()
  return code
}

function activePlayers(room: Room) {
  return room.players.filter((p) => p.playing && p.connected)
}

export function createRoom(
  hostName: string,
  questionCount: number,
  socketId: string,
  hostPlays = true,
  advanceMode: AdvanceMode = 'auto',
  language: QuizLanguage = 'sv',
  partyToken?: string | null,
): { room: Room; playerId: string } {
  const pass = lookupPass(partyToken)
  const premiumExpiresAt = pass?.expiresAt ?? null
  const limits = limitsFor(tierFromExpiry(premiumExpiresAt))
  const count = clampQuestionCount(questionCount, limits.questionCounts)

  const code = uniqueCode()
  const playerId = crypto.randomUUID()
  const host: Player = {
    id: playerId,
    name: hostName.trim().slice(0, 20) || (language === 'en' ? 'Host' : 'Värd'),
    score: 0,
    connected: true,
    playing: hostPlays,
    teamId: null,
  }

  const room: Room = {
    code,
    hostId: playerId,
    players: [host],
    questionCount: count,
    advanceMode: advanceMode === 'manual' ? 'manual' : 'auto',
    language: language === 'en' ? 'en' : 'sv',
    categoryPack: 'mixed',
    status: 'lobby',
    questions: [],
    customQuestions: [],
    roomTitle: '',
    isPublic: false,
    waitlist: [],
    premiumExpiresAt,
    recentQuestionIds: [],
    currentIndex: -1,
    answers: {},
    answerTimes: {},
    questionStartedAt: 0,
    endsAt: 0,
    revealCorrectIndex: null,
    lastRound: null,
    streaks: {},
    nextPackVotes: {},
    optionCounts: null,
    rankDrama: null,
    suddenDeath: false,
    suddenDeathDone: false,
    teamMode: false,
    updatedAt: Date.now(),
  }

  rooms.set(code, room)
  socketToPlayer.set(socketId, { code, playerId })
  touch(room)
  return { room, playerId }
}

export function joinRoom(
  code: string,
  name: string,
  socketId: string,
):
  | { room: Room; playerId: string }
  | {
      error: string
      code?: 'ROOM_FULL' | 'NOT_FOUND' | 'STARTED'
      roomCode?: string
      waitlistCount?: number
    } {
  const room = rooms.get(code.toUpperCase().trim())
  if (!room) return { error: 'Hittade inget spel med den koden', code: 'NOT_FOUND' }

  // Allow lobby + in-progress + finished (spectate / wait for rematch)
  if (
    room.status !== 'lobby' &&
    room.status !== 'question' &&
    room.status !== 'reveal' &&
    room.status !== 'finished'
  ) {
    return { error: 'Spelet har redan startat', code: 'STARTED' }
  }

  const displayName =
    name.trim().slice(0, 20) || (room.language === 'en' ? 'Player' : 'Spelare')

  const maxPlayers = roomLimits(room).maxPlayers
  if (maxPlayers > 0 && room.players.length >= maxPlayers) {
    const existing = room.waitlist.find(
      (w) => w.name.toLowerCase() === displayName.toLowerCase(),
    )
    if (!existing) {
      room.waitlist.push({
        id: crypto.randomUUID(),
        name: displayName,
        at: Date.now(),
      })
      room.waitlist = room.waitlist.slice(-24)
    }
    touch(room)
    return {
      error:
        maxPlayers <= 5
          ? `Rummet är fullt (max ${maxPlayers} gratis). Lås upp Party för fler spelare.`
          : `Rummet är fullt (max ${maxPlayers})`,
      code: 'ROOM_FULL',
      roomCode: room.code,
      waitlistCount: room.waitlist.length,
    }
  }

  const playerId = crypto.randomUUID()
  // Mid-game joiners watch; finished/lobby joiners play (ready for rematch)
  const playing = room.status === 'lobby' || room.status === 'finished'
  let teamId: import('./types.js').TeamId | null = null
  if (room.teamMode && playing) {
    teamId = pickBalancedTeam(room)
  }
  room.players.push({
    id: playerId,
    name: displayName,
    score: 0,
    connected: true,
    playing,
    teamId,
  })
  // Clear from waitlist if they got in
  room.waitlist = room.waitlist.filter((w) => w.name.toLowerCase() !== displayName.toLowerCase())
  socketToPlayer.set(socketId, { code: room.code, playerId })
  touch(room)
  return { room, playerId }
}

export function getBinding(socketId: string) {
  return socketToPlayer.get(socketId)
}

export function getRoom(code: string) {
  return rooms.get(code)
}

export function setQuestionCount(code: string, playerId: string, count: number): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan välja antal frågor' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const allowed = roomLimits(room).questionCounts
  if (!allowed.includes(count)) {
    return { error: 'Ogiltigt antal frågor (Party krävs för 50)' }
  }
  room.questionCount = count
  touch(room)
  return room
}

export function setHostPlaying(
  code: string,
  playerId: string,
  playing: boolean,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra detta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const host = room.players.find((p) => p.id === playerId)
  if (!host) return { error: 'Värden hittades inte' }
  host.playing = playing
  if (!playing) host.teamId = null
  else if (room.teamMode) host.teamId = pickBalancedTeam(room)
  touch(room)
  return room
}

export function setAdvanceMode(
  code: string,
  playerId: string,
  mode: AdvanceMode,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra detta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.advanceMode = mode === 'manual' ? 'manual' : 'auto'
  touch(room)
  return room
}

export function setLanguage(
  code: string,
  playerId: string,
  language: QuizLanguage,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra detta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.language = language === 'en' ? 'en' : 'sv'
  touch(room)
  return room
}

export function setCategoryPack(
  code: string,
  playerId: string,
  packId: CategoryPackId | string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra tema' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.categoryPack = normalizePackId(packId)
  touch(room)
  return room
}

export function setPublicLobby(
  code: string,
  playerId: string,
  isPublic: boolean,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra detta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.isPublic = Boolean(isPublic)
  touch(room)
  return room
}

/** Apply a purchased Party pass to a room (host or guest checkout). */
export function unlockRoomWithPass(
  code: string,
  token: string,
): Room | { error: string } {
  const room = rooms.get(code.toUpperCase().trim())
  if (!room) return { error: 'Rummet finns inte' }
  const pass = lookupPass(token)
  if (!pass) return { error: 'Party-passet är ogiltigt eller har gått ut' }
  room.premiumExpiresAt = pass.expiresAt
  touch(room)
  return room
}

export function clearWaitlist(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan rensa' }
  room.waitlist = []
  touch(room)
  return room
}

export type PublicLobbyCard = {
  code: string
  language: QuizLanguage
  categoryPack: CategoryPackId
  playerCount: number
  maxPlayers: number
  seatsLeft: number | null
  questionCount: number
  party: boolean
}

export function listPublicLobbies(opts?: {
  language?: QuizLanguage | null
  limit?: number
}): PublicLobbyCard[] {
  const lang = opts?.language
  const limit = opts?.limit ?? 20
  const now = Date.now()
  const cards: PublicLobbyCard[] = []

  for (const room of rooms.values()) {
    if (!room.isPublic || room.status !== 'lobby') continue
    if (lang && room.language !== lang) continue
    // Drop stale lobbies with no connected players
    if (!room.players.some((p) => p.connected)) continue
    if (now - (room.updatedAt || 0) > 30 * 60 * 1000) continue

    const limits = roomLimits(room)
    const max = limits.maxPlayers
    const count = room.players.length
    if (max > 0 && count >= max) continue

    cards.push({
      code: room.code,
      language: room.language,
      categoryPack: room.categoryPack ?? 'mixed',
      playerCount: count,
      maxPlayers: max,
      seatsLeft: max > 0 ? max - count : null,
      questionCount: room.questionCount,
      party: tierFromExpiry(room.premiumExpiresAt) === 'party',
    })
  }

  cards.sort((a, b) => {
    // Prefer rooms with some people already, then more seats
    const aFill = a.playerCount
    const bFill = b.playerCount
    if (bFill !== aFill) return bFill - aFill
    const aSeats = a.seatsLeft ?? 99
    const bSeats = b.seatsLeft ?? 99
    return bSeats - aSeats
  })

  return cards.slice(0, limit)
}

/** Pick a public lobby to join, or null if none. */
export function pickPublicLobby(language?: QuizLanguage | null): PublicLobbyCard | null {
  return listPublicLobbies({ language: language ?? null, limit: 1 })[0] ?? null
}

export function activatePartyPass(
  code: string,
  playerId: string,
  passCode: string,
): { room: Room; pass: { token: string; expiresAt: number } } | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan aktivera Party' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }

  const redeemed = redeemPassCode(passCode)
  if ('error' in redeemed) return redeemed

  room.premiumExpiresAt = redeemed.expiresAt
  const limits = roomLimits(room)
  if (!limits.questionCounts.includes(room.questionCount)) {
    room.questionCount = limits.questionCounts[0] ?? 10
  }
  touch(room)
  return { room, pass: { token: redeemed.token, expiresAt: redeemed.expiresAt } }
}

export function applyPartyToken(
  code: string,
  playerId: string,
  token: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan aktivera Party' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const pass = lookupPass(token)
  if (!pass) return { error: 'Party-passet är ogiltigt eller har gått ut' }
  room.premiumExpiresAt = pass.expiresAt
  const limits = roomLimits(room)
  if (!limits.questionCounts.includes(room.questionCount)) {
    room.questionCount = limits.questionCounts[0] ?? 10
  }
  touch(room)
  return room
}

export function setRoomTitle(
  code: string,
  playerId: string,
  title: string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra titel' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.roomTitle = title.trim().slice(0, 40)
  touch(room)
  return room
}

const MAX_CUSTOM_QUESTIONS = 40

export function setCustomQuestions(
  code: string,
  playerId: string,
  input: CustomQuestionInput[],
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan sätta egna frågor' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const sanitized = sanitizeCustomQuestions(input, MAX_CUSTOM_QUESTIONS)
  if ('error' in sanitized) return sanitized
  room.customQuestions = sanitized.questions
  touch(room)
  return room
}

export function setTeamMode(
  code: string,
  playerId: string,
  enabled: boolean,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan ändra lagläge' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  room.teamMode = Boolean(enabled)
  if (room.teamMode) {
    rebalanceTeams(room)
  } else {
    for (const p of room.players) p.teamId = null
  }
  touch(room)
  return room
}

export function setPlayerTeam(
  code: string,
  playerId: string,
  targetPlayerId: string,
  teamId: import('./types.js').TeamId | null,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan flytta spelare' }
  if (!room.teamMode) return { error: 'Lagläge är av' }
  if (room.status !== 'lobby' && room.status !== 'finished') {
    return { error: 'Kan bara byta lag i lobbyn' }
  }
  const target = room.players.find((p) => p.id === targetPlayerId)
  if (!target) return { error: 'Spelaren hittades inte' }
  if (!target.playing) return { error: 'Åskådare har inget lag' }
  if (teamId !== 'a' && teamId !== 'b' && teamId !== null) {
    return { error: 'Ogiltigt lag' }
  }
  target.teamId = teamId
  touch(room)
  return room
}

export function startGame(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan starta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  if (activePlayers(room).length < 1) {
    return { error: 'Behöver minst en spelare som svarar' }
  }

  if (room.premiumExpiresAt && room.premiumExpiresAt <= Date.now()) {
    room.premiumExpiresAt = null
    room.isPublic = false
    room.questionCount = clampQuestionCount(room.questionCount, roomLimits(room).questionCounts)
  }

  const exclude = new Set(room.recentQuestionIds)
  const categories = categoriesForPack(room.categoryPack, room.language)
  room.questions = pickQuestions(room.questionCount, room.language, room.customQuestions, {
    excludeIds: exclude,
    categories,
  })
  room.recentQuestionIds = [
    ...room.recentQuestionIds,
    ...room.questions.map((q) => q.id),
  ].slice(-200)
  room.currentIndex = -1
  room.players.forEach((p) => {
    p.score = 0
  })
  room.streaks = {}
  room.nextPackVotes = {}
  room.optionCounts = null
  room.rankDrama = null
  room.suddenDeath = false
  room.suddenDeathDone = false
  advanceToQuestion(room)
  touch(room)
  trackFunnel('game_start', code)
  return room
}

/** Reset finished game back to lobby so the same group can rematch. */
export function rematch(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan starta om' }
  if (room.status !== 'finished') return { error: 'Spelet är inte klart ännu' }

  room.status = 'lobby'
  room.questions = []
  room.currentIndex = -1
  room.answers = {}
  room.answerTimes = {}
  room.questionStartedAt = 0
  room.endsAt = 0
  room.revealCorrectIndex = null
  room.lastRound = null
  room.streaks = {}
  room.nextPackVotes = {}
  room.optionCounts = null
  room.rankDrama = null
  room.suddenDeath = false
  room.suddenDeathDone = false
  room.players.forEach((p) => {
    p.score = 0
    // Late spectators become players for the next round (host keeps their preference)
    if (p.id !== room.hostId) p.playing = true
  })
  touch(room)
  return room
}


function pickBalancedTeam(room: Room): import('./types.js').TeamId {
  let a = 0
  let b = 0
  for (const p of room.players) {
    if (!p.playing) continue
    if (p.teamId === 'a') a += 1
    else if (p.teamId === 'b') b += 1
  }
  return a <= b ? 'a' : 'b'
}

function rebalanceTeams(room: Room) {
  const playing = room.players.filter((p) => p.playing)
  playing.forEach((p, i) => {
    p.teamId = i % 2 === 0 ? 'a' : 'b'
  })
  for (const p of room.players) {
    if (!p.playing) p.teamId = null
  }
}

function deriveTeamScores(room: Room): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const p of room.players) {
    if (!p.playing) continue
    if (p.teamId === 'a') a += p.score
    else if (p.teamId === 'b') b += p.score
  }
  return { a, b }
}

function teamLabel(team: import('./types.js').TeamId, language: QuizLanguage) {
  if (language === 'en') return team === 'a' ? 'Team A' : 'Team B'
  return team === 'a' ? 'Lag A' : 'Lag B'
}

function playingRanked(room: Room): Player[] {
  return room.players.filter((p) => p.playing).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

function shouldSuddenDeath(room: Room): boolean {
  if (room.suddenDeathDone) return false
  if (room.teamMode) {
    const { a, b } = deriveTeamScores(room)
    if (a === 0 && b === 0) return false
    return Math.abs(a - b) <= SUDDEN_DEATH_MARGIN
  }
  const ranked = playingRanked(room)
  if (ranked.length < 2) return false
  const lead = ranked[0]!.score - ranked[1]!.score
  return lead <= SUDDEN_DEATH_MARGIN
}

function majorityPack(votes: Record<string, CategoryPackId>): CategoryPackId | null {
  const counts = new Map<CategoryPackId, number>()
  for (const pack of Object.values(votes)) {
    counts.set(pack, (counts.get(pack) ?? 0) + 1)
  }
  let best: CategoryPackId | null = null
  let bestN = 0
  for (const [pack, n] of counts) {
    if (n > bestN) {
      best = pack
      bestN = n
    }
  }
  return best
}

function applyPackVotes(room: Room) {
  const pack = majorityPack(room.nextPackVotes)
  room.nextPackVotes = {}
  if (!pack) return
  room.categoryPack = pack
  const exclude = new Set(room.recentQuestionIds)
  for (const q of room.questions) exclude.add(q.id)
  const categories = categoriesForPack(pack, room.language)
  const [fresh] = pickQuestions(1, room.language, [], { excludeIds: exclude, categories })
  if (!fresh) return
  const nextIdx = room.currentIndex + 1
  if (nextIdx >= 0 && nextIdx < room.questions.length) {
    room.questions[nextIdx] = fresh
    room.recentQuestionIds = [...room.recentQuestionIds, fresh.id].slice(-200)
  }
}

function appendSuddenDeathQuestion(room: Room) {
  const exclude = new Set(room.recentQuestionIds)
  for (const q of room.questions) exclude.add(q.id)
  const categories = categoriesForPack(room.categoryPack, room.language)
  const [q] = pickQuestions(1, room.language, [], { excludeIds: exclude, categories })
  if (!q) return false
  q.mode = 'lightning'
  room.questions.push(q)
  room.recentQuestionIds = [...room.recentQuestionIds, q.id].slice(-200)
  room.suddenDeath = true
  room.suddenDeathDone = true
  return true
}

function advanceToQuestion(room: Room) {
  applyPackVotes(room)
  room.currentIndex += 1
  room.answers = {}
  room.answerTimes = {}
  room.revealCorrectIndex = null
  room.lastRound = null
  room.optionCounts = null
  room.rankDrama = null

  if (room.currentIndex >= room.questions.length) {
    if (shouldSuddenDeath(room) && appendSuddenDeathQuestion(room)) {
      // stay on the new last index via fall-through after push
    } else {
      room.status = 'finished'
      room.endsAt = 0
      room.suddenDeath = false
      trackFunnel('game_finished', room.code)
      return
    }
  }

  room.status = 'question'
  room.questionStartedAt = Date.now()
  const q = room.questions[room.currentIndex]
  if (room.suddenDeath && room.currentIndex === room.questions.length - 1 && room.suddenDeathDone) {
    // keep suddenDeath flag true for the bonus question UI
  } else if (room.currentIndex < room.questions.length - 1 || !room.suddenDeathDone) {
    room.suddenDeath = false
  }
  room.endsAt = room.questionStartedAt + questionDurationMs(q?.mode)
}

export function submitAnswer(
  code: string,
  playerId: string,
  answerIndex: number,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.status !== 'question') return { error: 'Ingen aktiv fråga' }
  if (answerIndex < 0 || answerIndex > 3) return { error: 'Ogiltigt svar' }
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return { error: 'Du är inte med i rummet' }
  if (!player.playing) return { error: 'Du hostar bara och svarar inte' }
  if (room.answers[playerId] !== undefined) return { error: 'Du har redan svarat' }

  room.answers[playerId] = answerIndex
  room.answerTimes[playerId] = Date.now()

  const needAnswer = activePlayers(room)
  if (needAnswer.length > 0 && needAnswer.every((p) => room.answers[p.id] !== undefined)) {
    revealQuestion(room)
  }

  return room
}

export function voteNextPack(
  code: string,
  playerId: string,
  packId: CategoryPackId | string,
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.status !== 'reveal') return { error: 'Kan bara rösta mellan frågor' }
  const player = room.players.find((p) => p.id === playerId)
  if (!player?.playing) return { error: 'Bara spelare kan rösta' }
  if (room.currentIndex + 1 >= room.questions.length && !shouldSuddenDeath(room)) {
    return { error: 'Ingen nästa fråga' }
  }
  room.nextPackVotes[playerId] = normalizePackId(packId)
  touch(room)
  return room
}

export function revealQuestion(room: Room) {
  if (room.status !== 'question') return
  const q = room.questions[room.currentIndex]
  if (!q) return

  const before = playingRanked(room)
  const prevLeader = before[0] ?? null

  room.status = 'reveal'
  room.revealCorrectIndex = q.correctIndex
  room.endsAt = room.advanceMode === 'manual' ? 0 : Date.now() + REVEAL_MS

  const counts: [number, number, number, number] = [0, 0, 0, 0]
  for (const ans of Object.values(room.answers)) {
    if (ans >= 0 && ans <= 3) counts[ans] += 1
  }
  room.optionCounts = counts

  const results: RoundResult[] = []
  for (const player of room.players) {
    if (!player.playing) continue
    const ans = room.answers[player.id]
    let gained = 0
    const correct = ans === q.correctIndex
    let streak = 0
    if (correct) {
      streak = (room.streaks[player.id] ?? 0) + 1
      room.streaks[player.id] = streak
      const answeredAt = room.answerTimes[player.id] ?? Date.now()
      const elapsed = answeredAt - room.questionStartedAt
      gained = scoreCorrectAnswer(elapsed, q.mode, streak)
      player.score += gained
    } else {
      room.streaks[player.id] = 0
    }
    results.push({
      playerId: player.id,
      name: player.name,
      correct,
      gained,
      answerIndex: ans ?? null,
      streak,
    })
  }
  results.sort((a, b) => b.gained - a.gained || Number(b.correct) - Number(a.correct))
  room.lastRound = results

  let drama: RankDrama | null = null
  if (room.teamMode) {
    const scores = deriveTeamScores(room)
    const leadTeam: import('./types.js').TeamId = scores.a >= scores.b ? 'a' : 'b'
    const trailTeam: import('./types.js').TeamId = leadTeam === 'a' ? 'b' : 'a'
    const margin = Math.abs(scores.a - scores.b)
    const prevLeadTeam = prevLeader?.teamId
    if (prevLeadTeam && prevLeadTeam !== leadTeam) {
      drama = {
        kind: 'stole_lead',
        leaderName: teamLabel(leadTeam, room.language),
        previousLeaderName: teamLabel(prevLeadTeam, room.language),
        margin,
      }
    } else if (margin <= SUDDEN_DEATH_MARGIN) {
      drama = {
        kind: 'neck_and_neck',
        leaderName: teamLabel(leadTeam, room.language),
        previousLeaderName: teamLabel(trailTeam, room.language),
        margin,
      }
    }
  } else {
    const after = playingRanked(room)
    const leader = after[0] ?? null
    const second = after[1]
    if (leader) {
      const margin = second ? leader.score - second.score : leader.score
      if (prevLeader && prevLeader.id !== leader.id) {
        drama = {
          kind: 'stole_lead',
          leaderName: leader.name,
          previousLeaderName: prevLeader.name,
          margin,
        }
      } else if (second && margin <= SUDDEN_DEATH_MARGIN) {
        drama = {
          kind: 'neck_and_neck',
          leaderName: leader.name,
          previousLeaderName: prevLeader?.name ?? null,
          margin,
        }
      }
    }
  }
  room.rankDrama = drama
}

export function nextQuestion(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan gå vidare' }
  if (room.status !== 'reveal') return { error: 'Ingen resultatvy just nu' }
  advanceToQuestion(room)
  return room
}

export function endGame(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan avsluta' }
  if (room.status === 'lobby' || room.status === 'finished') {
    return { error: 'Spelet kan inte avslutas nu' }
  }
  room.status = 'finished'
  room.endsAt = 0
  room.questionStartedAt = 0
  room.revealCorrectIndex = null
  room.lastRound = null
  room.optionCounts = null
  room.rankDrama = null
  room.nextPackVotes = {}
  room.suddenDeath = false
  touch(room)
  trackFunnel('game_finished', code)
  return room
}

export function onQuestionTimeout(room: Room) {
  if (room.status === 'question' && Date.now() >= room.endsAt) {
    revealQuestion(room)
    return true
  }
  return false
}

export function onRevealTimeout(room: Room) {
  if (room.advanceMode === 'manual') return false
  if (room.status === 'reveal' && room.endsAt > 0 && Date.now() >= room.endsAt) {
    advanceToQuestion(room)
    return true
  }
  return false
}

export function disconnectSocket(
  socketId: string,
  onSettled?: (room: Room) => void,
): Room | null {
  const binding = socketToPlayer.get(socketId)
  if (!binding) return null
  socketToPlayer.delete(socketId)
  const room = rooms.get(binding.code)
  if (!room) return null

  cancelDisconnectTimer(binding.code, binding.playerId)
  const timer = setTimeout(() => {
    disconnectTimers.delete(playerKey(binding.code, binding.playerId))
    const current = rooms.get(binding.code)
    if (!current) return
    for (const b of socketToPlayer.values()) {
      if (b.code === binding.code && b.playerId === binding.playerId) return
    }
    const player = current.players.find((p) => p.id === binding.playerId)
    if (player) player.connected = false

    // If host is gone, transfer after a bit more wait so the night can continue
    if (current.hostId === binding.playerId) {
      setTimeout(() => {
        const room = rooms.get(binding.code)
        if (!room || room.hostId !== binding.playerId) return
        const host = room.players.find((p) => p.id === binding.playerId)
        if (host?.connected) return
        const nextHost = room.players.find((p) => p.connected && p.id !== binding.playerId)
        if (!nextHost) return
        room.hostId = nextHost.id
        touch(room)
        onSettled?.(room)
      }, Math.max(0, HOST_TRANSFER_AFTER_MS - DISCONNECT_GRACE_MS))
    }

    onSettled?.(current)
  }, DISCONNECT_GRACE_MS)
  disconnectTimers.set(playerKey(binding.code, binding.playerId), timer)

  return room
}

export function reconnectSocket(
  code: string,
  playerId: string,
  socketId: string,
): Room | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'Rummet finns inte' }
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return { error: 'Spelaren hittades inte' }
  cancelDisconnectTimer(room.code, playerId)
  player.connected = true
  for (const [sid, b] of socketToPlayer.entries()) {
    if (b.playerId === playerId && sid !== socketId) socketToPlayer.delete(sid)
  }
  socketToPlayer.set(socketId, { code: room.code, playerId })
  return room
}

export function toPublicRoom(room: Room, playerId?: string): PublicRoom {
  const q = room.questions[room.currentIndex]
  let question = null
  if (q && (room.status === 'question' || room.status === 'reveal')) {
    question = {
      index: room.currentIndex,
      total: room.questions.length,
      category: q.category,
      text: q.text,
      options: q.options,
      endsAt: room.endsAt,
      mode: normalizeMode(q.mode),
      durationMs: questionDurationMs(q.mode),
    }
  }

  const playing = room.players.filter((p) => p.playing)
  const tier = tierFromExpiry(room.premiumExpiresAt)
  const limits = limitsFor(tier)
  const isHost = playerId === room.hostId

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({ ...p })),
    questionCount: room.questionCount,
    advanceMode: room.advanceMode,
    language: room.language,
    categoryPack: room.categoryPack ?? 'mixed',
    status: room.status as RoomStatus,
    currentIndex: room.currentIndex,
    totalQuestions: room.questions.length || room.questionCount,
    question,
    revealCorrectIndex: room.status === 'reveal' ? room.revealCorrectIndex : null,
    yourAnswer: playerId ? (room.answers[playerId] ?? null) : null,
    answeredCount: Object.keys(room.answers).length,
    playingCount: playing.length,
    lastRound: room.status === 'reveal' ? room.lastRound : null,
    optionCounts: room.status === 'reveal' ? room.optionCounts : null,
    rankDrama: room.status === 'reveal' ? room.rankDrama : null,
    suddenDeath: Boolean(room.suddenDeath),
    nextPackVotes: room.status === 'reveal' ? { ...room.nextPackVotes } : {},
    yourPackVote:
      playerId && room.status === 'reveal' ? (room.nextPackVotes[playerId] ?? null) : null,
    yourStreak: playerId ? (room.streaks[playerId] ?? 0) : 0,
    teamMode: Boolean(room.teamMode),
    teamScores: deriveTeamScores(room),
    premiumTier: tier,
    premiumExpiresAt: room.premiumExpiresAt,
    limits,
    roomTitle: room.roomTitle,
    isPublic: Boolean(room.isPublic),
    waitlist: room.waitlist ?? [],
    customQuestions: isHost
      ? room.customQuestions.map((cq) => ({
          text: cq.text,
          options: cq.options,
          correctIndex: cq.correctIndex,
          category: cq.category,
        }))
      : undefined,
  }
}

export function allRooms() {
  return rooms
}

/** Live rooms with at least one connected player — for landing social proof. */
export function liveActivity() {
  let liveRooms = 0
  let livePlayers = 0
  let openLobbies = 0
  for (const room of rooms.values()) {
    const connected = room.players.filter((p) => p.connected).length
    if (connected === 0) continue
    liveRooms += 1
    livePlayers += connected
    if (room.status === 'lobby') openLobbies += 1
  }
  return { liveRooms, livePlayers, openLobbies }
}

export function hydrateRooms(saved: Room[]) {
  const now = Date.now()
  for (const raw of saved) {
    if (!raw?.code || rooms.has(raw.code)) continue
    if (raw.updatedAt && now - raw.updatedAt > ROOM_IDLE_MS) {
      // Keep if party still active
      if (!raw.premiumExpiresAt || raw.premiumExpiresAt <= now) continue
    }
    const room: Room = {
      ...raw,
      categoryPack: normalizePackId(raw.categoryPack),
      isPublic: Boolean(raw.isPublic),
      waitlist: Array.isArray(raw.waitlist) ? raw.waitlist : [],
      recentQuestionIds: Array.isArray(raw.recentQuestionIds) ? raw.recentQuestionIds : [],
      players: (raw.players ?? []).map((p) => ({
        ...p,
        connected: false,
        teamId: p.teamId === 'a' || p.teamId === 'b' ? p.teamId : null,
      })),
      teamMode: Boolean(raw.teamMode),
      answers: {},
      answerTimes: {},
      // Mid-question rooms resume safer from lobby if timers are stale
      status:
        raw.status === 'question' || raw.status === 'reveal' ? 'lobby' : raw.status,
      questions: raw.status === 'question' || raw.status === 'reveal' ? [] : raw.questions ?? [],
      currentIndex: -1,
      endsAt: 0,
      questionStartedAt: 0,
      revealCorrectIndex: null,
      lastRound: null,
      streaks: raw.streaks && typeof raw.streaks === 'object' ? raw.streaks : {},
      nextPackVotes: {},
      optionCounts: null,
      rankDrama: null,
      suddenDeath: false,
      suddenDeathDone: Boolean(raw.suddenDeathDone),
      updatedAt: raw.updatedAt ?? now,
    }
    rooms.set(room.code, room)
  }
}

export function pruneIdleRooms() {
  const now = Date.now()
  for (const [code, room] of rooms) {
    const idle = now - (room.updatedAt || 0) > ROOM_IDLE_MS
    const partyLive = Boolean(room.premiumExpiresAt && room.premiumExpiresAt > now)
    const anyoneConnected = room.players.some((p) => p.connected)
    if (idle && !partyLive && !anyoneConnected) {
      rooms.delete(code)
    }
  }
}

export { QUESTION_MS, REVEAL_MS }
