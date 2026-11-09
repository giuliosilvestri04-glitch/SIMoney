import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeApp, demoEmails, get, getApp, loginAs, type Session } from './helpers.js';

describe('Documenti', () => {
  let clientSession: Session;

  before(async () => {
    await getApp();
    const emails = await demoEmails();
    clientSession = await loginAs(emails.client);
  });

  after(closeApp);

  it('elenca i documenti del cliente con il percorso di download', async () => {
    const response = await get('/client/documents', clientSession);
    const data = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.ok(data.length > 0);
    assert.ok(data[0].downloadPath.startsWith('/api/v1/documents/'));
    assert.equal(data[0].mimeType, 'application/pdf');
    assert.ok(data[0].sizeLabel.endsWith('KB'));
  });

  it('filtra i documenti per categoria', async () => {
    const response = await get('/client/documents?category=PROPOSAL', clientSession);
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.ok(data.every((row: { category: string }) => row.category === 'PROPOSAL'));
  });

  it('restituisce i metadati di un documento', async () => {
    const documents = (await get('/client/documents', clientSession)).json().data;
    const response = await get(`/documents/${documents[0].id}`, clientSession);

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, documents[0].id);
  });

  it('serve un PDF valido, apribile dal visualizzatore dello smartphone', async () => {
    const documents = (await get('/client/documents', clientSession)).json().data;
    const response = await get(`/documents/${documents[0].id}/file`, clientSession);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'application/pdf');
    assert.ok(String(response.headers['content-disposition']).startsWith('inline'));

    const buffer = response.rawPayload;
    assert.equal(buffer.subarray(0, 5).toString('latin1'), '%PDF-', 'intestazione PDF valida');
    assert.ok(buffer.subarray(-8).toString('latin1').includes('%%EOF'), 'chiusura PDF valida');
    assert.ok(buffer.byteLength > 500);
  });

  it('propone il salvataggio con download=true', async () => {
    const documents = (await get('/client/documents', clientSession)).json().data;
    const response = await get(`/documents/${documents[0].id}/file?download=true`, clientSession);

    assert.equal(response.statusCode, 200);
    assert.ok(String(response.headers['content-disposition']).startsWith('attachment'));
  });

  it('richiede l\'autenticazione per scaricare un documento', async () => {
    const documents = (await get('/client/documents', clientSession)).json().data;
    const response = await get(`/documents/${documents[0].id}/file`);
    assert.equal(response.statusCode, 401);
  });

  it('restituisce 404 per un documento inesistente', async () => {
    const response = await get('/documents/non-esiste', clientSession);
    assert.equal(response.statusCode, 404);
  });
});
