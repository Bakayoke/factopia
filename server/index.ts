import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import cors from 'cors'
import {
  allRooms,
  createRoom,
  disconnectSocket,
  getBinding,
  getRoom,
  hydrateRooms,
  joinRoom,
  liveActivity,
  onQuestionTimeout,
  onRevealTimeout,
  pruneIdleRooms,
  reconnectSocket,
  setQuestionCount,
  setHostPlaying,
  setAdvanceMode,
  setLanguage,
  setCategoryPack,
  setPersistHook,
  setPublicLobby,
  listPublicLobbies,
  unlockRoomWithPass,
  startGame,
  submitAnswer,
  nextQuestion,
  endGame,
  rematch,
  toPublicRoom,
  activatePartyPass,
  applyPartyToken,
  setRoomTitle,
  setCustomQuestions,
} from './rooms.js'
import { allPasses, redeemPassCode, restorePasses, setPassPersistHook } from './premium.js'
import {
  claimPartyCheckoutSession,
  createPartyCheckoutSession,
  handleStripeWebhook,
  partyCheckoutPublicInfo,
  stripeConfigured,
  stripeEnvDiagnostics,
} from './stripe.js'
import { buildSnapshot, flushPersist, initPersist, loadSnapshot, persistDiagnostics, scheduleSave } from './persist.js'
import { funnelSnapshot, publicActivity, trackFunnel, type FunnelEvent } from './metrics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://factopia.linus-stenvi.workers.dev',
  'https://factopia.net',
  'https://www.factopia.net',
]

const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const allowedOrigins = [...new Set([...defaultOrigins, ...corsOrigins])]

const app = express()
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)

// Stripe needs the raw body for signature verification
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const result = await handleStripeWebhook(
    Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {})),
    req.headers['stripe-signature'] as string | undefined,
  )
  if ('error' in result) {
    res.status(result.status).send(result.error)
    return
  }
  res.json({ received: true })
})

app.use(express.json())

app.get('/api/health', (_req, res) => {
  const diag = stripeEnvDiagnostics()
  res.json({
    ok: true,
    name: 'factopia',
    stripe: diag.configured,
    stripeDiag: diag,
    persist: persistDiagnostics(),
  })
})

app.get('/api/party/info', (_req, res) => {
  res.json(partyCheckoutPublicInfo())
})

app.get('/api/lobbies', (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : req.query.lang === 'sv' ? 'sv' : null
  const lobbies = listPublicLobbies({ language: lang, limit: 24 })
  const theme = partyCheckoutPublicInfo().weekThemePack
  const live = liveActivity()
  res.json({
    lobbies,
    onlineRooms: lobbies.length,
    weekThemePack: theme,
    activity: publicActivity(live),
  })
})

app.post('/api/party/checkout', async (req, res) => {
  const locale = req.body?.locale === 'en' ? 'en' : 'sv'
  const roomCode = typeof req.body?.roomCode === 'string' ? req.body.roomCode : null
  const plan = req.body?.plan === 'week' ? 'week' : 'day'
  const firstTime = Boolean(req.body?.firstTime)
  trackFunnel('checkout_start', roomCode || plan)
  if (firstTime) trackFunnel('group_size_upsell', 'first_time')
  const result = await createPartyCheckoutSession({ locale, roomCode, plan, firstTime })
  if ('error' in result) {
    res.status(400).json(result)
    return
  }
  res.json(result)
})

app.post('/api/party/claim', async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? '')
  const result = await claimPartyCheckoutSession(sessionId)
  if ('error' in result) {
    res.status(400).json({ error: result.error })
    return
  }
  trackFunnel('checkout_paid', result.roomCode || undefined)
  if (result.roomCode && result.token) {
    const unlocked = unlockRoomWithPass(result.roomCode, result.token)
    if (!('error' in unlocked)) {
      broadcastRoom(unlocked.code)
    }
  }
  res.json({
    token: result.token,
    expiresAt: result.expiresAt,
    roomCode: result.roomCode || null,
  })
})

app.post('/api/metrics', (req, res) => {
  const event = String(req.body?.event ?? '') as FunnelEvent
  const meta = typeof req.body?.meta === 'string' ? req.body.meta : undefined
  trackFunnel(event, meta)
  res.json({ ok: true })
})

app.get('/api/metrics', (_req, res) => {
  res.json(funnelSnapshot())
})

// Serve built client when present (Railway all-in-one). Cloudflare can host UI separately.
const clientDist = path.join(__dirname, '../client/dist')
app.use(express.static(clientDist))
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next()
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next()
  })
})

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 20_000,
  pingTimeout: 60_000,
  connectTimeout: 30_000,
})

function broadcastRoom(roomCode: string) {
  const room = getRoom(roomCode)
  if (!room) return
  const sockets = io.sockets.adapter.rooms.get(roomCode)
  if (!sockets) return
  for (const socketId of sockets) {
    const binding = getBinding(socketId)
    const socket = io.sockets.sockets.get(socketId)
    if (socket && binding) {
      socket.emit('room', toPublicRoom(room, binding.playerId))
    }
  }
}

io.on('connection', (socket) => {
  socket.on('create', ({ name, questionCount, hostPlays, advanceMode, language, partyToken }, ack) => {
    try {
      const { room, playerId } = createRoom(
        name,
        questionCount,
        socket.id,
        hostPlays !== false,
        advanceMode === 'manual' ? 'manual' : 'auto',
        language === 'en' ? 'en' : 'sv',
        typeof partyToken === 'string' ? partyToken : null,
      )
      socket.join(room.code)
      const payload = { playerId, room: toPublicRoom(room, playerId) }
      ack?.(payload)
      socket.emit('room', payload.room)
    } catch {
      ack?.({ error: 'Kunde inte skapa spel' })
    }
  })

  socket.on('redeemParty', ({ code: passCode }, ack) => {
    const redeemed = redeemPassCode(String(passCode ?? ''))
    if ('error' in redeemed) return ack?.({ error: redeemed.error })
    ack?.({ token: redeemed.token, expiresAt: redeemed.expiresAt })
  })

  socket.on('activateParty', ({ code: passCode }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = activatePartyPass(binding.code, binding.playerId, String(passCode ?? ''))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true, token: result.pass.token, expiresAt: result.pass.expiresAt })
    broadcastRoom(result.room.code)
  })

  socket.on('applyPartyToken', ({ token }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = applyPartyToken(binding.code, binding.playerId, String(token ?? ''))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setRoomTitle', ({ title }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setRoomTitle(binding.code, binding.playerId, String(title ?? ''))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setCustomQuestions', ({ questions }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setCustomQuestions(binding.code, binding.playerId, Array.isArray(questions) ? questions : [])
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('join', ({ code, name }, ack) => {
    const result = joinRoom(code, name, socket.id)
    if ('error' in result) {
      if (result.code === 'ROOM_FULL' && result.roomCode) {
        trackFunnel('room_full', result.roomCode)
        trackFunnel('waitlist_join', result.roomCode)
        broadcastRoom(result.roomCode)
      }
      ack?.({
        error: result.error,
        code: result.code,
        roomCode: result.roomCode,
        waitlistCount: result.waitlistCount,
      })
      return
    }
    socket.join(result.room.code)
    const payload = { playerId: result.playerId, room: toPublicRoom(result.room, result.playerId) }
    ack?.(payload)
    broadcastRoom(result.room.code)
  })

  socket.on('rejoin', ({ code, playerId }, ack) => {
    const result = reconnectSocket(code, playerId, socket.id)
    if ('error' in result) {
      ack?.({ error: result.error })
      return
    }
    socket.join(result.code)
    ack?.({ playerId, room: toPublicRoom(result, playerId) })
    broadcastRoom(result.code)
  })

  socket.on('setCount', ({ count }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setQuestionCount(binding.code, binding.playerId, count)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setHostPlaying', ({ playing }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setHostPlaying(binding.code, binding.playerId, Boolean(playing))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setAdvanceMode', ({ mode }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setAdvanceMode(binding.code, binding.playerId, mode === 'manual' ? 'manual' : 'auto')
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setLanguage', ({ language }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setLanguage(binding.code, binding.playerId, language === 'en' ? 'en' : 'sv')
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setCategoryPack', ({ pack }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setCategoryPack(binding.code, binding.playerId, String(pack ?? 'mixed'))
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('setPublicLobby', ({ isPublic }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = setPublicLobby(binding.code, binding.playerId, Boolean(isPublic))
    if ('error' in result) {
      if (Boolean(isPublic)) trackFunnel('public_requires_party', binding.code)
      return ack?.({ error: result.error })
    }
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('start', (_data, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = startGame(binding.code, binding.playerId)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('next', (_data, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = nextQuestion(binding.code, binding.playerId)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('end', (_data, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = endGame(binding.code, binding.playerId)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('rematch', (_data, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = rematch(binding.code, binding.playerId)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('answer', ({ answerIndex }, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = submitAnswer(binding.code, binding.playerId, answerIndex)
    if ('error' in result) return ack?.({ error: result.error })
    ack?.({ ok: true })
    broadcastRoom(result.code)
  })

  socket.on('disconnect', () => {
    disconnectSocket(socket.id, (room) => {
      broadcastRoom(room.code)
    })
  })
})

setInterval(() => {
  for (const room of allRooms().values()) {
    if (onQuestionTimeout(room) || onRevealTimeout(room)) {
      broadcastRoom(room.code)
    }
  }
}, 250)

setInterval(() => {
  pruneIdleRooms()
  scheduleSave(buildSnapshot(allPasses().values(), allRooms().values()))
}, 30_000)

async function boot() {
  const persist = await initPersist()
  const persistNow = () => scheduleSave(buildSnapshot(allPasses().values(), allRooms().values()))
  setPersistHook(persistNow)
  setPassPersistHook(persistNow)

  const snapshot = await loadSnapshot()
  if (snapshot) {
    restorePasses(snapshot.passes)
    hydrateRooms(snapshot.rooms)
    console.log(
      `Persist restore: ${snapshot.passes.length} passes, ${snapshot.rooms.length} rooms (${persist.backend})`,
    )
  } else if (persist.backend) {
    console.log(`Persist ready (${persist.backend}) — empty state`)
  } else {
    console.log(
      'Persist: memory only. Set REDIS_URL or FACTOPIA_DATA_DIR to keep Party/rooms across restarts.',
    )
  }

  process.on('SIGTERM', () => {
    void flushPersist().finally(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    void flushPersist().finally(() => process.exit(0))
  })

  httpServer.listen(PORT, () => {
    const diag = stripeEnvDiagnostics()
    const pdiag = persistDiagnostics()
    console.log(`Factopia kör på port ${PORT}`)
    console.log(`Tillåtna origins: ${allowedOrigins.join(', ')}`)
    console.log(
      `Stripe: ${diag.configured ? `ok (${diag.keyPrefix})` : 'saknas'} | envPresent=${JSON.stringify(diag.envPresent)}`,
    )
    console.log(
      `Persist: ${pdiag.configured ? pdiag.backend : 'memory only'}${pdiag.hint ? ` | ${pdiag.hint}` : ''}`,
    )
  })
}

void boot()
