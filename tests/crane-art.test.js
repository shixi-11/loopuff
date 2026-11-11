import test from 'node:test';
import assert from 'node:assert/strict';
import {craneArt,craneBatchArt} from '../src/crane-art.js';
import {dispatchPuzzle,inspectDispatch} from '../src/dispatch.js';

const attribute = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<g class="${name}"[^>]*>`, 'g'))].map(match => match[0]);
const destinations = svg => tags(svg,'crane-delivery').map(tag => ({
  signal:attribute(tag,'data-signal'), expected:attribute(tag,'data-expected'),
  x:Number(attribute(tag,'data-target-x')),y:Number(attribute(tag,'data-target-y')),
  match:attribute(tag,'data-match'),transform:attribute(tag,'transform')
}));

test('real correct and incorrect dispatch outputs arrive at different numbered berths',()=>{
  const puzzle=dispatchPuzzle(0,'manifest');
  const sampleIndex=3,sample=puzzle.cases[sampleIndex];
  const correct=inspectDispatch(0,'manifest',puzzle.example).cases[sampleIndex];
  const wrong=inspectDispatch(0,'manifest','for dock in docks { dock.log() }').cases[sampleIndex];
  assert.ok(correct.ok);assert.ok(!wrong.ok);
  assert.notDeepEqual(correct.result.logs,wrong.result.logs);
  const svg=craneBatchArt(wrong.result.logs,sample.logs);
  const docks=tags(svg,'crane-dock');
  const routes=destinations(svg);
  assert.equal(routes.length,wrong.result.logs.length);
  for(let i=0;i<routes.length;i++){
    const route=routes[i];
    assert.equal(route.signal,wrong.result.logs[i]);
    const actualDock=docks.find(tag=>attribute(tag,'data-dock')===route.signal);
    const expectedDock=docks.find(tag=>attribute(tag,'data-dock')===sample.logs[i]);
    assert.ok(actualDock);assert.ok(expectedDock);
    assert.equal(route.x,Number(attribute(actualDock,'data-dock-x')));
    assert.notEqual(route.x,Number(attribute(expectedDock,'data-dock-x')));
    assert.equal(route.match,'false');
  }
  assert.match(svg,/data-state="mismatch"/);
  const passed=craneBatchArt(correct.result.logs,sample.logs);
  assert.match(passed,/data-state="delivered"/);
  assert.ok(destinations(passed).every(route=>route.match==='true'));
});

test('animation lifts from the input platform and ends at the actual static cargo coordinates',()=>{
  const actual=['3','7','3'],expected=['3','5','3'];
  const animated=craneBatchArt(actual,expected,{animate:true});
  const still=craneBatchArt(actual,expected,{animate:false});
  assert.deepEqual(destinations(animated),destinations(still));
  const routes=destinations(still);
  const motions=tags(animated,'crane-motion');
  assert.deepEqual(motions.map(tag=>attribute(tag,'data-signal')),actual);
  // Evaluate the actual SVG motion's keyframe endpoints, not an unrelated plan.
  const transforms=[...animated.matchAll(/<animateTransform\b([^>]+)\/>/g)]
    .map(match=>match[1]).filter(attrs=>attribute(attrs,'values').startsWith('56 142;'));
  assert.equal(transforms.length,actual.length);
  transforms.forEach((attrs,i)=>{
    const points=attribute(attrs,'values').split(';').map(pair=>pair.split(' ').map(Number));
    assert.deepEqual(points[0],[56,142]);
    assert.ok(points[1][1]<points[0][1],'cargo first rises');
    assert.equal(points[2][0],routes[i].x,'cargo travels to its actual berth');
    assert.deepEqual(points.at(-1),[routes[i].x,routes[i].y]);
    assert.equal(routes[i].transform,`translate(${routes[i].x} ${routes[i].y})`);
    assert.equal(Number(attribute(attrs,'begin').replace('s','')),i*1.8);
    assert.equal(attribute(attrs,'dur'),'1.8s');
  });
  // Repeated destinations stack real crates rather than hiding earlier outputs.
  assert.equal(routes[0].x,routes[2].x);
  assert.ok(routes[2].y<routes[0].y);
  assert.ok(!still.includes('<animate'));
  assert.ok(!animated.includes('indefinite'));
});

test('idle, waiting and an intentionally empty batch never invent a successful delivery',()=>{
  const idle=craneBatchArt(['9'],['9'],{idle:true,animate:true});
  const waiting=craneBatchArt([],['9'],{waiting:true,animate:true});
  const empty=craneBatchArt([],[],{animate:true});
  assert.match(idle,/data-state="idle"/);assert.match(waiting,/data-state="waiting"/);assert.match(empty,/data-state="empty"/);
  for(const svg of [idle,waiting,empty]){
    assert.equal(destinations(svg).length,0);
    assert.ok(!svg.includes('class="crane-motion"'));
    assert.ok(!svg.includes('<animate'));
  }
  assert.ok(waiting.includes('class="crane-unfilled"'));
  assert.ok(!empty.includes('class="crane-unfilled"'));
});

test('nonnumeric output goes to the warning bay, never to the expected berth',()=>{
  const svg=craneArt('false','4',{animate:true});
  const [route]=destinations(svg);
  assert.equal(route.x,302);
  assert.equal(route.match,'false');
  const expectedDock=tags(svg,'crane-dock').find(tag=>attribute(tag,'data-dock')==='4');
  assert.notEqual(route.x,Number(attribute(expectedDock,'data-dock-x')));
  assert.match(svg,/data-state="mismatch"/);
});

test('missing or extra output remains a mismatch even when the common prefix is right',()=>{
  const missing=craneBatchArt(['2'],['2','3']);
  assert.equal(destinations(missing).length,1);
  assert.match(missing,/data-state="mismatch"/);
  assert.ok(missing.includes('class="crane-unfilled"'));
  const extra=craneBatchArt(['2','3'],['2']);
  assert.equal(destinations(extra).length,2);
  assert.equal(destinations(extra)[1].match,'false');
  assert.match(extra,/data-state="mismatch"/);
});

test('negative and zero signals keep distinct numbered destinations and escaped invalid output is inert',()=>{
  const svg=craneBatchArt(['0','-2'],['0','-2'],{animate:true});
  const routes=destinations(svg);
  assert.notEqual(routes[0].x,routes[1].x);
  assert.ok(routes.every(route=>Number.isFinite(route.x)&&route.x>=100&&route.x<=274));
  const hostile=craneArt('"><script>alert(1)</script>','1');
  assert.ok(!hostile.includes('<script>'));
  assert.ok(hostile.includes('&lt;script&gt;'));
  assert.equal(destinations(hostile)[0].x,302);
});
