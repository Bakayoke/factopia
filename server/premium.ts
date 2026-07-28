export type PremiumTier = 'free' | 'party'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  questionCounts: number[]
}

export const FREE_LIMITS: PremiumLimits = {
  maxPlayers: 5, // host + 4
  questionCounts: [10, 20, 30, 50],
}

export const PARTY_LIMITS: PremiumLimits = {
  maxPlayers: 0, // unlimited — pay for bigger groups, not question inventing
  questionCounts: [10, 20, 30, 50],
}

export const PARTY_PASS_MS = 24 * 60 * 60 * 1000
export const PARTY_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type PartyPlan = 'day' | 'week'

export type PartyPass = {
  token: string
  tier: 'party'
  expiresAt: number
  plan?: PartyPlan
}

/** In-memory passes. Also mirrored to Redis/file when persist is configured. */
const passes = new Map<string, PartyPass>()

let onPersist: (() => void) | null = null

export function setPassPersistHook(fn: (() => void) | null) {
  onPersist = fn
}

function touchPasses() {
  onPersist?.()
}

function configuredPassCodes(): Set<string> {
  // Only this free bypass by default — everyone else pays via Stripe.
  const raw = process.env.PARTY_PASS_CODES ?? 'LinusÄrBästHundraProcent'
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  )
}

export function limitsFor(tier: PremiumTier): PremiumLimits {
  return tier === 'party' ? PARTY_LIMITS : FREE_LIMITS
}

export function isPartyActive(expiresAt: number | null | undefined): boolean {
  return typeof expiresAt === 'number' && expiresAt > Date.now()
}

export function tierFromExpiry(expiresAt: number | null | undefined): PremiumTier {
  return isPartyActive(expiresAt) ? 'party' : 'free'
}

export function issuePartyPass(plan: PartyPlan = 'day'): PartyPass {
  const duration = plan === 'week' ? PARTY_WEEK_MS : PARTY_PASS_MS
  const pass: PartyPass = {
    token: crypto.randomUUID(),
    tier: 'party',
    expiresAt: Date.now() + duration,
    plan,
  }
  passes.set(pass.token, pass)
  touchPasses()
  return pass
}

export function restorePasses(list: PartyPass[]) {
  const now = Date.now()
  for (const pass of list) {
    if (!pass?.token || !pass.expiresAt || pass.expiresAt <= now) continue
    passes.set(pass.token, pass)
  }
}

export function allPasses() {
  return passes
}

export function redeemPassCode(code: string): PartyPass | { error: string } {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return { error: 'Ange en party-kod' }
  if (!configuredPassCodes().has(normalized)) {
    return { error: 'Ogiltig party-kod' }
  }
  return issuePartyPass()
}

export function lookupPass(token: string | null | undefined): PartyPass | null {
  if (!token) return null
  const pass = passes.get(token)
  if (!pass) return null
  if (pass.expiresAt <= Date.now()) {
    passes.delete(token)
    touchPasses()
    return null
  }
  return pass
}

export type CustomQuestionInput = {
  text: string
  options: string[]
  correctIndex: number
  category?: string
}

export function sanitizeCustomQuestions(
  input: unknown,
  max: number,
): { questions: import('./types.js').Question[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Ogiltiga egna frågor' }
  if (input.length > max) return { error: `Max ${max} egna frågor` }

  const questions: import('./types.js').Question[] = []
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as CustomQuestionInput
    const text = String(raw?.text ?? '').trim()
    const options = Array.isArray(raw?.options) ? raw.options.map((o) => String(o).trim()) : []
    const correctIndex = Number(raw?.correctIndex)
    const category = String(raw?.category ?? 'Egna').trim().slice(0, 40) || 'Egna'

    if (text.length < 3 || text.length > 200) {
      return { error: `Fråga ${i + 1}: texten måste vara 3–200 tecken` }
    }
    if (options.length !== 4 || options.some((o) => !o || o.length > 80)) {
      return { error: `Fråga ${i + 1}: behövs 4 svarsalternativ` }
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      return { error: `Fråga ${i + 1}: ogiltigt rätt svar` }
    }

    questions.push({
      id: `custom-${i}-${crypto.randomUUID().slice(0, 8)}`,
      category,
      text,
      options: options as [string, string, string, string],
      correctIndex,
    })
  }

  return { questions }
}
