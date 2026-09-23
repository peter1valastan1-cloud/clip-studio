import { makePlan } from './plan.mjs';
export const transitions={cut:'Priamy strih',fade:'Stmavenie',white:'Biely záblesk',dissolve:'Prelínanie',wipeleft:'Stieranie doľava',slideleft:'Posun doľava'};
export const looks={none:'Originál',warm:'Teplý',cool:'Studený',bw:'Čiernobiely',vivid:'Živé farby',vintage:'Vintage'};
export const lookFilters={none:'null',warm:'colorbalance=rs=.10:bs=-.08,eq=saturation=1.12',cool:'colorbalance=rs=-.06:bs=.12',bw:'hue=s=0',vivid:'eq=saturation=1.4:contrast=1.08',vintage:'colorbalance=rs=.12:gs=.05:bs=-.1,eq=saturation=.7:contrast=.94'};
export const previewFilters={none:'none',warm:'sepia(.2) saturate(1.12)',cool:'sepia(.12) hue-rotate(170deg)',bw:'grayscale(1)',vivid:'saturate(1.4) contrast(1.08)',vintage:'sepia(.4) saturate(.7) contrast(.94)'};
export const overlap=t=>['dissolve','wipeleft','slideleft'].includes(t)?0.2:0;
// Deterministic rhythm editing: distribute non-overlapping windows across each
// selected source range, then alternate sources while preserving their time order.
export function automaticCut(clips,target,pace){
 if(![1.5,3,5].includes(pace))throw new Error('Neplatné tempo.');
 const groups=new Map();
 for(const c of clips){const key=c.sourceId??c.id;const old=groups.get(key);groups.set(key,old?{...old,start:Math.min(old.start,c.start),end:Math.max(old.end,c.end)}:{...c,sourceId:key});}
 const sources=[...groups.values()];const allocation=makePlan(sources,target);
 const counts=allocation.map(a=>Math.max(1,Math.floor(a.length/pace)));
 while(counts.reduce((s,n)=>s+n,0)>48){const index=counts.indexOf(Math.max(...counts));counts[index]--;}
 const batches=sources.map((c,i)=>{
  const budget=allocation[i].length;
  const count=counts[i];
  const length=budget/count;
  const gap=(c.end-c.start-budget)/(count+1);
  return Array.from({length:count},(_,j)=>({...c,start:c.start+gap*(j+1)+length*j,end:c.start+gap*(j+1)+length*(j+1)}));
 });
 const result=[];
 for(let round=0;batches.some(b=>round<b.length);round++)for(const b of batches)if(b[round])result.push(b[round]);
 return result;
}
