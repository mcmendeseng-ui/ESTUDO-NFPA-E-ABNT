import { loadProject } from '../storage.js';
import { ASSETS, W, H, OBJECT_KEYS, CAMERA_KEYS, EASES, MOTIONS, uid, clamp, normalize,
  object, newScene, newLesson, applyMotion, resizeScene, copyItem } from './model.js';
import { demo, template, importLegacy } from './templates.js';
import { engine } from './engine.js';
import { load, save } from './store.js';
import { escape as e, slug, download, fileData, downloadJSON, downloadHTML, downloadSRT,
  framePNG, printLesson, recorderType, recordLesson } from './export.js';
import { properties, timeline, keyForm, field, area, number, select, button, keyLabels } from './panels.js';

const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const canvas = el('stage'), ctx = canvas.getContext('2d');
const media = new Map(), pending = new Set(), audio = engine.createAudio();
const dialog = el('dialog');
let project, versions = [], lessonId, sceneIndex = 0, head = 0;
let tab = 'object', shelf = 'scenes', viewer = params.has('assistir');
let captions = true, camera = false, focusClip = '', zoom = 76;
let playing = false, request = 0, audioTicket = 0, waiting = false, noticeTimer;
let activeDrag, timelineDrag, clipboard = [], recording, exportJob;
let undo = [], redo = [], selection = new Set(), saveTimer, dirty = false;
let writes = Promise.resolve();

const lesson = () => project.lessons.find(l => l.id === lessonId) || project.lessons[0];
const scene = () => lesson().scenes[sceneIndex];
const offset = (index = sceneIndex) => lesson().scenes.slice(0, index).reduce((n, s) => n + s.duration, 0);
const local = () => clamp(head - offset(), 0, scene().duration);
const primary = () => scene().layers.find(o => o.id === [...selection].at(-1));
const selected = () => scene().layers.filter(o => selection.has(o.id));
const editable = () => selected().filter(o => !o.locked);
const round = t => Math.round(t * 100) / 100;
const labelTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const keyLimits = { x: [-3000, 4000], y: [-3000, 4000], scale: [.05, 8],
  rotation: [-1080, 1080], opacity: [0, 1], effect: [0, 1], zoom: [.2, 5] };

function flash(text) {
  el('notice').textContent = text;
  el('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { el('notice').hidden = true; }, 5400);
}
function fail(error) { flash(error?.message || 'A operação não pôde ser concluída.'); }
function setStatus(value) { el('save-state').textContent = value; }

function persist() {
  clearTimeout(saveTimer);
  if (!dirty) return writes;
  dirty = false;
  const data = structuredClone(project), history = structuredClone(versions);
  writes = writes.catch(() => {}).then(() => save(data, history)).then(() => {
    if (!dirty) setStatus('Salvo neste navegador');
  }).catch(() => {
    dirty = true;
    setStatus('Falha ao salvar · baixe o JSON');
    flash('Não foi possível salvar no navegador. Use Salvar projeto editável.');
  });
  return writes;
}
function changed() {
  dirty = true;
  setStatus('Salvando…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 350);
}
function snapshot() { return { project: structuredClone(project), lessonId, sceneIndex, head }; }
function remember(snap) {
  undo.push(snap);
  if (undo.length > 45) undo.shift();
  redo = [];
  changed();
}
function change(fn, { redraw = true } = {}) {
  pause();
  const before = snapshot();
  fn();
  remember(before);
  if (redraw) render();
}
function restore(snap) {
  pause();
  project = snap.project;
  lessonId = snap.lessonId;
  sceneIndex = Math.min(snap.sceneIndex, lesson().scenes.length - 1);
  head = clamp(snap.head, 0, engine.duration(lesson()));
  selection.clear();
  changed(); render();
}
function historyStep(direction) {
  const from = direction === 'undo' ? undo : redo;
  const to = direction === 'undo' ? redo : undo;
  const snap = from.pop();
  if (!snap) return;
  to.push(snapshot()); restore(snap);
}

function renderLessons() {
  const select = el('lesson-select');
  select.replaceChildren(...project.lessons.map(l => new Option((l.module ? l.module + ' · ' : '') + l.title, l.id)));
  select.value = lesson().id;
  if (document.activeElement !== el('project-name')) el('project-name').value = project.name;
}
function renderSceneList() {
  let lastChapter;
  el('scenes').innerHTML = lesson().scenes.map((s, i) => {
    const title = s.chapter !== lastChapter && s.chapter ? '<p class="chapter-name">' + e(s.chapter) + '</p>' : '';
    lastChapter = s.chapter;
    return title + '<div class="scene-card ' + (i === sceneIndex ? 'selected' : '') + '">' +
      '<button data-action="scene" data-value="' + i + '"><span class="scene-index">' + String(i + 1).padStart(2, '0') +
      '</span><span><strong>' + e(s.title) + '</strong><small>' + labelTime(s.duration) + '</small></span></button>' +
      '<div class="reorder">' + button('↑', 'scene-up', String(i), 'aria-label="Subir cena" ' + (i === 0 ? 'disabled' : '')) +
      button('↓', 'scene-down', String(i), 'aria-label="Descer cena" ' + (i === lesson().scenes.length - 1 ? 'disabled' : '')) + '</div></div>';
  }).join('');
  el('present-scenes').innerHTML = lesson().scenes.map((s, i) =>
    button((i + 1) + ' · ' + s.title, 'scene', String(i), 'aria-pressed="' + (i === sceneIndex) + '"')).join('');
}
const iconFor = { text: 'T', rect: '□', ellipse: '○', line: '╱', arrow: '→',
  panel: '▣', breaker: '◫', bus: '≋', circuit: '⌁', chart: '↗', symbol: 'ϟ', image: '▧', video: '▶' };
function assetCards(query = '') {
  const q = query.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '');
  const filtered = Object.entries(ASSETS).filter(([, labels]) =>
    (labels[0] + ' ' + labels[1]).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').includes(q));
  return filtered.length ? filtered.map(([id, [name, group]]) => '<button class="asset" data-action="asset" data-value="' + id +
    '"><span class="asset-icon">' + iconFor[id] + '</span><span>' + e(name) + '<small>' + e(group) + '</small></span></button>').join('') :
    '<p>Nenhum recurso encontrado.</p>';
}
function renderInspector() {
  const target = el('properties'), scroll = target.scrollTop;
  target.innerHTML = properties({ scene: scene(), object: primary(), selected: selection, time: local(),
    camera, tab, recording, focusClip });
  target.scrollTop = scroll;
  document.querySelectorAll('[data-action="inspector"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === tab)));
}
function renderTimeline() {
  const scroll = el('timeline-scroll'), x = scroll.scrollLeft, y = scroll.scrollTop;
  el('tracks').innerHTML = timeline(scene(), selection, camera, primary(), zoom, local());
  scroll.scrollLeft = x; scroll.scrollTop = y;
}
function transport() {
  const total = engine.duration(lesson());
  el('seek').max = total;
  el('seek').value = head;
  el('clock').value = labelTime(head) + ' / ' + labelTime(total);
  el('play').textContent = waiting ? '…' : playing ? 'Ⅱ' : '▶\uFE0E';
  el('play').setAttribute('aria-label', playing || waiting ? 'Pausar' : 'Reproduzir');
  const track = el('tracks').firstElementChild;
  if (track) track.style.setProperty('--cursor', 'calc(var(--label-width) + (100% - var(--label-width)) * ' + (local() / scene().duration) + ')');
}
function stageHeader() {
  el('stage-title').textContent = viewer ? lesson().title : scene().title;
  el('stage-meta').textContent = viewer
    ? (lesson().module || 'Treinamento') + ' · ' + (sceneIndex + 1) + ' / ' + lesson().scenes.length + ' cenas'
    : (lesson().module || 'Treinamento') + ' / ' + (scene().chapter || 'Cena') + ' · ' + (sceneIndex + 1) + ' / ' + lesson().scenes.length;
  el('timeline-context').textContent = (camera ? 'Câmera · ' : '') + round(scene().duration) + ' s';
}
function render() {
  renderLessons(); renderSceneList(); renderInspector(); renderTimeline();
  el('assets').innerHTML = assetCards(el('asset-search').value);
  el('scenes-tab').hidden = shelf !== 'scenes';
  el('assets-tab').hidden = shelf !== 'assets';
  document.querySelectorAll('[data-action="tab"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === shelf)));
  el('present-scenes').hidden = !viewer;
  el('viewer-close').hidden = !viewer;
  document.body.classList.toggle('viewer', viewer);
  document.querySelector('[data-action="undo"]').disabled = !undo.length;
  document.querySelector('[data-action="redo"]').disabled = !redo.length;
  document.querySelector('[data-action="caption"]').setAttribute('aria-pressed', String(captions));
  stageHeader(); draw(); transport();
}

function box(o) {
  const camera = engine.state(scene().camera, local(), true);
  const p = engine.state(o, local());
  const z = camera.zoom, scale = p.scale * z;
  return {
    x: W / 2 + (p.x - camera.x) * z, y: H / 2 + (p.y - camera.y) * z,
    w: p.w * scale, h: p.h * scale, a: p.rotation * Math.PI / 180
  };
}
function toScene(p) {
  const c = engine.state(scene().camera, local(), true);
  return { x: c.x + (p.x - W / 2) / c.zoom, y: c.y + (p.y - H / 2) / c.zoom };
}
function relative(p, b) {
  const x = p.x - b.x, y = p.y - b.y, cos = Math.cos(b.a), sin = Math.sin(b.a);
  return { x: x * cos + y * sin, y: -x * sin + y * cos };
}
function selectionArt() {
  if (!el('guides').checked) return;
  const width = Math.max(1, 1280 / canvas.getBoundingClientRect().width);
  ctx.save();
  ctx.lineWidth = width;
  for (const x of [W / 2, W / 3, W * 2 / 3]) {
    ctx.strokeStyle = x === W / 2 ? '#5f8ed655' : '#5f8ed629';
    ctx.setLineDash([6, 9]); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const o of selected()) {
    if (!engine.visibleAt(o, local())) continue;
    const b = box(o), r = width * 4;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.strokeStyle = o.locked ? '#7185a0' : '#125ce7';
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fillStyle = '#fff';
    if (o === primary() && !o.locked) {
      for (const [x, y] of [[-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [-b.w / 2, b.h / 2], [b.w / 2, b.h / 2], [0, -b.h / 2 - r * 4]]) {
        ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
function draw() {
  if (!project) return;
  engine.prepareScene(scene(), media, pending, () => { if (!playing) draw(); });
  engine.syncVideos(scene(), local(), playing, media);
  engine.paint(ctx, scene(), local(), media, { captions, transition: playing || viewer });
  if (!playing && !viewer && !document.fullscreenElement && !el('theater').classList.contains('fullscreen-fallback')) selectionArt();
}
function refreshPosition() {
  const position = engine.position(lesson(), head);
  if (position.index !== sceneIndex) {
    sceneIndex = position.index; selection.clear(); focusClip = '';
    renderSceneList(); renderInspector(); renderTimeline(); stageHeader();
  }
  draw(); transport();
}
function seek(t) {
  pause();
  head = clamp(t, 0, engine.duration(lesson()));
  refreshPosition(); renderInspector();
}
function sceneSeek(t) {
  seek(offset() + clamp(t, 0, scene().duration - (sceneIndex < lesson().scenes.length - 1 ? .00001 : 0)));
}
function sceneGo(index) {
  pause();
  sceneIndex = clamp(index, 0, lesson().scenes.length - 1);
  head = offset();
  selection.clear(); focusClip = '';
  render();
}
function lessonGo(id) {
  lessonId = project.lessons.some(l => l.id === id) ? id : project.lessons[0].id;
  camera = false;
  sceneGo(0);
}
function pause() {
  audioTicket++;
  waiting = false; playing = false;
  audio.stop();
  cancelAnimationFrame(request);
}
async function startPlay() {
  if (playing || waiting) { pause(); draw(); transport(); return; }
  if (head >= engine.duration(lesson())) { head = 0; refreshPosition(); }
  const ticket = ++audioTicket;
  const start = head;
  waiting = true; transport();
  try {
    const clips = engine.audioSources(lesson()).filter(a => a.end > start);
    let clock = () => performance.now() / 1000;
    let t0 = clock();
    if (clips.length) {
      const timing = await audio.schedule(clips, start, undefined, .06, () => ticket === audioTicket);
      if (!timing) return;
      clock = timing.clock; t0 = timing.when;
    }
    if (ticket !== audioTicket) return;
    waiting = false; playing = true;
    const tick = () => {
      if (!playing) return;
      const total = engine.duration(lesson());
      head = clamp(start + Math.max(0, clock() - t0), 0, total);
      if (head >= total) pause();
      refreshPosition();
      if (playing) request = requestAnimationFrame(tick);
    };
    tick();
  } catch (error) {
    if (ticket !== audioTicket) return;
    pause(); transport(); fail(error);
  }
}
function setViewer(value) {
  viewer = value; selection.clear();
  const url = new URL(location.href);
  if (viewer) { url.searchParams.set('assistir', lesson().id); url.searchParams.delete('aula'); }
  else { url.searchParams.delete('assistir'); url.searchParams.set('aula', lesson().id); }
  history.replaceState(null, '', url); render();
}

function selectObject(id, additive = false) {
  const target = scene().layers.find(o => o.id === id);
  if (!target) return;
  const group = target.group ? scene().layers.filter(o => o.group === target.group) : [target];
  if (!additive) selection.clear();
  const remove = additive && selection.has(id);
  for (const layer of group) {
    if (remove) selection.delete(layer.id); else selection.add(layer.id);
  }
  if (!remove) { selection.delete(id); selection.add(id); }
  camera = false; tab = 'object';
}
function insert(type, values = {}) {
  if (scene().layers.length >= 200) throw Error('Limite de 200 camadas por cena.');
  change(() => {
    const layer = object(type, { ...values });
    scene().layers.push(layer); selectObject(layer.id);
  });
}
function addScene(kind) {
  if (lesson().scenes.length >= 100) throw Error('Limite de 100 cenas por aula.');
  change(() => {
    lesson().scenes.splice(sceneIndex + 1, 0, template(kind));
    sceneIndex++; selection.clear(); head = offset(); tab = 'scene';
  });
}
function setFrame(target, key, value, time, ease) {
  const frames = target.keys[key] || [];
  const match = frames.find(f => Math.abs(f.t - time) < .005);
  if (match) { match.v = value; if (ease) match.ease = ease; }
  else frames.push({ t: time, v: value, ease: ease || 'smooth' });
  target.keys[key] = frames.sort((a, b) => a.t - b.t);
}
function setTransform(target, key, value, time = local()) {
  value = clamp(value, ...keyLimits[key]);
  if (target.keys[key]?.length) setFrame(target, key, value, round(time));
  else target[key] = value;
}
function available(type) {
  return ({ image: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif',
    video: 'video/mp4,video/webm,video/quicktime', audio: 'audio/*,.m4a,.mp3,.wav,.ogg,.webm' })[type];
}
function pick(accept, callback) {
  const picker = el('picker');
  picker.accept = accept; picker.value = '';
  picker.onchange = async () => {
    if (!picker.files[0]) return;
    try { await callback(picker.files[0]); } catch (error) { fail(error); }
  };
  picker.click();
}
async function importImage(type, file, replacement, backdrop) {
  const src = await fileData(file);
  if (type === 'image' && !/^data:image\/(png|jpeg|webp|gif|svg\+xml|avif);base64,/i.test(src)) throw Error('Escolha PNG, JPEG, WebP, GIF, SVG ou AVIF.');
  if (type === 'video' && !/^data:video\/(mp4|webm|quicktime);base64,/i.test(src)) throw Error('Escolha MP4, WebM ou MOV.');
  if (backdrop) { change(() => { scene().backdrop = src; }); return; }
  if (replacement) { change(() => { replacement.src = src; }); return; }
  insert(type, { src, name: file.name.slice(0, 140) });
}
async function addAudio(file, track, s = scene()) {
  if (s.audio.length >= 24) throw Error('Limite de 24 clipes de áudio por cena.');
  let src = await fileData(file);
  if (/^data:(video\/webm|application\/octet-stream)/i.test(src) && /\.webm$/i.test(file.name)) {
    src = src.replace(/^data:[^;,]+/, 'data:audio/webm');
  }
  if (!/^data:audio\//i.test(src)) throw Error('Escolha um arquivo de áudio.');
  const tmp = new Audio();
  const duration = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Não foi possível determinar a duração do áudio.')), 6000);
    tmp.onloadedmetadata = () => { clearTimeout(timer); resolve(tmp.duration); };
    tmp.onerror = () => { clearTimeout(timer); reject(Error('Formato de áudio incompatível.')); };
    tmp.src = src;
  });
  let length = duration;
  if (!Number.isFinite(length)) {
    const decoder = new AudioContext();
    try { length = (await decoder.decodeAudioData(await (await fetch(src)).arrayBuffer())).duration; }
    finally { await decoder.close(); }
  }
  if (!(length > 0)) throw Error('O áudio não contém uma faixa utilizável.');
  const start = scene() === s ? Math.min(round(local()), s.duration - .1) : 0;
  const clip = { id: uid(), name: file.name.slice(0, 140), src, track, length, start,
    end: Math.min(s.duration, start + length), offset: 0, volume: 1, rate: 1 };
  change(() => { s.audio.push(clip); focusClip = clip.id; tab = 'sound'; });
}
async function recordVoice() {
  if (recording) { recording.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('A gravação exige um navegador compatível em HTTPS.');
  pause();
  const s = scene();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let recorder;
  try { recorder = new MediaRecorder(stream); } catch (error) { stream.getTracks().forEach(t => t.stop()); throw error; }
  const chunks = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop()); recording = null; renderInspector();
    if (!chunks.length) return;
    const extension = recorder.mimeType.includes('mp4') ? 'm4a' : recorder.mimeType.includes('ogg') ? 'ogg' : 'webm';
    try { await addAudio(new File(chunks, 'narração-gravada.' + extension, { type: recorder.mimeType }), 'voice', s); }
    catch (error) { fail(error); }
  };
  recorder.onerror = event => { stream.getTracks().forEach(t => t.stop()); recording = null; renderInspector(); fail(event.error); };
  recorder.start(); recording = recorder; renderInspector();
  flash('Microfone ativo. Use Parar gravação para adicionar a fala.');
}

function modal(title, content, options = {}) {
  const { submit, label = 'Aplicar' } = options;
  if (dialog.open) dialog.close();
  el('dialog-inner').innerHTML = '<div class="dialog-head"><h2>' + e(title) + '</h2>' +
    button('✕', 'close', '', 'aria-label="Fechar"') + '</div>' + (submit
      ? '<form id="dialog-form"><div class="form-grid">' + content + '</div><div class="dialog-actions">' +
        button('Cancelar', 'close') + '<button type="submit" class="primary">' + e(label) + '</button></div></form>'
      : content);
  const form = el('dialog-form');
  if (form) form.onsubmit = async event => {
    event.preventDefault();
    try {
      const values = Object.fromEntries(new FormData(form));
      // Close only when the callback did not replace this form with another dialog.
      await submit(values, form);
      if (dialog.open && form.isConnected) dialog.close();
    } catch (error) { fail(error); }
  };
  dialog.showModal();
}
function confirmChange(title, description, callback) {
  modal(title, '<p class="wide">' + e(description) + '</p>', { submit: callback, label: 'Confirmar' });
}
function lessonModal(isNew) {
  if (isNew && project.lessons.length >= 40) throw Error('Limite de 40 treinamentos no projeto.');
  const l = isNew ? newLesson() : lesson();
  modal(isNew ? 'Novo treinamento' : 'Detalhes do treinamento',
    field('Título', 'title', l.title, 'text', 'required maxlength="200"', true) +
    field('Módulo', 'module', l.module, 'text', 'maxlength="100"', true) + area('Descrição', 'description', l.description),
    { submit: values => change(() => {
      Object.assign(l, values);
      if (isNew) { project.lessons.push(l); lessonId = l.id; sceneIndex = 0; head = 0; selection.clear(); tab = 'scene'; }
    }) });
}
function keyDialog(target = camera ? scene().camera : primary(), prop = camera ? 'zoom' : 'x', old = null) {
  if (!target || target.locked) throw Error('Selecione uma camada desbloqueada ou a câmera.');
  const isCamera = target === scene().camera;
  const time = old?.t ?? Math.floor(local() * 100) / 100;
  const value = old?.v ?? engine.valueAt(target, prop, time);
  modal(old ? 'Editar keyframe' : 'Adicionar keyframe',
    keyForm(isCamera, prop, time, round(value), old?.ease || 'smooth', scene().duration) +
    (old ? '<div class="wide">' + button('Excluir keyframe', 'drop-key', '', 'class="danger"') + '</div>' : ''), {
      submit: values => change(() => {
        if (old) target.keys[prop].splice(target.keys[prop].indexOf(old), 1);
        setFrame(target, values.prop, clamp(Number(values.value), ...keyLimits[values.prop]), Number(values.time), values.ease);
      })
    });
  const form = el('dialog-form');
  form.elements.prop.onchange = () => {
    form.elements.value.value = round(engine.valueAt(target, form.elements.prop.value, Number(form.elements.time.value)));
  };
  const drop = form.querySelector('[data-action="drop-key"]');
  if (drop) drop.onclick = () => {
    change(() => { target.keys[prop].splice(target.keys[prop].indexOf(old), 1); });
    dialog.close();
  };
}
function motionDialog() {
  const target = camera ? scene().camera : primary();
  if (!target || target.locked) throw Error('Selecione uma camada desbloqueada ou a câmera.');
  const s = scene(), start = Math.min(round(local()), s.duration - .15);
  const baseMotions = { reveal: MOTIONS.reveal, slide: MOTIONS.slide };
  if (!['panel', 'breaker', 'circuit', 'chart', 'symbol'].includes(target.type)) baseMotions.pulse = MOTIONS.pulse;
  const technicalMotions = {
    panel: { open: 'Abrir porta', close: 'Fechar porta' },
    breaker: { open: 'Vista explodida', assemble: 'Montar dispositivo' },
    circuit: { flow: 'Fechar chave e ativar percurso', close: 'Abrir chave' },
    chart: { open: 'Revelar série progressivamente' },
    symbol: { open: 'Acionar símbolo', close: 'Retornar ao estado inicial' }
  };
  const motions = camera ? { open: 'Aproximar', close: 'Afastar', slide: 'Deslocar' } :
    { ...baseMotions, ...technicalMotions[target.type] };
  modal('Aplicar animação', select('Movimento', 'motion', Object.keys(motions)[0], motions, true) +
    number('Início (s)', 'start', start, 0, s.duration) + number('Fim (s)', 'end', Math.min(s.duration, round(start + 2)), 0, s.duration) +
    select('Curva', 'ease', 'smooth', EASES, true) + '<p class="wide">O movimento cria keyframes editáveis no intervalo escolhido.</p>', {
      submit: values => {
        if (Number(values.end) <= Number(values.start)) throw Error('O fim deve ser maior que o início.');
        change(() => applyMotion(target, values.motion, Number(values.start), Number(values.end), values.ease, camera));
      }
    });
}
function versionDialog() {
  modal('Histórico neste navegador', versions.length
    ? '<div class="stack">' + versions.map((v, i) => '<div class="mini-card"><strong>' + e(v.name) +
      '</strong><p>' + new Date(v.at).toLocaleString('pt-BR') + '</p><div class="row">' +
      button('Restaurar', 'restore-version', String(i)) + button('Baixar JSON', 'dl-version', String(i)) + '</div></div>').join('') + '</div>'
    : '<p>Use Salvar versão para registrar uma cópia antes de editar.</p>');
}
function versionSave() {
  versions = [{ at: Date.now(), name: project.name + ' · ' + lesson().title, project: structuredClone(project) }, ...versions].slice(0, 8);
  dirty = true;
  persist().then(() => { if (!dirty) flash('Versão registrada no histórico local.'); });
}
async function importJSON(file) {
  if (file.size > 180_000_000) throw Error('O projeto excede o limite de 180 MB.');
  const raw = JSON.parse(await file.text());
  const next = normalize(raw.format ? raw : importLegacy(raw));
  if (!next.lessons.length) throw Error('O projeto deve conter pelo menos uma cena.');
  confirmChange('Importar projeto', 'A cópia atual ficará no histórico e poderá ser recuperada.', () => {
    versionSave();
    change(() => { project = next; lessonId = next.lessons[0].id; sceneIndex = 0; head = 0; selection.clear(); });
  });
}

function exportDialog(format = 'mp4') {
  const hasAudio = engine.audioSources(lesson()).length > 0;
  const supported = !!recorderType(hasAudio, format);
  const html = select('Resolução', 'height', '720', { 720: '1280 × 720 (HD)', 1080: '1920 × 1080 (Full HD)' }, true) +
    '<label class="wide"><input name="cc" type="checkbox" ' + (captions ? 'checked' : '') + '> Gravar legendas no vídeo</label>' +
    '<p class="wide">A renderização leva cerca de ' + labelTime(engine.duration(lesson())) + '. Mantenha a aba visível. A narração vem dos clipes de áudio da timeline.</p>' +
    (format === 'mp4' && !recorderType(hasAudio, 'mp4').includes('avc') ?
      '<p class="wide">O navegador selecionará os codecs. Se o arquivo não abrir no aparelho de destino, consulte a conversão para H.264/AAC em Mais.</p>' : '');
  if (!supported) {
    modal('Conversão de vídeo', '<p>Este navegador não disponibiliza gravação em ' + format.toUpperCase() +
      '. Abra o estúdio em uma versão recente de Chrome ou Edge para tentar MP4.</p>' +
      (format === 'mp4' && recorderType(hasAudio, 'webm') ? button('Gravar WebM para converter', 'webm') : '') +
      '<p>Se gravar em WebM, converta com FFmpeg:</p><code>ffmpeg -i aula.webm -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart aula.mp4</code>');
    return;
  }
  modal(format === 'mp4' ? 'Exportar MP4' : 'Gravar WebM', html,
    { submit: fields => startExport(format, Number(fields.height), fields.cc === 'on'), label: 'Renderizar e baixar' });
}
async function startExport(format, height, withCC) {
  pause(); transport(); draw();
  const exporting = structuredClone(lesson());
  const controller = new AbortController();
  exportJob = controller;
  modal('Renderizando ' + format.toUpperCase(),
    '<p id="export-progress-label" role="status">Preparando mídia…</p><progress id="export-progress" max="1" value="0"></progress>' +
    '<div class="dialog-actions">' + button('Cancelar renderização', 'cancel-export') + '</div>');
  try {
    const blob = await recordLesson(exporting, {
      height, captions: withCC, format, signal: controller.signal, progress: value => {
        el('export-progress').value = value;
        el('export-progress-label').textContent = Math.round(value * 100) + '% · ' + labelTime(value * engine.duration(exporting));
      }
    });
    download(blob, slug(exporting.title) + '.' + format);
    dialog.close();
    flash(format.toUpperCase() + ' pronto para baixar.');
  } catch (error) {
    if (controller.signal.aborted) { dialog.close(); flash('Renderização cancelada.'); }
    else if (format === 'mp4' && recorderType(engine.audioSources(exporting).length > 0, 'webm')) {
      modal('Falha ao renderizar MP4', '<p>' + e(error.message) + '</p>' +
        button('Gravar WebM para converter', 'webm') +
        '<p>Converta o arquivo baixado com FFmpeg.</p><code>ffmpeg -i aula.webm -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart aula.mp4</code>');
    } else { dialog.close(); fail(error); }
  } finally { exportJob = null; }
}

function pasteLayers(items) {
  if (!items.length) throw Error('Copie uma ou mais camadas primeiro.');
  if (scene().layers.length + items.length > 200) throw Error('Limite de 200 camadas por cena.');
  change(() => {
    const groups = new Map();
    const pasted = items.map(item => {
      const copy = copyItem(item);
      if (copy.group) {
        if (!groups.has(copy.group)) groups.set(copy.group, uid());
        copy.group = groups.get(copy.group);
      }
      for (const [key, delta] of [['x', 26], ['y', 26]]) {
        copy[key] += delta;
        for (const frame of copy.keys[key] || []) frame.v += delta;
      }
      return copy;
    });
    scene().layers.push(...pasted);
    resizeScene(scene(), scene().duration);
    selection = new Set(pasted.map(o => o.id));
    tab = 'object'; camera = false;
  });
}
function alignLayers(action) {
  const targets = editable();
  const key = action.endsWith('-x') ? 'x' : 'y', distribute = action.startsWith('distribute');
  if (targets.length < (distribute ? 3 : 2)) throw Error(distribute ? 'Selecione três ou mais camadas desbloqueadas.' : 'Selecione duas ou mais camadas desbloqueadas.');
  const t = local();
  const values = targets.map(o => [o, engine.valueAt(o, key, t)]).sort((a, b) => a[1] - b[1]);
  const min = values[0][1], max = values.at(-1)[1];
  const mean = values.reduce((sum, entry) => sum + entry[1], 0) / values.length;
  change(() => values.forEach(([o], i) => setTransform(o, key, distribute ? min + i * (max - min) / (values.length - 1) : mean, t)));
}
function sceneReorder(index, direction) {
  const other = index + direction;
  const scenes = lesson().scenes;
  if (other < 0 || other >= scenes.length) return;
  const active = scene();
  change(() => {
    [scenes[index], scenes[other]] = [scenes[other], scenes[index]];
    sceneIndex = scenes.indexOf(active); head = offset();
  });
}
function layerReorder(direction) {
  const layers = scene().layers;
  const candidates = direction > 0 ? [...layers].reverse() : [...layers];
  change(() => candidates.filter(o => selection.has(o.id) && !o.locked).forEach(o => {
    const i = layers.indexOf(o), j = i + direction;
    if (j >= 0 && j < layers.length && !selection.has(layers[j].id)) {
      [layers[i], layers[j]] = [layers[j], layers[i]];
    }
  }));
}
function switchTab(next) {
  tab = next; renderInspector(); stageHeader(); draw();
}
function mediaPicker(type, replacement = null, backdrop = false) {
  const owner = scene();
  pick(available(type), file => {
    if (scene() !== owner) throw Error('Volte para a cena que receberá este arquivo.');
    return importImage(type, file, replacement, backdrop);
  });
}
function addCaption(fromScript = false) {
  const s = scene();
  if (s.captions.length >= 180) throw Error('Limite de 180 legendas por cena.');
  const start = fromScript ? 0 : Math.min(round(local()), s.duration - .1);
  const clip = { id: uid(), start, end: fromScript ? s.duration : Math.min(s.duration, start + 2.5),
    text: fromScript ? s.narration : '' };
  if (fromScript && !clip.text.trim()) throw Error('Adicione o texto de narração antes de criar a legenda.');
  change(() => { s.captions.push(clip); focusClip = clip.id; tab = 'sound'; });
}
async function fullScreen() {
  const target = el('theater');
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (target.classList.contains('fullscreen-fallback')) target.classList.remove('fullscreen-fallback');
  else if (target.requestFullscreen) await target.requestFullscreen().catch(() => target.classList.add('fullscreen-fallback'));
  else target.classList.add('fullscreen-fallback');
  draw();
}
const actions = {
  play: startPlay, previous: () => sceneGo(sceneIndex - 1), next: () => sceneGo(sceneIndex + 1),
  scene: index => sceneGo(Number(index)), viewer: () => setViewer(true), 'edit-mode': () => setViewer(false),
  fullscreen: fullScreen, caption: () => { captions = !captions; render(); },
  undo: () => historyStep('undo'), redo: () => historyStep('redo'),
  save: versionSave, versions: versionDialog, json: () => downloadJSON(project),
  html: () => downloadHTML(lesson(), captions), srt: () => downloadSRT(lesson()),
  png: () => framePNG(scene(), local(), captions),
  print: () => printLesson(structuredClone(lesson()), window.open('', '_blank')),
  mp4: () => exportDialog(), webm: () => exportDialog('webm'),
  'cancel-export': () => exportJob?.abort(),
  conversion: () => modal('Conversão para MP4 H.264 / AAC',
    '<p>Escolha o MP4 já renderizado ou grave um WebM intermediário. Use o FFmpeg no computador para converter o arquivo e compartilhá-lo em aparelhos que só reproduzem H.264/AAC.</p>' +
    '<code>ffmpeg -i aula.mp4 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart aula-compativel.mp4</code>' +
    '<p>Para WebM, troque a entrada por aula.webm.</p>' +
    (recorderType(engine.audioSources(lesson()).length > 0, 'webm') ? button('Gravar WebM', 'webm') : '')),
  import: () => pick('.json,application/json', importJSON),
  'restore-version': index => {
    const previous = versions[Number(index)].project;
    confirmChange('Restaurar versão', 'O projeto atual será registrado antes da restauração.', () => {
      versionSave();
      change(() => { project = structuredClone(previous); lessonId = project.lessons[0].id; sceneIndex = 0; head = 0; selection.clear(); });
    });
  },
  'dl-version': i => downloadJSON(versions[Number(i)].project),
  close: () => { if (exportJob) exportJob.abort(); else dialog.close(); },
  tab: value => { shelf = value; render(); },
  inspector: switchTab,
  'show-scene': () => switchTab('scene'),
  'show-sound': () => switchTab('sound'),
  camera: () => { camera = true; selection.clear(); tab = 'object'; render(); },
  'reset-camera': () => change(() => {
    for (const [key, value] of [['x', W / 2], ['y', H / 2], ['zoom', 1]]) setTransform(scene().camera, key, value);
  }),
  select: (id, event) => { selectObject(id, event.shiftKey); render(); },
  'new-lesson': () => lessonModal(true), 'lesson-info': () => lessonModal(false),
  'dup-lesson': () => {
    if (project.lessons.length >= 40) throw Error('Limite de 40 treinamentos no projeto.');
    change(() => {
      const l = copyItem(lesson(), true); delete l.legacyId; l.title += ' · cópia';
      project.lessons.push(l); lessonId = l.id; sceneIndex = 0; head = 0; selection.clear();
    });
  },
  'del-lesson': () => {
    if (project.lessons.length === 1) throw Error('Mantenha pelo menos um treinamento no projeto.');
    confirmChange('Excluir treinamento', lesson().title, () => change(() => {
      project.lessons = project.lessons.filter(l => l.id !== lesson().id);
      lessonId = project.lessons[0].id; sceneIndex = 0; head = 0; selection.clear();
    }));
  },
  'new-scene': () => addScene('blank'),
  templates: () => modal('Modelos de cena', '<div class="stack">' +
    [['panel', 'Quadro e invólucro'], ['breaker', 'Vista explodida'], ['circuit', 'Circuito comutado'], ['chart', 'Gráfico progressivo']]
      .map(([value, label]) => button(label, 'use-template', value, 'class="soft"')).join('') + '</div>'),
  'use-template': kind => { addScene(kind); dialog.close(); },
  'dup-scene': () => {
    if (lesson().scenes.length >= 100) throw Error('Limite de 100 cenas por aula.');
    change(() => {
      const s = copyItem(scene()); s.title += ' · cópia';
      for (const o of s.layers) o.id = uid();
      lesson().scenes.splice(sceneIndex + 1, 0, s); sceneIndex++; head = offset(); selection.clear();
    });
  },
  'del-scene': () => {
    if (lesson().scenes.length === 1) throw Error('Mantenha pelo menos uma cena no treinamento.');
    confirmChange('Excluir cena', scene().title, () => change(() => {
      lesson().scenes.splice(sceneIndex, 1); sceneIndex = Math.min(sceneIndex, lesson().scenes.length - 1);
      head = offset(); selection.clear();
    }));
  },
  'scene-up': index => sceneReorder(Number(index), -1), 'scene-down': index => sceneReorder(Number(index), 1),
  insert: () => {
    modal('Inserir elemento', '<input type="search" id="insert-search" placeholder="Buscar recursos" aria-label="Buscar recursos"><div id="insert-results" class="stack" style="margin-top:8px">' +
      assetCards() + '</div>');
    el('insert-search').oninput = () => { el('insert-results').innerHTML = assetCards(el('insert-search').value); };
  },
  asset: type => {
    if (type === 'image' || type === 'video') mediaPicker(type);
    else insert(type);
    dialog.close();
  },
  backdrop: () => mediaPicker('image', null, true),
  'clear-backdrop': () => change(() => { scene().backdrop = ''; }),
  'replace-media': () => { const o = primary(); if (o && !o.locked) mediaPicker(o.type, o); },
  visible: id => change(() => { const o = scene().layers.find(o => o.id === id); o.visible = !o.visible; }),
  lock: id => change(() => { const o = scene().layers.find(o => o.id === id); o.locked = !o.locked; }),
  'del-object': () => {
    if (!editable().length) return;
    change(() => { scene().layers = scene().layers.filter(o => !selection.has(o.id) || o.locked); selection.clear(); });
  },
  copy: () => { clipboard = structuredClone(selected()); if (clipboard.length) flash('Camadas copiadas. Você pode colar em outra cena.'); },
  paste: () => pasteLayers(clipboard), 'dup-object': () => pasteLayers(editable()),
  'layer-up': () => layerReorder(1), 'layer-down': () => layerReorder(-1),
  group: () => {
    const layers = editable();
    if (layers.length < 2) return;
    change(() => { const group = uid(); layers.forEach(o => { o.group = group; }); });
  },
  ungroup: () => change(() => editable().forEach(o => { o.group = ''; })),
  'align-x': alignLayers, 'align-y': alignLayers, 'distribute-x': alignLayers, 'distribute-y': alignLayers,
  'zoom-in': () => { zoom = Math.min(290, zoom * 1.3); renderTimeline(); },
  'zoom-out': () => { zoom = Math.max(6, zoom / 1.3); renderTimeline(); },
  key: () => keyDialog(), motion: motionDialog,
  'audio-voice': () => { const s = scene(); pick(available('audio'), file => addAudio(file, 'voice', s)); },
  'audio-music': () => { const s = scene(); pick(available('audio'), file => addAudio(file, 'audio', s)); },
  'record-voice': recordVoice,
  'del-audio': id => change(() => { scene().audio = scene().audio.filter(a => a.id !== id); }),
  'add-caption': () => addCaption(), 'caption-from-script': () => addCaption(true),
  'del-caption': id => change(() => { scene().captions = scene().captions.filter(c => c.id !== id); })
};
for (const action of ['align-x', 'align-y', 'distribute-x', 'distribute-y']) actions[action] = () => alignLayers(action);

function numberValue(input) {
  const min = input.min === '' ? -Infinity : Number(input.min), max = input.max === '' ? Infinity : Number(input.max);
  return clamp(input.valueAsNumber, min, max);
}
function editField(event) {
  const input = event.target, node = input.closest('[data-scope]');
  if (!node || !input.name) return;
  const value = input.type === 'number' ? numberValue(input) : input.type === 'checkbox' ? input.checked : input.value;
  if (typeof value === 'number' && !Number.isFinite(value)) { renderInspector(); return; }
  const s = scene();
  const scope = node.dataset.scope;
  const target = scope === 'scene' ? s : scope === 'camera' ? s.camera :
    scope === 'object' ? primary() : (scope === 'audio' ? s.audio : s.captions).find(item => item.id === node.dataset.id);
  if (!target || target.locked) return;
  const key = input.name;
  change(() => {
    if (scope === 'scene' && key === 'duration') {
      resizeScene(s, value); head = offset() + Math.min(local(), value - .00001);
    } else if ((scope === 'object' && OBJECT_KEYS.includes(key)) || (scope === 'camera' && CAMERA_KEYS.includes(key))) {
      setTransform(target, key, value);
    } else {
      target[key] = value;
      if (key === 'start' && target.end != null) target.end = Math.max(target.end, target.start);
      if (scope === 'audio' || scope === 'caption') focusClip = target.id;
    }
  });
}

function pointer(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
}
function canvasDown(event) {
  if (viewer || event.button !== 0 || activeDrag) return;
  pause();
  const cursor = pointer(event);
  const hitPadding = 10 * W / canvas.clientWidth;
  const current = primary();
  let mode = 'move', target = null, corner = null;
  if (current && !current.locked && el('guides').checked) {
    const b = box(current), rel = relative(cursor, b);
    if (Math.hypot(rel.x, rel.y + b.h / 2 + hitPadding * 1.6) <= hitPadding) {
      target = current; mode = 'rotate';
    } else {
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (Math.hypot(rel.x - x * b.w / 2, rel.y - y * b.h / 2) <= hitPadding) {
          target = current; mode = 'resize'; corner = { x, y }; break;
        }
      }
    }
  }
  if (!target) {
    target = [...scene().layers].reverse().find(o => {
      if (o.locked || !engine.visibleAt(o, local())) return false;
      const b = box(o), p = relative(cursor, b);
      return Math.abs(p.x) <= Math.max(b.w / 2, hitPadding) && Math.abs(p.y) <= Math.max(b.h / 2, hitPadding);
    });
    if (camera && !target) mode = 'camera';
    else if (!target) { selection.clear(); render(); return; }
    else if (event.shiftKey || !selection.has(target.id)) selectObject(target.id, event.shiftKey);
    if (target && !selection.has(target.id)) { render(); return; }
  }
  const at = local();
  activeDrag = { pointerId: event.pointerId, cursor, start: toScene(cursor), mode, corner, at,
    target, box: target && box(target), before: snapshot(),
    original: target ? new Map(editable().map(o => [o.id, engine.state(o, at)])) : new Map(),
    cam: engine.state(scene().camera, at, true), moved: false };
  canvas.setPointerCapture(event.pointerId);
  render();
}
function canvasMove(event) {
  const d = activeDrag;
  if (!d || d.pointerId !== event.pointerId) return;
  const p = pointer(event);
  if (!d.moved && Math.hypot(p.x - d.cursor.x, p.y - d.cursor.y) < 4) return;
  d.moved = true;
  if (d.mode === 'camera') {
    setTransform(scene().camera, 'x', d.cam.x - (p.x - d.cursor.x) / d.cam.zoom, d.at);
    setTransform(scene().camera, 'y', d.cam.y - (p.y - d.cursor.y) / d.cam.zoom, d.at);
  } else if (d.mode === 'move') {
    const point = toScene(p);
    let dx = point.x - d.start.x, dy = point.y - d.start.y;
    const anchor = d.original.get(d.target.id);
    if (el('snap').checked && !event.altKey) {
      dx = Math.round((anchor.x + dx) / 10) * 10 - anchor.x;
      dy = Math.round((anchor.y + dy) / 10) * 10 - anchor.y;
    }
    for (const o of editable()) {
      const state = d.original.get(o.id);
      setTransform(o, 'x', state.x + dx, d.at); setTransform(o, 'y', state.y + dy, d.at);
    }
  } else if (d.mode === 'rotate') {
    const angle = p => Math.atan2(p.y - d.box.y, p.x - d.box.x);
    let rotation = d.original.get(d.target.id).rotation + (angle(p) - angle(d.cursor)) * 180 / Math.PI;
    if (el('snap').checked && !event.altKey) rotation = Math.round(rotation / 15) * 15;
    setTransform(d.target, 'rotation', rotation, d.at);
  } else {
    const rel = relative(p, d.box), state = d.original.get(d.target.id);
    const scale = state.scale * d.cam.zoom;
    const width = clamp(d.corner.x * rel.x * 2 / scale, 4, 3000);
    const height = clamp(d.corner.y * rel.y * 2 / scale, 4, 3000);
    const uniform = event.shiftKey || ['panel', 'breaker', 'image', 'video'].includes(d.target.type);
    d.target.w = width;
    d.target.h = uniform ? clamp(state.h * width / state.w, 4, 3000) : height;
  }
  draw();
}
function canvasUp(event) {
  const d = activeDrag;
  if (!d || d.pointerId !== event.pointerId) return;
  activeDrag = null;
  if (event.type === 'pointercancel' && d.moved) { restore(d.before); return; }
  if (d.moved) remember(d.before);
  render();
}

function timelineItem(button) {
  const { track, id, prop, frame } = button.dataset, s = scene();
  if (frame != null) {
    const target = track === 'camera' ? s.camera : s.layers.find(o => o.id === id);
    const k = target?.keys?.[prop]?.[Number(frame)];
    return k && { target, item: k, start: k.t, prop, track, keyframe: true };
  }
  const item = track === 'object' ? s.layers.find(o => o.id === id) :
    track === 'transition' ? s : (track === 'caption' ? s.captions : s.audio).find(c => c.id === id);
  if (!item) return;
  return { item, track, start: track === 'transition' ? 0 : item.start,
    end: track === 'transition' ? s.fade : item.end ?? s.duration };
}
function activateClip(data) {
  if (data.keyframe) { sceneSeek(data.start); keyDialog(data.target, data.prop, data.item); return; }
  if (data.track === 'object') { selectObject(data.item.id); render(); }
  else if (data.track === 'transition') switchTab('scene');
  else { focusClip = data.item.id; switchTab('sound'); }
}
function timelineDown(event) {
  if (event.button !== 0 || timelineDrag) return;
  const lane = event.target.closest('.lane');
  if (!lane) return;
  const cell = event.target.closest('.clip,.keyframe');
  const data = cell && timelineItem(cell);
  const rect = lane.getBoundingClientRect();
  const duration = scene().duration;
  if (data && (data.target?.locked || data.item?.locked)) {
    try { activateClip(data); } catch (error) { fail(error); } return;
  }
  pause();
  timelineDrag = { id: event.pointerId, rect, duration, baseX: event.clientX, data, moved: false,
    resize: event.target.classList.contains('clip-handle'), before: data ? snapshot() : null };
  el('tracks').setPointerCapture(event.pointerId);
  if (!data) sceneSeek((event.clientX - rect.left) / rect.width * duration);
}
function timelineMove(event) {
  const d = timelineDrag;
  if (!d || d.id !== event.pointerId) return;
  if (!d.data) { sceneSeek((event.clientX - d.rect.left) / d.rect.width * d.duration); return; }
  if (!d.moved && Math.abs(event.clientX - d.baseX) < 4) return;
  d.moved = true;
  const delta = (event.clientX - d.baseX) / d.rect.width * d.duration;
  const { item, start, end, keyframe, track } = d.data;
  if (keyframe) {
    item.t = round(clamp(start + delta, 0, d.duration));
    const frames = d.data.target.keys[d.data.prop];
    frames.sort((a, b) => a.t - b.t);
    head = offset() + Math.min(item.t, d.duration - .00001);
  } else if (track === 'transition') {
    item.fade = round(clamp(end + delta, 0, d.duration / 2));
  } else if (d.resize) {
    item.end = round(clamp(end + delta, start + Math.min(.1, d.duration - start), d.duration));
  } else {
    const next = round(clamp(start + delta, 0, d.duration - (end - start)));
    item.start = next; item.end = round(next + end - start);
  }
  draw(); transport(); renderTimeline();
}
function timelineUp(event) {
  const d = timelineDrag;
  if (!d || d.id !== event.pointerId) return;
  timelineDrag = null;
  if (!d.data) return;
  if (event.type === 'pointercancel') { if (d.moved) restore(d.before); return; }
  if (!d.moved) { try { activateClip(d.data); } catch (error) { fail(error); } return; }
  if (d.data.keyframe) {
    const { target, prop, item } = d.data;
    target.keys[prop] = target.keys[prop].filter(k => k === item || k.t !== item.t);
  }
  remember(d.before); render();
}

function keyboard(event) {
  if (dialog.open || event.target.closest('input, textarea, select, button, summary, [contenteditable=true]')) return;
  const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  if (event.code === 'Space') { event.preventDefault(); startPlay(); return; }
  if (key === 'escape' && el('theater').classList.contains('fullscreen-fallback')) { fullScreen(); return; }
  if (viewer) return;
  if (modifier) {
    const command = { z: event.shiftKey ? 'redo' : 'undo', y: 'redo', c: 'copy', v: 'paste', d: 'dup-object', s: 'save' }[key];
    if (!command) return;
    event.preventDefault();
    try { actions[command](); } catch (error) { fail(error); }
  } else if (['backspace', 'delete'].includes(key) && selection.size) {
    event.preventDefault(); actions['del-object']();
  } else if (key.startsWith('arrow') && editable().length) {
    event.preventDefault();
    const coord = key === 'arrowleft' || key === 'arrowright' ? 'x' : 'y';
    const delta = (key === 'arrowleft' || key === 'arrowup' ? -1 : 1) * (event.shiftKey ? 10 : 1);
    change(() => editable().forEach(o => setTransform(o, coord, engine.valueAt(o, coord, local()) + delta)));
  }
}
function events() {
  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]');
    if (!target || !Object.hasOwn(actions, target.dataset.action)) return;
    if (target.closest('.export-pop')) target.closest('details').open = false;
    try { await actions[target.dataset.action](target.dataset.value, event); } catch (error) { fail(error); }
  });
  el('project-name').onchange = event => change(() => { project.name = event.target.value.trim() || 'Norma em Cena'; });
  el('lesson-select').onchange = event => lessonGo(event.target.value);
  el('seek').oninput = event => seek(Number(event.target.value));
  el('properties').onchange = editField;
  el('asset-search').oninput = event => { el('assets').innerHTML = assetCards(event.target.value); };
  el('guides').onchange = draw;
  canvas.addEventListener('pointerdown', canvasDown);
  canvas.addEventListener('pointermove', canvasMove);
  canvas.addEventListener('pointerup', canvasUp);
  canvas.addEventListener('pointercancel', canvasUp);
  el('tracks').addEventListener('pointerdown', timelineDown);
  el('tracks').addEventListener('pointermove', timelineMove);
  el('tracks').addEventListener('pointerup', timelineUp);
  el('tracks').addEventListener('pointercancel', timelineUp);
  el('tracks').addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const btn = event.target.closest('.clip,.keyframe');
    if (!btn) return;
    event.preventDefault(); event.stopPropagation();
    const data = timelineItem(btn);
    try { if (data) activateClip(data); } catch (error) { fail(error); }
  });
  document.addEventListener('keydown', keyboard);
  document.addEventListener('fullscreenchange', draw);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (playing || waiting)) { pause(); draw(); transport(); }
    if (document.hidden && dirty) persist();
  });
  window.addEventListener('beforeunload', event => {
    if (dirty || exportJob || recording) { event.preventDefault(); event.returnValue = true; }
  });
  dialog.addEventListener('cancel', event => {
    if (exportJob) { event.preventDefault(); exportJob.abort(); }
  });
}

async function init() {
  let saved;
  try { saved = await load(); } catch { setStatus('Armazenamento indisponível'); }
  let initial;
  if (saved?.project) {
    try {
      initial = normalize(saved.project);
      if (!initial.lessons.length) initial = undefined;
      else {
        versions = (saved.versions || []).filter(v => v?.project).slice(0, 8);
        setStatus('Salvo neste navegador');
      }
    } catch { flash('Dados locais não reconhecidos. Importe uma cópia JSON para recuperar seu trabalho.'); }
  }
  if (!initial) {
    initial = importLegacy(loadProject());
    initial.lessons.unshift(demo());
    if (el('save-state').textContent === 'Carregando…') setStatus('Salvamento local');
  }
  project = initial;
  const wanted = params.get('assistir') || params.get('aula');
  if (wanted === 'demo-quadro' && !project.lessons.some(l => l.id === wanted)) project.lessons.unshift(demo());
  if (wanted === 'sdai-es-previa-cbmes' && !project.lessons.some(l => l.id === wanted)) {
    try {
      if (project.lessons.length >= 40) throw Error('A prévia precisa de espaço para mais uma aula neste projeto.');
      const url = new URL('../../projects/sdai-es-previa-cbmes.json', import.meta.url);
      const response = await fetch(url);
      if (!response.ok) throw Error('Não foi possível carregar a prévia de SDAI. Tente recarregar a página.');
      const preview = normalize(await response.json()).lessons.find(l => l.id === wanted);
      if (!preview) throw Error('A prévia de SDAI está indisponível.');
      project.lessons.push(preview);
    } catch (error) {
      fail(error);
    }
  }
  // Add lessons created in the previous editor since the first migration.
  if (wanted && !project.lessons.some(l => l.id === wanted)) {
    const legacy = importLegacy(loadProject()).lessons.find(l => l.id === wanted);
    if (legacy) { project.lessons.push(legacy); changed(); }
  }
  lessonId = project.lessons.some(l => l.id === wanted) ? wanted : project.lessons[0].id;
  events(); render();
  el('workspace').setAttribute('aria-busy', 'false');
  if (params.has('novo') && !viewer) {
    const url = new URL(location.href); url.searchParams.delete('novo');
    history.replaceState(null, '', url);
    lessonModal(true);
  }
}
init().catch(error => { el('stage-title').textContent = 'Falha ao abrir o projeto'; fail(error); });
