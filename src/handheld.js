import {run} from './runner.js';
import {createBlocks,stepBlocks,observeBlocks,drawBlocks} from './handheld-blocks.js';
import {createTanks,stepTanks,observeTanks,drawTanks} from './handheld-tanks.js';
import {createFlight,stepFlight,observeFlight,drawFlight} from './handheld-flight.js';
import {createSnake,stepSnake,observeSnake,drawSnake} from './handheld-snake.js';
import {createBreakout,stepBreakout,observeBreakout,drawBreakout} from './handheld-breakout.js';
import {createSokoban,stepSokoban,observeSokoban,drawSokoban} from './handheld-sokoban.js';
export const cartridges=[
 {id:'blocks',discrete:true,physical:{a:6,b:7},commands:'left(); right(); rotate(); down(); drop()',create:createBlocks,step:stepBlocks,observe:observeBlocks,draw:drawBlocks,actions:{0:0,1:1,2:2,3:3,4:4,6:3,7:5},strategy:'if x < targetX then { right() } else {\n  if x > targetX then { left() } else { drop() }\n}'},
 {id:'tanks',physical:{a:5,b:5},commands:'left(); right(); up(); down(); fire()',create:createTanks,step:stepTanks,observe:observeTanks,draw:drawTanks,actions:{0:0,1:4,2:2,3:1,4:3,5:5},strategy:'if danger > 0 then { left() } else { up() };\nfire()'},
 {id:'flight',physical:{a:5,b:5},commands:'left(); right(); up(); down(); fire()',create:createFlight,step:stepFlight,observe:observeFlight,draw:drawFlight,actions:{0:0,1:1,2:2,3:4,4:5,5:3},strategy:'if enemyX > x then { right() } else { left() };\nfire()'},
 {id:'snake',create:createSnake,step:stepSnake,observe:observeSnake,draw:drawSnake,physical:{a:null,b:null},commands:'left(); right(); up(); down()',actions:{0:0,1:1,2:2,3:3,4:4},strategy:'if foodX > headX then { if dangerRight == 0 then { right() } } else { if foodX < headX then { if dangerLeft == 0 then { left() } } };\nif foodY > headY then { if dangerDown == 0 then { down() } } else { if foodY < headY then { if dangerUp == 0 then { up() } } }'},
 {id:'breakout',create:createBreakout,step:stepBreakout,observe:observeBreakout,draw:drawBreakout,physical:{a:5,b:null},commands:'left(); right(); fire()',actions:{0:0,1:1,2:2,5:3},strategy:'if attached == 1 then { fire() } else {\n if ballX > paddleX + 20 then { right() } else { if ballX < paddleX - 20 then { left() } else { wait() } }\n}'},
 {id:'sokoban',create:createSokoban,step:stepSokoban,observe:observeSokoban,draw:drawSokoban,discrete:true,physical:{a:8,b:9},commands:'left(); right(); up(); down(); undo(); restart()',actions:{0:0,1:4,2:2,3:1,4:3,8:5,9:6},strategy:'if right == 3 then { right() } else { wait() }'}

];
export const gameCommands={left:1,right:2,up:3,down:4,fire:5,rotate:6,drop:7,wait:0,undo:8,restart:9,start:2001,pause:2002,finish:2003};
const helpers=`sync fn choose(id) { if id > 0 then { if id < ${cartridges.length+1} then { (1000 + id).log() } else { 9999.log() } } else { 9999.log() }; return 0 };\n`+Object.entries(gameCommands).map(([name,value])=>`sync fn ${name}() { ${value}.log(); return 0 };`).join('\n');
export function newHandheld(seed=1){return {selected:0,seed:seed>>>0,status:'ready',world:cartridges[0].create(seed),activeMs:0,automatic:false};}
export function handheldInput(session){return {game:session.selected+1,playing:session.status==='running'?1:0,...cartridges[session.selected].observe(session.world)};}
export function compileHandheld(source,session,{strategy=false}={}){
 if(typeof source!=='string'||source.length>4096)throw Error('limit');
 const input=strategy?Object.entries(handheldInput(session)).map(([key,value])=>`let ${key} = ${Math.round(value)};`).join('\n'):'';
 const prefix=helpers+'\n'+input+'\n';let result;try{result=run(prefix+source);}catch(error){if(Number.isInteger(error.position))error.position=Math.max(0,Math.min(source.length,error.position-prefix.length));throw error;}if(result.waiting)throw Error('waiting');
 if(result.logs.length>(strategy?(cartridges[session.selected].discrete?1:4):32))throw Error('limit');
 const commands=result.logs.map(value=>{if(!/^\d+$/.test(value))throw Error('command');return Number(value);});
 let selected=session.selected;
 for(const command of commands){
  if(command>=1001&&command<1001+cartridges.length){if(strategy)throw Error('lifecycle');selected=command-1001;}
  else if([2001,2002,2003].includes(command)){if(strategy)throw Error('lifecycle');}
  else if(!Object.hasOwn(cartridges[selected].actions,command))throw Error('command');
 }
 return {commands,result};
}
export function applyHandheld(session,commands){
 let selected=session.selected;
 // Validate the whole batch before changing a game, even for non-editor callers.
 for(const command of commands){if(command>=1001&&command<1001+cartridges.length)selected=command-1001;else if(![2001,2002,2003].includes(command)&&!Object.hasOwn(cartridges[selected].actions,command))throw Error('command');}
 const actions=[];
 for(const command of commands){
  if(command>=1001&&command<1001+cartridges.length){session.selected=command-1001;session.seed++;session.world=cartridges[session.selected].create(session.seed);session.status='ready';session.activeMs=0;session.automatic=false;actions.length=0;}
  else if(command===2001){if(session.world.over||session.status==='ended'){session.seed++;session.world=cartridges[session.selected].create(session.seed);session.activeMs=0;}session.status='running';}
  else if(command===2002){if(session.status==='running')session.status='paused';}
  else if(command===2003){session.status='ended';session.automatic=false;actions.length=0;}
  else if(session.status==='running')actions.push(cartridges[session.selected].actions[command]);
 }
 return actions;
}
