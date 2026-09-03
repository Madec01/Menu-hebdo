#!/usr/bin/env python3
"""Génère la planche de sprites pixel-art de Crypte Infinie (src/assets/sprites.png + sprites.json).

Chaque sprite est décrit en ASCII : un caractère par pixel, '.' = transparent.
`mirror=True` : seules les colonnes de gauche sont données, la droite est un miroir.
Les variantes recolorent un sprite de base (imp = chauve-souris orange, etc.).
"""
import json, os, sys
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets')
os.makedirs(OUT, exist_ok=True)

GLOBAL = {
    'k': '#1b1526', 'w': '#ffffff', 'r': '#ff2244', 'y': '#ffd97a', 'o': '#ff9f43', 's': '#8a6a3a', 't': '#5c4327',
    'b': '#3b3f9e', 'c': '#5a5fd8', 'f': '#f2c9a0', 'g': '#7fd7ff', 'm': '#c77dff', 'p': '#ff5e7a', 'd': '#6b6f86',
    'n': '#d9d2c0', 'e': '#141020', 'v': '#8fe388', 'x': '#3a3550', 'z': '#4d4768', 'q': '#ffd166', 'h': '#7a1030',
}
SPRITES = {}   # name -> dict(rows=[...], mirror=bool, pal={...}, frames=[rows...])

def S(name, pal, *frames, mirror=False):
    SPRITES[name] = dict(frames=[f.strip('\n').split('\n') for f in frames], mirror=mirror, pal=pal)

# ---------------------------------------------------------------- joueur 16x24 (vue de côté, regarde à droite)
PLAYER_PAL = {'1': '#e8b04a', '2': '#b8832a', '3': '#f6d38a'}
S('player', PLAYER_PAL, """
................
.....kkkkk......
....kccccck.....
...kcccccccck...
..kcccccccccck..
..kccckkkkcccck.
..kcckffffkcck..
.kbbkfeffefkkk..
.kbbbkffffk.....
.kbbbbkffk......
.kbbbbb11k......
.kbbbbb1k.......
.kbbbb111k......
.kbbbb1111k.....
.kbbbb12221k....
..kbbb12222k....
..kbbb12222k....
..kbb122222k....
..kk1222222k....
...k22kk222k....
...k22k.k22k....
...kkkk.kkkk....
................
................
""", """
................
.....kkkkk......
....kccccck.....
...kcccccccck...
..kcccccccccck..
..kccckkkkcccck.
..kcckffffkcck..
.kbbkfeffefkkk..
.kbbbkffffk.....
.kbbbbkffk......
.kbbbbb11k......
.kbbbbb1k.......
.kbbbb111k......
.kbbbb1111k.....
.kbbbb12221k....
..kbbb12222k....
..kbb122222k....
..kb1222222k....
..kk222k2222k...
..k222k.k222k...
..kkkk...kkkk...
................
................
................
""", """
................
................
.....kkkkk......
....kccccck.....
...kcccccccck...
..kcccccccccck..
..kccckkkkcccck.
..kcckffffkcck..
.kbbkfeffefkkk..
.kbbbkffffk.....
.kbbbbkffk......
.kbbbbb11k......
.kbbbbb1k.......
.kbbbb111k......
.kbbbb1111k.....
.kbbbb12221k....
..kbbb12222k....
..kbb122222k....
...kk222222k....
....k22222k.....
....k22222k.....
....kkkkkkk.....
................
................
""")

# ---------------------------------------------------------------- vase 16x16
S('slime', {'1': '#6ee76e', '2': '#2f8a3a', '3': '#b8ffb0'}, """
........
........
........
.....kkk
...kk113
..k13311
.k113111
.k111111
k111w111
k111e111
k1111111
k1112111
k2222222
.k222222
..kkkkkk
........
""", mirror=True)

# ---------------------------------------------------------------- chauve-souris 16x16 (2 frames)
S('bat', {'1': '#b58cff', '2': '#5f3fb0', '3': '#d9c4ff'}, """
................
................
................
....k......k....
....k1k..k1k....
.kkkk111111kkkk.
k11111e11e11111k
k111111111111111
.k2222111122222.
..kk22111122kk..
....kk1111kk....
......k11k......
......kkkk......
................
................
................
""", """
................
................
kk............kk
k11k.k....k.k11k
k111k1k..k1k111k
.k11k111111k11k.
..kk11e11e11kk..
....k111111k....
....k111111k....
.....k1111k.....
......k11k......
......kkkk......
................
................
................
................
""")

# ---------------------------------------------------------------- archer squelette 16x20 (côté, regarde à droite)
S('archer', {'1': '#d9d2c0', '2': '#9a927e', '3': '#f5f0e4'}, """
................
.....kkkk.......
....k1111k......
...k133111k.....
...k1e11e1k.....
...k111111k.....
....k1kk1k......
.....kkkk.......
...kk1111k..s...
..k1k2222k..s...
..k1.k11k...s...
..k1.k22k..ss...
..k1.k11k.s.s...
..kk.k22k.s.s...
.....k11k.s.s...
....k1kk1k..s...
....k1k.k1k.s...
....k1k.k1k.s...
....kkk.kkk.....
................
""")

# ---------------------------------------------------------------- brute 24x24
S('brute', {'1': '#ff5e5e', '2': '#9c2323', '3': '#ff9d9d'}, """
............
...kk.......
..k1k.......
..k11k......
...k11k.kkkk
....k1kk1111
.....k113311
....kk113311
...k11111111
..k111111111
.k1111wr1111
.k1111kk1111
k11111111111
k11111111111
k11111122211
k11112222222
k111k2222222
.kkk.k222222
....k1111111
...k11112222
...k11112222
...k2222kkkk
....kkkk....
............
""", mirror=True)

# ---------------------------------------------------------------- mage 16x22 (face, bâton à droite)
S('mage', {'1': '#4ecdc4', '2': '#1d6f6a', '3': '#a8f0ea'}, """
................
.......k........
......k2k.......
.....k222k......
.....k222k......
....k22222k.....
...k2222222k....
..kkkkkkkkkkk...
....kffffk...k..
....kfefefk.kgk.
....kffffk...k..
.....k11k....s..
....k1111k...s..
...k111111k..s..
...k113311k..s..
..k11133111k.s..
..k11111111k.s..
..k11111111k.s..
.k1112222111k...
.k2222222222k...
.kkkkkkkkkkkk...
................
""")

# ---------------------------------------------------------------- canon 16x16
S('turret', {'1': '#ff9f43', '2': '#a85a12', '3': '#ffd1a0'}, """
........
........
..kkkkkk
.k222222
k2211111
k2113311
k2113311
k2111111
k2111111
k2222222
k2222222
.kkkkkkk
.kddddkk
kddddddd
kkkkkkkk
........
""", mirror=True)

# ---------------------------------------------------------------- araignée 16x16
S('spider', {'1': '#8b6b3a', '2': '#4a3418', '3': '#c9a26a'}, """
........
........
k.......
.k....kk
..k..k11
k..k1131
.kk11111
...k1111
..k11r1r
..k1111r
.k.k1111
k...k222
.k...kkk
..k.....
...k....
........
""", mirror=True)

# ---------------------------------------------------------------- crapaud 20x16
S('toad', {'1': '#7bb35a', '2': '#3d6a2a', '3': '#b8e08a'}, """
..........
..........
.....kkk..
....k1y1k.
....k1e1k.
....k111kk
..kkk11111
.k11111133
k111111133
k111111111
k122211111
k222222222
.k22222222
..kk222222
....kkkkkk
..........
""", mirror=True)

# ---------------------------------------------------------------- loup 22x14 (côté)
S('wolf', {'1': '#d5dde9', '2': '#8f9bb0', '3': '#ffffff'}, """
......................
...............k..k...
..............k1kk1k..
.......kkkkkkk111111k.
....kkk1111111133111k.
kk.k11111111111133r1k.
k2kk1111111111111111kk
.k2211111111111kk1kk1k
..k2211111112k.kk.k1k.
...k1111111k..k....k..
...k11k111k...........
...k2k.k22k...........
...kkk.kkk............
......................
""")

# ---------------------------------------------------------------- spectre 16x18
S('ghost', {'1': '#d6ccff', '2': '#9a8ad8', '3': '#f3efff'}, """
........
.....kkk
...kk111
..k11133
.k111133
.k111111
k1111ee1
k1111ee1
k1111111
k1111111
k1111111
k1111111
k1121112
k1122122
k2222222
.k2.k22.
.k..k2..
.k..k...
""", mirror=True)

# ---------------------------------------------------------------- kamikaze 16x16
S('bomber', {'1': '#ff3b6b', '2': '#7a1030', '3': '#ff9ab8'}, """
.........k......
........k.y.....
.........kk.....
.........s......
......kkkskk....
....kk111111kk..
...k1113311111k.
..k11133111111k.
..k1111111w11wk.
.k11111111e11ek.
.k111111111111k.
.k111111111111k.
..k11222222222k.
..k22222222222k.
...kk2222222kk..
.....kkkkkkk....
""")

# ---------------------------------------------------------------- boss : gardien de vase 32x32
S('boss_guardian', {'1': '#8be05a', '2': '#3d7a1c', '3': '#d2ffb0'}, """
................
................
................
................
..........y.y.y.
..........yyyyy.
.........kkkkkkk
.......kk1111111
.....kk111133331
....k11111333331
...k1111113333k1
..k111111133kk11
..k11111111kk111
.k11111111111111
.k111111111ww111
k1111111111wr111
k1111111111rr111
k111111111111111
k111111111111111
k111111111111111
k111111112222111
k111111122222222
k111112222222222
k122222222222222
k222222222222222
.k22222222222222
.k22222222222222
..k2222222222222
...kk22222222222
.....kkkkkkkkkkk
................
................
""", mirror=True)

# ---------------------------------------------------------------- boss : reine des marais 32x32
S('boss_queen', {'1': '#86bf5c', '2': '#2f5a1e', '3': '#c8e89a'}, """
................
................
......y.y.y.....
......yyyyy.....
.....kkkkkkk....
....k1111111kkkk
....k11w1111k...
....k1wr1111k...
....k1rr1111kkkk
....k11111111111
..kkk11111111111
.k11111111111333
k111111111111333
k111111111111133
k111111111111111
k111111111111111
k111111111111111
k111111111111111
k111222222111111
k122222222222111
k222222222222222
k222222222222222
k222222222222222
.k22222222222222
.k22222222222222
..kk222222222222
..k11k2222222222
.k111kkkkkkkkk22
k1111111111111k2
k11111111111111k
.kkkkkkkkkkkkkkk
................
""", mirror=True)

# ---------------------------------------------------------------- boss : colosse de forge 32x32
S('boss_colossus', {'1': '#ff7b54', '2': '#8a2f12', '3': '#ffc4a8'}, """
................
....kk..........
...k1k..........
...k11k.........
....k11k........
.....k11k...kkkk
......k11kkk1111
.......k11111111
......kk11111111
.....k1111133331
....k11111133331
...k111111111111
..k1111111ww1111
..k1111111wr1111
.k11111111rr1111
.k11111111111111
k111111111111111
k111111111111111
k111111112222111
k111111222222222
k111122222222222
k1112dddddddd222
k111ddddddddddd2
k111dddd222ddddd
k11k2222222222dd
.kk.k22222222222
....k11111111222
...k111111112222
...k111111112222
...k222222222kkk
...kkkkkkkkkk...
................
""", mirror=True)

# ---------------------------------------------------------------- boss : roi de givre 32x32
S('boss_frostking', {'1': '#cfeeff', '2': '#5b8fb5', '3': '#ffffff'}, """
................
..........y.y.y.
..........yyyyy.
.........kkkkkkk
........k2222222
........k2222222
.......k22222222
.......k22222222
......k222222222
......k222222222
.....k2222222222
....kkkkkkkkkkkk
......k333333333
......k3ww333333
......k3wg333333
......k3gg333333
.......k33333333
.......k33333333
........k3333333
........k3333333
.......k11111111
......k111111111
.....k1111111111
....k11111111111
...k111111111111
..k1111111111111
..k1111333311111
.k11111133331111
.k11111111111111
.k11222222222222
.k22222222222222
.kkkkkkkkkkkkkkk
""", mirror=True)

# ---------------------------------------------------------------- boss : œil de l'abîme 32x32
S('boss_eye', {'1': '#c77dff', '2': '#5b2a8a', '3': '#e6c6ff'}, """
k...............
.k......k.......
..k....k1k......
...k..k11k......
....kk111k......
.....k111kkkkkkk
.....k11111111ww
....k11111111www
...k111111111www
..k1111111111www
..k1111111111www
.k11111111111www
.k1111111111wwww
.k1111111111wwee
k11111111111wwee
k11111111111weer
k11111111111weer
k11111111111wwee
.k1111111111wwee
.k1111111111wwww
.k11111111111www
..k1111111111www
..k1111111111www
...k111111111www
....k11111111www
.....k11111111ww
.....k111kkkkkkk
....kk111k......
...k..k11k......
..k....k1k......
.k......k.......
k...............
""", mirror=True)

# ---------------------------------------------------------------- décors & objets
S('chest', {'1': '#8a5a2b', '2': '#5c3a18', '3': '#a86f38'}, """
........
..kkkkkk
.k333333
.k333333
.k111111
.kkkkkkk
.k111111
.k1111kk
.k1111ky
.k1111kk
.k222222
.k222222
.kkkkkkk
........
""", mirror=True)
S('chest_open', {'1': '#8a5a2b', '2': '#5c3a18', '3': '#a86f38'}, """
..kkkkkk
.k333333
.k3yyyyy
.k3yyyyy
.kkkkkkk
.k222222
.k222222
.k111111
.k1111kk
.k1111ky
.k222222
.k222222
.kkkkkkk
........
""", mirror=True)
S('altar', {'1': '#4d4768', '2': '#3a3550', '3': '#6b6488'}, """
........
......km
.....kmm
....kmmm
.....kmm
......km
........
....kkkk
...k3333
..k33333
..k11111
...k1111
...k1111
...k1111
...k1111
..k11111
.k222222
.k222222
.kkkkkkk
........
""", mirror=True)
S('pedestal', {'1': '#4d4768', '2': '#3a3550', '3': '#6b6488'}, """
........
......kk
.....kpp
.....kpp
......kk
........
....kkkk
...k3333
..k33333
..kkkkkk
....k111
....k111
....k111
....k111
....k111
...k2222
..k22222
..k22222
..kkkkkk
........
""", mirror=True)
S('merchant', {'1': '#2b2436', '2': '#1a1622', '3': '#3d3550'}, """
................
.......kk.......
......k22k......
.....k2222k.....
....k222222k....
...k22222222k...
..k2222222222k..
.kkkkkkkkkkkkkk.
..k1111111111k..
..k11y1111y11k..
..k1111111111k..
...k11111111k...
...k11111111k...
..k1113111111k..
..k1133311111k..
..k1113111111k..
..k1111111111k..
.kssssssssssssk.
.kttttttttttttk.
.kt.kpk.kgk.kykk
.kt.kkk.kkk.kkkk
..kkkkkkkkkkkk..
................
................
""")
S('stairs', {'1': '#3d4466', '2': '#1a1e30', '3': '#5a6390'}, """
kkkkkkkkkkkkkkkk
k33333333333333k
k32222222222222k
k32222222222222k
k3233333333333kk
k3232222222222kk
k3232222222222kk
k323233333333kkk
k323232222222kkk
k323232222222kkk
k32323233333kkkk
k32323232222kkkk
k32323232222kkkk
k3232323kkkkkkkk
k3232323kkkkkkkk
kkkkkkkkkkkkkkkk
""")
S('torch', {'1': '#5c4327', '2': '#3a2a18'}, """
...oo...
..oyyo..
..oyyo..
.oyywyo.
.oyywyo.
..oyyo..
...oo...
...kk...
..k11k..
..k11k..
...k2k..
...k2k..
..kkkk..
........
""", """
........
...oo...
..oyyo..
.oyywyo.
.oyywyo.
..oyyo..
...oo...
...kk...
..k11k..
..k11k..
...k2k..
...k2k..
..kkkk..
........
""")
S('coin', {'1': '#ffd97a', '2': '#b8832a', '3': '#fff3c0'}, """
..kk....
.k31k...
k3311k..
k3111k..
k1112k..
k1122k..
.k22k...
..kk....
""")
S('heart', {'1': '#ff4f6d', '2': '#8a1c2e', '3': '#ff9ab0'}, """
.kk..kk.
k31kk11k
k3111111
k1111111
.k11112k
..k112k.
...k2k..
....k...
""")
S('gem', {'1': '#c77dff', '2': '#5b2a8a', '3': '#ecd6ff'}, """
...kk...
..k33k..
.k3311k.
k331111k
k111122k
.k1122k.
..k22k..
...kk...
""")
S('pet', {'1': '#dff4ff', '2': '#9fd8ff', '3': '#ffffff'}, """
....kkkk....
...k1111k...
..k113311k..
..k111111k..
.k11e11e11k.
.k11111111k.
.k11111111k.
.k11211211k.
.k12221222k.
..k2k22k2k..
..kk.kk.kk..
............
""")

# ---------------------------------------------------------------- variantes recolorées
VARIANTS = {
    'imp':      ('bat',   {'1': '#ff6b3a', '2': '#8a2a10', '3': '#ffb08a'}),
    'shade':    ('archer', {'1': '#6a58a8', '2': '#3a2d66', '3': '#9d8ad8'}),
    'golem':    ('brute', {'1': '#a67c52', '2': '#5c3f24', '3': '#d9b48c'}),
    'yeti':     ('brute', {'1': '#eef4ff', '2': '#7f93b0', '3': '#ffffff'}),
    'icemage':  ('mage',  {'1': '#9fd8ff', '2': '#3a6f96', '3': '#e0f4ff'}),
    'voidmage': ('mage',  {'1': '#c77dff', '2': '#5b2a8a', '3': '#ecd6ff'}),
    'shaman':   ('mage',  {'1': '#d1a54a', '2': '#6e5320', '3': '#f0d79a'}),
    'hunter':   ('ghost', {'1': '#5a0a18', '2': '#2a0410', '3': '#ff2244', 'e': '#ff2244'}),
    'slime_blue': ('slime', {'1': '#5fb8ff', '2': '#2b5f9e', '3': '#c0e8ff'}),
}

def hexrgb(h):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)

def render(frames, pal, mirror):
    imgs = []
    for rows in frames:
        rows = [r for r in rows if r != '']
        h = len(rows); hw = max(len(r) for r in rows)
        w = hw * 2 if mirror else hw
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        px = im.load()
        for y, row in enumerate(rows):
            row = row.ljust(hw, '.')
            for x, ch in enumerate(row):
                if ch == '.': continue
                col = pal.get(ch) or GLOBAL.get(ch)
                if col is None: raise SystemExit(f'couleur inconnue {ch!r}')
                px[x, y] = hexrgb(col)
                if mirror: px[w - 1 - x, y] = hexrgb(col)
        imgs.append(im)
    return imgs

entries = []
for name, sp in SPRITES.items():
    entries.append((name, render(sp['frames'], sp['pal'], sp['mirror'])))
for name, (base, pal) in VARIANTS.items():
    sp = SPRITES[base]
    merged = dict(sp['pal']); merged.update(pal)
    entries.append((name, render(sp['frames'], merged, sp['mirror'])))

# empaquetage en étagères
PAD = 1
SHEET_W = 256
atlas = {}
x = y = shelf = 0
for name, imgs in entries:
    fw, fh = imgs[0].size
    total = (fw + PAD) * len(imgs)
    if x + total > SHEET_W:
        x = 0; y += shelf + PAD; shelf = 0
    atlas[name] = {'x': x, 'y': y, 'w': fw, 'h': fh, 'n': len(imgs)}
    x += total; shelf = max(shelf, fh)
sheet = Image.new('RGBA', (SHEET_W, y + shelf + PAD), (0, 0, 0, 0))
for name, imgs in entries:
    a = atlas[name]
    for i, im in enumerate(imgs):
        sheet.paste(im, (a['x'] + i * (a['w'] + PAD), a['y']))
sheet.save(os.path.join(OUT, 'sprites.png'))
with open(os.path.join(OUT, 'sprites.json'), 'w') as f:
    json.dump(atlas, f, separators=(',', ':'))
preview = sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
bg = Image.new('RGBA', preview.size, (40, 44, 60, 255)); bg.alpha_composite(preview)
bg.save(os.path.join(os.path.dirname(__file__), 'preview.png'))
print(f'{len(atlas)} sprites, planche {sheet.width}x{sheet.height}')
