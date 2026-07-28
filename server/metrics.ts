export type FunnelEvent =
  | 'room_full'
  | 'waitlist_join'
  | 'checkout_start'
  | 'checkout_cancel'
  | 'checkout_paid'
  | 'guest_unlock_click'
  | 'group_size_upsell'
  | 'public_requires_party'

type Counters = Record<FunnelEvent, number>

const counters: Counters = {
  room_full: 0,
  waitlist_join: 0,
  checkout_start: 0,
  checkout_cancel: 0,
  checkout_paid: 0,
  guest_unlock_click: 0,
  group_size_upsell: 0,
  public_requires_party: 0,
}

const recent: { event: FunnelEvent; at: number; meta?: string }[] = []

export function trackFunnel(event: FunnelEvent, meta?: string) {
  if (!(event in counters)) return
  counters[event] += 1
  recent.push({ event, at: Date.now(), meta: meta?.slice(0, 40) })
  if (recent.length > 200) recent.shift()
}

export function funnelSnapshot() {
  const starts = counters.checkout_start
  const paid = counters.checkout_paid
  return {
    counters: { ...counters },
    conversion: {
      checkoutToPaid: starts > 0 ? Math.round((paid / starts) * 1000) / 10 : null,
      fullToCheckout:
        counters.room_full > 0
          ? Math.round((counters.checkout_start / counters.room_full) * 1000) / 10
          : null,
    },
    recent: recent.slice(-30),
  }
}
