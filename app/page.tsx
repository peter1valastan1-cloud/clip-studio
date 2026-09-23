'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Download, Film, GripVertical, LoaderCircle, Music2, Plus, Scissors, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { makePlan } from '../lib/plan.mjs';
import { automaticCut, transitions, looks, previewFilters, overlap } from '../lib/editing.mjs';
type Clip={id:string,sourceId?:string,file:File,url:string,duration:number,start:number,end:number,width:number,height:number,framing:'crop'|'fit'};
type Job={id:string,state:string,progress:number,message:string};
const time=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toFixed(1).padStart(4,'0')}`;
async function inspect(file:File):Promise<Clip>{
 const url=URL.createObjectURL(file);
 try {
  let width=0,height=0;
  const duration=await new Promise<number>((resolve,reject)=>{
   const v=document.createElement('video');v.preload='metadata';const timer=setTimeout(()=>done(new Error('Video sa nepodarilo načítať.')),15000);
   function done(error?:Error){clearTimeout(timer);v.onloadedmetadata=null;v.onerror=null;v.removeAttribute('src');v.load();error?reject(error):resolve(vDuration);}
   let vDuration=0;
   v.onloadedmetadata=()=>{vDuration=v.duration;width=v.videoWidth;height=v.videoHeight;done(!Number.isFinite(vDuration)||vDuration<.5||vDuration>600?new Error('Video musí mať 0,5 sekundy až 10 minút.'):undefined);};
   v.onerror=()=>done(new Error('Prehliadač tento formát nevie prehrať. Skúste MP4 (H.264).'));v.src=url;
  });
  return {id:crypto.randomUUID(),file,url,duration,start:0,end:duration,width,height,framing:width>height?'fit':'crop'};
 }catch(e){URL.revokeObjectURL(url);throw e;}
}
export default function Studio(){
 const [clips,setClips]=useState<Clip[]>([]),[selected,setSelected]=useState(''),[drag,setDrag]=useState(false),[adding,setAdding]=useState(false);
 const [title,setTitle]=useState(''),[target,setTarget]=useState(30),[transition,setTransition]=useState('fade'),[mute,setMute]=useState(false),[music,setMusic]=useState<File|null>(null),[volume,setVolume]=useState(.3);
 const [pace,setPace]=useState(3),[undo,setUndo]=useState<Clip[]|null>(null);
 const [look,setLook]=useState<keyof typeof looks>('none'),[frame,setFrame]=useState('none'),[titleStyle,setTitleStyle]=useState('classic');
 const [job,setJob]=useState<Job|null>(null),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[result,setResult]=useState('');
 const input=useRef<HTMLInputElement>(null),musicInput=useRef<HTMLInputElement>(null),video=useRef<HTMLVideoElement>(null),backdrop=useRef<HTMLCanvasElement>(null),dragId=useRef(''),urls=useRef(new Set<string>());
 const busy=uploading||job?.state==='processing';const active=clips.find(c=>c.id===selected)||clips[0];
 const sourceClips=[...new Map(clips.map(c=>[c.url,c])).values()];
 let plan:{start:number,end:number,length:number}[]=[];let planError='';
 try{if(clips.length)plan=makePlan(clips,target);}catch(e){planError=(e as Error).message;}
 const length=Math.max(0,plan.reduce((s,c)=>s+c.length,0)-overlap(transition)*Math.max(0,plan.length-1)),originalLength=clips.reduce((s,c)=>s+c.end-c.start,0);
 const activeIndex=clips.findIndex(c=>c.id===active?.id),activePlan=plan[activeIndex];
 useEffect(()=>()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
 useEffect(()=>{
  if(result||active?.framing!=='fit')return;
  let frame=0,lastTime=-1;
  const draw=()=>{
   const v=video.current,c=backdrop.current;
   if(v&&c&&v.readyState>=2&&v.videoWidth&&v.videoHeight&&v.currentTime!==lastTime){
    const ctx=c.getContext('2d');const scale=Math.max(c.width/v.videoWidth,c.height/v.videoHeight);
    ctx?.drawImage(v,(c.width-v.videoWidth*scale)/2,(c.height-v.videoHeight*scale)/2,v.videoWidth*scale,v.videoHeight*scale);lastTime=v.currentTime;
   }
   frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
 },[active?.id,active?.framing,result]);
 useEffect(()=>{
  if(!job||job.state!=='processing')return;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const r=await fetch(`/api/exports/${job.id}`,{signal:controller.signal});const data=await r.json();if(!r.ok)throw new Error(data.error);setJob({id:job.id,...data});if(data.state==='done')setResult(`/api/exports/${job.id}/download`);else if(data.state==='error')setError(data.message);else timer=setTimeout(poll,1500);}catch(e){if(!controller.signal.aborted){setError('Spojenie s exportom sa prerušilo. Obnovte kontrolu exportu.');setJob(j=>j?{...j,state:'disconnected'}:j);}}};
  timer=setTimeout(poll,700);return()=>{clearTimeout(timer);controller.abort();};
 },[job?.id,job?.state]);
 async function add(files:FileList|File[]|null){
  if(!files||busy||adding)return;setAdding(true);setError('');setNotice('');
  const added:Clip[]=[];const failures:string[]=[];let bytes=sourceClips.reduce((s,c)=>s+c.file.size,0)+(music?.size||0);
  for(const file of Array.from(files)){
   if(sourceClips.length+added.length>=12||clips.length+added.length>=48){failures.push('Maximálne 12 zdrojových videí a 48 úsekov.');break;}
   if(!file.type.startsWith('video/')&&!/\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name)){failures.push(`${file.name}: vyberte video.`);continue;}
   if(file.size>250*1024*1024||bytes+file.size>490*1024*1024){failures.push(`${file.name}: prekročený limit veľkosti.`);continue;}
   try{const clip=await inspect(file);added.push(clip);urls.current.add(clip.url);bytes+=file.size;}catch(e){failures.push(`${file.name}: ${(e as Error).message}`);}
  }
  setClips(c=>[...c,...added]);if(!selected&&added[0])setSelected(added[0].id);if(added.length){changed();}setError(failures.join(' '));setAdding(false);if(input.current)input.current.value='';
 }
 function changed(){setResult('');setJob(null);setNotice('');setUndo(null);}
 function selectClip(id:string){setSelected(id);setResult('');}
 function update(id:string,patch:Partial<Clip>){changed();setClips(cs=>cs.map(c=>c.id===id?{...c,...patch}:c));}
 function move(id:string,to:number){if(busy)return;changed();setClips(cs=>{const next=[...cs],from=next.findIndex(c=>c.id===id);if(from<0)return cs;const [item]=next.splice(from,1);next.splice(Math.max(0,Math.min(to,next.length)),0,item);return next;});}
 function remove(c:Clip){changed();if(!clips.some(x=>x.id!==c.id&&x.url===c.url)){URL.revokeObjectURL(c.url);urls.current.delete(c.url);}setClips(cs=>cs.filter(x=>x.id!==c.id));}
 function auto(){try{const next=automaticCut(clips,target,pace).map(c=>({...c,id:crypto.randomUUID()})) as Clip[];changed();setUndo(clips);setClips(next);setSelected(next[0].id);setError('');setNotice(`Automatický strih vytvoril ${next.length} úsekov. Zábery sa striedajú podľa zvoleného tempa; každý môžeš upraviť.`);}catch(e){setError((e as Error).message);}}
 async function exportVideo(){
  setError('');setResult('');setUploading(true);setJob(null);
  try{
   const data=new FormData();data.append('manifest',JSON.stringify({clips:clips.map(c=>({start:c.start,end:c.end,framing:c.framing,sourceIndex:sourceClips.findIndex(s=>s.url===c.url)})),target,transition,title,mute,musicVolume:volume,look,frame,titleStyle}));sourceClips.forEach(c=>data.append('video',c.file));if(music)data.append('music',music);
   const response=await fetch('/api/exports',{method:'POST',body:data});const json=await response.json();if(!response.ok)throw new Error(json.error||'Export zlyhal.');setJob({id:json.id,state:'processing',progress:0,message:'Pripravujem videá'});
  }catch(e){setError((e as Error).message);}finally{setUploading(false);}
 }
 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Film size={22}/></span>clipstudio<span className="beta">BETA</span></a><span className="local"><i/> Lokálne štúdio</span><span className="header-note">Z klipov jeden príbeh.</span></header>
  <main>
   <div className="heading"><div><div className="eyebrow">TVÔJ PRIESTOR NA TVORBU</div><h1>Malé momenty. <span>Jedno video.</span></h1></div><div className="format-tag"><span>9:16</span><div>Vertikálne video<small>1080 × 1920 · MP4</small></div></div></div>
   <div className="workspace">
    <section className="panel library"><div className="panel-heading"><h2><span className="step">01</span> Tvoje klipy <small>{sourceClips.length}/12 videí</small></h2><button className="icon-button" onClick={()=>input.current?.click()} disabled={busy||adding} aria-label="Pridať videá"><Plus size={19}/></button></div>
     <input ref={input} type="file" accept="video/*,.mkv" multiple hidden onChange={e=>add(e.target.files)}/>
     <button className={`dropzone ${drag?'dragging':''}`} disabled={busy||adding} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void add(e.dataTransfer.files);}}>
      <span className="upload-icon">{adding?<LoaderCircle className="spin"/>:<Upload size={23}/>}</span><strong>{adding?'Načítavam videá…':'Presuň sem svoje videá'}</strong><span>alebo <b>vyber súbory</b></span><small>MP4, MOV, WebM · max. 250 MB / súbor</small>
     </button>
     <div className="list-caption"><span>PORADIE KLIPOV</span><span>Presunutím zmeníš poradie</span></div>
     <div className="clip-list">{clips.length?clips.map((c,i)=><article key={c.id} className={`clip-card ${active?.id===c.id?'selected':''}`} draggable={!busy} onDragStart={e=>{dragId.current=c.id;e.dataTransfer.effectAllowed='move';}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();if(dragId.current)move(dragId.current,i);dragId.current='';}} onDragEnd={()=>dragId.current=''}>
       <GripVertical size={16} className="grip"/><button className="clip-select" onClick={()=>selectClip(c.id)}><div className="thumb"><video src={c.url} muted preload="metadata"/><span>{String(i+1).padStart(2,'0')}</span></div><span className="clip-info"><strong>{c.file.name}</strong><small>{time(c.end-c.start)} <span>z {time(c.duration)}</span></small></span></button>
       <div className="clip-actions"><button disabled={busy||i===0} aria-label={`Posunúť ${c.file.name} vyššie`} onClick={()=>move(c.id,i-1)}><ArrowUp size={13}/></button><button disabled={busy||i===clips.length-1} aria-label={`Posunúť ${c.file.name} nižšie`} onClick={()=>move(c.id,i+1)}><ArrowDown size={13}/></button><button disabled={busy} aria-label={`Odstrániť ${c.file.name}`} onClick={()=>remove(c)}><X size={14}/></button></div>
      </article>):<div className="library-empty"><div className="empty-frames"><span/><span/><span/></div><p>Každý príbeh začína prvým klipom.</p><small>Nahraj videá a poskladaj ich po svojom.</small></div>}</div>
     <div className="rights"><Check size={15}/><p>Používaj vlastné videá a hudbu alebo obsah, ku ktorému máš oprávnenie.</p></div>
    </section>
    <section className="panel preview-panel"><div className="panel-heading"><h2><span className="step">02</span> Náhľad</h2><span className="subtle">{result?'Hotový export':'Vybraný klip'}</span></div>
     <div className="preview-stage"><div className="phone">{result?<video key={result} src={`${result}?preview=1`} controls playsInline className="preview-video"/>:active?<>{active.framing==='fit'&&<canvas ref={backdrop} className="preview-backdrop" style={{filter:`blur(10px) ${look==='none'?'':previewFilters[look]}`}} width={270} height={480} aria-hidden="true"/>}<video key={active.id} ref={video} style={{filter:previewFilters[look]}} src={active.url} controls playsInline className={`preview-video ${active.framing==='fit'?'preview-fit':' '}`} onLoadedMetadata={e=>{e.currentTarget.currentTime=activePlan?.start??active.start;}} onPlay={e=>{if(e.currentTarget.currentTime<(activePlan?.start??active.start)||e.currentTarget.currentTime>=(activePlan?.end??active.end))e.currentTarget.currentTime=activePlan?.start??active.start;}} onTimeUpdate={e=>{if(e.currentTarget.currentTime>(activePlan?.end??active.end)){e.currentTarget.pause();e.currentTarget.currentTime=activePlan?.start??active.start;}}}/>{frame!=='none'&&<div className={`graphic-frame frame-${frame}`} aria-hidden="true"/>}{title&&<div className={`title-overlay title-${titleStyle}`}>{title}</div>}</>:<div className="preview-empty"><span className="frame-corner tl"/><span className="frame-corner tr"/><span className="frame-corner bl"/><span className="frame-corner br"/><Film size={34}/><strong>Tu vznikne tvoj príbeh</strong><span>Pridaj prvý klip</span></div>}</div></div>
     <div className="preview-meta"><span><i/> {result?'Finálne video':active?.framing==='fit'?'Celý záber · 9:16':'Výrez · 9:16'}</span><span>30 FPS</span></div>
     {active&&!result?<div className="trim"><div className="trim-heading"><h3><Scissors size={15}/> Vystrihni moment</h3><button className="text-button" disabled={busy} onClick={()=>update(active.id,{start:0,end:active.duration})}>Obnoviť</button></div><div className="trim-fields"><label>Začiatok <input aria-label="Začiatok úseku v sekundách" type="number" step="0.1" min="0" max={active.end-.5} value={Number(active.start.toFixed(2))} disabled={busy} onChange={e=>{const v=Number(e.target.value);update(active.id,{start:Math.max(0,Math.min(v,active.end-.5))});if(video.current)video.current.currentTime=v;}}/> <small>s</small></label><ChevronRight size={16}/><label>Koniec <input aria-label="Koniec úseku v sekundách" type="number" step="0.1" min={active.start+.5} max={active.duration} value={Number(active.end.toFixed(2))} disabled={busy} onChange={e=>update(active.id,{end:Math.min(active.duration,Math.max(Number(e.target.value),active.start+.5))})}/> <small>s</small></label></div><label className="range-label">Začiatok<input type="range" aria-label="Posunúť začiatok" min="0" max={Math.max(0,active.end-.5)} step="0.01" value={active.start} disabled={busy} onChange={e=>update(active.id,{start:Number(e.target.value)})}/></label><label className="range-label">Koniec<input type="range" aria-label="Posunúť koniec" min={active.start+.5} max={active.duration} step="0.01" value={active.end} disabled={busy} onChange={e=>update(active.id,{end:Number(e.target.value)})}/></label><small className="subtle">V exporte: {time(activePlan?.start??0)} – {time(activePlan?.end??0)}</small></div>:<div className="preview-tip">{result?'Prehraj si hotové video aj s hudbou a prechodmi.':'Vyber klip a uprav jeho začiatok a koniec.'}</div>}
     {active&&!result&&<div className="framing-control"><label className="setting-label" htmlFor="framing">Zobrazenie klipu <span>{active.width} × {active.height}</span></label><select id="framing" value={active.framing??'crop'} disabled={busy} onChange={e=>update(active.id,{framing:e.target.value as Clip['framing']})}><option value="fit">Zachovať celý záber</option><option value="crop">Orezať na 9:16</option></select><p className="hint">{active.framing==='fit'?'Celé video bez orezania. Voľný priestor vyplní rozmazané pozadie.':'Video vyplní celý rám. Okraje záberu sa orežú zo stredu.'}</p></div>}
    </section>
    <section className="panel settings"><div className="panel-heading"><h2><span className="step">03</span> Finálny strih</h2><Sparkles size={17} className="subtle"/></div><fieldset disabled={busy}>
     <div className="setting"><label className="setting-label">Dĺžka videa <span>max. 2 min</span></label><div className="segments">{[15,30,60,0].map(n=><button key={n} className={target===n?'active':''} onClick={()=>{setTarget(n);changed();}}>{n?`${n} s`:'Celé'}</button>)}</div><label className="setting-label auto-label" htmlFor="pace">Tempo automatického strihu</label><select id="pace" value={pace} onChange={e=>setPace(Number(e.target.value))}><option value={1.5}>Dynamické · približne 1,5 s</option><option value={3}>Vyvážené · približne 3 s</option><option value={5}>Pokojné · približne 5 s</option></select><button className="auto-button" onClick={auto} disabled={!clips.length||adding}><Sparkles size={16}/> Vytvoriť automatický strih</button>{undo&&<button className="text-button undo-button" onClick={()=>{const previous=undo;changed();setClips(previous);setSelected(previous[0].id);setNotice('Pôvodný strih je obnovený.');}}>Vrátiť automatický strih</button>}<p className="hint">Vyberie rozložené úseky, strieda zdrojové videá a vytvorí až 48 upraviteľných záberov. Nerozpoznáva obsah ani rytmus hudby.</p></div>
     <div className="setting"><label className="setting-label" htmlFor="transition">Prechody</label><select id="transition" value={transition} onChange={e=>{setTransition(e.target.value);changed();}}>{Object.entries(transitions).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><p className="hint">{overlap(transition)?'Prechod prekrýva susedné zábery o 0,2 s. Výsledná dĺžka nižšie už zahŕňa prekrytie.':'Stmavenie a záblesk trvajú najviac 0,25 s na okraji klipu.'}</p></div>
     <div className="setting"><label className="setting-label" htmlFor="look">Farebný vzhľad</label><select id="look" value={look} onChange={e=>{setLook(e.target.value as keyof typeof looks);changed();}}>{Object.entries(looks).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><label className="setting-label auto-label" htmlFor="frame">Grafický rám</label><select id="frame" value={frame} onChange={e=>{setFrame(e.target.value);changed();}}><option value="none">Bez rámu</option><option value="white">Biely rám</option><option value="lime">Limetkový rám</option><option value="corners">Rohové značky</option></select><label className="setting-label auto-label" htmlFor="title-style">Štýl titulku</label><select id="title-style" value={titleStyle} onChange={e=>{setTitleStyle(e.target.value);changed();}}><option value="classic">Tmavá karta</option><option value="minimal">Čistý text</option><option value="banner">Farebný pás</option></select><p className="hint">Grafika sa použije na celé video. Náhľad farieb je orientačný; presný výsledok uvidíš po exporte.</p></div>
     <div className="setting"><label className="setting-label" htmlFor="title">Textový titulok <span>{title.length}/80</span></label><textarea id="title" value={title} maxLength={80} rows={2} placeholder="Daj svojmu príbehu názov…" onChange={e=>{setTitle(e.target.value.replace(/\n/g,' '));changed();}}/><p className="hint">Zobrazí sa v spodnej časti celého videa.</p></div>
     <div className="setting"><label className="setting-label">Hudba <span>voliteľné</span></label><input ref={musicInput} type="file" accept="audio/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f){if(f.size>100*1024*1024 || sourceClips.reduce((s,c)=>s+c.file.size,0)+f.size>490*1024*1024){setError('Hudba môže mať max. 100 MB a všetky súbory spolu max. 490 MB.');}else{setMusic(f);changed();}}e.target.value='';}}/><div className="music-row"><button className="music-button" onClick={()=>musicInput.current?.click()}><Music2 size={17}/><span>{music?music.name:'Pridať zvukovú stopu'}</span><Plus size={15}/></button>{music&&<button className="icon-button" aria-label="Odstrániť hudbu" onClick={()=>{setMusic(null);changed();}}><Trash2 size={16}/></button>}</div>{music&&<label className="range-label">Hlasitosť {Math.round(volume*100)} %<input type="range" min="0" max="1" step=".05" value={volume} onChange={e=>{setVolume(Number(e.target.value));changed();}}/></label>}<label className="checkbox"><input type="checkbox" checked={mute} onChange={e=>{setMute(e.target.checked);changed();}}/> Stlmiť pôvodný zvuk klipov</label></div>
    </fieldset><div className="export-summary"><div><span>Výsledné video</span><strong>{time(length)}</strong></div><div><span>Rozlíšenie</span><b>1080 × 1920</b></div><div><span>Formát</span><b>MP4 · H.264</b></div></div>
    <button className="export-button" disabled={busy||adding||!clips.length||!!planError} onClick={exportVideo}>{busy?<LoaderCircle size={18} className="spin"/>:<Download size={18}/>} {uploading?'Nahrávam súbory…':busy?'Vytváram video…':'Exportovať video'}</button><small className="export-note">Spracovanie prebieha na tomto serveri.</small>
    </section>
   </div>
   {(error||planError)&&<div role="alert" className="message error">{error||planError}{job?.state==='disconnected'&&<button onClick={()=>{setError('');setJob(j=>j?{...j,state:'processing'}:j);}}>Obnoviť kontrolu</button>}</div>}
   {notice&&<div role="status" className="message">{notice}</div>}
   {(busy||result)&&<div className="job-status" role="status"><div>{result?<Check size={20}/>:<LoaderCircle size={20} className="spin"/>}<strong>{uploading?'Prenášam videá do lokálneho štúdia':job?.message}</strong><span>{job?.progress||0} %</span></div><progress max="100" value={job?.progress||0}/>{result&&<a className="download-link" href={result} download><Download size={17}/> Stiahnuť MP4</a>}</div>}
   <section className="timeline"><div className="timeline-top"><h2><Film size={17}/> Tvoj príbeh <span>{clips.length} klipov</span></h2><span>{time(length)} <span className="subtle">/ {target||120} s</span></span></div><div className="timeline-track">{clips.length?clips.map((c,i)=><button key={c.id} style={{flex:plan[i]?.length||1}} className={active?.id===c.id?'active':''} onClick={()=>selectClip(c.id)} title={c.file.name}><span>{String(i+1).padStart(2,'0')}</span><span>{time(plan[i]?.length||0)}</span></button>):<span className="timeline-empty">Tvoje klipy sa tu objavia v poradí, v akom sa prehrajú.</span>}</div><div className="timeline-ruler"><span>00:00</span><span>{time(length/2)}</span><span>{time(length)}</span></div></section>
   <footer><span><span className="footer-dot"/> Vlastný obsah. Vlastné tempo.</span><span>{originalLength>length+.1?'Úseky sa automaticky prispôsobujú zvolenej dĺžke.':'Širokouhlé aj vertikálne klipy v jednom videu.'} Hudbu a prechody overíš v hotovom exporte.</span></footer>
  </main>
 </div>;
}
