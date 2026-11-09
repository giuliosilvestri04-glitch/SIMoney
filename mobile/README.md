# App mobile del prototipo — FASE 2

App mobile cross-platform (Android + iOS) del prototipo di intermediazione mobiliare.
Parla **esclusivamente** con le API del backend della FASE 1.

> **Prototipo dimostrativo.** Dati fittizi. L'accettazione delle proposte simula
> l'esperienza utente e **non** è una firma elettronica qualificata.

---

## 1. Avvio rapido

**Prerequisito: il backend deve essere in esecuzione.**

```bash
# terminale 1 — backend
cd backend
npm run dev

# terminale 2 — app
cd mobile
npm install
npx expo start
```

Poi:

- **Smartphone reale** — installa *Expo Go* (Android/iOS), inquadra il QR nel terminale.
  L'app rileva **da sola** l'indirizzo del computer e contatta la porta 4000: lo smartphone
  deve solo essere sulla **stessa rete Wi-Fi**.
- **Emulatore Android** — premi `a` · **Simulatore iOS** (solo macOS) — premi `i`.

Se il backend non risponde: dalla schermata di login, icona ⚙︎ in alto a destra →
**Server della demo** → inserisci `http://<IP-del-PC>:4000` → *Verifica connessione*.

### Credenziali demo

Password unica **`Demo1234!`**. In alternativa, nella schermata di accesso il pulsante
**"Usa un account dimostrativo"** entra con un tocco.

| Ruolo | Email |
|---|---|
| Cliente | `mario.rossi@cliente.demo.local` |
| Consulente | `giulia.ferrari@consulente.demo.local` |
| Direzione | `direzione@demo.local` |

---

## 2. Cosa mostra l'app

**Cliente** — Home (patrimonio, variazioni, mini-grafico, proposte in attesa, attività) ·
Portafoglio (grafico interattivo con 7 periodi, asset allocation a ciambella, **calendario
per data**) · Investimenti e dettaglio posizione · Movimenti per mese · Proposte con
**accettazione/rifiuto** · Documenti PDF · Profilo.

**Consulente** — Dashboard (AUM, clienti, proposte in scadenza, top clienti) · Clienti con
ricerca, filtri e ordinamento · Dettaglio cliente a schede (patrimonio, investimenti,
proposte, documenti) · **Creazione proposta guidata in 6 passi** · Profilo.

**Direzione** — Dashboard aziendale (patrimonio complessivo, clienti, consulenti, tasso di
accettazione, allocazione aggregata) · Analisi (serie storica, imbuto proposte, andamento
mensile, confronto consulenti) · Rete (consulenti e clienti) · Registro attività · Profilo.

---

## 3. Tecnologie e motivazioni

| Ambito | Scelta | Perché |
|---|---|---|
| Framework | **Expo SDK 57 / React Native 0.86** | una sola base di codice per Android (Samsung compreso) e iOS, con API native vere: non è una web app incapsulata |
| Navigazione | **expo-router** (file-based) | rotte per ruolo isolate (`app/client`, `app/advisor`, `app/admin`), transizioni native, gesto "indietro" di sistema |
| Dati | **TanStack Query** | cache condivisa, stati di caricamento/errore uniformi, ritentativi, aggiornamento al ritorno della connessione |
| Grafici | **react-native-svg**, componenti scritti su misura | nessun motore di charting da caricare all'avvio; il grafico è interattivo (mirino al tocco) e pesa poco |
| Token | **expo-secure-store** | Keychain su iOS, EncryptedSharedPreferences su Android |
| Documenti | **expo-file-system + expo-sharing** | scarico autenticato e apertura nel visualizzatore PDF nativo |
| Stile | design system interno (`src/lib/theme.ts`) | nessun colore scritto nelle schermate; tema chiaro/scuro automatico |

Niente libreria di componenti esterna: l'interfaccia è costruita su misura per restare
sobria, leggera e coerente con l'identità di un'app finanziaria.

---

## 4. Struttura

```
mobile/
├── app/                            rotte (expo-router)
│   ├── _layout.tsx                 provider + reindirizzamento per ruolo
│   ├── login.tsx                   accesso + account dimostrativi
│   ├── server.tsx                  indirizzo del backend (utile in demo)
│   ├── client/                     AREA CLIENTE
│   │   ├── (tabs)/                 home · portafoglio · proposte · documenti · profilo
│   │   ├── investments.tsx · investment/[id].tsx · transactions.tsx
│   │   └── proposal/[id].tsx       dettaglio + accettazione/rifiuto
│   ├── advisor/                    AREA CONSULENTE
│   │   ├── (tabs)/                 dashboard · clienti · proposte · profilo
│   │   ├── client/[id].tsx         dettaglio cliente a schede
│   │   ├── new-proposal.tsx        creazione guidata in 6 passi
│   │   └── proposal/[id].tsx
│   └── admin/                      AREA DIREZIONE
│       ├── (tabs)/                 dashboard · analisi · rete · profilo
│       ├── client/[id].tsx · proposal/[id].tsx · proposals.tsx · audit.tsx
└── src/
    ├── api/                        client HTTP, tipi, endpoint, hook di dati, sessione
    ├── components/
    │   ├── ui/                     testo, card, pulsanti, badge, campi, bottom sheet, stati
    │   ├── charts/                 LineChart · DonutChart · BarChart
    │   └── domain/                 grafico patrimonio, allocazione, calendario, liste
    ├── lib/                        tema, formattazione italiana, autenticazione, documenti
    └── scripts/                    generatore icone, verifica contratto API
```

---

## 5. Scelte di prodotto rilevanti

- **Una schermata = una richiesta.** Home, dashboard consulente e dashboard direzione usano
  gli endpoint aggregati del backend. È il motivo principale per cui l'app risulta più
  reattiva della piattaforma web attuale.
- **Caricamento a schede.** Nel dettaglio cliente i dati di ogni scheda si richiedono solo
  quando la scheda viene aperta: aprire un cliente costa una richiesta, non sei.
- **Grafico alleggerito lato server.** Il parametro `maxPoints` riduce due anni di storico a
  ~120 punti: curva identica, payload e rendering minimi.
- **Il ruolo decide la navigazione.** Dopo il login l'app apre l'area corretta; un utente non
  può trovarsi nell'area di un altro ruolo (e comunque il backend rifiuterebbe i dati).
- **Mai una schermata vuota.** Ogni vista ha caricamento (scheletri), errore con messaggio in
  italiano e possibilità di riprovare, e stato vuoto. Un banner segnala l'assenza di rete.
- **Aree toccabili ampie**: pulsanti da 48–56 px, righe da 44 px, azioni principali in basso.
- **Tema chiaro/scuro** automatico secondo l'impostazione del telefono.
- **Cifre con tabular numbers** e formattazione italiana (`€ 308.443,31`, `+19,16%`).

---

## 6. Comandi

```bash
npx expo start            # avvia in sviluppo
npm run typecheck         # controllo dei tipi
npm run bundle:check      # verifica che l'app compili davvero (bundle Metro)
npm run assets            # rigenera icone e splash
npx expo-doctor           # diagnostica del progetto

# verifica che backend e app siano allineati (backend avviato)
node scripts/check-api-contract.mjs
node scripts/check-api-contract.mjs http://192.168.1.100:4000
```

`check-api-contract.mjs` esegue le stesse chiamate delle schermate e controlla i campi
realmente letti dalla UI: intercetta una modifica del backend che romperebbe l'app senza
dover aprire l'emulatore.

---

## 7. Build per la consegna

Istruzioni complete: [`../docs/02-CONSEGNA.md`](../docs/02-CONSEGNA.md).

In sintesi:

```bash
npm install -g eas-cli && eas login
eas build:configure

# imposta prima EXPO_PUBLIC_API_URL nel profilo "preview" di eas.json
eas build --platform android --profile preview   # → file .apk da inviare
eas build --platform ios --profile preview       # → TestFlight / ad-hoc
```

> L'indirizzo del backend nelle build viene da `EXPO_PUBLIC_API_URL` (in `eas.json`).
> Se non è raggiungibile, l'app resta comunque utilizzabile: la schermata **Server della
> demo** permette di cambiarlo al volo durante la presentazione.

---

## 8. Note

- L'app si chiama **SIMoney** (nome visibile sul telefono e nella schermata di accesso).
  L'icona (marchio blu generato da `npm run assets`) resta un segnaposto: si sostituisce con
  il logo aziendale fornendo i file in `assets/`.
- `.npmrc` imposta `legacy-peer-deps=true`: serve a risolvere un conflitto fra le versioni
  di peer dependency dichiarate da alcuni pacchetti Expo 57.
- Nessuna credenziale o segreto nel codice: i token stanno solo nello storage cifrato del
  dispositivo.
