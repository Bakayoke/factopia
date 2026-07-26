import { customAlphabet } from 'nanoid'
import { pickQuestions } from './questions.js'
import type { Player, PublicRoom, Room, RoomStatus } from './types.js'

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ', 4)
const QUESTION_MS = 20_000
const REVEAL_MS = 4_000
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

export function createRoom(
  hostName: string,
  questionCount: number,
  socketId: string,
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
  }

  const room: Room = {
    code,
    hostId: playerId,
    players: [host],
    questionCount: count,
    status: 'lobby',
    questions: [],
    currentIndex: -1,
    answers: {},
    answerTimes: {},
    questionStartedAt: 0,
    endsAt: 0,
    revealCorrectIndex: null,
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

export function startGame(code: string, playerId: string): Room | { error: string } {
  const room = rooms.get(code)
  if (!room) return { error: 'Rummet finns inte' }
  if (room.hostId !== playerId) return { error: 'Bara värden kan starta' }
  if (room.status !== 'lobby') return { error: 'Spelet har redan startat' }
  if (room.players.filter((p) => p.connected).length < 1) {
    return { error: 'Behöver minst en spelare' }
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
  if (!room.players.some((p) => p.id === playerId)) {
    return { error: 'Du är inte med i rummet' }
  }
  if (room.answers[playerId] !== undefined) return { error: 'Du har redan svarat' }

  room.answers[playerId] = answerIndex
  room.answerTimes[playerId] = Date.now()

  const connected = room.players.filter((p) => p.connected)
  if (connected.every((p) => room.answers[p.id] !== undefined)) {
    revealQuestion(room)
  }

  return room
}

export function revealQuestion(room: Room) {
  if (room.status !== 'question') return
  const q = room.questions[room.currentIndex]
  room.status = 'reveal'
  room.revealCorrectIndex = q.correctIndex
  room.endsAt = Date.now() + REVEAL_MS

  for (const player of room.players) {
    const ans = room.answers[player.id]
    if (ans === q.correctIndex) {
      const answeredAt = room.answerTimes[player.id] ?? room.endsAt
      const elapsed = answeredAt - room.questionStartedAt
      const speedBonus = Math.max(0, Math.round(500 * (1 - elapsed / QUESTION_MS)))
      player.score += 1000 + speedBonus
    }
  }
}

export function onQuestionTimeout(room: Room) {
  if (room.status === 'question' && Date.now() >= room.endsAt) {
    revealQuestion(room)
    return true
  }
  return false
}

export function onRevealTimeout(room: Room) {
  if (room.status === 'reveal' && Date.now() >= room.endsAt) {
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

  if (room.status === 'lobby') {
    room.players = room.players.filter((p) => p.id !== binding.playerId)
    if (room.players.length === 0) {
      rooms.delete(room.code)
      return null
    }
    if (room.hostId === binding.playerId) {
      room.hostId = room.players[0].id
    }
  }

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

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({ ...p })),
    questionCount: room.questionCount,
    status: room.status as RoomStatus,
    currentIndex: room.currentIndex,
    totalQuestions: room.questions.length || room.questionCount,
    question,
    revealCorrectIndex: room.status === 'reveal' ? room.revealCorrectIndex : null,
    yourAnswer: playerId ? (room.answers[playerId] ?? null) : null,
    answeredCount: Object.keys(room.answers).length,
  }
}

export function allRooms() {
  return rooms
}

export { QUESTION_MS, REVEAL_MS }
