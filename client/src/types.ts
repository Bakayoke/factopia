export type Player = {
  id: string
  name: string
  score: number
  connected: boolean
  playing: boolean
  teamId?: 'a' | 'b' | null
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
export type TeamId = 'a' | 'b'

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
  streak?: number
}

export type RankDrama = {
  kind: 'stole_lead' | 'held_lead' | 'neck_and_neck'
  leaderName: string
  previousLeaderName: string | null
  margin: number
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
  optionCounts?: [number, number, number, number] | null
  rankDrama?: RankDrama | null
  suddenDeath?: boolean
  nextPackVotes?: Partial<Record<string, CategoryPackId>>
  yourPackVote?: CategoryPackId | null
  yourStreak?: number
  teamMode?: boolean
  teamScores?: { a: number; b: number }
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
