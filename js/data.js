// Reconstrução fiel dos cinco roteiros preservados em lib/model.ts.
// Não introduz exigências técnicas nem inferências sobre normas NFPA/ABNT.
export const makeId = () => (globalThis.crypto?.randomUUID?.() || `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`);
export const DEFAULT_PROJECT = {
  version: 1,
  name: 'Norma em Cena',
  accent: '#275CDD',
  captions: true,
  lessons: [
    {
      id: 'intro',
      title: 'Duas referências. Uma leitura mais clara.',
      description: 'Um método visual para organizar o estudo e preparar comparações entre normas.',
      category: 'Comece por aqui',
      status: 'authorial',
      scenes: [
        {id:'intro-1', kind:'intro', title:'Entenda antes de comparar.', body:'Comece pelo problema técnico. Depois, escolha as referências que tratam dele.', points:['Defina o assunto','Delimite a aplicação','Localize as fontes'], narration:'Antes de comparar duas normas, defina o problema técnico e o contexto da aplicação. Isso ajuda a selecionar referências que realmente tratam da mesma questão.', duration:15, motion:'explain'},
        {id:'intro-2', kind:'compare', title:'Compare o mesmo assunto.', body:'Organize a leitura em paralelo, com uma pergunta comum para as duas fontes.', points:['Objetivo','Escopo','Condições de aplicação'], leftText:'Qual é o objetivo?\nO que está dentro do escopo?\nEm que condições se aplica?',rightText:'Qual é o objetivo?\nO que está dentro do escopo?\nEm que condições se aplica?', narration:'Use uma pergunta comum para ler as duas fontes: qual é o objetivo, o que está dentro do escopo e em que condições o critério se aplica? A equivalência precisa ser verificada.', duration:17,motion:'point'},
        {id:'intro-3', kind:'steps', title:'Registre o caminho da informação.', body:'Uma comparação útil permite voltar ao ponto exato que sustentou a análise.', points:['Documento e edição','Item ou seção','Conclusão da análise'], narration:'Registre o documento, a edição e o item consultado. Depois, escreva a conclusão da análise. Essa organização permite conferir a origem de cada afirmação e revisar a comparação quando necessário.',duration:17,motion:'inspect'},
        {id:'intro-4',kind:'concept',title:'Separe referência e interpretação.',body:'Deixe claro o que vem da fonte, o que é análise e o que é um exemplo didático.',points:['Informação da fonte','Interpretação técnica','Exemplo autoral'],narration:'Diferencie a informação da fonte, a interpretação técnica e o exemplo criado para ensinar. Isso evita apresentar uma explicação didática como se fosse uma exigência normativa.',duration:16,motion:'explain'},
        {id:'intro-5',kind:'summary',title:'Transforme a leitura em entendimento.',body:'Uma boa aula conecta conceito, diferença e consequência prática.',points:['Explique com suas palavras','Mostre a diferença verificada','Indique onde consultar'],narration:'Explique o conceito com suas palavras, mostre as diferenças que foram verificadas e indique onde consultar. Esta aula apresenta apenas um método de estudo. As comparações técnicas dependem da consulta às normas e da revisão do conteúdo.',duration:20,motion:'wave'}
      ].map((scene, i) => ({
        eyebrow:'MÉTODO DE ESTUDO',leftLabel:'NFPA',rightLabel:'ABNT NBR',leftText:'',rightText:'',reference:'Conteúdo autoral · método de estudo', imageUrl:'',audioUrl:'',audioDuration:0,audioText:'',
        ...scene
      }))
    }
  ]
};
export function newScene(number = 1) {
  return { id: makeId(), title: 'Nova ideia, nova cena', eyebrow: 'CENA ' + String(number).padStart(2,'0'), body:'Explique uma ideia por vez e use o movimento para destacá-la.',points:['O que observar','Por que isso importa','Onde conferir'],narration:'Explique uma ideia por vez. Mostre o que observar, por que isso importa e onde conferir a informação.',duration:12,kind:'concept',leftLabel:'NFPA',rightLabel:'ABNT NBR',leftText:'Registre o critério e a referência consultada.',rightText:'Registre o critério e a referência consultada.',reference:'',imageUrl:'',audioUrl:'',audioDuration:0,audioText:'',motion:'explain'};
}
export function newLesson() {
  return {id:makeId(),title:'Nova aula — em elaboração',description:'Conteúdo não validado; adicionar referências antes de ensinar requisitos técnicos.',category:'Em desenvolvimento',status:'draft',scenes:[newScene(1)]};
}
export const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
export const timeLabel=n=>`${Math.floor(Math.max(0,n)/60)}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;
export const lessonDuration=l=>l.scenes.reduce((a,s)=>a+Number(s.duration||0),0);
export function locateScene(lesson, elapsed) {
  let start=0;
  for(let i=0;i<lesson.scenes.length;i++){
    const scene=lesson.scenes[i];
    if(elapsed<start+scene.duration || i===lesson.scenes.length-1) return {scene,index:i,local:clamp(elapsed-start,0,scene.duration),start};
    start+=scene.duration;
  }
  return {scene:lesson.scenes[0],index:0,local:0,start:0};
}
export const isReviewed=lesson=>lesson.status==='reviewed';
