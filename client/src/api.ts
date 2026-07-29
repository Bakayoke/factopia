import { io, Socket } from 'socket.io-client'
import type {
  AdvanceMode,
  CategoryPackId,
  PartyPassLocal,
  PartyPlan,
  PublicCustomQuestion,
  PublicLobbyCard,
  PublicRoom,
  QuizLanguage,
} from './types'

const SESSION_KEY = 'factopia-session'
const PARTY_PASS_KEY = 'factopia-party-pass'

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

export function loadPartyPass(): PartyPassLocal | null {
  try {
    const raw = localStorage.getItem(PARTY_PASS_KEY)
    if (!raw) return null
    const pass = JSON.parse(raw) as PartyPassLocal
    if (!pass?.token || !pass?.expiresAt || pass.expiresAt <= Date.now()) {
      localStorage.removeItem(PARTY_PASS_KEY)
      return null
    }
    return pass
  } catch {
    return null
  }
}

export function savePartyPass(pass: PartyPassLocal) {
  localStorage.setItem(PARTY_PASS_KEY, JSON.stringify(pass))
}

export function clearPartyPass() {
  localStorage.removeItem(PARTY_PASS_KEY)
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
    if (event !== 'create' && event !== 'join' && event !== 'rejoin' && event !== 'redeemParty') {
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
  const pass = loadPartyPass()
  return emitAck<{ playerId: string; room: PublicRoom }>('create', {
    name,
    questionCount,
    hostPlays,
    advanceMode,
    language,
    partyToken: pass?.token ?? null,
  })
}

export function joinGame(code: string, name: string) {
  return emitAck<{
    playerId: string
    room: PublicRoom
    code?: string
    roomCode?: string
    waitlistCount?: number
  }>('join', { code, name })
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

export function setCategoryPack(pack: CategoryPackId) {
  return emitAck<{ ok?: boolean }>('setCategoryPack', { pack })
}

export function setPublicLobby(isPublic: boolean) {
  return emitAck<{ ok?: boolean }>('setPublicLobby', { isPublic })
}

export function redeemParty(code: string) {
  return emitAck<{ token: string; expiresAt: number }>('redeemParty', { code })
}

export function activateParty(code: string) {
  return emitAck<{ ok?: boolean; token: string; expiresAt: number }>('activateParty', { code })
}

export function applyStoredPartyToken() {
  const pass = loadPartyPass()
  if (!pass) {
    return Promise.resolve({ error: 'Inget party-pass sparat' } as Ack<{ ok?: boolean }>)
  }
  return emitAck<{ ok?: boolean }>('applyPartyToken', { token: pass.token })
}

export function setRoomTitle(title: string) {
  return emitAck<{ ok?: boolean }>('setRoomTitle', { title })
}

export function setCustomQuestions(questions: PublicCustomQuestion[]) {
  return emitAck<{ ok?: boolean }>('setCustomQuestions', { questions })
}

export function startGame() {
  return emitAck<{ ok?: boolean }>('start', {})
}

export function rematchGame() {
  return emitAck<{ ok?: boolean }>('rematch', {})
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

function apiBase() {
  const url = import.meta.env.VITE_SOCKET_URL as string | undefined
  if (url && url.length > 0) return url.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export type PartyInfo = {
  enabled: boolean
  amountOre: number
  amountLabel: string
  durationHours: number
  weekAmountOre?: number
  weekAmountLabel?: string
  weekDurationHours?: number
  weekThemePack?: CategoryPackId
  firstPartyPercentOff?: number
  firstPartyDayLabel?: string
  firstPartyWeekLabel?: string
}

export async function fetchPartyInfo(): Promise<PartyInfo> {
  try {
    const res = await fetch(`${apiBase()}/api/party/info`)
    if (!res.ok) throw new Error('info failed')
    return (await res.json()) as PartyInfo
  } catch {
    return {
      enabled: false,
      amountOre: 3900,
      amountLabel: '39 kr',
      durationHours: 24,
      weekAmountOre: 9900,
      weekAmountLabel: '99 kr',
      weekDurationHours: 168,
      weekThemePack: 'party',
    }
  }
}

export async function fetchLobbies(lang?: QuizLanguage): Promise<{
  lobbies: PublicLobbyCard[]
  onlineRooms: number
  weekThemePack?: CategoryPackId
  activity?: {
    gamesTonight: number
    liveRooms: number
    livePlayers: number
    openLobbies: number
  }
}> {
  try {
    const q = lang ? `?lang=${lang}` : ''
    const res = await fetch(`${apiBase()}/api/lobbies${q}`)
    if (!res.ok) throw new Error('lobbies failed')
    return (await res.json()) as {
      lobbies: PublicLobbyCard[]
      onlineRooms: number
      weekThemePack?: CategoryPackId
      activity?: {
        gamesTonight: number
        liveRooms: number
        livePlayers: number
        openLobbies: number
      }
    }
  } catch {
    return { lobbies: [], onlineRooms: 0 }
  }
}

export async function fetchStripeHint(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/api/health`)
    if (!res.ok) return null
    const data = (await res.json()) as { stripeDiag?: { hint?: string | null; envPrefixes?: Record<string, string | null> } }
    if (data.stripeDiag?.hint) return data.stripeDiag.hint
    const prefix = data.stripeDiag?.envPrefixes?.STRIPE_SECRET_KEY
    if (prefix?.startsWith('pk_')) {
      return 'Du har Publishable key (pk_…) i Railway. Byt till Secret key (sk_…).'
    }
    return null
  } catch {
    return null
  }
}

export async function startPartyCheckout(
  locale: 'sv' | 'en',
  roomCode?: string,
  plan: PartyPlan = 'day',
  firstTime = false,
) {
  try {
    const res = await fetch(`${apiBase()}/api/party/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale,
        roomCode: roomCode ?? null,
        plan,
        firstTime,
      }),
    })
    const data = (await res.json()) as { url?: string; error?: string }
    if (!res.ok || !data.url) return { error: data.error || 'Kunde inte starta köp' }
    return { url: data.url }
  } catch {
    return { error: 'Kunde inte nå betalningen' }
  }
}

export async function trackMetric(
  event:
    | 'room_full'
    | 'waitlist_join'
    | 'checkout_start'
    | 'checkout_cancel'
    | 'checkout_paid'
    | 'guest_unlock_click'
    | 'group_size_upsell'
    | 'public_requires_party'
    | 'game_start'
    | 'game_finished'
    | 'share_results',
  meta?: string,
) {
  try {
    await fetch(`${apiBase()}/api/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, meta }),
    })
  } catch {
    // ignore
  }
}

export function hasPaidBefore(): boolean {
  try {
    return localStorage.getItem('factopia-has-paid') === '1'
  } catch {
    return false
  }
}

export function markPaidBefore() {
  try {
    localStorage.setItem('factopia-has-paid', '1')
  } catch {
    // ignore
  }
}

export function isWeekend(date = new Date()) {
  const day = date.getDay()
  return day === 0 || day === 5 || day === 6
}

export async function claimPartySession(sessionId: string) {
  try {
    const res = await fetch(`${apiBase()}/api/party/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const data = (await res.json()) as {
      token?: string
      expiresAt?: number
      roomCode?: string | null
      error?: string
    }
    if (!res.ok || !data.token || !data.expiresAt) {
      return { error: data.error || 'Kunde inte hämta Party' }
    }
    return {
      token: data.token,
      expiresAt: data.expiresAt,
      roomCode: data.roomCode || undefined,
    }
  } catch {
    return { error: 'Kunde inte hämta Party' }
  }
}
