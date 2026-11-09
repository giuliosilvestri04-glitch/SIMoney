import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeApp, demoEmails, get, getApp, loginAs, type Session } from './helpers.js';

describe('Patrimonio, storico e asset allocation', () => {
  let session: Session;

  before(async () => {
    await getApp();
    const emails = await demoEmails();
    session = await loginAs(emails.client);
  });

  after(closeApp);

  it('la home del cliente arriva in una sola richiesta', async () => {
    const response = await get('/client/home', session);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.summary.totalValue > 0, 'patrimonio valorizzato');
    assert.ok(data.chart.points.length > 0, 'mini-grafico presente');
    assert.ok(Array.isArray(data.summary.allocation), 'asset allocation presente');
    assert.ok(Array.isArray(data.pendingProposals), 'proposte in attesa presenti');
    assert.ok(Array.isArray(data.recentActivity), 'attività recenti presenti');
  });

  it('il riepilogo contiene patrimonio, variazioni e composizione', async () => {
    const response = await get('/client/portfolio/summary', session);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(data.currency, 'EUR');
    assert.ok(data.totalValue > 0);
    assert.ok(data.holdingsCount > 0);
    for (const key of ['day', 'week', 'month', 'year']) {
      assert.ok(typeof data.changes[key].percent === 'number', `variazione ${key} calcolata`);
    }
    const weights = data.allocation.reduce((acc: number, slice: { weightPct: number }) => acc + slice.weightPct, 0);
    assert.ok(Math.abs(weights - 100) < 0.01, `i pesi devono sommare a 100 (ottenuto ${weights})`);
  });

  it('restituisce lo storico per tutti i periodi del selettore', async () => {
    for (const range of ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'MAX']) {
      const response = await get(`/client/portfolio/history?range=${range}`, session);
      const data = response.json().data;
      assert.equal(response.statusCode, 200, `range ${range}`);
      assert.equal(data.range, range);
      assert.ok(data.points.length > 0, `range ${range} deve avere punti`);
      assert.ok(data.from <= data.to);
    }
  });

  it('lo storico MAX è più ampio di quello a 1 mese', async () => {
    const max = (await get('/client/portfolio/history?range=MAX', session)).json().data;
    const month = (await get('/client/portfolio/history?range=1M', session)).json().data;
    assert.ok(max.sourcePoints > month.sourcePoints);
  });

  it('riduce i punti lato server per non appesantire il grafico mobile', async () => {
    const response = await get('/client/portfolio/history?range=MAX&maxPoints=60', session);
    const data = response.json().data;
    assert.ok(data.points.length <= 60, `attesi max 60 punti, ricevuti ${data.points.length}`);
    assert.ok(data.sourcePoints > data.points.length, 'il downsampling deve essere effettivo');
  });

  it('accetta un periodo personalizzato from/to', async () => {
    const max = (await get('/client/portfolio/history?range=MAX', session)).json().data;
    const from = max.points[0].date;
    const to = max.points[Math.floor(max.points.length / 2)].date;

    const response = await get(`/client/portfolio/history?from=${from}&to=${to}`, session);
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.equal(data.range, 'CUSTOM');
    assert.equal(data.from, from);
    assert.equal(data.to, to);
  });

  it('rifiuta un periodo personalizzato incoerente', async () => {
    const response = await get('/client/portfolio/history?from=2026-06-01&to=2026-01-01', session);
    assert.equal(response.statusCode, 400);
  });

  it('restituisce il patrimonio a una data specifica (calendario)', async () => {
    const history = (await get('/client/portfolio/history?range=6M', session)).json().data;
    const date = history.points[Math.floor(history.points.length / 2)].date;

    const response = await get(`/client/portfolio/snapshot?date=${date}`, session);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(data.date, date);
    assert.ok(data.totalValue > 0);
    assert.ok(data.allocation.length > 0, 'anche la composizione deve essere storicizzata');

    const weights = data.allocation.reduce((acc: number, slice: { weightPct: number }) => acc + slice.weightPct, 0);
    assert.ok(Math.abs(weights - 100) < 0.01);
  });

  it('date diverse restituiscono patrimoni diversi (storico reale, non un valore fisso)', async () => {
    const history = (await get('/client/portfolio/history?range=1Y', session)).json().data;
    const first = history.points[0].date;
    const last = history.points[history.points.length - 1].date;

    const a = (await get(`/client/portfolio/snapshot?date=${first}`, session)).json().data;
    const b = (await get(`/client/portfolio/snapshot?date=${last}`, session)).json().data;

    assert.notEqual(a.totalValue, b.totalValue);
  });

  it('valida il formato della data richiesta', async () => {
    const response = await get('/client/portfolio/snapshot?date=15-06-2026', session);
    assert.equal(response.statusCode, 400);
  });

  it('segnala una data precedente all\'apertura del rapporto', async () => {
    const response = await get('/client/portfolio/snapshot?date=1990-01-01', session);
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, 'NOT_FOUND');
  });

  it('espone le asset class come dati configurabili, non fissi nel codice', async () => {
    const response = await get('/meta/asset-classes');
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.ok(data.length >= 4, 'il sistema non è vincolato a quattro categorie');
    assert.ok(data.every((row: { key: string; colorHex: string }) => row.key && row.colorHex));
  });

  it('elenca gli investimenti con peso e P&L', async () => {
    const response = await get('/client/investments', session);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.length > 0);

    const holding = data[0];
    assert.ok(holding.instrument.isin);
    assert.ok(holding.assetClass.label);
    assert.ok(holding.marketValue > 0);
    assert.ok(typeof holding.pnlPct === 'number');

    const totalWeight = data.reduce((acc: number, row: { weightPct: number }) => acc + row.weightPct, 0);
    assert.ok(Math.abs(totalWeight - 100) < 1);
  });

  it('restituisce il dettaglio di un investimento con i movimenti collegati', async () => {
    const investments = (await get('/client/investments', session)).json().data;
    const response = await get(`/client/investments/${investments[0].id}`, session);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(data.id, investments[0].id);
    assert.ok(Array.isArray(data.movements));
  });

  it('restituisce 404 per un investimento inesistente', async () => {
    const response = await get('/client/investments/non-esiste', session);
    assert.equal(response.statusCode, 404);
  });

  it('pagina i movimenti', async () => {
    const response = await get('/client/transactions?page=1&pageSize=5', session);
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.ok(body.data.length <= 5);
    assert.equal(body.meta.pageSize, 5);
    assert.ok(body.meta.total >= body.data.length);
  });
});
