# Les ressources

Catalogue de référence : [`data/resources.json`](../data/resources.json).
Ce document explique **pourquoi** il est construit ainsi.

## Trois principes

### 1. La contrainte n'est pas la rareté, c'est la masse

Ce qui rend une économie spatiale intéressante, c'est que le fer est partout
mais coûte une fortune à déplacer, tandis qu'un kilo d'isotope lourd traverse la
galaxie pour presque rien. Chaque ressource porte donc deux attributs
indépendants : **abondance** et **transportabilité**.

| Transport | Signification |
|---|---|
| `local` | Ne quitte pas le système. S'utilise sur place, point. |
| `standard` | Fret classique, coûteux en capacité de transport. |
| `dense` | Valeur par kilo très élevée : se déplace sans y penser. |
| `immateriel` | Flux, jamais stocké (énergie, science, légitimité). |

Conséquence de jeu : un monde riche en fer n'a de valeur que si on a quelque
chose à construire **sur place**. Le puits de gravité devient un paramètre
stratégique, et les colonies se spécialisent naturellement par région.

### 2. Trois états, pas trente barres de stock

*Brut* (extrait du sol) → *raffiné* (produit par un bâtiment, consomme de
l'énergie) → *flux* (jamais stocké, toujours en tension). Sans cette
hiérarchie, l'interface devient un tableur.

### 3. Certaines ressources n'entrent pas dans l'économie

Artefacts, xénomatériaux, échantillons xénobiologiques : ils ne servent pas à
construire, ils servent à **débloquer**. Ils entrent dans l'arbre de recherche,
pas dans les files de production.

## Les six familles

| Famille | Rôle | Exemples |
|---|---|---|
| **Vitaux** | Sans eux, la colonie meurt | eau, volatils, biomasse |
| **Masse** | Abondants, lourds, non exportables | régolithe, fer-nickel, silicates, carbone |
| **Industriels** | Raffinés, jamais extraits | alliages, céramiques, électronique, cellules de propulsion |
| **Stratégiques** | Rares, localisés, objets de conflit | terres rares, platinoïdes, uranium, hélium-3, tritium |
| **Exotiques** | Ouvrent la recherche | kaerium, antimatière, matière exotique, xénomatériaux |
| **Flux** | Tension permanente | énergie, fret, science, légitimité |

## Deux mécanismes à souligner

### Le tritium périssable

Produit à partir du lithium, il **décroît en soute**. Impossible à thésauriser :
il faut décider maintenant si on l'engage dans la recherche, la flotte ou le
commerce. Un générateur de décisions plutôt qu'un stock de plus.

### Le kaerium, monnaie et carburant

La monnaie est un isotope superhaut stable de l'îlot de stabilité. Trois
propriétés la rendent crédible comme monnaie :

- **Elle est utile en soi.** Catalyseur de recherche *et* cœur des systèmes de
  propulsion longue portée. Une monnaie n'est acceptée que si tout le monde en
  veut pour autre chose que pour échanger.
- **Elle est ultra-rare et non renouvelable.** Quelques gisements sur 300
  systèmes, concentrés autour des naines blanches et sur les mondes irradiés —
  c'est-à-dire dans les endroits les plus coûteux à exploiter.
- **La dépenser fait mal.** Chaque unité donnée à un adversaire est une unité
  qui n'accélérera pas la recherche et ne raccourcira pas les trajets. Le
  dilemme s'exprime directement en minutes de temps de jeu.

Corollaire : le commerce courant (fer, eau, nourriture) se fait en **troc et en
contrats de livraison**, pas en monnaie. Le kaerium ne sert qu'aux transactions
exceptionnelles et aux accélérations d'urgence, à un taux de change
volontairement mauvais.

Le nom est provisoire et vit dans `data/resources.json` : le changer est une
ligne à modifier.

## Répartition observée

Sur un germe de 300 systèmes (≈ 1 400 mondes), ordre de grandeur du nombre de
gisements :

| Ressource | Gisements | Lecture |
|---|---|---|
| Régolithe, silicates, fer-nickel | 550 – 950 | omniprésents, sans valeur d'échange |
| Volatils, eau, carbone | 280 – 380 | communs mais inégalement répartis |
| Terres rares, platinoïdes, uranium | 270 – 320 | assez rares pour justifier une conquête |
| Hélium-3, lithium, deutérium | 90 – 160 | goulots d'étranglement énergétiques |
| Échantillons xénobiologiques | ≈ 80 | liés aux mondes vivants |
| Kaerium | 40 – 70 | la monnaie, réellement rare |
| Antimatière | 35 – 55 | réservée aux géantes gazeuses |
| Xénomatériaux | 10 – 20 | uniques, nommés, ouvrant des branches |

`npm run gen` recalcule ces chiffres pour n'importe quel germe : c'est l'outil
d'équilibrage.
