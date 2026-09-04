#!/usr/bin/env python3
"""Assemble CREDITS.md à partir de assets/CREDITS-visual.md et assets/audio/CREDITS-audio.md.

Ajoute en tête un tableau récapitulatif tiré des sections `credits` des deux manifestes,
puis vérifie que chaque fichier d'asset présent sur le disque est référencé par un manifeste.
Usage : python3 tools/assemble_credits.py   (depuis carillon/)
"""
import json, os, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)

vis = load('assets/manifest.json')
aud = load('assets/audio/manifest.json')

# --- Tableau récapitulatif des sources ---
rows = []
for scope, m in (('visuel', vis), ('audio', aud)):
    for key, c in m.get('credits', {}).items():
        authors = c.get('authors') or c.get('author') or ''
        if isinstance(authors, list):
            authors = ', '.join(authors)
        rows.append((scope, key, c.get('title', ''), authors, c.get('license', ''), c.get('downloadedFrom') or c.get('source', '')))

# --- Fichiers référencés par les manifestes ---
referenced = set()
def add(p):
    if isinstance(p, str):
        referenced.add(os.path.normpath(os.path.join('assets', p)))
for sec in ('sprites', 'tiles', 'ui', 'fonts'):
    for v in vis.get(sec, {}).values():
        add(v.get('file'))
for v in aud.get('sfx', {}).values():
    for p in v.get('files', []):
        add(p)
for v in aud.get('samples', {}).values():
    files = v.get('files', {})
    for p in files.values():
        if isinstance(p, list):
            for q in p: add(q)
        else:
            add(p)
for v in aud.get('tracks', {}).values():
    add(v.get('file'))

on_disk = set()
for base in ('assets/sprites', 'assets/tiles', 'assets/ui', 'assets/fonts', 'assets/audio/sfx', 'assets/audio/samples', 'assets/audio/music'):
    for d, _, fs in os.walk(base):
        for f in fs:
            if f.lower().endswith(('.png', '.ogg', '.ttf', '.otf', '.woff2')):
                on_disk.add(os.path.normpath(os.path.join(d, f)))

orphans = sorted(on_disk - referenced)
missing = sorted(referenced - on_disk)

# --- Écriture ---
out = ['# CRÉDITS — CARILLON', '',
       'Chaque fichier d\'asset du jeu est listé ci-dessous avec son auteur, sa licence, la preuve de licence',
       'et l\'URL réellement utilisée pour le téléchargement. Les sprites sont utilisés tels quels ou recolorisés ;',
       'les sons sont convertis en OGG Vorbis et parfois superposés, inversés, transposés ou filtrés.',
       '', f'Assemblé le {datetime.date.today().isoformat()} par `tools/assemble_credits.py` depuis',
       '`assets/CREDITS-visual.md` et `assets/audio/CREDITS-audio.md` (sources de vérité, à modifier plutôt que ce fichier).',
       '', '## Récapitulatif des sources', '',
       '| Domaine | Clé | Source | Auteur(s) | Licence | Téléchargé depuis |', '|---|---|---|---|---|---|']
for r in rows:
    out.append('| ' + ' | '.join(str(x).replace('|', '\\|') for x in r) + ' |')
out += ['', '---', '', '# Partie 1 — Assets visuels', '']
out.append(open('assets/CREDITS-visual.md', encoding='utf-8').read())
out += ['', '---', '', '# Partie 2 — Assets audio', '']
out.append(open('assets/audio/CREDITS-audio.md', encoding='utf-8').read())
with open('CREDITS.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out) + '\n')

print(f'CREDITS.md écrit : {len(rows)} sources, {len(referenced)} fichiers référencés, {len(on_disk)} sur disque.')
if orphans:
    print('FICHIERS SANS RÉFÉRENCE (à créditer ou supprimer) :'); [print('  ', p) for p in orphans]
if missing:
    print('FICHIERS RÉFÉRENCÉS MAIS ABSENTS :'); [print('  ', p) for p in missing]
sys.exit(1 if (orphans or missing) else 0)
