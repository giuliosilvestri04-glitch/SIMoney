import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeApp, demoEmails, get, getApp, loginAs, post, type Session } from './helpers.js';
import { prisma } from '../lib/prisma.js';

describe('Proposte di investimento', () => {
  let emails: Awaited<ReturnType<typeof demoEmails>>;
  let clientSession: Session;
  let advisorSession: Session;

  before(async () => {
    await getApp();
    emails = await demoEmails();
    clientSession = await loginAs(emails.client);
    advisorSession = await loginAs(emails.advisor);
  });

  after(closeApp);

  // --- Lato cliente ---------------------------------------------------------

  it('il cliente vede le proprie proposte con stato ed etichetta leggibile', async () => {
    const response = await get('/client/proposals?pageSize=50', clientSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.length > 0, 'il seed deve prevedere proposte per il cliente demo');
    assert.ok(data.every((row: { statusLabel: string }) => row.statusLabel.length > 0));
  });

  it('il seed contiene proposte in tutti e quattro gli stati', async () => {
    const statuses = await prisma.proposal.groupBy({ by: ['status'], _count: { status: true } });
    const found = new Set(statuses.map((row) => row.status));
    for (const status of ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED']) {
      assert.ok(found.has(status), `manca lo stato ${status}`);
    }
  });

  it('filtra le proposte per stato', async () => {
    const response = await get('/client/proposals?status=PENDING', clientSession);
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.ok(data.every((row: { status: string }) => row.status === 'PENDING'));
  });

  it('il dettaglio mostra operazioni, confronto allocazione e documenti', async () => {
    const list = (await get('/client/proposals?status=PENDING', clientSession)).json().data;
    const response = await get(`/client/proposals/${list[0].id}`, clientSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.items.length > 0, 'operazioni proposte presenti');
    assert.ok(data.allocation.length > 0, 'confronto asset allocation presente');
    assert.ok(data.documents.length > 0, 'documento allegato presente');
    assert.ok(data.documents[0].downloadPath.includes('/documents/'));
    assert.ok(
      /non costituisce firma elettronica qualificata/i.test(data.simulationNotice),
      'la natura simulata deve essere dichiarata',
    );
  });

  it('la prima apertura registra la presa visione', async () => {
    const list = (await get('/client/proposals?status=PENDING', clientSession)).json().data;
    const target = list.find((row: { isRead: boolean }) => !row.isRead) ?? list[0];

    await get(`/client/proposals/${target.id}`, clientSession);

    const stored = await prisma.proposal.findUniqueOrThrow({ where: { id: target.id } });
    assert.ok(stored.viewedAt !== null);
  });

  // --- Accettazione e rifiuto ----------------------------------------------

  it('accetta una proposta e restituisce la conferma per la UI', async () => {
    const list = (await get('/client/proposals?status=PENDING&pageSize=50', clientSession)).json().data;
    const target = list[0];

    const response = await post(`/client/proposals/${target.id}/accept`, { note: 'Procediamo pure.' }, clientSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(data.proposal.status, 'ACCEPTED');
    assert.equal(data.proposal.statusLabel, 'Accettata');
    assert.equal(data.confirmation.decision, 'ACCEPTED');
    assert.ok(data.confirmation.message.length > 0);

    const stored = await prisma.proposal.findUniqueOrThrow({ where: { id: target.id } });
    assert.equal(stored.status, 'ACCEPTED');
    assert.ok(stored.respondedAt !== null);
  });

  it('impedisce di rispondere due volte alla stessa proposta', async () => {
    const accepted = await prisma.proposal.findFirstOrThrow({
      where: { status: 'ACCEPTED', client: { user: { email: emails.client } } },
    });

    const response = await post(`/client/proposals/${accepted.id}/reject`, {}, clientSession);
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, 'PROPOSAL_NOT_PENDING');
  });

  it('rifiuta una proposta registrando la nota del cliente', async () => {
    const list = (await get('/client/proposals?status=PENDING&pageSize=50', clientSession)).json().data;
    assert.ok(list.length > 0, 'serve almeno un\'altra proposta in attesa');

    const response = await post(
      `/client/proposals/${list[0].id}/reject`,
      { note: 'Preferisco attendere il prossimo trimestre.' },
      clientSession,
    );
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(data.proposal.status, 'REJECTED');
    assert.equal(data.proposal.responseNote, 'Preferisco attendere il prossimo trimestre.');
  });

  it('non permette di rispondere a una proposta scaduta', async () => {
    const expired = await prisma.proposal.findFirst({
      where: { status: 'EXPIRED', client: { user: { email: emails.client } } },
    });

    if (!expired) return; // il cliente demo potrebbe non averne: lo scenario è coperto dal seed globale

    const response = await post(`/client/proposals/${expired.id}/accept`, {}, clientSession);
    assert.equal(response.statusCode, 409);
  });

  it('registra le azioni nell\'audit log', async () => {
    const logs = await prisma.auditLog.findMany({ where: { action: 'PROPOSAL_ACCEPTED' } });
    assert.ok(logs.length > 0, 'l\'accettazione deve essere tracciata');
    assert.ok(logs[0].entityId, 'con riferimento alla proposta');
  });

  // --- Creazione lato consulente -------------------------------------------

  it('il consulente crea una proposta per un proprio cliente', async () => {
    const clients = (await get('/advisor/clients', advisorSession)).json().data;
    const instruments = (await get('/advisor/catalog/instruments', advisorSession)).json().data;
    const assetClasses = (await get('/meta/asset-classes')).json().data;

    const payload = {
      clientId: clients[0].id,
      title: 'Ribilanciamento trimestrale',
      description: 'Proposta di riallineamento del portafoglio al profilo di rischio concordato.',
      rationale: 'Riduzione della concentrazione azionaria.',
      amount: 30000,
      expiresInDays: 20,
      items: [
        { instrumentId: instruments[0].id, action: 'BUY', amount: 18000 },
        { instrumentId: instruments[1].id, action: 'BUY', amount: 12000 },
      ],
      proposedAllocation: [
        { assetClassKey: assetClasses[0].key, proposedPct: 40 },
        { assetClassKey: assetClasses[1].key, proposedPct: 35 },
        { assetClassKey: assetClasses[2].key, proposedPct: 25 },
      ],
    };

    const response = await post('/advisor/proposals', payload, advisorSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 201);
    assert.equal(data.status, 'PENDING');
    assert.ok(data.code.startsWith('PRP-'));
    assert.equal(data.items.length, 2);
    assert.equal(data.allocation.length, 3);
    assert.ok(data.documents.length === 1, 'la scheda PDF viene generata automaticamente');
  });

  it('la proposta creata arriva al cliente destinatario', async () => {
    const clients = (await get('/advisor/clients', advisorSession)).json().data;
    const target = clients[0];

    const proposals = (
      await get(`/advisor/clients/${target.id}/proposals?status=PENDING`, advisorSession)
    ).json().data;

    assert.ok(proposals.some((row: { title: string }) => row.title === 'Ribilanciamento trimestrale'));
  });

  it('rifiuta una proposta il cui importo non corrisponde alle operazioni', async () => {
    const clients = (await get('/advisor/clients', advisorSession)).json().data;

    const response = await post(
      '/advisor/proposals',
      {
        clientId: clients[0].id,
        title: 'Importi incoerenti',
        description: 'La somma delle operazioni non corrisponde all\'importo dichiarato.',
        amount: 50000,
        items: [{ instrumentName: 'Strumento demo', action: 'BUY', amount: 10000 }],
      },
      advisorSession,
    );

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().error.code, 'UNPROCESSABLE');
  });

  it('rifiuta un\'asset allocation che non somma 100%', async () => {
    const clients = (await get('/advisor/clients', advisorSession)).json().data;
    const assetClasses = (await get('/meta/asset-classes')).json().data;

    const response = await post(
      '/advisor/proposals',
      {
        clientId: clients[0].id,
        title: 'Allocazione incoerente',
        description: 'La somma delle percentuali proposte non raggiunge il 100%.',
        amount: 10000,
        items: [{ instrumentName: 'Strumento demo', action: 'BUY', amount: 10000 }],
        proposedAllocation: [
          { assetClassKey: assetClasses[0].key, proposedPct: 50 },
          { assetClassKey: assetClasses[1].key, proposedPct: 30 },
        ],
      },
      advisorSession,
    );

    assert.equal(response.statusCode, 422);
  });

  it('valida i campi obbligatori della proposta', async () => {
    const response = await post('/advisor/proposals', { title: 'Incompleta' }, advisorSession);
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'VALIDATION_ERROR');
  });
});
