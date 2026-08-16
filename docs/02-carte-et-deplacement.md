# La carte et le déplacement

## Génération

Toute la galaxie dérive d'une seule chaîne : le **germe**. Deux parties lancées
avec le même germe produisent exactement la même carte, sur n'importe quelle
machine. On ne transmet donc que quelques octets au lieu de deux mille planètes —
ce qui rend la sauvegarde et le multijoueur presque gratuits, et permet de
rejouer une partie à l'identique.

Ordre des opérations, dans `src/core/galaxy.ts` :

1. **Les étoiles** — 300 points dans un disque aplati de 72 al de rayon, avec
   une distance minimale entre voisines. Sans cette contrainte, le tirage
   uniforme produit des amas illisibles.
2. **Les nébuleuses** — 2 à 4 sphères de 8 à 16 al. Elles ne décorent pas :
   aucune route ne les traverse. On peut y entrer, pas les franchir.
3. **Le réseau de saut** — chaque étoile se relie à ses 3 à 6 plus proches
   voisines dans la portée initiale, plus 1 à 3 routes longues au-delà.
4. **Les trous de ver** — 2 à 4 paires reliant des points éloignés d'au moins
   la moitié du diamètre galactique.
5. **Les mondes** — 1 à 12 planètes par système, par un flux aléatoire dérivé,
   ce qui permet de régénérer un système à l'identique sans rejouer la galaxie.
6. **Les positions de départ** — choisies en dernier, une fois la topologie
   connue, dans la composante joignable à la portée initiale et le plus loin
   possible les unes des autres.

### Les planètes

La position orbitale détermine la zone thermique, la zone détermine les types
possibles, le type détermine les ressources. Rien n'est tiré sans contrainte
physique : c'est ce qui rend un relevé lisible, et permet au joueur d'anticiper
avant même d'avoir exploré. Une géante gazeuse est loin de son étoile, un monde
de fournaise est près, un monde tempéré est dans la zone habitable — et la zone
habitable d'une naine rouge est si proche que ses mondes y sont en rotation
synchrone, ce qui les rend nettement moins accueillants.

Résultat typique : **8 à 12 % des systèmes** comptent au moins un monde
habitable, et un système sur cent environ en compte deux.

## Le modèle de déplacement

```
temps_de_saut = (distance / (vitesse_base × vitesse_de_classe)) × facteur_propulsion + amorçage
```

Tous les paramètres sont dans [`data/config.json`](../data/config.json).

| Classe | Vitesse | Traversée complète, palier 0 |
|---|---|---|
| Éclaireur | ×1,00 | ≈ 41 min |
| Croiseur | ×0,75 | ≈ 54 min |
| Transport | ×0,60 | ≈ 1 h 08 |
| Vaisseau de colonisation | ×0,50 | ≈ 1 h 20 |

## Pourquoi la propulsion est la branche qui déplie la carte

Elle agit sur **deux leviers à la fois** :

1. le facteur de temps par unité de distance : 1,00 → 0,35 ;
2. la portée de saut : 14 → 28 al, ce qui **supprime des sauts entiers** et
   avec eux leurs amorçages.

Mesuré sur le germe `ITHARA-4718` :

| Palier | Portée | Traversée | Sauts | Systèmes à moins de 10 min |
|---|---|---|---|---|
| 0 | 14 al | 41 min 46 | 19 | 27 |
| 5 | 28 al | 15 min 11 | 11 | 215 |

Les routes longues **existent dès la génération** et sont visibles sur la carte,
mais restent impraticables tant que la propulsion ne les ouvre pas. Le joueur
mal équipé ne voit pas un trajet plus lent : il voit un mur. C'est ce qui rend
un palier de propulsion réellement gratifiant, plutôt qu'un simple bonus de
pourcentage.

Au palier 0, une cinquantaine de systèmes restent hors d'atteinte. C'est
volontaire : une partie ne permet pas de tout voir, et le lointain garde son
prix.

## Les trous de ver

Un trou de ver coûte une transition, pas une distance : il supprime quarante
minutes de trajet. C'est l'actif le plus précieux de la carte.

- **Naturels** (2 à 4 par galaxie) : présents dès le départ mais **instables**,
  donc inutilisables tant qu'ils n'ont pas été détectés puis stabilisés.
- **Artificiels** : créables en fin d'arbre de propulsion, au prix
  d'antimatière et de matière exotique.

Question de conception encore ouverte : un trou de ver percé par un joueur
est-il empruntable par ses adversaires ? Si oui, chaque raccourci est aussi une
brèche — ce qui est très fort, mais punitif.
