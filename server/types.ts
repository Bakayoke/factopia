export type Question = {
  id: string
  category: string
  text: string
  options: [string, string, string, string]
  correctIndex: number
}

export type Player = {
  id: string
  name: string
  score: number
  connected: boolean
  /** false = hostar bara, svarar inte på frågor */
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

export type Room = {
  code: string
  hostId: string
  players: Player[]
  questionCount: number
  status: RoomStatus
  questions: Question[]
  currentIndex: number
  answers: Record<string, number>
  answerTimes: Record<string, number>
  questionStartedAt: number
  endsAt: number
  revealCorrectIndex: number | null
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
