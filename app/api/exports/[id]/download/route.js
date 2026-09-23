import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { jobDir, readStatus } from '../../../../../lib/jobs.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request,{params}){
 try {
  const {id}=await params;
  if((await readStatus(id)).state!=='done')return new Response('Export ešte nie je hotový.',{status:409});
  const file=path.join(jobDir(id),'result.mp4');const {size}=await stat(file);
  const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, no-store','Content-Disposition':`${new URL(request.url).searchParams.has('preview')?'inline':'attachment'}; filename="clipstudio.mp4"`};
  const range=request.headers.get('range');
  if(range){
   const match=/^bytes=(\d+)-(\d*)$/.exec(range);
   const start=Number(match?.[1]),end=match?.[2]?Math.min(Number(match[2]),size-1):size-1;
   if(!match || start>end || start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
   return new Response(Readable.toWeb(createReadStream(file,{start,end})),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${size}`}});
  }
  return new Response(Readable.toWeb(createReadStream(file)),{headers:{...headers,'Content-Length':String(size)}});
 }catch{return new Response('Video sa nenašlo.',{status:404});}
}
