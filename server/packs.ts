import type { QuizLanguage } from './types.js'

export type CategoryPackId =
  | 'mixed'
  | 'world'
  | 'brain'
  | 'historySport'
  | 'party'
  | 'food'

export type CategoryPack = {
  id: CategoryPackId
  /** null = all categories */
  categoriesSv: string[] | null
  categoriesEn: string[] | null
}

export const CATEGORY_PACKS: Record<CategoryPackId, CategoryPack> = {
  mixed: { id: 'mixed', categoriesSv: null, categoriesEn: null },
  world: {
    id: 'world',
    categoriesSv: ['Geografi', 'Sverige'],
    categoriesEn: ['Geography'],
  },
  brain: {
    id: 'brain',
    categoriesSv: ['Vetenskap', 'Teknik', 'Natur'],
    categoriesEn: ['Science', 'Tech', 'Nature'],
  },
  historySport: {
    id: 'historySport',
    categoriesSv: ['Historia', 'Sport'],
    categoriesEn: ['History', 'Sports'],
  },
  party: {
    id: 'party',
    categoriesSv: ['Film & TV', 'Musik', 'Popkultur'],
    categoriesEn: ['Movies & TV', 'Music', 'Pop Culture'],
  },
  food: {
    id: 'food',
    categoriesSv: ['Mat & Dryck', 'Mat & dryck', 'Kultur', 'Litteratur'],
    categoriesEn: ['Food', 'Culture', 'Literature'],
  },
}

export const PACK_IDS = Object.keys(CATEGORY_PACKS) as CategoryPackId[]

export function normalizePackId(raw: unknown): CategoryPackId {
  const id = String(raw ?? 'mixed')
  return PACK_IDS.includes(id as CategoryPackId) ? (id as CategoryPackId) : 'mixed'
}

export function categoriesForPack(packId: CategoryPackId, language: QuizLanguage): string[] | null {
  const pack = CATEGORY_PACKS[normalizePackId(packId)]
  return language === 'en' ? pack.categoriesEn : pack.categoriesSv
}

/** Stable weekly theme from ISO week number. */
export function weekThemePack(date = new Date()): CategoryPackId {
  const themes: CategoryPackId[] = ['party', 'world', 'brain', 'historySport', 'food', 'mixed']
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return themes[week % themes.length]!
}
