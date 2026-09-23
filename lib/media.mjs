import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
export const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic;
export const ffprobe = process.env.FFPROBE_PATH || ffprobeStatic.path;
export function run(binary, args, { cwd, onProgress, timeout = 20*60*1000 } = {}) {
  return new Promise((resolve,reject)=>{
    const child = spawn(binary, args, { cwd, windowsHide:true, shell:false });
    let stdout='', stderr='';
    const timer=setTimeout(()=>{ child.kill('SIGKILL'); },timeout);
    child.stdout.on('data',b=> {stdout=(stdout+b).slice(-200000); onProgress?.(b.toString());});
    child.stderr.on('data',b=>stderr=(stderr+b).slice(-12000));
    child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve(stdout):reject(new Error(`Spracovanie média zlyhalo (${code}). ${stderr.slice(-1600)}`));});
  });
}
export async function probe(file) {
  return JSON.parse(await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],{timeout:30000}));
}
