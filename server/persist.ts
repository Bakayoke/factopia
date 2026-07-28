import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PartyPass } from './premium.js'
import type { Room } from './types.js'

export type PersistedSnapshot = {
  version: 1
  savedAt: number
  passes: PartyPass[]
  rooms: Room[]
}

type Backend = {
  name: string
  load(): Promise<PersistedSnapshot | null>
  save(snapshot: PersistedSnapshot): Promise<void>
}

let backend: Backend | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pending: PersistedSnapshot | null = null
let ready = false

function emptySnapshot(): PersistedSnapshot {
  return { version: 1, savedAt: Date.now(), passes: [], rooms: [] }
}

function fileBackend(dir: string): Backend {
  const file = path.join(dir, 'factopia-state.json')
  return {
    name: `file:${file}`,
    async load() {
      try {
        const raw = await readFile(file, 'utf8')
        return JSON.parse(raw) as PersistedSnapshot
      } catch {
        return null
      }
    },
    async save(snapshot) {
      await mkdir(dir, { recursive: true })
      await writeFile(file, JSON.stringify(snapshot), 'utf8')
    },
  }
}

async function redisBackend(url: string): Promise<Backend> {
  const { createClient } = await import('redis')
  const client = createClient({ url })
  client.on('error', (err) => console.error('Redis error', err))
  await client.connect()
  const key = 'factopia:state'
  return {
    name: 'redis',
    async load() {
      const raw = await client.get(key)
      if (!raw) return null
      return JSON.parse(raw) as PersistedSnapshot
    },
    async save(snapshot) {
      await client.set(key, JSON.stringify(snapshot))
    },
  }
}

export async function initPersist(): Promise<{ backend: string | null }> {
  const redisUrl = process.env.REDIS_URL?.trim()
  const dataDir = process.env.FACTOPIA_DATA_DIR?.trim()

  try {
    if (redisUrl) {
      backend = await redisBackend(redisUrl)
    } else if (dataDir) {
      backend = fileBackend(dataDir)
    } else {
      backend = null
    }
  } catch (e) {
    console.error('Persist init failed — falling back to memory only', e)
    backend = null
  }

  ready = true
  return { backend: backend?.name ?? null }
}

export function persistConfigured(): boolean {
  return Boolean(backend)
}

export async function loadSnapshot(): Promise<PersistedSnapshot | null> {
  if (!backend) return null
  try {
    const snap = await backend.load()
    if (!snap || snap.version !== 1) return null
    return snap
  } catch (e) {
    console.error('Persist load failed', e)
    return null
  }
}

/** Debounced save so rapid room updates don't thrash storage. */
export function scheduleSave(snapshot: PersistedSnapshot) {
  if (!backend || !ready) return
  pending = snapshot
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const toWrite = pending
    pending = null
    if (!toWrite || !backend) return
    void backend.save({ ...toWrite, savedAt: Date.now() }).catch((e) => {
      console.error('Persist save failed', e)
    })
  }, 400)
}

export async function flushPersist() {
  if (!backend || !pending) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const toWrite = pending
  pending = null
  await backend.save({ ...toWrite, savedAt: Date.now() })
}

export function buildSnapshot(passes: Iterable<PartyPass>, rooms: Iterable<Room>): PersistedSnapshot {
  const now = Date.now()
  return {
    version: 1,
    savedAt: now,
    passes: [...passes].filter((p) => p.expiresAt > now),
    // Drop finished rooms older than 6h of idle (no endsAt update) — keep active lobbies/games
    rooms: [...rooms]
      .map((room) => ({
        ...room,
        players: room.players.map((p) => ({ ...p, connected: false })),
        answers: {},
        answerTimes: {},
      }))
      .filter((room) => {
        if (room.premiumExpiresAt && room.premiumExpiresAt > now) return true
        // Keep rooms that still look "live" (lobby / in progress / recently finished)
        if (room.status === 'lobby' || room.status === 'question' || room.status === 'reveal') return true
        return room.status === 'finished'
      }),
  }
}

export { emptySnapshot }
