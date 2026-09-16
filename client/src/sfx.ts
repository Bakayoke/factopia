/** Tiny Web Audio + haptic helpers for party feedback. */

let ctx: AudioContext | null = null
let muted = false

const MUTE_KEY = 'factopia-mute'

export function loadMute(): boolean {
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    muted = false
  }
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function isMuted() {
  return muted
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function beep(freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.04) {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.value = gain
  osc.connect(g)
  g.connect(ac.destination)
  const t0 = ac.currentTime
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000)
  osc.start(t0)
  osc.stop(t0 + durMs / 1000 + 0.02)
}

function vibrate(pattern: number | number[]) {
  if (muted) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

export function sfxLockIn() {
  beep(520, 70, 'triangle', 0.035)
  vibrate(12)
}

export function sfxCorrect() {
  beep(660, 80, 'sine', 0.045)
  setTimeout(() => beep(880, 100, 'sine', 0.04), 70)
  vibrate([20, 30, 20])
}

export function sfxWrong() {
  beep(180, 140, 'sawtooth', 0.03)
  vibrate(40)
}

export function sfxLightning() {
  beep(920, 50, 'square', 0.03)
  setTimeout(() => beep(920, 50, 'square', 0.03), 90)
  vibrate([10, 40, 10])
}

export function sfxReveal() {
  beep(400, 60, 'triangle', 0.03)
}

export function sfxWin() {
  ;[523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 120, 'sine', 0.05), i * 110))
  vibrate([30, 40, 30, 40, 50])
}
