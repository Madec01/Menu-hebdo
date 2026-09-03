/* ---------- tutoriel guidé & codex ---------- */
const Tutorial = (() => {
  const STEPS = [
    { id: 'move', t: 'Déplace-toi', h: 'ZQSD, WASD ou flèches sur PC. Sur téléphone, glisse le pouce gauche n\'importe où à gauche.' },
    { id: 'shoot', t: 'Touche un ennemi', h: 'Le tir part tout seul vers l\'ennemi le plus proche. Souris pour viser sur PC, pouce droit sur téléphone.' },
    { id: 'dash', t: 'Fais un dash', h: 'Espace ou Maj sur PC, bouton DASH sur téléphone. Invulnérable pendant le dash, et il passe au-dessus des gouffres.' },
    { id: 'cleared', t: 'Nettoie une salle', h: 'Tue tout ce qui bouge : les portes s\'ouvrent. La carte en haut à droite montre les salles voisines.' },
    { id: 'relic', t: 'Prends une relique', h: 'Le coffre est jaune sur la carte, le boss rouge. Chaque relique s\'ajoute aux autres, pour toute la descente.' },
    { id: 'cross', t: 'Traverse le Voile', h: 'Tuer remplit le Voile violet. Une salle à contour violet sur la carte est scellée : son coffre n\'est atteignable que par l\'Envers. Va à la fissure voisine (point violet) et appuie sur V, Ctrl ou ◐.' },
    { id: 'crossBack', t: 'Reviens de l\'Envers', h: 'Dans l\'Envers, la porte scellée est ouverte et l\'essence vaut double, mais le Voile se vide. Ouvre le coffre, puis reviens par une fissure ou tue des Reflets pour tenir.' },
    { id: 'surge', t: 'Déclenche la Surcharge', h: 'Chaque kill remplit la jauge dorée. Quand elle est pleine : E, clic droit ou ⚡. Enchaîne les kills pour un combo.' },
    { id: 'oath', t: 'Prête un serment (étage 2)', h: 'À chaque étage, une contrainte contre une récompense. Tu peux aussi refuser.' },
  ];
  const T = { doneT: 0, hinted: -1, done: new Set(), flashT: 0 };
  const active = () => !save.tutorialDone && state === 'play' && G;
  const step = () => STEPS[clamp(save.tutorialStep || 0, 0, STEPS.length - 1)];
  function event(name) {
    if (save.tutorialDone) return;
    T.done.add(name);
    if (T.doneT > 0) return;
    if (step().id === name) { T.doneT = 1.5; SFX('coin'); }
  }
  function update(dt) {
    if (!active()) return;
    const s = step();
    if (T.hinted !== save.tutorialStep) { T.hinted = save.tutorialStep; hint = { t: s.h, life: 8 }; T.flashT = 1; }
    if (T.flashT > 0) T.flashT -= dt;
    if (T.doneT <= 0 && T.done.has(s.id)) T.doneT = 1.5;
    if (T.doneT > 0) {
      T.doneT -= dt;
      if (T.doneT <= 0) {
        save.tutorialStep = (save.tutorialStep || 0) + 1;
        if (save.tutorialStep >= STEPS.length) { save.tutorialDone = true; hint = { t: 'Tutoriel terminé. Le Codex (menu pause) rappelle tout le reste.', life: 6 }; }
        writeSave();
      }
    }
  }
  function draw() {
    if (!active()) return;
    const s = step(), done = T.doneT > 0, idx = (save.tutorialStep || 0) + 1;
    const F = '"Nunito", system-ui, sans-serif';
    const boss = enemies.some(e => e.boss && !e.dead), envers = G.world === 'envers';
    const y = 14 + SA.t + (boss ? 34 : 0) + (envers ? 40 : 0) + 6;
    ctx.font = 'bold 12px ' + F; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const label = idx + '/' + STEPS.length + '  ' + s.t;
    const tw = ctx.measureText(label).width, w = tw + 44, x = W / 2 - w / 2;
    ctx.fillStyle = done ? 'rgba(40,90,50,0.75)' : 'rgba(10,10,18,0.7)'; ctx.fillRect(x, y, w, 26);
    ctx.strokeStyle = done ? '#8fe388' : (T.flashT > 0 && Math.floor(T.flashT * 8) % 2 === 0) ? '#ffd97a' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 25);
    ctx.strokeStyle = done ? '#8fe388' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x + 10, y + 7, 12, 12);
    if (done) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 12, y + 13); ctx.lineTo(x + 15.5, y + 17); ctx.lineTo(x + 21, y + 9); ctx.stroke(); }
    ctx.fillStyle = done ? '#dfffe0' : '#ece6d8'; ctx.fillText(label, x + 30, y + 13);
  }
  function skip() { save.tutorialDone = true; writeSave(); }
  function reset() { save.tutorialDone = false; save.tutorialStep = 0; T.done.clear(); T.hinted = -1; writeSave(); }
  return { event, update, draw, skip, reset };
})();
function drawTutorial() { Tutorial.draw(); }

/* ---------- codex ---------- */
OVS.push('codex');
const CODEX = {
  controles: { t: 'Contrôles', h: `<p><b>PC :</b> <kbd>ZQSD</kbd> / <kbd>WASD</kbd> / flèches pour bouger. Souris pour viser et clic gauche pour tirer ; sans souris, la visée est automatique. <kbd>Espace</kbd> ou <kbd>Maj</kbd> : dash. <kbd>E</kbd> ou clic droit : Surcharge. <kbd>V</kbd> ou <kbd>Ctrl</kbd> : traverser le Voile. <kbd>P</kbd> : pause.</p>
<p><b>Téléphone :</b> glisse à gauche pour bouger, à droite pour viser et tirer (sinon tir automatique). Boutons DASH, ⚡ Surcharge, ◐ traversée.</p>
<p>Le dash rend invulnérable un instant et passe au-dessus des gouffres et de la lave. Les coffres, autels, marchands et stèles se déclenchent en marchant dessus.</p>` },
  salles: { t: 'Salles et carte', h: `<p>Chaque étage est un ensemble de salles. Les portes se ferment à l'entrée d'une salle habitée et s'ouvrent quand tout est mort. Le <b>boss</b> (rouge sur la carte) garde l'escalier vers l'étage suivant ; il offre une relique.</p>
<p><b>Coffre</b> (jaune) : une relique parmi trois. <b>Marchand</b> (vert) : reliques, cœurs et armes contre de l'essence. <b>Autel</b> (violet) : sacrifice d'un cœur pour une relique, offrande de 15 ◆ pour un soin, ou prière au hasard. <b>Épreuve</b> (orange) : trois vagues pour une relique parmi quatre. <b>Armurerie</b> (bleu) : changer d'arme. <b>Stèles</b> : fragments du récit, conservés entre les parties.</p>
<p>Terrain : l'eau et la boue ralentissent, le poison et la lave blessent en restant dessus, la glace fait glisser, les piques sortent du sol par vagues (un dash les évite), les gouffres font tomber (retour au dernier sol sûr, un demi-cœur perdu).</p>
<p>Douze biomes se succèdent, deux étages chacun, chacun avec ses dangers, ses créatures, son boss et ses deux musiques : Catacombes, Forêt des Racines, Jardin Suspendu, Marais Putride, Ossuaire, Grotte Fongique, Forge Ardente, Gorges des Cascades, Grottes de Cristal, Cavernes de Givre, Cité Noyée, Abîme.</p>` },
  voile: { t: 'Voile et Envers', h: `<p>Tuer remplit le <b>Voile</b> (jauge violette). Près d'une <b>fissure</b> (point violet sur la carte, une dans chaque salle de boss), traverser coûte 30 ; ailleurs 70. Il te reste toujours au moins 12 après une traversée.</p>
<p>Dans <b>l'Envers</b>, le Voile se vide de 4 par seconde. À zéro, tu es rejeté avec un demi-cœur en moins. Revenir par une fissure est gratuit, ailleurs 25. Tuer des <b>Reflets</b> recharge le Voile, et disperser tous les Reflets d'une salle rend 15. L'essence y vaut double. La Menace n'y monte pas, mais le Traqueur y vient au bout d'une trentaine de secondes.</p>
<p>Là-bas, les murs intérieurs sont des ombres traversables, les gouffres des ponts, l'eau de la glace. Les <b>salles scellées</b> (contour violet) ne s'ouvrent que depuis l'Envers, puis le sceau se brise. Les <b>glyphes</b> révèlent le chemin sûr d'un champ de gouffres. Les <b>leviers</b> de l'Envers effacent un mur du monde de pierre. Les <b>boss</b> se voilent à mi-vie à partir de l'étage 2 : seul leur reflet peut être frappé. Ton <b>écho</b> attend à l'étage de ta dernière mort, dans l'Envers de la salle de départ, avec une relique.</p>` },
  serments: { t: 'Serments et Menace', h: `<p>À partir de l'étage 2, on te propose deux <b>serments</b> : une contrainte pour l'étage contre une récompense (essence, dégâts, relique bonus après le boss). Refuser est toujours possible. Le serment du miroir fait commencer l'étage dans l'Envers avec le Voile plein.</p>
<p>La <b>Menace</b> (cercle en haut à droite) monte avec le temps passé sur l'étage. Pleine, elle fait apparaître le <b>Traqueur</b>, un spectre rouge qui traverse les murs et te suit de salle en salle. Le vaincre rapporte de l'essence et repousse la Menace. La bénédiction Patience la ralentit.</p>` },
  combo: { t: 'Combo et Surcharge', h: `<p>Des kills rapprochés forment un <b>combo</b> : chaque niveau augmente l'essence ramassée et la vitesse de remplissage du Voile. Être touché brise le combo.</p>
<p>La <b>Surcharge</b> (jauge dorée) se remplit à chaque kill. Pleine, elle déclenche une explosion de projectiles qui efface les tirs ennemis, puis quatre secondes de cadence doublée et de dégâts augmentés.</p>
<p><b>Armes :</b> baguette (rapide), arc (lent, perforant), lames (corps à corps, parent les projectiles), orbe (explosions en zone), sceptre (éclairs en chaîne). Élites : des ennemis à aura, plus dangereux, plus généreux.</p>` },
  reliques: { t: 'Reliques et Sanctuaire', h: `<p>Les <b>reliques</b> se cumulent pendant une descente et disparaissent à la mort. Quatre reliques propres à l'Envers se trouvent dans les coffres de l'autre côté.</p>
<p>L'<b>essence</b> ◆ ramassée est conservée. Au <b>Sanctuaire</b> : bénédictions permanentes (cœurs, dégâts, vitesse, essence, Surcharge de départ, relique de départ, Patience, Voile ample), armes à débloquer comme arme de départ, et le <b>bestiaire</b> : vingt-cinq ennemis d'un type vaincus donnent 5 % de dégâts contre lui, jusqu'à 25 %.</p>
<p>Mourir n'efface pas tout : la crypte se souvient. L'essence remonte, le bestiaire progresse, et ton écho garde une relique.</p>` },
};
let codexReturn = 'menu';
function openCodex(from) {
  codexReturn = from; SFX('click');
  const tabs = $('codexTabs'); tabs.innerHTML = '';
  const showTab = k => { for (const el of tabs.children) el.classList.toggle('on', el.dataset.k === k); $('codexBody').innerHTML = CODEX[k].h; };
  for (const k in CODEX) { const d = document.createElement('div'); d.className = 'tab'; d.dataset.k = k; d.textContent = CODEX[k].t; d.addEventListener('click', () => { SFX('click'); showTab(k); }); tabs.appendChild(d); }
  showTab('controles');
  show('codex');
}
$('codexBtn').addEventListener('click', () => { uiAudio(); openCodex('menu'); });
$('codexBtn2').addEventListener('click', () => openCodex('pause'));
$('codexBack').addEventListener('click', () => { SFX('click'); if (codexReturn === 'pause') show('pause'); else goMenu(); });
$('skipTutBtn').addEventListener('click', () => { Tutorial.skip(); SFX('click'); $('skipTutBtn').textContent = 'Tutoriel passé'; });
$('redoTutBtn').addEventListener('click', () => { Tutorial.reset(); SFX('click'); $('redoTutBtn').textContent = 'Tutoriel réactivé'; });
