import Stripe from 'stripe'
import { issuePartyPass, type PartyPass, type PartyPlan } from './premium.js'
import { weekThemePack } from './packs.js'

type ClaimedCheckout = { pass: PartyPass; roomCode: string }
const sessionPasses = new Map<string, ClaimedCheckout>()

const STRIPE_KEY_ENVS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_SECRET',
  'STRIPE_API_KEY',
  'SECRET_KEY',
] as const

function cleanSecret(raw: string | undefined): string {
  if (!raw) return ''
  return raw.trim().replace(/^['"]|['"]$/g, '')
}

export function resolveStripeSecretKey(): string {
  for (const name of STRIPE_KEY_ENVS) {
    const value = cleanSecret(process.env[name])
    // Standard secret keys (sk_) and restricted keys (rk_)
    if (value.startsWith('sk_') || value.startsWith('rk_')) return value
  }
  return ''
}

export function stripeConfigured(): boolean {
  return Boolean(resolveStripeSecretKey())
}

export function stripeEnvDiagnostics() {
  const found: Record<string, boolean> = {}
  const prefixes: Record<string, string | null> = {}
  for (const name of STRIPE_KEY_ENVS) {
    const value = cleanSecret(process.env[name])
    found[name] = Boolean(value)
    prefixes[name] = value ? `${value.slice(0, 8)}…` : null
  }
  const key = resolveStripeSecretKey()
  return {
    configured: Boolean(key),
    keyPrefix: key ? `${key.slice(0, 8)}…` : null,
    envPresent: found,
    envPrefixes: prefixes,
    publicAppUrl: Boolean(cleanSecret(process.env.PUBLIC_APP_URL)),
    hint: key
      ? null
      : found.STRIPE_SECRET_KEY
        ? `STRIPE_SECRET_KEY börjar med "${prefixes.STRIPE_SECRET_KEY ?? '?'}" — måste vara sk_live_… eller sk_test_… (Hemlig nyckel). Inte pk_…, mk_… eller whsec_….`
        : 'STRIPE_SECRET_KEY saknas på tjänsten.',
  }
}

function getStripe(): Stripe {
  const key = resolveStripeSecretKey()
  if (!key) throw new Error('STRIPE_SECRET_KEY saknas')
  return new Stripe(key)
}

function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL ?? 'https://factopia.net').replace(/\/$/, '')
}

function partyAmountOre(): number {
  const n = Number(process.env.STRIPE_PARTY_AMOUNT_ORE ?? '3900')
  return Number.isFinite(n) && n >= 100 ? Math.round(n) : 3900
}

function partyWeekAmountOre(): number {
  const n = Number(process.env.STRIPE_PARTY_WEEK_AMOUNT_ORE ?? '9900')
  return Number.isFinite(n) && n >= 100 ? Math.round(n) : 9900
}

function normalizePlan(raw: unknown): PartyPlan {
  return raw === 'week' ? 'week' : 'day'
}

function rememberSessionPass(sessionId: string, pass: PartyPass, roomCode = '') {
  const entry: ClaimedCheckout = { pass, roomCode: roomCode.trim().toUpperCase() }
  sessionPasses.set(sessionId, entry)
  return entry
}

export function getPassForCheckoutSession(sessionId: string): ClaimedCheckout | null {
  const entry = sessionPasses.get(sessionId)
  if (!entry) return null
  if (entry.pass.expiresAt <= Date.now()) {
    sessionPasses.delete(sessionId)
    return null
  }
  return entry
}

export async function createPartyCheckoutSession(opts: {
  locale?: string
  roomCode?: string | null
  plan?: PartyPlan | string | null
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  if (!stripeConfigured()) {
    return { error: 'Stripe är inte konfigurerat ännu' }
  }

  try {
    const stripe = getStripe()
    const plan = normalizePlan(opts.plan)
    const priceId =
      plan === 'week'
        ? process.env.STRIPE_PARTY_WEEK_PRICE_ID?.trim()
        : process.env.STRIPE_PARTY_PRICE_ID?.trim()
    const locale = opts.locale === 'en' ? 'en' : 'sv'
    const room = (opts.roomCode ?? '').trim().toUpperCase()
    const roomQuery = room ? `&room=${encodeURIComponent(room)}` : ''
    const successUrl = `${appBaseUrl()}/?party_session={CHECKOUT_SESSION_ID}${roomQuery}`
    const cancelUrl = `${appBaseUrl()}/?party_cancel=1${roomQuery}`
    const amount = plan === 'week' ? partyWeekAmountOre() : partyAmountOre()

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      locale,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        product: 'party_pass',
        roomCode: room,
        plan,
      },
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              quantity: 1,
              price_data: {
                currency: 'sek',
                unit_amount: amount,
                tax_behavior: 'inclusive',
                product_data: {
                  name: plan === 'week' ? 'Factopia Party — 7 dagar' : 'Factopia Party — 24 h',
                  description:
                    plan === 'week'
                      ? 'Obegränsat antal spelare i en vecka — perfekt för återkommande quiz.'
                      : 'Fler spelare i samma quiz — inga egna frågor behövs.',
                  tax_code: 'txcd_10000000',
                },
              },
            },
          ],
    }

    // Prefer classic Checkout (you are merchant of record) unless explicitly enabled.
    const useManaged = process.env.STRIPE_MANAGED_PAYMENTS === 'true'
    Object.assign(sessionParams, {
      managed_payments: { enabled: useManaged },
    })

    const session = await stripe.checkout.sessions.create(sessionParams)

    if (!session.url) return { error: 'Kunde inte skapa betalning' }
    return { url: session.url, sessionId: session.id }
  } catch (e) {
    console.error('Stripe checkout error', e)
    const message =
      e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : 'Kunde inte starta Stripe Checkout'
    const code =
      e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string'
        ? (e as { code: string }).code
        : undefined
    const type =
      e && typeof e === 'object' && 'type' in e && typeof (e as { type: unknown }).type === 'string'
        ? (e as { type: string }).type
        : undefined
    return {
      error: message,
      stripeCode: code,
      stripeType: type,
    }
  }
}

export async function claimPartyCheckoutSession(
  sessionId: string,
): Promise<(PartyPass & { roomCode?: string }) | { error: string }> {
  if (!sessionId?.startsWith('cs_')) return { error: 'Ogiltig betalningssession' }

  const cached = getPassForCheckoutSession(sessionId)
  if (cached) return { ...cached.pass, roomCode: cached.roomCode || undefined }

  if (!stripeConfigured()) return { error: 'Stripe är inte konfigurerat' }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.product !== 'party_pass') {
      return { error: 'Sessionen gäller inte Party' }
    }
    if (session.payment_status !== 'paid') {
      return { error: 'Betalningen är inte klar ännu' }
    }

    const roomCode = String(session.metadata?.roomCode ?? '').trim().toUpperCase()
    const plan = normalizePlan(session.metadata?.plan)
    const pass = issuePartyPass(plan)
    const remembered = rememberSessionPass(sessionId, pass, roomCode)
    return { ...remembered.pass, roomCode: remembered.roomCode || undefined }
  } catch (e) {
    console.error('Stripe claim error', e)
    return { error: 'Kunde inte hämta Party efter betalning' }
  }
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<{ ok: true } | { error: string; status: number }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) return { error: 'STRIPE_WEBHOOK_SECRET saknas', status: 500 }
  if (!signature) return { error: 'Saknar Stripe-signatur', status: 400 }

  try {
    const stripe = getStripe()
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.product === 'party_pass' && session.payment_status === 'paid') {
        if (!getPassForCheckoutSession(session.id)) {
          const roomCode = String(session.metadata?.roomCode ?? '')
          const plan = normalizePlan(session.metadata?.plan)
          rememberSessionPass(session.id, issuePartyPass(plan), roomCode)
        }
      }
    }

    return { ok: true }
  } catch (e) {
    console.error('Stripe webhook error', e)
    return { error: 'Webhook-verifiering misslyckades', status: 400 }
  }
}

export function partyCheckoutPublicInfo() {
  const dayOre = partyAmountOre()
  const weekOre = partyWeekAmountOre()
  const theme = weekThemePack()
  return {
    enabled: stripeConfigured(),
    amountOre: dayOre,
    amountLabel: `${Math.round(dayOre / 100)} kr`,
    durationHours: 24,
    weekAmountOre: weekOre,
    weekAmountLabel: `${Math.round(weekOre / 100)} kr`,
    weekDurationHours: 168,
    weekThemePack: theme,
  }
}
