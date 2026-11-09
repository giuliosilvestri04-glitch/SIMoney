import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeApp, demoEmails, get, getApp, loginAs, post } from './helpers.js';
import { prisma } from '../lib/prisma.js';

/**
 * Requisito 26: il controllo dei permessi avviene sul backend e non deve essere
 * aggirabile cambiando un identificativo nella richiesta.
 */
describe('Autorizzazioni e perimetro dati', () => {
  let emails: Awaited<ReturnType<typeof demoEmails>>;

  before(async () => {
    await getApp();
    emails = await demoEmails();
  });

  after(closeApp);

  it('il cliente non può entrare nell\'area consulente', async () => {
    const session = await loginAs(emails.client);
    const response = await get('/advisor/dashboard', session);
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, 'FORBIDDEN');
  });

  it('il cliente non può entrare nell\'area direzione', async () => {
    const session = await loginAs(emails.client);
    const response = await get('/admin/analytics/overview', session);
    assert.equal(response.statusCode, 403);
  });

  it('il consulente non può leggere le analytics aziendali', async () => {
    const session = await loginAs(emails.advisor);
    const response = await get('/admin/analytics/overview', session);
    assert.equal(response.statusCode, 403);
  });

  it('il consulente non può leggere l\'audit log', async () => {
    const session = await loginAs(emails.advisor);
    const response = await get('/admin/audit', session);
    assert.equal(response.statusCode, 403);
  });

  it('il consulente vede SOLO i clienti assegnati', async () => {
    const session = await loginAs(emails.advisor);
    const advisor = await prisma.advisor.findFirstOrThrow({ where: { user: { email: emails.advisor } } });

    const response = await get('/advisor/clients?pageSize=100', session);
    const ids = response.json().data.map((row: { id: string }) => row.id);

    const expected = await prisma.client.findMany({ where: { advisorId: advisor.id }, select: { id: true } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(new Set(ids), new Set(expected.map((client) => client.id)));
  });

  it('il consulente riceve 404 sul cliente di un altro consulente (nessuna enumerazione)', async () => {
    const session = await loginAs(emails.advisor);
    const advisor = await prisma.advisor.findFirstOrThrow({ where: { user: { email: emails.advisor } } });

    const foreignClient = await prisma.client.findFirst({ where: { advisorId: { not: advisor.id } } });
    assert.ok(foreignClient, 'il seed deve contenere clienti di altri consulenti');

    const response = await get(`/advisor/clients/${foreignClient.id}`, session);
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, 'NOT_FOUND');
  });

  it('il consulente non può leggere il portafoglio di un cliente non suo', async () => {
    const session = await loginAs(emails.advisor);
    const advisor = await prisma.advisor.findFirstOrThrow({ where: { user: { email: emails.advisor } } });
    const foreignClient = await prisma.client.findFirstOrThrow({ where: { advisorId: { not: advisor.id } } });

    const response = await get(`/advisor/clients/${foreignClient.id}/investments`, session);
    assert.equal(response.statusCode, 404);
  });

  it('il consulente non può creare una proposta per un cliente non suo', async () => {
    const session = await loginAs(emails.advisor);
    const advisor = await prisma.advisor.findFirstOrThrow({ where: { user: { email: emails.advisor } } });
    const foreignClient = await prisma.client.findFirstOrThrow({ where: { advisorId: { not: advisor.id } } });

    const response = await post(
      '/advisor/proposals',
      {
        clientId: foreignClient.id,
        title: 'Tentativo non autorizzato',
        description: 'Questa proposta non deve essere creata dal sistema.',
        amount: 10000,
        items: [{ instrumentName: 'Strumento', action: 'BUY', amount: 10000 }],
      },
      session,
    );

    assert.equal(response.statusCode, 404);
  });

  it('il cliente non può leggere la proposta di un altro cliente', async () => {
    const session = await loginAs(emails.client);
    const me = await prisma.user.findFirstOrThrow({ where: { email: emails.client }, include: { client: true } });

    const foreignProposal = await prisma.proposal.findFirstOrThrow({
      where: { clientId: { not: me.client!.id } },
    });

    const response = await get(`/client/proposals/${foreignProposal.id}`, session);
    assert.equal(response.statusCode, 404);
  });

  it('il cliente non può rispondere alla proposta di un altro cliente', async () => {
    const session = await loginAs(emails.client);
    const me = await prisma.user.findFirstOrThrow({ where: { email: emails.client }, include: { client: true } });

    const foreignProposal = await prisma.proposal.findFirstOrThrow({
      where: { clientId: { not: me.client!.id }, status: 'PENDING' },
    });

    const response = await post(`/client/proposals/${foreignProposal.id}/accept`, {}, session);
    assert.equal(response.statusCode, 404);

    const unchanged = await prisma.proposal.findUniqueOrThrow({ where: { id: foreignProposal.id } });
    assert.equal(unchanged.status, 'PENDING', 'lo stato non deve essere stato modificato');
  });

  it('il cliente non può leggere i documenti di un altro cliente', async () => {
    const session = await loginAs(emails.client);
    const me = await prisma.user.findFirstOrThrow({ where: { email: emails.client }, include: { client: true } });

    const foreignDocument = await prisma.document.findFirstOrThrow({
      where: { clientId: { not: me.client!.id } },
    });

    const metadata = await get(`/documents/${foreignDocument.id}`, session);
    const file = await get(`/documents/${foreignDocument.id}/file`, session);
    assert.equal(metadata.statusCode, 404);
    assert.equal(file.statusCode, 404);
  });

  it('la direzione può consultare qualsiasi cliente', async () => {
    const session = await loginAs(emails.admin);
    const client = await prisma.client.findFirstOrThrow();
    const response = await get(`/admin/clients/${client.id}`, session);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.profile.id, client.id);
  });
});
