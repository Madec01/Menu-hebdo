/* ---------- utilitaires ---------- */
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
let rng = Math.random;                       // générateur seedé de la partie
const R = (a, b) => a + rng() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = arr => arr[Math.floor(rng() * arr.length)];
const chance = p => rng() < p;
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const fmtNum = n => (Math.round(n * 10) / 10).toString();
let nextId = 1;

/* ---------- sauvegarde ---------- */
const SAVE_KEY = 'crypte-infinie-v2';
const DEFAULT_SAVE = { v: 2, essence: 0, bestFloor: 0, runs: 0, kills: 0, bossKills: 0, meta: {}, weapons: ['wand'], startWeapon: 'wand',
  bestiary: {}, musicVol: 0.6, sfxVol: 0.8, shakeAmt: 1, lastSeed: null, tutorial: 0, tutorialEnvers: 0, echo: null, introSeen: false, tabletsRead: [], biomesSeen: [], tutorialStep: 0, tutorialDone: false };
let save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      save = Object.assign(save, s);
      save.meta = save.meta || {}; save.bestiary = save.bestiary || {};
      if (!Array.isArray(save.tabletsRead)) save.tabletsRead = []; if (!Array.isArray(save.biomesSeen)) save.biomesSeen = [];
      if (!Array.isArray(save.weapons) || !save.weapons.includes('wand')) save.weapons = ['wand'].concat(Array.isArray(save.weapons) ? save.weapons : []);
      if (!save.weapons.includes(save.startWeapon)) save.startWeapon = 'wand';
    }
  } catch (e) {}
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
loadSave();
const metaLv = id => save.meta[id] || 0;

/* ---------- état partagé ---------- */
const TILE = 32, RW = 21, RH = 13;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const OPP = { '1,0': '-1,0', '-1,0': '1,0', '0,1': '0,-1', '0,-1': '0,1' };
// tuiles : 0 sol, 1 mur, 3 porte ouverte, 4 porte fermée, 5 eau, 6 poison, 7 lave, 8 glace, 9 gouffre
const T_FLOOR = 0, T_WALL = 1, T_DOOR = 3, T_DOORC = 4, T_WATER = 5, T_POISON = 6, T_LAVA = 7, T_ICE = 8, T_PIT = 9;
// Envers : 10 ombre traversable, 11 glyphe (faux gouffre), 12 porte scellée, 13 pont, 14 glyphe révélé
const T_SHADOW = 10, T_GLYPH = 11, T_SEALED = 12, T_BRIDGE = 13, T_GLYPHE = 14;

let state = 'menu';   // menu | play | pause | choice | dead
let G = null, P = null;
let enemies = [], bullets = [], parts = [], pickups = [], texts = [], zones = [], pools = [], slashes = [], props = [], beams = [];
let shake = 0, flash = 0, flashColor = '255,40,70', transT = 0, camX = 0, camY = 0, banner = null, hint = null;
let W = 0, H = 0, DPR = 1, ZOOM = 1;
const SA = { t: 0, b: 0, l: 0, r: 0 };
let wantDash = false, wantSurge = false, wantCross = false;
const keys = new Set();
const mouse = { x: 0, y: 0, down: false, t: -1e9, active: false };
const touches = new Map();
