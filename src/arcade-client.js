import {gamePrefix} from './routing.js';
import {arcadeGameIds, arcadeTickUs} from './arcade-protocol.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const text = (value, max = 128) => typeof value === 'string' && value.length > 0 && value.length <= max;
const error = code => Object.assign(new Error(code), {code});
const requireValid = condition => { if (!condition) throw error('INVALID_RESPONSE'); };
const gameValid = game => arcadeGameIds.includes(game);
function profileValid(value) {
  return object(value) && text(value.nickname, 96) && integer(value.coins) &&
    Array.isArray(value.achievements) && value.achievements.length <= 10000 && value.achievements.every(item => text(item, 256));
}
function boardValid(data, game) {
  return object(data) && data.game === game && (data.profile === null || profileValid(data.profile)) &&
    Array.isArray(data.leaderboard) && data.leaderboard.length <= 20 && data.leaderboard.every((row, i) =>
      object(row) && row.rank === i + 1 && text(row.nickname, 96) && integer(row.score) && row.score > 0 &&
      Number.isFinite(row.durationMs) && row.durationMs > 0 && row.durationMs <= 1800000 && typeof row.won === 'boolean');
}
function replayValid(steps) {
  return Array.isArray(steps) && steps.length > 0 && steps.length <= 90000 &&
    steps.every(item => Array.isArray(item) && item.length === 3 && item[0] === arcadeTickUs &&
      typeof item[1] === 'string' && /^\d{0,32}$/.test(item[1]) && integer(item[2]) && item[2] > 0) &&
    steps.reduce((sum, item) => sum + item[2], 0) <= 90000;
}

/** Cookie-only API client. No identities or scores are inferred or awarded locally. */
export function createArcadeClient({url, fetchImpl = globalThis.fetch, onChange = () => {}}) {
  const endpoint = new URL(`${gamePrefix(new URL(url).pathname)}/api/arcade`, url);
  const listeners = new Set(), runs = new Map(), finishes = new Map(), controllers = new Set();
  let serial = 0, profileSerial = 0, identity = 0, nicknameVersion = 0;
  const client = {profile: null};
  function notify() { onChange(client); for (const listener of listeners) listener(client); }
  async function request(action, body, options = {}) {
    const order = ++serial, scope = identity, controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) throw error('ABORTED');
    options.signal?.addEventListener('abort', abort, {once: true});
    controllers.add(controller);
    const timer = setTimeout(abort, 15000);
    try {
      const target = new URL(endpoint);
      if (action === 'leaderboard') target.searchParams.set('game', body.game);
      let response;
      try {
        response = await fetchImpl(target, {
          method: action === 'leaderboard' ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          ...(action === 'leaderboard' ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, ...body})})
        });
      } catch (cause) { throw error(controller.signal.aborted || cause?.name === 'AbortError' ? 'ABORTED' : 'NETWORK'); }
      if (controller.signal.aborted) throw error('ABORTED');
      let data;
      try { data = await response.json(); } catch { throw error('INVALID_RESPONSE'); }
      if (controller.signal.aborted) throw error('ABORTED');
      if (scope !== identity) throw error('STALE_RESPONSE');
      if (!response.ok) {
        const code = data?.error?.code;
        throw error(typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : 'UNAVAILABLE');
      }
      return {data, order};
    } finally { clearTimeout(timer); controllers.delete(controller); options.signal?.removeEventListener('abort', abort); }
  }
  function acceptProfile(data, order) {
    if (order >= profileSerial) { profileSerial = order; client.profile = data.profile; notify(); }
  }
  function acceptMutation(data, order, scope, renameVersion = null) {
    if (scope !== identity) throw error('STALE_RESPONSE');
    const previous = client.profile;
    // These are confirmed snapshots, not a local award calculation. Arcade
    // coins/achievements only accumulate; an older receipt must not erase them
    // or replace a nickname supplied by a newer response.
    client.profile = previous ? {
      ...data.profile,
      nickname: (renameVersion === null ? order < profileSerial : renameVersion !== nicknameVersion) ? previous.nickname : data.profile.nickname,
      coins: Math.max(previous.coins, data.profile.coins),
      achievements: [...new Set([...previous.achievements, ...data.profile.achievements])]
    } : data.profile;
    // Reads started before this confirmed mutation cannot restore an old view.
    profileSerial = ++serial; notify();
    if (scope !== identity) throw error('STALE_RESPONSE');
    // Read the authoritative combined profile after the write. Keep the valid
    // mutation receipt successful even if this secondary refresh is offline.
    void (async () => {
      try {
        const fresh = await request('profile', {});
        requireValid(object(fresh.data) && profileValid(fresh.data.profile));
        if (scope === identity) acceptProfile(fresh.data, fresh.order);
      } catch { /* The confirmed receipt remains usable; a later read can refresh. */ }
    })();
  }
  client.subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  client.reset = client.invalidate = () => {
    identity++; nicknameVersion++; profileSerial = ++serial;
    for (const controller of controllers) controller.abort();
    runs.clear(); finishes.clear(); client.profile = null; notify();
  };
  client.getLeaderboard = async (game, options) => {
    if (!gameValid(game)) throw error('INVALID_GAME');
    const {data, order} = await request('leaderboard', {game}, options);
    requireValid(boardValid(data, game)); acceptProfile(data, order); return data;
  };
  client.start = async (game, options) => {
    if (!gameValid(game)) throw error('INVALID_GAME');
    const {data} = await request('start', {game}, options);
    requireValid(object(data) && text(data.runId, 80) && data.game === game && integer(data.seed) && data.seed <= 0xffffffff && integer(data.expiresAt));
    runs.set(data.runId, {...data}); return data;
  };
  client.finish = (runId, steps, options) => {
    if (finishes.has(runId)) return finishes.get(runId);
    if (!text(runId, 80) || !replayValid(steps)) return Promise.reject(error('INVALID_STEPS'));
    const pending = (async () => {
      const scope = identity;
      const {data, order} = await request('finish', {runId, steps}, options);
      requireValid(object(data) && data.runId === runId && gameValid(data.game) &&
        (!runs.has(runId) || data.game === runs.get(runId).game) && integer(data.score) && typeof data.won === 'boolean' &&
        Number.isFinite(data.durationMs) && data.durationMs > 0 && data.durationMs <= 1800000 && integer(data.awarded) && profileValid(data.profile));
      acceptMutation(data, order, scope); return data;
    })();
    finishes.set(runId, pending);
    pending.catch(() => { if (finishes.get(runId) === pending) finishes.delete(runId); });
    return pending;
  };
  client.claim = async (lessonId, source, options) => {
    if (!text(lessonId, 256) || typeof source !== 'string' || source.length > 4096) throw error('INVALID_REQUEST');
    const scope = identity;
    const {data, order} = await request('claim', {lessonId, source}, options);
    requireValid(object(data) && data.passed === true && integer(data.awarded) && profileValid(data.profile));
    acceptMutation(data, order, scope); return data;
  };
  client.saveNickname = async (nickname, options) => {
    if (typeof nickname !== 'string') throw error('INVALID_NICKNAME');
    const scope = identity, renameVersion = ++nicknameVersion;
    const {data, order} = await request('profile', {nickname}, options);
    requireValid(object(data) && profileValid(data.profile)); acceptMutation(data, order, scope, renameVersion); return data;
  };
  return client;
}
