import { mkdir, writeFile, readFile, readdir, rm, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { makePlan } from './plan.mjs';
import { transitions, looks, lookFilters, overlap } from './editing.mjs';
import { run, probe, ffmpeg } from './media.mjs';
// Runtime uploads are not build assets and must never be bundled.
export const root=path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || '.data');
const state=globalThis.__clipstudio || (globalThis.__clipstudio={busy:false});
export function reserve(){if(state.busy)return false;state.busy=true;return true;}
export function release(){state.busy=false;}
export function jobDir(id){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Neplatný export.');return path.join(root,id);}
export async function status(id,data){const dir=jobDir(id);await writeFile(path.join(dir,'status.tmp'),JSON.stringify(data));await rename(path.join(dir,'status.tmp'),path.join(dir,'status.json'));}
export async function readStatus(id){return JSON.parse(await readFile(path.join(jobDir(id),'status.json'),'utf8'));}
export async function cleanup(){
  await mkdir(root,{recursive:true});
  for(const entry of await readdir(root,{withFileTypes:true})){
    if(!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name))continue;
    const dir=jobDir(entry.name);
    if(Date.now()-(await stat(dir)).mtimeMs>24*60*60*1000)await rm(dir,{recursive:true,force:true});
  }
}
const enc=['-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','192k','-ar','48000'];
const escapeXML=s=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export async function render(id, manifest, files, music) {
  const dir=jobDir(id);
  try {
    await status(id,{state:'processing',progress:2,message:'Kontrolujem videá'});
    if(!manifest || !Array.isArray(manifest.clips))throw new Error('Neúplný zoznam klipov.');
    const sources=manifest.clips.map((c,i)=>c.sourceIndex??i);
    if(sources.some(i=>!Number.isInteger(i)||i<0||i>=files.length))throw new Error('Neplatný zdroj klipu.');
    if(!Object.hasOwn(transitions,manifest.transition))throw new Error('Neplatný prechod.');
    const look=manifest.look??'none',frame=manifest.frame??'none',titleStyle=manifest.titleStyle??'classic';
    if(!Object.hasOwn(looks,look)||!['none','white','lime','corners'].includes(frame)||!['classic','minimal','banner'].includes(titleStyle))throw new Error('Neplatná grafika.');
    if(manifest.clips.some(c=>c.framing!==undefined&&!['crop','fit'].includes(c.framing)))throw new Error('Neplatné zobrazenie klipu.');
    if(typeof manifest.title!=='string' || manifest.title.length>80)throw new Error('Titulok má limit 80 znakov.');
    if(typeof manifest.mute!=='boolean' || !Number.isFinite(manifest.musicVolume) || manifest.musicVolume<0 || manifest.musicVolume>1)throw new Error('Neplatné nastavenie zvuku.');
    const plan=makePlan(manifest.clips,Number(manifest.target));
    const cross=overlap(manifest.transition);
    const total=plan.reduce((s,c)=>s+c.length,0)-cross*(plan.length-1);
    const metadata=[];for(const file of files)metadata.push(await probe(file));
    for(let i=0;i<plan.length;i++) {
      const info=metadata[sources[i]];
      const video=info.streams.find(s=>s.codec_type==='video');
      const duration=Number(video?.duration || info.format.duration);
      if(!video || !Number.isFinite(duration) || duration>600 || duration<.5 || manifest.clips[i].end>duration+.08)throw new Error(`Klip ${i+1}: neplatná dĺžka alebo nepodporované video.`);
      const audio=info.streams.some(s=>s.codec_type==='audio');
      const {start,length}=plan[i];
      const fade=Math.min(.25,length/3);
      // FFmpeg autorotates before filtering. Normalize pixel aspect ratio before fitting.
      const framing=manifest.clips[i].framing??'crop';
      const layout=framing==='fit'
        ? 'split[bg][fg];[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=12:2,scale=1080:1920[back];[fg]scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2[front];[back][front]overlay=(W-w)/2:(H-h)/2'
        : 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
      const fadeColor=manifest.transition==='white'?'white':'black';
      const vf=`scale=trunc(iw*sar/2)*2:ih,setsar=1,${layout},setsar=1,fps=30,setpts=PTS-STARTPTS,format=yuv420p,${lookFilters[look]}${['fade','white'].includes(manifest.transition)?`,fade=t=in:st=0:d=${fade}:color=${fadeColor},fade=t=out:st=${length-fade}:d=${fade}:color=${fadeColor}`:''}`;
      const args=['-y','-v','error','-threads','2','-filter_threads','1','-protocol_whitelist','file,pipe','-ss',String(start),'-i',files[sources[i]]];
      if(!audio || manifest.mute)args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
      args.push('-map','0:v:0','-map',!audio||manifest.mute?'1:a:0':'0:a:0','-vf',vf,'-af',`aresample=48000,asetpts=PTS-STARTPTS,apad${manifest.transition==='fade'?`,afade=t=in:st=0:d=${fade},afade=t=out:st=${length-fade}:d=${fade}`:''}`,'-ac','2','-t',String(length),...enc,`clip-${i}.mp4`);
      await run(ffmpeg,args,{cwd:dir});
      await status(id,{state:'processing',progress:Math.round(5+(i+1)/plan.length*55),message:`Pripravený úsek ${i+1} z ${plan.length}`});
    }
    if(cross&&plan.length>1){
      // Merge in batches of at most six inputs to bound decoder/filter memory.
      let previous='clip-0.mp4',duration=Number((await probe(path.join(/* turbopackIgnore: true */ dir,previous))).format.duration);
      for(let start=1;start<plan.length;start+=5){
        const end=Math.min(plan.length,start+5),joinArgs=['-y','-v','error','-threads','2','-filter_complex_threads','1','-i',previous],chain=[];
        for(let i=start;i<end;i++)joinArgs.push('-threads','2','-i',`clip-${i}.mp4`);
        chain.push('[0:v]settb=AVTB,setpts=PTS-STARTPTS[v0]','[0:a]asetpts=PTS-STARTPTS[a0]');
        for(let i=start,j=1;i<end;i++,j++){
          const nextDuration=Number((await probe(path.join(dir,`clip-${i}.mp4`))).format.duration);
          chain.push(`[${j}:v]settb=AVTB,setpts=PTS-STARTPTS[n${j}];[v${j-1}][n${j}]xfade=transition=${manifest.transition==='dissolve'?'fade':manifest.transition}:duration=${cross}:offset=${duration-cross}[v${j}]`);
          chain.push(`[a${j-1}][${j}:a]acrossfade=d=${cross}[a${j}]`);duration+=nextDuration-cross;
        }
        const count=end-start,out=`merge-${start}.mp4`;
        joinArgs.push('-filter_complex',chain.join(';'),'-map',`[v${count}]`,'-map',`[a${count}]`,...enc,out);
        await run(ffmpeg,joinArgs,{cwd:dir});previous=out;
        await status(id,{state:'processing',progress:Math.round(60+end/plan.length*12),message:'Vytváram prechody'});
      }
      await rename(path.join(/* turbopackIgnore: true */ dir,previous),path.join(dir,'joined.mp4'));
    }else{
      await writeFile(path.join(dir,'list.txt'),plan.map((_,i)=>`file 'clip-${i}.mp4'`).join('\n'));
      await run(ffmpeg,['-y','-v','error','-f','concat','-safe','1','-i','list.txt','-c','copy','joined.mp4'],{cwd:dir});
    }
    const args=['-y','-v','error','-threads','2','-filter_complex_threads','1','-i','joined.mp4'];
    let inputIndex=1, musicIndex=-1, titleIndex=-1;
    if(music){ const info=await probe(music);if(!info.streams.some(s=>s.codec_type==='audio'))throw new Error('Hudobný súbor neobsahuje zvuk.'); musicIndex=inputIndex++;args.push('-stream_loop','-1','-protocol_whitelist','file,pipe','-i',music); }
    if(manifest.title.trim()||frame!=='none') {
      const words=manifest.title.trim().split(/\s+/); const lines=[''];
      for(const word of words) {if((lines.at(-1)+word).length>24 && lines.at(-1))lines.push('');lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
      const rows=lines.flatMap(s=>s.match(/.{1,24}/gu)||[]);
      const height=rows.length*68+52;
      const frameSvg=frame==='none'?'':frame==='corners'?'<path d="M36 170V36H170 M910 36H1044V170 M36 1750V1884H170 M910 1884H1044V1750" fill="none" stroke="white" stroke-width="8"/>':`<rect x="24" y="24" width="1032" height="1872" rx="12" fill="none" stroke="${frame==='lime'?'#d6fc79':'white'}" stroke-width="12"/>`;
      const titleSvg=!manifest.title.trim()?'':`${titleStyle==='minimal'?'':`<rect x="80" y="${1560-height}" width="920" height="${height}" rx="${titleStyle==='banner'?0:24}" fill="${titleStyle==='banner'?'#d6fc79':'#111112'}" fill-opacity="${titleStyle==='banner'?1:.72}"/>`}${rows.map((s,i)=>`<text x="540" y="${1560-height+74+i*68}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="54" font-weight="bold" ${titleStyle==='minimal'?'stroke="#111" stroke-width="2" paint-order="stroke"':''} fill="${titleStyle==='banner'?'#18200e':'white'}">${escapeXML(s)}</text>`).join('')}`;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">${frameSvg}${titleSvg}</svg>`;
      await sharp(Buffer.from(svg)).png().toFile(path.join(dir,'title.png'));
      titleIndex=inputIndex++;args.push('-loop','1','-i','title.png');
    }
    const filters=[];
    if(titleIndex>=0)filters.push(`[0:v][${titleIndex}:v]overlay=0:0:shortest=1[v]`);
    if(musicIndex>=0)filters.push(`[${musicIndex}:a]aresample=48000,volume=${manifest.musicVolume},afade=t=out:st=${Math.max(0,total-.6)}:d=0.6[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]`);
    if(filters.length)args.push('-filter_complex',filters.join(';'));
    args.push('-map',titleIndex>=0?'[v]':'0:v:0','-map',musicIndex>=0?'[a]':'0:a:0','-t',String(total),...enc,'-movflags','+faststart','result.mp4');
    await status(id,{state:'processing',progress:75,message:'Spájam obraz, titulok a zvuk'});
    await run(ffmpeg,args,{cwd:dir});
    const result=await probe(path.join(dir,'result.mp4'));
    await status(id,{state:'done',progress:100,message:'Video je pripravené',duration:Number(result.format.duration)});
  } catch(e) {
    console.error('Export:',e);
    await status(id,{state:'error',progress:0,message:e.message.startsWith('Spracovanie média')?'Video sa nepodarilo spracovať. Skúste iný súbor alebo kratšie úseky.':e.message});
  } finally {
    // Keep only the result and status; originals never outlive processing.
    try { for(const name of await readdir(dir))if(!['status.json','result.mp4'].includes(name))await rm(path.join(dir,name),{force:true}); }
    finally { release(); }
  }
}
