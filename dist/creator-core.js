/* Luma Creator: original implementation of scene composition and creator workflows. */
(function(root){
const n=(v,a,b,d)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):d;
const str=(s,max=10000)=>String(s??'').slice(0,max),color=(s,d)=>/^#[a-f0-9]{6}$/i.test(s)?s:d;
const filters=[
{id:'original',name:'Original',css:'none',swatch:'#b5c4b7'},
{id:'cinema',name:'Cine',css:'contrast(1.18) saturate(.8)',swatch:'#475d63'},
{id:'warm',name:'Cálido',css:'sepia(.22) saturate(1.15)',swatch:'#d5ad83'},
{id:'cool',name:'Frío',css:'hue-rotate(12deg) saturate(.85)',overlay:'#6298ef',alpha:.10,swatch:'#8cb5ca'},
{id:'mono',name:'Blanco y negro',css:'grayscale(1) contrast(1.15)',swatch:'#939398'},
{id:'vintage',name:'Vintage',css:'sepia(.48) contrast(.88) saturate(.8)',swatch:'#c5a58c'},
{id:'vivid',name:'Vibrante',css:'saturate(1.65) contrast(1.12)',swatch:'#b798cd'},
{id:'soft',name:'Suave',css:'contrast(.88) brightness(1.08)',swatch:'#dcc1c7'},
{id:'night',name:'Nocturno',css:'brightness(.78) contrast(1.25) saturate(.7)',overlay:'#24366b',alpha:.13,swatch:'#414769'},
{id:'sunset',name:'Atardecer',css:'sepia(.22) saturate(1.25)',overlay:'#f19758',alpha:.12,swatch:'#dc9b81'},
{id:'fade',name:'Mate',css:'contrast(.78) saturate(.8) brightness(1.1)',swatch:'#b6b3b0'},
{id:'noir',name:'Noir',css:'grayscale(1) contrast(1.65) brightness(.85)',swatch:'#4d4c50'}
];
const sceneKeys=['name','asset','text','bg','color','fontSize','textY','textX','brightness','saturation','start','end','duration','subtitles','filter','zoom','fit','cropX','cropY','transition','layers','font','subtitleStyle','sourceDuration','muted'];
function layer(v={}){return {id:crypto.randomUUID(),kind:['text','sticker','shape','image'].includes(v.kind)?v.kind:'text',text:str(v.text||'Tu texto',1000),x:n(v.x,0,100,50),y:n(v.y,0,100,50),size:n(v.size,16,220,72),width:n(v.width,5,100,75),height:n(v.height,2,100,15),color:color(v.color,'#ffffff'),fill:color(v.fill,'#7658df'),opacity:n(v.opacity,0,1,1),rotation:n(v.rotation,-180,180,0),animation:['none','fade','slide','pop','float'].includes(v.animation)?v.animation:'none',locked:!!v.locked,hidden:!!v.hidden,asset:typeof v.asset==='string'?v.asset:null}}
function scene(v={}){return {id:crypto.randomUUID(),name:str(v.name||'Escena',80),asset:typeof v.asset==='string'?v.asset:null,text:str(v.text??''),bg:color(v.bg,'#222033'),color:color(v.color,'#ffffff'),fontSize:n(v.fontSize,20,140,72),textX:n(v.textX,0,100,50),textY:n(v.textY,0,100,50),brightness:n(v.brightness,20,180,100),saturation:n(v.saturation,0,200,100),start:n(v.start,0,86400,0),end:n(v.end,0,86400,0),duration:n(v.duration,1,120,4),sourceDuration:n(v.sourceDuration,0,86400,0),subtitles:str(v.subtitles,100000),filter:filters.some(f=>f.id===v.filter)?v.filter:'original',zoom:n(v.zoom,1,3,1),fit:v.fit==='contain'?'contain':'cover',cropX:n(v.cropX,0,100,50),cropY:n(v.cropY,0,100,50),transition:['cut','fade','slide','zoom'].includes(v.transition)?v.transition:'fade',font:['sans-serif','serif','monospace'].includes(v.font)?v.font:'sans-serif',subtitleStyle:['dark','plain','yellow'].includes(v.subtitleStyle)?v.subtitleStyle:'dark',muted:!!v.muted,layers:Array.isArray(v.layers)?v.layers.slice(0,40).map(layer):[]}}
function ensure(project){if(!project.scenes?.length){const s=scene({...project,name:'Escena 1'});project.scenes=[s];project.activeScene=s.id;for(const k of sceneKeys)if(k!=='name')project[k]=structuredClone(s[k])}if(!project.scenes.some(s=>s.id===project.activeScene))project.activeScene=project.scenes[0].id;project.musicLoop??=true;project.ducking??=false;return project}
function mirror(project){if(!project?.scenes)return;const s=project.scenes.find(s=>s.id===project.activeScene);if(s)for(const k of sceneKeys){if(k!=='name'&&project[k]!==undefined)s[k]=structuredClone(project[k])}}
function activate(project,id,shouldMirror=true){if(shouldMirror)mirror(project);const s=project.scenes.find(s=>s.id===id);if(!s)throw Error('Escena no encontrada');project.activeScene=id;for(const k of sceneKeys)if(k!=='name')project[k]=structuredClone(s[k]);return s}
function references(project){const ids=[project.asset,project.audio];for(const s of project.scenes||[]){ids.push(s.asset);for(const l of s.layers||[])ids.push(l.asset)}return [...new Set(ids.filter(Boolean))]}
function remap(project,ids){project.asset=ids.get(project.asset)||null;project.audio=ids.get(project.audio)||null;for(const s of project.scenes||[]){s.asset=ids.get(s.asset)||null;for(const l of s.layers||[])l.asset=ids.get(l.asset)||null}if(project.scenes?.length)activate(project,project.activeScene,false)}
function length(s){return s.asset&&(s.end||s.sourceDuration)?(s.end||s.sourceDuration)-s.start:s.duration}
function layout(scenes){let t=0;return scenes.map(s=>{const duration=length(s);if(!Number.isFinite(duration)||duration<=0)throw Error('Recorte no válido en '+s.name);const item={id:s.id,start:t,end:t+duration,duration};t+=duration;return item})}
function locate(t,intervals){if(t>=intervals.at(-1).end)return intervals.length-1;const i=intervals.findIndex(s=>t>=s.start&&t<s.end);return Math.max(0,i)}
function caption(template,values){return String(template).replace(/\{(titulo|marca|cta|hashtags)\}/g,(_,key)=>str(values[key]||'',10000))}
function csv(rows){return rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}).join(',')).join('\r\n')}
const music=[
{id:'lofi',name:'Lo-fi café',bpm:82,notes:[220,261.63,329.63,293.66],type:'soft'},
{id:'vlog',name:'Vlog luminoso',bpm:106,notes:[261.63,329.63,392,349.23],type:'bright'},
{id:'focus',name:'Focus ambiental',bpm:68,notes:[164.81,196,246.94,220],type:'ambient'},
{id:'house',name:'House suave',bpm:120,notes:[220,277.18,329.63,246.94],type:'dance'},
{id:'urban',name:'Pulso urbano',bpm:92,notes:[146.83,174.61,220,196],type:'urban'},
{id:'cinematic',name:'Cine inspirador',bpm:76,notes:[196,246.94,293.66,261.63],type:'ambient'},
{id:'sunny',name:'Día soleado',bpm:112,notes:[293.66,369.99,440,392],type:'bright'},
{id:'minimal',name:'Minimal tech',bpm:116,notes:[164.81,196,220,246.94],type:'dance'}
];
function wav(id,seconds=16){const m=music.find(m=>m.id===id)||music[0],rate=22050,len=Math.round(rate*n(seconds,1,120,16)),out=new ArrayBuffer(44+len*2),v=new DataView(out);const text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i))};text(0,'RIFF');v.setUint32(4,36+len*2,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,len*2,true);let seed=527;const beat=60/m.bpm;for(let i=0;i<len;i++){const t=i/rate,b=t/beat,k=Math.floor(b),phase=b-k,note=m.notes[Math.floor(b/4)%4];seed=(seed*1664525+1013904223)>>>0;const noise=seed/4294967296*2-1;const pad=(Math.sin(2*Math.PI*note*t)+.5*Math.sin(2*Math.PI*note*1.5*t))*.09;const pluck=Math.sin(2*Math.PI*m.notes[k%4]*2*t)*Math.exp(-phase*8)*.11;const kick=Math.sin(2*Math.PI*(48*t+6*(1-Math.exp(-phase*20))))*Math.exp(-phase*16)*.18;const hat=noise*Math.exp(-(b*2%1)*40)*.035;const bass=Math.sin(2*Math.PI*note/2*t)*.10;let sample=pad+bass+(m.type==='ambient'?pluck*.2:pluck+kick+hat);sample*=Math.min(1,t/.15,(len/rate-t)/.4);v.setInt16(44+i*2,Math.round(Math.tanh(sample)*27000),true)}return new Blob([out],{type:'audio/wav'})}
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
async function zip(files){const blocks=[],central=[];let offset=0;for(const f of files){const name=new TextEncoder().encode(String(f.name).replace(/\\/g,'/').split('/').filter(s=>s&&s!=='.'&&s!=='..').map(s=>s.replace(/[^a-zA-Z0-9_. -]/g,'_')).join('/')||'archivo'),data=new Uint8Array(await f.blob.arrayBuffer()),checksum=crc(data),head=new Uint8Array(30+name.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint32(14,checksum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);head.set(name,30);const center=new Uint8Array(46+name.length),c=new DataView(center.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,checksum,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);center.set(name,46);blocks.push(head,data);central.push(center);offset+=head.length+data.length}const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);return new Blob([...blocks,...central,end],{type:'application/zip'})}
root.LumaCreatorCore={n,scene,layer,sceneKeys,ensure,mirror,activate,references,remap,length,layout,locate,caption,csv,filters,music,wav,zip};
if(typeof module!=='undefined')module.exports=root.LumaCreatorCore;
})(globalThis);

