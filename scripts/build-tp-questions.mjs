#!/usr/bin/env node
/**
 * Build TP-style trivia banks + purge math-ish bulk questions.
 */
import fs from 'fs'
import path from 'path'

const root = path.resolve(import.meta.dirname, '..')
const server = path.join(root, 'server')

function q(id, category, text, options, correctIndex) {
  return { id, category, text, options, correctIndex }
}

function shuffleInPlace(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function withWrong(correct, wrongs) {
  const opts = [correct, ...wrongs.slice(0, 3)]
  while (opts.length < 4) opts.push(wrongs[opts.length] || `Alt ${opts.length}`)
  // keep correctIndex 0; pickQuestions will reshuffle options
  return opts
}

// ——— Shared knowledge ———
const capitals = [
  ['Sverige', 'Stockholm', 'Geografi'],
  ['Norge', 'Oslo', 'Geografi'],
  ['Danmark', 'Köpenhamn', 'Geografi'],
  ['Finland', 'Helsingfors', 'Geografi'],
  ['Island', 'Reykjavik', 'Geografi'],
  ['Frankrike', 'Paris', 'Geografi'],
  ['Tyskland', 'Berlin', 'Geografi'],
  ['Italien', 'Rom', 'Geografi'],
  ['Spanien', 'Madrid', 'Geografi'],
  ['Portugal', 'Lissabon', 'Geografi'],
  ['Grekland', 'Aten', 'Geografi'],
  ['Polen', 'Warszawa', 'Geografi'],
  ['Tjeckien', 'Prag', 'Geografi'],
  ['Österrike', 'Wien', 'Geografi'],
  ['Schweiz', 'Bern', 'Geografi'],
  ['Belgien', 'Bryssel', 'Geografi'],
  ['Nederländerna', 'Amsterdam', 'Geografi'],
  ['Irland', 'Dublin', 'Geografi'],
  ['Storbritannien', 'London', 'Geografi'],
  ['Ungern', 'Budapest', 'Geografi'],
  ['Rumänien', 'Bukarest', 'Geografi'],
  ['Bulgarien', 'Sofia', 'Geografi'],
  ['Kroatien', 'Zagreb', 'Geografi'],
  ['Serbien', 'Belgrad', 'Geografi'],
  ['Ukraina', 'Kiev', 'Geografi'],
  ['Turkiet', 'Ankara', 'Geografi'],
  ['Ryssland', 'Moskva', 'Geografi'],
  ['Japan', 'Tokyo', 'Geografi'],
  ['Kina', 'Peking', 'Geografi'],
  ['Sydkorea', 'Seoul', 'Geografi'],
  ['Indien', 'New Delhi', 'Geografi'],
  ['Thailand', 'Bangkok', 'Geografi'],
  ['Vietnam', 'Hanoi', 'Geografi'],
  ['Indonesien', 'Jakarta', 'Geografi'],
  ['Australien', 'Canberra', 'Geografi'],
  ['Nya Zeeland', 'Wellington', 'Geografi'],
  ['Kanada', 'Ottawa', 'Geografi'],
  ['USA', 'Washington, D.C.', 'Geografi'],
  ['Mexiko', 'Mexico City', 'Geografi'],
  ['Brasilien', 'Brasília', 'Geografi'],
  ['Argentina', 'Buenos Aires', 'Geografi'],
  ['Chile', 'Santiago', 'Geografi'],
  ['Peru', 'Lima', 'Geografi'],
  ['Colombia', 'Bogotá', 'Geografi'],
  ['Egypten', 'Kairo', 'Geografi'],
  ['Sydafrika', 'Pretoria', 'Geografi'],
  ['Kenya', 'Nairobi', 'Geografi'],
  ['Marocko', 'Rabat', 'Geografi'],
  ['Nigeria', 'Abuja', 'Geografi'],
  ['Saudiarabien', 'Riyadh', 'Geografi'],
  ['Israel', 'Jerusalem', 'Geografi'],
  ['Iran', 'Teheran', 'Geografi'],
  ['Irak', 'Bagdad', 'Geografi'],
  ['Pakistan', 'Islamabad', 'Geografi'],
  ['Bangladesh', 'Dhaka', 'Geografi'],
  ['Filippinerna', 'Manila', 'Geografi'],
  ['Malaysia', 'Kuala Lumpur', 'Geografi'],
  ['Singapore', 'Singapore', 'Geografi'],
  ['Kuba', 'Havanna', 'Geografi'],
  ['Jamaica', 'Kingston', 'Geografi'],
]

const capitalsEn = capitals.map(([c, cap]) => [
  c
    .replace('Tyskland', 'Germany')
    .replace('Frankrike', 'France')
    .replace('Italien', 'Italy')
    .replace('Spanien', 'Spain')
    .replace('Portugal', 'Portugal')
    .replace('Grekland', 'Greece')
    .replace('Polen', 'Poland')
    .replace('Tjeckien', 'Czech Republic')
    .replace('Österrike', 'Austria')
    .replace('Schweiz', 'Switzerland')
    .replace('Belgien', 'Belgium')
    .replace('Nederländerna', 'Netherlands')
    .replace('Irland', 'Ireland')
    .replace('Storbritannien', 'United Kingdom')
    .replace('Ungern', 'Hungary')
    .replace('Rumänien', 'Romania')
    .replace('Bulgarien', 'Bulgaria')
    .replace('Kroatien', 'Croatia')
    .replace('Serbien', 'Serbia')
    .replace('Ukraina', 'Ukraine')
    .replace('Turkiet', 'Turkey')
    .replace('Ryssland', 'Russia')
    .replace('Japan', 'Japan')
    .replace('Kina', 'China')
    .replace('Sydkorea', 'South Korea')
    .replace('Indien', 'India')
    .replace('Thailand', 'Thailand')
    .replace('Vietnam', 'Vietnam')
    .replace('Indonesien', 'Indonesia')
    .replace('Australien', 'Australia')
    .replace('Nya Zeeland', 'New Zealand')
    .replace('Kanada', 'Canada')
    .replace('Mexiko', 'Mexico')
    .replace('Brasilien', 'Brazil')
    .replace('Argentina', 'Argentina')
    .replace('Chile', 'Chile')
    .replace('Peru', 'Peru')
    .replace('Colombia', 'Colombia')
    .replace('Egypten', 'Egypt')
    .replace('Sydafrika', 'South Africa')
    .replace('Kenya', 'Kenya')
    .replace('Marocko', 'Morocco')
    .replace('Nigeria', 'Nigeria')
    .replace('Saudiarabien', 'Saudi Arabia')
    .replace('Israel', 'Israel')
    .replace('Iran', 'Iran')
    .replace('Irak', 'Iraq')
    .replace('Pakistan', 'Pakistan')
    .replace('Bangladesh', 'Bangladesh')
    .replace('Filippinerna', 'Philippines')
    .replace('Malaysia', 'Malaysia')
    .replace('Singapore', 'Singapore')
    .replace('Kuba', 'Cuba')
    .replace('Jamaica', 'Jamaica')
    .replace('Sverige', 'Sweden')
    .replace('Norge', 'Norway')
    .replace('Danmark', 'Denmark')
    .replace('Finland', 'Finland')
    .replace('Island', 'Iceland')
    .replace('USA', 'USA'),
  cap
    .replace('Köpenhamn', 'Copenhagen')
    .replace('Helsingfors', 'Helsinki')
    .replace('Lissabon', 'Lisbon')
    .replace('Aten', 'Athens')
    .replace('Warszawa', 'Warsaw')
    .replace('Prag', 'Prague')
    .replace('Wien', 'Vienna')
    .replace('Bryssel', 'Brussels')
    .replace('Budapest', 'Budapest')
    .replace('Bukarest', 'Bucharest')
    .replace('Belgrad', 'Belgrade')
    .replace('Kiev', 'Kyiv')
    .replace('Moskva', 'Moscow')
    .replace('Peking', 'Beijing')
    .replace('Brasília', 'Brasília')
    .replace('Kairo', 'Cairo')
    .replace('Teheran', 'Tehran')
    .replace('Bagdad', 'Baghdad')
    .replace('Havanna', 'Havana'),
])

const rivers = [
  ['Nilén', 'Egypten', 'Geografi'],
  ['Amazonfloden', 'Brasilien', 'Geografi'],
  ['Yangtze', 'Kina', 'Geografi'],
  ['Mississippifloden', 'USA', 'Geografi'],
  ['Donau', 'Europa', 'Geografi'],
  ['Rhen', 'Europa', 'Geografi'],
  ['Themsen', 'Storbritannien', 'Geografi'],
  ['Seine', 'Frankrike', 'Geografi'],
  ['Ganges', 'Indien', 'Geografi'],
  ['Volga', 'Ryssland', 'Geografi'],
]

const mountains = [
  ['Mount Everest', 'Nepal/Kina', 'Geografi'],
  ['K2', 'Pakistan/Kina', 'Geografi'],
  ['Kilimanjaro', 'Tanzania', 'Geografi'],
  ['Mont Blanc', 'Frankrike/Italien', 'Geografi'],
  ['Matterhorn', 'Schweiz/Italien', 'Geografi'],
  ['Denali', 'USA', 'Geografi'],
  ['Aconcagua', 'Argentina', 'Geografi'],
  ['Elbrus', 'Ryssland', 'Geografi'],
]

const inventors = [
  ['telefonen', 'Alexander Graham Bell', 'Historia'],
  ['glödlampan (praktisk)', 'Thomas Edison', 'Historia'],
  ['boktryckarkonsten i Europa', 'Johannes Gutenberg', 'Historia'],
  ['penicillin', 'Alexander Fleming', 'Vetenskap'],
  ['relativitetsteorin', 'Albert Einstein', 'Vetenskap'],
  ['världens första vaccin (koppor)', 'Edward Jenner', 'Historia'],
  ['periodiska systemet', 'Dmitrij Mendelejev', 'Vetenskap'],
  ['radioaktivitet (namnet)', 'Marie Curie', 'Vetenskap'],
  ['evolution genom naturligt urval', 'Charles Darwin', 'Vetenskap'],
  ['WWW (World Wide Web)', 'Tim Berners-Lee', 'Teknik'],
]

const years = [
  ['Berlinmuren föll', '1989', 'Historia'],
  ['människan landade på månen', '1969', 'Historia'],
  ['första världskriget började', '1914', 'Historia'],
  ['andra världskriget slutade i Europa', '1945', 'Historia'],
  ['Titanic förliste', '1912', 'Historia'],
  ['EU:s föregångare EEC bildades (Romfördraget)', '1957', 'Historia'],
  ['Sverige gick med i EU', '1995', 'Historia'],
  ['Berlinmuren byggdes', '1961', 'Historia'],
  ['USA:s självständighetsförklaring', '1776', 'Historia'],
  ['franska revolutionen började', '1789', 'Historia'],
  ['Columbus nådde Amerika', '1492', 'Historia'],
  ['första iPhone lanserades', '2007', 'Teknik'],
]

const books = [
  ['Romeo och Julia', 'William Shakespeare', 'Litteratur'],
  ['Hamlet', 'William Shakespeare', 'Litteratur'],
  ['Don Quijote', 'Miguel de Cervantes', 'Litteratur'],
  ['Krim och straff', 'Fjodor Dostojevskij', 'Litteratur'],
  ['Krig och fred', 'Lev Tolstoj', 'Litteratur'],
  ['1984', 'George Orwell', 'Litteratur'],
  ['Djurfarmen', 'George Orwell', 'Litteratur'],
  ['Harry Potter och de vises sten', 'J.K. Rowling', 'Litteratur'],
  ['Sagan om ringen', 'J.R.R. Tolkien', 'Litteratur'],
  ['Hobbiten', 'J.R.R. Tolkien', 'Litteratur'],
  ['Pippi Långstrump', 'Astrid Lindgren', 'Litteratur'],
  ['Mio, min Mio', 'Astrid Lindgren', 'Litteratur'],
  ['Bröderna Lejonhjärta', 'Astrid Lindgren', 'Litteratur'],
  ['Nils Holgerssons underbara resa', 'Selma Lagerlöf', 'Litteratur'],
  ['Kejsaren av Portugallien', 'Selma Lagerlöf', 'Litteratur'],
  ['Utvandrarna', 'Vilhelm Moberg', 'Litteratur'],
  ['Doktor Glas', 'Hjalmar Söderberg', 'Litteratur'],
  ['Den gamle och havet', 'Ernest Hemingway', 'Litteratur'],
  ['Den store Gatsby', 'F. Scott Fitzgerald', 'Litteratur'],
  ['Stolthet och fördom', 'Jane Austen', 'Litteratur'],
]

const films = [
  ['Titanic (1997)', 'James Cameron', 'Film & TV'],
  ['Avatar', 'James Cameron', 'Film & TV'],
  ['Inception', 'Christopher Nolan', 'Film & TV'],
  ['The Dark Knight', 'Christopher Nolan', 'Film & TV'],
  ['Pulp Fiction', 'Quentin Tarantino', 'Film & TV'],
  ['Jurassic Park', 'Steven Spielberg', 'Film & TV'],
  ['E.T.', 'Steven Spielberg', 'Film & TV'],
  ['Schindler’s List', 'Steven Spielberg', 'Film & TV'],
  ['The Godfather', 'Francis Ford Coppola', 'Film & TV'],
  ['Star Wars: A New Hope', 'George Lucas', 'Film & TV'],
  ['Frozen', 'Disney', 'Film & TV'],
  ['The Lion King (1994)', 'Disney', 'Film & TV'],
  ['Toy Story', 'Pixar', 'Film & TV'],
  ['Spirited Away', 'Hayao Miyazaki', 'Film & TV'],
]

const music = [
  ['Bohemian Rhapsody', 'Queen', 'Musik'],
  ['Billie Jean', 'Michael Jackson', 'Musik'],
  ['Hey Jude', 'The Beatles', 'Musik'],
  ['Smells Like Teen Spirit', 'Nirvana', 'Musik'],
  ['Imagine', 'John Lennon', 'Musik'],
  ['Dancing Queen', 'ABBA', 'Musik'],
  ['Waterloo', 'ABBA', 'Musik'],
  ['Shape of You', 'Ed Sheeran', 'Musik'],
  ['Bad Guy', 'Billie Eilish', 'Musik'],
  ['Thriller', 'Michael Jackson', 'Musik'],
]

const sports = [
  ['Wimbledon', 'tennis', 'Sport'],
  ['Tour de France', 'cykling', 'Sport'],
  ['Super Bowl', 'amerikansk fotboll', 'Sport'],
  ['Stanley Cup', 'ishockey', 'Sport'],
  ['Champions League', 'fotboll', 'Sport'],
  ['Olympiska spelen', 'flera sporter', 'Sport'],
  ['FIFA World Cup', 'fotboll', 'Sport'],
  ['NBA-finalerna', 'basket', 'Sport'],
  ['PGA Championship', 'golf', 'Sport'],
  ['Tour de Ski', 'längdskidor', 'Sport'],
]

const science = [
  ['kemiskt tecken för guld', 'Au', 'Vetenskap', ['Ag', 'Fe', 'Pb']],
  ['kemiskt tecken för järn', 'Fe', 'Vetenskap', ['Ir', 'Au', 'Na']],
  ['kemiskt tecken för natrium', 'Na', 'Vetenskap', ['N', 'S', 'Ne']],
  ['kemiskt tecken för syre', 'O', 'Vetenskap', ['Ox', 'Oy', 'Or']],
  ['kemiskt tecken för kol', 'C', 'Vetenskap', ['Co', 'Ca', 'K']],
  ['kemiskt tecken för silver', 'Ag', 'Vetenskap', ['Si', 'Sv', 'Au']],
  ['kemiskt tecken för kvicksilver', 'Hg', 'Vetenskap', ['Q', 'Kv', 'Me']],
  ['planeten närmast solen', 'Merkurius', 'Vetenskap', ['Venus', 'Mars', 'Jorden']],
  ['största planeten i solsystemet', 'Jupiter', 'Vetenskap', ['Saturnus', 'Neptunus', 'Uranus']],
  ['planeten med tydliga ringar', 'Saturnus', 'Vetenskap', ['Jupiter', 'Uranus', 'Neptunus']],
  ['röd planet', 'Mars', 'Vetenskap', ['Venus', 'Merkurius', 'Jupiter']],
  ['ljusets ungefärliga hastighet i vakuum', '300 000 km/s', 'Vetenskap', ['300 km/s', '3 000 km/s', '30 000 km/s']],
  ['vatten i kemisk formel', 'H2O', 'Vetenskap', ['CO2', 'O2', 'NaCl']],
  ['koldioxid i kemisk formel', 'CO2', 'Vetenskap', ['H2O', 'CO', 'C2O']],
  ['människans normala kroppstemperatur ungefär', '37°C', 'Vetenskap', ['27°C', '42°C', '32°C']],
  ['DNA:s form beskrivs ofta som', 'dubbelhelix', 'Vetenskap', ['enkelspiral', 'kub', 'pyramid']],
  ['jordens kärna består främst av', 'järn och nickel', 'Vetenskap', ['guld och silver', 'vatten', 'kvarts']],
  ['fotosyntes sker främst i', 'växternas blad', 'Vetenskap', ['rötter', 'blommor', 'frön']],
]

const food = [
  ['sushi', 'Japan', 'Mat & dryck'],
  ['paella', 'Spanien', 'Mat & dryck'],
  ['pizza (ursprung)', 'Italien', 'Mat & dryck'],
  ['croissant (starkt förknippas med)', 'Frankrike', 'Mat & dryck'],
  ['taco', 'Mexiko', 'Mat & dryck'],
  ['kimchi', 'Korea', 'Mat & dryck'],
  ['falafel', 'Mellanöstern', 'Mat & dryck'],
  ['fish and chips', 'Storbritannien', 'Mat & dryck'],
  ['surströmming', 'Sverige', 'Mat & dryck'],
  ['poutine', 'Kanada', 'Mat & dryck'],
]

const swedish = [
  q('tp-sv-s1', 'Historia', 'Vilket år blev Sverige medlem i EU?', withWrong('1995', ['1989', '2001', '1973']), 0),
  q('tp-sv-s2', 'Historia', 'Vad hette Sveriges kung under merparten av 1900-talets slut?', withWrong('Carl XVI Gustaf', ['Gustav V', 'Oscar II', 'Karl XIV Johan']), 0),
  q('tp-sv-s3', 'Geografi', 'Vilken är Sveriges största sjö?', withWrong('Vänern', ['Vättern', 'Mälaren', 'Hjälmaren']), 0),
  q('tp-sv-s4', 'Geografi', 'Vilken är Sveriges längsta flod?', withWrong('Klarälven–Göta älv', ['Dalälven', 'Umeälven', 'Luleälven']), 0),
  q('tp-sv-s5', 'Geografi', 'I vilket landskap ligger Kiruna?', withWrong('Lappland', ['Norrbotten', 'Västerbotten', 'Jämtland']), 0),
  q('tp-sv-s6', 'Kultur', 'Vad kallas Sveriges nationaldag?', withWrong('6 juni', ['1 maj', '24 juni', '13 december']), 0),
  q('tp-sv-s7', 'Kultur', 'Vilken dag firas Lucia i Sverige?', withWrong('13 december', ['24 december', '6 januari', '1 november']), 0),
  q('tp-sv-s8', 'Litteratur', 'Vem skrev Pippi Långstrump?', withWrong('Astrid Lindgren', ['Selma Lagerlöf', 'Maria Gripe', 'Elsa Beskow']), 0),
  q('tp-sv-s9', 'Litteratur', 'Vem skrev Nils Holgerssons underbara resa?', withWrong('Selma Lagerlöf', ['Astrid Lindgren', 'August Strindberg', 'Vilhelm Moberg']), 0),
  q('tp-sv-s10', 'Litteratur', 'Vem skrev Röda rummet?', withWrong('August Strindberg', ['Hjalmar Söderberg', 'Selma Lagerlöf', 'Gustaf Fröding']), 0),
  q('tp-sv-s11', 'Musik', 'Vilket svenskt band vann Eurovision 1974?', withWrong('ABBA', ['Ace of Base', 'Roxette', 'Europe']), 0),
  q('tp-sv-s12', 'Musik', 'Vilken svensk artist är känd för låten "Euphoria"?', withWrong('Loreen', ['Robyn', 'Zara Larsson', 'Agnes']), 0),
  q('tp-sv-s13', 'Sport', 'Vilken sport är Björn Borg mest känd för?', withWrong('Tennis', ['Golf', 'Ishockey', 'Fotboll']), 0),
  q('tp-sv-s14', 'Sport', 'Vilken sport är Ingemar Stenmark mest känd för?', withWrong('Alpin skidåkning', ['Längdskidor', 'Backhoppning', 'Ishockey']), 0),
  q('tp-sv-s15', 'Sport', 'I vilken sport blev Zlatan Ibrahimović världsstjärna?', withWrong('Fotboll', ['Basket', 'Handboll', 'Ishockey']), 0),
  q('tp-sv-s16', 'Historia', 'Vad hette Sveriges första kvinnliga statsminister?', withWrong('Magdalena Andersson', ['Anna Lindh', 'Mona Sahlin', 'Margot Wallström']), 0),
  q('tp-sv-s17', 'Geografi', 'Vilken stad är Sveriges näst största?', withWrong('Göteborg', ['Malmö', 'Uppsala', 'Linköping']), 0),
  q('tp-sv-s18', 'Kultur', 'Vad är en typisk svensk midsommarrätt bland dessa?', withWrong('Sill och färskpotatis', ['Tacos', 'Sushi', 'Pizza']), 0),
  q('tp-sv-s19', 'Vetenskap', 'Vad upptäckte Alfred Nobel som gjort honom berömd (utöver priset)?', withWrong('Dynamiten', ['Penicillinet', 'Telefonen', 'Ångmaskinen']), 0),
  q('tp-sv-s20', 'Historia', 'I vilken stad delas Nobelpriset i fred ut?', withWrong('Oslo', ['Stockholm', 'Göteborg', 'Köpenhamn']), 0),
  q('tp-sv-s21', 'Film & TV', 'Vilken svensk regissör står bakom Fanny och Alexander?', withWrong('Ingmar Bergman', ['Lasse Hallström', 'Ruben Östlund', 'Roy Andersson']), 0),
  q('tp-sv-s22', 'Film & TV', 'Vilken film av Ruben Östlund vann Guldpalmen 2017?', withWrong('The Square', ['Force Majeure', 'Triangle of Sadness', 'Turist']), 0),
  q('tp-sv-s23', 'Geografi', 'Vilket hav ligger väster om Sverige?', withWrong('Nordsjön/Skagerrak–Kattegatt', ['Östersjön', 'Barents hav', 'Svarta havet']), 0),
  q('tp-sv-s24', 'Historia', 'Vad kallas perioden när Sverige var stormakt på 1600-talet?', withWrong('Stormaktstiden', ['Vikingatiden', 'Frihetstiden', 'Vasatiden']), 0),
  q('tp-sv-s25', 'Kultur', 'Vilken färg har den svenska flaggan förutom blått?', withWrong('Gult', ['Rött', 'Vitt', 'Grönt']), 0),
]

function pick3(all, exclude, rnd) {
  const pool = all.filter((x) => x !== exclude)
  shuffleInPlace(pool, rnd)
  return pool.slice(0, 3)
}

function buildSv(rnd = Math.random) {
  const out = [...swedish]
  let n = 0
  const id = (p) => `tp-sv-${p}-${++n}`

  const allCaps = capitals.map((x) => x[1])
  for (const [country, capital] of capitals) {
    out.push(q(id('cap'), 'Geografi', `Vad är huvudstaden i ${country}?`, withWrong(capital, pick3(allCaps, capital, rnd)), 0))
    out.push(q(id('land'), 'Geografi', `Vilket land har huvudstaden ${capital}?`, withWrong(country, pick3(capitals.map((c) => c[0]), country, rnd)), 0))
  }

  for (const [river, place] of rivers) {
    out.push(q(id('riv'), 'Geografi', `I vilket land/område förknippas främst floden ${river}?`, withWrong(place, pick3(rivers.map((r) => r[1]), place, rnd)), 0))
  }

  for (const [mtn, place] of mountains) {
    out.push(q(id('mtn'), 'Geografi', `Var ligger berget ${mtn}?`, withWrong(place, pick3(mountains.map((m) => m[1]), place, rnd)), 0))
  }

  for (const [thing, who, cat] of inventors) {
    out.push(q(id('inv'), cat, `Vem förknippas mest med ${thing}?`, withWrong(who, pick3(inventors.map((i) => i[1]), who, rnd)), 0))
  }

  for (const [event, year, cat] of years) {
    const wrongYears = pick3(['1492', '1776', '1789', '1912', '1914', '1945', '1957', '1961', '1969', '1989', '1995', '2007', '2010', '2020'], year, rnd)
    out.push(q(id('yr'), cat, `Vilket år ${event}?`, withWrong(year, wrongYears), 0))
  }

  for (const [book, author, cat] of books) {
    out.push(q(id('bok'), cat, `Vem skrev "${book}"?`, withWrong(author, pick3(books.map((b) => b[1]), author, rnd)), 0))
  }

  for (const [film, director, cat] of films) {
    out.push(q(id('fil'), cat, `Vem regisserade "${film}"?`, withWrong(director, pick3(films.map((f) => f[1]), director, rnd)), 0))
  }

  for (const [song, artist, cat] of music) {
    out.push(q(id('mus'), cat, `Vem/vilka är mest kända för låten "${song}"?`, withWrong(artist, pick3(music.map((m) => m[1]), artist, rnd)), 0))
  }

  for (const [event, sport, cat] of sports) {
    out.push(q(id('spo'), cat, `Vilken sport förknippas främst med ${event}?`, withWrong(sport, pick3(sports.map((s) => s[1]), sport, rnd)), 0))
  }

  for (const [prompt, correct, cat, wrongs] of science) {
    out.push(q(id('sci'), cat, `Vad är ${prompt}?`, withWrong(correct, wrongs), 0))
  }

  for (const [dish, country, cat] of food) {
    out.push(q(id('mat'), cat, `Vilket land/område förknippas främst med ${dish}?`, withWrong(country, pick3(food.map((f) => f[1]), country, rnd)), 0))
  }

  // Extra classic TP one-shots
  const extras = [
    ['Historia', 'Vem var den första människan på månen?', 'Neil Armstrong', ['Buzz Aldrin', 'Yuri Gagarin', 'John Glenn']],
    ['Historia', 'Vem var den första människan i rymden?', 'Yuri Gagarin', ['Neil Armstrong', 'Alan Shepard', 'Valentina Tereshkova']],
    ['Historia', 'Vilket imperium byggde Colosseum i Rom?', 'Romerska riket', ['Grekiska riket', 'Osmanska riket', 'Bysantinska riket']],
    ['Historia', 'Vilken farao är mest känd för sin nästan orörda grav?', 'Tutankhamun', ['Ramses II', 'Kleopatra', 'Akhenaton']],
    ['Historia', 'Vem var Storbritanniens premiärminister under större delen av andra världskriget?', 'Winston Churchill', ['Neville Chamberlain', 'Tony Blair', 'Margaret Thatcher']],
    ['Historia', 'Vilket land leddes av Adolf Hitler?', 'Tyskland', ['Italien', 'Österrike', 'Spanien']],
    ['Historia', 'Vad hette det kinesiska kejsardynastin som byggde stora delar av Kinesiska muren?', 'Qin', ['Han', 'Tang', 'Ming']],
    ['Geografi', 'Vilken är världens största ö (om man räknar Grönland)?', 'Grönland', ['Madagaskar', 'Borneo', 'Australien']],
    ['Geografi', 'Vilken kontinent är den minsta till ytan?', 'Oceanien/Australien', ['Europa', 'Antarktis', 'Sydamerika']],
    ['Geografi', 'Vilket land har flest tidszoner?', 'Frankrike (inkl. territorier)', ['Ryssland', 'USA', 'Kina']],
    ['Geografi', 'Vad heter öknen som täcker stora delar av Nordafrika?', 'Sahara', ['Gobi', 'Kalahari', 'Atacama']],
    ['Geografi', 'Vilket hav ligger mellan Europa och Afrika?', 'Medelhavet', ['Svarta havet', 'Röda havet', 'Kaspiska havet']],
    ['Geografi', 'Vilken stad är känd som Big Apple?', 'New York', ['Los Angeles', 'Chicago', 'Boston']],
    ['Geografi', 'I vilket land ligger staden Marrakech?', 'Marocko', ['Egypten', 'Tunisien', 'Algeriet']],
    ['Vetenskap', 'Hur många ben har en vuxen människa ungefär?', '206', ['156', '256', '306']],
    ['Vetenskap', 'Vilket organ pumpar blod i kroppen?', 'Hjärtat', ['Levern', 'Lungorna', 'Njurarna']],
    ['Vetenskap', 'Vad kallas den största delen av den mänskliga hjärnan?', 'Storhjärnan (cerebrum)', ['Lillhjärnan', 'Hjärnstammen', 'Hypofysen']],
    ['Vetenskap', 'Vilken gas andas växter främst in vid fotosyntes?', 'Koldioxid', ['Syre', 'Kväve', 'Väte']],
    ['Vetenskap', 'Vad mäter en seismograf?', 'Jordbävningar', ['Vindhastighet', 'Lufttryck', 'Temperatur']],
    ['Vetenskap', 'Vilket grundämne är diamant en form av?', 'Kol', ['Kisel', 'Kvarts', 'Kalcium']],
    ['Natur', 'Vilket djur är störst på land?', 'Afrikansk elefant', ['Giraff', 'Noshörning', 'Flodhäst']],
    ['Natur', 'Vilket djur är känt för att spela död när det känner sig hotat (opossum)?', 'Opossum', ['Igelkott', 'Skunk', 'Bältdjur']],
    ['Natur', 'Vad äter en koala främst?', 'Eukalyptusblad', ['Bambu', 'Fisk', 'Insekter']],
    ['Natur', 'Vad äter en panda främst?', 'Bambu', ['Eukalyptus', 'Fisk', 'Kött']],
    ['Natur', 'Vilket däggdjur kan flyga?', 'Fladdermus', ['Flygekorre (glid)', 'Pingvin', 'Struts']],
    ['Sport', 'Hur många spelare har ett fotbollslag på planen?', '11', ['9', '10', '12']],
    ['Sport', 'Hur många hål har en vanlig golfrunda?', '18', ['9', '12', '21']],
    ['Sport', 'I vilken sport använder man en puck?', 'Ishockey', ['Lacrosse', 'Bandysport', 'Curling']],
    ['Sport', 'Var hölls de olympiska sommarspelen 2012?', 'London', ['Peking', 'Rio', 'Tokyo']],
    ['Sport', 'Var hölls de olympiska sommarspelen 2016?', 'Rio de Janeiro', ['London', 'Tokyo', 'Aten']],
    ['Sport', 'Vilket land vann fotbolls-VM 2018?', 'Frankrike', ['Kroatien', 'Brasilien', 'Tyskland']],
    ['Sport', 'Vilket land vann fotbolls-VM 2022?', 'Argentina', ['Frankrike', 'Brasilien', 'Spanien']],
    ['Musik', 'Hur många strängar har en vanlig gitarr?', '6', ['4', '5', '7']],
    ['Musik', 'Vilket instrument är Yo-Yo Ma mest känd för?', 'Cello', ['Violin', 'Piano', 'Flöjt']],
    ['Musik', 'Vad kallas den högsta kvinnliga sångstämman?', 'Sopran', ['Alt', 'Tenor', 'Bas']],
    ['Film & TV', 'Vilken skådespelare spelar Iron Man i MCU?', 'Robert Downey Jr.', ['Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo']],
    ['Film & TV', 'Vilken skådespelare spelar Jack Sparrow?', 'Johnny Depp', ['Orlando Bloom', 'Brad Pitt', 'Tom Cruise']],
    ['Film & TV', 'I vilken stad utspelar sig Friends huvudsakligen?', 'New York', ['Los Angeles', 'Chicago', 'Boston']],
    ['Film & TV', 'Vad heter den blå alien-rasen i Avatar?', 'Na’vi', ['Klingon', 'Ewok', 'Wookiee']],
    ['Litteratur', 'Vem skrev Romeo och Julia?', 'William Shakespeare', ['Charles Dickens', 'Jane Austen', 'Mark Twain']],
    ['Litteratur', 'Vilken detektiv skapades av Arthur Conan Doyle?', 'Sherlock Holmes', ['Hercule Poirot', 'Miss Marple', 'Sam Spade']],
    ['Litteratur', 'Vem skrev Krönikor från Narnia?', 'C.S. Lewis', ['J.R.R. Tolkien', 'J.K. Rowling', 'Philip Pullman']],
    ['Kultur', 'Vilken konstnär målade Mona Lisa?', 'Leonardo da Vinci', ['Michelangelo', 'Raphael', 'Rembrandt']],
    ['Kultur', 'Vilken konstnär är känd för Guernica?', 'Pablo Picasso', ['Salvador Dalí', 'Vincent van Gogh', 'Claude Monet']],
    ['Kultur', 'Vilken konstnär skar av en del av sitt öra?', 'Vincent van Gogh', ['Edvard Munch', 'Paul Gauguin', 'Henri Matisse']],
    ['Kultur', 'Vad kallas den berömda skulpturen av Michelangelo med en ung man med slangbella?', 'David', ['Moses', 'Pietà', 'Tänkaren']],
    ['Teknik', 'Vad betyder CPU?', 'Central Processing Unit', ['Computer Power Unit', 'Core Process Utility', 'Central Program Upload']],
    ['Teknik', 'Vilket företag gjorde iPhone?', 'Apple', ['Samsung', 'Google', 'Microsoft']],
    ['Teknik', 'Vad heter Googles mobiloperativsystem?', 'Android', ['iOS', 'Windows Phone', 'Symbian']],
    ['Teknik', 'Vad betyder www i en webbadress?', 'World Wide Web', ['Web World Wide', 'Wide Web World', 'Wireless Web Window']],
    ['Mat & dryck', 'Från vilken böna görs choklad?', 'Kakaobönan', ['Kaffebönan', 'Vaniljbönan', 'Sojabönan']],
    ['Mat & dryck', 'Vilket land är champagne skyddad ursprungsbeteckning för?', 'Frankrike', ['Italien', 'Spanien', 'Tyskland']],
    ['Mat & dryck', 'Vad är den huvudsakliga ingrediensen i hummus?', 'Kikärtor', ['Linser', 'Bönor', 'Ris']],
    ['Allmänt', 'Hur många färger har en regnbåge traditionellt?', '7', ['5', '6', '8']],
    ['Allmänt', 'Vad kallas den längsta sidan i en rätvinklig triangel?', 'Hypotenusan', ['Katet', 'Diagonal', 'Bas']],
    ['Allmänt', 'Vilket årtal inleder 2000-talet (århundradet)?', '2001', ['2000', '1999', '2010']],
  ]
  for (const [cat, text, correct, wrongs] of extras) {
    out.push(q(id('x'), cat, text, withWrong(correct, wrongs), 0))
  }

  // Dedup by text
  const seen = new Set()
  return out.filter((item) => {
    const key = item.text.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildEn(rnd = Math.random) {
  const out = []
  let n = 0
  const id = (p) => `tp-en-${p}-${++n}`

  const allCaps = capitalsEn.map((x) => x[1])
  for (const [country, capital] of capitalsEn) {
    out.push(q(id('cap'), 'Geography', `What is the capital of ${country}?`, withWrong(capital, pick3(allCaps, capital, rnd)), 0))
    out.push(q(id('land'), 'Geography', `Which country has the capital ${capital}?`, withWrong(country, pick3(capitalsEn.map((c) => c[0]), country, rnd)), 0))
  }

  const inventorsEn = [
    ['the telephone', 'Alexander Graham Bell'],
    ['the practical light bulb', 'Thomas Edison'],
    ['the European printing press', 'Johannes Gutenberg'],
    ['penicillin', 'Alexander Fleming'],
    ['the theory of relativity', 'Albert Einstein'],
    ['the first smallpox vaccine', 'Edward Jenner'],
    ['the periodic table', 'Dmitri Mendeleev'],
    ['radioactivity (coining the term)', 'Marie Curie'],
    ['evolution by natural selection', 'Charles Darwin'],
    ['the World Wide Web', 'Tim Berners-Lee'],
  ]
  for (const [thing, who] of inventorsEn) {
    out.push(q(id('inv'), 'Science', `Who is most associated with ${thing}?`, withWrong(who, pick3(inventorsEn.map((i) => i[1]), who, rnd)), 0))
  }

  const yearsEn = [
    ['did the Berlin Wall fall', '1989'],
    ['did humans first land on the Moon', '1969'],
    ['did World War I begin', '1914'],
    ['did World War II end in Europe', '1945'],
    ['did the Titanic sink', '1912'],
    ['was the U.S. Declaration of Independence signed', '1776'],
    ['did the French Revolution begin', '1789'],
    ['did Columbus reach the Americas', '1492'],
    ['was the first iPhone released', '2007'],
  ]
  for (const [event, year] of yearsEn) {
    out.push(q(id('yr'), 'History', `In what year ${event}?`, withWrong(year, pick3(['1492', '1776', '1789', '1912', '1914', '1945', '1969', '1989', '2007', '2012'], year, rnd)), 0))
  }

  const booksEn = [
    ['Romeo and Juliet', 'William Shakespeare'],
    ['Hamlet', 'William Shakespeare'],
    ['Don Quixote', 'Miguel de Cervantes'],
    ['Crime and Punishment', 'Fyodor Dostoevsky'],
    ['War and Peace', 'Leo Tolstoy'],
    ['1984', 'George Orwell'],
    ['Animal Farm', 'George Orwell'],
    ["Harry Potter and the Philosopher's Stone", 'J.K. Rowling'],
    ['The Lord of the Rings', 'J.R.R. Tolkien'],
    ['The Hobbit', 'J.R.R. Tolkien'],
    ['The Old Man and the Sea', 'Ernest Hemingway'],
    ['The Great Gatsby', 'F. Scott Fitzgerald'],
    ['Pride and Prejudice', 'Jane Austen'],
  ]
  for (const [book, author] of booksEn) {
    out.push(q(id('bok'), 'Literature', `Who wrote "${book}"?`, withWrong(author, pick3(booksEn.map((b) => b[1]), author, rnd)), 0))
  }

  const musicEn = [
    ['Bohemian Rhapsody', 'Queen'],
    ['Billie Jean', 'Michael Jackson'],
    ['Hey Jude', 'The Beatles'],
    ['Smells Like Teen Spirit', 'Nirvana'],
    ['Imagine', 'John Lennon'],
    ['Dancing Queen', 'ABBA'],
    ['Thriller', 'Michael Jackson'],
  ]
  for (const [song, artist] of musicEn) {
    out.push(q(id('mus'), 'Music', `Who is most associated with the song "${song}"?`, withWrong(artist, pick3(musicEn.map((m) => m[1]), artist, rnd)), 0))
  }

  const sportsEn = [
    ['Wimbledon', 'tennis'],
    ['Tour de France', 'cycling'],
    ['Super Bowl', 'American football'],
    ['Stanley Cup', 'ice hockey'],
    ['UEFA Champions League', 'football/soccer'],
    ['FIFA World Cup', 'football/soccer'],
    ['NBA Finals', 'basketball'],
  ]
  for (const [event, sport] of sportsEn) {
    out.push(q(id('spo'), 'Sports', `Which sport is ${event} mainly associated with?`, withWrong(sport, pick3(sportsEn.map((s) => s[1]), sport, rnd)), 0))
  }

  const scienceEn = [
    ['the chemical symbol for gold', 'Au', ['Ag', 'Fe', 'Pb']],
    ['the chemical symbol for iron', 'Fe', ['Ir', 'Au', 'Na']],
    ['the chemical symbol for sodium', 'Na', ['N', 'S', 'Ne']],
    ['the chemical symbol for oxygen', 'O', ['Ox', 'Oy', 'Or']],
    ['the planet closest to the Sun', 'Mercury', ['Venus', 'Mars', 'Earth']],
    ['the largest planet in the solar system', 'Jupiter', ['Saturn', 'Neptune', 'Uranus']],
    ['the planet known for its rings', 'Saturn', ['Jupiter', 'Uranus', 'Neptune']],
    ['the Red Planet', 'Mars', ['Venus', 'Mercury', 'Jupiter']],
    ['the chemical formula for water', 'H2O', ['CO2', 'O2', 'NaCl']],
    ["DNA's shape, often described as a", 'double helix', ['single spiral', 'cube', 'pyramid']],
  ]
  for (const [prompt, correct, wrongs] of scienceEn) {
    out.push(q(id('sci'), 'Science', `What is ${prompt}?`, withWrong(correct, wrongs), 0))
  }

  const extras = [
    ['History', 'Who was the first person on the Moon?', 'Neil Armstrong', ['Buzz Aldrin', 'Yuri Gagarin', 'John Glenn']],
    ['History', 'Who was the first human in space?', 'Yuri Gagarin', ['Neil Armstrong', 'Alan Shepard', 'Valentina Tereshkova']],
    ['History', 'Which empire built the Colosseum in Rome?', 'The Roman Empire', ['Greek Empire', 'Ottoman Empire', 'Byzantine Empire']],
    ['History', 'Which pharaoh is famous for a nearly intact tomb?', 'Tutankhamun', ['Ramses II', 'Cleopatra', 'Akhenaten']],
    ['History', 'Who was UK Prime Minister for most of WWII?', 'Winston Churchill', ['Neville Chamberlain', 'Tony Blair', 'Margaret Thatcher']],
    ['Geography', 'What is the largest desert in the world (hot desert)?', 'Sahara', ['Gobi', 'Kalahari', 'Atacama']],
    ['Geography', 'Which sea lies between Europe and Africa?', 'Mediterranean Sea', ['Black Sea', 'Red Sea', 'Caspian Sea']],
    ['Geography', 'Which city is nicknamed the Big Apple?', 'New York', ['Los Angeles', 'Chicago', 'Boston']],
    ['Science', 'About how many bones does an adult human have?', '206', ['156', '256', '306']],
    ['Science', 'Which organ pumps blood through the body?', 'The heart', ['The liver', 'The lungs', 'The kidneys']],
    ['Science', 'Diamond is a form of which element?', 'Carbon', ['Silicon', 'Quartz', 'Calcium']],
    ['Nature', 'What is the largest land animal?', 'African elephant', ['Giraffe', 'Rhinoceros', 'Hippopotamus']],
    ['Nature', 'What do koalas mainly eat?', 'Eucalyptus leaves', ['Bamboo', 'Fish', 'Insects']],
    ['Nature', 'What do giant pandas mainly eat?', 'Bamboo', ['Eucalyptus', 'Fish', 'Meat']],
    ['Sports', 'How many players does a football/soccer team have on the field?', '11', ['9', '10', '12']],
    ['Sports', 'How many holes are on a standard golf course round?', '18', ['9', '12', '21']],
    ['Sports', 'Which sport uses a puck?', 'Ice hockey', ['Lacrosse', 'Bandy', 'Curling']],
    ['Sports', 'Which country won the 2018 FIFA World Cup?', 'France', ['Croatia', 'Brazil', 'Germany']],
    ['Sports', 'Which country won the 2022 FIFA World Cup?', 'Argentina', ['France', 'Brazil', 'Spain']],
    ['Music', 'How many strings does a standard guitar have?', '6', ['4', '5', '7']],
    ['Movies & TV', 'Who plays Iron Man in the MCU?', 'Robert Downey Jr.', ['Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo']],
    ['Movies & TV', 'Who plays Jack Sparrow?', 'Johnny Depp', ['Orlando Bloom', 'Brad Pitt', 'Tom Cruise']],
    ['Movies & TV', 'In which city is Friends mainly set?', 'New York', ['Los Angeles', 'Chicago', 'Boston']],
    ['Literature', 'Who wrote Romeo and Juliet?', 'William Shakespeare', ['Charles Dickens', 'Jane Austen', 'Mark Twain']],
    ['Literature', 'Which detective was created by Arthur Conan Doyle?', 'Sherlock Holmes', ['Hercule Poirot', 'Miss Marple', 'Sam Spade']],
    ['Culture', 'Who painted the Mona Lisa?', 'Leonardo da Vinci', ['Michelangelo', 'Raphael', 'Rembrandt']],
    ['Culture', 'Who painted Guernica?', 'Pablo Picasso', ['Salvador Dalí', 'Vincent van Gogh', 'Claude Monet']],
    ['Culture', 'Which artist famously cut off part of his ear?', 'Vincent van Gogh', ['Edvard Munch', 'Paul Gauguin', 'Henri Matisse']],
    ['Tech', 'What does CPU stand for?', 'Central Processing Unit', ['Computer Power Unit', 'Core Process Utility', 'Central Program Upload']],
    ['Tech', 'Which company made the iPhone?', 'Apple', ['Samsung', 'Google', 'Microsoft']],
    ['Tech', 'What is Google’s mobile OS called?', 'Android', ['iOS', 'Windows Phone', 'Symbian']],
    ['Food', 'Chocolate comes from which bean?', 'Cocoa bean', ['Coffee bean', 'Vanilla bean', 'Soybean']],
    ['Food', 'Champagne is a protected name for wine from which country?', 'France', ['Italy', 'Spain', 'Germany']],
    ['General', 'How many colors are traditionally in a rainbow?', '7', ['5', '6', '8']],
  ]
  for (const [cat, text, correct, wrongs] of extras) {
    out.push(q(id('x'), cat, text, withWrong(correct, wrongs), 0))
  }

  const seen = new Set()
  return out.filter((item) => {
    const key = item.text.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function serialize(name, arr) {
  const body = arr
    .map(
      (item) => `  {
    id: ${JSON.stringify(item.id)},
    category: ${JSON.stringify(item.category)},
    text: ${JSON.stringify(item.text)},
    options: ${JSON.stringify(item.options)},
    correctIndex: ${item.correctIndex},
  }`,
    )
    .join(',\n')
  return `import type { Question } from './types.js'\n\nexport const ${name}: Question[] = [\n${body},\n]\n`
}

function purgeMathFromBulk(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')
  const mathRe =
    /Hur många (meter|minuter|timmar|bokstäver)|Du betalar|°F är|Ungefär hur många °F|How many (meters|minutes|hours|letters)|You pay|°F is|What is \d+\s*[+×x*]/i
  // Parse objects roughly
  const parts = src.split(/\n  \{\n/)
  const header = parts[0]
  const kept = []
  let removed = 0
  for (let i = 1; i < parts.length; i++) {
    const block = '  {\n' + parts[i].replace(/,\n\]\s*$/, '').replace(/,\s*$/, '')
    const textMatch = block.match(/text:\s*"([^"]+)"/) || block.match(/text:\s*'([^']+)'/)
    const text = textMatch ? textMatch[1] : ''
    if (mathRe.test(text)) {
      removed++
      continue
    }
    kept.push(block.trim().replace(/,$/, ''))
  }
  const exportName = src.includes('BULK_SV') ? 'BULK_SV_QUESTIONS' : 'BULK_EN_QUESTIONS'
  const out =
    `import type { Question } from './types.js'\n\nexport const ${exportName}: Question[] = [\n` +
    kept.map((b) => (b.startsWith('{') ? '  ' + b : b)).join(',\n') +
    ',\n]\n'
  // Fix formatting - simpler rewrite via JSON parse of texts... use regex extract instead
  return { removed, keptCount: kept.length, rewrite: true, kept, exportName, src }
}

// Better purge: extract via regex objects
function purgeFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')
  const exportName = src.includes('BULK_SV') ? 'BULK_SV_QUESTIONS' : 'BULK_EN_QUESTIONS'
  const re =
    /\{\s*id:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*text:\s*"([^"]*)",\s*options:\s*(\[[^\]]+\]),\s*correctIndex:\s*(\d+),?\s*\}/gs
  const mathRe =
    /Hur många (meter|minuter|timmar|bokstäver|dygn)|Du betalar|°F|How many (meters|minutes|hours|letters|days)|You pay|What is \d+|km\?|timmar\?|minuter\?/i
  const items = []
  let m
  let removed = 0
  while ((m = re.exec(src))) {
    const text = m[3]
    if (mathRe.test(text) || /Hur många meter|How many meters|Du betalar|You pay \d+/i.test(text)) {
      removed++
      continue
    }
    let options
    try {
      options = JSON.parse(m[4].replace(/'/g, '"'))
    } catch {
      continue
    }
    items.push({
      id: m[1],
      category: m[2],
      text,
      options,
      correctIndex: Number(m[5]),
    })
  }
  fs.writeFileSync(filePath, serialize(exportName, items))
  return { removed, kept: items.length }
}

const sv = buildSv()
const en = buildEn()
fs.writeFileSync(path.join(server, 'questions-tp-sv.ts'), serialize('TP_SV_QUESTIONS', sv))
fs.writeFileSync(path.join(server, 'questions-tp-en.ts'), serialize('TP_EN_QUESTIONS', en))
const p1 = purgeFile(path.join(server, 'questions-bulk-sv.ts'))
const p2 = purgeFile(path.join(server, 'questions-bulk-en.ts'))
console.log('TP SV', sv.length, 'TP EN', en.length)
console.log('purged bulk-sv', p1, 'bulk-en', p2)
