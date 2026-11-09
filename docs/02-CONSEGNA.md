# FASE 3 — Build e consegna del prototipo all'azienda

Come trasformare il progetto in qualcosa che si installa e si usa su smartphone reali.

> Il prototipo **non va pubblicato sugli store**. Tutto ciò che segue riguarda la
> distribuzione **privata** per la presentazione.

---

## 1. Cosa deve ricevere l'azienda

| # | Elemento | Formato |
|---|---|---|
| 1 | App Android | file **`.apk`** (installazione diretta) |
| 2 | App iOS | invito **TestFlight** (o build ad-hoc con UDID) |
| 3 | Ambiente demo | backend + database già popolato |
| 4 | Credenziali demo | cliente, consulente, direzione |
| 5 | Istruzioni d'uso | una pagina, non il repository |

Una cartella di progetto **non è una consegna**: nessuno in azienda compilerà il codice.

---

## 2. Decisione preliminare: dove gira il backend

L'app ha bisogno di un backend raggiungibile. Tre scenari, in ordine di impegno.

### A. Demo assistita (consigliata per la prima presentazione)

Il backend gira sul tuo portatile; gli smartphone sono sulla **stessa rete Wi-Fi**.

```bash
cd backend
npm run dev        # annota l'indirizzo di rete, es. http://192.168.1.100:4000
```

Nessun costo, nessun deploy. L'app permette di cambiare l'indirizzo dalla schermata
**Server della demo** (icona ⚙︎ nel login), quindi un cambio di rete non blocca la demo.

**Limite**: funziona solo mentre sei presente e connesso alla stessa rete.

### B. Backend su un servizio privato (per lasciare l'app in prova)

Necessario se l'azienda vuole usare l'app **dopo** l'incontro, dalla propria rete o in mobilità.

1. Pubblica il backend su un servizio a container (Railway, Render, Fly.io o una VM aziendale).
2. Imposta le variabili d'ambiente: `NODE_ENV=production`, `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET` (valori casuali), `DEMO_PASSWORD`, `DATA_PROVIDER=mock`.
3. All'avvio esegui `npm run db:push && npm run db:seed`.
4. Usa **HTTPS** e un URL non indicizzato.

> Nota tecnica: SQLite scrive su file. Su servizi con filesystem effimero serve un volume
> persistente, oppure si passa a PostgreSQL cambiando due righe (vedi `backend/README.md` §11).
> Per una demo, anche un database che si rigenera a ogni riavvio è accettabile: il seed è
> deterministico, quindi i numeri mostrati restano gli stessi.

### C. Backend sulla rete aziendale

Il reparto IT ospita il backend internamente. È lo scenario che più somiglia al futuro
passaggio a Guardian, ma richiede il loro coinvolgimento: valutalo solo se lo propongono.

---

## 3. Build Android (APK)

### Preparazione (una volta sola)

```bash
npm install -g eas-cli
eas login                    # richiede un account Expo gratuito
cd mobile
eas build:configure          # collega il progetto e crea il projectId
```

### Imposta l'indirizzo del backend

In `mobile/eas.json`, profilo `preview`:

```json
"env": { "EXPO_PUBLIC_API_URL": "https://demo-backend.example.com" }
```

(oppure l'IP locale dello scenario A). **È l'unica cosa da non dimenticare.**

### Build

```bash
eas build --platform android --profile preview
```

- La compilazione avviene sui server Expo (~10–20 minuti): non serve Android Studio.
- Il keystore di firma viene generato e conservato da EAS; alla richiesta rispondi di sì.
- Al termine ottieni un **link di download del file `.apk`**.

### Installazione sul telefono

1. Invia il link (o il file) al referente.
2. Su Android: aprire il link → scaricare → *Consenti installazione da questa origine* →
   **Installa**. Su Samsung la voce è in *Impostazioni → App → Accesso speciale →
   Installa app sconosciute*.
3. Compare l'avviso Play Protect "app non verificata": è normale per le app fuori dallo
   store → *Installa comunque*.

### Alternativa senza account Expo

```bash
cd mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

L'APK si trova in `android/app/build/outputs/apk/release/`. Richiede Android Studio e JDK
installati in locale, e una firma manuale per l'installazione su dispositivi reali.

---

## 4. Build iOS

Apple non consente di distribuire liberamente un file installabile come su Android:
**serve un account Apple Developer a pagamento** (99 $/anno). Va detto al committente subito.

### Opzione consigliata: TestFlight interno

```bash
eas build --platform ios --profile preview
eas submit --platform ios --latest
```

1. La build viene firmata con il tuo account Apple Developer (EAS gestisce i certificati).
2. `eas submit` la carica su App Store Connect.
3. In **TestFlight → Tester interni** aggiungi gli indirizzi email dei referenti.
4. Ricevono un invito: installano l'app *TestFlight* e da lì il prototipo.

La distribuzione interna non richiede la revisione di Apple (i tester esterni sì, ma è una
revisione leggera). La build scade dopo 90 giorni.

### Opzione ad-hoc

```bash
eas device:create        # registra gli UDID dei dispositivi aziendali
eas build --platform ios --profile preview
```

Genera un `.ipa` installabile **solo** sui dispositivi registrati. Più macchinoso: serve
raccogliere gli UDID in anticipo.

### Se non c'è un account Apple Developer

Per la presentazione si può mostrare l'app su un iPhone tuo (via Expo Go o dev build) e
consegnare solo l'APK Android. Da chiarire prima dell'incontro.

---

## 5. Pacchetto dell'ambiente demo

Se l'azienda vuole avviare il backend per conto proprio:

```bash
cd backend
npm install
copy .env.example .env
npm run setup      # crea il database e carica i dati dimostrativi
npm run dev
```

Requisiti: solo **Node.js 20+**. Nessun database da installare, nessuna connessione a
sistemi aziendali, nessuna credenziale Guardian.

Consegna la cartella `backend/` **senza** `node_modules/`, `prisma/dev.db` e `storage/`:
si rigenerano con `npm run setup` e i valori saranno identici (seed deterministico).

---

## 6. Prova prima della consegna

Su un dispositivo reale, con la build definitiva:

- [ ] L'app si apre e mostra la schermata di accesso
- [ ] Login con i tre account demo → si apre l'area corretta per ciascun ruolo
- [ ] Cliente: patrimonio, grafico interattivo (tieni premuto), calendario per data
- [ ] Cliente: apertura di un PDF e accettazione di una proposta
- [ ] Consulente: lista clienti, dettaglio, **creazione di una proposta**
- [ ] La proposta appena creata compare nell'app del cliente
- [ ] Direzione: dashboard, analisi, registro attività
- [ ] Spegni il backend → l'app mostra messaggi di errore comprensibili, non schermate bianche
- [ ] Riaccendi il backend → "tira per aggiornare" ripristina i dati

---

## 7. Traccia per la presentazione (10 minuti)

1. **Il problema** — la piattaforma attuale è pesante e poco adatta allo smartphone.
2. **Cliente** (3 min) — login, patrimonio in home, grafico interattivo, **il calendario che
   mostra il patrimonio a una data passata**, una proposta accettata in due tocchi.
3. **Consulente** (3 min) — dashboard, lista clienti, dettaglio, **creazione guidata di una
   proposta**; poi si torna sull'app del cliente e la proposta è già lì.
4. **Direzione** (2 min) — patrimonio aziendale, tasso di accettazione, confronto consulenti.
5. **Architettura** (2 min) — mostra `GET /api/v1/system/data-source`: l'app gira su dati
   simulati; l'integrazione con i sistemi reali è la sostituzione di **un solo componente**,
   senza toccare app né API.

Cosa dire con chiarezza: è un **prototipo dimostrativo**, i dati sono fittizi,
l'accettazione simula l'esperienza utente e **non** è una firma elettronica qualificata.

---

## 8. Costi e tempi

| Voce | Costo | Tempo |
|---|---|---|
| Build Android su EAS | gratuita (coda condivisa) | 10–20 min |
| Build iOS su EAS | gratuita, ma richiede Apple Developer | 15–30 min |
| Apple Developer Program | 99 $/anno | 24–48 h di attivazione |
| Hosting backend demo | 0–7 $/mese | 30 min di configurazione |
| Google Play / App Store | **non necessari** | — |

---

## 9. Dopo la demo: cosa serve per andare avanti

Se l'azienda decide di proseguire, gli elementi mancanti sono noti e circoscritti:

1. **Credenziali e documentazione Guardian** → si completa `backend/src/providers/guardian/`
   e si imposta `DATA_PROVIDER=guardian`. App e API restano invariate.
2. **Integrazione del sistema ufficiale di firma/accettazione** al posto della simulazione.
3. **Notifiche push** (la struttura dell'app è già compatibile: `expo-notifications`).
4. **Autenticazione aziendale** (SSO/OAuth) al posto degli account demo.
5. **Database PostgreSQL** e ambiente di esercizio.
6. **Marchio aziendale**: nome, icona e palette al posto dei segnaposto.
