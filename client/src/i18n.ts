import type { QuizLanguage } from './types'

const sv = {
  tagline: 'Partyquiz för hela gänget',
  startNew: 'Starta nytt spel',
  or: 'eller',
  joinWithCode: 'Gå med med kod',
  footer: 'Dela koden — svara — fira vinnaren',
  yourName: 'Ditt namn',
  questionCount: 'Antal frågor',
  yourRole: 'Din roll',
  playAlong: 'Spela med',
  hostOnly: 'Bara hosta',
  betweenQuestions: 'Mellan frågor',
  clickNext: 'Klicka nästa',
  auto: 'Auto',
  language: 'Språk',
  swedish: 'Svenska',
  english: 'English',
  createGame: 'Skapa spel',
  back: 'Tillbaka',
  gameCode: 'Spelkod',
  codeLabel: 'Spelkod',
  join: 'Gå med',
  participants: 'Deltagare',
  noPlayers: 'Inga spelare ännu — dela koden!',
  hostHidden: 'Du hostar och syns inte i listan',
  startQuiz: 'Starta quizet!',
  leave: 'Lämna',
  endQuiz: 'Avsluta',
  continueCode: 'Fortsätt',
  enterCode: 'Ange spelkod',
  enterName: 'Ange ditt namn',
  waitingHost: 'väntar…',
  you: 'du',
  hosting: 'Du hostar — spelarna svarar nu',
  answerSent: 'Svar skickat! Väntar på de andra…',
  correctAnswer: 'Rätt svar',
  nextQuestion: 'Nästa fråga',
  showWinner: 'Visa vinnare',
  waitingNext: 'Väntar på att värden går vidare…',
  nextIn: 'Nästa fråga om',
  resultsIn: 'Resultat om',
  answered: 'har svarat',
  youWon: 'Du vann!',
  winnerIs: 'Vinnaren är',
  points: 'poäng',
  playAgain: 'Spela igen',
  reconnecting: 'Återansluter…',
  connected: 'Ansluten',
  somethingWrong: 'Något gick fel',
  waitingStart: 'frågor · väntar på att värden startar…',
  standings: 'Ställning',
  thisRound: 'Denna omgång',
  fullscreen: 'Helskärm',
  exitFullscreen: 'Lämna helskärm',
  party: 'Party',
  partyActive: 'Party aktivt',
  partyPitch: 'Större gäng. Inga frågor att hitta på — vi har dem.',
  partyFreeNote: 'Gratis: host + 4 spelare. Party = fler i samma rum.',
  unlockParty: 'Lås upp Party',
  partyCode: 'Party-kod',
  activate: 'Aktivera',
  partyUntil: 'Gäller till',
  roomTitle: 'Rumstitel',
  roomTitlePlaceholder: 't.ex. Linneas 30-årsquiz',
  customQuestions: 'Egna frågor',
  addQuestion: 'Lägg till fråga',
  removeQuestion: 'Ta bort',
  questionText: 'Fråga',
  option: 'Alternativ',
  correct: 'Rätt',
  saveQuestions: 'Spara egna frågor',
  customSaved: 'Egna frågor sparade',
  partyLocked: 'Party',
  tipLink: 'Bjud på kaffe',
  buyPartySoon: 'Party låser upp fler spelare i samma quiz.',
  buyParty: 'Party · 39 kr · 24 h',
  buyPartyBusy: 'Öppnar betalning…',
  buyPartyHint: 'Ett tryck. Fler kan gå med.',
  partyUnlocked: 'Party upplåst — kör igång!',
  partyCancelled: 'Köp avbrutet — du kan försöka igen när du vill.',
  haveCode: 'Har du kod?',
  hideCode: 'Dölj kod',
  stripeMissing:
    'Fel nyckel i Railway: du har pk_… (Publishable). Byt till sk_… (Secret key) från Stripe → API keys.',
  freeTierOk: 'Gratis: upp till 5 spelare (host + 4). Party: fler spelare.',
  unlimited: 'obegränsat',
}

const en: typeof sv = {
  tagline: 'Party quiz for the whole crew',
  startNew: 'Start new game',
  or: 'or',
  joinWithCode: 'Join with code',
  footer: 'Share the code — answer — crown the winner',
  yourName: 'Your name',
  questionCount: 'Number of questions',
  yourRole: 'Your role',
  playAlong: 'Play along',
  hostOnly: 'Host only',
  betweenQuestions: 'Between questions',
  clickNext: 'Click next',
  auto: 'Auto',
  language: 'Language',
  swedish: 'Svenska',
  english: 'English',
  createGame: 'Create game',
  back: 'Back',
  gameCode: 'Game code',
  codeLabel: 'Game code',
  join: 'Join',
  participants: 'Players',
  noPlayers: 'No players yet — share the code!',
  hostHidden: 'You are hosting and hidden from the list',
  startQuiz: 'Start the quiz!',
  leave: 'Leave',
  endQuiz: 'End quiz',
  continueCode: 'Continue',
  enterCode: 'Enter game code',
  enterName: 'Enter your name',
  waitingHost: 'waiting…',
  you: 'you',
  hosting: 'You are hosting — players are answering',
  answerSent: 'Answer sent! Waiting for others…',
  correctAnswer: 'Correct answer',
  nextQuestion: 'Next question',
  showWinner: 'Show winner',
  waitingNext: 'Waiting for the host to continue…',
  nextIn: 'Next question in',
  resultsIn: 'Results in',
  answered: 'answered',
  youWon: 'You won!',
  winnerIs: 'The winner is',
  points: 'points',
  playAgain: 'Play again',
  reconnecting: 'Reconnecting…',
  connected: 'Connected',
  somethingWrong: 'Something went wrong',
  waitingStart: 'questions · waiting for host to start…',
  standings: 'Standings',
  thisRound: 'This round',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  party: 'Party',
  partyActive: 'Party active',
  partyPitch: 'Bigger groups. No question-writing — we bring the quiz.',
  partyFreeNote: 'Free: host + 4 players. Party = more in the same room.',
  unlockParty: 'Unlock Party',
  partyCode: 'Party code',
  activate: 'Activate',
  partyUntil: 'Valid until',
  roomTitle: 'Room title',
  roomTitlePlaceholder: 'e.g. Maya’s birthday quiz',
  customQuestions: 'Custom questions',
  addQuestion: 'Add question',
  removeQuestion: 'Remove',
  questionText: 'Question',
  option: 'Option',
  correct: 'Correct',
  saveQuestions: 'Save custom questions',
  customSaved: 'Custom questions saved',
  partyLocked: 'Party',
  tipLink: 'Buy me a coffee',
  buyPartySoon: 'Party unlocks more players in the same quiz.',
  buyParty: 'Party · 39 kr · 24 h',
  buyPartyBusy: 'Opening checkout…',
  buyPartyHint: 'One tap. More people can join.',
  partyUnlocked: 'Party unlocked — let’s go!',
  partyCancelled: 'Checkout cancelled — try again anytime.',
  haveCode: 'Have a code?',
  hideCode: 'Hide code',
  stripeMissing:
    'Wrong key in Railway: you have pk_… (Publishable). Replace with sk_… (Secret key) from Stripe → API keys.',
  freeTierOk: 'Free: up to 5 players (host + 4). Party: more players.',
  unlimited: 'unlimited',
}

export type UiStrings = typeof sv

const LANG_KEY = 'factopia-lang'

/** Browser language first; Stockholm timezone as soft SE fallback. Manual choice is remembered. */
export function detectPreferredLanguage(): QuizLanguage {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'sv' || saved === 'en') return saved
  } catch {
    // ignore
  }

  const candidates = [
    ...(typeof navigator !== 'undefined' && navigator.languages ? navigator.languages : []),
    typeof navigator !== 'undefined' ? navigator.language : '',
  ]
    .filter(Boolean)
    .map((l) => l.toLowerCase())

  if (candidates.some((l) => l === 'sv' || l.startsWith('sv-'))) return 'sv'
  if (candidates.some((l) => l === 'en' || l.startsWith('en-'))) return 'en'

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz === 'Europe/Stockholm') return 'sv'
  } catch {
    // ignore
  }

  return 'en'
}

export function rememberLanguage(lang: QuizLanguage) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // ignore
  }
}

export function t(lang: QuizLanguage): UiStrings {
  return lang === 'en' ? en : sv
}
