import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeApp, demoEmails, get, getApp, loginAs, post, url, DEMO_PASSWORD } from './helpers.js';

describe('Autenticazione', () => {
  let emails: Awaited<ReturnType<typeof demoEmails>>;

  before(async () => {
    await getApp();
    emails = await demoEmails();
  });

  after(closeApp);

  it('il servizio risponde e dichiara di essere un prototipo', async () => {
    const response = await get('/health');
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.status, 'ok');
    assert.equal(response.headers['x-prototype'], 'true');
  });

  it('usa la sorgente dati mock: nessuna dipendenza da Guardian', async () => {
    const response = await get('/system/data-source');
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.equal(data.name, 'mock');
    assert.equal(data.available, true);
    assert.equal(data.guardian.configured, false);
  });

  it('espone gli account dimostrativi per i tre ruoli', async () => {
    const response = await get('/auth/demo-accounts');
    const roles = new Set(response.json().data.accounts.map((account: { role: string }) => account.role));
    assert.equal(response.statusCode, 200);
    assert.ok(roles.has('CLIENT') && roles.has('ADVISOR') && roles.has('ADMIN'));
  });

  it('effettua il login e restituisce il ruolo per instradare la navigazione', async () => {
    const response = await post('/auth/login', { email: emails.client, password: DEMO_PASSWORD });
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.equal(data.user.role, 'CLIENT');
    assert.ok(data.accessToken.length > 20);
    assert.ok(data.refreshToken.length > 20);
    assert.equal(data.tokenType, 'Bearer');
  });

  it('rifiuta una password errata senza rivelare se l\'email esiste', async () => {
    const response = await post('/auth/login', { email: emails.client, password: 'password-sbagliata' });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, 'INVALID_CREDENTIALS');
  });

  it('rifiuta un\'email inesistente con lo stesso errore', async () => {
    const response = await post('/auth/login', { email: 'nessuno@demo.local', password: DEMO_PASSWORD });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, 'INVALID_CREDENTIALS');
  });

  it('valida il corpo della richiesta di login', async () => {
    const response = await post('/auth/login', { email: 'non-una-email' });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'VALIDATION_ERROR');
  });

  it('restituisce il profilo dell\'utente autenticato con i dati del ruolo', async () => {
    const session = await loginAs(emails.client);
    const response = await get('/auth/me', session);
    const data = response.json().data;
    assert.equal(response.statusCode, 200);
    assert.equal(data.profile.type, 'CLIENT');
    assert.ok(data.profile.advisor.name.length > 0, 'il cliente vede il consulente di riferimento');
  });

  it('blocca le rotte protette senza token', async () => {
    const response = await get('/client/home');
    assert.equal(response.statusCode, 401);
  });

  it('blocca un token non valido', async () => {
    const app = await getApp();
    const response = await app.inject({
      method: 'GET',
      url: url('/client/home'),
      headers: { authorization: 'Bearer token-falso' },
    });
    assert.equal(response.statusCode, 401);
  });

  it('rinnova la sessione con il refresh token e invalida quello usato', async () => {
    const session = await loginAs(emails.advisor);

    const refreshed = await post('/auth/refresh', { refreshToken: session.refreshToken });
    assert.equal(refreshed.statusCode, 200);
    assert.notEqual(refreshed.json().data.refreshToken, session.refreshToken);

    // Rotazione: il token precedente non è più utilizzabile.
    const reused = await post('/auth/refresh', { refreshToken: session.refreshToken });
    assert.equal(reused.statusCode, 401);
    assert.equal(reused.json().error.code, 'REFRESH_INVALID');
  });

  it('revoca il refresh token al logout', async () => {
    const session = await loginAs(emails.admin);
    const logout = await post('/auth/logout', { refreshToken: session.refreshToken }, session);
    assert.equal(logout.statusCode, 200);

    const afterLogout = await post('/auth/refresh', { refreshToken: session.refreshToken });
    assert.equal(afterLogout.statusCode, 401);
  });
});
