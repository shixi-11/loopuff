import {run} from './runner.js';
import {createBlocks,stepBlocks,observeBlocks,drawBlocks} from './handheld-blocks.js';
import {createTanks,stepTanks,observeTanks,drawTanks} from './handheld-tanks.js';
import {createFlight,stepFlight,observeFlight,drawFlight} from './handheld-flight.js';
export const cartridges=[
 {id:'blocks',create:createBlocks,step:stepBlocks,observe:observeBlocks,draw:drawBlocks,actions:{0:0,1:1,2:2,3:3,4:4,6:3,7:5},strategy:'if x < targetX then { right() } else {\n  if x > targetX then { left() } else { drop() }\n}'},
 {id:'tanks',create:createTanks,step:stepTanks,observe:observeTanks,draw:drawTanks,actions:{0:0,1:4,2:2,3:1,4:3,5:5},strategy:'if danger > 0 then { left() } else { up() };\nfire()'},
 {id:'flight',create:createFlight,step:stepFlight,observe:observeFlight,draw:drawFlight,actions:{0:0,1:1,2:2,3:4,4:5,5:3},strategy:'if enemyX > x then { right() } else { left() };\nfire()'}
];
export const gameCommands={left:1,right:2,up:3,down:4,fire:5,rotate:6,drop:7,wait:0,start:2001,pause:2002,finish:2003};
const helpers='sync fn choose(id) { if id > 0 then { if id < 4 then { (1000 + id).log() } else { 9999.log() } } else { 9999.log() }; return 0 };\n'+Object.entries(gameCommands).map(([name,value])=>`sync fn ${name}() { ${value}.log(); return 0 };`).join('\n');
export function newHandheld(seed=1){return {selected:0,seed:seed>>>0,status:'ready',world:cartridges[0].create(seed),activeMs:0,automatic:false};}
export function handheldInput(session){return {game:session.selected+1,playing:session.status==='running'?1:0,...cartridges[session.selected].observe(session.world)};}
export function compileHandheld(source,session,{strategy=false}={}){
 if(typeof source!=='string'||source.length>4096)throw Error('limit');
 const input=strategy?Object.entries(handheldInput(session)).map(([key,value])=>`let ${key} = ${Math.round(value)};`).join('\n'):'';
 const result=run(helpers+'\n'+input+'\n'+source);if(result.waiting)throw Error('waiting');
 if(result.logs.length>32)throw Error('limit');
 const commands=result.logs.map(value=>{if(!/^\d+$/.test(value))throw Error('command');return Number(value);});
 let selected=session.selected;
 for(const command of commands){
  if(command>=1001&&command<=1003){if(strategy)throw Error('lifecycle');selected=command-1001;}
  else if([2001,2002,2003].includes(command)){if(strategy)throw Error('lifecycle');}
  else if(!Object.hasOwn(cartridges[selected].actions,command))throw Error('command');
 }
 return {commands,result};
}
export function applyHandheld(session,commands){
 let selected=session.selected;
 // Validate the whole batch before changing a game, even for non-editor callers.
 for(const command of commands){if(command>=1001&&command<=1003)selected=command-1001;else if(![2001,2002,2003].includes(command)&&!Object.hasOwn(cartridges[selected].actions,command))throw Error('command');}
 const actions=[];
 for(const command of commands){
  if(command>=1001&&command<=1003){session.selected=command-1001;session.seed++;session.world=cartridges[session.selected].create(session.seed);session.status='ready';session.activeMs=0;session.automatic=false;actions.length=0;}
  else if(command===2001){if(session.world.over||session.status==='ended'){session.seed++;session.world=cartridges[session.selected].create(session.seed);session.activeMs=0;}session.status='running';}
  else if(command===2002){if(session.status==='running')session.status='paused';}
  else if(command===2003){session.status='ended';session.automatic=false;actions.length=0;}
  else if(session.status==='running')actions.push(cartridges[session.selected].actions[command]);
 }
 return actions;
}
