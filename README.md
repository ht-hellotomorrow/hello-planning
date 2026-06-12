# Hello Planning

Strumento interno di pianificazione risorse per l'agenzia **Hello Tomorrow**. Ispirato a Hellotime, deliberatamente semplice: persone × progetti × periodi, niente task.

## Stack

- **Next.js 16** App Router + TypeScript + Tailwind v4
- **Drizzle ORM** + **Turso (libSQL)** per la persistenza
- **Airtable** come fonte di verità per i progetti (sync unidirezionale)
- **Netlify** per il deploy + Scheduled Function per il sync periodico

## Setup locale

Prerequisiti: Node 22+, npm.

1. Installa le dipendenze:
   ```bash
   npm install
   ```

2. Crea il tuo `.env.local` partendo dall'esempio:
   ```bash
   cp .env.example .env.local
   ```

   Variabili da riempire:
   - `SHARED_PASSWORD` — password aziendale unica per il login
   - `AIRTABLE_PAT` — Personal Access Token da [airtable.com/create/tokens](https://airtable.com/create/tokens) con scope `data.records:read` + `schema.bases:read`, limitato alla base `HT Control Room`
   - `CRON_SECRET` — qualunque stringa random (`openssl rand -hex 32`)
   - `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` — solo se vuoi sviluppare contro Turso. Se le lasci vuote, l'app cade su `file:./local.db`

3. Crea le tabelle:
   ```bash
   npm run db:push
   ```

4. Avvia in dev:
   ```bash
   npm run dev
   ```

5. Apri http://localhost:3000, fai login con `SHARED_PASSWORD`, premi "Sincronizza ora" per popolare i progetti.

## Concetti

**Persone** (`/persone`): nome, propic (URL), capacity in giorni a settimana. Aggiungi/edita/archivia/elimina. La cancellazione rimuove a cascata le pianificazioni della persona.

**Progetti** (sola lettura da Airtable): tre categorie con palette dedicate, scelte deterministicamente dall'id.

| Categoria | Sorgente | Palette |
|---|---|---|
| `INTERNAL` (`ht_internal`) | Airtable + flag `Internal=true` | viola |
| `EXTERNAL` (`ht_client`) | Airtable + `Internal=false` | rosso |
| `PERSONAL` (`personal`) | Creato in app | grigio + bordo tratteggiato |

**Mappatura status Airtable → visibilità**:

| Status | Comportamento |
|---|---|
| `In progress` | Attivo, pianificabile |
| `Completed`, `Awaiting final payment` | Archiviato (barre grigie sola-lettura) |
| `Proposal`, `Proposal sent`, `Lost` | Nascosto |

**Allocation segments**: una persona × un progetto × un range di settimane × giorni/settimana. I segmenti sono **variabili per periodo** (puoi avere 2.5 d/w a maggio e 2 d/w a giugno sullo stesso progetto, come segmenti adiacenti).

Sulla timeline puoi:
- **Trascinare** sull'area vuota di una riga → modale con date editabili + picker progetto + giorni/sett
- **Click sul `+`** che appare in hover sulla persona → stessa modale precompilata
- **Trascinare** il corpo di una barra → sposta nel tempo (snap al lunedì)
- **Trascinare** i bordi → resize (snap al lunedì)
- **Doppio click** su una barra → modale edit (giorni/sett, periodo)
- **Shift+click** su una barra → spezza in quel punto
- **Click destro** su una barra → elimina (con conferma)

**Capacity**: rappresenta la disponibilità per Hello Tomorrow. Le allocazioni su progetti personali si vedono ma **non contano** nel calcolo dell'overbooking (in arrivo nella Fase 6).

**Lanes**: se una persona ha più allocazioni sovrapposte nello stesso intervallo, le barre vengono distribuite in corsie verticali con un greedy interval scheduling. La riga cresce in altezza, mantenendo sempre uno strip vuoto in fondo per nuove pianificazioni.

## Deploy (Netlify)

Netlify rileva Next.js automaticamente e usa il Next.js Runtime. La Scheduled Function in [`netlify/functions/sync-projects.mts`](netlify/functions/sync-projects.mts) gira ogni 30 minuti e fa POST su `/api/sync` con l'header `x-cron-secret`.

Variabili d'ambiente da impostare sul sito Netlify (Site settings → Environment variables):

- `SHARED_PASSWORD`
- `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `AIRTABLE_PROJECTS_TABLE_ID`
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `CRON_SECRET`

## Comandi utili

```bash
npm run dev          # dev server (3000)
npm run build        # build di produzione
npm run db:push      # applica lo schema al DB
npm run db:generate  # genera nuove migrazioni
npm run db:studio    # apre Drizzle Studio (https://local.drizzle.studio)
npm run lint         # ESLint
```

## Struttura

```
src/
├─ app/
│  ├─ _components/    # client components (Timeline, modali, card, ecc.)
│  ├─ actions/        # server actions (people, allocations)
│  ├─ api/            # route handlers (auth/login, auth/logout, sync)
│  ├─ persone/        # pagina gestione persone
│  ├─ login/          # pagina login
│  └─ page.tsx        # timeline (home)
├─ db/                # schema + client Drizzle
├─ lib/               # weeks math, colors, lanes, airtable, projects-sync, auth
└─ proxy.ts           # gating cookie su tutte le route eccetto login/logout/sync

netlify/functions/    # Scheduled Function per il sync periodico
drizzle/              # migrazioni SQL generate
```
