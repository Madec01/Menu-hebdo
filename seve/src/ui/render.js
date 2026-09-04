// Rendu du monde. Tout est dessiné à la main en Canvas 2D : aucune image,
// aucun atlas. Les formes sont organiques (courbes, asymétries, oscillations).

import { TILE } from '../game/constants.js';
import { TERRAIN } from '../game/field.js';
import { DEGREE_INFO } from '../game/scales.js';
import { clamp, easeOut, easeBack } from '../core/loop.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, scale: 1 };
    this.t = 0;
    this.particles = [];
    this.quality = 'plein';
    this.shakeAmount = 0;
  }

  resize(width, height, dpr) {
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.dpr = dpr;
  }

  fit(field) {
    const w = this.canvas.width, h = this.canvas.height;
    const fw = field.cols * TILE, fh = field.rows * TILE;
    // Sur un écran bas (téléphone en paysage) on rend les marges au champ.
    const padX = w * 0.06;
    const padY = h * (h < 900 * (this.dpr || 1) ? 0.155 : 0.19);
    const scale = Math.min((w - padX * 2) / fw, (h - padY * 2) / fh);
    this.cam.scale = scale;
    this.cam.x = (w - fw * scale) / 2;
    this.cam.y = (h - fh * scale) / 2 + h * 0.03;
  }

  worldToScreen(x, y) {
    return { x: this.cam.x + x * this.cam.scale, y: this.cam.y + y * this.cam.scale };
  }

  screenToWorld(x, y) {
    return { x: (x - this.cam.x) / this.cam.scale, y: (y - this.cam.y) / this.cam.scale };
  }

  // --- Décor ------------------------------------------------------------------

  drawBackground(biome, healing = 0) {
    const { ctx, canvas } = this;
    const p = biome.palette;
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, p.sky[0]);
    g.addColorStop(1, p.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Collines lointaines : deux couches de bruit sinusoïdal.
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath();
      const baseY = canvas.height * (0.32 + layer * 0.08);
      const amp = canvas.height * (0.05 - layer * 0.015);
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= canvas.width; x += 24) {
        const k = x / canvas.width;
        const y = baseY
          + Math.sin(k * 7 + layer * 2.1 + this.t * 0.04) * amp
          + Math.sin(k * 17 + layer) * amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fillStyle = layer === 0 ? this.shade(p.ground, -0.35) : this.shade(p.ground, -0.2);
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (healing > 0.05) {
      ctx.globalAlpha = healing * 0.15;
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  vignette() {
    const { ctx, canvas } = this;
    const g = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.85,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  shade(color, amount) {
    let r, g, b;
    if (color.startsWith('rgb')) {
      // shade() peut être rappelée sur son propre résultat : on l'accepte.
      const parts = color.match(/-?\d+(\.\d+)?/g) || [0, 0, 0];
      r = +parts[0]; g = +parts[1]; b = +parts[2];
    } else {
      const c = color.replace('#', '');
      const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    }
    if (amount >= 0) {
      r += (255 - r) * amount; g += (255 - g) * amount; b += (255 - b) * amount;
    } else {
      r *= 1 + amount; g *= 1 + amount; b *= 1 + amount;
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }

  // --- Champ -------------------------------------------------------------------

  drawField(field, run) {
    const { ctx } = this;
    const p = field.biome.palette;
    ctx.save();
    ctx.translate(this.cam.x, this.cam.y);
    ctx.scale(this.cam.scale, this.cam.scale);

    // Ombre portée du champ : il flotte légèrement.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    this.roundRect(-10, 14, field.cols * TILE + 20, field.rows * TILE + 20, 26);
    ctx.fill();
    ctx.restore();

    for (const t of field.tiles) this.drawTile(t, p, field);
    for (const t of field.tiles) if (t.plant) this.drawPlant(t, t.plant);
    for (const w of field.waves) this.drawWave(w);

    ctx.restore();
  }

  drawTile(t, palette, field) {
    const { ctx } = this;
    const x = t.c * TILE, y = t.r * TILE;
    if (t.terrain === TERRAIN.VOID) {
      // Un trou dans la canopée : on voit le ciel du dessous, pas un carré noir.
      const g = ctx.createLinearGradient(x, y, x, y + TILE);
      g.addColorStop(0, palette.sky[1]);
      g.addColorStop(1, palette.sky[0]);
      ctx.fillStyle = g;
      this.roundRect(x + 5, y + 5, TILE - 10, TILE - 10, 14);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return;
    }

    let base;
    switch (t.terrain) {
      case TERRAIN.WATER: base = palette.water; break;
      case TERRAIN.STONE: base = this.shade(palette.ground, -0.3); break;
      case TERRAIN.GRASS: base = palette.groundAlt; break;
      default: base = palette.soil;
    }
    // Humidité : la terre fonce quand elle est arrosée.
    const wet = t.terrain === TERRAIN.WATER ? 0 : (1 - t.moisture) * 0.22;
    ctx.fillStyle = this.shade(base, t.tint - wet + (t.bump * 0.12));

    const inset = 3 + t.bump * 2;
    this.roundRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2, 12);
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(x, y, TILE, TILE * 0.22);
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y + TILE * 0.78, TILE, TILE * 0.22);
    ctx.restore();

    if (t.terrain === TERRAIN.WATER || t.submerged) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = this.shade(palette.water, 0.4);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        const yy = y + TILE * (0.35 + i * 0.28) + Math.sin(this.t * 1.6 + t.c + i) * 2.4;
        ctx.moveTo(x + 10, yy);
        ctx.bezierCurveTo(x + TILE * 0.35, yy - 4, x + TILE * 0.65, yy + 4, x + TILE - 10, yy);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (t.fissure) this.drawFissure(t, x, y);
    if (t.echo && !t.echo.found) this.drawEchoHint(x, y);
    if (t.blight > 0.01) this.drawBlight(t, x, y);

    if (t.flash > 0) {
      ctx.globalAlpha = t.flash * 0.5;
      ctx.fillStyle = '#fff6e0';
      this.roundRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2, 12);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawBlight(t, x, y) {
    const { ctx } = this;
    const a = clamp(t.blight, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * 0.82;
    ctx.fillStyle = '#6f6a63';
    this.roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 12);
    ctx.fill();
    // Grain de cendre : des points immobiles, comme de la poussière déposée.
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = '#3a3833';
    const seed = (t.c * 31 + t.r * 17) % 100;
    for (let i = 0; i < 7; i++) {
      const px = x + 10 + ((seed * (i + 3) * 7) % (TILE - 20));
      const py = y + 10 + ((seed * (i + 5) * 11) % (TILE - 20));
      ctx.beginPath();
      ctx.arc(px, py, 1.4 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFissure(t, x, y) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const cx = x + TILE / 2, cy = y + TILE / 2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + t.c * 0.7;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * TILE * 0.3, cy + Math.sin(a) * TILE * 0.3);
    }
    ctx.stroke();
    const pulse = 0.5 + Math.sin(this.t * 2 + t.r) * 0.5;
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = '#e0785e';
    ctx.beginPath();
    ctx.arc(cx, cy, 5 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawEchoHint(x, y) {
    const { ctx } = this;
    const pulse = 0.5 + Math.sin(this.t * 1.5) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.14 + pulse * 0.12;
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.24 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawWave(w) {
    const { ctx } = this;
    const k = w.t / w.life;
    const r = easeOut(k) * w.radius * TILE;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 5 * (1 - k) + 1.5;
    ctx.beginPath();
    ctx.arc((w.col + 0.5) * TILE, (w.row + 0.5) * TILE, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - k) * 0.18;
    ctx.fillStyle = w.color;
    ctx.fill();
    ctx.restore();
  }

  // --- Plantes ------------------------------------------------------------------

  drawPlant(tile, plant) {
    const { ctx } = this;
    const info = DEGREE_INFO[plant.degree];
    const x = tile.c * TILE + TILE / 2;
    const y = tile.r * TILE + TILE * 0.82;
    const grow = plant.ripe ? 1 : 0.25 + plant.growth * 0.75;
    const pop = plant.pop > 0 ? 1 + easeBack(1 - plant.pop) * 0.0 + plant.pop * 0.22 : 1;
    const sway = Math.sin(this.t * 1.6 + plant.phase) * (0.05 + grow * 0.05);
    const h = TILE * 0.62 * grow * plant.scale * pop;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(plant.lean * 0.35 + sway);

    if (plant.wilted) { ctx.globalAlpha = 0.45; ctx.rotate(0.6); }

    // Halo de maturité.
    if (plant.ripe && !plant.wilted) {
      const pulse = 0.5 + Math.sin(this.t * 3 + plant.phase) * 0.5;
      ctx.globalAlpha = 0.16 + pulse * 0.12;
      ctx.fillStyle = info.glow;
      ctx.beginPath();
      ctx.arc(0, -h * 0.55, h * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = plant.wilted ? 0.45 : 1;
    }

    const stem = plant.wilted ? '#7a6f5f' : this.shade(info.color, -0.45);
    ctx.strokeStyle = stem;
    ctx.lineWidth = 3.2 * Math.min(1.4, grow + 0.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(h * 0.12, -h * 0.5, plant.lean * h * 0.2, -h);
    ctx.stroke();

    const color = plant.wilted ? '#8a7d6a' : info.color;
    const glow = plant.wilted ? '#a2947f' : info.glow;
    const tipX = plant.lean * h * 0.2, tipY = -h;

    switch (plant.sp.shape) {
      case 'bulbe': this.shapeBulbe(tipX, tipY, h, grow, color, glow, plant); break;
      case 'tige': this.shapeTige(tipX, tipY, h, grow, color, glow, plant); break;
      case 'ombelle': this.shapeOmbelle(tipX, tipY, h, grow, color, glow, plant); break;
      case 'fougere': this.shapeFougere(tipX, tipY, h, grow, color, glow, plant); break;
      default: this.shapeClochette(tipX, tipY, h, grow, color, glow, plant);
    }

    // Compteur de flétrissure : la plante s'assombrit sur la fin.
    if (plant.ripe && !plant.wilted) {
      const left = 1 - clamp(plant.ripeAge / plant.sp.wilt, 0, 1);
      if (left < 0.35) {
        ctx.globalAlpha = (0.35 - left) * 1.6;
        ctx.fillStyle = '#6f6a63';
        ctx.beginPath();
        ctx.arc(tipX, tipY, h * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  shapeBulbe(x, y, h, grow, color, glow) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, h * 0.28, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x - h * 0.08, y - h * 0.1, h * 0.1, h * 0.13, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  shapeTige(x, y, h, grow, color, glow, plant) {
    const { ctx } = this;
    ctx.fillStyle = color;
    for (let i = 0; i < plant.leaves; i++) {
      const a = -Math.PI / 2 + (i - plant.leaves / 2) * 0.5;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * h * 0.16, y + Math.sin(a) * h * 0.16,
        h * 0.2, h * 0.075, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, h * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  shapeOmbelle(x, y, h, grow, color, glow, plant) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i / (n - 1)) * Math.PI;
      const ex = x + Math.cos(a) * h * 0.3;
      const ey = y + Math.sin(a) * h * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ex, ey, h * 0.065, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  shapeFougere(x, y, h, grow, color, glow, plant) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.1);
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        ctx.lineTo(x + s * Math.sin(k * 2.2) * h * 0.34, y + h * 0.1 - k * h * 0.4);
      }
      ctx.stroke();
    }
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - h * 0.28, h * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  shapeClochette(x, y, h, grow, color, glow, plant) {
    const { ctx } = this;
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * h * 0.2;
      const oy = y + Math.abs(i - 1) * h * 0.1;
      ctx.beginPath();
      ctx.moveTo(x + ox, oy - h * 0.1);
      ctx.quadraticCurveTo(x + ox - h * 0.15, oy + h * 0.18, x + ox, oy + h * 0.24);
      ctx.quadraticCurveTo(x + ox + h * 0.15, oy + h * 0.18, x + ox, oy - h * 0.1);
      ctx.fill();
    }
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - h * 0.12, h * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Utilitaires -------------------------------------------------------------

  roundRect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
