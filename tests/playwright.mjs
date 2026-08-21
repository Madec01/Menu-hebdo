/* Playwright n'est pas une dépendance du projet : le jeu est un fichier HTML
   autonome. On le cherche là où il se trouve, et on explique s'il manque. */
let mod = null;
for (const chemin of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs",
                      "/usr/lib/node_modules/playwright/index.mjs"]){
  try { mod = await import(chemin); break; } catch (e){ /* on essaie le suivant */ }
}
if (!mod){
  console.error("\n  Playwright est introuvable.\n" +
                "  Installez-le puis relancez :  npm install -g playwright && npx playwright install chromium\n");
  process.exit(2);
}
export const chromium = mod.chromium;
