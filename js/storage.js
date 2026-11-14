import {DEFAULT_PROJECT,newScene,makeId} from './data.js';
const KEY = 'norma-em-cena-v2';
const clone=v=>JSON.parse(JSON.stringify(v));
export function loadProject() {
  try {
    const raw=localStorage.getItem(KEY);
    if(!raw) return clone(DEFAULT_PROJECT);
    return validateProject(JSON.parse(raw));
  }catch(err){console.warn('Falha ao carregar alterações locais',err);return clone(DEFAULT_PROJECT);}
}
export function validateProject(input) {
  if(!input || !Array.isArray(input.lessons) || !input.lessons.length || input.lessons.length>30) throw Error('Projeto inválido: lista de aulas ausente ou excedida.');
  return {
    version:1,
    name:String(input.name||'Norma em Cena').slice(0,70),
    accent:/^#[0-9a-fA-F]{6}$/.test(input.accent||'')?input.accent:'#275CDD',
    captions:input.captions!==false,
    lessons:input.lessons.map((l,i)=>{
      if(!Array.isArray(l.scenes)||!l.scenes.length||l.scenes.length>40) throw Error(`Aula ${i+1}: precisa conter de 1 a 40 cenas.`);
      return {
        id:String(l.id||makeId()).slice(0,80),title:String(l.title||'Aula').slice(0,110),
        description:String(l.description||'').slice(0,260),category:String(l.category||'Em desenvolvimento').slice(0,60),
        status:['authorial','draft','reviewed'].includes(l.status)?l.status:'draft',
        scenes:l.scenes.map((s,j)=>({
          ...newScene(j+1),
          id:String(s.id||makeId()).slice(0,80),title:String(s.title||'Nova cena').slice(0,110),
          eyebrow:String(s.eyebrow||'').slice(0,70), body:String(s.body||'').slice(0,260),
          narration:String(s.narration||'').slice(0,2400),reference:String(s.reference||'').slice(0,220),
          points:Array.isArray(s.points)?s.points.slice(0,4).map(p=>String(p).slice(0,140)):[],
          kind:['intro','compare','steps','concept','summary','image'].includes(s.kind)?s.kind:'concept',
          motion:['walk','point','inspect','wave','explain','idle'].includes(s.motion)?s.motion:'explain',
          cues:Array.isArray(s.cues)?s.cues.slice(0,12).filter(c=>c&&Number.isFinite(Number(c.time))&&['walk','point','inspect','wave','explain','idle'].includes(c.motion)).map(c=>({id:String(c.id||makeId()).slice(0,80),time:Math.max(0,Math.min(180,Number(c.time))),motion:c.motion})):[],
          duration:Math.max(3,Math.min(180,Number(s.duration)||12)),
          leftLabel:String(s.leftLabel||'NFPA').slice(0,40),rightLabel:String(s.rightLabel||'ABNT NBR').slice(0,40),
          leftText:String(s.leftText||'').slice(0,200),rightText:String(s.rightText||'').slice(0,200),
          imageUrl:typeof s.imageUrl==='string'?s.imageUrl:'',
          audioUrl:typeof s.audioUrl==='string'?s.audioUrl:'',
          audioDuration:Math.max(0,Math.min(180,Number(s.audioDuration)||0)),
          audioText:String(s.audioText||'').slice(0,2400)
        }))
      };
    })
  };
}
export function saveProject(project){
  try{localStorage.setItem(KEY,JSON.stringify(project));return true;}
  catch(err){console.warn('Armazenamento cheio',err);return false;}
}
export function exportProject(project){
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='norma-em-cena-projeto.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
export function readProject(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>{try{resolve(validateProject(JSON.parse(r.result)))}catch(e){reject(e)}};r.onerror=()=>reject(Error('Falha ao ler arquivo'));r.readAsText(file);
  });
}
