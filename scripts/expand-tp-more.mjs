#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const server = path.resolve(import.meta.dirname, '../server')

function parseFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')
  const name = (src.match(/export const (\w+)/) || [])[1]
  const re =
    /\{\s*id:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*text:\s*"([^"]*)",\s*options:\s*(\[[^\]]+\]),\s*correctIndex:\s*(\d+),?\s*\}/gs
  const items = []
  let m
  while ((m = re.exec(src))) {
    items.push({
      id: m[1],
      category: m[2],
      text: m[3],
      options: JSON.parse(m[4].replace(/'/g, '"')),
      correctIndex: Number(m[5]),
    })
  }
  return { name, items }
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

function withWrong(correct, wrongs) {
  return [correct, ...wrongs.slice(0, 3)]
}

const moreSv = [
  ['Historia', 'Vilket år startade trettioåriga kriget?', '1618', ['1648', '1523', '1718']],
  ['Historia', 'Vilket år slutade trettioåriga kriget?', '1648', ['1618', '1718', '1814']],
  ['Historia', 'Vem var Sveriges kung under stormaktstidens början (Gustav II Adolf)?', 'Gustav II Adolf', ['Karl XII', 'Gustav Vasa', 'Karl XIV Johan']],
  ['Historia', 'Vid vilket slag dog Gustav II Adolf 1632?', 'Lützen', ['Poltava', 'Narva', 'Breitenfeld']],
  ['Historia', 'Vilket slag anses ha avslutat Sveriges stormaktstid 1709?', 'Poltava', ['Narva', 'Lützen', 'Leipzig']],
  ['Historia', 'Vem grundade Stockholm enligt traditionen?', 'Birger jarl', ['Gustav Vasa', 'Olof Skötkonung', 'Engelbrekt']],
  ['Historia', 'Vilket år anses Sverige ofta ha kristnats mer officiellt under Olof Skötkonung?', 'omkring år 1000', ['1523', '1397', '1809']],
  ['Historia', 'Vad hette unionen mellan Danmark, Norge och Sverige på medeltiden?', 'Kalmarunionen', ['Hansan', 'NATO', 'EFTA']],
  ['Historia', 'Vilket år blev Gustav Vasa kung och Sverige mer självständigt från Danmark?', '1523', ['1397', '1618', '1809']],
  ['Historia', 'Vad kallas den svenska författningen från 1809 som begränsade kungamakten?', '1809 års regeringsform', ['1719 års författning', '1974 års regeringsform', 'Magna Carta']],
  ['Historia', 'Vilket år fick Sverige sin nuvarande regeringsform (huvudsakligen)?', '1974', ['1809', '1921', '1995']],
  ['Historia', 'När fick kvinnor rösträtt i Sverige (allmän och lika)?', '1921', ['1909', '1945', '1971']],
  ['Historia', 'Vilken svensk statsminister mördades 1986?', 'Olof Palme', ['Tage Erlander', 'Per Albin Hansson', 'Carl Bildt']],
  ['Historia', 'Vilken utrikesminister mördades i Stockholm 2003?', 'Anna Lindh', ['Margot Wallström', 'Karin Söder', 'Birgitta Dahl']],
  ['Geografi', 'Vilket är Sveriges nordligaste län?', 'Norrbotten', ['Västerbotten', 'Jämtland', 'Västernorrland']],
  ['Geografi', 'Vilken svensk ö är störst?', 'Gotland', ['Öland', 'Orust', 'Hisingen']],
  ['Geografi', 'Vilken svensk ö ligger närmast Kalmar?', 'Öland', ['Gotland', 'Ven', 'Åland']],
  ['Geografi', 'Vilken stad ligger vid mynningen av Göta älv?', 'Göteborg', ['Malmö', 'Halmstad', 'Uddevalla']],
  ['Geografi', 'I vilken stad ligger Turning Torso?', 'Malmö', ['Göteborg', 'Stockholm', 'Helsingborg']],
  ['Geografi', 'Vad heter Sveriges högsta berg?', 'Kebnekaise', ['Sarek', 'Abisko', 'Åreskutan']],
  ['Geografi', 'Vilken nationalpark är Sveriges äldsta?', 'Sarek (bland de första 1909)', ['Abisko', 'Tyresta', 'Padjelanta']],
  ['Geografi', 'Vilket land ligger öster om Östersjön mitt emot Mellansverige?', 'Finland/Baltikum', ['Norge', 'Danmark', 'Island']],
  ['Geografi', 'Vilken flod rinner genom London?', 'Themsen', ['Seine', 'Rhen', 'Donau']],
  ['Geografi', 'Vilken flod rinner genom Kairo?', 'Nilén', ['Eufrat', 'Tigris', 'Jordan']],
  ['Geografi', 'Vilken stad är känd för kanalerna och gondolerna?', 'Venedig', ['Amsterdam', 'Brügge', 'Stockholm']],
  ['Geografi', 'I vilket land ligger Machu Picchu?', 'Peru', ['Mexiko', 'Chile', 'Bolivia']],
  ['Geografi', 'I vilket land ligger Taj Mahal?', 'Indien', ['Pakistan', 'Iran', 'Turkiet']],
  ['Geografi', 'I vilket land ligger pyramider i Giza?', 'Egypten', ['Sudan', 'Libyen', 'Marocko']],
  ['Geografi', 'Vilket land är känt för fjordar och fjäll i norr?', 'Norge', ['Danmark', 'Nederländerna', 'Belgien']],
  ['Vetenskap', 'Vad kallas den kraft som håller oss kvar på jorden?', 'Gravitation', ['Magnetism', 'Friktion', 'Centrifugalkraft']],
  ['Vetenskap', 'Vilket organ filtrerar blodet och bildar urin?', 'Njurarna', ['Levern', 'Mjälten', 'Bukspottkörteln']],
  ['Vetenskap', 'Vad producerar bukspottkörteln som reglerar blodsocker?', 'Insulin', ['Adrenalin', 'Kortisol', 'Melatonin']],
  ['Vetenskap', 'Vilken vitamin får kroppen främst från solljus?', 'D-vitamin', ['C-vitamin', 'B12', 'A-vitamin']],
  ['Vetenskap', 'Vad kallas djur som äter både växter och kött?', 'Allätare', ['Växtätare', 'Köttätare', 'Asätare']],
  ['Vetenskap', 'Hur många kromosomer har människan normalt?', '46', ['23', '48', '44']],
  ['Vetenskap', 'Vad kallas den minsta enheten i ett grundämne?', 'Atom', ['Molekyl', 'Cell', 'Proton']],
  ['Vetenskap', 'Vilken partikel har negativ laddning?', 'Elektron', ['Proton', 'Neutron', 'Foton']],
  ['Vetenskap', 'Vad mäter man i ampere?', 'Elektrisk ström', ['Spänning', 'Effekt', 'Resistans']],
  ['Vetenskap', 'Vad mäter man i volt?', 'Elektrisk spänning', ['Ström', 'Effekt', 'Energi']],
  ['Natur', 'Vilket djur är Sveriges nationaldjur?', 'Älg', ['Björn', 'Varg', 'Rådjur']],
  ['Natur', 'Vilken fågel är Sveriges nationalfågel?', 'Koltrast', ['Bofink', 'Talgoxe', 'Örn']],
  ['Natur', 'Vad kallas hanen hos ett rådjur?', 'Bock', ['Tjur', 'Hingst', 'Galt']],
  ['Natur', 'Vilket träd är vanligt på svenska midsummerstänger?', 'Björk (löv)', ['Ek', 'Tall', 'Gran']],
  ['Natur', 'Vad äter en myrslok främst?', 'Myror/termitter', ['Bär', 'Fisk', 'Gräs']],
  ['Natur', 'Vilket havsdjur är känt för sin bläckskydd?', 'Bläckfisk', ['Haj', 'Delfin', 'Val']],
  ['Sport', 'Hur många perioder har en ishockeymatch normalt?', '3', ['2', '4', '5']],
  ['Sport', 'Hur lång är en fotbollsmatch i ordinarie tid?', '90 minuter', ['80', '100', '60']],
  ['Sport', 'Vilket land vann ishockey-VM för herrar 2013 (hemma i Sverige/Finland-eran – Tre Kronor vann)?', 'Sverige', ['Kanada', 'Finland', 'Ryssland']],
  ['Sport', 'I vilken sport tävlar man i slalom?', 'Alpin skidåkning', ['Längdskidor', 'Skidskytte', 'Backhoppning']],
  ['Sport', 'Vad kallas poängställningen 40–40 i tennis?', 'Equaliser/Deuce', ['Advantage', 'Matchboll', 'Setboll']],
  ['Sport', 'Hur många poäng ger en touchdown i amerikansk fotboll (utan extra)?', '6', ['3', '7', '2']],
  ['Sport', 'Vilken färg har målvaktströjan ofta i fotboll jämfört med laget?', 'Annorlunda/unik', ['Alltid svart', 'Alltid gul', 'Alltid grön']],
  ['Musik', 'Vilket instrument har svarta och vita tangenter?', 'Piano', ['Gitarr', 'Trummor', 'Fiol']],
  ['Musik', 'Vad kallas en grupp på fyra musiker?', 'Kvartett', ['Trio', 'Kvintett', 'Oktett']],
  ['Musik', 'Vilken svensk duo är känd för "It Must Have Been Love"?', 'Roxette', ['ABBA', 'Ace of Base', 'Europe']],
  ['Musik', 'Vilket band gjorde "The Final Countdown"?', 'Europe', ['ABBA', 'Roxette', 'Swedish House Mafia']],
  ['Musik', 'Vad heter Aviciis riktiga förnamn?', 'Tim', ['Avicii', 'DJ', 'Eric']],
  ['Film & TV', 'Vilken filmserie handlar om en pojke som överlever och går till trollkarlsskola?', 'Harry Potter', ['Narnia', 'Percy Jackson', 'Hunger Games']],
  ['Film & TV', 'Vad heter den fiktiva afrikanska nationen i Black Panther?', 'Wakanda', ['Asgard', 'Gotham', 'Latveria']],
  ['Film & TV', 'Vilken streamingjänst lanserade The Crown?', 'Netflix', ['Disney+', 'HBO', 'Amazon']],
  ['Film & TV', 'Vad heter den gula familjen i The Simpsons?', 'Simpsons', ['Griffins', 'Smiths', 'Belocher']],
  ['Litteratur', 'Vem skrev Bröderna Lejonhjärta?', 'Astrid Lindgren', ['Maria Gripe', 'Selma Lagerlöf', 'Elsa Beskow']],
  ['Litteratur', 'Vem skrev Ronja Rövardotter?', 'Astrid Lindgren', ['Astrid Lindgren', 'Maria Gripe', 'Gunilla Bergström']],
  ['Litteratur', 'Vem skrev Emil i Lönneberga?', 'Astrid Lindgren', ['Selma Lagerlöf', 'Elsa Beskow', 'Sven Nordqvist']],
  ['Litteratur', 'Vem skapade Pettson och Findus?', 'Sven Nordqvist', ['Astrid Lindgren', 'Gunilla Bergström', 'Jan Lööf']],
  ['Litteratur', 'Vem skapade Alfons Åberg?', 'Gunilla Bergström', ['Astrid Lindgren', 'Sven Nordqvist', 'Elsa Beskow']],
  ['Kultur', 'Vilken målare är känd för Stjärnenatt?', 'Vincent van Gogh', ['Claude Monet', 'Edvard Munch', 'Pablo Picasso']],
  ['Kultur', 'Vilken målare är känd för Skriet?', 'Edvard Munch', ['Vincent van Gogh', 'Salvador Dalí', 'Gustav Klimt']],
  ['Kultur', 'I vilket museum hänger Mona Lisa?', 'Louvre', ['Prado', 'Uffizi', 'MoMA']],
  ['Kultur', 'Vad kallas japansk teckningsserie ofta?', 'Manga', ['Anime', 'Manhwa', 'Comic']],
  ['Teknik', 'Vad betyder USB ungefär?', 'Universal Serial Bus', ['Ultra Speed Band', 'United System Bridge', 'User Soft Button']],
  ['Teknik', 'Vilket företag äger Instagram?', 'Meta (Facebook)', ['Google', 'Amazon', 'Apple']],
  ['Teknik', 'Vad heter Apples röstassistent?', 'Siri', ['Alexa', 'Cortana', 'Google Assistant']],
  ['Teknik', 'Vad heter Amazons röstassistent?', 'Alexa', ['Siri', 'Cortana', 'Bixby']],
  ['Mat & dryck', 'Vad är den huvudsakliga spannmålen i risotto?', 'Ris', ['Pasta', 'Couscous', 'Potatis']],
  ['Mat & dryck', 'Från vilken växt görs te främst?', 'Teplantan (Camellia sinensis)', ['Kaffeplantan', 'Kakaoträdet', 'Mint']],
  ['Mat & dryck', 'Vad kallas spanska aptitretare?', 'Tapas', ['Meze', 'Antipasti', 'Dim sum']],
  ['Mat & dryck', 'Vilken ost är typisk för Grekland bland dessa?', 'Feta', ['Parmesan', 'Cheddar', 'Mozzarella']],
  ['Allmänt', 'Hur många sekunder har en minut?', '60', ['100', '30', '90']],
  ['Allmänt', 'Hur många dagar har ett skottår?', '366', ['365', '364', '367']],
  ['Allmänt', 'Vad heter den tredje planeten från solen?', 'Jorden', ['Mars', 'Venus', 'Merkurius']],
  ['Allmänt', 'Vilket språk har flest modersmålstalare i världen ungefär?', 'Mandarin-kinesiska', ['Engelska', 'Spanska', 'Hindi']],
]

const moreEn = [
  ['History', 'In which year did the Thirty Years’ War begin?', '1618', ['1648', '1523', '1718']],
  ['History', 'In which year did the Thirty Years’ War end?', '1648', ['1618', '1718', '1814']],
  ['History', 'Who was the first President of the United States?', 'George Washington', ['Thomas Jefferson', 'Abraham Lincoln', 'John Adams']],
  ['History', 'Who was known as the Maid of Orléans?', 'Joan of Arc', ['Marie Antoinette', 'Catherine the Great', 'Elizabeth I']],
  ['History', 'Which wall divided Berlin during the Cold War?', 'The Berlin Wall', ['Hadrian’s Wall', 'Great Wall of China', 'Antonine Wall']],
  ['History', 'Which ship sank in 1912 after hitting an iceberg?', 'Titanic', ['Lusitania', 'Britannic', 'Olympic']],
  ['Geography', 'What is the longest river in the world (commonly cited)?', 'The Nile', ['Amazon', 'Yangtze', 'Mississippi']],
  ['Geography', 'What is the largest ocean?', 'Pacific Ocean', ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean']],
  ['Geography', 'Which country has the most people?', 'India', ['China', 'USA', 'Indonesia']],
  ['Geography', 'Which desert covers much of northern Africa?', 'Sahara', ['Gobi', 'Kalahari', 'Atacama']],
  ['Geography', 'Which mountain is the highest above sea level?', 'Mount Everest', ['K2', 'Kangchenjunga', 'Lhotse']],
  ['Geography', 'In which country is the Great Barrier Reef?', 'Australia', ['New Zealand', 'Indonesia', 'Philippines']],
  ['Science', 'What force keeps us on Earth?', 'Gravity', ['Magnetism', 'Friction', 'Centrifugal force']],
  ['Science', 'Which organ filters blood and produces urine?', 'Kidneys', ['Liver', 'Spleen', 'Pancreas']],
  ['Science', 'Which vitamin do humans mainly get from sunlight?', 'Vitamin D', ['Vitamin C', 'Vitamin B12', 'Vitamin A']],
  ['Science', 'How many chromosomes do humans normally have?', '46', ['23', '48', '44']],
  ['Science', 'Which particle has a negative charge?', 'Electron', ['Proton', 'Neutron', 'Photon']],
  ['Science', 'What does an ampere measure?', 'Electric current', ['Voltage', 'Power', 'Resistance']],
  ['Nature', 'What is the largest living land animal?', 'African elephant', ['Giraffe', 'White rhinoceros', 'Hippopotamus']],
  ['Nature', 'What do koalas mainly eat?', 'Eucalyptus', ['Bamboo', 'Fish', 'Insects']],
  ['Sports', 'How many players are on a basketball team on the court?', '5', ['6', '7', '4']],
  ['Sports', 'How long is a standard football/soccer match?', '90 minutes', ['80', '100', '60']],
  ['Sports', 'How many periods are in a standard ice hockey game?', '3', ['2', '4', '5']],
  ['Music', 'Which instrument has black and white keys?', 'Piano', ['Guitar', 'Drums', 'Violin']],
  ['Music', 'How many strings does a standard violin have?', '4', ['5', '6', '3']],
  ['Movies & TV', 'Which movie franchise features a boy wizard?', 'Harry Potter', ['Narnia', 'Percy Jackson', 'Hunger Games']],
  ['Movies & TV', 'What is the fictional nation in Black Panther?', 'Wakanda', ['Asgard', 'Gotham', 'Latveria']],
  ['Literature', 'Who wrote The Odyssey?', 'Homer', ['Virgil', 'Sophocles', 'Plato']],
  ['Literature', 'Who wrote The Iliad?', 'Homer', ['Virgil', 'Ovid', 'Herodotus']],
  ['Culture', 'Who painted The Starry Night?', 'Vincent van Gogh', ['Claude Monet', 'Edvard Munch', 'Pablo Picasso']],
  ['Culture', 'Who painted The Scream?', 'Edvard Munch', ['Vincent van Gogh', 'Salvador Dalí', 'Gustav Klimt']],
  ['Culture', 'In which museum is the Mona Lisa displayed?', 'The Louvre', ['Prado', 'Uffizi', 'MoMA']],
  ['Tech', 'What does USB stand for?', 'Universal Serial Bus', ['Ultra Speed Band', 'United System Bridge', 'User Soft Button']],
  ['Tech', 'Which company owns Instagram?', 'Meta', ['Google', 'Amazon', 'Apple']],
  ['Tech', 'What is Apple’s voice assistant called?', 'Siri', ['Alexa', 'Cortana', 'Google Assistant']],
  ['Food', 'What grain is risotto mainly made from?', 'Rice', ['Pasta', 'Couscous', 'Potato']],
  ['Food', 'What plant is tea mainly made from?', 'Camellia sinensis (tea plant)', ['Coffee plant', 'Cocoa tree', 'Mint']],
  ['General', 'How many seconds are in a minute?', '60', ['100', '30', '90']],
  ['General', 'How many days are in a leap year?', '366', ['365', '364', '367']],
  ['General', 'Which planet is third from the Sun?', 'Earth', ['Mars', 'Venus', 'Mercury']],
]

const svFile = path.join(server, 'questions-tp-sv.ts')
const enFile = path.join(server, 'questions-tp-en.ts')
const sv = parseFile(svFile)
const en = parseFile(enFile)
const seenSv = new Set(sv.items.map((x) => x.text.toLowerCase()))
const seenEn = new Set(en.items.map((x) => x.text.toLowerCase()))
let i = 0
for (const [cat, text, correct, wrongs] of moreSv) {
  if (seenSv.has(text.toLowerCase())) continue
  // fix bad duplicate option in Ronja
  const opts = withWrong(correct, wrongs.filter((w, idx, a) => w !== correct && a.indexOf(w) === idx))
  while (opts.length < 4) opts.push(`Alternativ ${opts.length}`)
  sv.items.push({ id: `tp-sv-more-${++i}`, category: cat, text, options: opts, correctIndex: 0 })
  seenSv.add(text.toLowerCase())
}
i = 0
for (const [cat, text, correct, wrongs] of moreEn) {
  if (seenEn.has(text.toLowerCase())) continue
  const opts = withWrong(correct, wrongs.filter((w) => w !== correct))
  while (opts.length < 4) opts.push(`Option ${opts.length}`)
  en.items.push({ id: `tp-en-more-${++i}`, category: cat, text, options: opts, correctIndex: 0 })
  seenEn.add(text.toLowerCase())
}
fs.writeFileSync(svFile, serialize(sv.name, sv.items))
fs.writeFileSync(enFile, serialize(en.name, en.items))
console.log('TP SV', sv.items.length, 'TP EN', en.items.length)
