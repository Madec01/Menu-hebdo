/* =====================================================================
   ARCHITECTE LOGIQUE — harnais de test headless (1/3 : stubs navigateur)
   Concaténé AVANT le <script> du jeu par test/run.js.
   Objectif : fournir juste assez de DOM / Canvas / Audio / stockage pour
   que le moteur démarre hors navigateur, sans jamais rien dessiner.
   ===================================================================== */

/* ---------- Horloge déterministe (Date.now pilotable par les tests) ---------- */
var __T0 = 1700000000000;
var __now = __T0;
Date.now = function(){ return __now; };
function __advance(ms){ __now += ms; return __now; }
function __setNow(t){ __now = t; return __now; }

/* ---------- Style / classList ---------- */
function __Style(){}
__Style.prototype.setProperty = function(k, v){ this[k] = v; };
__Style.prototype.removeProperty = function(k){ delete this[k]; };

function __ClassList(){ this._s = new Set(); }
__ClassList.prototype.add = function(){ [].forEach.call(arguments, c => this._s.add(c)); };
__ClassList.prototype.remove = function(){ [].forEach.call(arguments, c => this._s.delete(c)); };
__ClassList.prototype.contains = function(c){ return this._s.has(c); };
__ClassList.prototype.toggle = function(c, f){
  const on = (f === undefined) ? !this._s.has(c) : !!f;
  on ? this._s.add(c) : this._s.delete(c);
  return on;
};
__ClassList.prototype.toString = function(){ return [...this._s].join(' '); };

/* ---------- Contexte Canvas 2D ---------- */
function CanvasRenderingContext2D(){
  this.canvas = null; this.font = ''; this.fillStyle = ''; this.strokeStyle = '';
  this.lineWidth = 1; this.globalAlpha = 1; this.shadowBlur = 0; this.shadowColor = '';
  this.textAlign = 'left'; this.textBaseline = 'top'; this.lineCap = 'butt';
  this.lineJoin = 'miter'; this.lineDashOffset = 0; this.globalCompositeOperation = 'source-over';
}
'save restore beginPath closePath moveTo lineTo arc arcTo ellipse rect quadraticCurveTo bezierCurveTo fill stroke fillRect strokeRect clearRect fillText strokeText setTransform transform translate rotate scale setLineDash clip drawImage putImageData resetTransform'
  .split(' ').forEach(m => { CanvasRenderingContext2D.prototype[m] = function(){}; });
CanvasRenderingContext2D.prototype.getLineDash = function(){ return []; };
CanvasRenderingContext2D.prototype.measureText = function(t){ return { width: String(t).length * 6 }; };
CanvasRenderingContext2D.prototype.createLinearGradient = function(){ return { addColorStop(){} }; };
CanvasRenderingContext2D.prototype.createRadialGradient = function(){ return { addColorStop(){} }; };
CanvasRenderingContext2D.prototype.createPattern = function(){ return null; };
CanvasRenderingContext2D.prototype.getImageData = function(){ return { data: [] }; };
CanvasRenderingContext2D.prototype.isPointInPath = function(){ return false; };

/* ---------- Élément DOM minimal ---------- */
function __El(tag, id){
  this.tagName = String(tag || 'div').toUpperCase();
  this.id = id || '';
  this.className = ''; this.innerHTML = ''; this.textContent = ''; this.title = '';
  this.value = ''; this.checked = false; this.disabled = false; this.type = '';
  this.href = ''; this.download = ''; this.accept = '';
  this.width = 0; this.height = 0;
  this.dataset = {}; this.children = []; this.files = null;
  this.style = new __Style();
  this.classList = new __ClassList();
  this._ls = Object.create(null);
  this._ctx = null;
}
__El.prototype.addEventListener = function(t, f){ (this._ls[t] || (this._ls[t] = [])).push(f); };
__El.prototype.removeEventListener = function(t, f){
  if (this._ls[t]) this._ls[t] = this._ls[t].filter(g => g !== f);
};
__El.prototype.dispatch = function(t, evt){
  const e = Object.assign({ type:t, target:this, currentTarget:this, clientX:0, clientY:0,
    button:0, key:'', ctrlKey:false, shiftKey:false, metaKey:false, altKey:false,
    deltaY:0, pointerId:1, preventDefault(){}, stopPropagation(){} }, evt || {});
  (this._ls[t] || []).slice().forEach(f => f.call(this, e));
  return e;
};
__El.prototype.appendChild = function(c){ this.children.push(c); return c; };
__El.prototype.removeChild = function(c){ this.children = this.children.filter(x => x !== c); return c; };
__El.prototype.insertBefore = function(c){ this.children.unshift(c); return c; };
__El.prototype.remove = function(){};
__El.prototype.querySelectorAll = function(){ return []; };
__El.prototype.querySelector = function(){ return null; };
__El.prototype.getBoundingClientRect = function(){
  return { left:0, top:0, right:0, bottom:0, width:0, height:0, x:0, y:0 };
};
__El.prototype.focus = function(){}; __El.prototype.blur = function(){};
__El.prototype.select = function(){}; __El.prototype.scrollIntoView = function(){};
__El.prototype.setAttribute = function(k, v){ this[k] = v; };
__El.prototype.getAttribute = function(k){ return this[k]; };
__El.prototype.click = function(){ this.dispatch('click'); };
__El.prototype.getContext = function(){
  if (!this._ctx){ this._ctx = new CanvasRenderingContext2D(); this._ctx.canvas = this; }
  return this._ctx;
};
__El.prototype.toBlob = function(cb){ cb(new Blob(['png'])); };
__El.prototype.toDataURL = function(){ return 'data:image/png;base64,'; };

/* ---------- document ---------- */
var __els = new Map();
var document = {
  body: new __El('body'),
  documentElement: new __El('html'),
  createElement(tag){ return new __El(tag); },
  createTextNode(t){ return { textContent: t }; },
  getElementById(id){
    if (!__els.has(id)) __els.set(id, new __El(/canvas/i.test(id) ? 'canvas' : 'div', id));
    return __els.get(id);
  },
  querySelectorAll(){ return []; },
  querySelector(){ return null; },
  addEventListener(t, f){ __winLs[t] || (__winLs[t] = []); __winLs[t].push(f); },
  removeEventListener(){}
};
/* Accès direct aux éléments stubés depuis les tests */
function __el(id){ return document.getElementById(id); }
function __fire(id, type, evt){ return __el(id).dispatch(type, evt); }

/* ---------- window / globals ---------- */
var __winLs = Object.create(null);
function addEventListener(t, f){ (__winLs[t] || (__winLs[t] = [])).push(f); }
function removeEventListener(t, f){ if (__winLs[t]) __winLs[t] = __winLs[t].filter(g => g !== f); }
function __fireWin(type, evt){
  const e = Object.assign({ type, key:'', preventDefault(){}, stopPropagation(){},
    target:{ tagName:'BODY' }, ctrlKey:false, shiftKey:false, metaKey:false }, evt || {});
  (__winLs[type] || []).slice().forEach(f => f(e));
  return e;
}
var innerWidth = 1440, innerHeight = 900, devicePixelRatio = 1;
function requestAnimationFrame(){ return 0; }          // pas de boucle de rendu en test
function cancelAnimationFrame(){}
function matchMedia(){ return { matches:false, addListener(){}, addEventListener(){} }; }
function getComputedStyle(){ return { getPropertyValue(){ return ''; } }; }
function prompt(){ return null; }
function confirm(){ return true; }
function alert(){}

/* ---------- localStorage ---------- */
var __store = new Map();
var localStorage = {
  getItem(k){ return __store.has(k) ? __store.get(k) : null; },
  setItem(k, v){ __store.set(k, String(v)); },
  removeItem(k){ __store.delete(k); },
  clear(){ __store.clear(); },
  get length(){ return __store.size; },
  key(i){ return [...__store.keys()][i] ?? null; }
};

/* ---------- Divers navigateur ---------- */
function Blob(parts){ this.parts = parts || []; this.size = 0; this.type = ''; }
var URL = { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} };
function FileReader(){ this.onload = null; this.result = null; }
FileReader.prototype.readAsText = function(){ if (this.onload) this.onload({ target:this }); };
function AudioContext(){
  this.currentTime = 0; this.destination = {};
  this.createGain = () => ({ gain:{ value:0, setValueAtTime(){}, setTargetAtTime(){},
    exponentialRampToValueAtTime(){} }, connect(){}, disconnect(){} });
  this.createOscillator = () => ({ type:'sine',
    frequency:{ value:0, setTargetAtTime(){}, exponentialRampToValueAtTime(){} },
    connect(){}, disconnect(){}, start(){}, stop(){} });
}
var navigator = { userAgent:'node-test', maxTouchPoints:0, clipboard:{ writeText(){ return Promise.resolve(); } } };
var window = globalThis;
window.AudioContext = AudioContext;
window.devicePixelRatio = devicePixelRatio;
