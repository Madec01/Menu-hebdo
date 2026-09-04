// render/fonts.js — chargement des polices locales du manifeste via FontFace.
// Familles : CarillonDisplay (gothique adoucie), CarillonUi (pixel), CarillonUiAlt.
// loadFonts(manifest, baseUrl) → Promise ; résout même si une police échoue
// (avertissement console) pour ne jamais bloquer le démarrage.

const loaded = new Map(); // famille → FontFace

/**
 * @param {object} manifest  assets/manifest.json parsé (clé `fonts`)
 * @param {string} baseUrl   dossier des assets (défaut 'assets/')
 */
export async function loadFonts(manifest, baseUrl = 'assets/') {
  const fonts = manifest && manifest.fonts ? manifest.fonts : {};
  const jobs = [];
  for (const key of Object.keys(fonts)) {
    const def = fonts[key];
    if (!def || !def.file || !def.family || loaded.has(def.family)) continue;
    const face = new FontFace(def.family, `url("${baseUrl + def.file}")`);
    loaded.set(def.family, face);
    jobs.push(face.load().then((f) => { document.fonts.add(f); return f; })
      .catch((e) => { console.warn('[fonts] police non chargée', def.family, e); loaded.delete(def.family); }));
  }
  await Promise.all(jobs);
  // Force le rendu réel des glyphes (évite le repli sur la police système au 1er fillText).
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
}

/** Vrai si la famille est disponible. */
export function hasFont(family) { return loaded.has(family); }

/** Chaîne CSS prête pour ctx.font, avec repli. */
export function font(family, sizePx, weight = '') {
  const fallback = family === 'CarillonDisplay' ? 'serif' : 'monospace';
  return `${weight ? weight + ' ' : ''}${sizePx}px "${family}", ${fallback}`;
}
