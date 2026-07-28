import { useEffect, useState, type FormEvent } from 'react'
import {
  activateParty,
  applyStoredPartyToken,
  bindSocketHandlers,
  claimPartySession,
  clearSession,
  createGame,
  endGame,
  ensureSessionBound,
  fetchPartyInfo,
  fetchLobbies,
  fetchStripeHint,
  joinGame,
  loadPartyPass,
  loadSession,
  nextQuestion,
  redeemParty,
  rematchGame,
  savePartyPass,
  saveSession,
  setAdvanceMode,
  setCategoryPack,
  setCount,
  setHostPlaying,
  setLanguage,
  setPublicLobby,
  startGame,
  startPartyCheckout,
  submitAnswer,
  trackMetric,
  hasPaidBefore,
  markPaidBefore,
  isWeekend,
  type PartyInfo,
} from './api'
import { detectPreferredLanguage, rememberLanguage, t } from './i18n'
import type {
  AdvanceMode,
  CategoryPackId,
  PartyPlan,
  PublicLobbyCard,
  PublicRoom,
  QuizLanguage,
} from './types'
import { Confetti, useCountdown } from './ui'

type Screen = 'home' | 'create' | 'join' | 'find' | 'play' | 'guest-unlock'

const FREE_COUNTS = [10, 20, 30, 50]
const QUESTION_MS = 20_000
const REVEAL_MS = 6_000
const TIP_URL = (import.meta.env.VITE_TIP_URL as string | undefined) || ''
const PENDING_ROOM_KEY = 'factopia-pending-room'
const RESUME_CHECKOUT_KEY = 'factopia-resume-checkout'
const PENDING_CREATE_KEY = 'factopia-pending-create'

const PACKS: { id: CategoryPackId; labelKey: keyof ReturnType<typeof t> }[] = [
  { id: 'mixed', labelKey: 'packMixed' },
  { id: 'world', labelKey: 'packWorld' },
  { id: 'brain', labelKey: 'packBrain' },
  { id: 'historySport', labelKey: 'packHistorySport' },
  { id: 'party', labelKey: 'packParty' },
  { id: 'food', labelKey: 'packFood' },
]

function joinUrl(code: string) {
  const url = new URL(window.location.origin)
  url.searchParams.set('join', code.toUpperCase())
  return url.toString()
}

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(data)}`
}

function formatExpiry(ts: number, lang: QuizLanguage) {
  return new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [questionCount] = useState(10)
  const [hostPlays, setHostPlays] = useState(true)
  const [advanceMode] = useState<AdvanceMode>('auto')
  const [language] = useState<QuizLanguage>(() => detectPreferredLanguage())
  const [joinStep, setJoinStep] = useState<'code' | 'name'>('code')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [partyPass, setPartyPass] = useState(() => loadPartyPass())
  const [partyInfo, setPartyInfo] = useState<PartyInfo>({
    enabled: false,
    amountOre: 3900,
    amountLabel: '39 kr',
    durationHours: 24,
    weekAmountOre: 9900,
    weekAmountLabel: '99 kr',
    weekDurationHours: 168,
    weekThemePack: 'party',
  })
  const [partyFlash, setPartyFlash] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [ownerCode, setOwnerCode] = useState('')
  const [showOwnerCode, setShowOwnerCode] = useState(false)
  const [stripeHint, setStripeHint] = useState<string | null>(null)
  const [lobbies, setLobbies] = useState<PublicLobbyCard[]>([])
  const [pendingPack, setPendingPack] = useState<CategoryPackId | null>(null)
  const [createStep, setCreateStep] = useState<'size' | 'form'>('size')
  const [groupSize, setGroupSize] = useState<'small' | 'big' | null>(null)
  const [fullRoomCode, setFullRoomCode] = useState('')
  const [fullWaitlistCount, setFullWaitlistCount] = useState(0)
  const [resumeCheckout, setResumeCheckout] = useState<{
    roomCode?: string
    plan: PartyPlan
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem(RESUME_CHECKOUT_KEY)
      return raw ? (JSON.parse(raw) as { roomCode?: string; plan: PartyPlan }) : null
    } catch {
      return null
    }
  })

  const uiLang = room?.language ?? language
  const ui = t(uiLang)
  const hasParty = Boolean(partyPass && partyPass.expiresAt > Date.now())
  const firstTime = !hasPaidBefore()
  const weekend = isWeekend()
  const defaultPlan: PartyPlan = weekend ? 'week' : 'day'
  const dayPrice = firstTime && partyInfo.firstPartyDayLabel
    ? partyInfo.firstPartyDayLabel
    : partyInfo.amountLabel
  const weekPrice = firstTime && partyInfo.firstPartyWeekLabel
    ? partyInfo.firstPartyWeekLabel
    : partyInfo.weekAmountLabel ?? '99 kr'
  const buyDayLabel = `Party · ${dayPrice} · 24 h${firstTime ? ' (−30%)' : ''}`
  const buyWeekLabel = `Party · ${weekPrice} · 7 ${uiLang === 'en' ? 'days' : 'dagar'}${firstTime ? ' (−30%)' : ''}`
  const weekPack = partyInfo.weekThemePack ?? 'party'
  const weekPackLabel = ui[PACKS.find((p) => p.id === weekPack)?.labelKey ?? 'packMixed']

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    void fetchPartyInfo().then(setPartyInfo)
    void fetchStripeHint().then(setStripeHint)
  }, [])

  useEffect(() => {
    if (screen !== 'home' && screen !== 'find') return
    void fetchLobbies(language).then((res) => {
      setLobbies(res.lobbies)
      if (res.weekThemePack) {
        setPartyInfo((prev) => ({ ...prev, weekThemePack: res.weekThemePack }))
      }
    })
    const id = window.setInterval(() => {
      void fetchLobbies(language).then((res) => setLobbies(res.lobbies))
    }, 12_000)
    return () => window.clearInterval(id)
  }, [screen, language])

  // Deep link: /?join=ABCD
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const joinCode = params.get('join')?.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
    if (!joinCode || joinCode.length < 4) return
    setCode(joinCode)
    setJoinStep('name')
    setScreen('join')
    const url = new URL(window.location.href)
    url.searchParams.delete('join')
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('party_session')
    const cancelled = params.get('party_cancel')
    const roomFromUrl = params.get('room')?.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
    if (!sessionId && !cancelled) return

    const clean = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('party_session')
      url.searchParams.delete('party_cancel')
      url.searchParams.delete('room')
      window.history.replaceState({}, '', url.pathname + url.search)
    }

    const pendingRoom =
      roomFromUrl ||
      (() => {
        try {
          return sessionStorage.getItem(PENDING_ROOM_KEY) || ''
        } catch {
          return ''
        }
      })()

    if (cancelled) {
      setPartyFlash(ui.checkoutCancelledHint)
      trackMetric('checkout_cancel', pendingRoom || undefined)
      clean()
      if (pendingRoom) {
        try {
          sessionStorage.setItem(
            RESUME_CHECKOUT_KEY,
            JSON.stringify({ roomCode: pendingRoom, plan: defaultPlan }),
          )
        } catch {
          // ignore
        }
        setResumeCheckout({ roomCode: pendingRoom, plan: defaultPlan })
        try {
          sessionStorage.removeItem(PENDING_ROOM_KEY)
        } catch {
          // ignore
        }
      }
      return
    }

    setCheckoutBusy(true)
    void claimPartySession(sessionId!).then(async (res) => {
      setCheckoutBusy(false)
      clean()
      if (res.error || !res.token || !res.expiresAt) {
        setError(res.error || ui.somethingWrong)
        return
      }
      const pass = { token: res.token, expiresAt: res.expiresAt }
      savePartyPass(pass)
      setPartyPass(pass)
      markPaidBefore()
      setPartyFlash(ui.partyUnlocked)
      setResumeCheckout(null)
      try {
        sessionStorage.removeItem(RESUME_CHECKOUT_KEY)
      } catch {
        // ignore
      }
      void fetchPartyInfo().then(setPartyInfo)

      const targetRoom = (res.roomCode || pendingRoom || '').toUpperCase()
      try {
        sessionStorage.removeItem(PENDING_ROOM_KEY)
      } catch {
        // ignore
      }

      // Pending create after group-size upsell
      try {
        const pendingCreate = sessionStorage.getItem(PENDING_CREATE_KEY)
        if (pendingCreate) {
          sessionStorage.removeItem(PENDING_CREATE_KEY)
          setGroupSize('big')
          setCreateStep('form')
          setScreen('create')
        }
      } catch {
        // ignore
      }

      const session = loadSession()
      if (targetRoom && session?.code === targetRoom) {
        setBusy(true)
        const bound = await ensureSessionBound(5)
        setBusy(false)
        if (bound && !bound.error && bound.room) {
          setPlayerId(bound.playerId)
          setRoom(bound.room)
          setScreen('play')
          await applyStoredPartyToken()
        }
      } else if (targetRoom && !session) {
        // Guest paid to unlock — go join with code
        setCode(targetRoom)
        setJoinStep('name')
        setScreen('join')
        setPartyFlash(ui.partyUnlocked)
      } else if (session) {
        await applyStoredPartyToken()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onBuyParty(roomCode?: string, plan: PartyPlan = defaultPlan) {
    setError('')
    setCheckoutBusy(true)
    if (roomCode) {
      try {
        sessionStorage.setItem(PENDING_ROOM_KEY, roomCode.toUpperCase())
        sessionStorage.setItem(RESUME_CHECKOUT_KEY, JSON.stringify({ roomCode, plan }))
      } catch {
        // ignore
      }
    } else {
      try {
        sessionStorage.setItem(RESUME_CHECKOUT_KEY, JSON.stringify({ plan }))
      } catch {
        // ignore
      }
    }
    if (roomCode && !loadSession()) {
      void trackMetric('guest_unlock_click', roomCode)
    }
    const res = await startPartyCheckout(uiLang, roomCode, plan, firstTime)
    if (res.error || !res.url) {
      setCheckoutBusy(false)
      const hint = stripeHint || (await fetchStripeHint())
      setError(
        partyInfo.enabled
          ? res.error || ui.somethingWrong
          : hint || ui.stripeMissing,
      )
      return
    }
    window.location.href = res.url
  }

  async function onRedeemOwnerCode(code: string) {
    setError('')
    setCheckoutBusy(true)
    const res = await redeemParty(code.trim())
    setCheckoutBusy(false)
    if (res.error || !res.token || !res.expiresAt) {
      setError(res.error || ui.somethingWrong)
      return
    }
    const pass = { token: res.token, expiresAt: res.expiresAt }
    savePartyPass(pass)
    setPartyPass(pass)
    setPartyFlash(ui.partyUnlocked)
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // ignore — browser may block without gesture or support
    }
  }

  useEffect(() => {
    bindSocketHandlers({
      onRoom: (next) => setRoom(next),
      onConnection: (ok) => setConnected(ok),
    })

    const session = loadSession()
    if (!session) return

    setBusy(true)
    ensureSessionBound(5).then((res) => {
      setBusy(false)
      if (!res || res.error || !res.room) {
        // Only clear if room is truly gone
        if (res?.error?.includes('finns inte') || res?.error?.includes('hittades inte')) {
          clearSession()
        }
        return
      }
      setName(session.name)
      setPlayerId(res.playerId)
      setRoom(res.room)
      setScreen('play')
    })
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (hostPlays && !name.trim()) {
      setError(ui.somethingWrong)
      return
    }
    setBusy(true)
    const displayName = hostPlays ? name.trim() : ''
    const res = await createGame(displayName, questionCount, hostPlays, advanceMode, language)
    setBusy(false)
    if (res.error || !res.room) {
      setError(res.error || ui.somethingWrong)
      return
    }
    const sessionName =
      res.room.players.find((p) => p.id === res.playerId)?.name || displayName || (language === 'en' ? 'Host' : 'Värd')
    setPlayerId(res.playerId)
    setRoom(res.room)
    saveSession({ code: res.room.code, playerId: res.playerId, name: sessionName })
    if (pendingPack) {
      await setCategoryPack(pendingPack)
      setPendingPack(null)
    }
    setScreen('play')
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (joinStep === 'code') {
      if (code.length < 4) return
      setJoinStep('name')
      return
    }
    setBusy(true)
    const res = await joinGame(code, name)
    setBusy(false)
    if (res.code === 'ROOM_FULL' || (res.error && res.error.toLowerCase().includes('fullt'))) {
      const roomCode = (res.roomCode || code).toUpperCase()
      setFullRoomCode(roomCode)
      setFullWaitlistCount(res.waitlistCount ?? 1)
      setScreen('guest-unlock')
      return
    }
    if (res.error || !res.room) {
      setError(res.error || ui.somethingWrong)
      return
    }
    setPlayerId(res.playerId)
    setRoom(res.room)
    saveSession({ code: res.room.code, playerId: res.playerId, name })
    setJoinStep('code')
    setScreen('play')
  }

  function leave() {
    clearSession()
    setRoom(null)
    setPlayerId(null)
    setScreen('home')
    setError('')
  }

  return (
    <div className={`app${isFullscreen ? ' is-fullscreen' : ''}`}>
      <div className="blobs" aria-hidden>
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
      </div>

      <div className="shell">
        <div className="topbar-actions">
          <button className="btn-tiny" type="button" onClick={toggleFullscreen}>
            {isFullscreen ? ui.exitFullscreen : ui.fullscreen}
          </button>
        </div>

        <header className="brand">
          <h1>Factopia</h1>
          <p>{ui.tagline}</p>
        </header>

        {!connected && screen === 'play' && (
          <p className="reconnect-banner">{ui.reconnecting}</p>
        )}

        {screen === 'home' && (
          <div className="card home-actions">
            <button className="btn btn-primary" type="button" onClick={() => { setCreateStep('size'); setGroupSize(null); setScreen('create') }}>
              {ui.startNew}
            </button>
            <div className="divider">{ui.or}</div>
            <button className="btn btn-secondary" type="button" onClick={() => { setJoinStep('code'); setScreen('join') }}>
              {ui.joinWithCode}
            </button>
            <button className="btn btn-accent" type="button" onClick={() => setScreen('find')}>
              {ui.findGame}
              {lobbies.length > 0 ? ` · ${lobbies.length}` : ''}
            </button>

            <div className="week-theme">
              <p className="section-title">{ui.weekTheme}</p>
              <p className="week-theme-name">{weekPackLabel}</p>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setPendingPack(weekPack)
                  setCreateStep('size')
                  setGroupSize(null)
                  setScreen('create')
                }}
              >
                {ui.playWeekTheme}
              </button>
            </div>

            <div className="party-home">
              <p className="section-title">{ui.party}</p>
              <p className="party-pitch">{ui.partyPitch}</p>
              <p className="footer-note">{ui.freeTierOk}</p>
              {hasParty ? (
                <p className="footer-note">
                  {ui.partyActive} · {ui.partyUntil} {formatExpiry(partyPass!.expiresAt, uiLang)}
                </p>
              ) : (
                <>
                  <p className="party-hint">{ui.buyPartyHint}</p>
                  <p className="footer-note">{ui.priceAnchorDay}</p>
                  <p className="footer-note">{ui.priceAnchorWeek}</p>
                  {firstTime && <p className="party-flash">{ui.firstPartyDeal}</p>}
                  <div className="party-plans">
                    {weekend ? (
                      <>
                        <button
                          className="btn btn-party"
                          type="button"
                          disabled={checkoutBusy}
                          onClick={() => void onBuyParty(undefined, 'week')}
                        >
                          {checkoutBusy ? ui.buyPartyBusy : buyWeekLabel}
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={checkoutBusy}
                          onClick={() => void onBuyParty(undefined, 'day')}
                        >
                          {buyDayLabel}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-party"
                          type="button"
                          disabled={checkoutBusy}
                          onClick={() => void onBuyParty(undefined, 'day')}
                        >
                          {checkoutBusy ? ui.buyPartyBusy : buyDayLabel}
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={checkoutBusy}
                          onClick={() => void onBuyParty(undefined, 'week')}
                        >
                          {buyWeekLabel}
                        </button>
                      </>
                    )}
                  </div>
                  {resumeCheckout && (
                    <button
                      className="btn btn-accent"
                      type="button"
                      disabled={checkoutBusy}
                      onClick={() =>
                        void onBuyParty(resumeCheckout.roomCode, resumeCheckout.plan || defaultPlan)
                      }
                    >
                      {ui.resumeCheckout}
                    </button>
                  )}
                  <button className="btn-tiny" type="button" onClick={() => setShowOwnerCode((v) => !v)}>
                    {showOwnerCode ? ui.hideCode : ui.haveCode}
                  </button>
                  {showOwnerCode && (
                    <div className="party-redeem">
                      <input
                        value={ownerCode}
                        onChange={(e) => setOwnerCode(e.target.value)}
                        placeholder={ui.partyCode}
                        maxLength={64}
                      />
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={checkoutBusy || !ownerCode.trim()}
                        onClick={() => void onRedeemOwnerCode(ownerCode)}
                      >
                        {ui.activate}
                      </button>
                    </div>
                  )}
                </>
              )}
              {partyFlash && <p className="party-flash">{partyFlash}</p>}
              {error && screen === 'home' && <p className="error">{error}</p>}
              {TIP_URL && (
                <a className="btn btn-ghost" href={TIP_URL} target="_blank" rel="noreferrer">
                  {ui.tipLink}
                </a>
              )}
            </div>
            <p className="footer-note">{ui.footer}</p>
          </div>
        )}

        {screen === 'find' && (
          <div className="card stack">
            <p className="section-title">{ui.openLobbies}</p>
            {lobbies.length === 0 ? (
              <p className="waiting">{ui.noOpenLobbies}</p>
            ) : (
              <ul className="lobby-list">
                {lobbies.map((lobby) => {
                  const packLabel =
                    ui[PACKS.find((p) => p.id === lobby.categoryPack)?.labelKey ?? 'packMixed']
                  const seats =
                    lobby.seatsLeft == null
                      ? ui.unlimited
                      : `${lobby.seatsLeft} ${ui.seatsLeft}`
                  return (
                    <li key={lobby.code}>
                      <button
                        type="button"
                        className="lobby-card"
                        onClick={() => {
                          setCode(lobby.code)
                          setJoinStep('name')
                          setScreen('join')
                        }}
                      >
                        <strong>{lobby.code}</strong>
                        <span>
                          {packLabel} · {lobby.playerCount} {ui.participants.toLowerCase()} · {seats}
                        </span>
                        <span className="lobby-meta">
                          {lobby.language.toUpperCase()}
                          {lobby.party ? ' · Party' : ''} · {lobby.questionCount}q
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {lobbies[0] && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setCode(lobbies[0]!.code)
                  setJoinStep('name')
                  setScreen('join')
                }}
              >
                {ui.quickJoin}
              </button>
            )}
            <button className="btn btn-ghost" type="button" onClick={() => setScreen('home')}>
              {ui.back}
            </button>
          </div>
        )}

        {screen === 'create' && (
          <form className="card stack" onSubmit={onCreate}>
            {createStep === 'size' ? (
              <>
                <p className="section-title">{ui.howMany}</p>
                <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button
                    type="button"
                    className={`choice ${groupSize === 'small' ? 'selected' : ''}`}
                    onClick={() => {
                      setGroupSize('small')
                      setCreateStep('form')
                    }}
                  >
                    {ui.groupSmall}
                  </button>
                  <button
                    type="button"
                    className={`choice ${groupSize === 'big' ? 'selected' : ''}`}
                    onClick={() => {
                      setGroupSize('big')
                      void trackMetric('group_size_upsell', 'big')
                    }}
                  >
                    {ui.groupBig}
                  </button>
                </div>
                {groupSize === 'big' && !hasParty && (
                  <>
                    <p className="party-hint">{ui.groupBigHint}</p>
                    <p className="footer-note">{ui.priceAnchorDay}</p>
                    {firstTime && <p className="party-flash">{ui.firstPartyDeal}</p>}
                    <div className="party-plans">
                      <button
                        className="btn btn-party"
                        type="button"
                        disabled={checkoutBusy}
                        onClick={() => {
                          try {
                            sessionStorage.setItem(PENDING_CREATE_KEY, '1')
                          } catch {
                            // ignore
                          }
                          void onBuyParty(undefined, defaultPlan)
                        }}
                      >
                        {ui.unlockForGroup}
                      </button>
                    </div>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setCreateStep('form')}
                    >
                      {ui.createFastHint}
                    </button>
                  </>
                )}
                {groupSize === 'big' && hasParty && (
                  <button className="btn btn-primary" type="button" onClick={() => setCreateStep('form')}>
                    {ui.createGame}
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    setGroupSize(null)
                    setScreen('home')
                  }}
                >
                  {ui.back}
                </button>
              </>
            ) : (
              <>
            <p className="footer-note">{ui.createFastHint}</p>
            <div>
              <label style={{ marginBottom: '0.4rem' }}>{ui.yourRole}</label>
              <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={`choice ${hostPlays ? 'selected' : ''}`}
                  onClick={() => setHostPlays(true)}
                >
                  {ui.playAlong}
                </button>
                <button
                  type="button"
                  className={`choice ${!hostPlays ? 'selected' : ''}`}
                  onClick={() => setHostPlays(false)}
                >
                  {ui.hostOnly}
                </button>
              </div>
            </div>
            {hostPlays && (
              <label>
                {ui.yourName}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. Alex' : 't.ex. Linus'}
                  maxLength={20}
                  required
                  autoFocus
                />
              </label>
            )}
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy || (hostPlays && !name.trim())}>
              {ui.createGame}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setCreateStep('size')
                setGroupSize(null)
              }}
            >
              {ui.back}
            </button>
              </>
            )}
          </form>
        )}

        {screen === 'guest-unlock' && (
          <div className="card stack">
            <p className="section-title">{ui.guestUnlockTitle}</p>
            <p className="party-pitch">{ui.guestUnlockBody}</p>
            <p className="footer-note">
              {ui.codeLabel}: <strong style={{ letterSpacing: '0.15em' }}>{fullRoomCode}</strong>
              {fullWaitlistCount > 0 ? ` · ${fullWaitlistCount} ${ui.waitingToJoin.toLowerCase()}` : ''}
            </p>
            <p className="footer-note">{ui.priceAnchorDay}</p>
            {firstTime && <p className="party-flash">{ui.firstPartyDeal}</p>}
            <div className="party-plans">
              <button
                className="btn btn-party"
                type="button"
                disabled={checkoutBusy}
                onClick={() => void onBuyParty(fullRoomCode, defaultPlan)}
              >
                {checkoutBusy ? ui.buyPartyBusy : ui.unlockForEveryone}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={checkoutBusy}
                onClick={() => void onBuyParty(fullRoomCode, weekend ? 'day' : 'week')}
              >
                {weekend ? buyDayLabel : buyWeekLabel}
              </button>
            </div>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setJoinStep('name')
                setScreen('join')
              }}
            >
              {ui.back}
            </button>
          </div>
        )}

        {screen === 'join' && (
          <form className="card stack" onSubmit={onJoin}>
            {joinStep === 'code' ? (
              <label>
                {ui.enterCode}
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD"
                  maxLength={4}
                  required
                  autoFocus
                  style={{ letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 800 }}
                />
              </label>
            ) : (
              <label>
                {ui.enterName}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. Sam' : 't.ex. Alex'}
                  maxLength={20}
                  required
                  autoFocus
                />
              </label>
            )}
            {joinStep === 'name' && (
              <p className="footer-note">
                {ui.codeLabel}: <strong style={{ letterSpacing: '0.15em' }}>{code}</strong>
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <button
              className="btn btn-accent"
              type="submit"
              disabled={busy || (joinStep === 'code' ? code.length < 4 : !name.trim())}
            >
              {joinStep === 'code' ? ui.continueCode : ui.join}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                if (joinStep === 'name') {
                  setJoinStep('code')
                  setError('')
                } else {
                  setScreen('home')
                }
              }}
            >
              {ui.back}
            </button>
          </form>
        )}

        {screen === 'play' && room && playerId && (
          <PlayView
            room={room}
            playerId={playerId}
            onLeave={leave}
            onError={setError}
            error={error}
            onPartyPass={(pass) => {
              savePartyPass(pass)
              setPartyPass(pass)
            }}
            partyInfo={partyInfo}
            buyDayLabel={buyDayLabel}
            buyWeekLabel={buyWeekLabel}
            onBuyParty={(plan) => void onBuyParty(room.code, plan)}
            checkoutBusy={checkoutBusy}
          />
        )}
      </div>
    </div>
  )
}

function PlayView({
  room,
  playerId,
  onLeave,
  onError,
  error,
  onPartyPass,
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  onBuyParty,
  checkoutBusy,
}: {
  room: PublicRoom
  playerId: string
  onLeave: () => void
  onError: (msg: string) => void
  error: string
  onPartyPass: (pass: { token: string; expiresAt: number }) => void
  partyInfo: PartyInfo
  buyDayLabel: string
  buyWeekLabel: string
  onBuyParty: (plan?: PartyPlan) => void
  checkoutBusy: boolean
}) {
  const isHost = room.hostId === playerId
  const [tvMode, setTvMode] = useState(false)

  if (room.status === 'lobby') {
    return (
      <Lobby
        room={room}
        playerId={playerId}
        isHost={isHost}
        error={error}
        onError={onError}
        onLeave={onLeave}
        onPartyPass={onPartyPass}
        partyInfo={partyInfo}
        buyDayLabel={buyDayLabel}
        buyWeekLabel={buyWeekLabel}
        onBuyParty={onBuyParty}
        checkoutBusy={checkoutBusy}
        tvMode={tvMode}
        onToggleTv={() => setTvMode((v) => !v)}
      />
    )
  }

  if (room.status === 'finished') {
    return (
      <WinnerView
        room={room}
        playerId={playerId}
        isHost={isHost}
        onLeave={onLeave}
        onError={onError}
        partyInfo={partyInfo}
        buyDayLabel={buyDayLabel}
        buyWeekLabel={buyWeekLabel}
        onBuyParty={onBuyParty}
        checkoutBusy={checkoutBusy}
      />
    )
  }

  return (
    <QuestionView
      room={room}
      playerId={playerId}
      isHost={isHost}
      onError={onError}
      onLeave={onLeave}
      tvMode={tvMode}
      onToggleTv={() => setTvMode((v) => !v)}
    />
  )
}

function Lobby({
  room,
  playerId,
  isHost,
  error,
  onError,
  onLeave,
  onPartyPass,
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  onBuyParty,
  checkoutBusy,
  tvMode,
  onToggleTv,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  error: string
  onError: (msg: string) => void
  onLeave: () => void
  onPartyPass: (pass: { token: string; expiresAt: number }) => void
  partyInfo: PartyInfo
  buyDayLabel: string
  buyWeekLabel: string
  onBuyParty: (plan?: PartyPlan) => void
  checkoutBusy: boolean
  tvMode: boolean
  onToggleTv: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [partyCode, setPartyCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [partyMsg, setPartyMsg] = useState('')
  const [shareFlash, setShareFlash] = useState('')
  const ui = t(room.language)
  const me = room.players.find((p) => p.id === playerId)
  const hostPlaying = me?.playing ?? true
  const participants = room.players.filter((p) => p.playing)
  const spectators = room.players.filter((p) => !p.playing)
  const isParty = room.premiumTier === 'party'
  const counts = room.limits?.questionCounts ?? FREE_COUNTS
  const maxPlayers = room.limits?.maxPlayers ?? 5
  const playersLabel =
    maxPlayers <= 0 ? ui.unlimited : String(maxPlayers)
  const invite = joinUrl(room.code)
  const pack = room.categoryPack ?? 'mixed'
  const seatsLeft = maxPlayers > 0 ? Math.max(0, maxPlayers - room.players.length) : null
  const almostFull = !isParty && maxPlayers > 0 && seatsLeft !== null && seatsLeft <= 1
  const isFull = !isParty && maxPlayers > 0 && seatsLeft === 0
  const waitlist = room.waitlist ?? []

  useEffect(() => {
    if (!isHost || isParty) return
    const pass = loadPartyPass()
    if (!pass) return
    void applyStoredPartyToken().then((res) => {
      if (res.error) return
    })
  }, [isHost, isParty, room.code])

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite)
      setShareFlash(ui.copied)
      window.setTimeout(() => setShareFlash(''), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(room.code)
        setShareFlash(ui.copied)
        window.setTimeout(() => setShareFlash(''), 2000)
      } catch {
        onError(ui.somethingWrong)
      }
    }
  }

  async function shareInvite() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Factopia',
          text: room.language === 'en' ? `Join my Factopia quiz: ${room.code}` : `Gå med i mitt Factopia-quiz: ${room.code}`,
          url: invite,
        })
        return
      } catch {
        // fall through to copy
      }
    }
    await copyInvite()
  }

  async function changeCount(n: number) {
    if (!isHost) return
    const res = await setCount(n)
    if (res.error) onError(res.error)
  }

  async function changeHostPlaying(playing: boolean) {
    if (!isHost) return
    const res = await setHostPlaying(playing)
    if (res.error) onError(res.error)
  }

  async function changeAdvance(mode: AdvanceMode) {
    if (!isHost) return
    const res = await setAdvanceMode(mode)
    if (res.error) onError(res.error)
  }

  async function changeLanguage(lang: QuizLanguage) {
    if (!isHost) return
    rememberLanguage(lang)
    const res = await setLanguage(lang)
    if (res.error) onError(res.error)
  }

  async function changePack(next: CategoryPackId) {
    if (!isHost) return
    const res = await setCategoryPack(next)
    if (res.error) onError(res.error)
  }

  async function changePublic(next: boolean) {
    if (!isHost) return
    const res = await setPublicLobby(next)
    if (res.error) {
      onError(res.error.includes('Party') ? ui.publicNeedsParty : res.error)
      return
    }
  }

  async function onUnlockParty() {
    if (!partyCode.trim()) return
    setBusy(true)
    onError('')
    setPartyMsg('')
    const res = await activateParty(partyCode.trim())
    setBusy(false)
    if (res.error || !res.token || !res.expiresAt) {
      onError(res.error || ui.somethingWrong)
      return
    }
    onPartyPass({ token: res.token, expiresAt: res.expiresAt })
    setPartyMsg(ui.partyActive)
    setPartyCode('')
  }

  async function onStart() {
    setBusy(true)
    onError('')
    const res = await startGame()
    setBusy(false)
    if (res.error) onError(res.error)
  }

  return (
    <div className={`card stack${tvMode ? ' tv-mode' : ''}`}>
      <div className="code-display">
        <span>{ui.gameCode}</span>
        <strong>{room.code}</strong>
        {!tvMode && <p className="invite-hint">{ui.inviteHint}</p>}
        {!tvMode && (
          <div className="invite-actions">
            <button className="btn btn-secondary" type="button" onClick={() => void copyInvite()}>
              {shareFlash || ui.copyCode}
            </button>
            <button className="btn btn-accent" type="button" onClick={() => void shareInvite()}>
              {ui.shareInvite}
            </button>
          </div>
        )}
        <div className="invite-qr">
          <img src={qrUrl(invite)} alt={ui.scanToJoin} width={tvMode ? 260 : 180} height={tvMode ? 260 : 180} />
          <span>{ui.scanToJoin}</span>
        </div>
      </div>

      {isHost && (
        <button className="btn-tiny" type="button" onClick={onToggleTv}>
          {tvMode ? ui.tvModeOff : ui.tvModeOn}
        </button>
      )}

      {isHost && !tvMode ? (
        <>
          <div className={`party-banner ${isParty ? 'on' : ''}`}>
            <div>
              <strong>{isParty ? ui.partyActive : ui.party}</strong>
              <p>
                {isParty && room.premiumExpiresAt
                  ? `${ui.partyUntil} ${formatExpiry(room.premiumExpiresAt, room.language)}`
                  : ui.freeTierOk}
              </p>
            </div>
            {!isParty && (
              <>
                <p className="party-hint">{almostFull || isFull ? (isFull ? ui.roomFullUpsell : ui.roomAlmostFull) : ui.buyPartyHint}</p>
                <p className="footer-note">{ui.priceAnchorDay}</p>
                <div className={`party-plans${almostFull || isFull ? ' urgent' : ''}`}>
                  <button
                    className="btn btn-party"
                    type="button"
                    disabled={checkoutBusy}
                    onClick={() => onBuyParty(isWeekend() ? 'week' : 'day')}
                  >
                    {checkoutBusy ? ui.buyPartyBusy : isWeekend() ? buyWeekLabel : buyDayLabel}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={checkoutBusy}
                    onClick={() => onBuyParty(isWeekend() ? 'day' : 'week')}
                  >
                    {isWeekend() ? buyDayLabel : buyWeekLabel}
                  </button>
                </div>
              </>
            )}
            {!isParty && (
              <>
                <button className="btn-tiny" type="button" onClick={() => setShowCode((v) => !v)}>
                  {showCode ? ui.hideCode : ui.haveCode}
                </button>
                {showCode && (
                  <div className="party-redeem">
                    <input
                      value={partyCode}
                      onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                      placeholder={ui.partyCode}
                      maxLength={64}
                    />
                    <button className="btn btn-secondary" type="button" onClick={onUnlockParty} disabled={busy}>
                      {ui.activate}
                    </button>
                  </div>
                )}
              </>
            )}
            {!isParty && !partyInfo.enabled && <p className="footer-note">{ui.buyPartySoon}</p>}
          </div>

          <div>
            <label style={{ marginBottom: '0.4rem' }}>{ui.language}</label>
            <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${room.language === 'sv' ? 'selected' : ''}`}
                onClick={() => changeLanguage('sv')}
              >
                {ui.swedish}
              </button>
              <button
                type="button"
                className={`choice ${room.language === 'en' ? 'selected' : ''}`}
                onClick={() => changeLanguage('en')}
              >
                {ui.english}
              </button>
            </div>
          </div>
          <div>
            <label style={{ marginBottom: '0.4rem' }}>{ui.vibe}</label>
            <div className="choice-row pack-row">
              {PACKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`choice ${pack === p.id ? 'selected' : ''}`}
                  onClick={() => void changePack(p.id)}
                >
                  {ui[p.labelKey]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ marginBottom: '0.4rem' }}>{ui.makePublic}</label>
            <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${room.isPublic ? 'selected' : ''}`}
                onClick={() => void changePublic(true)}
              >
                {ui.publicOn}
              </button>
              <button
                type="button"
                className={`choice ${!room.isPublic ? 'selected' : ''}`}
                onClick={() => void changePublic(false)}
              >
                {ui.publicOff}
              </button>
            </div>
          </div>
          <div>
            <label style={{ marginBottom: '0.4rem' }}>{ui.questionCount}</label>
            <div className="choice-row">
              {counts.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`choice ${room.questionCount === n ? 'selected' : ''}`}
                  onClick={() => changeCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ marginBottom: '0.4rem' }}>{ui.yourRole}</label>
            <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${hostPlaying ? 'selected' : ''}`}
                onClick={() => changeHostPlaying(true)}
              >
                {ui.playAlong}
              </button>
              <button
                type="button"
                className={`choice ${!hostPlaying ? 'selected' : ''}`}
                onClick={() => changeHostPlaying(false)}
              >
                {ui.hostOnly}
              </button>
            </div>
          </div>
          <div>
            <label style={{ marginBottom: '0.4rem' }}>{ui.betweenQuestions}</label>
            <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${room.advanceMode === 'manual' ? 'selected' : ''}`}
                onClick={() => changeAdvance('manual')}
              >
                {ui.clickNext}
              </button>
              <button
                type="button"
                className={`choice ${room.advanceMode === 'auto' ? 'selected' : ''}`}
                onClick={() => changeAdvance('auto')}
              >
                {ui.auto}
              </button>
            </div>
          </div>
        </>
      ) : (
        !isHost && (
          <p className="waiting">
            {room.questionCount} {ui.waitingStart}
          </p>
        )
      )}

      <div>
        <p className="meta" style={{ marginBottom: '0.5rem' }}>
          <span>{ui.participants}</span>
          <span>
            {participants.length}/{playersLabel}
          </span>
        </p>
        {participants.length === 0 ? (
          <p className="waiting">{ui.noPlayers}</p>
        ) : (
          <ul className={`players${tvMode ? ' tv-players' : ''}`}>
            {participants.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.id === playerId && <span className="you">{ui.you}</span>}
              </li>
            ))}
          </ul>
        )}
        {spectators.length > 0 && (
          <>
            <p className="meta" style={{ margin: '0.75rem 0 0.5rem' }}>
              <span>{ui.spectators}</span>
              <span>{spectators.length}</span>
            </p>
            <ul className="players">
              {spectators.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className="you">{ui.watching}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {isHost && waitlist.length > 0 && (
          <>
            <p className="meta" style={{ margin: '0.75rem 0 0.5rem' }}>
              <span>{ui.waitingToJoin}</span>
              <span>{waitlist.length}</span>
            </p>
            <ul className="players waitlist">
              {waitlist.map((w) => (
                <li key={w.id}>
                  <span>{w.name}</span>
                  <span className="you">🔒</span>
                </li>
              ))}
            </ul>
            {!isParty && (
              <div className="party-banner urgent-inline">
                <p className="party-hint">{ui.roomFullUpsell}</p>
                <button className="btn btn-party" type="button" disabled={checkoutBusy} onClick={() => onBuyParty(isWeekend() ? 'week' : 'day')}>
                  {isWeekend() ? buyWeekLabel : buyDayLabel}
                </button>
              </div>
            )}
          </>
        )}
        {isHost && !hostPlaying && !tvMode && (
          <p className="footer-note" style={{ marginTop: '0.6rem' }}>
            {ui.hostHidden}
          </p>
        )}
        {isHost && !isParty && maxPlayers > 0 && almostFull && !tvMode && (
          <div className="party-banner urgent-inline">
            <p className="party-hint">{isFull ? ui.roomFullUpsell : ui.roomAlmostFull}</p>
            <button className="btn btn-party" type="button" disabled={checkoutBusy} onClick={() => onBuyParty('day')}>
              {buyDayLabel}
            </button>
          </div>
        )}
      </div>

      {partyMsg && <p className="footer-note">{partyMsg}</p>}
      {error && <p className="error">{error}</p>}

      {isHost && (
        <button className="btn btn-primary" type="button" onClick={onStart} disabled={busy}>
          {ui.startQuiz}
        </button>
      )}
      {!tvMode && (
        <button className="btn btn-ghost" type="button" onClick={onLeave}>
          {ui.endQuiz}
        </button>
      )}
    </div>
  )
}

function QuestionView({
  room,
  playerId,
  isHost,
  onError,
  onLeave,
  tvMode,
  onToggleTv,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  onError: (msg: string) => void
  onLeave: () => void
  tvMode: boolean
  onToggleTv: () => void
}) {
  const ui = t(room.language)
  const q = room.question
  const me = room.players.find((p) => p.id === playerId)
  const isSpectator = me ? !me.playing : false
  const revealing = room.status === 'reveal'
  const manual = room.advanceMode === 'manual'
  const { ratio, seconds } = useCountdown(
    revealing && manual ? null : (q?.endsAt ?? null),
    revealing ? REVEAL_MS : QUESTION_MS,
  )
  const locked = isSpectator || room.yourAnswer !== null || revealing
  const isLast = q ? q.index + 1 >= q.total : false
  const [busyNext, setBusyNext] = useState(false)
  const [busyEnd, setBusyEnd] = useState(false)

  async function answer(i: number) {
    if (locked) return
    const res = await submitAnswer(i)
    if (res.error) onError(res.error)
  }

  async function onNext() {
    setBusyNext(true)
    const res = await nextQuestion()
    setBusyNext(false)
    if (res.error) onError(res.error)
  }

  async function onEnd() {
    setBusyEnd(true)
    const res = await endGame()
    setBusyEnd(false)
    if (res.error) onError(res.error)
  }

  if (!q) return null

  const correctText =
    room.revealCorrectIndex !== null ? q.options[room.revealCorrectIndex] : null

  return (
    <div className={`card stack${tvMode ? ' tv-mode' : ''}`}>
      {isHost && (
        <button className="btn-tiny" type="button" onClick={onToggleTv}>
          {tvMode ? ui.tvModeOff : ui.tvModeOn}
        </button>
      )}
      <div className="meta">
        <span className="category">{q.category}</span>
        <span>
          {q.index + 1}/{q.total}
        </span>
      </div>

      {!revealing && (
        <>
          <div className="progress" aria-hidden>
            <span style={{ width: `${ratio * 100}%` }} />
          </div>
          <p className="meta" style={{ justifyContent: 'center', margin: 0 }}>
            {seconds}s · {room.answeredCount}/{room.playingCount} {ui.answered}
          </p>
        </>
      )}

      <h2 className="question-text">{q.text}</h2>

      {revealing && correctText && (
        <div className="correct-banner">
          <span>{ui.correctAnswer}</span>
          <strong>{correctText}</strong>
        </div>
      )}

      {isSpectator && !revealing && (
        <p className="waiting">{isHost ? ui.hosting : ui.spectating}</p>
      )}

      {!revealing && !(tvMode && isSpectator) && (
        <div className="answers">
          {q.options.map((opt, i) => {
            let cls = 'answer'
            if (room.yourAnswer === i) cls += ' picked'
            return (
              <button
                key={i}
                type="button"
                className={cls}
                disabled={locked}
                onClick={() => answer(i)}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {room.yourAnswer !== null && !revealing && !isSpectator && (
        <p className="waiting">{ui.answerSent}</p>
      )}

      {revealing && room.lastRound && (
        <>
          <p className="section-title">{ui.thisRound}</p>
          <ul className="round-results">
            {room.lastRound.map((r) => (
              <li key={r.playerId} className={r.correct ? 'hit' : 'miss'}>
                <span className="mark" aria-hidden>
                  {r.correct ? '✓' : '✗'}
                </span>
                <span className="who">
                  {r.name}
                  {r.playerId === playerId ? ` (${ui.you})` : ''}
                </span>
                <span className="gain">{r.correct ? `+${r.gained}` : '0'}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {revealing && (
        <>
          <p className="section-title">{ui.standings}</p>
          <ol className="scoreboard">
            {[...room.players]
              .filter((p) => p.playing)
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <li
                  key={p.id}
                  className={i === 0 ? 'place-1' : i === 1 ? 'place-2' : i === 2 ? 'place-3' : undefined}
                >
                  <span className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                  <span>
                    {p.name}
                    {p.id === playerId ? ` (${ui.you})` : ''}
                  </span>
                  <span className="pts">
                    {p.score} {room.language === 'en' ? 'pts' : 'p'}
                  </span>
                </li>
              ))}
          </ol>
        </>
      )}

      {revealing && manual && isHost && (
        <button className="btn btn-primary" type="button" onClick={onNext} disabled={busyNext}>
          {isLast ? ui.showWinner : ui.nextQuestion}
        </button>
      )}

      {revealing && manual && !isHost && <p className="waiting">{ui.waitingNext}</p>}

      {revealing && !manual && (
        <p className="next-countdown">
          {isLast ? ui.resultsIn : ui.nextIn} <strong>{seconds}</strong>s
        </p>
      )}

      {isHost ? (
        <button className="btn btn-ghost" type="button" onClick={onEnd} disabled={busyEnd}>
          {ui.endQuiz}
        </button>
      ) : (
        <button className="btn btn-ghost" type="button" onClick={onLeave}>
          {ui.leave}
        </button>
      )}
    </div>
  )
}

function WinnerView({
  room,
  playerId,
  isHost,
  onLeave,
  onError,
  partyInfo,
  buyDayLabel,
  buyWeekLabel,
  onBuyParty,
  checkoutBusy,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  onLeave: () => void
  onError: (msg: string) => void
  partyInfo: PartyInfo
  buyDayLabel: string
  buyWeekLabel: string
  onBuyParty: (plan?: PartyPlan) => void
  checkoutBusy: boolean
}) {
  const ui = t(room.language)
  const ranked = [...room.players].filter((p) => p.playing).sort((a, b) => b.score - a.score)
  const winner = ranked[0]
  const isYou = winner?.id === playerId
  const me = room.players.find((p) => p.id === playerId)
  const hostedOnly = me && !me.playing
  const [busy, setBusy] = useState(false)
  const [shareFlash, setShareFlash] = useState('')

  async function onRematch() {
    setBusy(true)
    onError('')
    const res = await rematchGame()
    setBusy(false)
    if (res.error) onError(res.error)
  }

  async function shareResults() {
    const lines = ranked.map((p, i) => `${i + 1}. ${p.name} — ${p.score}`)
    const invite = `${window.location.origin}/?join=${room.code}`
    const text =
      room.language === 'en'
        ? `Factopia results\n${lines.join('\n')}\n\nPlay again: ${invite}`
        : `Factopia-resultat\n${lines.join('\n')}\n\nSpela igen: ${invite}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Factopia', text, url: invite })
        return
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareFlash(ui.resultsCopied)
      window.setTimeout(() => setShareFlash(''), 2000)
    } catch {
      onError(ui.somethingWrong)
    }
  }

  return (
    <div className="card winner-screen">
      <Confetti />
      <span className="trophy" aria-hidden>
        🏆
      </span>
      <h2>{hostedOnly ? ui.winnerIs : isYou ? ui.youWon : ui.winnerIs}</h2>
      <p className="name">{winner?.name ?? '—'}</p>
      <p className="score">
        {winner?.score ?? 0} {ui.points}
      </p>

      <p className="section-title">{ui.standings}</p>
      <ol className="scoreboard">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={i === 0 ? 'place-1' : i === 1 ? 'place-2' : i === 2 ? 'place-3' : undefined}
          >
            <span className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
            <span>
              {p.name}
              {p.id === playerId ? ` (${ui.you})` : ''}
            </span>
            <span className="pts">
              {p.score} {room.language === 'en' ? 'pts' : 'p'}
            </span>
          </li>
        ))}
      </ol>

      <button className="btn btn-accent" type="button" onClick={() => void shareResults()}>
        {shareFlash || ui.shareResults}
      </button>

      {isHost ? (
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void onRematch()}>
          {ui.playAgain}
        </button>
      ) : (
        <p className="waiting">{ui.waitingRematch}</p>
      )}
      {room.premiumTier !== 'party' && isHost && partyInfo.enabled && (
        <div className="party-plans">
          <button className="btn btn-party" type="button" disabled={checkoutBusy} onClick={() => onBuyParty('day')}>
            {checkoutBusy ? ui.buyPartyBusy : buyDayLabel}
          </button>
          <button className="btn btn-secondary" type="button" disabled={checkoutBusy} onClick={() => onBuyParty('week')}>
            {buyWeekLabel}
          </button>
        </div>
      )}
      {room.premiumTier !== 'party' && isHost && !partyInfo.enabled && (
        <p className="footer-note">{ui.buyPartySoon}</p>
      )}
      <button className="btn btn-ghost" type="button" onClick={onLeave}>
        {ui.leaveRoom}
      </button>
    </div>
  )
}
