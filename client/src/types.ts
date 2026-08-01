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
export type CategoryPackId =
  | 'mixed'
  | 'world'
  | 'brain'
  | 'historySport'
  | 'party'
  | 'food'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  questionCounts: number[]
}

export type QuestionMode = 'normal' | 'double' | 'lightning'

export type PublicQuestion = {
  index: number
  total: number
  category: string
  text: string
  options: [string, string, string, string]
  endsAt: number
  mode: QuestionMode
  durationMs: number
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
  categoryPack?: CategoryPackId
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
  isPublic?: boolean
  waitlist?: { id: string; name: string; at: number }[]
  customQuestions?: PublicCustomQuestion[]
}

export type PublicLobbyCard = {
  code: string
  language: QuizLanguage
  categoryPack: CategoryPackId
  playerCount: number
  maxPlayers: number
  seatsLeft: number | null
  questionCount: number
  party: boolean
}

export type PartyPlan = 'day' | 'week'

export type PartyPassLocal = {
  token: string
  expiresAt: number
}
