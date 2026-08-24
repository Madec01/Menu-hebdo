# CORE — v4 : ce qui donne envie d'y retourner

> Reponse a « il manque le truc qui fait qu'on y retourne ».
> **Etat : le Carnet et les explosifs sont implementes.** Le §4 reste ouvert.

---

## 1. Le diagnostic

Une expedition finie ne laissait **rien** derriere elle. Meme menu, memes trois metiers,
memes cartes, meme boutique, meme planete. Le seul acquis etait un chiffre : ton temps.

C'est suffisant pour un joueur qui vise le classement. Ce n'est rien pour tous les autres.
Un jeu qu'on relance est un jeu ou la partie precedente **a construit quelque chose**.

---

## 2. Le Carnet du mineur *(implemente)*

Tout ce qu'on fait alimente des compteurs qui survivent aux expeditions : minerai perce,
bidons trouves, bonus ramasses, effondrements declenches, ensevelissements subis, medailles
d'or, profondeur record, charges posees.

**Seize deblocages** y sont accroches, et chacun fait entrer du contenu dans les tirages :
quatre metiers, cinq passifs, deux pieces de boutique, le Sablier fele, les pactes, et deux
paliers de difficulte.

Le mecanisme qui fait revenir tient en une regle :

> **On voit toujours ce qui est a une partie.**

L'ecran de fin annonce ce qui vient d'etre debloque, puis affiche **les trois prochains avec
leur barre de progression**. Le menu rappelle les deux plus proches. Quand on lit
« Metier : Le Camionneur — 14 / 15 bidons », on relance. C'est tout le principe.

Les seuils ne sont pas inventes : ils sont cales sur les chiffres reels d'une expedition
complete mesuree en simulation (environ 210 minerais, 10 bidons, 15 bonus, 300
effondrements). Un deblocage tombe donc toutes les une a trois parties, jamais deux d'un
coup au meme moment.

### Les paliers de profondeur

- **Profondeur II** — roche +30 %, Faille +25 %, mais **une carte de plus a chaque station**.
- **Profondeur III** — encore plus dur, et **un point d'integrite en moins**.

C'est la deuxieme vie du meme contenu : on ne rejoue pas pour voir la suite, on rejoue pour
voir si on tient.

---

## 3. Les explosifs *(implemente)*

Des ingredients sont enfouis dans la roche, et n'apparaissent qu'a partir de leur couche :
salpetre, soufre, meche huilee, poche de gaz, **champignon peteur**, nitro de poche, eclat
instable, **dent de ver fossilisee**.

**Des qu'une recette est complete, la charge se fabrique toute seule** — on ramasse, ca
clique, on a une bombe de plus a la ceinture (trois maximum). `E` la pose, la meche brule
0,85 s.

| Charge | Recette | Effet |
|---|---|---|
| **Dynamite** | salpetre + soufre + meche | Rayon 4 |
| **Pet de champignon** | champignon + gaz | Petit rayon, mais **ca propulse la foreuse** |
| **Charge dirigee** | salpetre + meche + gaz | Perce un couloir de 15 blocs droit devant |
| **Nitro-geode** | nitro + eclat instable | Rayon 6 |
| **Bombe abyssale** | nitro + eclat + dent de ver | Rayon 9, **et tout s'ecroule autour** |

Le point d'equilibre, c'est que **faire sauter la roche ne consomme pas une goutte de
carburant**. Une charge, c'est du carburant et du temps economises — donc une raison de
plus de devier pour ramasser. Les deux grosses charges blessent si on reste a moins de
trois blocs : on les pose, on ne les subit pas.

Ingredients et charges **passent d'un niveau a l'autre**, mais pas d'une expedition a
l'autre.

Le premier niveau de chaque expedition **garantit le trio de la dynamite** (salpetre,
soufre, meche) a portee immediate du point de depart : mesure sur six graines, les trois
tombent toujours dans les vingt-cinq premiers metres et a moins de sept colonnes du
depart. On doit avoir sa premiere charge dans la premiere minute, pas au troisieme niveau.

---

## 4. Ce qui manque encore : un climax

Le carnet donne le *« encore une »*. Il manque le *« il faut que je refasse ca »*.

Aujourd'hui une expedition se termine par un Sceau de plus, puis un tableau de temps. Il n'y
a pas de sommet. Les pistes, par ordre d'interet :

1. **Le Coeur** — un dernier niveau qui n'est pas un niveau : la Faille passe en vitesse
   maximale, la roche s'ouvre, on tombe pendant vingt secondes dans une lumiere blanche en
   esquivant des blocs. Une sequence de fuite, comme l'extraction de *Deep Rock Galactic*.
2. **Les couches 4 a 6** — le manteau, les rivieres de magma, le noyau externe et son
   magnetisme. Elles sont deja concues dans le game design d'origine ; ce sont trois
   mecaniques signatures qui n'attendent que d'etre codees.
3. **La graine du jour** — tout le monde creuse la meme planete, avec son propre historique
   local. Le classement viendra si le jeu sort.
4. **Les collections** — fossiles et artefacts par couche, un cabinet de curiosites a
   remplir. Le carnet en est deja le squelette.
5. **Les dangers pilotables** du document v3 §6 — le ver de roche qui suit tes galeries,
   les poches de gaz, l'eau et la lave qui coulent dans tes tunnels.

Mon ordre : **1 puis 2**. Un climax donne un souvenir ; de nouvelles couches donnent une
raison d'y retourner avec ce souvenir en tete.
