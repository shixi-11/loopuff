// Original pixel cargo-yard art. The only deliveries shown are actual outputs.
// SVG contains no language-specific labels; the surrounding UI supplies them.
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const numericDock = value => /^-?\d{1,3}$/.test(String(value));
const START_X = 56, FLOOR_Y = 142, LIFT_Y = 54, DURATION = 1.8;
const time = value => Number(value.toFixed(3));

function crate(value, match) {
  const label = String(value).length <= 4 ? escape(value) : '!';
  return `<g class="crane-container" data-match="${match}"><rect x="-11" y="0" width="22" height="10" fill="${match ? '#789eaa' : '#ac895d'}"/><path d="M-10 1h20M-7 3v5M-3 3v5M3 3v5M7 3v5" stroke="#d0ded3" stroke-width="1"/><rect x="-6" y="1" width="12" height="8" fill="#173441"/><text x="0" y="7" text-anchor="middle" fill="#edf2d4" font-size="6" font-family="monospace">${label}</text></g>`;
}

function rig(x, y) {
  return `<rect x="${x - 5}" y="30" width="10" height="7" fill="#edc877"/><path d="M${x} 37V${y - 5}h4v4h-4" fill="none" stroke="#e3cb8c" stroke-width="2"/>`;
}

function motion(route, index) {
  const {x, y, value, match} = route, begin = time(index * DURATION);
  const times = '0;.18;.58;.72;.86;1';
  const positions = `${START_X} ${FLOOR_Y};${START_X} ${LIFT_Y};${x} ${LIFT_Y};${x} ${y};${x} ${y};${x} ${y}`;
  // One finite, non-looping lift/travel/lower cycle per emitted signal.
  return `<g class="crane-motion" visibility="hidden" data-output-index="${index}" data-signal="${escape(value)}" data-target-x="${x}" data-target-y="${y}">
    <set attributeName="visibility" to="visible" begin="${begin}s" dur="${DURATION}s"/>
    <g><animateTransform attributeName="transform" type="translate" values="${START_X} 0;${START_X} 0;${x} 0;${x} 0;${x} 0;${START_X} 0" keyTimes="${times}" begin="${begin}s" dur="${DURATION}s" fill="freeze"/>
      <rect x="-5" y="30" width="10" height="7" fill="#edc877"/>
      <path d="M0 37V137h4v4h-4" fill="none" stroke="#e3cb8c" stroke-width="2"><animate attributeName="d" values="M0 37V137h4v4h-4;M0 37V49h4v4h-4;M0 37V49h4v4h-4;M0 37V${y - 5}h4v4h-4;M0 37V49h4v4h-4;M0 37V49h4v4h-4" keyTimes="${times}" begin="${begin}s" dur="${DURATION}s" fill="freeze"/></path>
    </g>
    <g transform="translate(${START_X} ${FLOOR_Y})"><set attributeName="visibility" to="hidden" begin="${time(begin + DURATION * .72)}s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="${positions}" keyTimes="${times}" begin="${begin}s" dur="${DURATION}s" fill="freeze"/>${crate(value, match)}</g>
  </g>`;
}

/**
 * A batch uses one crane, sequentially lifting each real output. Distinct
 * integer signals get distinct numbered berths; invalid/overflow signals go
 * to the warning bay. Expected values never create a fictitious delivery.
 */
export function craneBatchArt(signals = [], expected = [], {idle = false, animate = false, waiting = false} = {}) {
  const actual = idle ? [] : signals.slice(0, 8).map(String);
  const wanted = expected.slice(0, 8).map(String);
  const docks = [...new Set([...wanted, ...actual].filter(numericDock))].slice(0, 8);
  const positions = new Map(docks.map((value, i) => [value, docks.length === 1 ? 226 : Math.round(100 + i * 174 / (docks.length - 1))]));
  const piles = new Map();
  const routes = actual.map((value, i) => {
    const x = positions.get(value) ?? 302, layer = piles.get(x) || 0;
    piles.set(x, layer + 1);
    return {value, x, y: FLOOR_Y - layer * 11, match: value === wanted[i]};
  });
  const state = idle ? 'idle' : waiting ? 'waiting' : !actual.length ? 'empty' : actual.length === wanted.length && routes.every(route => route.match) ? 'delivered' : 'mismatch';
  const active = animate && routes.length > 0;
  const dockArt = docks.map(value => {
    const x = positions.get(value);
    return `<g class="crane-dock" data-dock="${escape(value)}" data-dock-x="${x}" data-expected="${wanted.includes(value)}"><rect x="${x - 12}" y="154" width="24" height="6" fill="#35545e"/><path d="M${x - 10} 155h4m3 0h4m3 0h4" stroke="#93b3ae" stroke-width="2"/><text x="${x}" y="174" text-anchor="middle" fill="#b6c9cf" font-family="monospace" font-size="8">${escape(value)}</text></g>`;
  }).join('');
  const deliveries = routes.map((route, i) => `<g class="crane-delivery" data-output-index="${i}" data-signal="${escape(route.value)}" data-expected="${escape(wanted[i] ?? '')}" data-match="${route.match}" data-target-x="${route.x}" data-target-y="${route.y}" transform="translate(${route.x} ${route.y})" visibility="${active ? 'hidden' : 'visible'}">${active ? `<set attributeName="visibility" to="visible" begin="${time((i + .72) * DURATION)}s" fill="freeze"/>` : ''}${crate(route.value, route.match)}${route.match ? '' : '<path d="M-3 -5h6v2h-6M-1 -9h2v3h-2" fill="#f0cb82"/>'}</g>`).join('');
  const missing = !idle && (wanted.length > actual.length || waiting);
  const rest = `<g class="crane-rest" visibility="${active ? 'hidden' : 'visible'}">${active ? `<set attributeName="visibility" to="visible" begin="${time(routes.length * DURATION)}s" fill="freeze"/>` : ''}${rig(START_X, routes.length ? LIFT_Y : FLOOR_Y)}</g>`;
  return `<svg class="crane-yard${active ? ' crane-is-animated' : ''}" viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" focusable="false" data-state="${state}" data-deliveries="${routes.length}">
    <rect width="320" height="180" fill="#0c192b"/><path d="M0 132h32v28H0m70-18h19v18H70m216-35h34v35h-34" fill="#132b3c"/>
    <path d="M63 12h2v2h-2m52 4h2v2h-2m82-9h2v2h-2m63 12h2v2h-2" fill="#728fa5"/>
    <rect y="160" width="320" height="3" fill="#48616a"/><rect y="163" width="320" height="17" fill="#102432"/>
    <rect x="41" y="154" width="31" height="6" fill="#53747a"/><path d="M44 155h5m4 0h5m4 0h5" stroke="#b4c9b3" stroke-width="2"/>
    ${dockArt}
    <g class="crane-warning-bay"><rect x="289" y="154" width="29" height="6" fill="#8c744d"/><path d="M289 156l4-2m2 4l6-4m1 4l6-4m1 4l6-4" stroke="#e6c987" stroke-width="2"/><text x="302" y="174" text-anchor="middle" fill="#e6c987" font-family="monospace" font-size="9">!</text></g>
    <g fill="#c49d55"><rect x="16" y="30" width="10" height="128"/><rect x="7" y="158" width="40" height="4"/><rect x="7" y="26" width="300" height="5"/><rect x="16" y="17" width="291" height="4"/><rect x="4" y="30" width="12" height="12"/><rect x="27" y="34" width="22" height="15"/></g>
    <path d="M21 38v116m-4-111h8m-8 12h8m-8 12h8m-8 12h8m-8 12h8m-8 12h8m-8 12h8m-8 12h8m-8 12h8m-8 12h8M27 26l10-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5 12 5 12-5" fill="none" stroke="#e3bf72" stroke-width="2"/>
    <rect x="30" y="36" width="15" height="8" fill="#31505a"/><rect x="31" y="37" width="3" height="4" fill="#83b0b3"/>
    ${idle ? `<g transform="translate(${START_X} ${FLOOR_Y})" opacity=".45">${crate('—', true)}</g>` : ''}
    ${missing ? '<g class="crane-unfilled" fill="none" stroke="#e0c285" stroke-width="1" stroke-dasharray="2 2"><rect x="45" y="142" width="22" height="10"/></g>' : ''}
    ${deliveries}${rest}${active ? routes.map(motion).join('') : ''}
  </svg>`;
}

/** Single-output counterpart, useful for cards and small previews. */
export function craneArt(signal, expected, options = {}) {
  return craneBatchArt(signal === null || signal === undefined ? [] : [signal], expected === null || expected === undefined ? [] : [expected], options);
}
