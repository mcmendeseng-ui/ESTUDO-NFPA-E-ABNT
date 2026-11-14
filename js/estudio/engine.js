// Self-contained so the exported HTML can run the same renderer offline.
export function createEngine() {
  const W = 1280, H = 720;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const eases = { linear: t => t, smooth: t => t * t * (3 - 2 * t),
    in: t => t * t, out: t => 1 - (1 - t) ** 2, hold: () => 0 };
  const ink = '#102754', blue = '#316de9', steel = '#d8e4f1', mute = '#69819e';

  function valueAt(target, key, time) {
    const frames = target.keys?.[key];
    if (!frames?.length || time < frames[0].t) return target[key];
    const next = frames.findIndex(k => k.t > time);
    if (next < 0) return frames.at(-1).v;
    const a = frames[next - 1], b = frames[next];
    const f = (eases[b.ease] || eases.linear)((time - a.t) / (b.t - a.t));
    return a.v + (b.v - a.v) * f;
  }
  function state(target, time, camera = false) {
    return Object.assign({}, target, Object.fromEntries(
      (camera ? ['x', 'y', 'zoom'] : ['x', 'y', 'scale', 'rotation', 'opacity', 'effect'])
        .map(k => [k, valueAt(target, k, time)])
    ));
  }
  function position(lesson, absolute) {
    let start = 0;
    for (const [index, scene] of lesson.scenes.entries()) {
      const end = start + scene.duration;
      if (absolute < end || index === lesson.scenes.length - 1) {
        return { scene, index, start, time: clamp(absolute - start, 0, scene.duration) };
      }
      start = end;
    }
  }
  const duration = lesson => lesson.scenes.reduce((sum, s) => sum + s.duration, 0);
  const visibleAt = (o, t) => o.visible && t >= o.start && t <= (o.end ?? Infinity);
  const clipEnd = clip => Math.min(clip.end, clip.start + (clip.length - clip.offset) / clip.rate);

  function path(ctx, points, color, width = 1, fill = false) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (fill) { ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  }
  function round(ctx, x, y, w, h, r, color, border = '', lineWidth = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function dot(ctx, x, y, r, color, border = '') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function label(ctx, value, x, y, size = 13, color = ink, bold = true) {
    ctx.font = (bold ? '700 ' : '400 ') + size + 'px system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = color; ctx.fillText(value, x, y);
  }
  function wrapped(ctx, text, width) {
    const lines = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? line + ' ' + word : word;
        if (line && ctx.measureText(next).width > width) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  }
  function gradient(ctx, x1, y1, x2, y2, stops) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [p, color] of stops) g.addColorStop(p, color);
    return g;
  }
  function terminal(ctx, x, y, size = 10, fill = '#ccb58d') {
    round(ctx, x - size / 2, y - size / 2, size, size, 2, fill, '#7d745d');
    path(ctx, [[x - size / 4, y], [x + size / 4, y]], '#665e50', 1.25);
  }
  function module(ctx, x, y, w, h, n, on = true) {
    round(ctx, x + 4, y + 3, w, h, 5, '#8da3bd');
    round(ctx, x, y, w, h, 5, gradient(ctx, x, y, x + w, y + h,
      [[0, '#ffffff'], [1, '#bfcde0']]), '#96a9c0');
    terminal(ctx, x + w / 2, y + 13, 12);
    terminal(ctx, x + w / 2, y + h - 12, 12);
    round(ctx, x + 5, y + h * 0.38, w - 10, h * 0.27, 3, '#425c7d');
    round(ctx, x + 8, y + h * (on ? 0.39 : 0.51), w - 16, h * 0.10, 2, on ? '#316de9' : '#b4c5d6');
    label(ctx, n, x + 7, y + h * 0.31, 9, '#647d9b');
  }
  function rail(ctx, x, y, count, step = 18) {
    round(ctx, x - 9, y - 9, step * count + 2, 18, 4, '#9e8058', '#6e5a40');
    for (let i = 0; i < count; i++) terminal(ctx, x + i * step, y);
  }
  function panel(ctx, effect, accent) {
    const body = gradient(ctx, 75, 27, 320, 405, [[0, '#f8fbff'], [0.55, '#d6e3ef'], [1, '#a4b9d1']]);
    path(ctx, [[85, 61], [109, 35], [333, 35], [310, 61]], '#d2e1f0', 1, true);
    path(ctx, [[310, 61], [333, 35], [333, 384], [310, 409]], '#9db1c8', 1, true);
    round(ctx, 76, 58, 239, 353, 8, body, '#7d98b6', 2);
    ctx.shadowBlur = 0;
    round(ctx, 91, 73, 210, 322, 5, '#516b8d', '#9ab0c8');
    round(ctx, 101, 83, 190, 302, 4, '#b8cce1');
    for (const x of [112, 277]) {
      path(ctx, [[x, 97], [x, 367]], '#859fbd', 3);
      for (const y of [94, 375]) terminal(ctx, x, y, 8, '#e2eaf3');
    }
    for (const y of [160, 255]) {
      round(ctx, 116, y, 158, 17, 2, '#7188a4', '#4c698c');
      path(ctx, [[118, y + 4], [270, y + 4]], '#d9e4f1', 2);
    }
    rail(ctx, 138, 109, 7);
    rail(ctx, 138, 351, 7);
    for (let i = 0; i < 4; i++) {
      const x = 127 + i * 36;
      path(ctx, [[139 + i * 30, 117], [139 + i * 30, 124], [x + 15, 134]], i % 2 ? '#876a48' : '#396cc6', 3);
      module(ctx, x, 135, 29, 73, 'Q' + (i + 1));
      module(ctx, x, 228, 29, 76, 'Q' + (i + 5), i < 3);
      path(ctx, [[x + 15, 303], [x + 15, 328], [139 + i * 30, 342]], i % 2 ? '#876a48' : '#396cc6', 3);
    }
    const width = 238 * Math.cos(effect * 2.16);
    ctx.save();
    ctx.translate(77, 58);
    ctx.transform(width / 238 || 0.001, effect * 0.072, 0, 1, 0, 0);
    round(ctx, 0, 0, 238, 353, 7, body, '#829dbb', 2);
    round(ctx, 11, 12, 217, 326, 5, '', '#f0f6fc', 2);
    round(ctx, 26, 32, 73, 24, 4, '#eff5fb', '#a9bdd4');
    label(ctx, 'QD  /  01', 33, 45, 10, '#526e92');
    round(ctx, 207, 155, 10, 50, 4, '#3f5576');
    round(ctx, 209, 159, 5, 25, 2, accent);
    ctx.restore();
    for (const y of [111, 343]) round(ctx, 72, y, 12, 24, 3, '#718ba9', '#cfdfed');
  }
  function breaker(ctx, effect, accent) {
    const separation = effect * 68;
    const side = gradient(ctx, 120, 35, 285, 365, [[0, '#fafcff'], [1, '#b4c9e1']]);
    path(ctx, [[120, 84], [154, 58], [282, 58], [254, 84]], '#e0ebf7', 1, true);
    path(ctx, [[254, 84], [282, 58], [282, 341], [254, 367]], '#88a4c6', 1, true);
    round(ctx, 120, 84, 136, 283, 14, side, '#8ba9c8', 2);
    ctx.shadowBlur = 0;
    round(ctx, 137, 103, 106, 243, 9, '#365579', '#dbe9fa', 2);
    terminal(ctx, 188, 119, 19);
    terminal(ctx, 188, 332, 19);
    path(ctx, [[188, 130], [188, 186], [160, 197]], '#d9ad69', 9);
    path(ctx, [[188, 318], [188, 266], [210, 240]], '#d9ad69', 9);
    const contact = [211 - effect * 30, 239 - effect * 20];
    path(ctx, [[160, 197], contact], '#e8c784', 8);
    dot(ctx, 160, 197, 6, '#f7d7a2');
    dot(ctx, 210, 240, 6, '#f7d7a2');
    path(ctx, [[162, 198], [175, 160], [215, 159]], '#c8d6e4', 3);
    for (let i = 0; i < 6; i++) round(ctx, 209, 186 + i * 6, 24, 2.5, 1, '#e4edf4');
    ctx.save(); ctx.translate(-separation, -effect * 22);
    round(ctx, 113, 86, 142, 281, 12, side, '#809fc2', 2);
    round(ctx, 137, 117, 94, 37, 5, '#edf4fc', '#becfe1');
    label(ctx, 'DISJUNTOR', 143, 136, 10, '#48678a');
    round(ctx, 147, 195, 73, 62, 8, '#243e60');
    round(ctx, 152, 199 + effect * 27, 63, 25, 5, accent);
    path(ctx, [[157, 205 + effect * 27], [209, 205 + effect * 27]], '#72abff', 2);
    for (const y of [102, 348]) terminal(ctx, 185, y, 13);
    ctx.restore();
    if (effect > 0.72) {
      ctx.globalAlpha *= (effect - .72) / .28;
      path(ctx, [[210, 238], [289, 268], [345, 268]], '#557394', 1.3);
      label(ctx, 'CONTATOS', 284, 287, 10, '#48678a');
    }
  }
  function circuit(ctx, effect, accent, time) {
    const active = effect >= 0.96, lane = active ? accent : '#7e99b8';
    round(ctx, 15, 14, 570, 315, 18, '#fbfdff', '#bad0eb', 2);
    ctx.shadowBlur = 0;
    path(ctx, [[92, 154], [92, 83], [218, 83]], lane, 4);
    path(ctx, [[280, 83], [493, 83], [493, 155]], lane, 4);
    path(ctx, [[493, 207], [493, 245], [92, 245], [92, 205]], lane, 4);
    path(ctx, [[218, 83], [280, active ? 83 : 83 - (1 - effect) * 28]], lane, 5);
    dot(ctx, 218, 83, 6, '#f6fbff', lane);
    dot(ctx, 280, 83, 6, '#f6fbff', lane);
    dot(ctx, 92, 180, 26, '#f3f8ff', lane);
    ctx.beginPath(); ctx.moveTo(78, 180);
    ctx.bezierCurveTo(83, 165, 89, 165, 92, 180);
    ctx.bezierCurveTo(96, 195, 102, 195, 107, 180);
    ctx.strokeStyle = lane; ctx.lineWidth = 2; ctx.stroke();
    dot(ctx, 493, 181, 29, active ? '#ffe59c' : '#f2f6fc', lane);
    path(ctx, [[477, 165], [509, 197]], lane, 2);
    path(ctx, [[509, 165], [477, 197]], lane, 2);
    label(ctx, 'FONTE', 70, 282, 12, mute);
    label(ctx, 'CHAVE', 224, 125, 12, mute);
    label(ctx, 'CARGA', 472, 282, 12, mute);
    round(ctx, 199, 270, 195, 30, 15, active ? '#e3efff' : '#eef3f8');
    label(ctx, active ? 'CAMINHO FECHADO' : 'CAMINHO ABERTO', 219, 286, 12, active ? accent : ink);
    if (active) {
      for (const [x, y, len, vertical] of [[92, 83, 399, false], [92, 245, 399, false], [493, 89, 60, true], [92, 94, 55, true]]) {
        const steps = Math.max(2, Math.round(len / 41));
        for (let i = 0; i < steps; i++) {
          const p = ((time * 0.31 + i / steps) % 1) * len;
          dot(ctx, x + (vertical ? 0 : p), y + (vertical ? p : 0), 3, '#a8d8ff');
        }
      }
    }
  }
  function chart(ctx, effect, accent) {
    round(ctx, 7, 15, 467, 300, 14, '#fcfdff', '#becfe4', 2);
    ctx.shadowBlur = 0;
    const left = 55, right = 444, top = 66, bottom = 251;
    for (let i = 0; i < 6; i++) path(ctx, [[left, top + i * 37], [right, top + i * 37]], '#dce6f3');
    for (let i = 0; i <= 8; i++) path(ctx, [[left + i * 48.6, top], [left + i * 48.6, bottom]], '#e5edf6');
    path(ctx, [[left, top - 14], [left, bottom], [right, bottom]], '#53749a', 1.5);
    const points = [];
    for (let i = 0; i <= Math.max(1, effect * 100); i++) {
      const t = i / 100;
      const v = t < 0.24 ? 0.23 : 0.23 + 0.51 * (1 - Math.exp(-(t - 0.24) * 13)) + Math.sin((t - 0.24) * 25) * 0.17 * Math.exp(-(t - 0.24) * 5);
      points.push([left + t * (right - left), bottom - v * (bottom - top)]);
    }
    path(ctx, points, accent, 3.5);
    dot(ctx, ...points.at(-1), 5, accent);
    label(ctx, 'GRANDEZA NORMALIZADA', left, 40, 11, mute);
    label(ctx, 'TEMPO', 385, 279, 11, mute);
  }

  function technical(ctx, o, t) {
    const size = { panel: [400, 450], breaker: [370, 425], bus: [300, 115], circuit: [600, 345], chart: [480, 330] }[o.type];
    ctx.translate(-o.w / 2, -o.h / 2);
    ctx.scale(o.w / size[0], o.h / size[1]);
    if (o.type === 'panel') panel(ctx, o.effect, o.fill);
    if (o.type === 'breaker') breaker(ctx, o.effect, o.fill);
    if (o.type === 'circuit') circuit(ctx, o.effect, o.fill, t);
    if (o.type === 'chart') chart(ctx, o.effect, o.fill);
    if (o.type === 'bus') {
      round(ctx, 12, 38, 276, 40, 7, o.fill, o.stroke, 2);
      rail(ctx, 36, 58, 12, 20);
    }
  }
  function drawMedia(ctx, node, x, y, w, h, cover = false) {
    const sw = node.videoWidth || node.naturalWidth, sh = node.videoHeight || node.naturalHeight;
    if (!sw || !sh || (node.tagName === 'VIDEO' && node.readyState < 2)) return;
    const ratio = (cover ? Math.max : Math.min)(w / sw, h / sh);
    const dw = sw * ratio, dh = sh * ratio;
    ctx.drawImage(node, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function symbol(ctx, o) {
    const radius = Math.min(o.w, o.h) / 2;
    ctx.scale(radius / 50, radius / 50);
    const fill = o.fill;
    if (o.symbol === 'energy') {
      path(ctx, [[6,-47],[-29,9],[-5,9],[-13,47],[29,-9],[5,-9]], fill, 1, true);
      return;
    }
    if (o.symbol === 'switch') {
      path(ctx, [[-48,0],[-29,0]], fill, 4);
      path(ctx, [[29,0],[48,0]], fill, 4);
      path(ctx, [[-29,0],[29,-(1-o.effect)*30]], fill, 5);
      dot(ctx,-29,0,5,'#f8fbff',fill); dot(ctx,29,0,5,'#f8fbff',fill);
      return;
    }
    dot(ctx,0,0,37,o.symbol === 'lamp' && o.effect > .5 ? '#ffdf84' : '#f8fbff',fill);
    if (o.symbol === 'lamp') {
      path(ctx,[[-22,-22],[22,22]],fill,3);
      path(ctx,[[-22,22],[22,-22]],fill,3);
    }
    if (o.symbol === 'terminal') dot(ctx,0,0,12,fill);
    if (o.symbol === 'source') {
      ctx.beginPath(); ctx.moveTo(-23,0);
      ctx.bezierCurveTo(-17,-22,-7,-22,0,0); ctx.bezierCurveTo(7,22,17,22,23,0);
      ctx.strokeStyle=fill; ctx.lineWidth=3; ctx.stroke();
    }
  }
  function drawLayer(ctx, o, t, media) {
    const x = -o.w / 2, y = -o.h / 2;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rotation * Math.PI / 180);
    ctx.scale(o.scale * (o.flip ? -1 : 1), o.scale);
    ctx.globalAlpha *= o.opacity;
    const highlighted = !['panel', 'breaker', 'circuit', 'chart', 'symbol'].includes(o.type) && o.effect > 0;
    ctx.shadowColor = highlighted ? o.fill + '95' : '#12294a45';
    ctx.shadowBlur = o.shadow + (highlighted ? o.effect * 32 : 0);
    ctx.shadowOffsetY = o.shadow * .32;
    if (highlighted) {
      ctx.save();
      ctx.globalAlpha *= o.effect * .85;
      round(ctx, x - 6, y - 6, o.w + 12, o.h + 12, 6, '', o.fill, 2);
      ctx.restore();
    }
    if (o.type === 'text') {
      ctx.font = (o.bold ? '700 ' : '400 ') + o.font + 'px system-ui, sans-serif';
      ctx.fillStyle = o.fill; ctx.textAlign = o.align; ctx.textBaseline = 'top';
      const lines = wrapped(ctx, o.text, o.w);
      const xOffset = o.align === 'center' ? 0 : o.align === 'right' ? -x : x;
      for (const [i, line] of lines.entries()) ctx.fillText(line, xOffset, y + i * o.font * 1.21, o.w);
    } else if (o.type === 'rect') {
      round(ctx, x, y, o.w, o.h, Math.min(9, o.w / 3, o.h / 3), o.fill, o.border ? o.stroke : '', o.border);
    } else if (o.type === 'ellipse') {
      ctx.beginPath(); ctx.ellipse(0, 0, -x, -y, 0, 0, Math.PI * 2);
      ctx.fillStyle = o.fill; ctx.fill();
      if (o.border) { ctx.lineWidth = o.border; ctx.strokeStyle = o.stroke; ctx.stroke(); }
    } else if (o.type === 'line' || o.type === 'arrow') {
      path(ctx, [[x, 0], [-x, 0]], o.fill, o.border || Math.min(o.h, 8));
      if (o.type === 'arrow') path(ctx, [[-x - o.h, y], [-x, 0], [-x - o.h, -y]], o.fill, 1, true);
    } else if (o.type === 'image' || o.type === 'video') {
      const node = media.get(o.type === 'video' ? o.id : o.src);
      if (node) drawMedia(ctx, node, x, y, o.w, o.h);
      else round(ctx, x, y, o.w, o.h, 8, '#dce7f2', '#9bb5d1', 2);
      if (o.border) round(ctx, x, y, o.w, o.h, 0, '', o.stroke, o.border);
    } else if (o.type === 'symbol') symbol(ctx, o);
    else technical(ctx, o, t);
    ctx.restore();
  }

  function activeCaption(scene, t) {
    return scene.captions.find(c => c.start <= t && c.end > t)?.text || '';
  }
  function paint(ctx, scene, t, media = new Map(), options = {}) {
    const { canvas } = ctx;
    ctx.save();
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = scene.background; ctx.fillRect(0, 0, W, H);
    const backdrop = media.get(scene.backdrop);
    if (backdrop) drawMedia(ctx, backdrop, 0, 0, W, H, true);
    if (scene.style !== 'plain') {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.strokeStyle = scene.style === 'blueprint' ? '#79a7da55' : '#6c91c51a'; ctx.stroke();
    }
    const camera = state(scene.camera, t, true);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
    for (const layer of scene.layers) if (visibleAt(layer, t)) drawLayer(ctx, state(layer, t), t, media);
    ctx.restore();
    if (options.transition !== false && scene.transition !== 'cut' && scene.fade && t < scene.fade) {
      ctx.globalAlpha = 1 - eases.smooth(t / scene.fade);
      ctx.fillStyle = scene.transition === 'dip' ? '#112440' : scene.background;
      ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
    const caption = options.captions !== false ? activeCaption(scene, t) : '';
    if (caption) {
      ctx.font = '600 23px system-ui, sans-serif';
      const lines = wrapped(ctx, caption, 1030);
      const height = lines.length * 29 + 14;
      const width = Math.min(1090, Math.max(...lines.map(l => ctx.measureText(l).width)) + 42);
      round(ctx, (W - width) / 2, H - 19 - height, width, height, 9, '#10213ded');
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const [i, line] of lines.entries()) ctx.fillText(line, W / 2, H - 12 - height + i * 29, 1030);
    }
    ctx.restore();
  }
  function loadImage(src, media, pending, ready) {
    if (!src || media.has(src) || pending.has(src)) return;
    const img = new Image();
    pending.add(src);
    img.onload = () => { media.set(src, img); pending.delete(src); ready(); };
    img.onerror = () => { pending.delete(src); media.set(src, null); ready(); };
    img.src = src;
  }
  function prepareScene(scene, media, pending = new Set(), ready = () => {}) {
    loadImage(scene.backdrop, media, pending, ready);
    for (const o of scene.layers) {
      if (o.type === 'image') loadImage(o.src, media, pending, ready);
      if (o.type !== 'video' || !o.src || media.get(o.id)?.getAttribute('src') === o.src) continue;
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.addEventListener('loadeddata', ready, { once: true });
      video.addEventListener('seeked', ready);
      media.set(o.id, video);
      video.src = o.src;
    }
  }
  function syncVideos(scene, time, playing, media) {
    const active = new Set();
    for (const o of scene.layers) {
      const v = media.get(o.id);
      if (!v || o.type !== 'video' || !visibleAt(o, time)) continue;
      active.add(v);
      if (!Number.isFinite(v.duration)) continue;
      const target = clamp(time - o.start, 0, Math.max(0, v.duration - .04));
      if (Math.abs(v.currentTime - target) > (playing ? .24 : .035) && !v.seeking) v.currentTime = target;
      if (playing && time - o.start < v.duration && v.paused) v.play().catch(() => {});
      else if ((!playing || time - o.start >= v.duration) && !v.paused) v.pause();
    }
    for (const v of media.values()) if (v?.tagName === 'VIDEO' && !active.has(v) && !v.paused) v.pause();
  }
  function audioSources(lesson) {
    let start = 0;
    const all = [];
    for (const scene of lesson.scenes) {
      for (const a of scene.audio) all.push({ ...a, start: start + a.start, end: start + clipEnd(a) });
      start += scene.duration;
    }
    return all;
  }
  function createAudio() {
    let context, master, playing = [];
    const cache = new Map();
    async function resume() {
      if (!context) {
        context = new AudioContext();
        master = context.createGain(); master.connect(context.destination);
      }
      await context.resume();
      return context;
    }
    async function schedule(clips, time, out = master, lead = 0.06, valid = () => true) {
      const ctx = await resume();
      const decoded = await Promise.all(clips.map(async a => {
        if (!cache.has(a.src)) cache.set(a.src,
          fetch(a.src).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)));
        return cache.get(a.src);
      }));
      if (!valid()) return null;
      stop();
      const when = ctx.currentTime + lead;
      for (const [i, a] of clips.entries()) {
        const start = Math.max(time, a.start);
        const offset = a.offset + (start - a.start) * a.rate;
        const length = Math.min((a.end - start) * a.rate, decoded[i].duration - offset);
        if (length <= 0) continue;
        const input = ctx.createBufferSource(), gain = ctx.createGain();
        input.buffer = decoded[i]; input.playbackRate.value = a.rate; gain.gain.value = a.volume;
        input.connect(gain); gain.connect(out || master);
        input.start(when + start - time, offset, length);
        playing.push(input);
      }
      return { when, clock: () => ctx.currentTime };
    }
    function stop() {
      for (const input of playing) { try { input.stop(); } catch {} input.disconnect(); }
      playing = [];
    }
    return { resume, schedule, stop, close: () => { stop(); return context?.close(); } };
  }
  return { duration, position, valueAt, state, paint, visibleAt, prepareScene,
    syncVideos, activeCaption, clipEnd, audioSources, createAudio };
}

export const engine = createEngine();
