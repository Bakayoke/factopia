export type FunnelEvent =
  | 'room_full'
  | 'waitlist_join'
  | 'checkout_start'
  | 'checkout_cancel'
  | 'checkout_paid'
  | 'guest_unlock_click'
  | 'group_size_upsell'
  | 'public_requires_party'
  | 'game_start'
  | 'game_finished'
  | 'share_results'

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
  game_start: 0,
  game_finished: 0,
  share_results: 0,
}

const recent: { event: FunnelEvent; at: number; meta?: string }[] = []

/** Games started today in Europe/Stockholm (resets at midnight SE). */
let stockholmDayKey = ''
let gamesTonight = 0

function currentStockholmDayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function rollStockholmDay() {
  const key = currentStockholmDayKey()
  if (key !== stockholmDayKey) {
    stockholmDayKey = key
    gamesTonight = 0
  }
}

export function trackFunnel(event: FunnelEvent, meta?: string) {
  if (!(event in counters)) return
  counters[event] += 1
  if (event === 'game_start') {
    rollStockholmDay()
    gamesTonight += 1
  }
  recent.push({ event, at: Date.now(), meta: meta?.slice(0, 40) })
  if (recent.length > 200) recent.shift()
}

export function publicActivity(live?: {
  liveRooms: number
  livePlayers: number
  openLobbies: number
}) {
  rollStockholmDay()
  return {
    gamesTonight,
    liveRooms: live?.liveRooms ?? 0,
    livePlayers: live?.livePlayers ?? 0,
    openLobbies: live?.openLobbies ?? 0,
  }
}

export function funnelSnapshot() {
  const starts = counters.checkout_start
  const paid = counters.checkout_paid
  rollStockholmDay()
  return {
    counters: { ...counters },
    gamesTonight,
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
