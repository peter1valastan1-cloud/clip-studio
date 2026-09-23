import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticCut} from '../lib/editing.mjs';
test('automatic cut creates multiple separated windows from one video',()=>{
 const cuts=automaticCut([{id:'a',start:10,end:100}],15,3);
 assert.equal(cuts.length,5);assert.equal(cuts.reduce((s,c)=>s+c.end-c.start,0),15);
 cuts.forEach((c,i)=>{assert(c.start>=10&&c.end<=100);if(i)assert(c.start>cuts[i-1].end);});
});
test('alternates sources, respects trim bounds and keeps chronology',()=>{
 const cuts=automaticCut([{id:'a',start:2,end:32},{id:'b',start:4,end:34}],18,3);
 assert.deepEqual(cuts.map(c=>c.sourceId),['a','b','a','b','a','b']);
 for(const id of ['a','b']){const items=cuts.filter(c=>c.sourceId===id);assert(items[1].start>=items[0].end);}
});
test('caps timeline at 48 and preserves total duration with short inputs',()=>{
 const clips=[{id:'long',start:0,end:600},...Array.from({length:11},(_,i)=>({id:String(i),start:0,end:.5}))];
 const cuts=automaticCut(clips,120,1.5);assert(cuts.length<=48);assert(Math.abs(cuts.reduce((s,c)=>s+c.end-c.start,0)-120)<.001);assert(cuts.every(c=>c.end-c.start>=.499));
});
test('rerunning auto does not duplicate source videos',()=>{
 const first=automaticCut([{id:'a',start:0,end:60}],15,3).map((c,i)=>({...c,id:String(i)}));
 const next=automaticCut(first,15,1.5);assert.equal(new Set(next.map(c=>c.sourceId)).size,1);assert.equal(next.length,10);
});
