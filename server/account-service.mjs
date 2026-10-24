import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { mkdir, chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';

const here = dirname(fileURLToPath(import.meta.url));
const cookiePrefix = 'loopuff';
const maxBodyBytes = 4 * 1024;
const passwordMin = 10;
const passwordMax = 128;
const ipWindowSeconds = 60;
const ipMax = 60;
const loginWindowSeconds = 15 * 60;
const loginEmailMax = 12;
const signupWindowSeconds = 60 * 60;
const signupEmailMax = 5;
const allowedOrigins = [
  'https://shixilin.com',
  'https://www.shixilin.com',
  'https://loopuff.vercel.app',
  'http://localhost:8773',
  'http://127.0.0.1:8773',
];

function failure(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function json(status, value, setCookies = []) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    Pragma: 'no-cache',
    Vary: 'Cookie, Origin',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(value), { status, headers });
}

function setCookiesFrom(headers) {
  if (typeof headers?.getSetCookie === 'function') return headers.getSetCookie();
  const single = headers?.get?.('set-cookie');
  return single ? [single] : [];
}

function cleanUser(user) {
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') return null;
  return { id: user.id, email: user.email };
}

function authError(status, action) {
  if (status === 429) return failure(429, 'RATE_LIMITED');
  if (action === 'sign-in') return failure(401, 'INVALID_CREDENTIALS');
  if (action === 'sign-up') return failure(status >= 500 ? 503 : 400, status >= 500 ? 'AUTH_UNAVAILABLE' : 'SIGN_UP_REJECTED');
  return failure(status >= 500 ? 503 : 401, status >= 500 ? 'AUTH_UNAVAILABLE' : 'AUTH_FAILED');
}

function originSet(baseURL) {
  const origins = new Set(allowedOrigins);
  origins.add(new URL(baseURL).origin);
  return origins;
}

function localBase(url) {
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
}

function validateBaseURL(value) {
  let url;
  try { url = new URL(value); } catch { throw failure(500, 'AUTH_CONFIGURATION_INVALID'); }
  if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !localBase(url)) || url.username || url.password) {
    throw failure(500, 'AUTH_CONFIGURATION_INVALID');
  }
  return url;
}

async function parseLimitedJSON(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBodyBytes) throw failure(413, 'BODY_TOO_LARGE');
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel().catch(() => {});
        throw failure(413, 'BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))));
  } catch {
    throw failure(400, 'INVALID_JSON');
  }
}

function normalizeCredentials(input, action) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw failure(400, 'INVALID_REQUEST');
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw failure(400, 'INVALID_EMAIL');
  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length < passwordMin || password.length > passwordMax) throw failure(400, 'INVALID_PASSWORD');
  if (action === 'sign-up') {
    const rawName = input.name === undefined ? 'Loopuff' : input.name;
    if (typeof rawName !== 'string' || !rawName.trim() || rawName.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(rawName)) {
      throw failure(400, 'INVALID_NAME');
    }
    return { email, password, name: rawName.trim() };
  }
  return { email, password };
}

function requestAddress(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 128) || 'unknown';
  return request.headers.get('x-real-ip')?.trim().slice(0, 128) || 'unknown';
}

function buildResponseCookies(response) {
  return setCookiesFrom(response.headers);
}

export async function createAccountService({ databasePath, secret, baseURL, fetch: _fetch } = {}) {
  void _fetch;
  if (typeof secret !== 'string' || secret.length < 32) throw failure(500, 'AUTH_SECRET_REQUIRED');
  const resolvedBase = validateBaseURL(baseURL);
  const dbPath = databasePath || resolve(here, 'data', 'loopuff.sqlite');
  if (dbPath !== ':memory:') await mkdir(dirname(resolve(dbPath)), { recursive: true, mode: 0o700 });

  const db = new DatabaseSync(dbPath, { timeout: 5000 });
  if (dbPath !== ':memory:') await chmod(dbPath, 0o600);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  } catch {
    db.close();
    throw failure(500, 'DATABASE_INIT_FAILED');
  }

  const auth = betterAuth({
    appName: 'Loopuff',
    baseURL: resolvedBase.origin,
    secret,
    database: db,
    trustedOrigins: [...originSet(resolvedBase.origin)],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: passwordMin,
      maxPasswordLength: passwordMax,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      cookiePrefix,
      useSecureCookies: !localBase(resolvedBase),
      defaultCookieAttributes: {
        httpOnly: true,
        secure: !localBase(resolvedBase),
        sameSite: 'lax',
        path: '/',
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 8 },
        '/sign-up/email': { window: signupWindowSeconds, max: signupEmailMax },
      },
    },
    logger: { disabled: true },
  });

  try {
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    db.exec(`CREATE TABLE IF NOT EXISTS loopuff_request_limits (
      bucket TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      hits INTEGER NOT NULL,
      PRIMARY KEY (bucket, key_hash)
    )`);
  } catch {
    db.close();
    throw failure(500, 'DATABASE_INIT_FAILED');
  }

  const checkLimitStatement = db.prepare(`
    INSERT INTO loopuff_request_limits(bucket, key_hash, window_start, hits)
    VALUES ($bucket, $keyHash, $now, 1)
    ON CONFLICT(bucket, key_hash) DO UPDATE SET
      window_start = CASE WHEN loopuff_request_limits.window_start + $window <= $now THEN $now ELSE loopuff_request_limits.window_start END,
      hits = CASE WHEN loopuff_request_limits.window_start + $window <= $now THEN 1 ELSE loopuff_request_limits.hits + 1 END
    RETURNING hits
  `);
  const cleanupLimits = db.prepare('DELETE FROM loopuff_request_limits WHERE window_start + $maxWindow < $now');
  let requests = 0;
  const limiter = (bucket, value, windowSeconds, max) => {
    const keyHash = createHash('sha256').update(`${bucket}\0${value}`).digest('hex');
    const now = Math.floor(Date.now() / 1000);
    const row = checkLimitStatement.get({ bucket, keyHash, now, window: windowSeconds });
    requests++;
    if ((requests & 255) === 0) cleanupLimits.run({ now, maxWindow: 24 * 60 * 60 });
    if (row.hits > max) throw failure(429, 'RATE_LIMITED');
  };

  async function asResponse(result, action) {
    if (!(result instanceof Response)) throw failure(503, 'AUTH_UNAVAILABLE');
    let body;
    try { body = await result.json(); } catch { body = null; }
    if (!result.ok) throw authError(result.status, action);
    const user = cleanUser(body?.user);
    if (!user) throw failure(503, 'AUTH_RESPONSE_INVALID');
    return json(result.status, { user }, buildResponseCookies(result));
  }

  const origins = originSet(resolvedBase.origin);
  const handler = async request => {
    if (!(request instanceof Request)) return json(400, { error: { code: 'INVALID_REQUEST' } });
    const url = new URL(request.url);
    if (request.method === 'GET' && ['/healthz', '/loopuff/healthz'].includes(url.pathname)) return json(200, { ok: true });
    if (request.method === 'GET' && ['/api/account', '/loopuff/api/account'].includes(url.pathname)) {
      try {
        const result = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
        const session = result && typeof result === 'object' && 'response' in result ? result.response : result;
        const responseHeaders = result && typeof result === 'object' && 'headers' in result ? result.headers : null;
        return json(200, { available: true, user: cleanUser(session?.user) }, setCookiesFrom(responseHeaders));
      } catch {
        return json(503, { error: { code: 'AUTH_UNAVAILABLE' } });
      }
    }
    if (!['/api/account', '/loopuff/api/account'].includes(url.pathname)) return json(404, { error: { code: 'NOT_FOUND' } });
    if (request.method !== 'POST') return json(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
    const origin = request.headers.get('origin');
    if (!origin || !origins.has(origin)) return json(403, { error: { code: 'FORBIDDEN' } });

    try {
      const input = await parseLimitedJSON(request);
      const client = requestAddress(request);
      limiter('ip', client, ipWindowSeconds, ipMax);
      if (input?.action === 'sign-up' || input?.action === 'sign-in') {
        const credentials = normalizeCredentials(input, input.action);
        const isSignup = input.action === 'sign-up';
        limiter(isSignup ? 'signup-email' : 'login-email', credentials.email, isSignup ? signupWindowSeconds : loginWindowSeconds, isSignup ? signupEmailMax : loginEmailMax);
        const result = isSignup
          ? await auth.api.signUpEmail({ body: credentials, headers: request.headers, asResponse: true })
          : await auth.api.signInEmail({ body: credentials, headers: request.headers, asResponse: true });
        return await asResponse(result, input.action);
      }
      if (input?.action === 'logout') {
        const result = await auth.api.signOut({ headers: request.headers, asResponse: true });
        if (!(result instanceof Response)) throw failure(503, 'AUTH_UNAVAILABLE');
        if (!result.ok) throw authError(result.status, 'logout');
        return json(200, { user: null }, buildResponseCookies(result));
      }
      return json(400, { error: { code: 'INVALID_ACTION' } });
    } catch (err) {
      const status = [400, 401, 403, 413, 429, 503].includes(err?.status) ? err.status : 503;
      const code = status === 429 ? 'RATE_LIMITED' : status === 413 ? 'BODY_TOO_LARGE' : status === 503 ? (err?.code === 'AUTH_RESPONSE_INVALID' ? 'AUTH_RESPONSE_INVALID' : 'AUTH_UNAVAILABLE') : status === 401 ? (err?.code === 'INVALID_CREDENTIALS' ? err.code : 'AUTH_FAILED') : status === 403 ? 'FORBIDDEN' : err?.code || 'INVALID_REQUEST';
      return json(status, { error: { code } });
    }
  };

  handler.close = () => db.close();
  return handler;
}

function nodeRequestToWeb(request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) for (const entry of value) headers.append(key, entry);
    else if (value !== undefined) headers.set(key, value);
  }
  const url = new URL(request.url || '/', 'http://127.0.0.1:8793');
  if (request.method === 'GET' || request.method === 'HEAD') return new Request(url, { method: request.method, headers });
  return (async () => {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      const data = Buffer.from(chunk);
      size += data.byteLength;
      if (size > maxBodyBytes) return null;
      chunks.push(data);
    }
    return new Request(url, { method: request.method, headers, body: Buffer.concat(chunks), duplex: 'half' });
  })();
}

async function writeNodeResponse(outgoing, response) {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') outgoing.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) outgoing.setHeader('Set-Cookie', cookies);
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

async function start() {
  const secret = process.env.LOOPUFF_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    console.error('[loopuff-account] LOOPUFF_AUTH_SECRET_REQUIRED');
    process.exitCode = 1;
    return;
  }
  const baseURL = process.env.LOOPUFF_AUTH_BASE_URL || 'https://shixilin.com';
  let handler;
  try {
    handler = await createAccountService({ secret, baseURL });
  } catch (err) {
    console.error(`[loopuff-account] startup failed: ${err?.code || 'AUTH_STARTUP_FAILED'}`);
    process.exitCode = 1;
    return;
  }
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = await nodeRequestToWeb(incoming);
      const response = request
        ? await handler(request)
        : json(413, { error: { code: 'BODY_TOO_LARGE' } });
      await writeNodeResponse(outgoing, response);
    } catch {
      console.error('[loopuff-account] request failed: INTERNAL_ERROR');
      await writeNodeResponse(outgoing, json(500, { error: { code: 'INTERNAL_ERROR' } }));
    }
  });
  server.on('error', () => {
    console.error('[loopuff-account] server failed: LISTEN_FAILED');
    handler.close();
  });
  server.listen(8793, '127.0.0.1', () => console.info('[loopuff-account] listening on 127.0.0.1:8793'));
  const stop = () => server.close(() => { handler.close(); process.exit(0); });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await start();
