import type { Question } from './types.js'
import { EXTRA_QUESTIONS } from './questions-extra.js'
import { EN_QUESTIONS } from './questions-en.js'
import { SV_MORE_QUESTIONS } from './questions-sv-more.js'
import { BULK_SV_QUESTIONS } from './questions-bulk-sv.js'
import { BULK_EN_QUESTIONS } from './questions-bulk-en.js'
import { TP_SV_QUESTIONS } from './questions-tp-sv.js'
import { TP_EN_QUESTIONS } from './questions-tp-en.js'

export type QuizLanguage = 'sv' | 'en'

const BASE_QUESTIONS: Question[] = [
  // Geografi
  {
    id: 'geo-1',
    category: 'Geografi',
    text: 'Vilken är Sveriges huvudstad?',
    options: ['Göteborg', 'Malmö', 'Stockholm', 'Uppsala'],
    correctIndex: 2,
  },
  {
    id: 'geo-2',
    category: 'Geografi',
    text: 'Vilket land har flest invånare i världen?',
    options: ['USA', 'Indien', 'Kina', 'Indonesien'],
    correctIndex: 1,
  },
  {
    id: 'geo-3',
    category: 'Geografi',
    text: 'Vilken flod rinner genom Paris?',
    options: ['Donau', 'Themsen', 'Rhen', 'Seine'],
    correctIndex: 3,
  },
  {
    id: 'geo-4',
    category: 'Geografi',
    text: 'Vilket är världens största hav?',
    options: ['Atlanten', 'Indiska oceanen', 'Stilla havet', 'Ishavet'],
    correctIndex: 2,
  },
  {
    id: 'geo-5',
    category: 'Geografi',
    text: 'I vilket land ligger Machu Picchu?',
    options: ['Chile', 'Peru', 'Bolivia', 'Brasilien'],
    correctIndex: 1,
  },
  {
    id: 'geo-6',
    category: 'Geografi',
    text: 'Vilket land är känt som "Land of the Rising Sun"?',
    options: ['Kina', 'Sydkorea', 'Japan', 'Thailand'],
    correctIndex: 2,
  },
  {
    id: 'geo-7',
    category: 'Geografi',
    text: 'Vilken är Norges huvudstad?',
    options: ['Bergen', 'Oslo', 'Trondheim', 'Stavanger'],
    correctIndex: 1,
  },
  {
    id: 'geo-8',
    category: 'Geografi',
    text: 'Vilket är Europas högsta berg?',
    options: ['Mont Blanc', 'Matterhorn', 'Elbrus', 'Etna'],
    correctIndex: 2,
  },
  {
    id: 'geo-9',
    category: 'Geografi',
    text: 'Vilken kontinent är Australien en del av?',
    options: ['Asien', 'Oceanien', 'Afrika', 'Europa'],
    correctIndex: 1,
  },
  {
    id: 'geo-10',
    category: 'Geografi',
    text: 'Vilken stad kallas "Den eviga staden"?',
    options: ['Aten', 'Rom', 'Jerusalem', 'Istanbul'],
    correctIndex: 1,
  },

  // Historia
  {
    id: 'his-1',
    category: 'Historia',
    text: 'Vilket år landade Apollo 11 på månen?',
    options: ['1965', '1969', '1972', '1961'],
    correctIndex: 1,
  },
  {
    id: 'his-2',
    category: 'Historia',
    text: 'Vem var Sveriges kung under 1600-talet och dog vid Lützen?',
    options: ['Karl XII', 'Gustav Vasa', 'Gustav II Adolf', 'Erik XIV'],
    correctIndex: 2,
  },
  {
    id: 'his-3',
    category: 'Historia',
    text: 'När föll Berlinmuren?',
    options: ['1987', '1989', '1991', '1985'],
    correctIndex: 1,
  },
  {
    id: 'his-4',
    category: 'Historia',
    text: 'Vilket land byggde de första pyramiderna i Giza?',
    options: ['Grekland', 'Romarriket', 'Egypten', 'Mesopotamien'],
    correctIndex: 2,
  },
  {
    id: 'his-5',
    category: 'Historia',
    text: 'Vem målade taket i Sixtinska kapellet?',
    options: ['Leonardo da Vinci', 'Raphael', 'Michelangelo', 'Donatello'],
    correctIndex: 2,
  },
  {
    id: 'his-6',
    category: 'Historia',
    text: 'Vilket år blev Sverige medlem i EU?',
    options: ['1991', '1995', '1999', '2001'],
    correctIndex: 1,
  },
  {
    id: 'his-7',
    category: 'Historia',
    text: 'Vem upptäckte Amerika 1492 (ur europeiskt perspektiv)?',
    options: ['Marco Polo', 'Vasco da Gama', 'Kristoffer Columbus', 'Magellan'],
    correctIndex: 2,
  },
  {
    id: 'his-8',
    category: 'Historia',
    text: 'Vilket krig slutade 1918?',
    options: ['Andra världskriget', 'Första världskriget', 'Koreakriget', 'Vietnamkriget'],
    correctIndex: 1,
  },
  {
    id: 'his-9',
    category: 'Historia',
    text: 'Vem var den första kvinnan i rymden?',
    options: ['Sally Ride', 'Valentina Teresjkova', 'Mae Jemison', 'Christa McAuliffe'],
    correctIndex: 1,
  },
  {
    id: 'his-10',
    category: 'Historia',
    text: 'Vilken civilisation byggde Machu Picchu?',
    options: ['Aztekerna', 'Mayafolket', 'Inkariket', 'Olmeckerna'],
    correctIndex: 2,
  },

  // Sport
  {
    id: 'spo-1',
    category: 'Sport',
    text: 'Hur många spelare har ett fotbollslag på planen?',
    options: ['9', '10', '11', '12'],
    correctIndex: 2,
  },
  {
    id: 'spo-2',
    category: 'Sport',
    text: 'I vilken sport används en puck?',
    options: ['Bandy', 'Ishockey', 'Curling', 'Fotboll'],
    correctIndex: 1,
  },
  {
    id: 'spo-3',
    category: 'Sport',
    text: 'Hur ofta arrangeras sommar-OS?',
    options: ['Varje år', 'Vartannat år', 'Vart fjärde år', 'Vart femte år'],
    correctIndex: 2,
  },
  {
    id: 'spo-4',
    category: 'Sport',
    text: 'Vilket land vann fotbolls-VM 2018?',
    options: ['Brasilien', 'Tyskland', 'Frankrike', 'Kroatien'],
    correctIndex: 2,
  },
  {
    id: 'spo-5',
    category: 'Sport',
    text: 'Hur många poäng ger en trepoängare i basket?',
    options: ['2', '3', '4', '1'],
    correctIndex: 1,
  },
  {
    id: 'spo-6',
    category: 'Sport',
    text: 'Vilken sport är Björn Borg mest känd för?',
    options: ['Golf', 'Tennis', 'Simning', 'Ishockey'],
    correctIndex: 1,
  },
  {
    id: 'spo-7',
    category: 'Sport',
    text: 'Hur lång är ett maratonlopp ungefär?',
    options: ['21 km', '32 km', '42 km', '50 km'],
    correctIndex: 2,
  },
  {
    id: 'spo-8',
    category: 'Sport',
    text: 'I vilken stad hölls OS 2012?',
    options: ['Peking', 'London', 'Rio', 'Tokyo'],
    correctIndex: 1,
  },
  {
    id: 'spo-9',
    category: 'Sport',
    text: 'Vad heter Sveriges herrlandslag i fotboll i folkmun?',
    options: ['Blågult', 'Tre Kronor', 'Kronblom', 'Nordic Lions'],
    correctIndex: 0,
  },
  {
    id: 'spo-10',
    category: 'Sport',
    text: 'Hur många set behöver man vinna för att vinna en tennis-match i Grand Slam (herrar)?',
    options: ['2', '3', '4', '5'],
    correctIndex: 1,
  },

  // Film & TV
  {
    id: 'fil-1',
    category: 'Film & TV',
    text: 'Vem regisserade filmen Titanic (1997)?',
    options: ['Steven Spielberg', 'James Cameron', 'Christopher Nolan', 'Ridley Scott'],
    correctIndex: 1,
  },
  {
    id: 'fil-2',
    category: 'Film & TV',
    text: 'Vilken skådespelare spelar Iron Man i Marvel-filmerna?',
    options: ['Chris Evans', 'Chris Hemsworth', 'Robert Downey Jr.', 'Mark Ruffalo'],
    correctIndex: 2,
  },
  {
    id: 'fil-3',
    category: 'Film & TV',
    text: 'I vilken film säger någon "I\'ll be back"?',
    options: ['Predator', 'The Terminator', 'Aliens', 'RoboCop'],
    correctIndex: 1,
  },
  {
    id: 'fil-4',
    category: 'Film & TV',
    text: 'Vilken serie utspelar sig i Westeros?',
    options: ['The Witcher', 'Game of Thrones', 'Vikings', 'The Crown'],
    correctIndex: 1,
  },
  {
    id: 'fil-5',
    category: 'Film & TV',
    text: 'Vad heter lejonungen i Lejonkungen?',
    options: ['Mufasa', 'Scar', 'Simba', 'Nala'],
    correctIndex: 2,
  },
  {
    id: 'fil-6',
    category: 'Film & TV',
    text: 'Vilken film vann Oscar för bästa film 2020 (för 2019)?',
    options: ['1917', 'Joker', 'Parasite', 'Once Upon a Time in Hollywood'],
    correctIndex: 2,
  },
  {
    id: 'fil-7',
    category: 'Film & TV',
    text: 'Vem spelar Harry Potter i filmerna?',
    options: ['Rupert Grint', 'Daniel Radcliffe', 'Tom Felton', 'Matthew Lewis'],
    correctIndex: 1,
  },
  {
    id: 'fil-8',
    category: 'Film & TV',
    text: 'Vilken svensk regissör är känd för Fanny och Alexander?',
    options: ['Lasse Hallström', 'Ingmar Bergman', 'Roy Andersson', 'Ruben Östlund'],
    correctIndex: 1,
  },
  {
    id: 'fil-9',
    category: 'Film & TV',
    text: 'I vilken film finns karaktären Jack Sparrow?',
    options: ['Caribbean Dreams', 'Pirates of the Caribbean', 'Treasure Island', 'Black Sails'],
    correctIndex: 1,
  },
  {
    id: 'fil-10',
    category: 'Film & TV',
    text: 'Vilken streaming-tjänst skapade serien Stranger Things?',
    options: ['HBO', 'Disney+', 'Netflix', 'Amazon Prime'],
    correctIndex: 2,
  },

  // Musik
  {
    id: 'mus-1',
    category: 'Musik',
    text: 'Vilket band skrev låten "Bohemian Rhapsody"?',
    options: ['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd'],
    correctIndex: 1,
  },
  {
    id: 'mus-2',
    category: 'Musik',
    text: 'Vilket svenskt band vann Eurovision 1974?',
    options: ['Roxette', 'ABBA', 'Ace of Base', 'Europe'],
    correctIndex: 1,
  },
  {
    id: 'mus-3',
    category: 'Musik',
    text: 'Hur många strängar har en standardgitarr?',
    options: ['4', '5', '6', '7'],
    correctIndex: 2,
  },
  {
    id: 'mus-4',
    category: 'Musik',
    text: 'Vem är känd som "King of Pop"?',
    options: ['Elvis Presley', 'Michael Jackson', 'Prince', 'Freddie Mercury'],
    correctIndex: 1,
  },
  {
    id: 'mus-5',
    category: 'Musik',
    text: 'Vilken artist har artistnamnet "The Weeknd"?',
    options: ['Drake', 'Abel Tesfaye', 'Justin Bieber', 'Bruno Mars'],
    correctIndex: 1,
  },
  {
    id: 'mus-6',
    category: 'Musik',
    text: 'I vilken stad ligger den berömda musikscenen Grand Ole Opry?',
    options: ['Memphis', 'Nashville', 'Austin', 'New Orleans'],
    correctIndex: 1,
  },
  {
    id: 'mus-7',
    category: 'Musik',
    text: 'Vilken svensk DJ är känd för "Levels"?',
    options: ['Swedish House Mafia', 'Avicii', 'Alesso', 'Axwell'],
    correctIndex: 1,
  },
  {
    id: 'mus-8',
    category: 'Musik',
    text: 'Vad heter Beatles-trummisen?',
    options: ['John Lennon', 'Paul McCartney', 'George Harrison', 'Ringo Starr'],
    correctIndex: 3,
  },
  {
    id: 'mus-9',
    category: 'Musik',
    text: 'Vilket instrument är Yo-Yo Ma mest känd för?',
    options: ['Violin', 'Piano', 'Cello', 'Flöjt'],
    correctIndex: 2,
  },
  {
    id: 'mus-10',
    category: 'Musik',
    text: 'Vilken låt vann Eurovision 2023 för Sverige?',
    options: ['Tattoo', 'Euphoria', 'Heroes', 'Waterloo'],
    correctIndex: 0,
  },

  // Vetenskap & Natur
  {
    id: 'sci-1',
    category: 'Vetenskap',
    text: 'Vad är kemiska beteckningen för vatten?',
    options: ['CO2', 'H2O', 'O2', 'NaCl'],
    correctIndex: 1,
  },
  {
    id: 'sci-2',
    category: 'Vetenskap',
    text: 'Vilken planet är närmast solen?',
    options: ['Venus', 'Merkurius', 'Mars', 'Jorden'],
    correctIndex: 1,
  },
  {
    id: 'sci-3',
    category: 'Vetenskap',
    text: 'Hur många ben har en vuxen människa ungefär?',
    options: ['156', '206', '256', '306'],
    correctIndex: 1,
  },
  {
    id: 'sci-4',
    category: 'Vetenskap',
    text: 'Vad kallas djur som äter både växter och kött?',
    options: ['Herbivorer', 'Karnivorer', 'Omnivorer', 'Insektivorer'],
    correctIndex: 2,
  },
  {
    id: 'sci-5',
    category: 'Vetenskap',
    text: 'Vilken gas andas växter främst in för fotosyntes?',
    options: ['Syre', 'Kväve', 'Koldioxid', 'Väte'],
    correctIndex: 2,
  },
  {
    id: 'sci-6',
    category: 'Vetenskap',
    text: 'Vad är ljusets hastighet ungefär?',
    options: ['300 000 km/s', '150 000 km/s', '30 000 km/s', '3 000 km/s'],
    correctIndex: 0,
  },
  {
    id: 'sci-7',
    category: 'Vetenskap',
    text: 'Vilket är det hårdaste naturliga materialet?',
    options: ['Stål', 'Kvarts', 'Diamant', 'Granit'],
    correctIndex: 2,
  },
  {
    id: 'sci-8',
    category: 'Vetenskap',
    text: 'Hur många planeter finns i vårt solsystem?',
    options: ['7', '8', '9', '10'],
    correctIndex: 1,
  },
  {
    id: 'sci-9',
    category: 'Vetenskap',
    text: 'Vad heter den största planeten i solsystemet?',
    options: ['Saturnus', 'Neptunus', 'Jupiter', 'Uranus'],
    correctIndex: 2,
  },
  {
    id: 'sci-10',
    category: 'Vetenskap',
    text: 'Vilken blodgrupp kan donera till alla (universell givare)?',
    options: ['A', 'B', 'AB', 'O'],
    correctIndex: 3,
  },

  // Mat & Dryck
  {
    id: 'mat-1',
    category: 'Mat & Dryck',
    text: 'Vilket land kommer sushi ursprungligen ifrån?',
    options: ['Kina', 'Korea', 'Japan', 'Thailand'],
    correctIndex: 2,
  },
  {
    id: 'mat-2',
    category: 'Mat & Dryck',
    text: 'Vad är huvudingredientet i guacamole?',
    options: ['Tomat', 'Avokado', 'Paprika', 'Lök'],
    correctIndex: 1,
  },
  {
    id: 'mat-3',
    category: 'Mat & Dryck',
    text: 'Vilken ost är typisk för pizza Margherita?',
    options: ['Cheddar', 'Mozzarella', 'Parmesan', 'Gouda'],
    correctIndex: 1,
  },
  {
    id: 'mat-4',
    category: 'Mat & Dryck',
    text: 'Från vilket land kommer tacos?',
    options: ['Spanien', 'Mexiko', 'Italien', 'Brasilien'],
    correctIndex: 1,
  },
  {
    id: 'mat-5',
    category: 'Mat & Dryck',
    text: 'Vad kallas en italiensk förrätt med bröd, tomat och basilika?',
    options: ['Bruschetta', 'Risotto', 'Gnocchi', 'Lasagne'],
    correctIndex: 0,
  },
  {
    id: 'mat-6',
    category: 'Mat & Dryck',
    text: 'Vilken frukt är en banan botaniskt sett?',
    options: ['Rotfrukt', 'Bär', 'Nöt', 'Grönsak'],
    correctIndex: 1,
  },
  {
    id: 'mat-7',
    category: 'Mat & Dryck',
    text: 'Vad är "fika" mest känt för i Sverige?',
    options: ['Middag', 'Kaffe och fikabröd', 'Frukost', 'Efterrätt efter fest'],
    correctIndex: 1,
  },
  {
    id: 'mat-8',
    category: 'Mat & Dryck',
    text: 'Vilket land är känt för Champagne?',
    options: ['Italien', 'Spanien', 'Frankrike', 'Tyskland'],
    correctIndex: 2,
  },
  {
    id: 'mat-9',
    category: 'Mat & Dryck',
    text: 'Vad gör man med pasta "al dente"?',
    options: ['Kokar den extra mjuk', 'Kokar den så den är lite tuggig', 'Steker den', 'Äter den rå'],
    correctIndex: 1,
  },
  {
    id: 'mat-10',
    category: 'Mat & Dryck',
    text: 'Vilken krydda ger saffransbullar sin gula färg?',
    options: ['Gurkmeja', 'Saffran', 'Kanel', 'Kardemumma'],
    correctIndex: 1,
  },

  // Teknik & Spel
  {
    id: 'tek-1',
    category: 'Teknik',
    text: 'Vad står förkortningen WWW för?',
    options: ['World Wide Web', 'Web World Wide', 'Wide Web World', 'Wireless Web World'],
    correctIndex: 0,
  },
  {
    id: 'tek-2',
    category: 'Teknik',
    text: 'Vilket företag skapade iPhone?',
    options: ['Google', 'Microsoft', 'Apple', 'Samsung'],
    correctIndex: 2,
  },
  {
    id: 'tek-3',
    category: 'Teknik',
    text: 'Vad heter Googles webbläsare?',
    options: ['Safari', 'Firefox', 'Edge', 'Chrome'],
    correctIndex: 3,
  },
  {
    id: 'tek-4',
    category: 'Teknik',
    text: 'Vilket år lanserades den första iPhone?',
    options: ['2005', '2007', '2009', '2010'],
    correctIndex: 1,
  },
  {
    id: 'tek-5',
    category: 'Teknik',
    text: 'Vad är "CPU" i en dator?',
    options: ['Grafikkort', 'Processor', 'Hårddisk', 'Minne'],
    correctIndex: 1,
  },
  {
    id: 'tek-6',
    category: 'Teknik',
    text: 'Vilket företag äger Instagram?',
    options: ['Google', 'Twitter', 'Meta', 'Snap'],
    correctIndex: 2,
  },
  {
    id: 'tek-7',
    category: 'Teknik',
    text: 'Vad heter det populära blockbyggarspelet från Mojang?',
    options: ['Roblox', 'Terraria', 'Minecraft', 'Fortnite'],
    correctIndex: 2,
  },
  {
    id: 'tek-8',
    category: 'Teknik',
    text: 'Vilket programmeringsspråk skapades av Brendan Eich på 10 dagar?',
    options: ['Python', 'Java', 'JavaScript', 'Ruby'],
    correctIndex: 2,
  },
  {
    id: 'tek-9',
    category: 'Teknik',
    text: 'Vad betyder "Wi-Fi" egentligen?',
    options: ['Wireless Fidelity', 'Wire Finder', 'Wide Fiber', 'Det är bara ett varumärke'],
    correctIndex: 3,
  },
  {
    id: 'tek-10',
    category: 'Teknik',
    text: 'Vilken spelkonsol tillhör Nintendo Switch?',
    options: ['Sony', 'Microsoft', 'Nintendo', 'Sega'],
    correctIndex: 2,
  },

  // Allmänbildning / Mix
  {
    id: 'mix-1',
    category: 'Allmänt',
    text: 'Hur många dagar har ett skottår?',
    options: ['364', '365', '366', '367'],
    correctIndex: 2,
  },
  {
    id: 'mix-2',
    category: 'Allmänt',
    text: 'Vilken färg får man om man blandar blått och gult?',
    options: ['Lila', 'Orange', 'Grönt', 'Brun'],
    correctIndex: 2,
  },
  {
    id: 'mix-3',
    category: 'Allmänt',
    text: 'Hur många sekunder finns i en timme?',
    options: ['60', '600', '3600', '360'],
    correctIndex: 2,
  },
  {
    id: 'mix-4',
    category: 'Allmänt',
    text: 'Vad heter den största ön i Sverige?',
    options: ['Öland', 'Gotland', 'Orust', 'Tjörn'],
    correctIndex: 1,
  },
  {
    id: 'mix-5',
    category: 'Allmänt',
    text: 'Vilket djur är Sveriges nationaldjur?',
    options: ['Älg', 'Björn', 'Varg', 'Lodjur'],
    correctIndex: 0,
  },
  {
    id: 'mix-6',
    category: 'Allmänt',
    text: 'Hur många bokstäver har det svenska alfabetet?',
    options: ['26', '28', '29', '30'],
    correctIndex: 2,
  },
  {
    id: 'mix-7',
    category: 'Allmänt',
    text: 'Vad heter den svenska nationaldagen?',
    options: ['1 maj', '6 juni', '24 juni', '13 december'],
    correctIndex: 1,
  },
  {
    id: 'mix-8',
    category: 'Allmänt',
    text: 'Vilken valuta används i Japan?',
    options: ['Won', 'Yuan', 'Yen', 'Ringgit'],
    correctIndex: 2,
  },
  {
    id: 'mix-9',
    category: 'Allmänt',
    text: 'Hur många hjärtan har en bläckfisk?',
    options: ['1', '2', '3', '4'],
    correctIndex: 2,
  },
  {
    id: 'mix-10',
    category: 'Allmänt',
    text: 'Vad kallas en grupp lejon?',
    options: ['Flock', 'Svärm', 'Pride (flock)', 'Pack'],
    correctIndex: 2,
  },
  {
    id: 'mix-11',
    category: 'Allmänt',
    text: 'Vilken månad har 28 dagar i vanliga år?',
    options: ['Bara februari', 'Alla månader', 'Januari', 'Ingen'],
    correctIndex: 1,
  },
  {
    id: 'mix-12',
    category: 'Allmänt',
    text: 'Vad är världens mest talade språk som förstaspråk?',
    options: ['Engelska', 'Spanska', 'Mandarin', 'Hindi'],
    correctIndex: 2,
  },
  {
    id: 'mix-13',
    category: 'Allmänt',
    text: 'Vilken färg har en isbjörns hud under pälsen?',
    options: ['Vit', 'Rosa', 'Svart', 'Grå'],
    correctIndex: 2,
  },
  {
    id: 'mix-14',
    category: 'Allmänt',
    text: 'Hur många minuter är en kvart?',
    options: ['10', '15', '20', '25'],
    correctIndex: 1,
  },
  {
    id: 'mix-15',
    category: 'Allmänt',
    text: 'Vad heter den svenska flaggans färger?',
    options: ['Rött och vitt', 'Blått och gult', 'Grönt och gult', 'Blått och vitt'],
    correctIndex: 1,
  },
  {
    id: 'mix-16',
    category: 'Allmänt',
    text: 'Vilket land har flest tidszoner?',
    options: ['USA', 'Ryssland', 'Frankrike', 'Kina'],
    correctIndex: 2,
  },
  {
    id: 'mix-17',
    category: 'Allmänt',
    text: 'Vad är pi ungefär lika med?',
    options: ['2,14', '3,14', '4,14', '1,41'],
    correctIndex: 1,
  },
  {
    id: 'mix-18',
    category: 'Allmänt',
    text: 'Vilken planet kallas den röda planeten?',
    options: ['Venus', 'Mars', 'Jupiter', 'Merkurius'],
    correctIndex: 1,
  },
  {
    id: 'mix-19',
    category: 'Allmänt',
    text: 'Hur många tår har en katt normalt?',
    options: ['16', '18', '20', '22'],
    correctIndex: 1,
  },
  {
    id: 'mix-20',
    category: 'Allmänt',
    text: 'Vad heter världens största däggdjur?',
    options: ['Elefant', 'Blåval', 'Giraff', 'Noshörning'],
    correctIndex: 1,
  },

  // Popkultur & mer
  {
    id: 'pop-1',
    category: 'Popkultur',
    text: 'Vilken färg är Pikachu?',
    options: ['Röd', 'Blå', 'Gul', 'Grön'],
    correctIndex: 2,
  },
  {
    id: 'pop-2',
    category: 'Popkultur',
    text: 'Vad heter Harry Potters bästa vänner?',
    options: ['Ron och Hermione', 'Neville och Luna', 'Draco och Ginny', 'Fred och George'],
    correctIndex: 0,
  },
  {
    id: 'pop-3',
    category: 'Popkultur',
    text: 'Vilken superhjälte kommer från Krypton?',
    options: ['Batman', 'Superman', 'Spider-Man', 'Wonder Woman'],
    correctIndex: 1,
  },
  {
    id: 'pop-4',
    category: 'Popkultur',
    text: 'Vad heter den blå katten i Hello Kitty? (trickfråga: Hello Kitty är…)',
    options: ['En katt', 'En hund', 'En flicka som ser ut som en katt', 'En kanin'],
    correctIndex: 2,
  },
  {
    id: 'pop-5',
    category: 'Popkultur',
    text: 'Vilket spel har block som man placerar och de försvinner i rader?',
    options: ['Pac-Man', 'Tetris', 'Snake', 'Pong'],
    correctIndex: 1,
  },
  {
    id: 'pop-6',
    category: 'Popkultur',
    text: 'Vad heter den gula Pokémonen med blixtar på kinderna?',
    options: ['Eevee', 'Pikachu', 'Meowth', 'Jigglypuff'],
    correctIndex: 1,
  },
  {
    id: 'pop-7',
    category: 'Popkultur',
    text: 'I Star Wars — vad heter den mörka sidans kraftanvändare ofta?',
    options: ['Jedi', 'Sith', 'Mandalorian', 'Clone'],
    correctIndex: 1,
  },
  {
    id: 'pop-8',
    category: 'Popkultur',
    text: 'Vilken färg är Shrek?',
    options: ['Blå', 'Lila', 'Grön', 'Orange'],
    correctIndex: 2,
  },
  {
    id: 'pop-9',
    category: 'Popkultur',
    text: 'Vad heter världens mest sålda spelkonsol genom tiderna (ungefär)?',
    options: ['PlayStation 2', 'Nintendo Switch', 'Xbox 360', 'Wii'],
    correctIndex: 0,
  },
  {
    id: 'pop-10',
    category: 'Popkultur',
    text: 'Vilken streaming-tjänst ägs av Disney?',
    options: ['Netflix', 'Disney+', 'HBO Max', 'Paramount+'],
    correctIndex: 1,
  },
]

export const QUESTIONS_SV: Question[] = [
  ...BASE_QUESTIONS,
  ...EXTRA_QUESTIONS,
  ...SV_MORE_QUESTIONS,
  ...BULK_SV_QUESTIONS,
  ...TP_SV_QUESTIONS,
]
export const QUESTIONS_EN: Question[] = [...EN_QUESTIONS, ...BULK_EN_QUESTIONS, ...TP_EN_QUESTIONS]
/** @deprecated use QUESTIONS_SV / QUESTIONS_EN */
export const QUESTIONS: Question[] = QUESTIONS_SV

const MATHISH =
  /Hur många (meter|minuter|timmar|bokstäver|dygn)|Du betalar|°F|How many (meters|minutes|hours|letters|days)|You pay |\d+\s*km\?|timmar\?|minuter\?|Vad är \d+\s*[+×x*]/i

function randInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]! % maxExclusive
  }
  return Math.floor(Math.random() * maxExclusive)
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9åäö\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMathish(q: Question): boolean {
  return q.category === 'Math' || q.category === 'Matematik' || MATHISH.test(q.text)
}

function dedupePool(pool: Question[]): Question[] {
  const seen = new Set<string>()
  const out: Question[] = []
  for (const q of shuffle(pool)) {
    const key = normalizeText(q.text)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

/** Prefer variety: round-robin across shuffled category buckets. */
function pickDiverse(pool: Question[], count: number): Question[] {
  const byCat = new Map<string, Question[]>()
  for (const q of pool) {
    const list = byCat.get(q.category) ?? []
    list.push(q)
    byCat.set(q.category, list)
  }
  const buckets = shuffle([...byCat.values()].map((list) => shuffle(list)))
  const picked: Question[] = []
  const used = new Set<string>()
  let guard = 0
  while (picked.length < count && guard < count * 50) {
    guard++
    let progressed = false
    for (const bucket of buckets) {
      while (bucket.length) {
        const next = bucket.pop()!
        if (used.has(next.id)) continue
        used.add(next.id)
        picked.push(next)
        progressed = true
        break
      }
      if (picked.length >= count) break
    }
    if (!progressed) break
  }
  return shuffle(picked)
}

function withShuffledOptions(q: Question): Question {
  const indexed = q.options.map((text, index) => ({ text, index }))
  const shuffled = shuffle(indexed)
  const correctIndex = shuffled.findIndex((o) => o.index === q.correctIndex)
  return {
    ...q,
    options: shuffled.map((o) => o.text) as [string, string, string, string],
    correctIndex: correctIndex < 0 ? 0 : correctIndex,
  }
}

export function pickQuestions(
  count: number,
  language: QuizLanguage = 'sv',
  custom: Question[] = [],
  opts: { excludeIds?: Set<string>; categories?: string[] | null } = {},
): Question[] {
  const customs = shuffle(custom).slice(0, Math.max(0, count)).map(withShuffledOptions)
  const need = Math.max(0, count - customs.length)
  if (need === 0) return shuffle(customs)

  const raw = language === 'en' ? QUESTIONS_EN : QUESTIONS_SV
  const categorySet =
    opts.categories && opts.categories.length > 0
      ? new Set(opts.categories.map((c) => c.toLowerCase()))
      : null

  let pool = dedupePool(
    raw.filter((q) => {
      if (isMathish(q)) return false
      if (!categorySet) return true
      return categorySet.has(q.category.toLowerCase())
    }),
  )

  // If a pack is too thin, fall back to the full (non-math) pool
  if (pool.length < need) {
    pool = dedupePool(raw.filter((q) => !isMathish(q)))
  }

  const exclude = opts.excludeIds ?? new Set<string>()
  const fresh = pool.filter((q) => !exclude.has(q.id))
  const primary = fresh.length >= need ? fresh : pool
  let selected = pickDiverse(primary, Math.min(need, primary.length))

  if (selected.length < need) {
    const have = new Set(selected.map((q) => q.id))
    const filler = pickDiverse(
      pool.filter((q) => !have.has(q.id)),
      need - selected.length,
    )
    selected = [...selected, ...filler]
  }

  return shuffle([...customs, ...selected.map(withShuffledOptions)])
}
