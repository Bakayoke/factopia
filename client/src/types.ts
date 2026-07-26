export type Player = {
  id: string
  name: string
  score: number
  connected: boolean
  playing: boolean
}

export type RoomStatus = 'lobby' | 'question' | 'reveal' | 'finished'

export type PublicQuestion = {
  index: number
  total: number
  category: string
  text: string
  options: [string, string, string, string]
  endsAt: number
}

export type PublicRoom = {
  code: string
  hostId: string
  players: Player[]
  questionCount: number
  status: RoomStatus
  currentIndex: number
  totalQuestions: number
  question: PublicQuestion | null
  revealCorrectIndex: number | null
  yourAnswer: number | null
  answeredCount: number
  playingCount: number
}
