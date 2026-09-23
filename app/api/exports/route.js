import Busboy from 'busboy';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { cleanup, jobDir, reserve, release, status, render } from '../../../lib/jobs.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const LIMIT=500*1024*1024;
export async function POST(request) {
  const origin=request.headers.get('origin');
  // Next may use localhost internally even when the browser opened 127.0.0.1.
  // Compare with the actual HTTP Host, not the rewritten internal request URL.
  let sameOrigin=!origin;
  try { if(origin) {const url=new URL(origin);sameOrigin=['http:','https:'].includes(url.protocol)&&url.host===request.headers.get('host');} } catch {}
  if(!sameOrigin)return Response.json({error:'Nepovolený pôvod požiadavky.'},{status:403});
  if(!reserve())return Response.json({error:'Práve prebieha export. Skúste to po jeho dokončení.'},{status:429});
  const id=randomUUID(), dir=jobDir(id);
  try {
    if(Number(request.headers.get('content-length'))>LIMIT)throw new Error('Súbory spolu môžu mať najviac 500 MB.');
    await cleanup();await mkdir(dir,{recursive:true});
    const files=[], writes=[];let music=null, manifest=null, failure=null, bytes=0;
    const bb=Busboy({headers:Object.fromEntries(request.headers),limits:{files:13,fileSize:250*1024*1024,fields:1,fieldSize:16000,parts:14}});
    bb.on('file',(field,stream)=>{
      if(!['video','music'].includes(field) || (field==='music'&&music) || (field==='video'&&files.length>=12)) {failure=new Error('Neplatný počet alebo typ súborov.');stream.resume();return;}
      const file=path.join(dir,`${field}-${randomUUID()}.media`);
      if(field==='video')files.push(file);else music=file;
      stream.on('limit',()=>failure=new Error('Jeden súbor môže mať najviac 250 MB.'));
      writes.push(pipeline(stream,createWriteStream(file)).catch(e=>{failure=e;}));
    });
    bb.on('field',(name,value,info)=>{try {if(name!=='manifest'||info.valueTruncated)throw new Error();manifest=JSON.parse(value);}catch{failure=new Error('Neplatné nastavenia exportu.');}});
    for(const event of ['filesLimit','fieldsLimit','partsLimit'])bb.on(event,()=>failure=new Error('Prekročený limit súborov alebo polí.'));
    const source=Readable.fromWeb(request.body);
    source.on('data',chunk=>{bytes+=chunk.length;if(bytes>LIMIT)source.destroy(new Error('Súbory spolu môžu mať najviac 500 MB.'));});
    let uploadError;
    try{await pipeline(source,bb);}catch(e){uploadError=e;}
    await Promise.all(writes);
    if(uploadError)throw uploadError;
    if(failure)throw failure;
    if(!manifest||!files.length)throw new Error('Chýbajú videá alebo nastavenia.');
    await status(id,{state:'processing',progress:0,message:'Začínam export'});
    void render(id,manifest,files,music);
    return Response.json({id},{status:202});
  }catch(e){await rm(dir,{recursive:true,force:true});release();return Response.json({error:e.message||'Nahrávanie zlyhalo.'},{status:400});}
}
