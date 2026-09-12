import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  bindSocketHandlers,
  clearSession,
  createGame,
  endGame,
  ensureSessionBound,
  fetchLobbies,
  joinGame,
  loadSession,
  nextQuestion,
  rematchGame,
  saveSession,
  setAdvanceMode,
  setCategoryPack,
  setCount,
  setHostPlaying,
  setLanguage,
  setPublicLobby,
  startGame,
  submitAnswer,
  trackMetric,
} from './api'
import { detectPreferredLanguage, rememberLanguage, t } from './i18n'
import type {
  AdvanceMode,
  CategoryPackId,
  PublicLobbyCard,
  PublicRoom,
  QuizLanguage,
} from './types'
import { Confetti, useCountdown } from './ui'
import { renderResultsImage } from './shareCard'

type Screen = 'home' | 'create' | 'join' | 'find' | 'play'

const FREE_COUNTS = [10, 20, 30, 50]
const QUESTION_MS = 20_000
const REVEAL_MS = 6_000
const TIP_URL = (import.meta.env.VITE_TIP_URL as string | undefined) || ''
const PARTY_PATHS_URL = 'https://partypaths.com'
const SABOTEXT_URL = 'https://sabotext.com'
const SCOURGEBORN_URL = 'https://scourgeborn.com'
const YOUR_TASK_IS_URL = 'https://yourtaskis.com'
const KLOTTERKAOS_URL = 'https://klotterkaos.com'

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

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [questionCount] = useState(10)
  const [hostPlays, setHostPlays] = useState(false)
  const [advanceMode] = useState<AdvanceMode>('auto')
  const [language] = useState<QuizLanguage>(() => detectPreferredLanguage())
  const [joinStep, setJoinStep] = useState<'code' | 'name'>('code')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lobbies, setLobbies] = useState<PublicLobbyCard[]>([])
  const [activity, setActivity] = useState({
    gamesTonight: 0,
    liveRooms: 0,
    livePlayers: 0,
    openLobbies: 0,
  })
  const [pendingPack, setPendingPack] = useState<CategoryPackId | null>(null)
  const [weekThemePack, setWeekThemePack] = useState<CategoryPackId>('party')
  const [hostTvDefault, setHostTvDefault] = useState(false)

  const uiLang = room?.language ?? language
  const ui = t(uiLang)
  const weekPackLabel = ui[PACKS.find((p) => p.id === weekThemePack)?.labelKey ?? 'packMixed']

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    if (screen !== 'home' && screen !== 'find') return
    const applyLobbies = (res: Awaited<ReturnType<typeof fetchLobbies>>) => {
      setLobbies(res.lobbies)
      if (res.activity) setActivity(res.activity)
      if (res.weekThemePack) setWeekThemePack(res.weekThemePack)
    }
    void fetchLobbies(language).then(applyLobbies)
    const id = window.setInterval(() => {
      void fetchLobbies(language).then(applyLobbies)
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
    setHostTvDefault(true)
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
          {screen === 'home' && <p className="landing-pitch">{ui.landingPitch}</p>}
        </header>

        {!connected && screen === 'play' && (
          <p className="reconnect-banner">{ui.reconnecting}</p>
        )}

        {screen === 'home' && (
          <div className="card home-actions">
            <div className="social-proof" aria-live="polite">
              {activity.gamesTonight > 0 || activity.livePlayers > 0 ? (
                <>
                  {activity.gamesTonight > 0 && (
                    <span>{ui.socialProofTonight.replace('{n}', String(activity.gamesTonight))}</span>
                  )}
                  {activity.livePlayers > 0 && (
                    <span>{ui.socialProofLive.replace('{n}', String(activity.livePlayers))}</span>
                  )}
                  {lobbies.length > 0 && (
                    <span>{ui.socialProofOpen.replace('{n}', String(lobbies.length))}</span>
                  )}
                </>
              ) : (
                <span>{ui.socialProofEmpty}</span>
              )}
            </div>
            <button className="btn btn-primary" type="button" onClick={() => setScreen('create')}>
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
                  setPendingPack(weekThemePack)
                  setScreen('create')
                }}
              >
                {ui.playWeekTheme}
              </button>
            </div>

            <p className="footer-note">{ui.freeTierOk}</p>
            {error && screen === 'home' && <p className="error">{error}</p>}
            {TIP_URL && (
              <a className="btn btn-ghost" href={TIP_URL} target="_blank" rel="noreferrer">
                {ui.tipLink}
              </a>
            )}
            <p className="footer-note">{ui.footer}</p>
            <a
              className="sister-game"
              href={PARTY_PATHS_URL}
              target="_blank"
              rel="noreferrer"
            >
              <strong>Party Paths</strong>
              <span>{ui.partyPathsPitch}</span>
              <em>{ui.partyPathsCta}</em>
            </a>
            <a
              className="sister-game sabotext"
              href={SABOTEXT_URL}
              target="_blank"
              rel="noreferrer"
            >
              <strong>Sabotext</strong>
              <span>{ui.sabotextPitch}</span>
              <em>{ui.sabotextCta}</em>
            </a>
            <a
              className="sister-game scourgeborn"
              href={SCOURGEBORN_URL}
              target="_blank"
              rel="noreferrer"
            >
              <strong>Scourgeborn</strong>
              <span>{ui.scourgebornPitch}</span>
              <em>{ui.scourgebornCta}</em>
            </a>
            <a
              className="sister-game yourtaskis"
              href={YOUR_TASK_IS_URL}
              target="_blank"
              rel="noreferrer"
            >
              <strong>Your Task Is</strong>
              <span>{ui.yourTaskIsPitch}</span>
              <em>{ui.yourTaskIsCta}</em>
            </a>
            <a
              className="sister-game klotterkaos"
              href={KLOTTERKAOS_URL}
              target="_blank"
              rel="noreferrer"
            >
              <strong>Klotterkaos</strong>
              <span>{ui.klotterkaosPitch}</span>
              <em>{ui.klotterkaosCta}</em>
            </a>
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
              onClick={() => setScreen('home')}
            >
              {ui.back}
            </button>
          </form>
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
            startInTvMode={hostTvDefault}
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
  startInTvMode,
}: {
  room: PublicRoom
  playerId: string
  onLeave: () => void
  onError: (msg: string) => void
  error: string
  startInTvMode?: boolean
}) {
  const isHost = room.hostId === playerId
  const ui = t(room.language)
  const [tvMode, setTvMode] = useState(Boolean(startInTvMode && isHost))
  const [wasHost, setWasHost] = useState(isHost)
  const [localFlash, setLocalFlash] = useState('')
  const knownPlayerIds = useRef(new Set(room.players.map((p) => p.id)))

  useEffect(() => {
    if (isHost && !wasHost) {
      setLocalFlash(ui.youAreHostNow)
      window.setTimeout(() => setLocalFlash(''), 5000)
    }
    setWasHost(isHost)
  }, [isHost, wasHost, ui.youAreHostNow])

  useEffect(() => {
    if (!isHost || room.status !== 'lobby') {
      knownPlayerIds.current = new Set(room.players.map((p) => p.id))
      return
    }
    const newcomers = room.players.filter((p) => !knownPlayerIds.current.has(p.id))
    knownPlayerIds.current = new Set(room.players.map((p) => p.id))
    if (newcomers.length === 0) return
    const name = newcomers[0]?.name || '?'
    const playing = room.players.filter((p) => p.playing).length
    setLocalFlash(
      `${ui.playerJoinedFlash.replace('{name}', name)} · ${ui.playersNowShare.replace('{n}', String(playing))}`,
    )
    window.setTimeout(() => setLocalFlash(''), 5500)
  }, [room.players, room.status, isHost, ui.playerJoinedFlash, ui.playersNowShare])

  const hostPlayer = room.players.find((p) => p.id === room.hostId)
  const hostAway = Boolean(hostPlayer && !hostPlayer.connected)

  if (room.status === 'lobby') {
    return (
      <>
        {(localFlash || hostAway) && (
          <p className={`party-unlock-banner${hostAway && !localFlash ? ' warn' : ''}`}>
            {localFlash || ui.hostAway}
          </p>
        )}
      <Lobby
        room={room}
        playerId={playerId}
        isHost={isHost}
        error={error}
        onError={onError}
        onLeave={onLeave}
        tvMode={tvMode}
        onToggleTv={() => setTvMode((v) => !v)}
      />
      </>
    )
  }

  if (room.status === 'finished') {
    return (
      <>
        {localFlash && <p className="party-unlock-banner">{localFlash}</p>}
      <WinnerView
        room={room}
        playerId={playerId}
        isHost={isHost}
        onLeave={onLeave}
        onError={onError}
      />
      </>
    )
  }

  return (
    <>
      {(localFlash || hostAway) && (
        <p className={`party-unlock-banner${hostAway && !localFlash ? ' warn' : ''}`}>
          {localFlash || ui.hostAway}
        </p>
      )}
    <QuestionView
      room={room}
      playerId={playerId}
      isHost={isHost}
      onError={onError}
      onLeave={onLeave}
      tvMode={tvMode}
      onToggleTv={() => setTvMode((v) => !v)}
    />
    </>
  )
}

function Lobby({
  room,
  playerId,
  isHost,
  error,
  onError,
  onLeave,
  tvMode,
  onToggleTv,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  error: string
  onError: (msg: string) => void
  onLeave: () => void
  tvMode: boolean
  onToggleTv: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [shareFlash, setShareFlash] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showMoreSettings, setShowMoreSettings] = useState(false)
  const ui = t(room.language)
  const me = room.players.find((p) => p.id === playerId)
  const hostPlaying = me?.playing ?? false
  const participants = room.players.filter((p) => p.playing)
  const spectators = room.players.filter((p) => !p.playing)
  const counts = room.limits?.questionCounts ?? FREE_COUNTS
  const maxPlayers = room.limits?.maxPlayers ?? 0
  const playersLabel =
    maxPlayers <= 0 ? ui.unlimited : String(maxPlayers)
  const invite = joinUrl(room.code)
  const pack = room.categoryPack ?? 'mixed'

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
        // fall through
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
      onError(res.error)
      return
    }
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
      <div className="code-display host-focus">
        <span>{ui.gameCode}</span>
        <strong>{room.code}</strong>
        {!tvMode && <p className="invite-hint">{ui.inviteHint}</p>}
        {!tvMode && (
          <div className="invite-actions host-primary-actions">
            <button className="btn btn-primary" type="button" onClick={() => void copyInvite()}>
              {shareFlash || ui.copyLinkPrimary}
            </button>
            <button className="btn btn-accent" type="button" onClick={() => void shareInvite()}>
              {ui.shareInvite}
            </button>
          </div>
        )}
        <div className="invite-qr">
          <img src={qrUrl(invite)} alt={ui.scanToJoin} width={tvMode ? 280 : 200} height={tvMode ? 280 : 200} />
          <span>{ui.scanToJoin}</span>
        </div>
      </div>

      {isHost && (
        <div className={`host-control-bar${tvMode ? ' tv-host-bar' : ''}`}>
          <button
            className={`btn ${tvMode ? 'btn-secondary' : 'btn-accent'}`}
            type="button"
            onClick={onToggleTv}
          >
            {tvMode ? ui.tvModeOff : ui.showOnTv}
          </button>
          <button
            className={`btn ${showSettings ? 'btn-primary' : 'btn-secondary'}`}
            type="button"
            onClick={() => setShowSettings((v) => !v)}
          >
            {showSettings ? ui.hideSettings : ui.editSettings}
          </button>
        </div>
      )}

      <div className={`lobby-roster${participants.length === 0 ? ' is-waiting' : ' has-players'}`}>
        {isHost && participants.length === 0 ? (
          <div className="lobby-waiting-status" aria-live="polite">
            <p className="lobby-waiting-title">
              <span className="lobby-pulse" aria-hidden="true" />
              {ui.waitingForPlayers}
            </p>
            <p className="lobby-waiting-hint">{ui.waitingForPlayersHint}</p>
            <p className="lobby-waiting-count">
              {ui.playersJoined.replace('{n}', '0')} · {playersLabel === ui.unlimited ? ui.unlimited : `max ${playersLabel}`}
            </p>
          </div>
        ) : (
          <>
            <p className="meta lobby-roster-head">
              <span>{ui.participants}</span>
              <span>
                {participants.length}/{playersLabel}
              </span>
            </p>
            {isHost && participants.length > 0 && (
              <p className="lobby-ready-line">{ui.readyWhenYouAre}</p>
            )}
          </>
        )}

        {participants.length === 0 && !isHost ? (
          <p className="waiting">{ui.noPlayers}</p>
        ) : participants.length > 0 ? (
          <ul className={`players${tvMode ? ' tv-players' : ''}`}>
            {participants.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.id === playerId && <span className="you">{ui.you}</span>}
              </li>
            ))}
          </ul>
        ) : null}

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
        {isHost && !hostPlaying && !tvMode && participants.length > 0 && (
          <p className="footer-note" style={{ marginTop: '0.6rem' }}>
            {ui.hostHidden}
          </p>
        )}
      </div>

      {!isHost && (
        <p className="waiting">
          {room.questionCount} {ui.waitingStart}
        </p>
      )}

      {isHost && showSettings && (
        <div className={`lobby-settings${tvMode ? ' tv-settings-panel' : ''}`}>
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
          <button className="btn-tiny" type="button" onClick={() => setShowMoreSettings((v) => !v)}>
            {ui.moreSettings}
          </button>
          {showMoreSettings && (
            <>
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
          )}
          {tvMode && (
            <button className="btn btn-ghost" type="button" onClick={onLeave}>
              {ui.endQuiz}
            </button>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {isHost && (
        <button
          className="btn btn-primary"
          type="button"
          onClick={onStart}
          disabled={busy}
        >
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
    revealing ? REVEAL_MS : (q?.durationMs ?? QUESTION_MS),
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
        {q.mode === 'double' && <span className="mode-badge mode-double">{ui.modeDouble}</span>}
        {q.mode === 'lightning' && (
          <span className="mode-badge mode-lightning">{ui.modeLightning}</span>
        )}
        <span>
          {q.index + 1}/{q.total}
        </span>
      </div>

      {!revealing && q.mode === 'lightning' && (
        <p className="mode-hint lightning-hint">{ui.modeLightningHint}</p>
      )}
      {!revealing && q.mode === 'double' && (
        <p className="mode-hint double-hint">{ui.modeDoubleHint}</p>
      )}

      {!revealing && (
        <>
          <div className={`progress${q.mode === 'lightning' ? ' lightning-bar' : ''}`} aria-hidden>
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

      {/* TV mode: hide options until reveal (anti-spoiler for the big screen) */}
      {!revealing && !tvMode && (
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

      {tvMode && !revealing && (
        <p className="waiting tv-wait">
          {seconds}s · {room.answeredCount}/{room.playingCount} {ui.answered}
        </p>
      )}

      {room.yourAnswer !== null && !revealing && !isSpectator && !tvMode && (
        <p className="waiting">{ui.answerSent}</p>
      )}

      {revealing && room.lastRound && !tvMode && (
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
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  onLeave: () => void
  onError: (msg: string) => void
}) {
  const ui = t(room.language)
  const ranked = [...room.players].filter((p) => p.playing).sort((a, b) => b.score - a.score)
  const winner = ranked[0]
  const isYou = winner?.id === playerId
  const me = room.players.find((p) => p.id === playerId)
  const hostedOnly = me && !me.playing
  const [busy, setBusy] = useState(false)
  const [shareFlash, setShareFlash] = useState('')
  const [showShareNudge, setShowShareNudge] = useState(true)
  const invite = joinUrl(room.code)

  async function onRematch() {
    setBusy(true)
    onError('')
    const res = await rematchGame()
    setBusy(false)
    if (res.error) onError(res.error)
  }

  async function shareResults() {
    const lines = ranked.map((p, i) => `${i + 1}. ${p.name} — ${p.score}`)
    const text = ui.shareChallengeText
      .replace('{lines}', lines.join('\n'))
      .replace('{invite}', invite)
    void trackMetric('share_results', room.code)
    setShowShareNudge(false)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Factopia', text, url: invite })
        setShareFlash(ui.resultsCopied)
        window.setTimeout(() => setShareFlash(''), 2000)
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

  async function shareInviteMore() {
    const text =
      room.language === 'en'
        ? `Join our Factopia rematch: ${room.code}\n${invite}`
        : `Gå med i vår Factopia-omstart: ${room.code}\n${invite}`
    void trackMetric('share_results', `invite:${room.code}`)
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
      setShareFlash(ui.copied)
      window.setTimeout(() => setShareFlash(''), 2000)
    } catch {
      onError(ui.somethingWrong)
    }
  }

  async function shareImage() {
    const blob = await renderResultsImage({
      title: winner ? `${ui.winnerIs} ${winner.name}` : ui.standings,
      subtitle: `${winner?.score ?? 0} ${ui.points}`,
      rows: ranked.map((p, i) => ({
        rank: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`,
        name: p.name,
        score: `${p.score}`,
      })),
      footer: invite,
      cta: ui.shareImageCta,
    })
    if (!blob) {
      onError(ui.somethingWrong)
      return
    }
    void trackMetric('share_results', `image:${room.code}`)
    setShowShareNudge(false)
    const file = new File([blob], 'factopia-resultat.png', { type: 'image/png' })
    const text = ui.imageShareText.replace('{invite}', invite)
    try {
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Factopia',
          text,
        })
        return
      }
    } catch {
      // fall through to download
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'factopia-resultat.png'
    a.click()
    URL.revokeObjectURL(url)
    setShareFlash(ui.resultsCopied)
    window.setTimeout(() => setShareFlash(''), 2000)
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

      {showShareNudge && (
        <p className="party-unlock-banner share-nudge">{ui.shareViralHint}</p>
      )}

      <div className="party-plans viral-share">
        <button className="btn btn-primary" type="button" onClick={() => void shareResults()}>
          {shareFlash || ui.challengeShare}
        </button>
        <button className="btn btn-accent" type="button" onClick={() => void shareImage()}>
          {ui.shareImage}
        </button>
      </div>

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

      {isHost ? (
        <>
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void onRematch()}>
            {ui.playAgain}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => void shareInviteMore()}>
            {ui.inviteMoreRematch}
          </button>
        </>
      ) : (
        <p className="waiting">{ui.waitingRematch}</p>
      )}
      <a
        className="sister-game compact"
        href={PARTY_PATHS_URL}
        target="_blank"
        rel="noreferrer"
      >
        <strong>Party Paths</strong>
        <span>{ui.partyPathsPitch}</span>
        <em>{ui.partyPathsCta}</em>
      </a>
      <a
        className="sister-game compact sabotext"
        href={SABOTEXT_URL}
        target="_blank"
        rel="noreferrer"
      >
        <strong>Sabotext</strong>
        <span>{ui.sabotextPitch}</span>
        <em>{ui.sabotextCta}</em>
      </a>
      <a
        className="sister-game compact scourgeborn"
        href={SCOURGEBORN_URL}
        target="_blank"
        rel="noreferrer"
      >
        <strong>Scourgeborn</strong>
        <span>{ui.scourgebornPitch}</span>
        <em>{ui.scourgebornCta}</em>
      </a>
      <a
        className="sister-game compact yourtaskis"
        href={YOUR_TASK_IS_URL}
        target="_blank"
        rel="noreferrer"
      >
        <strong>Your Task Is</strong>
        <span>{ui.yourTaskIsPitch}</span>
        <em>{ui.yourTaskIsCta}</em>
      </a>
      <a
        className="sister-game compact klotterkaos"
        href={KLOTTERKAOS_URL}
        target="_blank"
        rel="noreferrer"
      >
        <strong>Klotterkaos</strong>
        <span>{ui.klotterkaosPitch}</span>
        <em>{ui.klotterkaosCta}</em>
      </a>
      <button className="btn btn-ghost" type="button" onClick={onLeave}>
        {ui.leaveRoom}
      </button>
    </div>
  )
}
