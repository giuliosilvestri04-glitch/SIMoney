import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeApp, demoEmails, get, getApp, loginAs, type Session } from './helpers.js';
import { prisma } from '../lib/prisma.js';

describe('Area consulente e area direzione', () => {
  let advisorSession: Session;
  let adminSession: Session;

  before(async () => {
    await getApp();
    const emails = await demoEmails();
    advisorSession = await loginAs(emails.advisor);
    adminSession = await loginAs(emails.admin);
  });

  after(closeApp);

  // --- Consulente -----------------------------------------------------------

  it('la dashboard del consulente riassume portafoglio e attività', async () => {
    const response = await get('/advisor/dashboard', advisorSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.kpi.clients > 0);
    assert.ok(data.kpi.assetsUnderManagement > 0);
    assert.ok(data.aumChart.points.length > 0);
    assert.ok(Array.isArray(data.proposalsByStatus));
    assert.ok(Array.isArray(data.topClients));
  });

  it('la lista clienti riporta patrimonio e performance', async () => {
    const response = await get('/advisor/clients', advisorSession);
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.ok(body.data.length > 0);
    assert.ok(body.data[0].totalValue > 0);
    assert.ok(typeof body.data[0].performancePct === 'number');
    assert.ok(body.totals.assetsUnderManagement > 0);
  });

  it('ordina i clienti per patrimonio decrescente', async () => {
    const data = (await get('/advisor/clients?sort=value_desc', advisorSession)).json().data;
    for (let i = 1; i < data.length; i += 1) {
      assert.ok(data[i - 1].totalValue >= data[i].totalValue);
    }
  });

  it('cerca i clienti per nome', async () => {
    const all = (await get('/advisor/clients', advisorSession)).json().data;
    const term = all[0].name.split(' ')[1];

    const response = await get(`/advisor/clients?search=${encodeURIComponent(term)}`, advisorSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.length > 0);
    assert.ok(data.every((row: { name: string }) => row.name.toLowerCase().includes(term.toLowerCase())));
  });

  it('filtra i clienti con proposte in attesa', async () => {
    const data = (await get('/advisor/clients?onlyPendingProposals=true', advisorSession)).json().data;
    assert.ok(data.every((row: { pendingProposals: number }) => row.pendingProposals > 0));
  });

  it('apre il dettaglio di un cliente assegnato', async () => {
    const clients = (await get('/advisor/clients', advisorSession)).json().data;
    const response = await get(`/advisor/clients/${clients[0].id}`, advisorSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(data.profile.id, clients[0].id);
    assert.ok(data.summary.totalValue > 0);
    assert.ok(data.chart.points.length > 0);
  });

  it('il consulente vede storico e allocazione di un cliente assegnato', async () => {
    const clients = (await get('/advisor/clients', advisorSession)).json().data;
    const history = await get(`/advisor/clients/${clients[0].id}/portfolio/history?range=3M`, advisorSession);
    const allocation = await get(`/advisor/clients/${clients[0].id}/portfolio/allocation`, advisorSession);

    assert.equal(history.statusCode, 200);
    assert.ok(history.json().data.points.length > 0);
    assert.equal(allocation.statusCode, 200);
    assert.ok(allocation.json().data.length > 0);
  });

  // --- Direzione ------------------------------------------------------------

  it('la dashboard aziendale espone i KPI principali', async () => {
    const response = await get('/admin/analytics/overview', adminSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.kpi.assetsUnderManagement > 0, 'patrimonio complessivo');
    assert.ok(data.kpi.clients > 0, 'numero clienti');
    assert.ok(data.kpi.advisors > 0, 'numero consulenti');
    assert.ok(data.kpi.averagePortfolio > 0, 'patrimonio medio');
    assert.ok(typeof data.kpi.acceptanceRatePct === 'number', 'tasso di accettazione');
    assert.ok(data.allocation.length > 0, 'asset allocation aziendale');
    assert.ok(data.aumChart.points.length > 0, 'andamento patrimonio');
  });

  it('il patrimonio aziendale corrisponde alla somma dei clienti', async () => {
    const overview = (await get('/admin/analytics/overview', adminSession)).json().data;
    const clients = (await get('/admin/clients?pageSize=100', adminSession)).json();

    const difference = Math.abs(overview.kpi.assetsUnderManagement - clients.totals.assetsUnderManagement);
    assert.ok(difference < 1, `scostamento inatteso: ${difference}`);
  });

  it('espone il patrimonio per consulente', async () => {
    const response = await get('/admin/advisors', adminSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.length > 0);
    assert.ok(data[0].clients > 0);
    assert.ok(data[0].assetsUnderManagement > 0);
    assert.ok(typeof data[0].acceptanceRatePct === 'number');

    const share = data.reduce((acc: number, row: { shareOfCompanyPct: number }) => acc + row.shareOfCompanyPct, 0);
    assert.ok(Math.abs(share - 100) < 1, `le quote devono sommare a 100 (ottenuto ${share})`);
  });

  it('analizza le proposte: imbuto, tasso di accettazione e andamento mensile', async () => {
    const response = await get('/admin/analytics/proposals', adminSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.totals.proposals > 0);
    assert.ok(data.byStatus.length > 0);
    assert.ok(Array.isArray(data.monthly));
    assert.ok(data.totals.acceptanceRatePct >= 0 && data.totals.acceptanceRatePct <= 100);
  });

  it('espone l\'andamento del patrimonio aziendale nel tempo', async () => {
    const response = await get('/admin/analytics/aum-history?range=1Y&maxPoints=50', adminSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.points.length > 0 && data.points.length <= 50);
    assert.ok(data.max >= data.min);
  });

  it('espone il registro delle attività', async () => {
    const response = await get('/admin/audit?pageSize=10', adminSession);
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.ok(body.data.length > 0);
    assert.ok(body.data[0].action.length > 0);
    assert.ok(body.data[0].createdAt.length > 0);

    const actions = await prisma.auditLog.groupBy({ by: ['action'], _count: { action: true } });
    const tracked = new Set(actions.map((row) => row.action));
    assert.ok(tracked.has('AUTH_LOGIN_SUCCESS'), 'i login devono essere tracciati');
  });

  it('riepiloga le attività per tipo', async () => {
    const response = await get('/admin/audit/summary', adminSession);
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().data.length > 0);
  });
});
