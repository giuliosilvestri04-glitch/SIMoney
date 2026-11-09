# Backend del prototipo — FASE 1

Backend REST del prototipo di app mobile per azienda di intermediazione mobiliare.

> **Prototipo dimostrativo.** Dati fittizi, non production-ready, non collegato ad
> alcun sistema aziendale reale. L'accettazione delle proposte simula soltanto
> l'esperienza utente e **non** è una firma elettronica qualificata.

**Funziona al 100% senza Guardian**: nessuna chiamata di rete all'avvio, nessuna
credenziale esterna, database locale già popolato.

---

## 1. Requisiti

| | |
|---|---|
| Node.js | **20.11 o superiore** (testato su Node 24) |
| npm | 9+ |
| Database | nessuna installazione: SQLite su file |

Verifica: `node -v`

---

## 2. Installazione

```bash
cd backend
npm install
cp .env.example .env     # Windows: copy .env.example .env
npm run setup            # genera il client, crea il database e carica i dati demo
```

`npm run setup` esegue in sequenza:

1. `prisma generate` — client database tipizzato
2. `prisma db push` — crea `prisma/dev.db`
3. `prisma/seed.ts` — genera consulenti, clienti, 730 giorni di storico,
   proposte in tutti gli stati e i PDF fittizi in `storage/`

Al termine il seed stampa un riepilogo e le credenziali demo.

---

## 3. Avvio

```bash
npm run dev      # sviluppo, con ricaricamento automatico
```

| | |
|---|---|
| API | http://localhost:4000/api/v1 |
| **Documentazione interattiva (Swagger)** | **http://localhost:4000/docs** |
| Stato servizio | http://localhost:4000/api/v1/health |
| Sorgente dati attiva | http://localhost:4000/api/v1/system/data-source |

Per la build compilata:

```bash
npm run build && npm start
```

Comando unico per ripartire da zero (ricrea database + dati + avvia):

```bash
npm run demo
```

### Accesso da uno smartphone reale (utile in FASE 2)

Il server ascolta su `0.0.0.0`. Dallo smartphone collegato alla **stessa rete
Wi-Fi** usare `http://<IP-del-PC>:4000` (l'IP compare nel log di avvio).
Su Windows può essere necessario consentire Node.js nel firewall.

---

## 4. Credenziali demo

Password unica per tutti gli account: **`Demo1234!`** (modificabile con `DEMO_PASSWORD`).

| Ruolo | Email | Cosa mostra |
|---|---|---|
| **CLIENTE** | `mario.rossi@cliente.demo.local` | patrimonio ~€308.000, storico biennale, proposte in attesa |
| **CONSULENTE** | `giulia.ferrari@consulente.demo.local` | 7 clienti assegnati, ~€4,9M gestiti, creazione proposte |
| **BOSS** | `direzione@demo.local` | ~€15,3M complessivi, 20 clienti, 5 consulenti, analytics |

Altri account: `GET /api/v1/auth/demo-accounts`.
Le email seguono lo schema `nome.cognome@cliente.demo.local` /
`nome.cognome@consulente.demo.local`.

---

## 5. Test

```bash
npm test
```

Crea un database di test separato (`prisma/test.db`), lo popola con un seed
ridotto ed esegue **76 test end-to-end** su:

- autenticazione (login, token errati, rotazione refresh, logout, revoca)
- **autorizzazioni** (cliente/consulente/boss, accesso incrociato negato)
- patrimonio, tutti i periodi dello storico, downsampling, calendario per data
- asset allocation (pesi che sommano a 100)
- investimenti e movimenti
- proposte: elenco, dettaglio, accettazione, rifiuto, doppia risposta, scadenza
- creazione proposta con tutte le validazioni
- analytics aziendali e coerenza degli aggregati
- documenti PDF (file realmente valido) e audit log

Altri comandi:

```bash
npm run typecheck    # controllo dei tipi
npm run db:seed      # ricarica solo i dati demo
npx prisma studio    # ispezione visuale del database
```

Test manuale delle API: `http/api.http` (VS Code + estensione *REST Client*)
oppure direttamente Swagger UI.

---

## 6. Struttura del progetto

```
backend/
├── prisma/
│   ├── schema.prisma        modello dati (14 entità)
│   └── seed.ts              generatore dei dati dimostrativi
├── scripts/test.mjs         runner dei test con database dedicato
├── http/api.http            collezione di richieste pronte all'uso
├── storage/                 PDF fittizi generati dal seed
└── src/
    ├── server.ts            bootstrap HTTP
    ├── app.ts               factory Fastify (usata anche dai test)
    ├── config/env.ts        configurazione validata all'avvio
    ├── domain/enums.ts      valori di dominio ed etichette italiane
    ├── lib/                 money · dates · rng · pdf · errors · pagination
    ├── plugins/             auth (JWT + ruoli) · error handler · swagger
    ├── providers/           ◄── ASTRAZIONE DELLA SORGENTE DATI
    │   ├── types.ts             contratto PortfolioDataProvider + DTO
    │   ├── mock/                implementazione sul database del prototipo
    │   ├── guardian/            schema per l'integrazione futura (inattivo)
    │   └── index.ts             factory guidata da DATA_PROVIDER
    ├── services/            portfolio · proposal · advisor · analytics ·
    │                        document · audit · access (autorizzazioni)
    ├── modules/             rotte: system · auth · client · advisor ·
    │                        admin · documents
    └── tests/               suite end-to-end
```

Dipendenze a senso unico: `modules → services → providers → database`.
Nessun modulo HTTP legge direttamente il database per i dati di patrimonio.

---

## 7. Architettura Guardian

Il punto di sostituzione è **uno solo**: l'interfaccia `PortfolioDataProvider`
in [`src/providers/types.ts`](src/providers/types.ts).

```
Portfolio / Analytics Service
            ↓
    PortfolioDataProvider
      ├── MockDataProvider      → database del prototipo   (ATTIVO)
      └── GuardianDataProvider  → Guardian API             (futuro)
```

Oggi:

```env
DATA_PROVIDER=mock
```

Domani, quando le API saranno disponibili:

```env
DATA_PROVIDER=guardian
GUARDIAN_BASE_URL=...
GUARDIAN_API_KEY=...
```

e va completato **solo** `src/providers/guardian/`. Servizi, rotte REST e app
mobile restano invariati, perché i DTO restituiti sono gli stessi.

Garanzie attuali:

- nessun endpoint Guardian è stato inventato;
- lo stub non esegue alcuna chiamata di rete;
- se `DATA_PROVIDER=guardian` senza configurazione, il backend **non si blocca**:
  registra un avviso e prosegue con i dati mock (la demo non può fallire);
- `GET /api/v1/system/data-source` dichiara sempre quale provider è attivo.

---

## 8. Configurazione (`.env`)

| Variabile | Default | Note |
|---|---|---|
| `PORT` / `HOST` | `4000` / `0.0.0.0` | l'host `0.0.0.0` permette l'accesso da smartphone |
| `DATABASE_URL` | `file:./dev.db` | percorso relativo a `prisma/` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | placeholder | **sostituire con valori propri** |
| `ACCESS_TOKEN_TTL` | `30m` | durata dell'access token |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | durata della sessione mobile |
| `DEMO_PASSWORD` | `Demo1234!` | password degli account demo |
| `DATA_PROVIDER` | `mock` | `mock` \| `guardian` |
| `GUARDIAN_*` | vuoto | predisposizione futura |
| `SEED_CLIENTS` / `SEED_ADVISORS` / `SEED_HISTORY_DAYS` | `20` / `5` / `730` | dimensioni del seed |
| `SEED_RANDOM_SEED` | `20260911` | cambiarlo genera uno scenario diverso ma sempre riproducibile |
| `CORS_ORIGIN` | `*` | elenco separato da virgole in alternativa |

Generare segreti robusti:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Nel repository non sono presenti password reali, chiavi Guardian o token:
`.env` è escluso dal versionamento.

---

## 9. Convenzioni delle API

Base path `/api/v1`. Autenticazione `Authorization: Bearer <accessToken>`.

**Risposta positiva**

```json
{ "data": { }, "meta": { "page": 1, "pageSize": 20, "total": 53, "totalPages": 3, "hasNext": true } }
```

**Errore**

```json
{ "error": { "code": "PROPOSAL_NOT_PENDING", "message": "La proposta risulta già \"Accettata\"...", "details": null } }
```

Codici usati dal client mobile: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`,
`TOKEN_EXPIRED`, `REFRESH_INVALID`, `ACCOUNT_INACTIVE`, `FORBIDDEN`, `NOT_FOUND`,
`PROPOSAL_NOT_PENDING`, `PROPOSAL_EXPIRED`, `UNPROCESSABLE`, `TOO_MANY_REQUESTS`,
`GUARDIAN_NOT_CONFIGURED`, `INTERNAL_ERROR`.

Elenco completo degli endpoint: [`../docs/01-API.md`](../docs/01-API.md) e Swagger UI.

---

## 10. Scelte progettuali da conoscere

- **Endpoint "screen-oriented"** (`/client/home`, `/advisor/dashboard`,
  `/admin/analytics/overview`): una schermata = una richiesta. È la scelta che
  rende l'app percepita come leggera rispetto alla piattaforma web attuale.
- **Downsampling dello storico lato server** (`maxPoints`, default 120): il
  grafico resta fluido anche su periodi di due anni.
- **Il cliente non ha endpoint con `:clientId`**: il perimetro si deriva dal
  token, quindi non è possibile vedere dati altrui modificando un identificativo.
- **404 al posto di 403** quando una risorsa esiste ma è fuori perimetro: evita
  l'enumerazione degli identificativi.
- **Proposte scadute**: allineate automaticamente a ogni lettura, senza job
  schedulati (adeguato a un prototipo).
- **Importi in virgola mobile** arrotondati da `lib/money.ts`. In produzione:
  interi in centesimi o `DECIMAL` su PostgreSQL. Punto di intervento unico.
- **Seed deterministico**: le cifre mostrate all'azienda non cambiano tra una
  reinstallazione e l'altra.

---

## 11. Passaggio a PostgreSQL (opzionale, futuro)

1. In `prisma/schema.prisma`: `provider = "postgresql"`
2. `DATABASE_URL=postgresql://...`
3. `npx prisma migrate dev && npm run db:seed`

Nessuna modifica al codice applicativo.
