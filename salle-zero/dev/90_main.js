/* =========================================================================
   SALLE ZÉRO — 90_main.js — point d'entrée, boucle update/render.
   ========================================================================= */

function update(dt, rawDt) {
  UI.update(rawDt);
  if (G.state === 'run') Run.update(dt);
}
function render(ctx) {
  ctx.setTransform(ctx.getTransform());
  if (G.state === 'run' && G.room) {
    ctx.save();
    if (G.shake > 0) ctx.translate(VFX_RNG.range(-G.shake, G.shake), VFX_RNG.range(-G.shake, G.shake));
    Room.render(ctx);
    Pickups.render(ctx);
    const ents = G.enemies.slice().sort((a, b) => a.y - b.y); for (const e of ents) e.render(ctx);
    G.player.render(ctx);
    Projectiles.render(ctx); Room.renderFx(ctx); Particles.render(ctx); Floaters.render(ctx);
    ctx.restore();
    UI.renderHud(ctx); Debug.renderOverlay(ctx);
  } else UI.renderBackdrop(ctx);
  UI.renderToasts(ctx); UI.renderFade(ctx);
}
async function boot() {
  const canvas = document.getElementById('c');
  Engine.init(canvas);
  Meta.load(); Content.validate();
  Input.attach(canvas, () => { AudioEngine.init(); AudioEngine.setVolume(Meta.profile.volume); Music.restart(); });
  document.addEventListener('pointerdown', () => { AudioEngine.init(); AudioEngine.resume && AudioEngine.resume(); AudioEngine.setVolume(Meta.profile.volume); Music.restart(); }, { once: true });
  UI.init(); Debug.init();
  await Sprites.load();
  UI.showMenu();
  Engine.start(update, render);
  window.__autoplay = Debug.autoplay;
  window.__G = G;
}
window.addEventListener('DOMContentLoaded', boot);
