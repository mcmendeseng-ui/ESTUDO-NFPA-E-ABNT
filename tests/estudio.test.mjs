import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROJECT } from '../js/data.js';
import { engine } from '../js/estudio/engine.js';
import { FORMAT, normalize, newScene, object, applyMotion, resizeScene } from '../js/estudio/model.js';
import { demo, importLegacy } from '../js/estudio/templates.js';
import { htmlFor, makeSRT } from '../js/estudio/export.js';

const project = scenes => ({ format: FORMAT, version: 3, name: 'Projeto de teste',
  lessons: [{ id: 'aula', title: 'Aula', scenes }] });

test('preserva as cinco cenas, roteiros, referências e durações da aula recuperada', () => {
  const legacy = normalize(importLegacy(DEFAULT_PROJECT));
  assert.equal(legacy.lessons.length, DEFAULT_PROJECT.lessons.length);
  for (const [i, lesson] of DEFAULT_PROJECT.lessons.entries()) {
    assert.equal(legacy.lessons[i].scenes.length, lesson.scenes.length);
    for (const [j, old] of lesson.scenes.entries()) {
      const scene = legacy.lessons[i].scenes[j];
      for (const field of ['id', 'title', 'duration', 'narration', 'reference']) assert.equal(scene[field], old[field]);
    }
  }
});

test('reimporta os mesmos dados de mídia, câmera, keyframes, camadas e legenda', () => {
  const target = object('image', {
    src: 'data:image/svg+xml;base64,PHN2Zy8+', group: 'g', flip: true, locked: true,
    x: 444, keys: { rotation: [{ t: 1, v: 0, ease: 'linear' }, { t: 2, v: 84, ease: 'in' }] }
  });
  const scene = newScene({
    layers: [target], duration: 7, backdrop: target.src,
    captions: [{ id: 'cc', text: 'Legenda', start: 2, end: 4 }],
    audio: [{ id: 'aud', track: 'voice', name: 'Voz', src: 'data:audio/wav;base64,QQ==',
      length: 6, offset: .5, start: 1, end: 2, rate: .8, volume: .4 }]
  });
  applyMotion(scene.camera, 'open', 0, 3, 'out', true);
  const saved = normalize(project([scene]));
  const restored = normalize(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(saved, restored);
  assert.equal(restored.lessons[0].scenes[0].layers[0].src, target.src);
  assert.equal(restored.lessons[0].scenes[0].layers[0].keys.rotation.at(-1).v, 84);
  assert.equal(restored.lessons[0].scenes[0].camera.keys.zoom.at(-1).v, 1.35);
});

test('normaliza caminhos de mídia importados e só preserva arquivos incorporados', () => {
  const s = newScene({ backdrop: 'https://invalid.example/bg.png',
    layers: [object('image', { src: 'javascript:alert(1)' }), object('video', { src: 'data:video/mp4;base64,QQ==' })] });
  const [result] = normalize(project([s])).lessons[0].scenes;
  assert.equal(result.backdrop, '');
  assert.equal(result.layers[0].src, '');
  assert.equal(result.layers[1].src, 'data:video/mp4;base64,QQ==');
});

test('avalia o estado do equipamento, a câmera e curvas na busca de qualquer instante', () => {
  const l = demo();
  const first = l.scenes[0].layers.find(o => o.type === 'panel');
  for (const [t, value] of [[0, 0], [1, 0], [5, 1], [9, 1], [0, 0]]) assert.equal(engine.valueAt(first, 'effect', t), value);
  assert.ok(Math.abs(engine.valueAt(first, 'effect', 3.175) - .5) < 1e-9);
  assert.equal(engine.duration(l), 38);
  assert.equal(engine.position(l, 10).index, 1);
  assert.equal(engine.position(l, 21.5).time, 1.5);
  assert.ok(engine.valueAt(l.scenes[1].camera, 'zoom', 4) > 1);
});

test('corte de cena limita clipes e remove keyframes depois da duração', () => {
  const s = newScene({ layers: [object('panel', { start: 3, end: 7 })],
    captions: [{ id: 'cc', start: 1, end: 7, text: 'CC' }] });
  applyMotion(s.layers[0], 'open', 1, 5);
  resizeScene(s, 4);
  assert.deepEqual(s.layers[0].keys.effect.map(k => k.t), [1]);
  assert.equal(s.layers[0].end, 4);
  assert.equal(s.captions[0].end, 4);
});

test('legendas SRT e narração têm deslocamento pela duração acumulada da cena', () => {
  const a = newScene({ duration: 10 });
  const b = newScene({ duration: 12, captions: [{ id: 'cc', start: 1.125, end: 3.25, text: 'Exemplo' }],
    audio: [{ id: 'aud', start: 1.125, end: 5, length: 4, offset: 1, rate: 2, volume: .7 }] });
  const l = { scenes: [a, b] };
  assert.equal(makeSRT(l), '1\n00:00:11,125 --> 00:00:13,250\nExemplo\n');
  const [clip] = engine.audioSources(l);
  assert.equal(clip.start, 11.125);
  assert.equal(clip.end, 12.625);
});

test('HTML autônomo inclui o renderer e escapa textos dentro de scripts', () => {
  const l = demo();
  l.title = '</script><script>não executar</script>';
  const html = htmlFor(l);
  assert.ok(html.includes('function createEngine()'));
  assert.ok(html.includes('const lesson = JSON.parse'));
  assert.ok(!html.includes('</script><script>não executar'));
  assert.ok(html.includes('\\u003c/script\\u003e'));
  assert.ok(!html.includes('<script src='));
});
