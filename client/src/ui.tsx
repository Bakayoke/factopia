import { useEffect, useMemo, useState } from 'react'

type Piece = { id: number; left: number; delay: number; duration: number; color: string; rotate: number }

const COLORS = ['#ff5a3c', '#ffc857', '#2ec4b6', '#ff8fab', '#7bdff2', '#bdb2ff']

export function Confetti({ count = 36 }: { count?: number }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.8,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [count],
  )

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

export function useCountdown(endsAt: number | null, totalMs = 20_000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [endsAt])

  if (!endsAt) return { remainingMs: 0, ratio: 0, seconds: 0 }
  const remainingMs = Math.max(0, endsAt - now)
  return {
    remainingMs,
    ratio: Math.min(1, remainingMs / totalMs),
    seconds: Math.ceil(remainingMs / 1000),
  }
}
