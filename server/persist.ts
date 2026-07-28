import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
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
let lastSaveAt = 0
let lastError: string | null = null

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
  const client = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 200, 3000),
    },
  })
  client.on('error', (err) => {
    lastError = err instanceof Error ? err.message : 'redis error'
    console.error('Redis error', err)
  })
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
      // 48h TTL safety — refreshed on every save
      await client.set(key, JSON.stringify(snapshot), { EX: 60 * 60 * 48 })
    },
  }
}

async function dirExists(dir: string) {
  try {
    await access(dir)
    return true
  } catch {
    return false
  }
}

export async function initPersist(): Promise<{ backend: string | null }> {
  const redisUrl =
    process.env.REDIS_URL?.trim() ||
    process.env.REDIS_PRIVATE_URL?.trim() ||
    process.env.REDIS_PUBLIC_URL?.trim()
  const dataDir =
    process.env.FACTOPIA_DATA_DIR?.trim() ||
    ((await dirExists('/data')) ? '/data' : '')

  try {
    if (redisUrl) {
      backend = await redisBackend(redisUrl)
      lastError = null
    } else if (dataDir) {
      backend = fileBackend(dataDir)
      lastError = null
    } else {
      backend = null
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'persist init failed'
    console.error('Persist init failed — falling back to memory only', e)
    backend = null
  }

  ready = true
  return { backend: backend?.name ?? null }
}

export function persistConfigured(): boolean {
  return Boolean(backend)
}

export function persistDiagnostics() {
  return {
    configured: Boolean(backend),
    backend: backend?.name ?? null,
    lastSaveAt: lastSaveAt || null,
    lastError,
    hint: backend
      ? null
      : 'Sätt REDIS_URL (Railway Redis-plugin) eller FACTOPIA_DATA_DIR=/data med volume — annars försvinner Party/rum vid restart.',
  }
}

export async function loadSnapshot(): Promise<PersistedSnapshot | null> {
  if (!backend) return null
  try {
    const snap = await backend.load()
    if (!snap || snap.version !== 1) return null
    return snap
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'load failed'
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
    void backend
      .save({ ...toWrite, savedAt: Date.now() })
      .then(() => {
        lastSaveAt = Date.now()
        lastError = null
      })
      .catch((e) => {
        lastError = e instanceof Error ? e.message : 'save failed'
        console.error('Persist save failed', e)
      })
  }, 400)
}

export async function flushPersist() {
  if (!backend) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const toWrite = pending
  pending = null
  if (!toWrite) return
  await backend.save({ ...toWrite, savedAt: Date.now() })
  lastSaveAt = Date.now()
}

export function buildSnapshot(passes: Iterable<PartyPass>, rooms: Iterable<Room>): PersistedSnapshot {
  const now = Date.now()
  const keepMs = 12 * 60 * 60 * 1000
  return {
    version: 1,
    savedAt: now,
    passes: [...passes].filter((p) => p.expiresAt > now),
    rooms: [...rooms]
      .map((room) => ({
        ...room,
        players: room.players.map((p) => ({ ...p, connected: false })),
        answers: {},
        answerTimes: {},
      }))
      .filter((room) => {
        const partyLive = Boolean(room.premiumExpiresAt && room.premiumExpiresAt > now)
        const fresh = now - (room.updatedAt || 0) < keepMs
        return partyLive || fresh
      }),
  }
}

export { emptySnapshot }
