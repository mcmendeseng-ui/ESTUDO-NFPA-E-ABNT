import { FORMAT, newScene, object, uid, applyMotion } from './model.js';
import { validateProject as readLegacy } from '../storage.js';

const heading = (text, x, y, w, font, fill, bold = false) =>
  object('text', { name: text, text, x, y, w, h: font * 2.65, font, fill, bold });
const baseTitle = (tag, title, sub) => [
  heading(tag, 370, 78, 590, 16, '#2459c9', true),
  heading(title, 368, 178, 590, 54, '#102754', true),
  heading(sub, 367, 329, 585, 26, '#3e5b7e')
];
const frames = (...points) => points.map(([t, v, ease = 'smooth']) => ({ t, v, ease }));
const general = 'Modelo didático autoral. Componentes e conexões são simbólicos.';

export function template(kind) {
  if (kind === 'blank') return newScene();
  if (kind === 'panel') {
    return newScene({
      title: 'Componentes de um quadro', chapter: 'O quadro', duration: 10,
      layers: [
        object('rect', { name: 'Plano de fundo', x: 953, y: 345, w: 480, h: 580, fill: '#deebfc', locked: true }),
        ...baseTitle('01   /   VISTA DO EQUIPAMENTO', 'Por dentro de um quadro elétrico', 'A porta protege o conjunto. No interior, dispositivos e caminhos de distribuição têm funções distintas.'),
        heading('Invólucro  ·  Disjuntores  ·  Barramentos', 370, 520, 590, 22, '#2459c9', true),
        object('panel', { x: 955, y: 346, w: 430, h: 475, shadow: 24,
          keys: { effect: frames([0, 0], [1.35, 0], [5, 1]) } }),
        heading('VISTA ILUSTRATIVA', 1030, 647, 290, 14, '#557294', true)
      ],
      narration: 'O quadro reúne componentes com funções diferentes. A porta faz parte do invólucro. No interior, os disjuntores e os barramentos compõem o conjunto representado nesta vista didática.',
      text: 'Observe a porta, os dispositivos instalados no trilho e os barramentos. Cada parte cumpre uma função diferente.', reference: general,
      captions: [
        { id: uid(), start: 0.1, end: 3.9, text: 'A porta faz parte do invólucro do quadro.' },
        { id: uid(), start: 4, end: 9.6, text: 'Disjuntores e barramentos têm funções diferentes no conjunto.' }
      ]
    });
  }
  if (kind === 'breaker') {
    return newScene({
      title: 'Partes de um disjuntor', chapter: 'O dispositivo', duration: 10,
      transition: 'fade', background: '#eaf1fa',
      layers: [
        ...baseTitle('02   /   VISTA EXPLODIDA', 'Um circuito pode ser interrompido', 'Os contatos conduzem quando fechados. A separação dos contatos interrompe o caminho no modelo.'),
        heading('A geometria real depende do equipamento.', 370, 545, 590, 21, '#2459c9', true),
        object('breaker', { name: 'Mecanismo e carcaça', x: 966, y: 346, w: 324, h: 415, shadow: 20,
          keys: { effect: frames([0, 0], [2, 0], [6.2, 1], [9.7, 1]) } })
      ],
      camera: { x: 640, y: 360, zoom: 1, keys: { zoom: frames([0, 1], [10, 1.045]) } },
      narration: 'Na ilustração, separamos a carcaça e o mecanismo para distinguir os contatos. Com os contatos fechados existe um caminho condutor. Quando eles se separam, esse caminho é interrompido no modelo.',
      text: 'A vista explodida isola visualmente o mecanismo e a carcaça. O desenho é conceitual e não é um procedimento de desmontagem.', reference: general,
      captions: [
        { id: uid(), start: 0.3, end: 4.4, text: 'A vista explodida ajuda a distinguir a carcaça do mecanismo.' },
        { id: uid(), start: 4.5, end: 9.6, text: 'A separação dos contatos interrompe o caminho condutor no modelo.' }
      ]
    });
  }
  if (kind === 'circuit') {
    const diagram = object('circuit', { x: 704, y: 378, w: 740, h: 385, effect: 0 });
    applyMotion(diagram, 'flow', 4, 4.7, 'out');
    return newScene({
      title: 'Caminho aberto e fechado', chapter: 'O circuito', duration: 10,
      transition: 'dip', background: '#eaf3ff',
      layers: [
        heading('03   /   ESQUEMA SIMPLIFICADO', 365, 49, 590, 16, '#2459c9', true),
        heading('O caminho determina o estado da carga', 637, 129, 1130, 43, '#102754', true),
        diagram,
        heading('Animação simbólica: os marcadores indicam continuidade do caminho.', 645, 615, 1120, 21, '#345d86', true)
      ],
      narration: 'Neste circuito simplificado, uma chave aberta interrompe o caminho. Quando a chave fecha, a carga pode receber energia da fonte. Os marcadores são uma visualização da continuidade, não uma representação da direção da corrente alternada.',
      text: 'Alterne entre os estados aberto e fechado da chave. Os marcadores representam a disponibilidade de um caminho completo.', reference: general,
      captions: [
        { id: uid(), start: 0.1, end: 4, text: 'Com a chave aberta, o caminho está interrompido.' },
        { id: uid(), start: 4.1, end: 9.8, text: 'Com o caminho fechado, a carga pode receber energia da fonte.' }
      ]
    });
  }
  return newScene({
    title: 'Sinal ao longo do tempo', chapter: 'O sinal', duration: 8, transition: 'fade',
    layers: [
      ...baseTitle('04   /   LEITURA DE GRÁFICO', 'Observe a mudança no tempo', 'O eixo horizontal representa o tempo. O eixo vertical representa uma grandeza normalizada.'),
      object('chart', { x: 940, y: 352, w: 470, h: 320, keys: { effect: frames([0, 0], [6, 1], [8, 1]) } })
    ],
    narration: 'O gráfico separa duas dimensões: a grandeza observada no eixo vertical e o tempo no eixo horizontal. A curva é ilustrativa e não usa unidades ou valores de referência.',
    text: 'Compare a forma da curva antes e depois da mudança. Valores ilustrativos, sem unidades.', reference: 'Gráfico autoral para demonstrar leitura de tendências.',
    captions: [{ id: uid(), start: 0.2, end: 7.4, text: 'Tempo no eixo horizontal. Grandeza normalizada no eixo vertical.' }]
  });
}

export function demo() {
  return {
    id: 'demo-quadro', title: 'Do quadro ao circuito', module: 'Fundamentos técnicos',
    description: 'Quatro cenas com abertura de quadro, vista explodida de um disjuntor, circuito comutado e leitura de uma curva.',
    scenes: ['panel', 'breaker', 'circuit', 'chart'].map(template)
  };
}

function legacyScene(s, index) {
  const scene = newScene({
    id: s.id, title: s.title, duration: s.duration, chapter: 'Aula recuperada',
    text: [s.body, ...s.points, s.leftText && s.rightText ? s.leftLabel + ': ' + s.leftText + '\n' + s.rightLabel + ': ' + s.rightText : ''].filter(Boolean).join('\n'),
    narration: s.narration, reference: s.reference,
    layers: [
      heading(s.eyebrow || 'MÉTODO DE ESTUDO', 535, 82, 960, 16, '#2459c9', true),
      heading(s.title, 535, 182, 960, 50, '#102754', true),
      heading(s.body, 535, 321, 960, 30, '#355474'),
      heading(s.points.map(p => '• ' + p).join('\n'), 535, 488, 960, 25, '#2459c9', true)
    ]
  });
  if (s.imageUrl.startsWith('data:image/')) scene.layers.push(object('image', { src: s.imageUrl, x: 1060, y: 510, w: 310, h: 240 }));
  if (s.audioUrl.startsWith('data:audio/')) scene.audio.push({
    id: uid(), name: 'Narração ' + (index + 1), track: 'voice', src: s.audioUrl,
    start: 0, end: s.duration, offset: 0, rate: 1, volume: 1, length: s.audioDuration || s.duration
  });
  return scene;
}

export function importLegacy(input) {
  const legacy = readLegacy(input);
  return {
    format: FORMAT, version: 3, name: legacy.name, legacyIds: legacy.lessons.map(l => l.id),
    lessons: legacy.lessons.map(l => ({
      id: l.id, legacyId: l.id, title: l.title, description: l.description,
      category: l.category, status: l.status, module: 'Aulas recuperadas',
      scenes: l.scenes.map(legacyScene)
    }))
  };
}
