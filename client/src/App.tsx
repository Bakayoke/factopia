import { useEffect, useState, type FormEvent } from 'react'
import {
  clearSession,
  createGame,
  getSocket,
  joinGame,
  loadSession,
  rejoinGame,
  saveSession,
  setCount,
  startGame,
  submitAnswer,
} from './api'
import type { PublicRoom } from './types'
import { Confetti, useCountdown } from './ui'

type Screen = 'home' | 'create' | 'join' | 'play'

const COUNTS = [10, 20, 30]

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
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
    const res = await createGame(name, questionCount)
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

  return <QuestionView room={room} onError={onError} />
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

  async function changeCount(n: number) {
    if (!isHost) return
    const res = await setCount(n)
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
      ) : (
        <p className="waiting">{room.questionCount} frågor · väntar på att värden startar…</p>
      )}

      <div>
        <p className="meta" style={{ marginBottom: '0.5rem' }}>
          <span>Spelare</span>
          <span>{room.players.length}/12</span>
        </p>
        <ul className="players">
          {room.players.map((p) => (
            <li key={p.id}>
              <span>
                {p.name}{' '}
                {p.id === room.hostId && <span className="host-tag">värd</span>}
              </span>
              {p.id === playerId && <span className="you">du</span>}
            </li>
          ))}
        </ul>
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

function QuestionView({ room, onError }: { room: PublicRoom; onError: (msg: string) => void }) {
  const q = room.question
  const { remainingMs, ratio } = useCountdown(q?.endsAt ?? null)
  const revealing = room.status === 'reveal'
  const locked = room.yourAnswer !== null || revealing

  async function answer(i: number) {
    if (locked) return
    const res = await submitAnswer(i)
    if (res.error) onError(res.error)
  }

  if (!q) return null

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
            {Math.ceil(remainingMs / 1000)}s · {room.answeredCount} har svarat
          </p>
        </>
      )}

      <h2 className="question-text">{q.text}</h2>

      <div className="answers">
        {q.options.map((opt, i) => {
          let cls = 'answer'
          if (room.yourAnswer === i) cls += ' picked'
          if (revealing && room.revealCorrectIndex === i) cls += ' correct'
          if (revealing && room.yourAnswer === i && room.revealCorrectIndex !== i) cls += ' wrong'
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

      {room.yourAnswer !== null && !revealing && (
        <p className="waiting">Svar skickat! Väntar på de andra…</p>
      )}

      {revealing && (
        <ul className="players">
          {[...room.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span>{p.score} p</span>
              </li>
            ))}
        </ul>
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
  const ranked = [...room.players].sort((a, b) => b.score - a.score)
  const winner = ranked[0]
  const isYou = winner?.id === playerId

  return (
    <div className="card winner-screen">
      <Confetti />
      <span className="trophy" aria-hidden>
        🏆
      </span>
      <h2>{isYou ? 'Du vann!' : 'Vinnaren är'}</h2>
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
