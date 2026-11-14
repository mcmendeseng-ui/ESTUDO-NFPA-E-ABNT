import { makeId } from '../data.js';

export const W = 1280;
export const H = 720;
export const FORMAT = 'norma-em-cena-estudio';
export const uid = makeId;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const numeric = (value, fallback, min, max) =>
  Number.isFinite(Number(value)) && value !== '' && value != null
    ? clamp(Number(value), min, max) : fallback;
const str = (value, fallback = '', max = 8000) =>
  typeof value === 'string' ? value.slice(0, max) : fallback;
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

export const ASSETS = {
  text: ['Texto', 'Tipografia', 430, 95],
  rect: ['Retângulo', 'Forma', 240, 130],
  ellipse: ['Elipse', 'Forma', 180, 140],
  line: ['Linha / condutor', 'Diagrama', 220, 8],
  arrow: ['Seta', 'Diagrama', 220, 34],
  panel: ['Quadro elétrico', 'Equipamento', 455, 470],
  breaker: ['Disjuntor didático', 'Equipamento', 250, 310],
  bus: ['Barramento', 'Equipamento', 300, 115],
  circuit: ['Circuito de iluminação', 'Diagrama', 620, 330],
  chart: ['Gráfico de resposta', 'Diagrama', 435, 250],
  symbol: ['Símbolo elétrico', 'Ícone', 130, 130],
  image: ['Imagem / SVG', 'Mídia', 410, 250],
  video: ['Vídeo', 'Mídia', 480, 270]
};
export const OBJECT_KEYS = ['x', 'y', 'scale', 'rotation', 'opacity', 'effect'];
export const CAMERA_KEYS = ['x', 'y', 'zoom'];
export const EASES = {
  linear: 'Linear', smooth: 'Suave', in: 'Acelerar', out: 'Desacelerar', hold: 'Manter'
};
export const MOTIONS = {
  reveal: 'Aparecer', slide: 'Deslizar', assemble: 'Montagem', pulse: 'Destacar',
  open: 'Abrir / acionar', close: 'Fechar / desligar', flow: 'Fluxo contínuo'
};

export function object(type, overrides = {}) {
  const [name, , w, h] = ASSETS[type];
  return {
    id: uid(), type, name, x: W / 2, y: H / 2, w, h, scale: 1,
    rotation: 0, opacity: 1, effect: 0, fill: '#2459c9', stroke: '#153568',
    border: 0, shadow: 0, visible: true, locked: false, flip: false, group: '',
    text: 'Novo texto', font: 35, bold: false, align: 'left', symbol: 'lamp',
    src: '', start: 0, end: null, keys: {}, ...overrides
  };
}
export function newScene(overrides = {}) {
  return {
    id: uid(), title: 'Nova cena', chapter: 'Capítulo 1', duration: 8,
    background: '#eef3fa', backdrop: '', style: 'grid', text: '', narration: '',
    reference: '', transition: 'cut', fade: 0.45, layers: [], captions: [],
    audio: [], camera: { x: W / 2, y: H / 2, zoom: 1, keys: {} }, ...overrides
  };
}
export function newLesson(title = 'Novo treinamento') {
  return { id: uid(), title, description: '', module: 'Módulo 1', scenes: [newScene()] };
}

const fieldRange = {
  x: [-3000, 4000], y: [-3000, 4000], w: [4, 3000], h: [4, 3000],
  scale: [0.05, 8], rotation: [-1080, 1080], opacity: [0, 1], effect: [0, 1],
  zoom: [0.2, 5], start: [0, 180], border: [0, 30], shadow: [0, 50], font: [8, 200]
};
const pin = (v, k, base) => numeric(v, base, ...fieldRange[k]);
const list = (value, limit) => Array.isArray(value) ? value.filter(x => x && typeof x === 'object').slice(0, limit) : [];
const choice = (value, values, fallback) => values.includes(value) ? value : fallback;
const sourcePattern = {
  image: /^data:image\/(?:png|jpeg|webp|gif|svg\+xml|avif);base64,/i,
  video: /^data:video\/(?:mp4|webm|quicktime|ogg);base64,/i,
  audio: /^data:audio\/(?:mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|wave|ogg|webm|flac|x-flac|aiff|x-aiff|m4a)(?:;[^,;]+)*;base64,/i
};
function media(value, type) {
  return typeof value === 'string' && value.length <= 40_000_000 &&
    sourcePattern[type].test(value) && /^[A-Za-z0-9+/=]*$/.test(value.slice(value.indexOf(',') + 1))
    ? value : '';
}
function inputKeys(input, names, duration, base) {
  return Object.fromEntries(names.map(key => {
    const byTime = new Map();
    for (const frame of list(input?.[key], 180)) {
      const t = numeric(frame.t, 0, 0, duration);
      byTime.set(t, { t, v: pin(frame.v, key, base[key]), ease: choice(frame.ease, Object.keys(EASES), 'smooth') });
    }
    return [key, [...byTime.values()].sort((a, b) => a.t - b.t)];
  }));
}
function unique(items) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) item.id = uid();
    ids.add(item.id);
  }
  return items;
}
function normalizedScene(raw) {
  const s = newScene();
  const duration = numeric(raw.duration, s.duration, 1, 180);
  for (const key of ['id', 'title', 'chapter', 'text', 'narration', 'reference']) s[key] = str(raw[key], s[key]);
  s.duration = duration;
  s.background = color(raw.background, s.background);
  s.backdrop = media(raw.backdrop, 'image');
  s.style = choice(raw.style, ['plain', 'grid', 'blueprint'], s.style);
  s.transition = choice(raw.transition, ['cut', 'fade', 'dip'], s.transition);
  s.fade = numeric(raw.fade, s.fade, 0, duration / 2);
  for (const key of CAMERA_KEYS) s.camera[key] = pin(raw.camera?.[key], key, s.camera[key]);
  s.camera.keys = inputKeys(raw.camera?.keys, CAMERA_KEYS, duration, s.camera);
  s.layers = unique(list(raw.layers, 200).filter(o => Object.hasOwn(ASSETS, o.type)).map(o => {
    const base = object(o.type);
    for (const key of ['id', 'name', 'group', 'text']) base[key] = str(o[key], base[key]);
    for (const key of ['x', 'y', 'w', 'h', 'scale', 'rotation', 'opacity', 'effect', 'border', 'shadow', 'font', 'start']) {
      base[key] = pin(o[key], key, base[key]);
    }
    base.start = Math.min(base.start, duration);
    base.end = o.end == null ? null : numeric(o.end, duration, base.start, duration);
    base.fill = color(o.fill, base.fill);
    base.stroke = color(o.stroke, base.stroke);
    for (const key of ['locked', 'flip', 'bold']) base[key] = o[key] === true;
    base.visible = o.visible !== false;
    base.align = choice(o.align, ['left', 'center', 'right'], base.align);
    base.symbol = choice(o.symbol, ['lamp', 'source', 'switch', 'terminal', 'energy'], base.symbol);
    if (o.type === 'image' || o.type === 'video') base.src = media(o.src, o.type);
    base.keys = inputKeys(o.keys, OBJECT_KEYS, duration, base);
    return base;
  }));
  s.captions = unique(list(raw.captions, 180).map(c => {
    const start = numeric(c.start, 0, 0, duration);
    return { id: str(c.id) || uid(), start, end: numeric(c.end, duration, start, duration), text: str(c.text) };
  }));
  s.audio = unique(list(raw.audio, 24).flatMap(a => {
    const src = media(a.src, 'audio');
    if (!src) return [];
    const start = numeric(a.start, 0, 0, duration);
    const length = numeric(a.length, duration, 0.01, 86400);
    const offset = numeric(a.offset, 0, 0, length);
    const rate = numeric(a.rate, 1, 0.25, 4);
    return [{ id: str(a.id) || uid(), name: str(a.name, 'Áudio'), track: a.track === 'audio' ? 'audio' : 'voice',
      src, start, length, offset, rate, volume: numeric(a.volume, 1, 0, 2),
      end: numeric(a.end, duration, start, duration) }];
  }));
  return s;
}
export function normalize(input) {
  if (input?.format !== FORMAT || input.version !== 3 || !Array.isArray(input.lessons) || !input.lessons.length) {
    throw Error('Escolha um projeto editável do Norma em Cena ou um JSON do editor anterior.');
  }
  return {
    format: FORMAT, version: 3, name: str(input.name, 'Norma em Cena', 140),
    legacyIds: Array.isArray(input.legacyIds) ? input.legacyIds.filter(x => typeof x === 'string') : [],
    lessons: unique(list(input.lessons, 40).filter(l => list(l.scenes, 100).length).map(l => ({
      id: str(l.id) || uid(), title: str(l.title, 'Treinamento'), description: str(l.description),
      module: str(l.module, 'Módulo 1'), category: str(l.category),
      status: str(l.status), legacyId: str(l.legacyId),
      scenes: unique(list(l.scenes, 100).map(normalizedScene))
    })))
  };
}

export function applyMotion(target, motion, start, end, ease = 'smooth', isCamera = false) {
  const newKeys = (key, from, to) => {
    const frames = (target.keys[key] || []).filter(f => f.t < start || f.t > end);
    target.keys[key] = [...frames, { t: start, v: from, ease }, { t: end, v: to, ease }].sort((a, b) => a.t - b.t);
  };
  if (isCamera) {
    if (motion === 'slide') newKeys('x', target.x, clamp(target.x + 150, -3000, 4000));
    else newKeys('zoom', target.zoom, motion === 'close' ? Math.max(0.2, target.zoom / 1.35) : Math.min(5, target.zoom * 1.35));
    return;
  }
  if (motion === 'reveal') newKeys('opacity', 0, target.opacity);
  if (motion === 'slide') newKeys('x', target.x - 120, target.x);
  if (motion === 'assemble') newKeys('effect', 1, 0);
  if (motion === 'open' || motion === 'flow') newKeys('effect', 0, 1);
  if (motion === 'pulse') {
    const frames = (target.keys.effect || []).filter(f => f.t < start || f.t > end);
    target.keys.effect = [...frames, { t: start, v: 0, ease }, { t: (start + end) / 2, v: 1, ease },
      { t: end, v: 0, ease }].sort((a, b) => a.t - b.t);
  }
  if (motion === 'close') newKeys('effect', 1, 0);
}

export function resizeScene(scene, duration) {
  scene.duration = duration;
  for (const target of [scene.camera, ...scene.layers]) {
    for (const frames of Object.values(target.keys)) {
      for (let i = frames.length - 1; i >= 0; i--) if (frames[i].t > duration) frames.splice(i, 1);
    }
  }
  for (const layer of scene.layers) {
    layer.start = Math.min(layer.start, duration);
    if (layer.end != null) layer.end = Math.min(layer.end, duration);
  }
  for (const clip of [...scene.captions, ...scene.audio]) {
    clip.start = Math.min(clip.start, duration);
    clip.end = Math.min(clip.end, duration);
  }
  scene.fade = Math.min(scene.fade, duration / 2);
}

export function copyItem(item, regenerateChildren = false) {
  const copy = structuredClone(item);
  copy.id = uid();
  if (regenerateChildren) for (const scene of copy.scenes ?? []) scene.id = uid();
  return copy;
}
