import { createEngine, engine } from './engine.js';

export const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
export const slug = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'norma-em-cena';

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function fileData(file) {
  if (file.size > 24_000_000) return Promise.reject(Error('O arquivo deve ter até 24 MB. Comprima e tente novamente.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('Não foi possível abrir o arquivo.'));
    reader.readAsDataURL(file);
  });
}
export const downloadJSON = project => download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
  slug(project.name) + '-editavel.json');

function timecode(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const units = [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60];
  return units.map(n => String(n).padStart(2, '0')).join(':') + ',' + String(ms % 1000).padStart(3, '0');
}
export function makeSRT(lesson) {
  let offset = 0;
  const subtitles = [];
  for (const scene of lesson.scenes) {
    for (const caption of [...scene.captions].sort((a, b) => a.start - b.start)) {
      const text = caption.text.trim().replace(/\r/g, '').replace(/\n{2,}/g, '\n');
      if (caption.end <= caption.start || !text) continue;
      subtitles.push((subtitles.length + 1) + '\n' + timecode(offset + caption.start) + ' --> ' +
        timecode(offset + caption.end) + '\n' + text);
    }
    offset += scene.duration;
  }
  return subtitles.length ? subtitles.join('\n\n') + '\n' : '';
}
export function downloadSRT(lesson) {
  const srt = makeSRT(lesson);
  if (!srt) throw Error('Adicione ao menos uma legenda com texto e duração.');
  download(new Blob([srt], { type: 'text/plain;charset=utf-8' }), slug(lesson.title) + '.srt');
}

function standalone() {
  const engine = createEngine();
  const lesson = JSON.parse(document.getElementById('lesson-data').textContent);
  const options = JSON.parse(document.getElementById('options').textContent);
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const slider = document.querySelector('input');
  const play = document.getElementById('play');
  const cc = document.getElementById('cc');
  const message = document.querySelector('output');
  const select = document.querySelector('select');
  const pending = new Set(), media = new Map(), audio = engine.createAudio();
  let t = 0, running = false, clock, offset = 0, request = 0, token = 0;
  const total = engine.duration(lesson);
  slider.max = total;
  const clipList = engine.audioSources(lesson);
  const time = n => Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0');
  lesson.scenes.forEach((scene, i) => select.add(new Option(scene.title, i)));
  const syncCC = () => { cc.setAttribute('aria-pressed', String(options.captions)); };
  function draw() {
    const p = engine.position(lesson, t);
    engine.prepareScene(p.scene, media, pending, () => { if (!running) draw(); });
    engine.syncVideos(p.scene, p.time, running, media);
    engine.paint(ctx, p.scene, p.time, media, options);
    select.value = p.index;
    slider.value = t;
    message.value = time(t) + ' / ' + time(total);
  }
  function frame() {
    if (!running) return;
    t = Math.min(total, Math.max(0, clock() - offset));
    if (t >= total) pause();
    draw();
    if (running) request = requestAnimationFrame(frame);
  }
  async function start() {
    if (t >= total) t = 0;
    const attempt = ++token;
    try {
      if (clipList.length) {
        const timing = await audio.schedule(clipList.filter(a => a.end > t), t, undefined, .06, () => attempt === token);
        if (!timing) return;
        clock = timing.clock; offset = timing.when - t;
      } else {
        clock = () => performance.now() / 1000;
        offset = clock() - t;
      }
      running = true; play.textContent = 'Pausar'; frame();
    } catch {
      message.value = 'Não foi possível reproduzir a faixa de áudio neste navegador.';
    }
  }
  function pause() {
    token++; running = false; audio.stop(); cancelAnimationFrame(request); play.textContent = 'Reproduzir';
  }
  play.onclick = () => { if (running) pause(); else start(); };
  slider.oninput = () => { pause(); t = Number(slider.value); draw(); };
  select.onchange = () => {
    pause();
    t = lesson.scenes.slice(0, Number(select.value)).reduce((sum, s) => sum + s.duration, 0);
    draw();
  };
  cc.onclick = () => { options.captions = !options.captions; syncCC(); draw(); };
  document.getElementById('full').onclick = () => {
    const wrapper = document.querySelector('main');
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (wrapper.requestFullscreen) wrapper.requestFullscreen().catch(() => wrapper.classList.toggle('full'));
    else wrapper.classList.toggle('full');
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); draw(); } });
  for (const scene of lesson.scenes) engine.prepareScene(scene, media, pending, draw);
  syncCC(); draw();
}

export function htmlFor(lesson, captions = true) {
  const json = data => JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(lesson.title)} — Norma em Cena</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef3fa;color:#102754;font:16px/1.45 system-ui,sans-serif}
main{width:min(100%,1100px);margin:auto;padding:clamp(12px,3vw,40px);background:#eef3fa}
main:fullscreen,.full{width:100%;max-width:none;height:100%;overflow:auto}.full{position:fixed;inset:0;z-index:10}
h1{font-size:clamp(24px,5vw,42px);margin:4px 0 12px}p{margin:0 0 18px}canvas{display:block;width:100%;height:auto;border:1px solid #bccce2;border-radius:12px;background:#eaf1fa}
header{margin-bottom:12px}small{font-weight:750;color:#285cbc}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0}
button,select{font:inherit;color:#112c52;padding:9px;background:white;border:1px solid #bfcde0;border-radius:8px;min-height:42px}
button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #4c87fa;outline-offset:2px}
input[type=range]{width:100%;accent-color:#275cda}select{max-width:100%}button[aria-pressed=true]{background:#dceaff}output{font-variant-numeric:tabular-nums}
</style></head>
<body><main><header><small>Norma em Cena</small><h1>${escape(lesson.title)}</h1><p>${escape(lesson.description)}</p></header>
<canvas width="1280" height="720" aria-label="Treinamento animado"></canvas>
<input type="range" min="0" step=".01" value="0" aria-label="Tempo da aula">
<div class="controls"><button id="play">Reproduzir</button><select aria-label="Ir para cena"></select><button id="cc">Legendas</button><button id="full">Tela cheia</button><output></output></div>
</main><script type="application/json" id="lesson-data">${json(lesson)}</script>
<script type="application/json" id="options">${json({ captions })}</script>
<script>const createEngine=${createEngine.toString()};(${standalone.toString()})();</script>
</body></html>`;
}
export function downloadHTML(lesson, captions) {
  download(new Blob([htmlFor(lesson, captions)], { type: 'text/html;charset=utf-8' }), slug(lesson.title) + '.html');
}

function waitFor(node, event, seconds = 12) {
  return new Promise((resolve, reject) => {
    function done(error) {
      clearTimeout(timer); node.removeEventListener(event, success); node.removeEventListener('error', failure);
      if (error) reject(error); else resolve();
    }
    const success = () => done();
    const failure = () => done(Error('O navegador não conseguiu abrir um dos recursos de mídia.'));
    const timer = setTimeout(() => done(Error('Tempo excedido ao carregar mídia.')), seconds * 1000);
    node.addEventListener(event, success, { once: true });
    node.addEventListener('error', failure, { once: true });
    if (node.error) failure();
  });
}
async function prepare(lesson) {
  const media = new Map(), pending = new Set();
  for (const s of lesson.scenes) engine.prepareScene(s, media, pending);
  const timeout = performance.now() + 12000;
  while (pending.size && performance.now() < timeout) await new Promise(r => setTimeout(r, 30));
  if (pending.size || [...media.values()].includes(null)) throw Error('Uma das imagens do treinamento não pôde ser carregada.');
  await Promise.all([...media.values()].filter(v => v?.tagName === 'VIDEO' && v.readyState < 2)
    .map(v => waitFor(v, 'loadeddata')));
  return media;
}
async function seekFrame(scene, t, media) {
  await Promise.all(scene.layers.filter(o => o.type === 'video' && engine.visibleAt(o, t) && media.has(o.id)).map(async o => {
    const video = media.get(o.id);
    const target = Math.max(0, Math.min(video.duration - .04, t - o.start));
    if (Math.abs(video.currentTime - target) <= .035) return;
    video.currentTime = target;
    await waitFor(video, 'seeked');
  }));
}
function newCanvas(width = 1280, height = 720) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  return c;
}
export async function framePNG(scene, time, captions) {
  const canvas = newCanvas();
  const media = await prepare({ scenes: [scene] });
  await seekFrame(scene, time, media);
  engine.paint(canvas.getContext('2d'), scene, time, media, { captions, transition: false });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw Error('Não foi possível criar o PNG.');
  download(blob, slug(scene.title) + '.png');
}
export async function printLesson(lesson, win) {
  if (!win) throw Error('Autorize janelas pop-up para abrir a versão de impressão.');
  try {
    const canvas = newCanvas(960, 540);
    const ctx = canvas.getContext('2d'), media = await prepare(lesson);
    const pages = [];
    for (const [i, scene] of lesson.scenes.entries()) {
      const t = scene.duration * .72;
      await seekFrame(scene, t, media);
      engine.paint(ctx, scene, t, media, { captions: false, transition: false });
      const art = canvas.toDataURL('image/jpeg', .9);
      const para = (label, text) => text ? '<p><strong>' + label + '</strong> ' + escape(text) + '</p>' : '';
      pages.push('<article><h2>' + (i + 1) + '. ' + escape(scene.title) + '</h2>' + para('Capítulo', scene.chapter) +
        '<img alt="Quadro da cena" src="' + art + '">' + para('Texto', scene.text) +
        para('Narração', scene.narration) + para('Referências', scene.reference) + '</article>');
    }
    win.document.title = lesson.title + ' — Norma em Cena';
    win.document.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>@page{margin:15mm}body{font:14px/1.5 system-ui,sans-serif;color:#102754;margin:24px auto;max-width:880px;padding:0 16px}article{break-inside:avoid;border-top:1px solid #becfe4;padding:12px 0;margin-top:18px}img{width:min(100%,680px);display:block}p{white-space:pre-wrap;margin:8px 0}h1,h2{line-height:1.2}button{font:inherit;padding:10px}@media print{button{display:none}body{padding:0;margin:0}}</style>`;
    win.document.body.innerHTML = '<button id="print">Imprimir / salvar PDF</button><h1>' + escape(lesson.title) + '</h1><p>' +
      escape(lesson.description) + '</p>' + pages.join('');
    win.document.documentElement.lang = 'pt-BR';
    win.document.getElementById('print').onclick = () => win.print();
    await Promise.all([...win.document.images].map(img => img.decode().catch(() => {})));
    win.focus(); win.print();
  } catch (error) { win.close(); throw error; }
}

export function recorderType(hasAudio, preferred = 'mp4') {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = preferred === 'webm'
    ? [hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8', 'video/webm']
    : [hasAudio ? 'video/mp4;codecs=avc1.420034,mp4a.40.2' : 'video/mp4;codecs=avc1.420034', 'video/mp4'];
  return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

export async function recordLesson(lesson, { height, captions, signal, progress, format = 'mp4' }) {
  const audioClips = engine.audioSources(lesson);
  const mimeType = recorderType(audioClips.length > 0, format);
  if (!mimeType || !HTMLCanvasElement.prototype.captureStream) {
    throw Error(format === 'mp4' ? 'Este navegador não codifica MP4. Use o fluxo WebM descrito em “Conversão de vídeo”.' :
      'Este navegador não oferece captura em WebM.');
  }
  const total = engine.duration(lesson), audio = engine.createAudio();
  const ctx = audioClips.length ? await audio.resume() : null;
  let stream, recorder, frame, abortHandler;
  try {
    const media = await prepare(lesson);
    signal.throwIfAborted();
    const width = height === 1080 ? 1920 : 1280;
    const canvas = newCanvas(width, height), context = canvas.getContext('2d');
    const draw = t => {
      const p = engine.position(lesson, t);
      engine.syncVideos(p.scene, p.time, t > 0 && t < total, media);
      engine.paint(context, p.scene, p.time, media, { captions });
    };
    draw(0);
    stream = canvas.captureStream(30);
    const mixer = ctx?.createMediaStreamDestination();
    if (mixer) for (const track of mixer.stream.getAudioTracks()) stream.addTrack(track);
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: height === 1080 ? 8_000_000 : 4_500_000,
      ...(mixer ? { audioBitsPerSecond: 160_000 } : {}) });
    const chunks = [];
    const finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] }));
      recorder.onerror = event => reject(event.error || Error('Falha no codificador.'));
    });
    // Decode all tracks before starting the recorder; audio and frames use the same clock.
    const timing = mixer ? await audio.schedule(audioClips, 0, mixer, .08) : null;
    signal.throwIfAborted();
    recorder.start(250);
    const start = performance.now() / 1000;
    const untilDone = new Promise((resolve, reject) => {
      abortHandler = () => reject(signal.reason);
      signal.addEventListener('abort', abortHandler, { once: true });
      function tick() {
        try {
          if (document.hidden) throw Error('Mantenha o estúdio visível durante a gravação do vídeo.');
          const t = Math.min(total, Math.max(0, timing ? timing.clock() - timing.when : performance.now() / 1000 - start));
          draw(t); progress(t / total);
          if (t >= total) { recorder.stop(); resolve(); }
          else frame = requestAnimationFrame(tick);
        } catch (error) { reject(error); }
      }
      frame = requestAnimationFrame(tick);
    });
    const blob = await Promise.race([untilDone.then(() => finished), finished]);
    if (!blob.size) throw Error('A gravação ficou vazia.');
    return blob;
  } finally {
    if (abortHandler) signal.removeEventListener('abort', abortHandler);
    cancelAnimationFrame(frame);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    await audio.close();
  }
}
