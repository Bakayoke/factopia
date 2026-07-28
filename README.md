# Factopia

Partyquiz för sällskap — starta ett spel, dela sessionskoden, och tävla med vänner.

**Domän:** [factopia.net](https://factopia.net)

## Funktioner

- Starta nytt spel → få en fyrabokstavs **sessionskod**
- Andra går med via koden (upp till 12 spelare)
- Välj **10 / 20 / 30** frågor
- Blandade färdiga frågor med **fyra svarsalternativ**
- Poäng för rätt svar + snabbhetsbonus
- Glad vinnarskärm när quizet är klart
- Anpassar sig automatiskt till **ljust / mörkt** systemtema

## Kom igång

```bash
npm install
npm install --prefix client
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) — API/socket körs på port `3001`.

## Produktion

### Railway (API + sockets) — Redis rekommenderas

1. Skapa tjänst från GitHub-repot (Node start: `npm start`).
2. **Lägg till Redis-plugin** i samma projekt.
3. Koppla `REDIS_URL` till API-tjänsten (Railway gör det oftast auto).
4. Sätt även:
   - `PUBLIC_APP_URL=https://factopia.net`
   - `STRIPE_SECRET_KEY=sk_live_…`
5. Verifiera: `GET /api/health` → `persist.configured: true`.

Utan Redis försvinner Party-pass och rum vid restart. Alternativ: volume + `FACTOPIA_DATA_DIR=/data`.

### Cloudflare (frontend + auto-build från GitHub)

Build command i Cloudflare:

```bash
npm install && npm run build
```

Deploy command (förifyllt):

```bash
npx wrangler deploy
```

Det publicerar Vite-bygget (`client/dist`) som statisk site. **Socket.io-servern** måste hostas separat (t.ex. Railway/Render) — se nedan.

### Node-server (API + quiz-sessioner)

```bash
npm run build
npm start
```

Servern serverar då den byggda klienten på port `3001` (eller `PORT`).

## Stack

- React + Vite (klient)
- Express + Socket.io (realtid)
- TypeScript
