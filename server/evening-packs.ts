import type { PublicCustomQuestion, QuizLanguage } from './types.js'

/** Built-in “evening pack” presets — load into custom questions in lobby. */
export type EveningPackId = 'birthday' | 'office' | 'family' | 'partyNight'

export type EveningPack = {
  id: EveningPackId
  questions: PublicCustomQuestion[]
}

const SV: Record<EveningPackId, PublicCustomQuestion[]> = {
  birthday: [
    {
      category: 'Födelsedag',
      text: 'Vad önskar födelsedagsbarnet helst enligt dig?',
      options: ['Resa', 'Middag', 'Surprisefest', 'Presentkort'],
      correctIndex: 0,
    },
    {
      category: 'Födelsedag',
      text: 'Vilken ålder firar vi egentligen idag (ungefär)?',
      options: ['20-something', '30-something', '40-something', 'Hemligt'],
      correctIndex: 1,
    },
    {
      category: 'Födelsedag',
      text: 'Vilken tårtsmak vinner hos den här personen?',
      options: ['Choklad', 'Citron', 'Hallon', 'Ostkaka'],
      correctIndex: 0,
    },
    {
      category: 'Födelsedag',
      text: 'Bäst presentstil?',
      options: ['Praktiskt', 'Upplevelse', 'Skruvad humor', 'Lyxigt'],
      correctIndex: 1,
    },
    {
      category: 'Födelsedag',
      text: 'Vilken låt borde spelas när hen kommer in?',
      options: ['ABBA', 'Queen', 'Avicii', 'Silence — drama'],
      correctIndex: 2,
    },
  ],
  office: [
    {
      category: 'Kontor',
      text: 'Vem svarar snabbast i chatten?',
      options: ['Chefen', 'Praktikanten', 'Den i hörnet', 'Ingen — alla ghostar'],
      correctIndex: 3,
    },
    {
      category: 'Kontor',
      text: 'Vad betyder “snabb fråga” egentligen?',
      options: ['1 minut', '30 minuter', 'Ett möte', 'Hel projekt'],
      correctIndex: 2,
    },
    {
      category: 'Kontor',
      text: 'Favoritfika på kontoret?',
      options: ['Kanelbulle', 'Frukt', 'Chips', 'Kaffe rakt av'],
      correctIndex: 0,
    },
    {
      category: 'Kontor',
      text: 'Vem bokar flest “synk”-möten?',
      options: ['PM', 'Sälj', 'IT', 'HR'],
      correctIndex: 0,
    },
    {
      category: 'Kontor',
      text: 'Mest sannolika status i Slack klockan 16:55?',
      options: ['I ett möte', 'Fika', 'AFK', 'Brådskande ping'],
      correctIndex: 0,
    },
  ],
  family: [
    {
      category: 'Familj',
      text: 'Vem kommer alltid sent till middagen?',
      options: ['Äldst', 'Yngst', 'Kusinen', 'Hunden (metaforiskt)'],
      correctIndex: 1,
    },
    {
      category: 'Familj',
      text: 'Vem tar flest bilder?',
      options: ['Mamma', 'Pappa', 'Syskonet', 'Morfar'],
      correctIndex: 0,
    },
    {
      category: 'Familj',
      text: 'Vilken tradition är heligast?',
      options: ['Julmat', 'Sommarstugan', 'Spelkväll', 'Söndagsfika'],
      correctIndex: 3,
    },
    {
      category: 'Familj',
      text: 'Vem vinner alltid på Yatzy?',
      options: ['Farmor', 'Farbror', 'Du', 'Fuskaren'],
      correctIndex: 0,
    },
    {
      category: 'Familj',
      text: 'Bästa familjefilmen enligt majoriteten?',
      options: ['Sagan om ringen', 'Toy Story', 'Sagan om Karlsson', 'Home Alone'],
      correctIndex: 3,
    },
  ],
  partyNight: [
    {
      category: 'Party',
      text: 'Vem dansar först?',
      options: ['Värden', 'Den tysta', 'Den högljudda', 'Ingen — alla tvekar'],
      correctIndex: 2,
    },
    {
      category: 'Party',
      text: 'Vad tar slut först?',
      options: ['Snacks', 'Dryck', 'Batteri i telefonen', 'Tålamodet'],
      correctIndex: 0,
    },
    {
      category: 'Party',
      text: 'Bästa spelläge ikväll?',
      options: ['Quiz', 'Rita', 'Skriva', 'Allt huller om buller'],
      correctIndex: 3,
    },
    {
      category: 'Party',
      text: 'Vem snoozar snabbast imorgon?',
      options: ['Du', 'Din kompis', 'Alla', 'Ingen — gym 07:00'],
      correctIndex: 2,
    },
    {
      category: 'Party',
      text: 'Vad ska nästa runda handla om?',
      options: ['Mer quiz', 'Syster-spel', 'Karaoke', 'Sova'],
      correctIndex: 1,
    },
  ],
}

const EN: Record<EveningPackId, PublicCustomQuestion[]> = {
  birthday: [
    {
      category: 'Birthday',
      text: 'What would the birthday person want most?',
      options: ['A trip', 'A dinner', 'A surprise party', 'A gift card'],
      correctIndex: 0,
    },
    {
      category: 'Birthday',
      text: 'Roughly which age are we celebrating?',
      options: ['20-something', '30-something', '40-something', 'Secret'],
      correctIndex: 1,
    },
    {
      category: 'Birthday',
      text: 'Winning cake flavor for this person?',
      options: ['Chocolate', 'Lemon', 'Raspberry', 'Cheesecake'],
      correctIndex: 0,
    },
    {
      category: 'Birthday',
      text: 'Best gift style?',
      options: ['Practical', 'An experience', 'Weird humor', 'Fancy'],
      correctIndex: 1,
    },
    {
      category: 'Birthday',
      text: 'Walk-on song?',
      options: ['ABBA', 'Queen', 'Avicii', 'Dramatic silence'],
      correctIndex: 2,
    },
  ],
  office: [
    {
      category: 'Office',
      text: 'Who replies fastest in chat?',
      options: ['The boss', 'The intern', 'The quiet one', 'Nobody — ghosts'],
      correctIndex: 3,
    },
    {
      category: 'Office',
      text: 'What does “quick question” mean?',
      options: ['1 minute', '30 minutes', 'A meeting', 'A whole project'],
      correctIndex: 2,
    },
    {
      category: 'Office',
      text: 'Office snack of choice?',
      options: ['Cinnamon bun', 'Fruit', 'Chips', 'Just coffee'],
      correctIndex: 0,
    },
    {
      category: 'Office',
      text: 'Who books the most “sync” meetings?',
      options: ['PM', 'Sales', 'IT', 'HR'],
      correctIndex: 0,
    },
    {
      category: 'Office',
      text: 'Most likely Slack status at 4:55?',
      options: ['In a meeting', 'Coffee', 'AFK', 'Urgent ping'],
      correctIndex: 0,
    },
  ],
  family: [
    {
      category: 'Family',
      text: 'Who is always late for dinner?',
      options: ['Oldest', 'Youngest', 'The cousin', 'The dog (metaphorically)'],
      correctIndex: 1,
    },
    {
      category: 'Family',
      text: 'Who takes the most photos?',
      options: ['Mom', 'Dad', 'Sibling', 'Grandpa'],
      correctIndex: 0,
    },
    {
      category: 'Family',
      text: 'Holiest tradition?',
      options: ['Holiday food', 'The cabin', 'Game night', 'Sunday fika'],
      correctIndex: 3,
    },
    {
      category: 'Family',
      text: 'Who always wins at board games?',
      options: ['Grandma', 'Uncle', 'You', 'The cheater'],
      correctIndex: 0,
    },
    {
      category: 'Family',
      text: 'Best family movie according to the majority?',
      options: ['Lord of the Rings', 'Toy Story', 'Home Alone', 'The Princess Bride'],
      correctIndex: 2,
    },
  ],
  partyNight: [
    {
      category: 'Party',
      text: 'Who dances first?',
      options: ['The host', 'The quiet one', 'The loud one', 'Nobody — awkward'],
      correctIndex: 2,
    },
    {
      category: 'Party',
      text: 'What runs out first?',
      options: ['Snacks', 'Drinks', 'Phone battery', 'Patience'],
      correctIndex: 0,
    },
    {
      category: 'Party',
      text: 'Best mode tonight?',
      options: ['Quiz', 'Drawing', 'Writing', 'Everything chaotic'],
      correctIndex: 3,
    },
    {
      category: 'Party',
      text: 'Who snoozes hardest tomorrow?',
      options: ['You', 'Your friend', 'Everyone', 'Nobody — gym at 7'],
      correctIndex: 2,
    },
    {
      category: 'Party',
      text: 'What should the next round be?',
      options: ['More quiz', 'A sister game', 'Karaoke', 'Sleep'],
      correctIndex: 1,
    },
  ],
}

export function eveningPack(
  id: EveningPackId,
  language: QuizLanguage = 'sv',
): PublicCustomQuestion[] {
  const bank = language === 'en' ? EN : SV
  return (bank[id] ?? bank.partyNight).map((q) => ({
    ...q,
    options: [...q.options] as [string, string, string, string],
  }))
}

export const EVENING_PACK_IDS: EveningPackId[] = [
  'birthday',
  'office',
  'family',
  'partyNight',
]
