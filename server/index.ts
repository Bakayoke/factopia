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
  joinRoom,
  onQuestionTimeout,
  onRevealTimeout,
  reconnectSocket,
  setQuestionCount,
  startGame,
  submitAnswer,
  toPublicRoom,
} from './rooms.js'

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
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'factopia' })
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
  socket.on('create', ({ name, questionCount }, ack) => {
    try {
      const { room, playerId } = createRoom(name, questionCount, socket.id)
      socket.join(room.code)
      const payload = { playerId, room: toPublicRoom(room, playerId) }
      ack?.(payload)
      socket.emit('room', payload.room)
    } catch {
      ack?.({ error: 'Kunde inte skapa spel' })
    }
  })

  socket.on('join', ({ code, name }, ack) => {
    const result = joinRoom(code, name, socket.id)
    if ('error' in result) {
      ack?.({ error: result.error })
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

  socket.on('start', (_data, ack) => {
    const binding = getBinding(socket.id)
    if (!binding) return ack?.({ error: 'Inte ansluten' })
    const result = startGame(binding.code, binding.playerId)
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
    const room = disconnectSocket(socket.id)
    if (room) broadcastRoom(room.code)
  })
})

setInterval(() => {
  for (const room of allRooms().values()) {
    if (onQuestionTimeout(room) || onRevealTimeout(room)) {
      broadcastRoom(room.code)
    }
  }
}, 250)

httpServer.listen(PORT, () => {
  console.log(`Factopia kör på port ${PORT}`)
  console.log(`Tillåtna origins: ${allowedOrigins.join(', ')}`)
})
