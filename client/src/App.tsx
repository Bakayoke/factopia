import { useEffect, useState, type FormEvent } from 'react'
import {
  activateParty,
  applyStoredPartyToken,
  bindSocketHandlers,
  clearSession,
  createGame,
  endGame,
  ensureSessionBound,
  joinGame,
  loadPartyPass,
  loadSession,
  nextQuestion,
  savePartyPass,
  saveSession,
  setAdvanceMode,
  setCount,
  setCustomQuestions,
  setHostPlaying,
  setLanguage,
  setRoomTitle,
  startGame,
  submitAnswer,
} from './api'
import { t } from './i18n'
import type { AdvanceMode, PublicCustomQuestion, PublicRoom, QuizLanguage } from './types'
import { Confetti, useCountdown } from './ui'

type Screen = 'home' | 'create' | 'join' | 'play'

const FREE_COUNTS = [10, 20, 30]
const ALL_COUNTS = [10, 20, 30, 50]
const QUESTION_MS = 20_000
const REVEAL_MS = 6_000
const TIP_URL = (import.meta.env.VITE_TIP_URL as string | undefined) || ''

function emptyCustom(): PublicCustomQuestion {
  return {
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    category: 'Egna',
  }
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
  const [questionCount, setQuestionCount] = useState(10)
  const [hostPlays, setHostPlays] = useState(true)
  const [advanceMode, setAdvanceModeLocal] = useState<AdvanceMode>('manual')
  const [language, setLanguageLocal] = useState<QuizLanguage>('sv')
  const [joinStep, setJoinStep] = useState<'code' | 'name'>('code')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [partyPass, setPartyPass] = useState(() => loadPartyPass())

  const uiLang = room?.language ?? language
  const ui = t(uiLang)
  const hasParty = Boolean(partyPass && partyPass.expiresAt > Date.now())
  const createCounts = hasParty ? ALL_COUNTS : FREE_COUNTS

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    if (questionCount === 50 && !hasParty) setQuestionCount(30)
  }, [hasParty, questionCount])

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
        </header>

        {!connected && screen === 'play' && (
          <p className="reconnect-banner">{ui.reconnecting}</p>
        )}

        {screen === 'home' && (
          <div className="card home-actions">
            <button className="btn btn-primary" type="button" onClick={() => setScreen('create')}>
              {ui.startNew}
            </button>
            <div className="divider">{ui.or}</div>
            <button className="btn btn-secondary" type="button" onClick={() => { setJoinStep('code'); setScreen('join') }}>
              {ui.joinWithCode}
            </button>
            <div className="party-home">
              <p className="section-title">{ui.party}</p>
              <p className="footer-note">{ui.partyPitch}</p>
              <p className="footer-note">{hasParty ? `${ui.partyActive} · ${ui.partyUntil} ${formatExpiry(partyPass!.expiresAt, uiLang)}` : ui.partyFreeNote}</p>
              {!hasParty && <p className="footer-note">{ui.buyPartySoon}</p>}
              {TIP_URL && (
                <a className="btn btn-ghost" href={TIP_URL} target="_blank" rel="noreferrer">
                  {ui.tipLink}
                </a>
              )}
            </div>
            <p className="footer-note">{ui.footer}</p>
          </div>
        )}

        {screen === 'create' && (
          <form className="card stack" onSubmit={onCreate}>
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
            <div>
              <label style={{ marginBottom: '0.4rem' }}>{ui.language}</label>
              <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={`choice ${language === 'sv' ? 'selected' : ''}`}
                  onClick={() => setLanguageLocal('sv')}
                >
                  {ui.swedish}
                </button>
                <button
                  type="button"
                  className={`choice ${language === 'en' ? 'selected' : ''}`}
                  onClick={() => setLanguageLocal('en')}
                >
                  {ui.english}
                </button>
              </div>
            </div>
            <div>
              <label style={{ marginBottom: '0.4rem' }}>{ui.questionCount}</label>
              <div className="choice-row">
                {createCounts.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`choice ${questionCount === n ? 'selected' : ''}`}
                    onClick={() => setQuestionCount(n)}
                  >
                    {n}
                  </button>
                ))}
                {!hasParty && (
                  <button type="button" className="choice locked" disabled title={ui.partyPitch}>
                    50 <span className="lock-tag">{ui.partyLocked}</span>
                  </button>
                )}
              </div>
              {!hasParty && <p className="footer-note" style={{ marginTop: '0.5rem' }}>{ui.buyPartySoon}</p>}
              {hasParty && partyPass && (
                <p className="footer-note" style={{ marginTop: '0.5rem' }}>
                  {ui.partyActive} · {formatExpiry(partyPass.expiresAt, language)}
                </p>
              )}
            </div>
            <div>
              <label style={{ marginBottom: '0.4rem' }}>{ui.betweenQuestions}</label>
              <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={`choice ${advanceMode === 'manual' ? 'selected' : ''}`}
                  onClick={() => setAdvanceModeLocal('manual')}
                >
                  {ui.clickNext}
                </button>
                <button
                  type="button"
                  className={`choice ${advanceMode === 'auto' ? 'selected' : ''}`}
                  onClick={() => setAdvanceModeLocal('auto')}
                >
                  {ui.auto}
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy || (hostPlays && !name.trim())}>
              {ui.createGame}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setScreen('home')}>
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
            onPartyPass={(pass) => {
              savePartyPass(pass)
              setPartyPass(pass)
            }}
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
}: {
  room: PublicRoom
  playerId: string
  onLeave: () => void
  onError: (msg: string) => void
  error: string
  onPartyPass: (pass: { token: string; expiresAt: number }) => void
}) {
  const isHost = room.hostId === playerId

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
      />
    )
  }

  if (room.status === 'finished') {
    return <WinnerView room={room} playerId={playerId} onLeave={onLeave} />
  }

  return <QuestionView room={room} playerId={playerId} isHost={isHost} onError={onError} onLeave={onLeave} />
}

function Lobby({
  room,
  playerId,
  isHost,
  error,
  onError,
  onLeave,
  onPartyPass,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  error: string
  onError: (msg: string) => void
  onLeave: () => void
  onPartyPass: (pass: { token: string; expiresAt: number }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [partyCode, setPartyCode] = useState('')
  const [titleDraft, setTitleDraft] = useState(room.roomTitle || '')
  const [customs, setCustoms] = useState<PublicCustomQuestion[]>(
    room.customQuestions?.length ? room.customQuestions : [],
  )
  const [partyMsg, setPartyMsg] = useState('')
  const ui = t(room.language)
  const me = room.players.find((p) => p.id === playerId)
  const hostPlaying = me?.playing ?? true
  const participants = room.players.filter((p) => p.playing)
  const isParty = room.premiumTier === 'party'
  const counts = room.limits?.questionCounts ?? FREE_COUNTS
  const maxPlayers = room.limits?.maxPlayers ?? 8

  useEffect(() => {
    setTitleDraft(room.roomTitle || '')
  }, [room.roomTitle])

  useEffect(() => {
    if (room.customQuestions) setCustoms(room.customQuestions)
  }, [room.customQuestions])

  useEffect(() => {
    if (!isHost || isParty) return
    const pass = loadPartyPass()
    if (!pass) return
    void applyStoredPartyToken().then((res) => {
      if (res.error) return
    })
  }, [isHost, isParty, room.code])

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
    const res = await setLanguage(lang)
    if (res.error) onError(res.error)
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

  async function onSaveTitle() {
    const res = await setRoomTitle(titleDraft)
    if (res.error) onError(res.error)
  }

  async function onSaveCustoms() {
    setBusy(true)
    onError('')
    const cleaned = customs.filter((q) => q.text.trim() && q.options.every((o) => o.trim()))
    const res = await setCustomQuestions(cleaned)
    setBusy(false)
    if (res.error) onError(res.error)
    else setPartyMsg(ui.customSaved)
  }

  async function onStart() {
    setBusy(true)
    onError('')
    const res = await startGame()
    setBusy(false)
    if (res.error) onError(res.error)
  }

  return (
    <div className="card stack">
      <div className="code-display">
        <span>{ui.gameCode}</span>
        <strong>{room.code}</strong>
      </div>

      {room.roomTitle ? <p className="room-title">{room.roomTitle}</p> : null}

      {isHost ? (
        <>
          <div className={`party-banner ${isParty ? 'on' : ''}`}>
            <div>
              <strong>{isParty ? ui.partyActive : ui.party}</strong>
              <p>{isParty && room.premiumExpiresAt ? `${ui.partyUntil} ${formatExpiry(room.premiumExpiresAt, room.language)}` : ui.partyPitch}</p>
            </div>
            {!isParty && (
              <div className="party-redeem">
                <input
                  value={partyCode}
                  onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                  placeholder={ui.partyCode}
                  maxLength={24}
                />
                <button className="btn btn-secondary" type="button" onClick={onUnlockParty} disabled={busy}>
                  {ui.activate}
                </button>
              </div>
            )}
            {!isParty && <p className="footer-note">{ui.buyPartySoon}</p>}
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
              {!isParty && (
                <button type="button" className="choice locked" disabled>
                  50 <span className="lock-tag">{ui.partyLocked}</span>
                </button>
              )}
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

          {isParty && (
            <>
              <label>
                {ui.roomTitle}
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => void onSaveTitle()}
                  placeholder={ui.roomTitlePlaceholder}
                  maxLength={40}
                />
              </label>

              <div className="custom-block">
                <p className="section-title">{ui.customQuestions}</p>
                {customs.map((q, qi) => (
                  <div className="custom-q" key={qi}>
                    <input
                      value={q.text}
                      placeholder={`${ui.questionText} ${qi + 1}`}
                      onChange={(e) => {
                        const next = [...customs]
                        next[qi] = { ...q, text: e.target.value }
                        setCustoms(next)
                      }}
                    />
                    <div className="custom-opts">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="custom-opt">
                          <input
                            type="radio"
                            name={`correct-${qi}`}
                            checked={q.correctIndex === oi}
                            onChange={() => {
                              const next = [...customs]
                              next[qi] = { ...q, correctIndex: oi }
                              setCustoms(next)
                            }}
                          />
                          <input
                            value={opt}
                            placeholder={`${ui.option} ${oi + 1}`}
                            onChange={(e) => {
                              const nextOpts = [...q.options] as [string, string, string, string]
                              nextOpts[oi] = e.target.value
                              const next = [...customs]
                              next[qi] = { ...q, options: nextOpts }
                              setCustoms(next)
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      className="btn-tiny"
                      type="button"
                      onClick={() => setCustoms(customs.filter((_, i) => i !== qi))}
                    >
                      {ui.removeQuestion}
                    </button>
                  </div>
                ))}
                <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={customs.length >= (room.limits?.maxCustomQuestions ?? 30)}
                    onClick={() => setCustoms([...customs, emptyCustom()])}
                  >
                    {ui.addQuestion}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={onSaveCustoms} disabled={busy}>
                    {ui.saveQuestions}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="waiting">
          {room.questionCount} {ui.waitingStart}
        </p>
      )}

      <div>
        <p className="meta" style={{ marginBottom: '0.5rem' }}>
          <span>{ui.participants}</span>
          <span>
            {participants.length}/{maxPlayers}
          </span>
        </p>
        {participants.length === 0 ? (
          <p className="waiting">{ui.noPlayers}</p>
        ) : (
          <ul className="players">
            {participants.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.id === playerId && <span className="you">{ui.you}</span>}
              </li>
            ))}
          </ul>
        )}
        {isHost && !hostPlaying && (
          <p className="footer-note" style={{ marginTop: '0.6rem' }}>
            {ui.hostHidden}
          </p>
        )}
      </div>

      {partyMsg && <p className="footer-note">{partyMsg}</p>}
      {error && <p className="error">{error}</p>}

      {isHost && (
        <button className="btn btn-primary" type="button" onClick={onStart} disabled={busy}>
          {ui.startQuiz}
        </button>
      )}
      <button className="btn btn-ghost" type="button" onClick={onLeave}>
        {ui.endQuiz}
      </button>
    </div>
  )
}

function QuestionView({
  room,
  playerId,
  isHost,
  onError,
  onLeave,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  onError: (msg: string) => void
  onLeave: () => void
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
    <div className="card stack">
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

      {isSpectator && !revealing && <p className="waiting">{ui.hosting}</p>}

      {!revealing && (
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
  onLeave,
}: {
  room: PublicRoom
  playerId: string
  onLeave: () => void
}) {
  const ui = t(room.language)
  const ranked = [...room.players].filter((p) => p.playing).sort((a, b) => b.score - a.score)
  const winner = ranked[0]
  const isYou = winner?.id === playerId
  const me = room.players.find((p) => p.id === playerId)
  const hostedOnly = me && !me.playing

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

      <button className="btn btn-primary" type="button" onClick={onLeave}>
        {ui.playAgain}
      </button>
      {room.premiumTier !== 'party' && room.hostId === playerId && (
        <p className="footer-note">{ui.buyPartySoon}</p>
      )}
    </div>
  )
}
