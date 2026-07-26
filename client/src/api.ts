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

function socketUrl() {
  const url = import.meta.env.VITE_SOCKET_URL as string | undefined
  return url && url.length > 0 ? url : undefined
}

export function getSocket() {
  if (!socket) {
    socket = io(socketUrl(), {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    })
  }
  return socket
}

function whenConnected(): Promise<Socket> {
  const s = getSocket()
  if (s.connected) return Promise.resolve(s)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Kunde inte ansluta till servern. Kolla nätverket och försök igen.'))
    }, 12_000)

    const onConnect = () => {
      cleanup()
      resolve(s)
    }
    const onError = (err: Error) => {
      cleanup()
      reject(new Error(err?.message || 'Anslutningen misslyckades'))
    }
    const cleanup = () => {
      clearTimeout(timer)
      s.off('connect', onConnect)
      s.off('connect_error', onError)
    }

    s.on('connect', onConnect)
    s.on('connect_error', onError)
    if (!s.active) s.connect()
  })
}

type Ack<T> = T & { error?: string }

async function emitAck<T>(event: string, data: unknown): Promise<Ack<T>> {
  try {
    const s = await whenConnected()
    return await new Promise<Ack<T>>((resolve) => {
      s.timeout(10000).emit(event, data, (err: Error | null, res: Ack<T>) => {
        if (err) resolve({ error: 'Inget svar från servern' } as Ack<T>)
        else resolve(res ?? ({ error: 'Tomt svar' } as Ack<T>))
      })
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Anslutningsfel' } as Ack<T>
  }
}

export function createGame(name: string, questionCount: number) {
  return emitAck<{ playerId: string; room: PublicRoom }>('create', { name, questionCount })
}

export function joinGame(code: string, name: string) {
  return emitAck<{ playerId: string; room: PublicRoom }>('join', { code, name })
}

export function rejoinGame(code: string, playerId: string) {
  return emitAck<{ playerId: string; room: PublicRoom }>('rejoin', { code, playerId })
}

export function setCount(count: number) {
  return emitAck<{ ok?: boolean }>('setCount', { count })
}

export function startGame() {
  return emitAck<{ ok?: boolean }>('start', {})
}

export function submitAnswer(answerIndex: number) {
  return emitAck<{ ok?: boolean }>('answer', { answerIndex })
}
