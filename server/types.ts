export type QuestionMode = 'normal' | 'double' | 'lightning'

export type Question = {
  id: string
  category: string
  text: string
  options: [string, string, string, string]
  correctIndex: number
  /** Optional special round type — assigned at pick-time if missing */
  mode?: QuestionMode
}

export type TeamId = 'a' | 'b'

export type Player = {
  id: string
  name: string
  score: number
  connected: boolean
  /** false = hostar bara, svarar inte på frågor */
  playing: boolean
  /** Set when room.teamMode is on; null for spectators / host-only */
  teamId: TeamId | null
}

export type RoomStatus = 'lobby' | 'question' | 'reveal' | 'finished'
export type AdvanceMode = 'auto' | 'manual'
export type QuizLanguage = 'sv' | 'en'
export type CategoryPackId =
  | 'mixed'
  | 'world'
  | 'brain'
  | 'historySport'
  | 'party'
  | 'food'

export type PublicQuestion = {
  index: number
  total: number
  category: string
  text: string
  options: [string, string, string, string]
  endsAt: number
  mode: QuestionMode
  /** Timer window for this question (ms) — drives client progress bar */
  durationMs: number
}

export type RoundResult = {
  playerId: string
  name: string
  correct: boolean
  gained: number
  answerIndex: number | null
  streak: number
}

export type RankDrama = {
  kind: 'stole_lead' | 'held_lead' | 'neck_and_neck'
  leaderName: string
  previousLeaderName: string | null
  margin: number
}

export type PremiumTier = 'free' | 'party'

export type PremiumLimits = {
  /** 0 = unlimited */
  maxPlayers: number
  questionCounts: number[]
}

export type Room = {
  code: string
  hostId: string
  players: Player[]
  questionCount: number
  advanceMode: AdvanceMode
  language: QuizLanguage
  categoryPack: CategoryPackId
  status: RoomStatus
  questions: Question[]
  customQuestions: Question[]
  roomTitle: string
  /** Listed on Find game / open lobbies */
  isPublic: boolean
  /** People who tried to join while room was full */
  waitlist: { id: string; name: string; at: number }[]
  premiumExpiresAt: number | null
  /** Recently used question ids — prefer fresh questions across rematches */
  recentQuestionIds: string[]
  currentIndex: number
  answers: Record<string, number>
  answerTimes: Record<string, number>
  questionStartedAt: number
  endsAt: number
  revealCorrectIndex: number | null
  lastRound: RoundResult[] | null
  /** Consecutive correct answers per player (resets on wrong/miss) */
  streaks: Record<string, number>
  /** Vote for next category pack during reveal */
  nextPackVotes: Record<string, CategoryPackId>
  optionCounts: [number, number, number, number] | null
  rankDrama: RankDrama | null
  suddenDeath: boolean
  suddenDeathDone: boolean
  /** Two-team party mode — scores still per player, totals derived */
  teamMode: boolean
  /** Last activity — used when pruning persisted rooms */
  updatedAt: number
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
  categoryPack: CategoryPackId
  status: RoomStatus
  currentIndex: number
  totalQuestions: number
  question: PublicQuestion | null
  revealCorrectIndex: number | null
  yourAnswer: number | null
  answeredCount: number
  playingCount: number
  lastRound: RoundResult[] | null
  optionCounts: [number, number, number, number] | null
  rankDrama: RankDrama | null
  suddenDeath: boolean
  nextPackVotes: Record<string, CategoryPackId>
  yourPackVote: CategoryPackId | null
  yourStreak: number
  teamMode: boolean
  teamScores: { a: number; b: number }
  premiumTier: PremiumTier
  premiumExpiresAt: number | null
  limits: PremiumLimits
  roomTitle: string
  isPublic: boolean
  waitlist: { id: string; name: string; at: number }[]
  /** Only included for the host */
  customQuestions?: PublicCustomQuestion[]
}
