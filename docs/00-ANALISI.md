# FASE 0 — Analisi del progetto

Prototipo di app mobile per azienda di intermediazione mobiliare.
Documento di analisi preliminare alla FASE 1 (backend).

> Il prototipo è una **simulazione dimostrativa**. Tutti i dati sono fittizi.
> Non è production-ready, non gestisce clienti reali, non implementa firma elettronica qualificata.

---

## 1. Analisi dei requisiti

### 1.1 Obiettivo
Dimostrare che l'esperienza offerta dalla piattaforma web attuale (pesante, complessa, poco moderna)
può essere sostituita/affiancata da un'app mobile **semplice, veloce, leggibile**, realmente navigabile
e funzionante, presentabile a un'azienda reale.

### 1.2 Requisiti funzionali (sintesi)

| # | Requisito | Ruolo | Fase |
|---|---|---|---|
| RF-01 | Login con determinazione automatica del ruolo | tutti | 1 |
| RF-02 | Consultazione patrimonio totale e variazione | cliente | 1 |
| RF-03 | Evoluzione del patrimonio nel tempo (1D…MAX + custom) | cliente, consulente, boss | 1 |
| RF-04 | Storico puntuale per data selezionata (calendario) | cliente, consulente | 1 |
| RF-05 | Asset allocation configurabile (non 4 categorie fisse) | tutti | 1 |
| RF-06 | Elenco e dettaglio investimenti | cliente, consulente | 1 |
| RF-07 | Movimenti / attività recenti | cliente | 1 |
| RF-08 | Proposte di investimento con 4 stati | tutti | 1 |
| RF-09 | Accettazione / rifiuto proposta (UX only) | cliente | 1 |
| RF-10 | Documenti PDF allegati, apribili e scaricabili | cliente, consulente | 1 |
| RF-11 | Gestione clienti assegnati, ricerca e filtri | consulente | 1 |
| RF-12 | Creazione proposta guidata | consulente | 1 |
| RF-13 | Dashboard analytics aziendale e KPI | boss | 1 |
| RF-14 | Audit log delle azioni sensibili | sistema | 1 |
| RF-15 | Navigazione mobile per ruolo, grafici, bottom sheet | tutti | 2 |

### 1.3 Requisiti non funzionali

| # | Requisito | Impatto sul backend |
|---|---|---|
| RNF-01 | **Indipendenza totale da Guardian** | provider astratto, default `mock`; nessuna chiamata esterna all'avvio |
| RNF-02 | Avvio del prototipo senza infrastruttura aziendale | DB file SQLite, seed deterministico, zero servizi esterni |
| RNF-03 | Leggerezza percepita dell'app | payload compatti, endpoint aggregati per schermata, no over-fetch |
| RNF-04 | Autorizzazioni lato server | ownership check nel service layer, mai fiducia negli ID del client |
| RNF-05 | Nessun segreto reale nel repository | `.env.example`, secret locali, dati fittizi |
| RNF-06 | Testabilità senza frontend | OpenAPI + Swagger UI, file `.http`, test automatici |
| RNF-07 | Sostituibilità della sorgente dati senza toccare il frontend | contratto API stabile, DTO propri, mai schema Guardian esposto |

### 1.4 Fuori scope (esplicito)
Firma elettronica qualificata, compliance MiFID reale, multi-tenant enterprise, disaster recovery,
pubblicazione sugli store, penetration test, integrazione reale Guardian.

---

## 2. Architettura generale

```
┌──────────────────────────────────────────────────────────┐
│                    APP MOBILE (FASE 2)                   │
│        React Native / Expo — Android + iOS               │
│   conosce SOLO le REST API del backend del prototipo     │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTPS / JSON  (JWT Bearer)
┌───────────────────────────▼──────────────────────────────┐
│                 BACKEND PROTOTIPO (FASE 1)               │
│                                                          │
│  HTTP layer      routes + JSON Schema + Swagger          │
│       │                                                  │
│  Access layer    autenticazione, ruoli, ownership        │
│       │                                                  │
│  Service layer   Portfolio · Proposal · Analytics · Audit│
│       │                                                  │
│  Data Provider   ◄── PUNTO DI ASTRAZIONE GUARDIAN        │
│       ├── MockDataProvider  ──► Prisma ──► SQLite        │
│       └── GuardianDataProvider (stub, non attivo)        │
└──────────────────────────────────────────────────────────┘
```

Regola architetturale fondamentale: **il Service layer non sa da dove arrivano i dati di patrimonio**.
Parla solo con l'interfaccia `PortfolioDataProvider`.

---

## 3–4. Tecnologia scelta e motivazioni

| Ambito | Scelta | Motivazione |
|---|---|---|
| Runtime | **Node.js 20+ / TypeScript** | stesso linguaggio del futuro frontend React Native → un solo skillset, tipi condivisibili; avvio immediato su qualsiasi macchina |
| Framework HTTP | **Fastify 5** | più leggero e veloce di Express, validazione JSON Schema nativa (input validato *e* documentato dallo stesso schema), plugin ufficiali per JWT/CORS/Helmet/Swagger |
| ORM | **Prisma 6** | schema dichiarativo leggibile anche da non sviluppatori, migrazioni versionate, type-safety completa, switch SQLite → PostgreSQL cambiando una riga |
| Database | **SQLite (file)** | requisito chiave: l'azienda deve poter avviare la demo senza installare nulla. Un file `.db` = demo riproducibile. Migrazione a PostgreSQL già prevista |
| Auth | **JWT access + refresh (@fastify/jwt) + bcryptjs** | stateless, standard per app mobile; bcryptjs è puro JS → nessuna compilazione nativa su Windows/macOS |
| Validazione | **JSON Schema nativo Fastify** | zero dipendenze extra, genera automaticamente l'OpenAPI: la documentazione non può divergere dal codice |
| Documentazione | **OpenAPI 3 + Swagger UI** | il backend è testabile dal browser senza frontend (requisito 34) |
| Test | **node:test + `app.inject()`** | test end-to-end HTTP senza server reale né dipendenze aggiuntive |
| PDF demo | **generatore PDF interno (0 dipendenze)** | documenti fittizi reali, apribili da mobile, senza librerie pesanti |

Alternative valutate e scartate: NestJS (boilerplate eccessivo per un prototipo), Express (validazione e
documentazione manuali), MongoDB (i dati sono fortemente relazionali), Spring Boot (stack diverso dal frontend).

**Frontend previsto per la FASE 2: React Native + Expo (dev build)** — un'unica base di codice per
Android (incluso Samsung) e iOS, build APK reale via EAS, accesso completo a gesture/safe area/date picker
nativi. Non è una web app dentro un contenitore.

---

## 5. Architettura backend (struttura a livelli)

```
backend/src/
├── app.ts                  factory Fastify (testabile via inject)
├── server.ts               bootstrap HTTP
├── config/env.ts           env tipizzato e validato all'avvio
├── plugins/                auth (JWT + guard), error handler, swagger
├── providers/              ◄── ASTRAZIONE GUARDIAN
│   ├── types.ts            interfaccia PortfolioDataProvider + DTO di dominio
│   ├── mock/               implementazione sul database del prototipo
│   ├── guardian/           implementazione stub (non attiva, non raggiunge la rete)
│   └── index.ts            factory guidata da DATA_PROVIDER
├── services/               portfolio · proposal · analytics · audit · access
├── modules/                auth · client · advisor · admin · documents · meta
└── lib/                    money, date-range, errors, pdf, rng
```

Dipendenze **a senso unico**: `modules → services → providers → database`.
Un modulo HTTP non accede mai direttamente a Prisma per i dati di patrimonio.

---

## 6–7. Modello dati, entità e relazioni

```
User (role: CLIENT | ADVISOR | ADMIN)
 ├─1:1─ Advisor ──1:N──┐
 └─1:1─ Client ◄───────┘ (advisorId)
                │
                ├─1:N─ Portfolio ─┬─1:N─ Holding ──N:1─ Instrument ──N:1─ AssetClass
                │                 ├─1:N─ PortfolioSnapshot ─1:N─ SnapshotAllocation ─N:1─ AssetClass
                │                 └─1:N─ Transaction ──N:1─ Instrument
                ├─1:N─ Proposal ─┬─1:N─ ProposalItem ──N:1─ Instrument / AssetClass
                │                ├─1:N─ ProposalAllocation ──N:1─ AssetClass
                │                └─1:N─ Document
                └─1:N─ Document

RefreshToken ──N:1── User
AuditLog ──N:1── User (nullable: login falliti)
```

| Entità | Ruolo nel dominio |
|---|---|
| `User` | identità, ruolo, credenziali |
| `Advisor` | consulente, portafoglio clienti assegnati |
| `Client` | anagrafica cliente, profilo di rischio, consulente di riferimento |
| `Portfolio` | contenitore del patrimonio del cliente |
| `AssetClass` | **categoria configurabile** (chiave, etichetta, colore, ordine, rischio) — non hard-coded |
| `Instrument` | strumento finanziario fittizio (ISIN simulato, emittente, valuta) |
| `Holding` | posizione: quantità, prezzo medio, prezzo corrente, controvalore |
| `PortfolioSnapshot` | **fotografia giornaliera** del patrimonio → base di grafico e calendario |
| `SnapshotAllocation` | composizione per asset class **a quella data** |
| `Transaction` | movimento (acquisto, vendita, cedola, dividendo, commissione, versamento) |
| `Proposal` | proposta di investimento con stato e scadenza |
| `ProposalItem` / `ProposalAllocation` | contenuto operativo e allocazione attuale vs proposta |
| `Document` | PDF fittizio (metadati + file su disco) |
| `AuditLog` | tracciamento azioni sensibili |
| `RefreshToken` | sessioni revocabili |

Nota: i valori monetari sono `REAL` arrotondati a 2 decimali da `lib/money.ts`.
In produzione si userebbero interi in centesimi o `DECIMAL` su PostgreSQL — scelta documentata e isolata.

---

## 8–9. Ruoli e autorizzazioni

| | CLIENT | ADVISOR | ADMIN (boss) |
|---|---|---|---|
| Dati propri | ✅ | ✅ | ✅ |
| Dati di un altro cliente | ❌ | solo clienti **assegnati** | ✅ (aggregati + elenchi) |
| Creare proposta | ❌ | ✅ (solo per i propri clienti) | ❌ |
| Rispondere a proposta | ✅ (solo proprie) | ❌ | ❌ |
| Analytics aziendali | ❌ | solo proprio perimetro | ✅ |
| Audit log | ❌ | ❌ | ✅ |

Enforcement su **tre livelli**:
1. **Autenticazione** — JWT valido, utente attivo.
2. **Ruolo** — guard dichiarativo sulla rotta (`requireRole`).
3. **Ownership** — `access.service.ts` risolve il perimetro dal token, **mai dal parametro di richiesta**.
   - Il cliente non ha endpoint con `:clientId`: il proprio ID viene derivato dal token → è
     strutturalmente impossibile cambiare un ID per vedere i dati altrui.
   - Il consulente su `/advisor/clients/:clientId` passa da `assertAdvisorOwnsClient()`.
   - Risorsa esistente ma non di competenza → **404**, non 403 (nessuna enumerazione).

---

## 10. Struttura API (REST, versionata `/api/v1`)

| Area | Endpoint principali |
|---|---|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `GET /auth/demo-accounts` |
| Cliente | `/client/home`, `/client/profile`, `/client/portfolio/summary`, `/portfolio/history`, `/portfolio/snapshot?date=`, `/portfolio/allocation`, `/client/investments`, `/client/transactions`, `/client/proposals`, `/client/proposals/:id/accept\|reject`, `/client/documents` |
| Consulente | `/advisor/dashboard`, `/advisor/clients`, `/advisor/clients/:id` (+ portfolio/history/snapshot/investments/proposals/documents), `/advisor/proposals`, `POST /advisor/proposals`, `/advisor/catalog/*` |
| Boss | `/admin/analytics/overview`, `/aum-history`, `/allocation`, `/advisors`, `/proposals`, `/admin/clients`, `/admin/advisors`, `/admin/audit` |
| Documenti | `GET /documents/:id`, `GET /documents/:id/file` (stream PDF inline o download) |
| Sistema | `GET /health`, `GET /meta/asset-classes`, `GET /system/data-source` |

Convenzioni: risposta `{ data, meta? }`, errori `{ error: { code, message, details? } }`,
paginazione `?page&pageSize`, date `YYYY-MM-DD`, importi numerici con `currency` esplicita.
**Endpoint "screen-oriented"** (`/client/home`, `/advisor/dashboard`): una schermata = una richiesta,
per rispettare l'obiettivo di leggerezza (RNF-03).

---

## 11. Sistema dati mock

Seed **deterministico** (PRNG con seme fisso): stesse cifre a ogni reinstallazione → demo ripetibile.

- 5 consulenti, 18 clienti, 1 boss
- 1 portafoglio per cliente, 5–9 posizioni, catalogo di ~24 strumenti
- 6 asset class configurabili (Azionario, Obbligazionario, Fondi, Liquidità, Alternativi, Monetario)
- **730 giorni di storico giornaliero per ogni portafoglio**, con allocazione per data
- serie generate con random walk + drift + volatilità per asset class + eventi di versamento
- movimenti per cliente (acquisti, vendite, cedole, commissioni, versamenti)
- proposte in tutti e 4 gli stati (in attesa, accettata, rifiutata, scaduta)
- documenti PDF reali generati durante il seed nella cartella `storage/`

---

## 12. Architettura del provider Guardian

```ts
interface PortfolioDataProvider {
  readonly name: 'mock' | 'guardian'
  isAvailable(): Promise<boolean>
  getPortfolioSummary(clientId): Promise<PortfolioSummary>
  getHistory(clientId, range): Promise<HistoryPoint[]>
  getSnapshotAt(clientId, date): Promise<PortfolioSnapshotDTO>
  getAllocation(clientId, date?): Promise<AllocationSlice[]>
  getHoldings(clientId): Promise<HoldingDTO[]>
  getTransactions(clientId, page): Promise<Paged<TransactionDTO>>
}
```

- **Oggi**: `DATA_PROVIDER=mock` → `MockDataProvider` legge dal database del prototipo.
- **Domani**: `DATA_PROVIDER=guardian` → `GuardianDataProvider` mappa le risposte Guardian negli
  **stessi DTO**. Nessun servizio, nessuna rotta, nessuna schermata dell'app cambia.
- Lo stub Guardian **non contiene endpoint inventati** e **non effettua chiamate di rete**: fallisce in
  modo esplicito se attivato senza configurazione, e non viene mai istanziato con il default.
- `GET /system/data-source` espone quale provider è attivo → durante la demo si dimostra visivamente
  che l'app gira senza Guardian.

---

## 13. Strategia dello storico

Requisito 11 (scelta di una data specifica) impone uno **storico reale simulato**, non un valore fisso.

- Granularità **giornaliera** su tutti i giorni di calendario (weekend inclusi, valori piatti) → qualunque
  data selezionata dal date picker restituisce un dato coerente.
- Ogni snapshot contiene totale, liquidità, P&L assoluto e percentuale **e** la composizione per asset class.
- Range predefiniti `1D, 1W, 1M, 3M, 6M, YTD, 1Y, MAX` + `from/to` personalizzato.
- **Downsampling lato server**: massimo ~120 punti per risposta → grafico fluido su smartphone e payload
  ridotto, indipendentemente dall'ampiezza del periodo.
- Variazione calcolata sempre rispetto al primo punto del periodo richiesto.

---

## 14–16. Flussi

**Cliente**: login → `/client/home` (patrimonio, variazione, mini-grafico, allocazione, proposte in attesa,
attività) → portafoglio (performance, allocazione, storico) → calendario per data → investimenti → dettaglio
posizione → proposte → dettaglio → documento PDF → **Accetta / Rifiuta** → conferma + stato aggiornato + audit.

**Consulente**: login → dashboard (AUM gestito, n. clienti, proposte in attesa, scadenze) → lista clienti con
ricerca/filtri → dettaglio cliente (stesse viste del cliente, in sola lettura) → **nuova proposta guidata**
(cliente → titolo → descrizione → importo → strumenti → allocazione proposta → documento → riepilogo → invio)
→ monitoraggio stati.

**Boss**: login → dashboard aziendale (AUM totale, clienti, consulenti, patrimonio medio, tasso di
accettazione) → analytics (AUM nel tempo, per consulente, allocazione aziendale, imbuto proposte) →
elenchi clienti/consulenti → audit log.

---

## 17. Struttura futura del frontend (FASE 2, non ora)

React Native + Expo, navigazione scelta in base al ruolo restituito dal login:

- **Cliente** — bottom tab: Home · Portafoglio · Proposte · Documenti · Profilo (storico e investimenti come
  schermate gerarchiche; calendario e dettagli in bottom sheet).
- **Consulente** — bottom tab: Dashboard · Clienti · Proposte · Profilo (creazione proposta a wizard modale).
- **Boss** — bottom tab: Dashboard · Analytics · Rete (clienti/consulenti) · Profilo.

Layer condivisi: client API tipizzato, TanStack Query (cache, retry, stati di caricamento/errore),
token in secure storage, gestione connessione e schermate di errore/empty state dedicate.

---

## 18. Strategia di distribuzione privata (FASE 3, non ora)

- **Android**: build APK release firmata con keystore dedicato (EAS Build profile `preview`) → consegna
  diretta del file, installabile anche su Samsung (abilitando le origini sconosciute).
- **iOS**: TestFlight interno/esterno (richiede Apple Developer Program) oppure build ad-hoc con UDID dei
  dispositivi aziendali. Non è possibile distribuire un `.ipa` liberamente come per Android: va spiegato
  al committente in anticipo.
- **Backend demo**: pacchetto con database già popolato (`npm run demo`) eseguibile in locale, oppure
  deploy privato su un singolo servizio con URL non indicizzato per la presentazione.
- Consegna finale: APK + accesso TestFlight + credenziali demo + istruzioni + documento di presentazione.

---

## 19. Criticità individuate

| # | Criticità | Mitigazione adottata |
|---|---|---|
| C-01 | Il prototipo non deve dipendere da Guardian | provider astratto + default mock + nessuna chiamata di rete all'avvio |
| C-02 | Rischio di modellare il dominio sulle API Guardian (oggi sconosciute) | DTO di dominio propri, mappatura confinata nel provider Guardian |
| C-03 | Demo poco credibile con dati piatti | storico giornaliero con volatilità per asset class e seed deterministico |
| C-04 | Grafici pesanti su smartphone con 730 punti | downsampling lato server (~120 punti max) |
| C-05 | Accesso ai dati di altri clienti cambiando un ID | nessun ID nelle rotte cliente + ownership check server-side + 404 al posto di 403 |
| C-06 | Confusione con la firma elettronica qualificata | funzionalità denominata **"Accettazione della proposta"**, disclaimer di simulazione nella risposta API |
| C-07 | Precisione monetaria con SQLite/REAL | helper di arrotondamento centralizzato, percorso di migrazione a PostgreSQL documentato |
| C-08 | Segreti nel repository | `.env.example` con placeholder, nessuna credenziale reale, dati fittizi |
| C-09 | Il prototipo potrebbe essere scambiato per un prodotto finito | header `X-Prototype: true`, endpoint `/system/data-source`, disclaimer in README e Swagger |
| C-10 | Distribuzione iOS meno immediata di Android | spiegata in anticipo (punto 18) |

---

## 20. Ordine di implementazione

**FASE 1 — Backend**
1. Scaffolding, configurazione, env validata
2. Schema Prisma + migrazione
3. Astrazione provider (interfaccia, DTO, factory, mock, stub Guardian)
4. Auth (login, refresh, logout, me) + hashing + guard di ruolo
5. Access/ownership service
6. Service: portfolio, proposal, analytics, audit
7. Rotte cliente → consulente → boss → documenti → sistema
8. Seed deterministico + generazione PDF fittizi
9. OpenAPI/Swagger + collezione `.http`
10. Test automatici (auth, autorizzazioni, storico, proposte, analytics)
11. Documentazione e credenziali demo → **STOP**

**FASE 2 — Frontend mobile** (solo dopo richiesta esplicita)
**FASE 3 — Build e consegna**
