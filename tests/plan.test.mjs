import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan } from '../lib/plan.mjs';
test('distributes target duration, retaining short clips',()=>{const p=makePlan([{start:0,end:2},{start:0,end:20},{start:0,end:30}],15);assert.deepEqual(p.map(c=>c.length),[2,6.5,6.5]);assert.equal(p[1].start,6.75);});
test('preserves manual ranges when target exceeds source duration',()=>{assert.deepEqual(makePlan([{start:3,end:9}],30),[{start:3,end:9,length:6}]);});
test('enforces 120 second cap for whole video',()=>{assert.equal(makePlan([{start:0,end:200}],0)[0].length,120);});
test('rejects malformed ranges and nonfinite inputs',()=>{for(const clips of [[],[{start:-1,end:4}],[{start:0,end:Infinity}],[{start:0,end:.1}]])assert.throws(()=>makePlan(clips));assert.throws(()=>makePlan([{start:0,end:4}],NaN));});
test('never creates segments shorter than minimum',()=>{assert.throws(()=>makePlan([{start:0,end:2},{start:0,end:2}],.5));});
