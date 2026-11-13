import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcadeClient} from '../src/arcade-client.js';

const profile = nickname => ({nickname, coins: 10, achievements: ['lesson:signal']});
const board = (game = 'snake', name = 'Pilot') => ({game, leaderboard: [], profile: profile(name)});
const run = {runId: 'run-1', game: 'snake', seed: 4294967295, expiresAt: 1800000};
const receipt = {...run, score: 10, durationMs: 10000, won: false, awarded: 5, profile: profile('Pilot')};
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };

test('canonical endpoint retains the official prefix without a prefix-dropping slash redirect', async () => {
  for (const base of ['http://localhost:3000/en/play/', 'https://example.com/games/loopuff/zh/play/']) {
    let called;
    const client = createArcadeClient({url: base, fetchImpl: async (url, options) => { called = {url, options}; return Response.json(board()); }});
    await client.getLeaderboard('snake');
    assert.equal(called.url.pathname, base.includes('/games/') ? '/games/loopuff/api/arcade/' : '/api/arcade/');
    assert.equal(called.url.searchParams.get('game'), 'snake'); assert.equal(called.options.credentials, 'same-origin');
    assert.equal(called.options.method, 'GET');
  }
});

test('malformed and wrong-game responses are errors rather than empty boards', async () => {
  for (const data of [{}, {...board(), leaderboard: null}, {...board(), game: 'flight'}, {...board(), profile: {nickname: 'Pilot', coins: '10', achievements: []}}, {...board(), leaderboard: [{rank: 2, nickname: 'A', score: 1, durationMs: 20, won: false}]}]) {
    const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async () => Response.json(data)});
    await assert.rejects(client.getLeaderboard('snake'), {code: 'INVALID_RESPONSE'}); assert.equal(client.profile, null);
  }
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async () => new Response('bad json')});
  await assert.rejects(client.getLeaderboard('snake'), {code: 'INVALID_RESPONSE'});
});

test('network, auth, bad game and aborted requests retain stable codes', async () => {
  const options = {url: 'http://localhost/en/'};
  const offline = createArcadeClient({...options, fetchImpl: async () => { throw Error('offline'); }});
  await assert.rejects(offline.start('snake'), {code: 'NETWORK'});
  await assert.rejects(offline.start('unknown'), {code: 'INVALID_GAME'});
  const guest = createArcadeClient({...options, fetchImpl: async () => Response.json({error: {code: 'AUTH_REQUIRED'}}, {status: 401})});
  await assert.rejects(guest.start('snake'), {code: 'AUTH_REQUIRED'});
  const controller = new AbortController(); controller.abort();
  await assert.rejects(guest.getLeaderboard('snake', {signal: controller.signal}), {code: 'ABORTED'});
});

test('older profile responses cannot overwrite a more recent response', async () => {
  const first = deferred(), second = deferred(); let calls = 0;
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: () => ++calls === 1 ? first.promise : second.promise});
  const a = client.getLeaderboard('snake'), b = client.getLeaderboard('flight');
  second.resolve(Response.json(board('flight', 'New'))); await b;
  first.resolve(Response.json(board('snake', 'Old'))); await a;
  assert.equal(client.profile.nickname, 'New');
});

test('server seeds bind game identity; finish sends ordered replay only and deduplicates uploads', async () => {
  const bodies = [], finish = deferred();
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body); bodies.push(body); return body.action === 'start' ? Response.json(run) : finish.promise;
  }});
  assert.deepEqual(await client.start('snake'), run);
  const steps = [[20000, '313', 2], [20000, '', 5]], before = JSON.stringify(steps);
  const a = client.finish(run.runId, steps), b = client.finish(run.runId, steps);
  assert.equal(a, b); finish.resolve(Response.json(receipt)); const saved = await a; assert.deepEqual(saved, receipt);
  assert.equal(await client.finish(run.runId, steps), saved);
  assert.equal(bodies.filter(body => body.action === 'finish').length, 1);
  assert.deepEqual(bodies[1], {action: 'finish', runId: run.runId, steps});
  assert.deepEqual(bodies.filter(body => body.action === 'profile'), [{action: 'profile'}]);
  assert.equal(JSON.stringify(steps), before);
});

test('malformed starts and cross-game finish receipts are rejected', async () => {
  const invalid = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async () => Response.json({...run, seed: -1})});
  await assert.rejects(invalid.start('snake'), {code: 'INVALID_RESPONSE'});
  let calls = 0;
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async () => Response.json(++calls === 1 ? run : {...receipt, game: 'flight'})});
  await client.start('snake'); await assert.rejects(client.finish(run.runId, [[20000, '', 1]]), {code: 'INVALID_RESPONSE'});
});

test('claim and nickname send only source fields and accept server balances without optimistic awards', async () => {
  const bodies = []; let nickname = 'Pilot';
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body); bodies.push(body);
    if (body.nickname !== undefined) nickname = body.nickname;
    return Response.json(body.action === 'claim' ? {passed: true, awarded: 0, profile: profile(nickname)} : {profile: profile(nickname)});
  }});
  await client.claim('signal', '1.log()'); await client.saveNickname('New Pilot');
  assert.deepEqual(bodies, [{action: 'claim', lessonId: 'signal', source: '1.log()'}, {action: 'profile'}, {action: 'profile', nickname: 'New Pilot'}, {action: 'profile'}]);
  assert.equal(client.profile.coins, 10); assert.equal(client.profile.nickname, 'New Pilot');
});

test('identity reset blocks late GET and claim responses and clears cached runs and finishes', async () => {
  for (const method of ['get', 'claim']) {
    const late = deferred();
    const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: () => late.promise});
    const job = method === 'get' ? client.getLeaderboard('snake') : client.claim('signal', '1.log()');
    client.reset(); assert.equal(client.profile, null);
    late.resolve(Response.json(method === 'get' ? board() : {passed: true, awarded: 10, profile: profile('Old')}));
    await assert.rejects(job, error => ['ABORTED', 'STALE_RESPONSE'].includes(error.code)); assert.equal(client.profile, null);
  }
});

for (const action of ['finish', 'claim']) test(`a concurrent stale GET cannot hide coins confirmed by ${action}`, async () => {
    const late = deferred(); let coins = 0;
    const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async (_url, options) => {
      if (options.method === 'GET') return Response.json({...board(), profile: {...profile('Pilot'), coins: 0}});
      const body = JSON.parse(options.body);
      if (body.action === 'profile') return Response.json({profile: {...profile('Pilot'), coins}});
      return late.promise;
    }});
    const job = action === 'finish' ? client.finish('run-1', [[20000, '', 500]]) : client.claim('signal', '1.log()');
    await client.getLeaderboard('snake');
    coins = action === 'finish' ? 5 : 10;
    late.resolve(Response.json(action === 'finish' ? {...receipt, profile: {...profile('Pilot'), coins}}
      : {passed: true, awarded: coins, profile: {...profile('Pilot'), coins}}));
    const result = await job;
    assert.equal(result.profile.coins, coins); assert.equal(client.profile.coins, coins, action);
});

test('old finish profiles cannot replace a newer nickname even when the follow-up refresh fails', async () => {
  const late = deferred(); let name = 'Pilot', reads = 0, finishCalls = 0;
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'finish') { finishCalls++; return late.promise; }
    if (body.nickname !== undefined) { name = body.nickname; return Response.json({profile: {...profile(name), coins: 0}}); }
    reads++; throw Error('follow-up profile offline');
  }});
  const job = client.finish('run-1', [[20000, '', 500]]);
  await client.saveNickname('New Pilot');
  late.resolve(Response.json({...receipt, profile: {...profile('Pilot'), coins: 5}}));
  const result = await job;
  assert.equal(result.awarded, 5); assert.equal(client.profile.coins, 5);
  assert.equal(client.profile.nickname, 'New Pilot');
  assert.equal(await client.finish('run-1', [[20000, '', 500]]), result);
  assert.equal(finishCalls, 1); assert.ok(reads > 0);
});

test('an older rename response cannot replace a later confirmed rename while refreshing', async () => {
  const old = deferred(), fresh = deferred(), refresh = deferred();
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.nickname === 'First') return old.promise;
    if (body.nickname === 'Second') return fresh.promise;
    return refresh.promise;
  }});
  const first = client.saveNickname('First'), second = client.saveNickname('Second');
  fresh.resolve(Response.json({profile: profile('Second')})); await second;
  old.resolve(Response.json({profile: profile('First')})); await first;
  const beforeRefresh = client.profile.nickname;
  refresh.resolve(Response.json({profile: profile('Second')}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(beforeRefresh, 'Second');
  assert.equal(client.profile.nickname, 'Second');
});

test('a GET begun after another mutation but before finish commits cannot restore its old snapshot', async () => {
  const finishReply = deferred(), staleRead = deferred(); let committedCoins = 0;
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return staleRead.promise;
    const body = JSON.parse(options.body);
    if (body.action === 'finish') return finishReply.promise;
    return Response.json({profile: {...profile('New Pilot'), coins: committedCoins}});
  }});
  const finished = client.finish('run-1', [[20000, '', 500]]);
  await client.saveNickname('New Pilot');
  const stale = client.getLeaderboard('snake');
  committedCoins = 5;
  finishReply.resolve(Response.json({...receipt, profile: {...profile('Pilot'), coins: 5}}));
  await finished;
  staleRead.resolve(Response.json({...board(), profile: {...profile('New Pilot'), coins: 0}}));
  await stale;
  assert.equal(client.profile.coins, 5); assert.equal(client.profile.nickname, 'New Pilot');
});

test('secondary profile refresh is detached, identity-bound and never delays a successful receipt', async () => {
  const late = deferred(); let profileReads = 0;
  const client = createArcadeClient({url: 'http://localhost/en/', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'finish') return Response.json(receipt);
    profileReads++; return late.promise;
  }});
  const result = await client.finish('run-1', [[20000, '', 500]]);
  assert.equal(result.awarded, 5); assert.equal(profileReads, 1);
  client.reset(); late.resolve(Response.json({profile: profile('Old account')}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(client.profile, null);
});
