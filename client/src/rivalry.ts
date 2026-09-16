/** Local house rivalry — no accounts, keyed by player name. */

const KEY = 'factopia-rivalry-v1'

export type RivalRecord = {
  wins: number
  losses: number
  lastScore: number
  games: number
}

type Store = Record<string, RivalRecord>

function norm(name: string) {
  return name.trim().toLowerCase().slice(0, 40)
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function recordGameResult(opts: {
  myName: string
  winnerName: string
  myScore: number
  played: boolean
}) {
  if (!opts.played) return
  const store = load()
  const me = norm(opts.myName)
  if (!me) return
  const won = norm(opts.winnerName) === me
  const prev = store[me] ?? { wins: 0, losses: 0, lastScore: 0, games: 0 }
  store[me] = {
    wins: prev.wins + (won ? 1 : 0),
    losses: prev.losses + (won ? 0 : 1),
    lastScore: opts.myScore,
    games: prev.games + 1,
  }
  save(store)
}

export function rivalryBlurb(myName: string, lang: 'sv' | 'en'): string | null {
  const rec = load()[norm(myName)]
  if (!rec || rec.games < 1) return null
  if (lang === 'en') {
    return `House record: ${rec.wins}–${rec.losses} · last score ${rec.lastScore}`
  }
  return `Husfacit: ${rec.wins}–${rec.losses} · förra matchen ${rec.lastScore} p`
}

export function rematchTaunt(
  myName: string,
  winnerName: string,
  lang: 'sv' | 'en',
): string | null {
  const me = norm(myName)
  const them = norm(winnerName)
  if (!me || !them || me === them) return null
  const store = load()
  const mine = store[me]
  if (!mine || mine.games < 2) return null
  if (lang === 'en') {
    return mine.wins > mine.losses
      ? `Rematch? You’re ahead ${mine.wins}–${mine.losses} at this house.`
      : `Rematch — time to flip ${mine.wins}–${mine.losses}.`
  }
  return mine.wins > mine.losses
    ? `Revansch? Du leder ${mine.wins}–${mine.losses} i det här huset.`
    : `Revansch — dags att vända ${mine.wins}–${mine.losses}.`
}
