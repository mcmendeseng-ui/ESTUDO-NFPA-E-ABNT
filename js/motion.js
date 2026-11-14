/** Desenho SVG original e articulado para demonstração. Ações são animações CSS de juntas, não fotografias movidas. */
export const escapeHtml = (v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function personSvg(motion='explain', small=false) {
  const label=small?'Personagem ilustrado menor':'Personagem ilustrado demonstrador';
  return `<div class="stage-person ${small?'stage-person--left':''}" data-motion="${escapeHtml(motion)}" aria-label="${label}" role="img">
  <svg class="figure-svg" viewBox="0 0 210 325" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="jacket" x1="0" x2="1"><stop stop-color="#cde4ff"/><stop offset="1" stop-color="#93b8e8"/></linearGradient><linearGradient id="trousers"><stop stop-color="#17355d"/><stop offset="1" stop-color="#0b254d"/></linearGradient></defs>
    <ellipse cx="105" cy="303" rx="69" ry="13" fill="#051a3a" opacity=".38"/>
    <g class="figure-bob">
      <!-- Pernas articuladas independentes na cintura -->
      <g class="leg leg--left"><path d="M84 191 L78 247 L72 291 Q84 302 98 292 L106 245 L107 200Z" fill="url(#trousers)"/><path d="M70 287 L98 288 L105 301 Q102 307 64 305 Q60 300 70 287Z" fill="#112c4c" stroke="#426a97" stroke-width="2"/></g>
      <g class="leg leg--right"><path d="M106 192 L106 246 L111 292 Q122 302 135 293 L133 239 L129 197Z" fill="url(#trousers)"/><path d="M109 286 L136 289 L143 301 Q139 307 102 305 Q99 300 109 286Z" fill="#112c4c" stroke="#426a97" stroke-width="2"/></g>
      <path d="M76 181 Q104 192 135 180 L134 210 Q107 223 77 207Z" fill="#153765"/>
      <!-- Braço esquerdo -->
      <g class="arm-upper arm-upper--left"><path d="M77 116 Q52 120 47 147 L39 187 Q39 200 52 201 L64 191 L69 162 L84 141Z" fill="#b5d1f1" stroke="#7caddc" stroke-width="2"/><g class="forearm forearm--left"><path d="M45 179 L41 212 Q42 227 56 223 L66 192Z" fill="#b5d1f1" stroke="#7caddc" stroke-width="2"/><rect x="40" y="215" width="19" height="19" rx="9" fill="#e5ae85"/></g></g>
      <!-- Tronco e identidade visual -->
      <path d="M79 114 Q108 105 133 117 L143 192 Q112 208 70 193 L71 145Z" fill="url(#jacket)" stroke="#80aee2" stroke-width="2"/>
      <path d="M104 116 L100 193" stroke="#79a8d7" stroke-width="2"/><path d="M77 162 L140 164" stroke="#8db3dc" opacity=".4"/>
      <rect x="113" y="143" width="22" height="15" rx="3" fill="#174f8e"/><path d="M119 147 L130 147 M119 151 L127 151" stroke="#90d9fe" stroke-width="1.5"/>
      <path d="M85 111 L104 137 L125 113" fill="none" stroke="#f3fcff" stroke-width="7" stroke-linecap="round"/>
      <!-- Braço direito com antebraço articulado -->
      <g class="arm-upper arm-upper--right"><path d="M133 117 Q158 124 165 148 L178 182 Q180 197 164 201 L151 187 L142 165 L130 144Z" fill="#8fbce9" stroke="#79a3d7" stroke-width="2"/><g class="forearm forearm--right"><path d="M164 179 L173 210 Q174 226 161 230 L151 203Z" fill="#8fbce9" stroke="#79a3d7" stroke-width="2"/><rect x="153" y="215" width="20" height="19" rx="9" fill="#e5ae85"/><rect x="159" y="226" width="12" height="13" rx="6" fill="#e5ae85"/></g></g>
      <!-- Pescoço e cabeça -->
      <rect x="95" y="100" width="21" height="20" rx="9" fill="#dd9e75"/>
      <g class="head-rotate"><ellipse cx="105" cy="69" rx="34" ry="42" fill="#eab38c"/><path d="M69 67 Q61 14 110 16 Q150 14 142 70 L136 56 Q110 60 88 43 Q89 62 74 73Z" fill="#23385b"/><ellipse cx="75" cy="75" rx="5" ry="10" fill="#eab38c"/><ellipse cx="136" cy="75" rx="5" ry="10" fill="#eab38c"/><path d="M88 71 Q96 68 101 71 M115 71 Q121 68 127 71" stroke="#283652" stroke-width="3" stroke-linecap="round"/><ellipse cx="96" cy="73" rx="2" ry="3" fill="#132944"/><ellipse cx="121" cy="73" rx="2" ry="3" fill="#132944"/><path d="M102 90 Q110 95 118 89" stroke="#ad6b60" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M91 27 Q115 13 132 39" stroke="#304969" stroke-width="7" fill="none" stroke-linecap="round"/></g>
    </g></svg></div>`;
}
export function visualFor(scene){
  const motion=['idle','explain','walk','point','inspect','wave'].includes(scene.motion)?scene.motion:'explain';
  const safe=escapeHtml;
  if(scene.kind==='compare') return `<div class="scene-visual scene-visual--compare"><div class="compare-plate"><div class="compare-side"><b>${safe(scene.leftLabel)}</b><pre>${safe(scene.leftText||'Referência ainda não validada.')}</pre></div><div class="compare-side"><b>${safe(scene.rightLabel)}</b><pre>${safe(scene.rightText||'Referência ainda não validada.')}</pre></div></div></div>`;
  if(scene.kind==='steps')return `<div class="scene-visual"><div class="diagram-card"><small>RASTREABILIDADE</small><h4>Fonte → Análise</h4><span></span><span class="short"></span></div>${personSvg(motion)}</div><div class="steps-display">${scene.points.slice(0,3).map((p,i)=>`<div class="step-bubble"><i>${i+1}</i>${safe(p)}</div>${i<Math.min(scene.points.length,3)-1?'<span class="step-arrow">➜</span>':''}`).join('')}</div>`;
  if(scene.kind==='summary')return `<div class="scene-visual"><div class="diagram-card"><small>APRENDIZADO</small><h4>Da fonte à compreensão</h4><span></span><span class="short"></span></div><div class="diagram-orb">✓</div>${personSvg(motion)}</div>`;
  if(scene.kind==='image' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(scene.imageUrl))return `<div class="scene-visual"><img src="${safe(scene.imageUrl)}" alt="Imagem da cena" style="object-fit:contain;width:100%;height:100%;border-radius:13px"/></div>`;
  return `<div class="scene-visual"><div class="diagram-card"><small>${scene.kind==='intro'?'CURIOSIDADE + MÉTODO':'PENSAMENTO CRÍTICO'}</small><h4>${scene.kind==='intro'?'Uma ideia por vez':'Observe. Analise.'}</h4><span></span><span class="short"></span></div><div class="diagram-orb">${scene.kind==='intro'?'✦':'◎'}</div>${personSvg(motion)}</div>`;
}
export function renderStage(scene,sceneIndex,sceneCount){
  const safe=escapeHtml;
  const skipPoints=scene.kind==='steps';
  return `<div class="stage-shine" aria-hidden="true"></div><div class="scene-content"><div class="scene-kicker">${safe(scene.eyebrow||'ESTUDO TÉCNICO')}</div><h3 class="scene-headline">${safe(scene.title)}</h3><p class="scene-body">${safe(scene.body)}</p>${visualFor(scene)}${skipPoints?'':'<div class="scene-points">'+scene.points.map(p=>`<span class="scene-point">${safe(p)}</span>`).join('')+'</div>'}<div class="scene-footer"><span>${safe(scene.reference||'Referência técnica pendente de validação')}</span><span class="scene-counter">${String(sceneIndex+1).padStart(2,'0')} / ${String(sceneCount).padStart(2,'0')}</span></div></div>`;
}
