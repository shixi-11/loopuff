import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccountService } from './account-service.mjs';

const secret = 'test-only-loopuff-auth-secret-0123456789abcdef';
const baseURL = 'http://127.0.0.1:8773';
const origin = 'http://localhost:8773';
const credentials = { email: 'Pilot@example.com', password: 'Loopuff-test-password-2026' };

async function makeService(t, databasePath, options = {}) {
  const service = await createAccountService({ databasePath, secret, baseURL, ...options });
  t.after(() => service.close());
  return service;
}

function post(service, body, { requestOrigin = origin, path = '/api/account', headers = {} } = {}) {
  return service(new Request(`${baseURL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: requestOrigin, ...headers },
    body: JSON.stringify(body),
  }));
}

function cookiesFrom(response) {
  return (response.headers.getSetCookie?.() || []).map(value => value.split(';', 1)[0]).join('; ');
}

async function tempDatabase(t) {
  const directory = await mkdtemp(join(tmpdir(), 'loopuff-account-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'accounts.sqlite');
}

test('health and unauthenticated session return only the documented public shape', async t => {
  const service = await makeService(t, await tempDatabase(t));
  const health = await service(new Request(`${baseURL}/loopuff/healthz`));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  assert.match(health.headers.get('cache-control'), /no-store/);
  const session = await service(new Request(`${baseURL}/loopuff/api/account`));
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { available: true, user: null });
});

test('sign-up creates a Better Auth account and returns a prefixed HttpOnly cookie without tokens', async t => {
  const service = await makeService(t, await tempDatabase(t));
  const response = await post(service, { action: 'sign-up', ...credentials, name: 'Pilot' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.email, 'pilot@example.com');
  assert.ok(body.user.id);
  assert.deepEqual(Object.keys(body.user).sort(), ['email', 'id']);
  const setCookies = response.headers.getSetCookie();
  assert.ok(setCookies.length > 0);
  assert.ok(setCookies.every(cookie => cookie.toLowerCase().includes('httponly')));
  assert.ok(setCookies.every(cookie => cookie.toLowerCase().includes('samesite=lax')));
  assert.ok(setCookies.some(cookie => cookie.startsWith('loopuff.') || cookie.startsWith('__Secure-loopuff.')));
  assert.ok(setCookies.every(cookie => /; path=\/(;|$)/i.test(cookie)));
  assert.ok(setCookies.every(cookie => !/; secure(?:;|$)/i.test(cookie)));
  assert.ok(setCookies.every(cookie => !/\bdomain=/i.test(cookie)));
  assert.doesNotMatch(JSON.stringify(body), /token|password/i);
});

test('sign-in and GET session restore the same account from the database session', async t => {
  const service = await makeService(t, await tempDatabase(t));
  const registered = await post(service, { action: 'sign-up', ...credentials });
  const cookie = cookiesFrom(registered);
  const signedOut = await post(service, { action: 'logout' }, { headers: { Cookie: cookie } });
  assert.equal(signedOut.status, 200);
  assert.deepEqual(await signedOut.json(), { user: null });

  const signedIn = await post(service, { action: 'sign-in', ...credentials });
  assert.equal(signedIn.status, 200);
  const signInCookie = cookiesFrom(signedIn);
  const session = await service(new Request(`${baseURL}/api/account`, { headers: { Cookie: signInCookie } }));
  assert.equal(session.status, 200);
  const sessionBody = await session.json();
  assert.equal(sessionBody.available, true);
  assert.equal(sessionBody.user.email, 'pilot@example.com');
  assert.ok(sessionBody.user.id);
  assert.equal(Object.hasOwn(sessionBody.user, 'token'), false);
});

test('database-backed session survives service restart with the same secret', async t => {
  const databasePath = await tempDatabase(t);
  const first = await createAccountService({ databasePath, secret, baseURL });
  const registered = await post(first, { action: 'sign-up', ...credentials });
  const cookie = cookiesFrom(registered);
  const userId = (await registered.json()).user.id;
  first.close();

  const second = await makeService(t, databasePath);
  const session = await second(new Request(`${baseURL}/api/account`, { headers: { Cookie: cookie } }));
  assert.deepEqual(await session.json(), { available: true, user: { id: userId, email: 'pilot@example.com' } });
});

test('wrong password produces a generic credential error without provider details', async t => {
  const service = await makeService(t, await tempDatabase(t));
  await post(service, { action: 'sign-up', ...credentials });
  const response = await post(service, { action: 'sign-in', email: credentials.email, password: 'wrong-password' });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.deepEqual(body, { error: { code: 'INVALID_CREDENTIALS' } });
  assert.doesNotMatch(JSON.stringify(body), /wrong-password|token|hash/i);
});

test('logout clears the Better Auth session cookie', async t => {
  const service = await makeService(t, await tempDatabase(t));
  const registered = await post(service, { action: 'sign-up', ...credentials });
  const response = await post(service, { action: 'logout' }, { headers: { Cookie: cookiesFrom(registered) } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: null });
  assert.ok(response.headers.getSetCookie().some(cookie => /Max-Age=0|Expires=/i.test(cookie)));
});

test('rejects untrusted origins before account operations', async t => {
  const service = await makeService(t, await tempDatabase(t));
  const response = await post(service, { action: 'sign-up', ...credentials }, { requestOrigin: 'https://attacker.example' });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: { code: 'FORBIDDEN' } });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('rejects bodies over 4 KB and malformed actions or fields', async t => {
  const service = await makeService(t, await tempDatabase(t));
  const large = await post(service, { action: 'sign-up', ...credentials, name: 'x'.repeat(5000) });
  assert.equal(large.status, 413);
  assert.deepEqual(await large.json(), { error: { code: 'BODY_TOO_LARGE' } });
  const badEmail = await post(service, { action: 'sign-in', email: 'not-an-email', password: credentials.password });
  assert.equal(badEmail.status, 400);
  assert.deepEqual(await badEmail.json(), { error: { code: 'INVALID_EMAIL' } });
  const badPassword = await post(service, { action: 'sign-up', email: 'new@example.com', password: 'short' });
  assert.equal(badPassword.status, 400);
  assert.deepEqual(await badPassword.json(), { error: { code: 'INVALID_PASSWORD' } });
  const badAction = await post(service, { action: 'magic-link', ...credentials });
  assert.equal(badAction.status, 400);
  assert.deepEqual(await badAction.json(), { error: { code: 'INVALID_ACTION' } });
});

test('requires a secret before opening a database', async () => {
  await assert.rejects(
    createAccountService({ databasePath: ':memory:', secret: 'short', baseURL }),
    error => error.code === 'AUTH_SECRET_REQUIRED',
  );
});

test('uses Secure cookies for the production base URL', async t => {
  const service = await makeService(t, await tempDatabase(t), { baseURL: 'https://shixilin.com' });
  const response = await post(service, { action: 'sign-up', ...credentials }, { requestOrigin: 'https://shixilin.com' });
  assert.equal(response.status, 200);
  assert.ok(response.headers.getSetCookie().some(cookie => /; Secure/i.test(cookie) && /; Path=\//i.test(cookie)));
});

test('enforces persistent service-side email throttling for auth.api calls', async t => {
  const service = await makeService(t, await tempDatabase(t));
  for (let i = 0; i < 12; i++) {
    const response = await post(service, { action: 'sign-in', email: 'limited@example.com', password: 'wrong-password-123' });
    assert.equal(response.status, 401);
  }
  const limited = await post(service, { action: 'sign-in', email: 'limited@example.com', password: 'wrong-password-123' });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: { code: 'RATE_LIMITED' } });
});
