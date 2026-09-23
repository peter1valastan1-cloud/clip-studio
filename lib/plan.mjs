export const MIN_CLIP = 0.5;
export function makePlan(clips, target = 0) {
  if (!Array.isArray(clips) || !clips.length || clips.length > 48) throw new Error('Zostrih môže obsahovať 1 až 48 úsekov.');
  const ranges = clips.map(c => {
    const start = Number(c.start), end = Number(c.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < MIN_CLIP - 0.001 || end > 600) throw new Error('Každý úsek musí mať aspoň 0,5 s; video najviac 10 minút.');
    return { start, end, length: end - start };
  });
  if (!Number.isFinite(target) || target < 0 || target > 120) throw new Error('Dĺžka exportu musí byť od 0 do 120 s.');
  const total = ranges.reduce((s,c) => s+c.length, 0);
  const wanted = Math.min(total, target || 120);
  if (wanted < clips.length * MIN_CLIP) throw new Error('Zvolená dĺžka je príliš krátka pre tento počet klipov.');
  // Water filling: equal shares, redistributing time left by short clips.
  let remaining = wanted, pending = ranges.map((_,i)=>i), lengths = ranges.map(()=>0);
  while (pending.length) {
    const share = remaining / pending.length;
    const short = pending.filter(i=>ranges[i].length <= share);
    if (!short.length) { pending.forEach(i=>lengths[i]=share); break; }
    short.forEach(i=>{lengths[i]=ranges[i].length; remaining-=lengths[i];});
    pending = pending.filter(i=>!short.includes(i));
  }
  return ranges.map((c,i)=> {
    const length = total <= wanted + .001 ? c.length : lengths[i];
    return { start: c.start + (c.length-length)/2, end: c.start+(c.length+length)/2, length };
  });
}
