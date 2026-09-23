// Real end-to-end HTTP test. Start npm run dev/start before running this file.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { run, ffmpeg, probe } from '../lib/media.mjs';
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
const dir=await mkdtemp(path.join(tmpdir(),'clipstudio-test-'));
try {
 await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','color=c=blue:s=640x360:r=24:d=2,drawbox=x=0:y=0:w=120:h=360:color=red:t=fill,drawbox=x=520:y=0:w=120:h=360:color=lime:t=fill','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path.join(dir,'one.mp4')]);
 await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','color=c=red:s=360x640:r=30:d=2','-c:v','libx264','-pix_fmt','yuv420p',path.join(dir,'two.mp4')]);
 await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','sine=frequency=220:duration=1',path.join(dir,'music.wav')]);
 for(const transition of ['fade','cut','white','dissolve','wipeleft','slideleft']) {
  const data=new FormData();
  const extended=!['fade','cut'].includes(transition);
  const longJoin=transition==='dissolve';
  const clips=longJoin?Array.from({length:7},(_,i)=>({start:0,end:.5,sourceIndex:i%2,framing:'fit'})):[{start:.2,end:1.7,sourceIndex:0,framing:transition==='fade'?'fit':'crop'},{start:0,end:2,sourceIndex:1,framing:'crop'}];
  const look=({white:'bw',dissolve:'warm',wipeleft:'cool',slideleft:'vintage'})[transition]??'none';
  data.append('manifest',JSON.stringify({clips,target:longJoin?0:3,transition,title:transition==='fade'?'Život je krásny — 100% <3':extended?'Nový strih':'',mute:transition==='cut',musicVolume:.2,look,frame:extended?'lime':'none',titleStyle:transition==='white'?'minimal':'banner'}));
  data.append('video',new Blob([await readFile(path.join(dir,'one.mp4'))]),'one.mp4');data.append('video',new Blob([await readFile(path.join(dir,'two.mp4'))]),'two.mp4');
  if(transition==='fade')data.append('music',new Blob([await readFile(path.join(dir,'music.wav'))]),'music.wav');
  const response=await fetch(`${base}/api/exports`,{method:'POST',headers:{origin:base},body:data});const accepted=await response.json();assert.equal(response.status,202,JSON.stringify(accepted));
  let job;const deadline=Date.now()+180000;
  do {await new Promise(r=>setTimeout(r,700));job=await (await fetch(`${base}/api/exports/${accepted.id}`)).json();assert.notEqual(job.state,'error',job.message);}while(job.state!=='done'&&Date.now()<deadline);
  assert.equal(job.state,'done','Export timed out');
  const download=await fetch(`${base}/api/exports/${accepted.id}/download`);assert.equal(download.status,200);
  const output=path.join(dir,`${transition}.mp4`);await writeFile(output,Buffer.from(await download.arrayBuffer()));
  const expected=longJoin?2.3:['wipeleft','slideleft'].includes(transition)?2.8:3;
  const meta=await probe(output);const v=meta.streams.find(s=>s.codec_type==='video');assert.equal(v.width,1080);assert.equal(v.height,1920);assert.equal(v.codec_name,'h264');assert(meta.streams.some(s=>s.codec_name==='aac'));assert(Math.abs(Number(meta.format.duration)-expected)<.15,`${transition}: ${meta.format.duration} vs ${expected}`);
  const range=await fetch(`${base}/api/exports/${accepted.id}/download?preview=1`,{headers:{range:'bytes=0-99'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,100);
  const frame=path.join(dir,`${transition}.png`);
  await run(ffmpeg,['-y','-v','error','-ss','0.7','-i',output,'-frames:v','1',frame]);
  const pixel=async(x,y)=>[...await sharp(frame).extract({left:x,top:y,width:1,height:1}).removeAlpha().raw().toBuffer()];
  const left=await pixel(40,960),right=await pixel(1040,960),top=await pixel(540,150);
  if(transition==='fade'){
   assert(left[0]>180&&left[1]<60&&left[2]<60,`Left edge must remain red: ${left}`);
   assert(right[1]>180&&right[0]<60&&right[2]<60,`Right edge must remain green: ${right}`);
   assert(top[2]>180,`Background must be filled from video: ${top}`);
  }else if(transition==='cut'){
   assert(left[2]>180&&right[2]>180,'Crop must show blue center without side markers');
  }
  assert.equal(v.sample_aspect_ratio,'1:1');
  if(extended){const border=await pixel(24,960);assert(border[0]>150&&border[1]>180&&border[2]<170,`Lime frame missing: ${border}`);}
  if(transition==='white'){const center=await pixel(540,960);assert(Math.abs(center[0]-center[1])<8&&Math.abs(center[1]-center[2])<8,'Grayscale not applied');}
  console.log(`PASS: ${transition}, 1080×1920 H.264 + AAC, ${meta.format.duration}s, download and seeking`);
 }
 const invalid=new FormData();invalid.append('manifest','{}');const r=await fetch(`${base}/api/exports`,{method:'POST',body:invalid});assert.equal(r.status,400);console.log('PASS: invalid upload rejected');
 const foreign=await fetch(`${base}/api/exports`,{method:'POST',headers:{origin:'https://other.example'},body:invalid});assert.equal(foreign.status,403);console.log('PASS: foreign origin rejected');
} finally {await rm(dir,{recursive:true,force:true});}
