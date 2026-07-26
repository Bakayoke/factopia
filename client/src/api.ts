import { io, Socket } from 'socket.io-client'
import type { PublicRoom } from './types'

const SESSION_KEY = 'factopia-session'

type Session = { code: string; playerId: string; name: string }

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

let socket: Socket | null = null

export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL as string | undefined
    socket = io(url && url.length > 0 ? url : undefined, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

type Ack<T> = T & { error?: string }

export function createGame(name: string, questionCount: number) {
  return new Promise<Ack<{ playerId: string; room: PublicRoom }>>((resolve) => {
    getSocket().emit('create', { name, questionCount }, resolve)
  })
}

export function joinGame(code: string, name: string) {
  return new Promise<Ack<{ playerId: string; room: PublicRoom }>>((resolve) => {
    getSocket().emit('join', { code, name }, resolve)
  })
}

export function rejoinGame(code: string, playerId: string) {
  return new Promise<Ack<{ playerId: string; room: PublicRoom }>>((resolve) => {
    getSocket().emit('rejoin', { code, playerId }, resolve)
  })
}

export function setCount(count: number) {
  return new Promise<Ack<{ ok?: boolean }>>((resolve) => {
    getSocket().emit('setCount', { count }, resolve)
  })
}

export function startGame() {
  return new Promise<Ack<{ ok?: boolean }>>((resolve) => {
    getSocket().emit('start', {}, resolve)
  })
}

export function submitAnswer(answerIndex: number) {
  return new Promise<Ack<{ ok?: boolean }>>((resolve) => {
    getSocket().emit('answer', { answerIndex }, resolve)
  })
}
