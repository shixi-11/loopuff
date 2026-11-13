import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountLeaderboard, mountRankedGame} from '../src/arcade-ui.js';
import {locales} from '../src/course.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../public/locales/en.json', import.meta.url)));
const text = catalog.leaderboard;
const games = catalog.handheld.games;
const profile = {nickname: 'Pilot', coins: 25, achievements: ['game:snake:played', 'game:snake:won']};
const run = {runId: 'run-1', game: 'snake', seed: 71234, expiresAt: 1800000};
const receipt = {runId: run.runId, game: 'snake', score: 10, durationMs: 10000, won: false, awarded: 5, profile};
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; };
const settle = () => new Promise(resolve => setImmediate(resolve));
function rootNode() {
  const handlers = new Map();
  return {
    innerHTML: '',
    addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(handler); },
    removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
    emit(type, event) { event.preventDefault ??= () => {}; for (const handler of handlers.get(type) || []) handler(event); },
    press(action, type = 'ranked') { this.emit('click', {target: {closest(selector) { return selector === `[data-${type}]` ? {dataset: {[type]: action}} : null; }}}); },
    select(game) { this.emit('click', {target: {closest(selector) { return selector === '[data-arcade-game]' ? {dataset: {arcadeGame: game}} : null; }}}); },
    listeners() { return [...handlers.values()].reduce((count, set) => count + set.size, 0); }
  };
}
function fixture(overrides = {}) {
  const root = rootNode(), model = overrides.model || {}, account = overrides.account || {user: {id: 'u1', email: 'private@example.com'}};
  const calls = {start: [], finish: [], begin: [], login: 0}; let game = 'snake';
  const client = {profile: null, async getLeaderboard(id) { return {game: id, leaderboard: [], profile}; }, async start(id) { calls.start.push(id); return {...run, game: id}; }, async finish(id, steps) { calls.finish.push({id, steps}); return receipt; }, ...overrides.client};
  let toolbar;
  const view = {begin(seed) { calls.begin.push(seed); }, finish() { void toolbar.end(); }};
  toolbar = mountRankedGame(root, {client, account, text, model, getGame: () => game, getView: () => view, onLogin() { calls.login++; }});
  return {root, model, account, calls, client, view, toolbar, game(value) { game = value; }};
}

test('ranked starts require user intent and a real session, and never trigger account registration', async () => {
  const guest = fixture({account: {user: null}});
  await settle(); assert.equal(guest.calls.start.length, 0); assert.ok(guest.root.innerHTML.includes(text.login));
  guest.root.press('start'); guest.toolbar.step(20000, [1]); await guest.toolbar.end();
  assert.equal(guest.calls.start.length, 0); assert.equal(guest.calls.finish.length, 0);
  guest.root.press('login'); assert.equal(guest.calls.login, 1); guest.toolbar.dispose();
  const f = fixture(); await settle(); assert.equal(f.calls.start.length, 0);
  f.root.press('start'); f.root.press('start'); await settle();
  assert.deepEqual(f.calls.start, ['snake']); assert.deepEqual(f.calls.begin, [run.seed]); assert.equal(f.model.arcadeRanked.run.seed, run.seed);
  f.toolbar.dispose();
});

test('actual actions retain order and duplicates; identical consecutive ticks are RLE-compressed', async () => {
  const f = fixture(); f.root.press('start'); await settle();
  for (const actions of [[1, 3, 1], [1, 3, 1], [], [], [0], [4, 3]]) f.toolbar.step(20000, actions);
  assert.deepEqual(f.model.arcadeRanked.steps, [[20000, '131', 2], [20000, '', 2], [20000, '0', 1], [20000, '43', 1]]);
  await f.toolbar.end(); assert.deepEqual(f.calls.finish[0], {id: run.runId, steps: [[20000, '131', 2], [20000, '', 2], [20000, '0', 1], [20000, '43', 1]]});
  assert.equal(f.model.arcadeRanked.receipt.score, receipt.score); assert.ok(f.root.innerHTML.includes(text.submitted));
  assert.ok(!f.root.innerHTML.includes('private@example.com')); f.toolbar.dispose();
});

test('late server starts cannot restart after card changes, reset, logout or disposal', async () => {
  for (const reason of ['game', 'reset', 'logout', 'dispose']) {
    const late = deferred(), f = fixture({client: {start: () => late.promise}});
    f.root.press('start');
    if (reason === 'game') f.game('flight');
    if (reason === 'reset') f.toolbar.reset();
    if (reason === 'logout') f.account.user = null;
    if (reason === 'dispose') f.toolbar.dispose();
    late.resolve(run); await settle(); assert.equal(f.calls.begin.length, 0, reason);
    assert.notEqual(f.model.arcadeRanked.status, 'starting', reason);
    if (reason !== 'dispose') f.toolbar.dispose();
  }
});

test('game/owner changes invalidate recording; non-fixed ticks and invalid inputs are never submitted', async () => {
  for (const reason of ['game', 'owner', 'dt', 'action']) {
    const f = fixture(); f.root.press('start'); await settle();
    if (reason === 'game') f.game('flight');
    if (reason === 'owner') f.account.user = {id: 'u2'};
    f.toolbar.step(reason === 'dt' ? 30000 : 20000, reason === 'action' ? [9] : [1]);
    await f.toolbar.end(); assert.equal(f.calls.finish.length, 0, reason); assert.equal(f.model.arcadeRanked.status, 'invalid'); f.toolbar.dispose();
  }
});

test('reset invalidates the old seed binding and an empty game has nothing to upload', async () => {
  const f = fixture(); f.root.press('start'); await settle(); f.toolbar.step(20000, [1]);
  f.toolbar.reset(); f.toolbar.step(20000, [2]); await f.toolbar.end(); assert.equal(f.calls.finish.length, 0);
  f.root.press('start'); await settle(); await f.toolbar.end(); assert.equal(f.calls.finish.length, 0);
  assert.ok(f.root.innerHTML.includes(text.noSteps)); f.toolbar.dispose();
});

test('90000 ticks are retained and the next tick switches to ordinary play without upload', async () => {
  const f = fixture(); f.root.press('start'); await settle();
  for (let i = 0; i < 90000; i++) f.toolbar.step(20000, []);
  assert.deepEqual(f.model.arcadeRanked.steps, [[20000, '', 90000]]);
  f.toolbar.step(20000, []); assert.equal(f.model.arcadeRanked.status, 'limit');
  await f.toolbar.end(); assert.equal(f.calls.finish.length, 0); assert.ok(f.root.innerHTML.includes(text.recordLimit)); f.toolbar.dispose();
});

test('duplicate end hooks and finish buttons cause one upload; disposing preserves active recordings', async () => {
  const upload = deferred(), model = {}, f = fixture({model, client: {finish: (_id, steps) => { f.calls.finish.push(steps); return upload.promise; }}});
  f.root.press('start'); await settle(); f.toolbar.step(20000, [2]); f.toolbar.dispose();
  assert.equal(model.arcadeRanked.status, 'recording'); assert.equal(model.arcadeRanked.ticks, 1);
  const next = fixture({model, client: f.client}); await settle(); next.toolbar.step(20000, [2]);
  const a = next.toolbar.end(), b = next.toolbar.end(); assert.equal(a, b); assert.equal(f.calls.finish.length, 1);
  next.toolbar.dispose(); const again = fixture({model, client: f.client});
  upload.resolve(receipt); await a; await settle();
  assert.equal(model.arcadeRanked.status, 'submitted'); assert.ok(again.root.innerHTML.includes(text.submitted));
  assert.equal(model.arcadeRanked.steps[0][2], 2); again.toolbar.dispose();
});

test('upload failure retains the exact log for retry and never awards local coins', async () => {
  let attempts = 0;
  const f = fixture({client: {finish: async () => { if (++attempts === 1) throw Object.assign(Error(), {code: 'NETWORK'}); return receipt; }}});
  f.root.press('start'); await settle(); f.toolbar.step(20000, [1]); await f.toolbar.end();
  assert.equal(f.model.arcadeRanked.status, 'submitError'); assert.equal(f.model.arcadeRanked.receipt, null);
  assert.deepEqual(f.model.arcadeRanked.steps, [[20000, '1', 1]]); await f.toolbar.end(); assert.equal(attempts, 2);
  assert.equal(f.model.arcadeRanked.receipt.awarded, 5); f.toolbar.dispose();
});

test('an upload completing after an account switch cannot show another account receipt', async () => {
  const late = deferred(), f = fixture({client: {finish: () => late.promise}});
  f.root.press('start'); await settle(); f.toolbar.step(20000, [1]); const upload = f.toolbar.end();
  f.account.user = {id: 'other'}; late.resolve(receipt); await upload;
  assert.equal(f.model.arcadeRanked.receipt, null); assert.equal(f.model.arcadeRanked.status, 'invalid'); f.toolbar.dispose();
});

test('an invalidated old upload cannot lock or overwrite a newly recorded game', async () => {
  const old = deferred(), fresh = deferred(); let runNumber = 0, uploads = 0;
  const f = fixture({client: {
    start: async () => ({...run, runId: `run-${++runNumber}`}),
    finish: () => ++uploads === 1 ? old.promise : fresh.promise
  }});
  f.root.press('start'); await settle(); f.toolbar.step(20000, [1]); const first = f.toolbar.end();
  f.toolbar.reset(); f.root.press('start'); await settle(); f.toolbar.step(20000, [2]); const second = f.toolbar.end();
  assert.notEqual(first, second); assert.equal(uploads, 2);
  fresh.resolve({...receipt, runId: 'run-2', score: 20}); await second;
  old.resolve(receipt); await first;
  assert.equal(f.model.arcadeRanked.receipt.runId, 'run-2'); assert.equal(f.model.arcadeRanked.receipt.score, 20); f.toolbar.dispose();
});

test('public board distinguishes loading, network failure and verified empty results', async () => {
  const root = rootNode(), late = deferred(); let fail = true;
  const client = {getLeaderboard: () => fail ? late.promise : Promise.resolve({game: 'blocks', leaderboard: [], profile: null})};
  const page = mountLeaderboard(root, {client, account: {user: null}, text, games, model: {}, urls: {account: '/en/account/', play: '/en/play/'}});
  assert.ok(root.innerHTML.includes(text.loading)); assert.ok(!root.innerHTML.includes(text.empty));
  late.reject(Object.assign(Error(), {code: 'NETWORK'})); await settle(); assert.ok(root.innerHTML.includes(text.error)); assert.ok(!root.innerHTML.includes(text.empty));
  fail = false; await page.refresh(); assert.ok(root.innerHTML.includes(text.empty)); assert.ok(root.innerHTML.includes('/en/account/')); page.dispose();
});

test('board ignores stale selections, escapes names and displays server ranks without email', async () => {
  const root = rootNode(), old = deferred(), fresh = deferred();
  const client = {getLeaderboard: game => game === 'blocks' ? old.promise : fresh.promise};
  const page = mountLeaderboard(root, {client, account: {user: {id: 'u', email: 'secret@example.com'}}, text, games, model: {}, urls: {account: '/en/account/', play: '/en/play/'}});
  root.select('snake');
  fresh.resolve({game: 'snake', leaderboard: [{rank: 1, nickname: '<img src=x onerror=alert(1)>', score: 42, durationMs: 18020, won: false}], profile}); await settle();
  assert.ok(root.innerHTML.includes('&lt;img')); assert.ok(!root.innerHTML.includes('<img')); assert.ok(root.innerHTML.includes('42')); assert.ok(!root.innerHTML.includes('secret@example.com'));
  old.resolve({game: 'blocks', leaderboard: [], profile: null}); await settle(); assert.ok(root.innerHTML.includes('42')); assert.ok(!root.innerHTML.includes(text.empty)); page.dispose(); assert.equal(root.listeners(), 0);
});

test('changing accounts clears the old profile and nickname draft immediately', async () => {
  const root = rootNode(), account = {user: {id: 'one'}}, late = deferred(); let calls = 0;
  const client = {getLeaderboard: async () => ++calls === 1 ? {game: 'blocks', leaderboard: [], profile} : late.promise};
  const page = mountLeaderboard(root, {client, account, text, games, model: {}, urls: {account: '/en/account/', play: '/en/play/'}});
  await settle(); assert.ok(root.innerHTML.includes('Pilot'));
  root.emit('input', {target: {name: 'nickname', value: 'Old account draft'}});
  account.user = {id: 'two'}; const loading = page.refresh();
  assert.ok(!root.innerHTML.includes('Pilot')); assert.ok(!root.innerHTML.includes('Old account draft'));
  late.resolve({game: 'blocks', leaderboard: [], profile: {...profile, nickname: 'Second'}}); await loading;
  assert.ok(root.innerHTML.includes('Second')); page.dispose();
});

test('all twelve production catalogs provide the translated recording and reward controls', () => {
  const keys=['starting','startError','recordLimit','recordInvalid','noSteps','nicknameHint','claimReward','rewardSaving','rewardError'];
  for (const [locale] of locales) {
    const current=JSON.parse(fs.readFileSync(new URL(`../public/locales/${locale}.json`,import.meta.url)));
    assert.ok(keys.every(key=>typeof current.leaderboard[key]==='string'&&current.leaderboard[key].trim()),locale);
    assert.ok(current.leaderboard.nicknameHint.includes('24'));
  }
});

test('saving a nickname refreshes the public board from the server before confirming completion',async()=>{
 const root=rootNode(),account={user:{id:'one'}};let name='Old name',reads=0;
 const client={profile:{...profile,nickname:name},getLeaderboard:async()=>{reads++;return{game:'blocks',leaderboard:[{rank:1,nickname:name,score:42,durationMs:12000,won:false}],profile:{...profile,nickname:name}};},saveNickname:async value=>{name=value;client.profile={...profile,nickname:name};return{profile:client.profile};}};
 const page=mountLeaderboard(root,{client,account,text,games,model:{},urls:{account:'/account',play:'/play'}});await settle();
 root.emit('input',{target:{name:'nickname',value:'New name'}});root.emit('submit',{target:{matches:()=>true}});await settle();
 assert.ok(reads>=2,'the current leaderboard must be re-read');assert.ok(root.innerHTML.includes('<bdi>New name</bdi>'));assert.ok(!root.innerHTML.includes('<bdi>Old name</bdi>'));page.dispose();
});
