import {arcadeGameIds, arcadeTickUs} from './arcade-protocol.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const gameId = value => Number.isInteger(value) ? arcadeGameIds[value] : arcadeGameIds.includes(value) ? value : null;
const clock = ms => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
const authId = account => account?.user?.id || null;
const pending = new WeakMap();
const observers = new WeakMap();
const failure = (cause, t) => cause?.code === 'NETWORK' ? t.network : cause?.code === 'AUTH_REQUIRED' ? t.login : cause?.code === 'INVALID_NICKNAME' ? t.nicknameHint : t.error;
function profileMarkup(profile, t) {
  return profile ? `<section class="arcade-profile"><h2>${esc(t.profile)}</h2><p><bdi>${esc(profile.nickname)}</bdi></p><dl><div><dt>${esc(t.coins)}</dt><dd><bdi>${profile.coins}</bdi></dd></div><div><dt>${esc(t.achievements)}</dt><dd><bdi>${profile.achievements.length}</bdi></dd></div></dl></section>` : '';
}

/** Public board and private nickname/coin summary; never renders account email. */
export function mountLeaderboard(root, {client, account, text: t, games, model = {}, urls, onPlay = () => {}, onSelect = () => {}}) {
  model.arcadeLeaderboard ??= {game: 'blocks'};
  const state = model.arcadeLeaderboard;
  let disposed = false, version = 0, controller, status = 'loading', rows = [], message = '', saving = false, profile = null;
  let draft = client.profile?.nickname || '';
  function render() {
    if (disposed) return;
    const signed = !!authId(account), visibleProfile = state.profileOwner === authId(account) ? profile : null;
    const content = status === 'loading' ? `<p role="status">${esc(t.loading)}</p>`
      : status === 'error' ? `<p role="alert">${esc(t.error)}</p><button type="button" data-arcade="retry">${esc(t.retry)}</button>`
      : rows.length ? `<table class="arcade-leaderboard"><caption>${esc(games[arcadeGameIds.indexOf(state.game)])}</caption><thead><tr>${['rank', 'player', 'score', 'time', 'verified'].map(k => `<th scope="col">${esc(t[k])}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><td><bdi>${row.rank}</bdi></td><td><bdi>${esc(row.nickname)}</bdi></td><td><bdi>${row.score}</bdi></td><td><bdi dir="ltr">${clock(row.durationMs)}</bdi></td><td aria-label="${esc(t.verified)}">✓</td></tr>`).join('')}</tbody></table>`
      : `<p role="status">${esc(t.empty)}</p>`;
    root.innerHTML = `<section class="arcade-page arcade-ranking"><header><h1>${esc(t.title)}</h1><p>${esc(t.intro)}</p></header><nav class="arcade-tabs" aria-label="${esc(t.game)}">${arcadeGameIds.map((id, i) => `<button type="button" data-arcade-game="${id}" aria-pressed="${id === state.game}">${esc(games[i])}</button>`).join('')}</nav><div class="arcade-results">${content}</div><a data-arcade="play" href="${esc(urls.play)}">${esc(t.startGuest)}</a>${signed ? profileMarkup(visibleProfile, t) + `<form data-arcade-name><label for="arcade-nickname">${esc(t.nickname)}</label><input id="arcade-nickname" name="nickname" autocomplete="nickname" minlength="2" maxlength="48" required value="${esc(draft)}"><small>${esc(t.nicknameHint)}</small><button type="submit"${saving ? ' disabled' : ''}>${esc(t.saveName)}</button></form>` : `<p>${esc(t.login)}</p><a href="${esc(urls.account)}">${esc(t.signIn)}</a>`}<p>${esc(t.publishNote)}</p><p role="status" aria-live="polite">${esc(message)}</p><section class="arcade-rules"><h2>${esc(t.rulesTitle)}</h2><ul>${t.rules.map(rule => `<li>${esc(rule)}</li>`).join('')}</ul></section></section>`;
  }
  async function refresh() {
    const own = ++version, game = state.game, owner = authId(account);
    if (state.profileOwner !== owner) { rows = []; profile = null; draft = ''; state.profileOwner = null; }
    controller?.abort(); controller = new AbortController(); status = 'loading'; render();
    try {
      const data = await client.getLeaderboard(game, {signal: controller.signal});
      if (disposed || own !== version || state.game !== game || owner !== authId(account)) return;
      rows = data.leaderboard.slice(0, 20); status = 'ready';
      profile = Object.hasOwn(client, 'profile') ? client.profile : data.profile; state.profileOwner = owner;
      if (!draft && profile) draft = profile.nickname;
    } catch (cause) { if (disposed || own !== version) return; status = 'error'; }
    render();
  }
  const click = event => {
    const selected = event.target.closest('[data-arcade-game]')?.dataset.arcadeGame;
    if (gameId(selected)) { state.game = selected; onSelect(selected); void refresh(); return; }
    const action = event.target.closest('[data-arcade]')?.dataset.arcade;
    if (action === 'retry') void refresh();
    if (action === 'play') { event.preventDefault(); onPlay(state.game); }
  };
  const input = event => { if (event.target.name === 'nickname') draft = event.target.value; };
  const submit = async event => {
    if (!event.target.matches('[data-arcade-name]')) return;
    event.preventDefault(); if (saving || !authId(account)) return;
    const owner = authId(account); saving = true; message = ''; render();
    try {
      const data = await client.saveNickname(draft);
      if (!disposed && authId(account) === owner) { profile = data.profile; state.profileOwner = owner; draft = profile.nickname; await refresh(); if(!disposed&&authId(account)===owner)message = t.nameSaved; }
    } catch (cause) { if (!disposed&&authId(account)===owner) message = failure(cause, t); }
    finally { saving = false; render(); }
  };
  const unsubscribe = client.subscribe?.(() => { if (state.profileOwner === authId(account)) profile = client.profile; render(); });
  root.addEventListener('click', click); root.addEventListener('input', input); root.addEventListener('submit', submit);
  void refresh();
  return {refresh, dispose() { disposed = true; version++; controller?.abort(); unsubscribe?.(); root.removeEventListener('click', click); root.removeEventListener('input', input); root.removeEventListener('submit', submit); }};
}

/** The game owns simulation. This toolbar records exactly the engine's actual fixed ticks. */
export function mountRankedGame(root, {client, account, text: t, model = {}, getGame, getView, onLogin = () => {}}) {
  model.arcadeRanked ??= {run: null, steps: [], ticks: 0, status: 'idle', receipt: null, owner: null};
  const state = model.arcadeRanked;
  let disposed = false, version = 0, startController, profileController, message = '', profile = null, profileOwner = null;
  const compatible = () => state.run && state.run.game === gameId(getGame()) && state.owner === authId(account);
  function invalidate(status = 'idle') {
    version++; startController?.abort(); state.run = null; state.steps = []; state.ticks = 0;
    state.owner = null; state.receipt = null; state.status = status;
  }
  function render() {
    if (disposed) return;
    const signed = !!authId(account), recording = state.status === 'recording', submitting = state.status === 'submitting';
    const status = message || (recording ? t.recording : submitting ? t.submitting : state.status === 'starting' ? t.starting : state.status === 'submitted' ? t.submitted : state.status === 'limit' ? t.recordLimit : state.status === 'invalid' ? t.recordInvalid : t.practiceOnly);
    const receipt = state.receipt;
    root.innerHTML = `<section class="arcade-toolbar" aria-label="${esc(t.title)}">${signed ? `<button type="button" data-ranked="start"${recording || submitting || state.status === 'starting' ? ' disabled' : ''}>${esc(t.startRanked)}</button>${recording || state.status === 'submitError' ? `<button type="button" data-ranked="finish">${esc(state.status === 'submitError' ? t.retry : t.finishSubmit)}</button>` : ''}` : `<p>${esc(t.login)}</p><button type="button" data-ranked="login">${esc(t.signIn)}</button><span>${esc(t.startGuest)}</span>`}<p role="status" aria-live="polite">${esc(status)}</p>${receipt && signed ? `<p>${esc(t.verified)} · ${esc(t.score)} <bdi>${receipt.score}</bdi> · ${esc(t.time)} <bdi dir="ltr">${clock(receipt.durationMs)}</bdi></p><p>${esc(t.claimed)}: <bdi>${receipt.awarded}</bdi> ${esc(t.coins)}</p>` : ''}${signed && profileOwner === authId(account) ? profileMarkup(profile, t) : ''}</section>`;
  }
  async function start() {
    if (disposed || !authId(account) || ['starting', 'recording', 'submitting'].includes(state.status)) return;
    const game = gameId(getGame()), owner = authId(account), view = getView();
    if (!game || !view?.begin) return;
    invalidate(); const own = version; state.status = 'starting'; message = ''; startController = new AbortController(); render();
    try {
      const run = await client.start(game, {signal: startController.signal});
      if (disposed || own !== version) return;
      if (owner !== authId(account) || game !== gameId(getGame()) || view !== getView()) { invalidate('invalid'); render(); return; }
      state.run = {...run}; state.owner = owner; state.steps = []; state.ticks = 0; state.receipt = null;
      // begin must use the server seed without emitting the game's reset hook.
      view.begin(run.seed); state.status = 'recording';
    } catch (cause) {
      if (disposed || own !== version) return;
      invalidate(); message = cause?.code === 'NETWORK' ? t.network : cause?.code === 'AUTH_REQUIRED' ? t.login : t.startError;
    }
    if (!disposed && own === version && state.status === 'starting') state.status = 'idle';
    render();
  }
  function step(dtUs, actions) {
    if (disposed || state.status !== 'recording') return;
    if (!compatible()) { invalidate('invalid'); render(); return; }
    const max = {blocks: 5, tanks: 5, flight: 5, snake: 4, breakout: 3, sokoban: 6}[state.run.game];
    if (dtUs !== arcadeTickUs || !Array.isArray(actions) || actions.length > 32 || actions.some(a => !Number.isInteger(a) || a < 0 || a > max)) {
      invalidate('invalid'); render(); return;
    }
    if (state.ticks >= 90000) { invalidate('limit'); render(); return; }
    const commands = actions.join(''), last = state.steps.at(-1);
    if (last && last[1] === commands) last[2]++; else state.steps.push([arcadeTickUs, commands, 1]);
    state.ticks++;
  }
  function end() {
    if (disposed) return Promise.resolve(null);
    const activeUpload = pending.get(state);
    if (activeUpload && activeUpload.runId === state.run?.runId) return activeUpload.job;
    if (!['recording', 'submitError'].includes(state.status)) return Promise.resolve(state.receipt);
    if (!compatible()) { invalidate('invalid'); render(); return Promise.resolve(null); }
    if (!state.ticks) { invalidate(); message = t.noSteps; render(); return Promise.resolve(null); }
    const run = state.run, owner = state.owner, steps = state.steps.map(group => group.slice());
    state.status = 'submitting'; message = ''; render();
    const operation = {runId: run.runId, job: null}; pending.set(state, operation);
    const job = (async () => {
      try {
        const receipt = await client.finish(run.runId, steps);
        if (state.run?.runId !== run.runId || state.owner !== owner) return null;
        if (authId(account) !== owner) { invalidate('invalid'); return null; }
        state.receipt = receipt; state.status = 'submitted'; profile = client.profile || receipt.profile; profileOwner = owner; return receipt;
      } catch (cause) {
        if (state.run?.runId === run.runId) {
          if (authId(account) !== owner) invalidate('invalid');
          else { state.status = 'submitError'; message = cause?.code === 'NETWORK' ? t.network : cause?.code === 'AUTH_REQUIRED' ? t.login : t.invalid; }
        }
        return null;
      } finally { if (pending.get(state) === operation) pending.delete(state); for (const listener of observers.get(state) || []) listener(); }
    })();
    operation.job = job; return job;
  }
  function refresh() {
    if (state.run && !compatible() || state.status === 'starting' && !authId(account)) invalidate('invalid');
    render();
  }
  async function loadProfile() {
    const owner = authId(account), game = gameId(getGame());
    if (!owner || !game || typeof client.getLeaderboard !== 'function') return;
    profileController?.abort(); const controller = profileController = new AbortController();
    try {
      const data = await client.getLeaderboard(game, {signal: controller.signal});
      if (!disposed && !controller.signal.aborted && authId(account) === owner) { profile = Object.hasOwn(client, 'profile') ? client.profile : data.profile; profileOwner = owner; render(); }
    } catch { /* Public gameplay remains usable if the profile is unavailable. */ }
  }
  const click = event => {
    const action = event.target.closest('[data-ranked]')?.dataset.ranked;
    if (action === 'login') onLogin();
    if (action === 'start') void start();
    if (action === 'finish') {
      if (state.status === 'recording') getView()?.finish?.();
      void end();
    }
  };
  if (!observers.has(state)) observers.set(state, new Set());
  const sync = () => { if (state.receipt && state.owner === authId(account)) { profile = client.profile || state.receipt.profile; profileOwner = state.owner; } refresh(); };
  observers.get(state).add(sync);
  const unsubscribe = client.subscribe?.(() => { if (profileOwner === authId(account)) profile = client.profile; refresh(); });
  root.addEventListener('click', click); refresh(); void loadProfile();
  return {step, end, reset() { invalidate(); message = ''; render(); }, refresh() { refresh(); return loadProfile(); },
    dispose() { disposed = true; version++; startController?.abort(); profileController?.abort(); if (state.status === 'starting') state.status = 'idle'; unsubscribe?.(); observers.get(state).delete(sync); root.removeEventListener('click', click); }};
}
