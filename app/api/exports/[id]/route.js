import { readStatus } from '../../../../lib/jobs.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request,{params}){
 try{return Response.json(await readStatus((await params).id),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Export sa nenašiel alebo už vypršal.'},{status:404});}
}
