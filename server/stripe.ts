import Stripe from 'stripe'
import { issuePartyPass, type PartyPass } from './premium.js'

const sessionPasses = new Map<string, PartyPass>()

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY saknas')
  return new Stripe(key)
}

function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL ?? 'https://factopia.net').replace(/\/$/, '')
}

function partyAmountOre(): number {
  const n = Number(process.env.STRIPE_PARTY_AMOUNT_ORE ?? '9900')
  return Number.isFinite(n) && n >= 100 ? Math.round(n) : 9900
}

function rememberSessionPass(sessionId: string, pass: PartyPass) {
  sessionPasses.set(sessionId, pass)
  return pass
}

export function getPassForCheckoutSession(sessionId: string): PartyPass | null {
  const pass = sessionPasses.get(sessionId)
  if (!pass) return null
  if (pass.expiresAt <= Date.now()) {
    sessionPasses.delete(sessionId)
    return null
  }
  return pass
}

export async function createPartyCheckoutSession(opts: {
  locale?: string
  roomCode?: string | null
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  if (!stripeConfigured()) {
    return { error: 'Stripe är inte konfigurerat ännu' }
  }

  try {
    const stripe = getStripe()
    const priceId = process.env.STRIPE_PARTY_PRICE_ID?.trim()
    const locale = opts.locale === 'en' ? 'en' : 'sv'
    const successUrl = `${appBaseUrl()}/?party_session={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${appBaseUrl()}/?party_cancel=1`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        product: 'party_pass',
        roomCode: opts.roomCode ?? '',
      },
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              quantity: 1,
              price_data: {
                currency: 'sek',
                unit_amount: partyAmountOre(),
                product_data: {
                  name: 'Factopia Party — 24 h',
                  description: 'Fler spelare, 50 frågor, egna frågor och rumstitel.',
                },
              },
            },
          ],
    })

    if (!session.url) return { error: 'Kunde inte skapa betalning' }
    return { url: session.url, sessionId: session.id }
  } catch (e) {
    console.error('Stripe checkout error', e)
    return { error: 'Kunde inte starta Stripe Checkout' }
  }
}

export async function claimPartyCheckoutSession(
  sessionId: string,
): Promise<PartyPass | { error: string }> {
  if (!sessionId?.startsWith('cs_')) return { error: 'Ogiltig betalningssession' }

  const cached = getPassForCheckoutSession(sessionId)
  if (cached) return cached

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

    const pass = issuePartyPass()
    return rememberSessionPass(sessionId, pass)
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
          rememberSessionPass(session.id, issuePartyPass())
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
  return {
    enabled: stripeConfigured(),
    amountOre: partyAmountOre(),
    amountLabel: `${Math.round(partyAmountOre() / 100)} kr`,
    durationHours: 24,
  }
}
