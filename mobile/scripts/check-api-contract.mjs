/**
 * Verifica del contratto API fra app e backend.
 *
 * Esegue le stesse chiamate che fanno le schermate e controlla che siano
 * presenti ESATTAMENTE i campi letti dalla UI. Serve a intercettare una
 * modifica del backend che romperebbe l'app, senza dover aprire l'emulatore.
 *
 * Uso:  node scripts/check-api-contract.mjs [http://localhost:4000]
 */

const BASE = (process.argv[2] ?? 'http://localhost:4000').replace(/\/+$/, '');
const API = `${BASE}/api/v1`;
const PASSWORD = 'Demo1234!';

let failures = 0;
let checks = 0;

function check(label, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Verifica che un oggetto contenga tutti i percorsi indicati (notazione "a.b.c"). */
function hasFields(object, paths) {
  return paths.filter((path) => {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), object);
    return value === undefined;
  });
}

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

async function login(email) {
  const { status, json } = await call('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  if (status !== 200) throw new Error(`Login fallito per ${email}: ${status}`);
  return json.data;
}

async function main() {
  console.log(`\nVerifica del contratto API su ${BASE}\n`);

  const health = await call('/health');
  if (health.status !== 200) {
    console.error(`Backend non raggiungibile su ${BASE}. Avvialo con "npm run dev" nella cartella backend.`);
    process.exit(1);
  }

  const demo = await call('/auth/demo-accounts');
  const accounts = demo.json.data.accounts;
  const clientAccounts = accounts.filter((a) => a.role === 'CLIENT');
  const clientEmail = clientAccounts[0].email;
  const advisorEmail = accounts.find((a) => a.role === 'ADVISOR').email;
  const adminEmail = accounts.find((a) => a.role === 'ADMIN').email;

  // ---------------------------------------------------------------- CLIENTE
  console.log('AREA CLIENTE');
  const client = await login(clientEmail);
  check('login restituisce ruolo e token', client.user.role === 'CLIENT' && Boolean(client.accessToken));
  const ct = client.accessToken;

  const home = (await call('/client/home', { token: ct })).json.data;
  check(
    'home: campi usati dalla schermata',
    hasFields(home, [
      'summary.totalValue',
      'summary.currency',
      'summary.investedValue',
      'summary.cashValue',
      'summary.holdingsCount',
      'summary.changes.day.percent',
      'summary.changes.year.absolute',
      'summary.allocation',
      'chart.points',
      'chart.change.percent',
      'counters.documents',
      'pendingProposals',
      'recentActivity',
    ]).length === 0,
    hasFields(home, ['summary.totalValue']).join(', '),
  );
  check('home: allocazione con etichetta e colore', home.summary.allocation.every((s) => s.label && s.colorHex));
  check('home: i pesi sommano a 100', Math.abs(home.summary.allocation.reduce((t, s) => t + s.weightPct, 0) - 100) < 0.02);
  check('home: punti del grafico con data e valore', home.chart.points.every((p) => p.date && typeof p.totalValue === 'number'));

  for (const range of ['1D', '1W', '1M', '3M', '6M', '1Y', 'MAX']) {
    const history = (await call(`/client/portfolio/history?range=${range}&maxPoints=120`, { token: ct })).json.data;
    check(`storico ${range}: punti e variazione`, history.points.length > 0 && typeof history.change.percent === 'number');
  }

  const maxHistory = (await call('/client/portfolio/history?range=MAX&maxPoints=2', { token: ct })).json.data;
  check('storico MAX limitato a 2 punti (downsampling)', maxHistory.points.length <= 2 && maxHistory.sourcePoints > 2);

  const someDate = (await call('/client/portfolio/history?range=6M', { token: ct })).json.data.points[3].date;
  const snapshot = (await call(`/client/portfolio/snapshot?date=${someDate}`, { token: ct })).json.data;
  check(
    'snapshot per data: totale e composizione',
    hasFields(snapshot, ['date', 'totalValue', 'investedValue', 'cashValue', 'allocation', 'approximated']).length === 0,
  );
  check('snapshot: allocazione valorizzata', snapshot.allocation.every((s) => typeof s.value === 'number'));

  const investments = (await call('/client/investments', { token: ct })).json.data;
  check(
    'investimenti: campi della riga e del dettaglio',
    investments.length > 0 &&
      hasFields(investments[0], [
        'instrument.name',
        'instrument.isin',
        'instrument.currency',
        'assetClass.label',
        'assetClass.colorHex',
        'marketValue',
        'weightPct',
        'pnlPct',
        'quantity',
        'avgPrice',
        'currentPrice',
        'openedAt',
      ]).length === 0,
  );

  const investment = (await call(`/client/investments/${investments[0].id}`, { token: ct })).json.data;
  check('dettaglio investimento: movimenti collegati', Array.isArray(investment.movements));

  const transactions = (await call('/client/transactions?page=1&pageSize=40', { token: ct })).json;
  check('movimenti: elenco e paginazione', Array.isArray(transactions.data) && typeof transactions.meta.total === 'number');

  const proposals = (await call('/client/proposals?pageSize=50', { token: ct })).json;
  check('proposte: elenco con stato ed etichetta', proposals.data.every((p) => p.status && p.statusLabel));

  // Il primo account cliente dell'elenco demo è quello "vetrina": deve avere
  // uno scenario completo, proposta in attesa compresa.
  const pending = proposals.data.find((p) => p.status === 'PENDING');
  check(
    'il primo account cliente demo ha una proposta in attesa',
    Boolean(pending),
    `account usato: ${clientEmail}`,
  );

  if (pending) {
    const detail = (await call(`/client/proposals/${pending.id}`, { token: ct })).json.data;
    check(
      'dettaglio proposta: sezioni mostrate dalla schermata',
      hasFields(detail, ['description', 'items', 'allocation', 'documents', 'simulationNotice', 'advisorContact.email'])
        .length === 0,
    );
    check('dettaglio proposta: confronto allocazione con delta', detail.allocation.every((a) => typeof a.deltaPct === 'number'));
    check('dettaglio proposta: avviso di simulazione presente', /firma elettronica qualificata/i.test(detail.simulationNotice));
  }

  const documents = (await call('/client/documents', { token: ct })).json.data;
  check(
    'documenti: metadati e percorso di download',
    documents.length > 0 && documents.every((d) => d.downloadPath.startsWith('/api/v1/documents/') && d.sizeLabel),
  );

  const file = await fetch(`${BASE}${documents[0].downloadPath}`, { headers: { Authorization: `Bearer ${ct}` } });
  const buffer = Buffer.from(await file.arrayBuffer());
  check('download PDF autenticato: file valido', file.status === 200 && buffer.subarray(0, 5).toString('latin1') === '%PDF-');

  // -------------------------------------------------------------- CONSULENTE
  console.log('\nAREA CONSULENTE');
  const advisor = await login(advisorEmail);
  const at = advisor.accessToken;

  const dashboard = (await call('/advisor/dashboard', { token: at })).json.data;
  check(
    'dashboard: KPI e grafici',
    hasFields(dashboard, [
      'advisor.name',
      'kpi.clients',
      'kpi.assetsUnderManagement',
      'kpi.averagePortfolio',
      'kpi.pendingProposals',
      'kpi.acceptanceRatePct',
      'aumChart.points',
      'proposalsByStatus',
      'topClients',
      'recentProposals',
      'expiringSoon',
    ]).length === 0,
  );

  const clients = (await call('/advisor/clients?sort=value_desc&pageSize=50', { token: at })).json;
  check(
    'lista clienti: campi della riga',
    clients.data.length > 0 &&
      hasFields(clients.data[0], [
        'name',
        'clientCode',
        'city',
        'riskProfile',
        'avatarColor',
        'initials',
        'totalValue',
        'currency',
        'performancePct',
        'pendingProposals',
      ]).length === 0,
  );
  check('lista clienti: totali per l\'intestazione', typeof clients.totals?.assetsUnderManagement === 'number');

  const firstClient = clients.data[0].id;
  const overview = (await call(`/advisor/clients/${firstClient}`, { token: at })).json.data;
  check(
    'dettaglio cliente: profilo, patrimonio e grafico',
    hasFields(overview, ['profile.fullName', 'profile.clientCode', 'profile.advisor.name', 'summary.totalValue', 'chart.points', 'documentsCount'])
      .length === 0,
  );

  const clientInvestments = (await call(`/advisor/clients/${firstClient}/investments`, { token: at })).json.data;
  check('dettaglio cliente: investimenti', Array.isArray(clientInvestments));

  const catalog = (await call('/advisor/catalog/instruments', { token: at })).json.data;
  check(
    'catalogo strumenti per il wizard',
    catalog.length > 0 && catalog.every((i) => i.id && i.name && i.assetClass?.key && i.assetClass?.colorHex),
  );

  const assetClasses = (await call('/meta/asset-classes', { token: at })).json.data;
  check('asset class configurabili', assetClasses.length >= 4 && assetClasses.every((a) => a.key && a.label && a.colorHex));

  // Creazione proposta con lo stesso corpo inviato dal wizard.
  const amount = 24000;
  const created = (
    await call('/advisor/proposals', {
      token: at,
      method: 'POST',
      body: {
        clientId: firstClient,
        title: 'Verifica contratto API',
        description: 'Proposta creata dalla verifica automatica del contratto fra app e backend.',
        amount,
        expiresInDays: 14,
        items: [
          { instrumentId: catalog[0].id, action: 'BUY', amount: 14000 },
          { instrumentId: catalog[1].id, action: 'BUY', amount: 10000 },
        ],
        proposedAllocation: assetClasses.slice(0, 3).map((a, index) => ({
          assetClassKey: a.key,
          proposedPct: index === 0 ? 40 : 30,
        })),
        attachDocument: true,
      },
    })
  ).json;
  check('creazione proposta: risposta con codice e documento', created.data?.code?.startsWith('PRP-') && created.data.documents.length === 1);

  // --------------------------------------------------------------- DIREZIONE
  console.log('\nAREA DIREZIONE');
  const admin = await login(adminEmail);
  const mt = admin.accessToken;

  const company = (await call('/admin/analytics/overview', { token: mt })).json.data;
  check(
    'dashboard aziendale: KPI',
    hasFields(company, [
      'kpi.assetsUnderManagement',
      'kpi.clients',
      'kpi.advisors',
      'kpi.averagePortfolio',
      'kpi.clientsPerAdvisor',
      'kpi.monthChangePct',
      'kpi.yearChangePct',
      'kpi.acceptanceRatePct',
      'aumChart.points',
      'allocation',
      'proposalsByStatus',
    ]).length === 0,
  );

  const analytics = (await call('/admin/analytics/proposals', { token: mt })).json.data;
  check(
    'analisi proposte: totali, stati e mensile',
    hasFields(analytics, ['totals.proposals', 'totals.acceptanceRatePct', 'totals.averageResponseHours', 'byStatus', 'monthly'])
      .length === 0,
  );

  const advisors = (await call('/admin/advisors', { token: mt })).json.data;
  check(
    'consulenti: confronto della rete',
    advisors.length > 0 &&
      hasFields(advisors[0], ['name', 'clients', 'assetsUnderManagement', 'shareOfCompanyPct', 'acceptanceRatePct', 'proposals.accepted'])
        .length === 0,
  );

  const audit = (await call('/admin/audit?pageSize=30', { token: mt })).json;
  check('audit: voci con attore e data', audit.data.length > 0 && audit.data.every((e) => e.action && e.createdAt && e.actor));

  // ------------------------------------------------------------ SICUREZZA
  console.log('\nCONTROLLI DI PERIMETRO');
  const forbidden = await call('/advisor/dashboard', { token: ct });
  check('il cliente non accede all\'area consulente', forbidden.status === 403);

  const adminForbidden = await call('/admin/analytics/overview', { token: at });
  check('il consulente non accede alle analisi aziendali', adminForbidden.status === 403);

  const unauthenticated = await call('/client/home');
  check('senza token la risposta è 401', unauthenticated.status === 401);

  console.log(`\n${checks - failures}/${checks} verifiche superate.`);
  if (failures > 0) {
    console.log('Alcune verifiche non sono passate: il contratto fra app e backend è disallineato.\n');
    process.exit(1);
  }
  console.log('Contratto allineato: l\'app può consumare il backend così com\'è.\n');
}

main().catch((error) => {
  console.error('\nVerifica interrotta:', error.message);
  process.exit(1);
});
