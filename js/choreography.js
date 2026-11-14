/** Diretor 2D: poses determinadas pelo tempo local da cena para busca, pausa e reprodução. */
export const MOTION_LABELS={idle:'Em repouso',explain:'Explicando',walk:'Caminhando',point:'Apontando',inspect:'Inspecionando',wave:'Acenando'};
const motions=Object.keys(MOTION_LABELS),clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
function pose(type,t){
 const slow=Math.sin(t*2.3),fast=Math.sin(t*7.6),step=Math.sin(t*8.1);
 switch(type){
 case 'walk':return {L:24*step,R:-24*step,FL:-8+9*step,FR:9*step,legL:-21*step,legR:21*step,kneeL:18*Math.max(0,-step),kneeR:18*Math.max(0,step),head:2*slow,bob:-4*Math.abs(fast),slide:9*Math.sin(t*.65)};
 case 'point':return {L:4+2*slow,R:-64+4*slow,FL:4,FR:-11+4*fast,legL:0,legR:0,kneeL:0,kneeR:0,head:-6+2*slow,bob:1.2*slow,slide:0};
 case 'inspect':return {L:10+2*slow,R:-33+3*slow,FL:22,FR:19+2*fast,legL:0,legR:0,kneeL:0,kneeR:0,head:12+4*slow,bob:1.5*slow,slide:0};
 case 'wave':return {L:3,R:-78+8*slow,FL:0,FR:22*fast,legL:0,legR:0,kneeL:0,kneeR:0,head:-3+3*slow,bob:2*slow,slide:0};
 case 'explain':return {L:-7+7*slow,R:-17+11*slow,FL:13+9*fast,FR:15-12*fast,legL:0,legR:0,kneeL:0,kneeR:0,head:2*slow,bob:1.5*slow,slide:0};
 default:return {L:0,R:0,FL:0,FR:0,legL:0,legR:0,kneeL:0,kneeR:0,head:1.6*slow,bob:.8*slow,slide:0};
 }}
export function normalizedCues(scene){
 const valid=(Array.isArray(scene.cues)?scene.cues:[]).filter(c=>c&&motions.includes(c.motion)&&Number.isFinite(Number(c.time))).map(c=>({time:clamp(Number(c.time),0,Number(scene.duration)||30),motion:c.motion})).sort((a,b)=>a.time-b.time);
 return [{time:0,motion:motions.includes(scene.motion)?scene.motion:'explain'},...valid];
}
export function motionAt(scene,seconds){
 const cues=normalizedCues(scene),t=clamp(Number(seconds)||0,0,Number(scene.duration)||30);
 let i=0;while(i+1<cues.length&&cues[i+1].time<=t)i++;
 const c=cues[i],prev=cues[Math.max(0,i-1)];
 if(i===0||t-c.time>=.42||c.motion===prev.motion)return [{motion:c.motion,weight:1}];
 const w=smooth((t-c.time)/.42);
 return [{motion:prev.motion,weight:1-w},{motion:c.motion,weight:w}];
}
export function exampleCues(scene){
 const d=Math.max(3,Number(scene.duration)||15),s=scene.motion||'explain';
 const seq=scene.kind==='compare'?['point','explain','point']:scene.kind==='steps'?['walk','inspect','point']:scene.kind==='summary'?['explain','point','wave']:['explain','point',s];
 return seq.map((motion,i)=>({id:'cue-'+Date.now()+'-'+i,time:Number((d*(.1+i*.29)).toFixed(1)),motion}));
}
function poseAt(scene,t){
 const value={};
 for(const {motion,weight} of motionAt(scene,t))for(const [key,angle] of Object.entries(pose(motion,t)))value[key]=(value[key]||0)+angle*weight;
 return value;
}
function tr(root,selector,transform){const el=root.querySelector(selector);if(el)el.style.transform=transform;}
const rot=v=>'rotate('+v.toFixed(2)+'deg)';
export function directStage(stage,scene,localSeconds){
 if(!stage)return;
 stage.classList.add('is-directed');
 const t=clamp(Number(localSeconds)||0,0,Number(scene.duration)||30),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const p=poseAt(scene,reduced?0:t),person=stage.querySelector('.stage-person');
 if(person){
 person.style.translate=(p.slide||0).toFixed(1)+'% 0';
 tr(person,'.figure-bob','translateY('+p.bob.toFixed(2)+'px)');
 for(const [selector,value] of [['.arm-upper--left',p.L],['.arm-upper--right',p.R],['.forearm--left',p.FL],['.forearm--right',p.FR],['.leg--left',p.legL],['.leg--right',p.legR],['.shin--left',p.kneeL||0],['.shin--right',p.kneeR||0],['.head-rotate',p.head]])tr(person,selector,rot(value));
 const eyes=person.querySelector('.eye-blink');
 if(eyes){const blink=Math.abs(((t+.17)%4.6)-2.3)>2.22?.12:1;eyes.style.transform='scaleY('+(reduced?1:blink)+')';}
 }
 const progress=t/Math.max(1,Number(scene.duration)||15),card=stage.querySelector('.diagram-card');
 if(card)card.style.transform='translateY('+(-7*Math.sin(Math.PI*progress)).toFixed(2)+'px) rotate('+(-7+2*Math.sin(t*.7)).toFixed(2)+'deg)';
 stage.querySelectorAll('.step-bubble,.step-arrow').forEach((node,i)=>{const a=smooth((progress-(.17+i*.17))/.12);node.style.opacity=a.toFixed(3);node.style.transform='translateY('+(12*(1-a)).toFixed(2)+'px)';});
 stage.querySelectorAll('.compare-side').forEach((node,i)=>{const a=smooth((progress-(.11+i*.24))/.19);node.style.opacity=a.toFixed(3);node.style.transform='translateY('+(18*(1-a)).toFixed(2)+'px)';});
 stage.querySelectorAll('.scene-point').forEach((node,i)=>{const a=smooth((progress-(.29+i*.11))/.17);node.style.opacity=a.toFixed(3);node.style.transform='translateY('+(8*(1-a)).toFixed(2)+'px)';});
 const orb=stage.querySelector('.diagram-orb');if(orb)orb.style.transform='translateY('+(-5*Math.sin(t*.9)).toFixed(1)+'px) rotate('+(10*Math.sin(t*.33)).toFixed(1)+'deg)';
}
