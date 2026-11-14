import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedCues,motionAt,exampleCues} from '../js/choreography.js';

test('marcas são ordenadas por tempo e início da cena é preservado',()=>{
 const cues=normalizedCues({motion:'explain',duration:12,cues:[{time:8,motion:'point'},{time:3,motion:'walk'}]});
 assert.deepEqual(cues.map(x=>x.time),[0,3,8]);
 assert.equal(cues[0].motion,'explain');
});
test('movimento selecionado é determinístico ao buscar instante',()=>{
 const scene={motion:'idle',duration:12,cues:[{time:3,motion:'point'}]};
 assert.equal(motionAt(scene,0)[0].motion,'idle');
 assert.equal(motionAt(scene,4)[0].motion,'point');
 assert.deepEqual(motionAt(scene,4),motionAt(scene,4));
});
test('valores de tempo inválidos são descartados e ações são limitadas',()=>{
 const cues=normalizedCues({motion:'explain',duration:10,cues:[{time:'não-numérico',motion:'walk'},{time:30,motion:'inspect'}]});
 assert.deepEqual(cues.map(x=>x.time),[0,10]);
});
test('coreografia sugerida tem três marcas dentro da duração',()=>{
 const cues=exampleCues({duration:15,motion:'wave',kind:'summary'});
 assert.equal(cues.length,3);
 assert.ok(cues.every(x=>x.time>=0&&x.time<=15));
});
