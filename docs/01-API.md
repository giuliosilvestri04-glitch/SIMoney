# Riferimento API — Backend del prototipo

Base URL: `http://localhost:4000/api/v1`
Documentazione interattiva: `http://localhost:4000/docs` (Swagger UI, generata dagli stessi schemi che validano le richieste)

Autenticazione: `Authorization: Bearer <accessToken>`

**Formato risposte**

```json
{ "data": {}, "meta": { "page": 1, "pageSize": 20, "total": 53, "totalPages": 3, "hasNext": true } }
```

**Formato errori**

```json
{ "error": { "code": "NOT_FOUND", "message": "Proposta non trovata.", "details": null } }
```

Ogni risposta include gli header `X-Prototype: true` e `X-Data-Source: mock`.

---

## Sistema

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/health` | pubblico | Stato del servizio e del database |
| GET | `/system/data-source` | pubblico | Provider dati attivo e stato dell'integrazione Guardian |
| GET | `/meta/asset-classes` | pubblico | Categorie di asset allocation configurate (chiave, etichetta, colore, ordine, rischio) |

---

## Auth

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| POST | `/auth/login` | pubblico | Login; restituisce `user`, `accessToken`, `refreshToken` |
| POST | `/auth/refresh` | pubblico | Rinnovo con rotazione del refresh token |
| POST | `/auth/logout` | pubblico | Revoca del refresh token |
| GET | `/auth/me` | autenticato | Profilo con i dati specifici del ruolo |
| GET | `/auth/demo-accounts` | pubblico | Credenziali dimostrative (solo prototipo) |

**`POST /auth/login`**

```json
{ "email": "mario.rossi@cliente.demo.local", "password": "Demo1234!" }
```

```json
{
  "data": {
    "user": { "id": "...", "email": "...", "role": "CLIENT", "fullName": "Mario Rossi", "avatarColor": "#7C3AED" },
    "accessToken": "eyJhbGci...",
    "refreshToken": "9f2c...",
    "tokenType": "Bearer",
    "expiresIn": "30m",
    "refreshExpiresAt": "2026-10-11T19:43:39.000Z"
  }
}
```

`user.role` (`CLIENT` | `ADVISOR` | `ADMIN`) determina quale area dell'app aprire.

---

## Area CLIENTE

Nessun endpoint accetta un identificativo cliente: il perimetro è derivato dal token.

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/client/home` | **Schermata home completa in una richiesta** |
| GET | `/client/profile` | Anagrafica e consulente di riferimento |
| GET | `/client/portfolio/summary` | Patrimonio, variazioni (giorno/settimana/mese/anno), allocazione |
| GET | `/client/portfolio/history` | Evoluzione del patrimonio |
| GET | `/client/portfolio/snapshot` | **Patrimonio a una data specifica (calendario)** |
| GET | `/client/portfolio/allocation` | Asset allocation corrente o storica |
| GET | `/client/investments` | Elenco degli investimenti |
| GET | `/client/investments/:id` | Dettaglio posizione + movimenti collegati |
| GET | `/client/transactions` | Movimenti paginati |
| GET | `/client/proposals` | Proposte ricevute (filtro `status`) |
| GET | `/client/proposals/:id` | Dettaglio proposta (registra la presa visione) |
| POST | `/client/proposals/:id/accept` | **Accettazione della proposta** |
| POST | `/client/proposals/:id/reject` | **Rifiuto della proposta** |
| GET | `/client/documents` | Documenti del cliente (filtro `category`) |

### `GET /client/home`

```json
{
  "data": {
    "summary": {
      "totalValue": 308443.31, "currency": "EUR", "asOf": "2026-09-11",
      "investedValue": 259760.4, "cashValue": 48682.91,
      "pnlAbs": 52651.09, "pnlPct": 20.58,
      "changes": {
        "day":   { "absolute": 2118.44, "percent": 0.69 },
        "week":  { "absolute": 3980.11, "percent": 1.31 },
        "month": { "absolute": 9207.65, "percent": 3.08 },
        "year":  { "absolute": 49584.2, "percent": 19.16 }
      },
      "holdingsCount": 8,
      "allocation": [
        { "key": "azionario", "label": "Azionario", "colorHex": "#2563EB", "orderIndex": 1, "value": 120416.8, "weightPct": 39.04 }
      ]
    },
    "chart": { "range": "6M", "from": "2026-03-11", "to": "2026-09-11", "points": [ { "date": "2026-03-11", "totalValue": 291204.7 } ], "change": { "absolute": 17238.6, "percent": 5.92 }, "min": 285110.2, "max": 309882.4, "sourcePoints": 185 },
    "pendingProposals": [
      { "id": "prp_3", "code": "PRP-2026-0003", "title": "Ingresso graduale sui mercati obbligazionari", "amount": 42000, "status": "PENDING", "statusLabel": "In attesa", "daysToExpiry": 11, "documentsCount": 1, "advisorName": "Giulia Ferrari" }
    ],
    "counters": { "proposals": { "PENDING": 2, "ACCEPTED": 1, "REJECTED": 1, "EXPIRED": 1 }, "documents": 6 },
    "recentActivity": [ { "id": "...", "date": "2026-08-30", "type": "DIVIDEND", "amount": 412.55, "description": "Dividendo ETF MSCI World (demo)", "instrumentName": "ETF MSCI World (demo)" } ]
  }
}
```

### `GET /client/portfolio/history`

| Parametro | Valori | Default |
|---|---|---|
| `range` | `1D` `1W` `1M` `3M` `6M` `YTD` `1Y` `MAX` | `1Y` |
| `from`, `to` | `YYYY-MM-DD` (periodo personalizzato; ignorano `range`) | — |
| `maxPoints` | 2–400 — riduzione dei punti lato server | `120` |

La risposta contiene `points`, `change` (primo vs ultimo punto del periodo),
`min`, `max` e `sourcePoints` (punti giornalieri prima del downsampling).

### `GET /client/portfolio/snapshot?date=2026-06-15`

```json
{
  "data": {
    "date": "2026-06-15", "currency": "EUR",
    "totalValue": 297698.57, "investedValue": 257172.12, "cashValue": 40526.45,
    "pnlAbs": 45906.35, "pnlPct": 18.23,
    "allocation": [
      { "key": "azionario",       "label": "Azionario",       "value": 120076.17, "weightPct": 40.33 },
      { "key": "obbligazionario", "label": "Obbligazionario", "value": 77927.53,  "weightPct": 26.18 },
      { "key": "fondi",           "label": "Fondi e ETF",     "value": 44446.70,  "weightPct": 14.93 },
      { "key": "liquidita",       "label": "Liquidità",       "value": 40526.45,  "weightPct": 13.61 }
    ],
    "changeFromPreviousDay": { "absolute": -318.4, "percent": -0.11 },
    "approximated": false
  }
}
```

`approximated: true` indica che la data richiesta non aveva una rilevazione ed è
stata usata la più recente precedente. Una data anteriore all'apertura del
rapporto restituisce `404`.

### `POST /client/proposals/:id/accept`

Corpo facoltativo: `{ "note": "Procediamo pure." }`

```json
{
  "data": {
    "proposal": { "status": "ACCEPTED", "statusLabel": "Accettata", "respondedAt": "2026-09-11T19:51:02.140Z" },
    "confirmation": {
      "decision": "ACCEPTED",
      "decisionLabel": "Proposta accettata",
      "message": "La tua accettazione è stata registrata. Il consulente riceverà una notifica e procederà con le operazioni.",
      "notice": "Accettazione simulata all'interno del prototipo a scopo dimostrativo. Non costituisce firma elettronica qualificata né sostituisce il sistema ufficiale dell'azienda."
    }
  }
}
```

Errori: `409 PROPOSAL_NOT_PENDING` (già risposta), `409 PROPOSAL_EXPIRED`, `404` (non propria).

---

## Area CONSULENTE

Ogni endpoint con `:clientId` verifica che il cliente sia assegnato al consulente; in caso contrario risponde `404`.

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/advisor/dashboard` | **Dashboard completa in una richiesta** |
| GET | `/advisor/clients` | Clienti assegnati, con ricerca, filtri e ordinamento |
| GET | `/advisor/clients/:clientId` | Dettaglio cliente (profilo, patrimonio, grafico, proposte) |
| GET | `/advisor/clients/:clientId/portfolio/history` | Storico del cliente |
| GET | `/advisor/clients/:clientId/portfolio/snapshot` | Patrimonio a una data |
| GET | `/advisor/clients/:clientId/portfolio/allocation` | Asset allocation |
| GET | `/advisor/clients/:clientId/investments` | Investimenti |
| GET | `/advisor/clients/:clientId/transactions` | Movimenti |
| GET | `/advisor/clients/:clientId/proposals` | Proposte inviate al cliente |
| GET | `/advisor/clients/:clientId/documents` | Documenti del cliente |
| GET | `/advisor/proposals` | Tutte le proprie proposte (filtri `status`, `clientId`) |
| GET | `/advisor/proposals/:id` | Dettaglio proposta |
| POST | `/advisor/proposals` | **Creazione proposta** |
| GET | `/advisor/catalog/instruments` | Catalogo strumenti per il wizard |

### `GET /advisor/clients`

| Parametro | Valori |
|---|---|
| `search` | nome, cognome, email, codice cliente, città |
| `riskProfile` | `PRUDENTE` `BILANCIATO` `DINAMICO` `AGGRESSIVO` |
| `onlyPendingProposals` | `true` / `false` |
| `sort` | `value_desc` (default) `value_asc` `name_asc` `performance_desc` `performance_asc` |
| `page`, `pageSize` | paginazione |

```json
{
  "data": [
    { "id": "cli_1", "clientCode": "CLI-0001", "name": "Mario Rossi", "initials": "MR", "avatarColor": "#7C3AED",
      "city": "Milano", "riskProfile": "BILANCIATO", "totalValue": 308443.31, "currency": "EUR",
      "performancePct": 19.16, "pnlPct": 20.58, "pendingProposals": 2, "asOf": "2026-09-11" }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 7, "totalPages": 1, "hasNext": false },
  "totals": { "clients": 7, "assetsUnderManagement": 4916799.12, "currency": "EUR" }
}
```

### `POST /advisor/proposals`

```json
{
  "clientId": "cli_1",
  "title": "Ribilanciamento del portafoglio",
  "description": "Il peso della componente azionaria supera il profilo concordato...",
  "rationale": "Riduzione della concentrazione azionaria.",
  "amount": 30000,
  "expiresInDays": 21,
  "items": [
    { "instrumentId": "ins_3", "action": "BUY", "amount": 18000 },
    { "instrumentName": "Fondo Monetario Euro", "assetClassKey": "monetario", "action": "BUY", "amount": 12000 }
  ],
  "proposedAllocation": [
    { "assetClassKey": "azionario", "proposedPct": 32 },
    { "assetClassKey": "obbligazionario", "proposedPct": 30 },
    { "assetClassKey": "fondi", "proposedPct": 22 },
    { "assetClassKey": "liquidita", "proposedPct": 9 },
    { "assetClassKey": "monetario", "proposedPct": 4 },
    { "assetClassKey": "alternativi", "proposedPct": 3 }
  ],
  "attachDocument": true
}
```

Controlli applicati:

| Controllo | Esito in caso di violazione |
|---|---|
| Cliente assegnato al consulente | `404` |
| Somma delle operazioni ≈ `amount` (tolleranza 1%) | `422 UNPROCESSABLE` |
| `proposedAllocation` somma 100% (±0,5) | `422 UNPROCESSABLE` |
| `instrumentId` presente a catalogo | `400 BAD_REQUEST` |
| Campi obbligatori e formati | `400 VALIDATION_ERROR` |

Risposta `201` con la proposta completa: `items`, `allocation` (attuale vs
proposta con `deltaPct`), `documents` (scheda PDF generata automaticamente).

---

## Area DIREZIONE (boss)

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/admin/analytics/overview` | **KPI aziendali + grafici principali** |
| GET | `/admin/analytics/aum-history` | Patrimonio aziendale nel tempo |
| GET | `/admin/analytics/allocation` | Asset allocation aziendale |
| GET | `/admin/analytics/proposals` | Imbuto proposte, tasso di accettazione, andamento mensile |
| GET | `/admin/advisors` | Consulenti: clienti, patrimonio, quota, tasso di accettazione |
| GET | `/admin/clients` | Clienti dell'azienda (filtri `search`, `advisorId`, `riskProfile`) |
| GET | `/admin/clients/:clientId` | Dettaglio di un cliente |
| GET | `/admin/proposals` | Tutte le proposte (filtri `status`, `advisorId`, `clientId`) |
| GET | `/admin/proposals/:id` | Dettaglio proposta |
| GET | `/admin/audit` | Registro attività (filtri `action`, `userId`, `from`, `to`) |
| GET | `/admin/audit/summary` | Conteggi per tipo di azione (ultimi 30 giorni) |

### `GET /admin/analytics/overview`

```json
{
  "data": {
    "kpi": {
      "assetsUnderManagement": 15290429.25, "currency": "EUR",
      "clients": 20, "advisors": 5,
      "averagePortfolio": 764521.46, "clientsPerAdvisor": 4,
      "monthChangePct": 1.0, "yearChangePct": 9.03,
      "proposalsTotal": 53, "pendingProposals": 18, "acceptanceRatePct": 57.14
    },
    "aumChart": { "range": "1Y", "points": [] },
    "allocation": [ { "key": "azionario", "label": "Azionario", "value": 4677, "weightPct": 30.59 } ],
    "proposalsByStatus": [ { "status": "ACCEPTED", "label": "Accettata", "count": 16, "amount": 1842000 } ]
  }
}
```

### `GET /admin/advisors`

```json
{
  "data": [
    { "advisorId": "adv_1", "code": "CNS-001", "name": "Giulia Ferrari", "officeCity": "Milano",
      "clients": 7, "assetsUnderManagement": 4916799.12, "averagePortfolio": 702399.87,
      "shareOfCompanyPct": 32.16, "averagePerformancePct": 14.8,
      "proposals": { "accepted": 5, "rejected": 3, "pending": 6 }, "acceptanceRatePct": 62.5 }
  ]
}
```

---

## Documenti

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/documents/:id` | Metadati del documento |
| GET | `/documents/:id/file` | File PDF — `?download=true` per il salvataggio |

Il perimetro è verificato per ruolo: cliente → solo i propri, consulente → solo
quelli dei clienti assegnati, direzione → tutti. Fuori perimetro: `404`.

Nella lista documenti il campo `downloadPath` contiene già il percorso relativo
da usare nell'app (`/api/v1/documents/<id>/file`).

---

## Codici di errore

| Codice | HTTP | Significato |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Corpo o parametri non validi (`details` elenca i campi) |
| `BAD_REQUEST` | 400 | Richiesta non coerente (es. `from` successivo a `to`) |
| `INVALID_CREDENTIALS` | 401 | Email o password errati |
| `TOKEN_EXPIRED` | 401 | Access token scaduto → usare `/auth/refresh` |
| `REFRESH_INVALID` | 401 | Refresh token revocato, scaduto o già usato |
| `ACCOUNT_INACTIVE` | 401 | Utenza disattivata |
| `FORBIDDEN` | 403 | Ruolo non abilitato alla sezione |
| `NOT_FOUND` | 404 | Risorsa inesistente **o fuori dal perimetro consentito** |
| `PROPOSAL_NOT_PENDING` | 409 | Proposta già accettata/rifiutata |
| `PROPOSAL_EXPIRED` | 409 | Proposta scaduta |
| `UNPROCESSABLE` | 422 | Dati coerenti nella forma ma non nel contenuto (importi, allocazione) |
| `TOO_MANY_REQUESTS` | 429 | Limite di frequenza superato |
| `NOT_IMPLEMENTED` | 501 | Operazione del provider Guardian non ancora disponibile |
| `GUARDIAN_NOT_CONFIGURED` | 503 | Guardian selezionato ma non configurato |
| `INTERNAL_ERROR` | 500 | Errore imprevisto |

---

## Note per il futuro frontend (FASE 2)

- Salvare `accessToken` e `refreshToken` in secure storage; al `401 TOKEN_EXPIRED`
  chiamare `/auth/refresh` e ripetere la richiesta una sola volta.
- Preferire gli endpoint aggregati (`/client/home`, `/advisor/dashboard`,
  `/admin/analytics/overview`) per la prima schermata di ciascuna area.
- Usare `maxPoints` coerente con la larghezza del grafico (60–120 punti bastano
  su smartphone).
- `/meta/asset-classes` fornisce già etichette, ordine e colori: non replicarli
  nel codice dell'app.
- Gli stati delle proposte arrivano con `statusLabel` già in italiano.
- Ogni errore ha un `message` mostrabile all'utente: nessuna schermata vuota.
