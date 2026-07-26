import { customAlphabet } from 'nanoid'
import { pickQuestions } from './questions.js'
import type { AdvanceMode, Player, PublicRoom, Room, RoomStatus, RoundResult } from './types.js'

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 4)
const QUESTION_MS = 20_000
const REVEAL_MS = 6_000
const ALLOWED_COUNTS = [10, 20, 30] as const

const rooms = new Map<string, Room>()
const socketToPlayer = new Map<string, { code: string; playerId: string }>()

export function getAllowedCounts() {
  return ALLOWED_COUNTS
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
): { room: Room; playerId: string } {
  const count = ALLOWED_COUNTS.includes(questionCount as (typeof ALLOWED_COUNTS)[number])
    ? questionCount
    : 10

  const code = uniqueCode()
  const playerId = crypto.randomUUID()
  const host: Player = {
    id: playerId,
    name: hostName.trim().slice(0, 20) || 'Värd',
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
    status: 'lobby',
    questions: [],
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
  if (room.players.length >= 12) return { error: 'Rummet är fullt (max 12)' }

  const playerId = crypto.randomUUID()
  room.players.push({
    id: playerId,
    name: name.trim().slice(0, 20) || 'Spelare',
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
  if (!ALLOWED_COUNTS.includes(count as (typeof ALLOWED_COUNTS)[number])) {
    return { error: 'Ogiltigt antal frågor' }
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

export function startGame(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan starta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  if (activePlayers(room).length < 1) {
    return { error: 'Behöver minst en spelare som svarar' }
  }

  room.questions = pickQuestions(room.questionCount)
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

export function disconnectSocket(socketId: string): Room | null {
  const binding = socketToPlayer.get(socketId)
  if (!binding) return null
  socketToPlayer.delete(socketId)
  const room = rooms.get(binding.code)
  if (!room) return null

  const player = room.players.find((p) => p.id === binding.playerId)
  if (player) player.connected = false

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
  player.connected = true
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

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({ ...p })),
    questionCount: room.questionCount,
    advanceMode: room.advanceMode,
    status: room.status as RoomStatus,
    currentIndex: room.currentIndex,
    totalQuestions: room.questions.length || room.questionCount,
    question,
    revealCorrectIndex: room.status === 'reveal' ? room.revealCorrectIndex : null,
    yourAnswer: playerId ? (room.answers[playerId] ?? null) : null,
    answeredCount: Object.keys(room.answers).length,
    playingCount: playing.length,
    lastRound: room.status === 'reveal' ? room.lastRound : null,
  }
}

export function allRooms() {
  return rooms
}

export { QUESTION_MS, REVEAL_MS }
