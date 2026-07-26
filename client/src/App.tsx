import { useEffect, useState, type FormEvent } from 'react'
import {
  clearSession,
  createGame,
  getSocket,
  joinGame,
  loadSession,
  nextQuestion,
  rejoinGame,
  saveSession,
  setAdvanceMode,
  setCount,
  setHostPlaying,
  startGame,
  submitAnswer,
} from './api'
import type { AdvanceMode, PublicRoom } from './types'
import { Confetti, useCountdown } from './ui'

type Screen = 'home' | 'create' | 'join' | 'play'

const COUNTS = [10, 20, 30]
const QUESTION_MS = 20_000
const REVEAL_MS = 6_000

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [hostPlays, setHostPlays] = useState(true)
  const [advanceMode, setAdvanceModeLocal] = useState<AdvanceMode>('manual')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const socket = getSocket()
    const onRoom = (next: PublicRoom) => setRoom(next)
    socket.on('room', onRoom)

    const session = loadSession()
    if (session) {
      setBusy(true)
      rejoinGame(session.code, session.playerId).then((res) => {
        setBusy(false)
        if (res.error || !res.room) {
          clearSession()
          return
        }
        setName(session.name)
        setPlayerId(res.playerId)
        setRoom(res.room)
        setScreen('play')
      })
    }

    return () => {
      socket.off('room', onRoom)
    }
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await createGame(name, questionCount, hostPlays, advanceMode)
    setBusy(false)
    if (res.error || !res.room) {
      setError(res.error || 'Något gick fel')
      return
    }
    setPlayerId(res.playerId)
    setRoom(res.room)
    saveSession({ code: res.room.code, playerId: res.playerId, name })
    setScreen('play')
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await joinGame(code, name)
    setBusy(false)
    if (res.error || !res.room) {
      setError(res.error || 'Något gick fel')
      return
    }
    setPlayerId(res.playerId)
    setRoom(res.room)
    saveSession({ code: res.room.code, playerId: res.playerId, name })
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
    <div className="app">
      <div className="blobs" aria-hidden>
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
      </div>

      <div className="shell">
        <header className="brand">
          <h1>Factopia</h1>
          <p>Partyquiz för hela gänget</p>
        </header>

        {screen === 'home' && (
          <div className="card home-actions">
            <button className="btn btn-primary" type="button" onClick={() => setScreen('create')}>
              Starta nytt spel
            </button>
            <div className="divider">eller</div>
            <button className="btn btn-secondary" type="button" onClick={() => setScreen('join')}>
              Gå med med kod
            </button>
            <p className="footer-note">Dela koden — svara — fira vinnaren</p>
          </div>
        )}

        {screen === 'create' && (
          <form className="card stack" onSubmit={onCreate}>
            <label>
              Ditt namn
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="t.ex. Linus"
                maxLength={20}
                required
                autoFocus
              />
            </label>
            <div>
              <label style={{ marginBottom: '0.4rem' }}>Antal frågor</label>
              <div className="choice-row">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`choice ${questionCount === n ? 'selected' : ''}`}
                    onClick={() => setQuestionCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ marginBottom: '0.4rem' }}>Din roll</label>
              <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={`choice ${hostPlays ? 'selected' : ''}`}
                  onClick={() => setHostPlays(true)}
                >
                  Spela med
                </button>
                <button
                  type="button"
                  className={`choice ${!hostPlays ? 'selected' : ''}`}
                  onClick={() => setHostPlays(false)}
                >
                  Bara hosta
                </button>
              </div>
            </div>
            <div>
              <label style={{ marginBottom: '0.4rem' }}>Mellan frågor</label>
              <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={`choice ${advanceMode === 'manual' ? 'selected' : ''}`}
                  onClick={() => setAdvanceModeLocal('manual')}
                >
                  Klicka nästa
                </button>
                <button
                  type="button"
                  className={`choice ${advanceMode === 'auto' ? 'selected' : ''}`}
                  onClick={() => setAdvanceModeLocal('auto')}
                >
                  Auto
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
              Skapa spel
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setScreen('home')}>
              Tillbaka
            </button>
          </form>
        )}

        {screen === 'join' && (
          <form className="card stack" onSubmit={onJoin}>
            <label>
              Ditt namn
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="t.ex. Alex"
                maxLength={20}
                required
                autoFocus
              />
            </label>
            <label>
              Spelkod
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                maxLength={4}
                required
                style={{ letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 800 }}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-accent" type="submit" disabled={busy || !name.trim() || code.length < 4}>
              Gå med
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setScreen('home')}>
              Tillbaka
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
}: {
  room: PublicRoom
  playerId: string
  onLeave: () => void
  onError: (msg: string) => void
  error: string
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
      />
    )
  }

  if (room.status === 'finished') {
    return <WinnerView room={room} playerId={playerId} onLeave={onLeave} />
  }

  return <QuestionView room={room} playerId={playerId} isHost={isHost} onError={onError} />
}

function Lobby({
  room,
  playerId,
  isHost,
  error,
  onError,
  onLeave,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  error: string
  onError: (msg: string) => void
  onLeave: () => void
}) {
  const [busy, setBusy] = useState(false)
  const me = room.players.find((p) => p.id === playerId)
  const hostPlaying = me?.playing ?? true
  const participants = room.players.filter((p) => p.playing)

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
        <span>Spelkod</span>
        <strong>{room.code}</strong>
      </div>

      {isHost ? (
        <>
          <div>
            <label style={{ marginBottom: '0.4rem' }}>Antal frågor</label>
            <div className="choice-row">
              {COUNTS.map((n) => (
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
            <label style={{ marginBottom: '0.4rem' }}>Din roll</label>
            <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${hostPlaying ? 'selected' : ''}`}
                onClick={() => changeHostPlaying(true)}
              >
                Spela med
              </button>
              <button
                type="button"
                className={`choice ${!hostPlaying ? 'selected' : ''}`}
                onClick={() => changeHostPlaying(false)}
              >
                Bara hosta
              </button>
            </div>
          </div>
          <div>
            <label style={{ marginBottom: '0.4rem' }}>Mellan frågor</label>
            <div className="choice-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`choice ${room.advanceMode === 'manual' ? 'selected' : ''}`}
                onClick={() => changeAdvance('manual')}
              >
                Klicka nästa
              </button>
              <button
                type="button"
                className={`choice ${room.advanceMode === 'auto' ? 'selected' : ''}`}
                onClick={() => changeAdvance('auto')}
              >
                Auto
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="waiting">
          {room.questionCount} frågor · {room.advanceMode === 'manual' ? 'värden klickar vidare' : 'auto'} · väntar…
        </p>
      )}

      <div>
        <p className="meta" style={{ marginBottom: '0.5rem' }}>
          <span>Deltagare</span>
          <span>{participants.length}/12</span>
        </p>
        {participants.length === 0 ? (
          <p className="waiting">Inga spelare ännu — dela koden!</p>
        ) : (
          <ul className="players">
            {participants.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.id === playerId && <span className="you">du</span>}
              </li>
            ))}
          </ul>
        )}
        {isHost && !hostPlaying && (
          <p className="footer-note" style={{ marginTop: '0.6rem' }}>
            Du hostar och syns inte i listan
          </p>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {isHost && (
        <button className="btn btn-primary" type="button" onClick={onStart} disabled={busy}>
          Starta quizet!
        </button>
      )}
      <button className="btn btn-ghost" type="button" onClick={onLeave}>
        Lämna
      </button>
    </div>
  )
}

function QuestionView({
  room,
  playerId,
  isHost,
  onError,
}: {
  room: PublicRoom
  playerId: string
  isHost: boolean
  onError: (msg: string) => void
}) {
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
            {seconds}s · {room.answeredCount}/{room.playingCount} har svarat
          </p>
        </>
      )}

      <h2 className="question-text">{q.text}</h2>

      {revealing && correctText && (
        <div className="correct-banner">
          <span>Rätt svar</span>
          <strong>{correctText}</strong>
        </div>
      )}

      {isSpectator && !revealing && (
        <p className="waiting">Du hostar — spelarna svarar nu</p>
      )}

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
        <p className="waiting">Svar skickat! Väntar på de andra…</p>
      )}

      {revealing && room.lastRound && (
        <ul className="round-results">
          {room.lastRound.map((r) => (
            <li key={r.playerId} className={r.correct ? 'hit' : 'miss'}>
              <span className="mark" aria-hidden>
                {r.correct ? '✓' : '✗'}
              </span>
              <span className="who">
                {r.name}
                {r.playerId === playerId ? ' (du)' : ''}
              </span>
              <span className="gain">{r.correct ? `+${r.gained}` : '0'}</span>
            </li>
          ))}
        </ul>
      )}

      {revealing && (
        <ul className="players scoreboard">
          {[...room.players]
            .filter((p) => p.playing)
            .sort((a, b) => b.score - a.score)
            .map((p, i) => (
              <li key={p.id}>
                <span>
                  {i + 1}. {p.name}
                </span>
                <span>{p.score} p</span>
              </li>
            ))}
        </ul>
      )}

      {revealing && manual && isHost && (
        <button className="btn btn-primary" type="button" onClick={onNext} disabled={busyNext}>
          {isLast ? 'Visa vinnare' : 'Nästa fråga'}
        </button>
      )}

      {revealing && manual && !isHost && (
        <p className="waiting">Väntar på att värden går vidare…</p>
      )}

      {revealing && !manual && (
        <p className="next-countdown">
          {isLast ? 'Resultat om' : 'Nästa fråga om'} <strong>{seconds}</strong>s
        </p>
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
      <h2>{hostedOnly ? 'Vinnaren är' : isYou ? 'Du vann!' : 'Vinnaren är'}</h2>
      <p className="name">{winner?.name ?? '—'}</p>
      <p className="score">{winner?.score ?? 0} poäng</p>

      <ol className="podium">
        {ranked.map((p, i) => (
          <li key={p.id}>
            <span>{i + 1}.</span>
            <span>
              {p.name}
              {p.id === playerId ? ' (du)' : ''}
            </span>
            <span>{p.score} p</span>
          </li>
        ))}
      </ol>

      <button className="btn btn-primary" type="button" onClick={onLeave}>
        Spela igen
      </button>
    </div>
  )
}
