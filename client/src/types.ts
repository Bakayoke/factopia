export type Player = {
  id: string
  name: string
  score: number
  connected: boolean
  playing: boolean
}

export type RoomStatus = 'lobby' | 'question' | 'reveal' | 'finished'
export type AdvanceMode = 'auto' | 'manual'
export type QuizLanguage = 'sv' | 'en'
export type PremiumTier = 'free' | 'party'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  questionCounts: number[]
}

export type PublicQuestion = {
  index: number
  total: number
  category: string
  text: string
  options: [string, string, string, string]
  endsAt: number
}

export type RoundResult = {
  playerId: string
  name: string
  correct: boolean
  gained: number
  answerIndex: number | null
}

export type PublicCustomQuestion = {
  text: string
  options: [string, string, string, string]
  correctIndex: number
  category: string
}

export type PublicRoom = {
  code: string
  hostId: string
  players: Player[]
  questionCount: number
  advanceMode: AdvanceMode
  language: QuizLanguage
  status: RoomStatus
  currentIndex: number
  totalQuestions: number
  question: PublicQuestion | null
  revealCorrectIndex: number | null
  yourAnswer: number | null
  answeredCount: number
  playingCount: number
  lastRound: RoundResult[] | null
  premiumTier: PremiumTier
  premiumExpiresAt: number | null
  limits: PremiumLimits
  roomTitle: string
  customQuestions?: PublicCustomQuestion[]
}

export type PartyPassLocal = {
  token: string
  expiresAt: number
}
