import { io, Socket } from 'socket.io-client'
import type { AdvanceMode, PublicRoom, QuizLanguage } from './types'

const SESSION_KEY = 'factopia-session'

export type Session = { code: string; playerId: string; name: string }

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
let rejoinInFlight: Promise<Ack<{ playerId: string; room: PublicRoom }>> | null = null
let connectionListenersAttached = false

type ConnectionHandlers = {
  onRoom?: (room: PublicRoom) => void
  onConnection?: (connected: boolean) => void
}

const handlers: ConnectionHandlers = {}

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
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
    })
  }

  if (!connectionListenersAttached) {
    connectionListenersAttached = true
    socket.on('connect', () => {
      handlers.onConnection?.(true)
      void ensureSessionBound()
    })
    socket.on('disconnect', () => {
      handlers.onConnection?.(false)
    })
    socket.on('room', (room: PublicRoom) => {
      handlers.onRoom?.(room)
    })
  }

  return socket
}

export function bindSocketHandlers(next: ConnectionHandlers) {
  handlers.onRoom = next.onRoom
  handlers.onConnection = next.onConnection
  getSocket()
}

/** Re-attach saved session after (re)connect. Retries transient failures. */
export async function ensureSessionBound(retries = 4): Promise<Ack<{ playerId: string; room: PublicRoom }> | null> {
  const session = loadSession()
  if (!session) return null
  if (rejoinInFlight) return rejoinInFlight

  rejoinInFlight = (async () => {
    let last: Ack<{ playerId: string; room: PublicRoom }> = {
      error: 'rejoin failed',
    } as Ack<{ playerId: string; room: PublicRoom }>
    for (let i = 0; i < retries; i++) {
      last = await rejoinGame(session.code, session.playerId)
      if (!last.error && last.room) {
        saveSession(session)
        return last
      }
      // Room truly gone — stop retrying
      if (
        last.error?.includes('finns inte') ||
        last.error?.includes('hittades inte') ||
        last.error?.includes('not found')
      ) {
        break
      }
      await new Promise((r) => setTimeout(r, 700 * (i + 1)))
    }
    return last
  })()

  try {
    return await rejoinInFlight
  } finally {
    rejoinInFlight = null
  }
}

function whenConnected(): Promise<Socket> {
  const s = getSocket()
  if (s.connected) return Promise.resolve(s)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Kunde inte ansluta till servern. Kolla nätverket och försök igen.'))
    }, 15_000)

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
    // Make sure session is bound after reconnect before game actions
    if (event !== 'create' && event !== 'join' && event !== 'rejoin') {
      await ensureSessionBound(2)
    }
    return await new Promise<Ack<T>>((resolve) => {
      s.timeout(12_000).emit(event, data, (err: Error | null, res: Ack<T>) => {
        if (err) resolve({ error: 'Inget svar från servern' } as Ack<T>)
        else resolve(res ?? ({ error: 'Tomt svar' } as Ack<T>))
      })
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Anslutningsfel' } as Ack<T>
  }
}

export function createGame(
  name: string,
  questionCount: number,
  hostPlays: boolean,
  advanceMode: AdvanceMode,
  language: QuizLanguage,
) {
  return emitAck<{ playerId: string; room: PublicRoom }>('create', {
    name,
    questionCount,
    hostPlays,
    advanceMode,
    language,
  })
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

export function setHostPlaying(playing: boolean) {
  return emitAck<{ ok?: boolean }>('setHostPlaying', { playing })
}

export function setAdvanceMode(mode: AdvanceMode) {
  return emitAck<{ ok?: boolean }>('setAdvanceMode', { mode })
}

export function setLanguage(language: QuizLanguage) {
  return emitAck<{ ok?: boolean }>('setLanguage', { language })
}

export function startGame() {
  return emitAck<{ ok?: boolean }>('start', {})
}

export function nextQuestion() {
  return emitAck<{ ok?: boolean }>('next', {})
}

export function endGame() {
  return emitAck<{ ok?: boolean }>('end', {})
}

export function submitAnswer(answerIndex: number) {
  return emitAck<{ ok?: boolean }>('answer', { answerIndex })
}
