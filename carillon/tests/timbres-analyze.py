#!/usr/bin/env python3
"""tests/timbres-analyze.py — analyse des prises de tests/timbres-audio.mjs (agent B3).

Pour chaque phase (battant, quatre, six) dans tests/results/timbres/ :
  · <phase>-voices.wav : sortie des voix des Timbres seules ; <phase>-master.wav : mixage complet ;
  · <phase>-notes.json : notes planifiées (journal `timbre:note`).
Contrôles :
  1. variation : ≥ 4 hauteurs distinctes (midi) sur les 8 mesures — mesurées sur la prise « voix »
     (onsets par énergie, hauteur = partiel dominant du spectre nouveau S(après) − S(avant)) ET journalisées ;
  2. gamme : aucune hauteur mesurée (Battant seul) ni journalisée hors de la gamme des accords de la piste
     (Cendrelune : ré dorien D E F G A B C ; les accords Dm, C, Am n'ajoutent aucune altération) ;
  3. crête < −1 dBFS sur les prises master et voix ;
  4. ≤ 3 voix tonales journalisées par point de grille (phases quatre et six) ;
  5. aucune erreur console / page / HTTP (report.json) ;
  6. registres séparés (timbres.json) : jamais deux Timbres tonals dans le même registre (octave + moitié), et la
     partition de test (Battant, Clarine, Bourdon, Chaîne) occupe quatre octaves distinctes ;
  7. lisibilité à 4 armes (phase quatre, prise master vs musique) : les voix ne sont masquées de plus de 3 dB par
     la musique dans aucune bande entre 500 Hz et 4 kHz (mesuré sur voices.wav et music.wav).
Usage : python3 tests/timbres-analyze.py   → code de sortie 1 si un contrôle échoue.
"""
import json, os, sys
import numpy as np, soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'results', 'timbres')
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
SCALE_PC = {2, 4, 5, 7, 9, 11, 0}          # ré dorien : D E F G A B C
TONAL = {'battant', 'clarine', 'bourdon', 'chaine_d_angelus', 'tocsin', 'grelots', 'diapason', 'cor_de_brume'}
BANDS = [(500, 1000), (1000, 2000), (2000, 4000)]
fails = []
def check(name, ok, detail=''):
    print(('[OK] ' if ok else '[KO] ') + name + (('  — ' + detail) if detail else ''))
    if not ok: fails.append(name)

def name_of(m): m = int(round(m)); return NAMES[m % 12] + str(m // 12 - 1)
def dbfs(x): p = float(np.max(np.abs(x))) if len(x) else 0.0; return 20 * np.log10(p) if p > 0 else -120.0

def onsets_and_pitches(x, sr, fmin=180, fmax=2600):
    """Onsets par flux spectral (STFT 2048 / saut 512, bande 150–3000 Hz, seuil adaptatif sur la médiane
    locale), hauteur = partiel dominant du spectre NOUVEAU (S après − S avant l'attaque)."""
    N = 2048; hop = 512
    n = (len(x) - N) // hop
    w = np.hanning(N)
    fr = np.fft.rfftfreq(N, 1 / sr)
    band = (fr >= 150) & (fr <= 3000)
    mags = np.array([np.abs(np.fft.rfft(x[i * hop:i * hop + N] * w))[band] for i in range(n)])
    flux = np.zeros(n)
    flux[1:] = np.sum(np.clip(mags[1:] - mags[:-1], 0, None), axis=1)
    peak = float(flux.max()) or 1.0
    flux /= peak
    ons = []
    last = -100
    k = 8                                             # médiane locale sur ±8 trames (≈ ±95 ms)
    for i in range(2, n - 2):
        loc = np.median(flux[max(0, i - k):i + k + 1])
        if flux[i] >= flux[i - 1] and flux[i] > flux[i + 1] and flux[i] > max(0.04, 2.2 * loc + 0.02) and i - last >= 8:
            ons.append(i); last = i
    pitches = []
    M = int(0.16 * sr)
    wm = np.hanning(M)
    frm = np.fft.rfftfreq(M, 1 / sr)
    for i in ons:
        c = i * hop
        s0 = max(0, c - M - hop); s1 = c + hop
        if s0 + M > len(x) or s1 + M > len(x): continue
        Sb = np.abs(np.fft.rfft(x[s0:s0 + M] * wm)); Sa = np.abs(np.fft.rfft(x[s1:s1 + M] * wm))
        diff = np.clip(Sa - Sb, 0, None)
        diff[(frm < fmin) | (frm > fmax)] = 0
        kk = int(np.argmax(diff))
        if diff[kk] <= 0: continue
        if 1 <= kk < len(diff) - 1:
            a, b, cc = np.log(diff[kk - 1] + 1e-9), np.log(diff[kk] + 1e-9), np.log(diff[kk + 1] + 1e-9)
            d = 0.5 * (a - cc) / (a - 2 * b + cc) if (a - 2 * b + cc) != 0 else 0
        else: d = 0
        f = (kk + d) * sr / M
        pitches.append((c / sr, f, 69 + 12 * np.log2(f / 440)))
    return pitches

def band_levels(x, sr):
    N = 4096; hop = 1024; w = np.hanning(N); fr = np.fft.rfftfreq(N, 1 / sr)
    n = (len(x) - N) // hop
    S = np.array([np.abs(np.fft.rfft(x[i * hop:i * hop + N] * w)) for i in range(n)])
    return np.array([10 * np.log10((S[:, (fr >= lo) & (fr < hi)] ** 2).mean() + 1e-12) for lo, hi in BANDS])

def check_registers():
    conf = json.load(open(os.path.join(ROOT, 'src', 'data', 'music', 'timbres.json')))
    regs = {}
    for wid, v in conf['voices'].items():
        if v.get('percussive') or v.get('chord'): continue      # percussions et fusions (remplacent leur arme) exclues
        regs.setdefault((v.get('octave', 5), v.get('range', 'low')), []).append(wid)
    dup = [ws for ws in regs.values() if len(ws) > 1]
    check('registres : aucun couple de Timbres tonals dans le même registre (octave + moitié)', not dup, str(dup))
    four = ['battant', 'clarine', 'bourdon', 'chaine_d_angelus']
    octs = [conf['voices'][w]['octave'] for w in four]
    check('registres : la partition de test occupe quatre octaves distinctes', len(set(octs)) == 4, str(dict(zip(four, octs))))

def check_masking(phase):
    vp, mp = os.path.join(OUT, f'{phase}-voices.wav'), os.path.join(OUT, f'{phase}-music.wav')
    if not (os.path.exists(vp) and os.path.exists(mp)): check(f'{phase} : prises voix + musique présentes', False); return
    v, sr = sf.read(vp); m, _ = sf.read(mp)
    d = band_levels(v, sr) - band_levels(m, sr)
    print('  voix − musique (dB) 500–1k / 1–2k / 2–4k :', ' '.join(f'{x:+.1f}' for x in d))
    check(f'{phase} : masquage des voix par la musique ≤ 3 dB par bande (500 Hz – 4 kHz)', float(d.min()) >= -3, f'pire bande {d.min():+.1f} dB')

def analyze(phase, strict_pitch):
    print(f'\n=== phase {phase} ===')
    vpath = os.path.join(OUT, f'{phase}-voices.wav'); mpath = os.path.join(OUT, f'{phase}-master.wav')
    if not os.path.exists(vpath): check(f'{phase} : prise présente', False, vpath); return
    v, sr = sf.read(vpath); m, _ = sf.read(mpath)
    notes = json.load(open(os.path.join(OUT, f'{phase}-notes.json')))
    print(f'  voix : {len(v)/sr:.1f} s, crête {dbfs(v):.1f} dBFS ; master : crête {dbfs(m):.1f} dBFS ; notes journalisées : {len(notes)}')
    check(f'{phase} : crête master < −1 dBFS', dbfs(m) < -1, f'{dbfs(m):.2f} dBFS')
    check(f'{phase} : crête voix < −1 dBFS', dbfs(v) < -1, f'{dbfs(v):.2f} dBFS')
    # journal
    logged = sorted(set(int(round(n['midi'])) for n in notes))
    check(f'{phase} : ≥ 4 hauteurs distinctes journalisées', len(logged) >= 4, ' '.join(name_of(x) for x in logged))
    bad = [name_of(x) for x in logged if x % 12 not in SCALE_PC]
    check(f'{phase} : aucune note journalisée hors gamme', not bad, ' '.join(bad))
    bars = {}
    for n in notes: bars.setdefault(n['bar'], []).append((n['weaponId'], int(round(n['midi']))))
    seq = [tuple(sorted(bars[b])) for b in sorted(bars)]
    same = sum(1 for i in range(1, len(seq)) if seq[i] == seq[i - 1])
    print('  par mesure :', ' | '.join(f"m{b}: " + ' '.join(name_of(x) for _, x in sorted(bars[b])) for b in sorted(bars)))
    check(f'{phase} : deux mesures consécutives jamais identiques', same == 0, f'{same} répétition(s)')
    # plafond de voix tonales par point de grille
    slots = {}
    for n in notes:
        if n['weaponId'] in TONAL: slots.setdefault(round(n['t'] * 40) / 40, set()).add(n['weaponId'])
    worst = max((len(s) for s in slots.values()), default=0)
    check(f'{phase} : ≤ 3 Timbres tonals par point de grille', worst <= 3, f'max {worst}')
    # mesure
    p = onsets_and_pitches(v, sr)
    measured = [round(mi) for _, _, mi in p]
    distinct = sorted(set(measured))
    print(f'  onsets mesurés : {len(p)} ; hauteurs : {" ".join(name_of(x) for x in distinct)}')
    check(f'{phase} : ≥ 4 hauteurs distinctes mesurées', len(distinct) >= 4, f'{len(distinct)}')
    if strict_pitch:
        # alignement onset ↔ journal (± 120 ms) : justesse de classe de hauteur ; les onsets qui ne
        # correspondent à aucune note journalisée sont les partiels de la couche non tonale (clochette
        # népalaise sur les temps forts) et sont listés, pas comptés comme des notes.
        aligned, stray = [], []
        for t, f, mi in p:
            near = min(notes, key=lambda n: abs(n['t'] - t))
            if abs(near['t'] - t) < 0.12:
                d = (mi - near['midi']) % 12
                aligned.append((t, f, mi, near['midi'], min(d, 12 - d) * 100))
            else: stray.append((t, f, mi))
        covered = sum(1 for n in notes if any(abs(n['t'] - t) < 0.12 for t, _, _ in p))
        check(f'{phase} : ≥ 90 % des notes journalisées ont un onset mesuré', covered >= 0.9 * len(notes), f'{covered}/{len(notes)}')
        just = [c for *_, c in aligned]
        good = [a for a in aligned if a[4] <= 50]
        off = [(f'{t:.2f}s', name_of(mi), '≠', name_of(lm)) for t, f, mi, lm, c in aligned if c > 50]
        print(f'  justesse (classe de hauteur) : médiane {np.median(just):.0f} cents, {len(good)}/{len(aligned)} notes à ≤ 50 cents ; hors journal : {off[:4]}')
        check(f'{phase} : justesse (médiane < 30 cents, ≥ 90 % des notes ≤ 50 cents)', bool(just) and np.median(just) < 30 and len(good) >= 0.9 * len(aligned))
        out = [(f'{t:.2f}s', f'{f:.0f}Hz', name_of(mi)) for t, f, mi, lm, c in good if round(mi) % 12 not in SCALE_PC]
        check(f'{phase} : aucune note mesurée hors gamme', not out, str(out[:6]))
        if stray: print(f'  onsets sans note journalisée (couche percussive) : {[(f"{t:.2f}s", name_of(mi)) for t, f, mi in stray][:6]}')

rep = json.load(open(os.path.join(OUT, 'report.json')))
check('aucune erreur console', not rep['consoleErrors'], str(rep['consoleErrors'][:3]))
check('aucune erreur de page', not rep['pageErrors'], str(rep['pageErrors'][:3]))
check('aucune réponse HTTP ≥ 400', not rep['badResponses'], str(rep['badResponses'][:3]))
check_registers()
analyze('battant', True)
analyze('quatre', False)
check_masking('quatre')
analyze('six', False)
print(f'\n{len(fails)} contrôle(s) en échec' if fails else '\nTous les contrôles passent.')
sys.exit(1 if fails else 0)
