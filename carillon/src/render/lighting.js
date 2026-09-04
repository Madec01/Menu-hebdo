// render/lighting.js — éclairage (ARCHITECTURE.md § 7) : la nuit est un
// calque rempli de la couleur d'ambiance, multiplié sur le jeu ; chaque
// lumière y est AJOUTÉE (composite 'lighter') sous forme d'un sprite radial
// pré-rendu par couleur (aucun gradient créé à la frame). Les glows vont sur
// le calque 'screen' du renderer. Le halo de la Mesure (setBeatPulse) est un
// anneau de bronze au sol autour du joueur (setHaloPos), dessiné par
// drawBeatHalo(ctx) après le sol, plus une lueur bronze automatique.

import * as renderer from './renderer.js';
import * as camera from './camera.js';

const SPRITE_SIZE = 128;                // taille du sprite radial pré-rendu
const sprites = new Map();              // couleur → canvas radial
let haloX = 0, haloY = 0, pulse = 0, haloRadius = 26;
let flickerT = 0;
let ambientColor = '#16130f';
let haloColor = '#c9973f';

/** ambient : couleur d'obscurité (parishes.json). */
export function initLighting({ w, h, ambient = '#16130f', halo = '#c9973f' } = {}) {
  ambientColor = ambient; haloColor = halo;
  renderer.setAmbient(ambient);
  renderer.addFrameHook(updateLighting);
  sprites.clear();
  prepareLight(halo);
  prepareLight('#ffffff');
}

export function setAmbient(color) { ambientColor = color; renderer.setAmbient(color); }
export function ambient() { return ambientColor; }

/** Pré-génère (une fois) le sprite radial d'une couleur : à appeler au chargement. */
export function prepareLight(color) {
  let c = sprites.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = SPRITE_SIZE; c.height = SPRITE_SIZE;
  const g = c.getContext('2d');
  const r = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  // Le gradient linéaire en alpha donne un halo trop dur : deuxième passe adoucie.
  g.globalCompositeOperation = 'destination-in';
  const soft = g.createRadialGradient(r, r, 0, r, r, r);
  soft.addColorStop(0, 'rgba(0,0,0,1)'); soft.addColorStop(0.5, 'rgba(0,0,0,0.75)'); soft.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = soft; g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  sprites.set(color, c);
  return c;
}

// Vacillement doux : somme de sinus, sans allocation.
function flickerValue(x, y, f) {
  if (!f) return 1;
  const t = flickerT;
  return 1 + f * (0.55 * Math.sin(t * 11 + x * 0.13) + 0.3 * Math.sin(t * 23 + y * 0.07) + 0.15 * Math.sin(t * 41 + x * 0.31));
}

/** Source de lumière (calque multiply). intensity 0..1+, flicker 0..1. */
export function addLight(x, y, radius, color, intensity = 1, flicker = 0) {
  if (!camera.isVisible(x, y, radius)) return;
  const spr = sprites.get(color) || prepareLight(color);
  const ctx = renderer.getLightCtx();
  const a = intensity * flickerValue(x, y, flicker);
  ctx.globalAlpha = a > 1 ? 1 : a < 0 ? 0 : a;
  ctx.drawImage(spr, x - radius, y - radius, radius * 2, radius * 2);
}

/** Lueur additive (calque screen : braises, projectiles, bronze). */
export function addGlow(x, y, radius, color, intensity = 0.5) {
  if (!camera.isVisible(x, y, radius)) return;
  const spr = sprites.get(color) || prepareLight(color);
  const ctx = renderer.getGlowCtx();
  ctx.globalAlpha = intensity > 1 ? 1 : intensity < 0 ? 0 : intensity;
  ctx.drawImage(spr, x - radius, y - radius, radius * 2, radius * 2);
}

/** Position du halo de la Mesure (le joueur). */
export function setHaloPos(x, y) { haloX = x; haloY = y; }

/** Intensité du halo sur le temps (0..1, typiquement 1 - conductor.phase()). */
export function setBeatPulse(v) { pulse = v > 1 ? 1 : v < 0 ? 0 : v; }

/** Rayon de base du halo (px monde). */
export function setHaloRadius(r) { haloRadius = r; }

/**
 * Halo de bronze au sol : anneau elliptique qui s'élargit et s'éteint sur le temps.
 * À appeler sur le calque principal après le sol (avant les entités).
 */
export function drawBeatHalo(ctx) {
  if (pulse <= 0.01) return;
  const r = haloRadius * (1.35 - 0.35 * pulse);
  ctx.globalAlpha = pulse * 0.8;
  ctx.strokeStyle = haloColor;
  ctx.lineWidth = 1.5 + pulse * 1.5;
  ctx.beginPath();
  ctx.ellipse(haloX, haloY, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = pulse * 0.25;
  ctx.fillStyle = haloColor;
  ctx.beginPath();
  ctx.ellipse(haloX, haloY, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Appelé automatiquement par renderer.endFrame (hook) : avance le vacillement et
 * ajoute la lueur bronze du halo sur le calque screen. Ne pas l'appeler soi-même.
 */
export function updateLighting(dt) {
  flickerT += dt;
  if (pulse > 0.01) addGlow(haloX, haloY, haloRadius * 2.2, haloColor, pulse * 0.35);
}
