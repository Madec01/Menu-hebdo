// tests/stubs/hooks.mjs — hook de résolution ES (node:module.register) : redirige les modules
// navigateur (input, audio, conducteur, sfx, timbres, musique, atlas, lumière, particules, fx) vers les stubs de ce
// dossier. Tout le reste (core/events, pool, grid, rng, save, render/camera, game/**) est réel.
const MAP = {
  'src/core/input.js': 'input.js', 'src/audio/audio.js': 'audio.js', 'src/audio/conductor.js': 'conductor.js',
  'src/audio/sfx.js': 'sfx.js', 'src/render/atlas.js': 'atlas.js', 'src/render/lighting.js': 'lighting.js',
  'src/render/particles.js': 'particles.js', 'src/render/fx.js': 'fx.js',
  'src/audio/timbres.js': 'timbres.js', 'src/audio/music.js': 'music.js',
};
export async function resolve(specifier, context, next) {
  const r = await next(specifier, context);
  for (const k in MAP) if (r.url.endsWith('/' + k)) return { url: new URL('./' + MAP[k], import.meta.url).href, format: 'module', shortCircuit: true };
  return r;
}
