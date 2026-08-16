# Conception — décisions et cadre

## Ce qu'est le jeu

Un jeu de stratégie et de gestion **en temps réel**, à mi-chemin entre le 4X et
le jeu de gestion. Le joueur commence avec une colonie sur un monde habitable,
exploite les autres planètes de son système, explore une galaxie de 300 systèmes
générée à chaque partie, et se heurte aux autres empires — jusqu'à six joueurs,
en solo contre des IA ou en multijoueur.

La contrainte structurante n'est pas la rareté des ressources, c'est **la
distance**. Traverser la galaxie prend quarante minutes au départ. Tout le reste
en découle : la valeur d'un trou de ver, l'intérêt d'un télescope, le prix d'une
erreur de reconnaissance.

## Décisions actées

| Sujet | Décision |
|---|---|
| Architecture | Noyau de simulation isolé en TypeScript, vue Three.js séparée, données en JSON |
| Rythme | Temps réel, pause active, vitesses ×1 / ×2 / ×5 |
| Assets 3D | Entièrement procéduraux et paramétriques |
| Périmètre v1 | Slice solo : galaxie + colonie + économie |
| Déplacement | Réseau de routes de saut, pas de vol libre |
| Traversée de la galaxie | ~40 min au palier de propulsion 0, ~15 min au palier 5 |
| Taille de carte | 150 / 300 / 600, **300 par défaut** |
| Durée de partie visée | 2 h 30 |
| Brouillard de guerre | 5 niveaux de relevé, de L0 (inconnu) à L4 (sondé) |
| Colonie | Emplacements de bâtiments par planète, 4 à 16 selon le monde |
| Recherche | 5 branches + branches secrètes ouvertes par artefacts et xénomatériaux |
| Langue | Français, textes destinés à être externalisés |

## La boucle de jeu

1. **Observer** — les télescopes donnent une silhouette des systèmes voisins :
   classe stellaire, nombre de mondes, indices grossiers. Suffisant pour choisir
   où regarder, insuffisant pour décider.
2. **Envoyer** — un éclaireur part. Le trajet se compte en minutes réelles. Ce
   qu'on découvre en arrivant peut invalider vingt minutes de voyage.
3. **Relever** — un seul système peut être analysé à la fois. La file d'attente
   est la vraie contrainte de l'exploration, pas le nombre de vaisseaux.
4. **Exploiter** — poser des extracteurs, arbitrer entre les ressources locales
   (abondantes, intransportables) et le fret des ressources denses.
5. **Chercher** — la recherche consomme des données scientifiques, de l'énergie,
   et parfois du kaerium. Elle débloque de la portée, du rendement, du vivant.
6. **Recommencer plus loin** — chaque palier de propulsion redéfinit ce que
   « loin » veut dire.

## Ce qui doit rendre une partie mémorable

Trois sources de singularité, générées à chaque partie :

- **Les xénomatériaux** — une poignée de mondes portent un matériau inédit, avec
  son propre nom et sa propre branche de recherche. Deux parties ne donnent
  jamais le même arbre technologique final.
- **Les artefacts** — non produits, non reproductibles, parfois des pièges.
- **Le vivant** — des formes de vie indigènes qui contraignent ou avantagent,
  et à partir d'un certain palier d'intelligence, se révoltent.

## Périmètre de la première version jouable

Fait :

- génération déterministe de la galaxie et de ses 1 400 mondes
- réseau de saut, nébuleuses, trous de ver, positions de départ équilibrées
- modèle de déplacement et arbitrage de propulsion
- visualiseur de la carte avec fiches de systèmes

Reste pour compléter la slice :

- colonie : emplacements, bâtiments, production, consommation
- flux économiques : énergie, fret, nourriture, science
- premières technologies et interface de recherche
- boucle temps réel : horloge de partie, pause, vitesses
- vue système : les planètes en orbite, dans le style des maquettes

Volontairement hors périmètre pour l'instant : combat, multijoueur, politique,
croisements d'espèces, clonage. Ils viennent après, sur un socle qui tient.
