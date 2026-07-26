import { customAlphabet } from 'nanoid'
import { pickQuestions } from './questions.js'
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
  Room,
  RoomStatus,
  RoundResult,
} from './types.js'

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 4)
const QUESTION_MS = 20_000
const REVEAL_MS = 6_000
const DISCONNECT_GRACE_MS = 20_000

const rooms = new Map<string, Room>()
const socketToPlayer = new Map<string, { code: string; playerId: string }>()
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
  }

  const room: Room = {
    code,
    hostId: playerId,
    players: [host],
    questionCount: count,
    advanceMode: advanceMode === 'manual' ? 'manual' : 'auto',
    language: language === 'en' ? 'en' : 'sv',
    status: 'lobby',
    questions: [],
    customQuestions: [],
    roomTitle: '',
    premiumExpiresAt,
    currentIndex: -1,
    answers: {},
    answerTimes: {},
    questionStartedAt: 0,
    endsAt: 0,
    revealCorrectIndex: null,
    lastRound: null,
  }

  rooms.set(code, room)
  socketToPlayer.set(socketId, { code, playerId })
  return { room, playerId }
}

export function joinRoom(
  code: string,
  name: string,
  socketId: string,
): { room: Room; playerId: string } | { error: string } {
  const room = rooms.get(code.toUpperCase().trim())
  if (!room) return { error: 'Hittade inget spel med den koden' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const maxPlayers = roomLimits(room).maxPlayers
  if (room.players.length >= maxPlayers) {
    return { error: `Rummet är fullt (max ${maxPlayers})` }
  }

  const playerId = crypto.randomUUID()
  room.players.push({
    id: playerId,
    name: name.trim().slice(0, 20) || (room.language === 'en' ? 'Player' : 'Spelare'),
    score: 0,
    connected: true,
    playing: true,
  })
  socketToPlayer.set(socketId, { code: room.code, playerId })
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
  return room
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
  if (!roomLimits(room).canSetTitle) return { error: 'Rumtitel kräver Party' }
  room.roomTitle = title.trim().slice(0, 40)
  return room
}

export function setCustomQuestions(
  code: string,
  playerId: string,
  input: CustomQuestionInput[],
): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan lägga egna frågor' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  const max = roomLimits(room).maxCustomQuestions
  if (max <= 0) return { error: 'Egna frågor kräver Party' }
  const sanitized = sanitizeCustomQuestions(input, max)
  if ('error' in sanitized) return sanitized
  room.customQuestions = sanitized.questions
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
    room.customQuestions = []
    room.roomTitle = ''
    room.questionCount = clampQuestionCount(room.questionCount, roomLimits(room).questionCounts)
  }

  room.questions = pickQuestions(room.questionCount, room.language, room.customQuestions)
  room.currentIndex = -1
  room.players.forEach((p) => {
    p.score = 0
  })
  advanceToQuestion(room)
  return room
}

function advanceToQuestion(room: Room) {
  room.currentIndex += 1
  room.answers = {}
  room.answerTimes = {}
  room.revealCorrectIndex = null
  room.lastRound = null

  if (room.currentIndex >= room.questions.length) {
    room.status = 'finished'
    room.endsAt = 0
    return
  }

  room.status = 'question'
  room.questionStartedAt = Date.now()
  room.endsAt = room.questionStartedAt + QUESTION_MS
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

export function revealQuestion(room: Room) {
  if (room.status !== 'question') return
  const q = room.questions[room.currentIndex]
  room.status = 'reveal'
  room.revealCorrectIndex = q.correctIndex
  room.endsAt = room.advanceMode === 'manual' ? 0 : Date.now() + REVEAL_MS

  const results: RoundResult[] = []
  for (const player of room.players) {
    if (!player.playing) continue
    const ans = room.answers[player.id]
    let gained = 0
    const correct = ans === q.correctIndex
    if (correct) {
      const answeredAt = room.answerTimes[player.id] ?? Date.now()
      const elapsed = answeredAt - room.questionStartedAt
      const speedBonus = Math.max(0, Math.round(500 * (1 - elapsed / QUESTION_MS)))
      gained = 1000 + speedBonus
      player.score += gained
    }
    results.push({
      playerId: player.id,
      name: player.name,
      correct,
      gained,
      answerIndex: ans ?? null,
    })
  }
  results.sort((a, b) => b.gained - a.gained || b.correct.toString().localeCompare(a.correct.toString()))
  room.lastRound = results
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
    status: room.status as RoomStatus,
    currentIndex: room.currentIndex,
    totalQuestions: room.questions.length || room.questionCount,
    question,
    revealCorrectIndex: room.status === 'reveal' ? room.revealCorrectIndex : null,
    yourAnswer: playerId ? (room.answers[playerId] ?? null) : null,
    answeredCount: Object.keys(room.answers).length,
    playingCount: playing.length,
    lastRound: room.status === 'reveal' ? room.lastRound : null,
    premiumTier: tier,
    premiumExpiresAt: room.premiumExpiresAt,
    limits,
    roomTitle: room.roomTitle,
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

export { QUESTION_MS, REVEAL_MS }
