import { sdaiPreview } from './estudio/sdai-preview.js?v=montagem-2';
import { load as loadStudio } from './estudio/store.js';
import {DEFAULT_PROJECT,newScene,newLesson,timeLabel,lessonDuration,locateScene,clamp,makeId} from './data.js';
import {loadProject,saveProject,exportProject,readProject} from './storage.js';
import {renderStage,escapeHtml as esc} from './motion.js';
import {directStage,exampleCues,MOTION_LABELS} from './choreography.js';

let project=loadProject();
const technicalDemo = { id: 'demo-quadro', title: 'Do quadro ao circuito', description: 'Abertura de quadro, vista explodida, comutação e leitura de um gráfico.', module: 'Fundamentos técnicos', scenes: Array(4) };
let studioLessons = [sdaiPreview, technicalDemo];
let lessonIndex=0,sceneIndex=0,playhead=0,playing=false,narrate=false,lastFrame=0;
let speech=null, audioPlayer=null, voiceList=[];
const el=id=>document.getElementById(id);
const lesson=()=>project.lessons[lessonIndex];
const scene=()=>lesson().scenes[sceneIndex];
let toastTimeout;
function toast(message){const node=el('toast');node.textContent=message;node.classList.add('is-visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove('is-visible'),4000)}
function persist(){const ok=saveProject(project);el('save-status').textContent=ok?'● Salvo neste navegador':'⚠ Exporte seu projeto';return ok}
function setPage(page){document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('hidden',n.dataset.page!==page));document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('is-active',n.dataset.nav===page));history.replaceState(null,'',`#${page}`);if(page==='studio')renderStudio();window.scrollTo({top:0,behavior:'smooth'});}
function statusText(value){return {authorial:'Autoral',draft:'Em elaboração',reviewed:'Revisado'}[value]||'Em elaboração'}
function refreshLibrary(){
  const studioCards = studioLessons.map(l => {
    const id = encodeURIComponent(l.id), title = esc(l.title);
    return `<article class="lesson-card"><div class="lesson-thumb lesson-thumb--authorial"><span class="thumb-chip">${esc(l.module||'Estúdio')}</span><div class="thumb-float"><b>ANIMAÇÃO TÉCNICA</b></div></div><div class="lesson-body"><h3>${title}</h3><p>${esc(l.description)}</p><div class="lesson-meta"><span>▣ ${l.scenes.length} CENAS</span>${l.id === sdaiPreview.id ? '<span>PRÉVIA CBMES</span>' : ''}</div><div class="lesson-body-actions"><a class="button button--small button--primary" href="./studio.html?assistir=${id}">▶ Assistir</a><a class="button button--small button--subtle" href="./studio.html?aula=${id}">Editar ↗</a></div></div></article>`;
  }).join('');
  el('lesson-grid').innerHTML=studioCards+project.lessons.map((l,i)=>{
    const duration=lessonDuration(l);
    return `<article class="lesson-card"><div class="lesson-thumb lesson-thumb--${esc(l.status)}"><span class="thumb-chip">${esc(l.category)}</span><div class="thumb-float"><b>${l.status==='authorial'?'01 — MÉTODO':'NORMA EM CENA'}</b></div></div><div class="lesson-body"><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p><div class="lesson-meta"><span>▣ ${l.scenes.length} ${l.scenes.length===1?'CENA':'CENAS'}</span><span>◷ ${timeLabel(duration)}</span><span>${esc(statusText(l.status))}</span></div><div class="lesson-body-actions"><button type="button" class="button button--small button--primary" data-card-watch="${i}">▶ Assistir</button><button type="button" class="button button--small button--subtle" data-card-edit="${i}">Editar ↗</button></div></div></article>`
  }).join('');
}
function renderLessonOptions(){el('lesson-select').innerHTML=project.lessons.map((l,i)=>`<option value="${i}">${esc(l.title)}</option>`).join('');el('lesson-select').value=String(lessonIndex)}
function renderSceneList(){
  el('scene-list').innerHTML=lesson().scenes.map((s,i)=>`<button class="scene-option ${i===sceneIndex?'is-selected':''}" type="button" data-scene="${i}"><span class="scene-number">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(s.title)}</strong><small>${esc(s.kind)} · ${timeLabel(s.duration)}</small></span></button>`).join('');
  el('scene-total').textContent=String(lesson().scenes.length).padStart(2,'0');
}
function renderStageNow(){const pos=locateScene(lesson(),playhead);if(pos.index!==sceneIndex){sceneIndex=pos.index;renderSceneList();renderEditor();}
 el('player-stage').innerHTML=renderStage(pos.scene,pos.index,lesson().scenes.length);
 el('preview-foot-scene').textContent=`Cena ${pos.index+1} / ${lesson().scenes.length}`;
 updatePlayerClock();syncMotion();
}
function updatePlayerClock(){
  const dur=lessonDuration(lesson());el('time-code').textContent=`${timeLabel(playhead)} / ${timeLabel(dur)}`;
  const range=el('timeline');range.max=dur;range.value=clamp(playhead,0,dur);
  el('play-toggle').textContent=playing?'❚❚':'▶';el('play-toggle').setAttribute('aria-label',playing?'Pausar':'Reproduzir');
  el('narrate-toggle').classList.toggle('is-on',narrate);updateCueMarks();
}
function renderEditor(){
 const s=scene();
 const field=(label,key,val,opts={})=>`<label class="form-field"><span>${label}</span>${opts.select?`<select class="form-input" data-key="${key}">${opts.select.map(([v,l])=>`<option value="${v}" ${val===v?'selected':''}>${l}</option>`).join('')}</select>`:opts.area?`<textarea class="form-input" data-key="${key}" rows="${opts.rows||3}" maxlength="${opts.max||2400}">${esc(val)}</textarea>`:`<input class="form-input" type="${opts.number?'number':'text'}" data-key="${key}" value="${esc(val)}" ${opts.number?'min="3" max="180" step="1"':''} maxlength="${opts.max||260}"/>`}</label>`;
 const statusSelect=`<label class="form-field"><span>Status da aula (não equivale a validação automática)</span><select class="form-input" id="lesson-status"><option value="authorial" ${lesson().status==='authorial'?'selected':''}>Conteúdo autoral</option><option value="draft" ${lesson().status==='draft'?'selected':''}>Rascunho sem revisão</option><option value="reviewed" ${lesson().status==='reviewed'?'selected':''}>Revisado manualmente</option></select></label>`;
 el('editor-fields').innerHTML=`${statusSelect}${field('Título da aula','lesson:title',lesson().title,{max:110})}${field('Título da cena','title',s.title,{max:110})}${field('Texto de apoio','body',s.body,{area:true,rows:2,max:260})}<div class="field-row">${field('Tipo de cena','kind',s.kind,{select:[['intro','Introdução'],['compare','Comparativo'],['steps','Etapas'],['concept','Conceito'],['summary','Resumo'],['image','Imagem']]})}${field('Duração (s)','duration',s.duration,{number:true})}</div><div class="field-row">${field('Movimento do personagem','motion',s.motion,{select:[['explain','Explicar'],['point','Apontar'],['walk','Caminhar'],['inspect','Inspecionar'],['wave','Acenar'],['idle','Parado']]})}${field('Etiqueta da cena','eyebrow',s.eyebrow,{max:70})}</div>${field('Pontos-chave (uma linha por item)','points',s.points.join('\n'),{area:true,rows:4,max:600})}${field('Narração','narration',s.narration,{area:true,rows:6,max:2400})}<p class="form-caption">A voz depende das vozes instaladas no aparelho. A narração automática não garante a voz Francisca.</p><div class="form-divider"></div>${field('Referência: documento, edição e seção','reference',s.reference,{max:220})}${s.kind==='compare'?`${field('Etiqueta esquerda','leftLabel',s.leftLabel,{max:40})}${field('Explicação esquerda','leftText',s.leftText,{area:true,rows:3,max:200})}${field('Etiqueta direita','rightLabel',s.rightLabel,{max:40})}${field('Explicação direita','rightText',s.rightText,{area:true,rows:3,max:200})}`:''}<div class="form-divider"></div><div class="field-row"><button type="button" class="button button--subtle button--small" id="scene-up" ${sceneIndex===0?'disabled':''}>↑ Subir cena</button><button type="button" class="button button--subtle button--small" id="scene-down" ${sceneIndex===lesson().scenes.length-1?'disabled':''}>↓ Descer cena</button></div>`;
 renderCuePanel();
}
function renderCuePanel(){
  const s=scene(), root=el('editor-fields');
  const container=document.createElement('div');
  container.className='cue-panel';
  container.innerHTML=`<h4>Coreografia da cena</h4><p>Escolha os movimentos e seus segundos. Arraste a linha do tempo para conferir as poses.</p>
  ${(Array.isArray(s.cues)?s.cues:[]).map((c,i)=>`<div class="cue-row"><input type="number" min="0" step="0.1" max="${s.duration}" value="${Number(c.time)||0}" data-cue-time="${i}" aria-label="Tempo da marca ${i+1}"><select data-cue-motion="${i}" aria-label="Movimento da marca ${i+1}">${Object.entries(MOTION_LABELS).map(([key,label])=>`<option value="${key}" ${c.motion===key?'selected':''}>${label}</option>`).join('')}</select><button type="button" class="cue-delete" data-cue-remove="${i}" aria-label="Excluir marca ${i+1}">×</button></div>`).join('')}
  <div class="cue-buttons"><button type="button" class="button button--subtle" id="cue-add">＋ Inserir marca</button><button type="button" class="button button--subtle" id="cue-auto">✦ Sugerir coreografia</button></div>`;
  root.append(container);
  container.addEventListener('change',event=>{
    const n=event.target;
    if(n.dataset.cueTime!==undefined){
      const cue=s.cues[Number(n.dataset.cueTime)];
      if(cue)cue.time=Math.round(clamp(n.value,0,s.duration)*10)/10;
    }else if(n.dataset.cueMotion!==undefined){
      const cue=s.cues[Number(n.dataset.cueMotion)];
      if(cue&&Object.hasOwn(MOTION_LABELS,n.value))cue.motion=n.value;
    }
    persist();updatePlayerClock();syncMotion();
  });
  container.addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    if(btn.dataset.cueRemove!==undefined){
      s.cues.splice(Number(btn.dataset.cueRemove),1);
    }else if(btn.id==='cue-auto'){
      s.cues=exampleCues(s);
    }else if(btn.id==='cue-add'){
      s.cues=Array.isArray(s.cues)?s.cues:[];
      if(s.cues.length>=12){toast('Limite de 12 marcas por cena.');return;}
      const start=lesson().scenes.slice(0,sceneIndex).reduce((a,x)=>a+Number(x.duration||0),0);
      s.cues.push({id:makeId(),time:Math.round(clamp(playhead-start,0,s.duration)*10)/10,motion:s.motion||'explain'});
    }else return;
    persist();renderEditor();updatePlayerClock();syncMotion();
  });
}
function updateCueMarks(){
 const marks=el('cue-dots');if(!marks)return;
 const total=Math.max(1,lessonDuration(lesson()));
 const offset=lesson().scenes.slice(0,sceneIndex).reduce((a,x)=>a+Number(x.duration||0),0);
 marks.innerHTML=(Array.isArray(scene().cues)?scene().cues:[]).map(c=>`<span class="cue-mark" style="left:${(100*(offset+clamp(c.time,0,scene().duration))/total).toFixed(3)}%"></span>`).join('');
}
function syncMotion(){
 const position=locateScene(lesson(),playhead);
 directStage(el('player-stage'),position.scene,position.local);
}
function renderStudio(){renderLessonOptions();renderSceneList();renderStageNow();renderEditor();const chip=el('status-chip');chip.textContent=statusText(lesson().status);chip.className='status-chip status-chip--'+lesson().status;}
function stopSpeech(){if('speechSynthesis' in window)window.speechSynthesis.cancel();if(audioPlayer){audioPlayer.pause();audioPlayer=null;}}
function startNarration(){stopSpeech();if(!narrate||!playing)return;const s=scene();if(s.audioUrl && (/^data:audio\//.test(s.audioUrl)||/^blob:/.test(s.audioUrl))){audioPlayer=new Audio(s.audioUrl);audioPlayer.play().catch(()=>toast('Áudio indisponível neste aparelho.'));return;}
 if(!('speechSynthesis' in window)) {toast('Narração por voz indisponível neste navegador.');return;}
 const u=new SpeechSynthesisUtterance(s.narration);u.lang='pt-BR';u.rate=1;const voices=window.speechSynthesis.getVoices();const preferred=voices.find(v=>/francisca/i.test(v.name)&&/pt/i.test(v.lang))||voices.find(v=>/pt-BR/i.test(v.lang));if(preferred)u.voice=preferred;window.speechSynthesis.speak(u);speech=u;
}
function startPlay(){if(playing)return;playing=true;lastFrame=performance.now();updatePlayerClock();startNarration();requestAnimationFrame(tick)}
function pause(){playing=false;stopSpeech();updatePlayerClock()}
function tick(t){if(!playing)return;const delta=Math.min(.2,(t-lastFrame)/1000);lastFrame=t;const prev=sceneIndex;playhead=Math.min(lessonDuration(lesson()),playhead+Math.max(0,delta));const next=locateScene(lesson(),playhead).index;if(next!==prev){sceneIndex=next;renderSceneList();renderEditor();renderStageNow();startNarration()}
 if(playhead>=lessonDuration(lesson())){pause();toast('Fim da aula.');return;}
 updatePlayerClock();syncMotion();requestAnimationFrame(tick)
}
function selectScene(i){pause();sceneIndex=clamp(i,0,lesson().scenes.length-1);playhead=lesson().scenes.slice(0,sceneIndex).reduce((a,s)=>a+s.duration,0);renderSceneList();renderStageNow();renderEditor()}
function selectLesson(i){pause();lessonIndex=clamp(i,0,project.lessons.length-1);sceneIndex=0;playhead=0;renderStudio()}
function createLesson(){if(project.lessons.length>=30)return toast('Máximo de 30 aulas.');project.lessons.push(newLesson());persist();refreshLibrary();selectLesson(project.lessons.length-1);setPage('studio');toast('Nova aula criada. Conteúdo técnico pendente de validação.')}
function addScene(){if(lesson().scenes.length>=40)return toast('Máximo de 40 cenas por aula.');lesson().scenes.push(newScene(lesson().scenes.length+1));persist();selectScene(lesson().scenes.length-1);toast('Cena adicionada.')}
function duplicateScene(){if(lesson().scenes.length>=40)return toast('Máximo de 40 cenas por aula.');const s=structuredClone(scene());s.id=makeId();s.title+= ' (cópia)';lesson().scenes.splice(sceneIndex+1,0,s);persist();selectScene(sceneIndex+1);toast('Cena duplicada.')}
function removeScene(){if(lesson().scenes.length===1)return toast('Cada aula precisa ter pelo menos uma cena.');lesson().scenes.splice(sceneIndex,1);persist();selectScene(Math.min(sceneIndex,lesson().scenes.length-1));toast('Cena removida.')}
function moveScene(dir){const to=sceneIndex+dir;if(to<0||to>=lesson().scenes.length)return;const arr=lesson().scenes;[arr[sceneIndex],arr[to]]=[arr[to],arr[sceneIndex]];persist();selectScene(to)}
function updateSceneField(key,value){
 if(key==='lesson:title'){lesson().title=value.slice(0,110);renderLessonOptions();refreshLibrary();persist();return;}
 if(key==='duration')value=clamp(value,3,180);
 if(key==='points')value=value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,4);
 scene()[key]=value;persist();refreshLibrary();renderSceneList();renderStageNow();
}
function init(){
 refreshLibrary();renderStudio();
 document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.nav)));
 el('new-lesson-library').addEventListener('click',()=>location.assign('./studio.html?novo=1'));
 el('lesson-grid').addEventListener('click',e=>{const watch=e.target.closest('[data-card-watch]');const edit=e.target.closest('[data-card-edit]');if(watch){selectLesson(Number(watch.dataset.cardWatch));setPage('studio');startPlay()}else if(edit){const item=project.lessons[Number(edit.dataset.cardEdit)];location.assign('./studio.html?aula='+encodeURIComponent(item.id))}});
 el('lesson-select').addEventListener('change',e=>selectLesson(Number(e.target.value)));
 el('scene-list').addEventListener('click',e=>{const btn=e.target.closest('[data-scene]');if(btn)selectScene(Number(btn.dataset.scene))});
 el('play-toggle').addEventListener('click',()=>playing?pause():startPlay());
 el('prev-scene').addEventListener('click',()=>selectScene(sceneIndex-1));el('next-scene').addEventListener('click',()=>selectScene(sceneIndex+1));
 el('timeline').addEventListener('input',e=>{pause();playhead=clamp(e.target.value,0,lessonDuration(lesson()));const i=locateScene(lesson(),playhead).index;if(i!==sceneIndex){sceneIndex=i;renderSceneList();renderEditor();}renderStageNow()});
 el('narrate-toggle').addEventListener('click',()=>{narrate=!narrate;updatePlayerClock();if(narrate&&playing)startNarration();else stopSpeech();toast(narrate?'Narração ativada (voz do dispositivo).':'Narração desativada.')});
 el('editor-fields').addEventListener('input',e=>{const key=e.target.dataset.key;if(key && e.target.tagName!=='SELECT')updateSceneField(key,e.target.value)});
 el('editor-fields').addEventListener('change',e=>{const key=e.target.dataset.key;if(key){updateSceneField(key,e.target.value);if(key==='kind')renderEditor();return}if(e.target.id==='lesson-status'){lesson().status=e.target.value;persist();refreshLibrary();el('status-chip').textContent=statusText(lesson().status);el('status-chip').className='status-chip status-chip--'+lesson().status;toast('Status alterado manualmente — sem validação automática.')}});
 el('editor-fields').addEventListener('click',e=>{if(e.target.id==='scene-up')moveScene(-1);if(e.target.id==='scene-down')moveScene(1)});
 el('add-scene').addEventListener('click',addScene);el('duplicate-scene').addEventListener('click',duplicateScene);el('remove-scene').addEventListener('click',removeScene);
 for(const name of ['export-header','export-btn'])el(name).addEventListener('click',()=>{exportProject(project);toast('Cópia do projeto JSON exportada. Guarde o arquivo.')});
 el('import-btn').addEventListener('click',()=>el('file-input').click());
 el('file-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const imported=await readProject(file);if(!confirm(`Importar projeto com ${imported.lessons.length} aula(s)? Isso substitui as edições deste navegador. Exporte sua cópia antes de continuar.`))return;pause();project=imported;lessonIndex=0;sceneIndex=0;playhead=0;persist();refreshLibrary();renderStudio();toast('Projeto importado com sucesso.')}catch(err){toast(err.message)}finally{e.target.value=''}});
 window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||!document.querySelector('[data-page="studio"]:not(.hidden)'))return;if(e.code==='Space'){e.preventDefault();playing?pause():startPlay()}else if(e.code==='ArrowRight'){selectScene(sceneIndex+1)}else if(e.code==='ArrowLeft'){selectScene(sceneIndex-1)}});
 window.addEventListener('pagehide',stopSpeech);
 if(!location.hash || !['#biblioteca','#studio','#fontes'].includes(location.hash))setPage('biblioteca');else setPage(location.hash.slice(1));
}
init();

// The catalog also reads this browser's visual-studio projects.
async function loadStudioCatalog() {
  try {
    const saved = await loadStudio();
    if (!saved?.project?.lessons) return;
    studioLessons = saved.project.lessons.filter(l => !l.legacyId);
    if (!studioLessons.some(l => l.id === technicalDemo.id)) studioLessons.unshift(technicalDemo);
    const existingPreview = studioLessons.findIndex(l => l.id === sdaiPreview.id);
    const preview = existingPreview >= 0 ? studioLessons.splice(existingPreview, 1)[0] : sdaiPreview;
    studioLessons.unshift(preview);
    refreshLibrary();
  } catch { /* Keep the existing catalog available if storage is disabled. */ }
}
loadStudioCatalog();
window.addEventListener('pageshow', event => { if (event.persisted) loadStudioCatalog(); });
