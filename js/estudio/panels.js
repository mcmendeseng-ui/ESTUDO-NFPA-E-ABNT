import { ASSETS, EASES } from './model.js';
import { engine } from './engine.js';
import { escape as e } from './export.js';

export const field = (label, key, value, type = 'text', extra = '', wide = false) =>
  '<label class="' + (wide ? 'wide' : '') + '"><span class="control-label">' + e(label) +
  '</span><input name="' + key + '" type="' + type + '" value="' + e(value ?? '') + '" ' + extra + '></label>';
export const number = (label, key, value, min, max, step = '.01') =>
  field(label, key, value, 'number', 'min="' + min + '" max="' + max + '" step="' + step + '"');
export const select = (label, key, value, items, wide = false) =>
  '<label class="' + (wide ? 'wide' : '') + '"><span class="control-label">' + e(label) + '</span><select name="' + key + '">' +
  Object.entries(items).map(([v, text]) => '<option value="' + e(v) + '"' + (v === value ? ' selected' : '') + '>' +
    e(text) + '</option>').join('') + '</select></label>';
export const area = (label, key, value) =>
  '<label class="wide"><span class="control-label">' + e(label) + '</span><textarea name="' + key + '">' + e(value) + '</textarea></label>';
export const check = (label, key, value) =>
  '<label><input name="' + key + '" type="checkbox"' + (value ? ' checked' : '') + '> ' + e(label) + '</label>';
export const button = (label, action, value = '', more = '') =>
  '<button type="button" data-action="' + action + '" data-value="' + e(value) + '" ' + more + '>' + e(label) + '</button>';

export const keyLabels = { x: 'Posição X', y: 'Posição Y', scale: 'Escala', rotation: 'Rotação', opacity: 'Opacidade', effect: 'Estado / progresso', zoom: 'Zoom' };
const transformFields = (o, t, camera = false) => {
  const v = engine.state(o, t, camera);
  const n = key => Math.round(v[key] * 100) / 100;
  return number('Posição X', 'x', n('x'), -3000, 4000) + number('Posição Y', 'y', n('y'), -3000, 4000) +
    (camera ? number('Zoom', 'zoom', n('zoom'), .2, 5) :
      number('Escala', 'scale', n('scale'), .05, 8) + number('Rotação °', 'rotation', n('rotation'), -1080, 1080) +
      number('Opacidade', 'opacity', n('opacity'), 0, 1) + number('Estado / progresso', 'effect', n('effect'), 0, 1));
};

function scenePanel(s) {
  return '<h2>Dados da cena</h2><div class="form-grid" data-scope="scene">' +
    field('Título', 'title', s.title, 'text', 'maxlength="200"', true) +
    field('Capítulo', 'chapter', s.chapter, 'text', 'maxlength="100"', true) +
    number('Duração (s)', 'duration', s.duration, 1, 180, '.1') + field('Cor de fundo', 'background', s.background, 'color') +
    select('Fundo', 'style', s.style, { plain: 'Liso', grid: 'Grade sutil', blueprint: 'Grade técnica' }) +
    select('Transição', 'transition', s.transition, { cut: 'Corte', fade: 'Fundir', dip: 'Escurecer' }) +
    number('Transição (s)', 'fade', s.fade, 0, s.duration / 2) +
    '<div class="row wrap wide">' + button('Imagem de fundo', 'backdrop') + (s.backdrop ? button('Remover fundo', 'clear-backdrop') : '') + '</div>' +
    area('Texto didático', 'text', s.text) + area('Referências', 'reference', s.reference) + '</div>' +
    '<div class="property-actions">' + button('Duplicar cena', 'dup-scene') + button('Excluir cena', 'del-scene', '', 'class="danger"') + '</div>';
}
function sceneLayers(s, selected) {
  return '<h3>Camadas</h3><div aria-label="Camadas da cena">' + (s.layers.length ? [...s.layers].reverse().map(o =>
    '<div class="layer-row ' + (selected.has(o.id) ? 'selected' : '') + '">' +
    button((o.group ? '◈ ' : '') + o.name, 'select', o.id, 'title="' + e(o.name) + '"') +
    button(o.visible ? '◉' : '○', 'visible', o.id, 'title="Alternar visibilidade" aria-label="' + (o.visible ? 'Ocultar' : 'Exibir') + ' ' + e(o.name) + '"') +
    button(o.locked ? '▣' : '▢', 'lock', o.id, 'title="Alternar bloqueio" aria-label="' + (o.locked ? 'Desbloquear' : 'Bloquear') + ' ' + e(o.name) + '"') +
    '</div>').join('') : '<p>Use Inserir para adicionar um objeto à cena.</p>') + '</div>';
}
function objectPanel(s, o, selected, time, camera) {
  if (camera) return '<h2>Câmera</h2><div class="form-grid" data-scope="camera">' +
    transformFields(s.camera, time, true) + '</div><div class="property-actions">' +
    button('Centralizar', 'reset-camera') + button('Adicionar keyframe', 'key') + '</div>' + sceneLayers(s, selected);
  if (!o) return '<h2>Objetos</h2><p>Selecione na cena ou nas camadas. Shift permite selecionar vários.</p>' +
    '<div class="property-actions">' + button('Inserir', 'insert') + button('Colar', 'paste') + '</div>' + sceneLayers(s, selected);
  const many = selected.size > 1;
  let controls = '<h2>' + (many ? selected.size + ' objetos selecionados' : e(ASSETS[o.type][0])) + '</h2>';
  if (many) controls += '<div class="property-actions">' +
    button('Agrupar', 'group') + button('Desagrupar', 'ungroup') + button('Alinhar X', 'align-x') + button('Alinhar Y', 'align-y') +
    button('Distribuir X', 'distribute-x') + button('Distribuir Y', 'distribute-y') + '</div>';
  if (o.locked) controls += '<p>Camada bloqueada.</p>';
  controls += '<fieldset ' + (o.locked ? 'disabled' : '') + ' style="border:0;padding:0;margin:0;min-width:0"><div class="form-grid" data-scope="object">' +
    field('Nome da camada', 'name', o.name, 'text', 'maxlength="140"', true) +
    transformFields(o, time) +
    number('Largura', 'w', o.w, 4, 3000) + number('Altura', 'h', o.h, 4, 3000) +
    number('Início (s)', 'start', o.start, 0, s.duration) + number('Fim (s)', 'end', o.end ?? s.duration, o.start, s.duration) +
    field(o.type === 'text' ? 'Cor do texto' : 'Cor principal', 'fill', o.fill, 'color') + field('Cor da borda', 'stroke', o.stroke, 'color') +
    number('Borda', 'border', o.border, 0, 30) + number('Sombra', 'shadow', o.shadow, 0, 50) + check('Espelhar', 'flip', o.flip);
  if (o.type === 'text') controls += area('Texto', 'text', o.text) + number('Fonte (px)', 'font', o.font, 8, 200) +
    select('Alinhamento', 'align', o.align, { left: 'Esquerda', center: 'Centro', right: 'Direita' }) + check('Negrito', 'bold', o.bold);
  if (o.type === 'symbol') controls += select('Símbolo', 'symbol', o.symbol,
    { lamp: 'Lâmpada', source: 'Fonte CA', switch: 'Chave', terminal: 'Terminal', energy: 'Energia' }, true);
  if (o.type === 'image' || o.type === 'video') controls += '<div class="wide">' + button('Substituir mídia', 'replace-media') + '</div>';
  controls += '</div></fieldset><div class="property-actions">' + button('Copiar', 'copy') + button('Colar', 'paste') +
    button('Duplicar', 'dup-object') + button('Para frente', 'layer-up') + button('Para trás', 'layer-down') +
    (o.group ? button('Desagrupar', 'ungroup') : '') + button('Excluir', 'del-object', '', 'class="danger"') + '</div>';
  return controls + sceneLayers(s, selected);
}
function soundPanel(s, recording, focusClip) {
  return '<h2>Narração e áudio</h2><div class="form-grid" data-scope="scene">' +
    area('Roteiro de narração', 'narration', s.narration) + '</div><p>Associe o áudio de uma voz em português do Brasil ao roteiro.</p>' +
    '<div class="property-actions">' + button('Importar narração', 'audio-voice') + button('Importar faixa', 'audio-music') +
    button(recording ? 'Parar gravação' : 'Gravar microfone', 'record-voice', '', recording ? 'class="danger"' : '') + '</div>' +
    s.audio.map(a => '<details class="mini-card" ' + (focusClip === a.id ? 'open' : '') +
      '><summary>' + e(a.track === 'voice' ? 'Narração · ' : 'Áudio · ') + e(a.name) + '</summary>' +
      '<div class="form-grid" data-scope="audio" data-id="' + e(a.id) + '">' +
      field('Nome', 'name', a.name, 'text', 'maxlength="140"', true) +
      number('Início (s)', 'start', a.start, 0, s.duration) + number('Fim (s)', 'end', a.end, a.start, s.duration) +
      number('Corte inicial (s)', 'offset', a.offset, 0, a.length) + number('Velocidade', 'rate', a.rate, .25, 4) +
      number('Volume', 'volume', a.volume, 0, 2) + '</div><div class="property-actions">' +
      button('Excluir áudio', 'del-audio', a.id, 'class="danger"') + '</div></details>').join('') +
    '<h3>Legendas</h3><div class="property-actions">' + button('Adicionar legenda', 'add-caption') +
    button('Do roteiro', 'caption-from-script') + '</div>' +
    s.captions.map(c => '<details class="mini-card" ' + (focusClip === c.id ? 'open' : '') +
      '><summary>' + c.start.toFixed(1) + ' s · ' + e(c.text.slice(0, 45) || 'Legenda sem texto') +
      '</summary><div class="form-grid" data-scope="caption" data-id="' + e(c.id) + '">' +
      number('Início (s)', 'start', c.start, 0, s.duration) + number('Fim (s)', 'end', c.end, c.start, s.duration) +
      area('Texto', 'text', c.text) + '</div><div class="property-actions">' +
      button('Excluir legenda', 'del-caption', c.id, 'class="danger"') + '</div></details>').join('');
}
export function properties({ scene, object, selected, time, camera, tab, recording, focusClip }) {
  if (tab === 'scene') return scenePanel(scene);
  if (tab === 'sound') return soundPanel(scene, recording, focusClip);
  return objectPanel(scene, object, selected, time, camera);
}

export function timeline(scene, selected, camera, selectedObject, zoom, time) {
  const total = scene.duration;
  const px = value => Math.max(0, Math.min(100, value / total * 100)) + '%';
  const step = total > 80 ? 10 : total > 36 ? 5 : total > 18 ? 2 : 1;
  const lane = (content, klass = '') => '<div class="lane ' + klass + '">' + content + '</div>';
  const name = (label, act = '', val = '', active = false) =>
    act ? button(label, act, val, 'class="track-label' + (active ? ' is-selected' : '') + '" title="' + e(label) + '"') :
      '<div class="track-label" title="' + e(label) + '">' + e(label) + '</div>';
  const clip = (track, id, label, from, to) =>
    '<button type="button" class="clip" data-track="' + track + '" data-id="' + e(id) + '" title="' + e(label) +
    '" style="left:' + px(from) + ';width:' + px(Math.max(.1, to - from)) + '"><span>' + e(label) +
    '</span><span class="clip-handle" aria-hidden="true"></span></button>';
  const key = (track, id, prop, frame, idx) =>
    '<button type="button" class="keyframe" data-frame="' + idx + '" data-track="' + track + '" data-id="' + e(id) +
    '" data-prop="' + prop + '" style="left:' + px(frame.t) + '" title="' + e(keyLabels[prop]) + ' · ' + frame.t.toFixed(2) +
    ' s" aria-label="' + e(keyLabels[prop]) + ', ' + frame.t.toFixed(2) + ' segundos"></button>';
  let ruler = '';
  for (let t = 0; t < total; t += step) ruler += '<span style="left:' + px(t) + '">' + t + ' s</span>';
  const rows = [name('Trilhas'), lane(ruler, 'ruler')];
  const keys = (o, kind) => Object.entries(o.keys).flatMap(([k, frames]) => frames.map((f, i) => key(kind, o.id || '', k, f, i))).join('');
  rows.push(name('Câmera', 'camera', '', camera), lane(keys(scene.camera, 'camera')));
  if (camera) {
    for (const prop of Object.keys(scene.camera.keys)) {
      const frames = scene.camera.keys[prop];
      if (frames.length) rows.push(name(keyLabels[prop]), lane(frames.map((f, i) => key('camera', '', prop, f, i)).join('')));
    }
  }
  rows.push(name('Animações', 'motion'), lane(selectedObject ? keys(selectedObject, 'object') : ''));
  if (selectedObject && !camera) {
    for (const [prop, frames] of Object.entries(selectedObject.keys)) {
      if (frames.length) rows.push(name(keyLabels[prop]), lane(frames.map((f, i) => key('object', selectedObject.id, prop, f, i)).join('')));
    }
  }
  rows.push(name('Textos / legendas', 'show-sound'),
    lane(scene.captions.map(c => clip('caption', c.id, c.text || 'Legenda', c.start, c.end)).join('')));
  for (const [track, label] of [['voice', 'Narração'], ['audio', 'Áudio complementar']]) {
    rows.push(name(label, 'show-sound'), lane(scene.audio.filter(a => a.track === track)
      .map(a => clip(track, a.id, a.name, a.start, engine.clipEnd(a))).join('')));
  }
  rows.push(name('Transição', 'show-scene'), lane(scene.transition === 'cut' ? '' :
    clip('transition', scene.id, scene.transition === 'fade' ? 'Fundir' : 'Escurecer', 0, scene.fade)));
  for (const o of [...scene.layers].reverse()) {
    rows.push(name((o.type === 'text' ? 'T · ' : '') + o.name, 'select', o.id, selected.has(o.id)),
      lane(clip('object', o.id, o.name, o.start, o.end ?? total)));
  }
  return '<div class="tracks" style="--duration-width:' + Math.max(640, total * zoom + 153) +
    'px;--tick:' + px(step) + ';--cursor:calc(var(--label-width) + (100% - var(--label-width)) * ' + time / total +
    ')">' + rows.join('') + '<div class="playhead"></div></div>';
}

export function keyForm(camera, key, time, value, ease, duration) {
  const names = camera ? ['x', 'y', 'zoom'] : ['x', 'y', 'scale', 'rotation', 'opacity', 'effect'];
  return select('Propriedade', 'prop', key, Object.fromEntries(names.map(x => [x, keyLabels[x]])), true) +
    number('Tempo na cena (s)', 'time', time, 0, duration) + field('Valor', 'value', value, 'number', 'step="any" required') +
    select('Curva de chegada', 'ease', ease, EASES, true);
}
