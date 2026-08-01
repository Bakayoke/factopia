import type { Question, QuestionMode, QuizLanguage } from './types.js'

export const QUESTION_MS = 20_000
export const LIGHTNING_MS = 8_000
export const REVEAL_MS = 6_000

export function normalizeMode(mode?: QuestionMode): QuestionMode {
  return mode === 'double' || mode === 'lightning' ? mode : 'normal'
}

export function questionDurationMs(mode?: QuestionMode): number {
  return normalizeMode(mode) === 'lightning' ? LIGHTNING_MS : QUESTION_MS
}

/** Base 1000 + up to 500 speed; double mode ×2. */
export function scoreCorrectAnswer(elapsedMs: number, mode?: QuestionMode): number {
  const m = normalizeMode(mode)
  const window = questionDurationMs(m)
  const speedBonus = Math.max(0, Math.round(500 * (1 - elapsedMs / window)))
  const base = 1000 + speedBonus
  return m === 'double' ? base * 2 : base
}

const EASY_SV = new Set([
  'allmänt',
  'popkultur',
  'mat & dryck',
  'mat',
  'sverige',
  'kultur',
  'film & tv',
  'musik',
])
const EASY_EN = new Set([
  'general',
  'pop culture',
  'food',
  'culture',
  'movies & tv',
  'music',
])

function isEasy(q: Question, language: QuizLanguage) {
  const cat = q.category.toLowerCase()
  return language === 'en' ? EASY_EN.has(cat) : EASY_SV.has(cat)
}

function shuffleIdx(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/**
 * Spice a round: ~15% double (2× points), ~15% lightning (8s, prefer easy).
 * Keeps modes already set on questions from the bank.
 */
export function assignSpecialModes(questions: Question[], language: QuizLanguage): Question[] {
  const out = questions.map((q) => ({
    ...q,
    mode: normalizeMode(q.mode),
  }))
  const n = out.length
  if (n === 0) return out

  const wantDouble = Math.max(n >= 8 ? 1 : 0, Math.round(n * 0.15))
  const wantLightning = Math.max(n >= 8 ? 1 : 0, Math.round(n * 0.15))

  let haveDouble = out.filter((q) => q.mode === 'double').length
  let haveLightning = out.filter((q) => q.mode === 'lightning').length

  const free = shuffleIdx(n).filter((i) => out[i]!.mode === 'normal')

  // Lightning first — prefer easy categories
  const easyFree = free.filter((i) => isEasy(out[i]!, language))
  const lightningPool = [...easyFree, ...free.filter((i) => !easyFree.includes(i))]
  for (const i of lightningPool) {
    if (haveLightning >= wantLightning) break
    out[i]!.mode = 'lightning'
    haveLightning += 1
  }

  const stillFree = shuffleIdx(n).filter((i) => out[i]!.mode === 'normal')
  for (const i of stillFree) {
    if (haveDouble >= wantDouble) break
    out[i]!.mode = 'double'
    haveDouble += 1
  }

  return out
}
