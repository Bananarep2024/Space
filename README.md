# Space — jeu de stratégie spatiale 3X en temps réel

Prototype web d'un jeu de stratégie et de gestion en temps réel : explorer une
galaxie de 300 systèmes générée à chaque partie, coloniser un monde habitable,
exploiter les autres planètes du système, remonter un arbre de recherche, et
rencontrer ce qui vit là-bas.

Le web est la première cible ; une conversion Unity est prévue ensuite pour le
multiplateforme.

## Lancer le projet

```bash
npm install
npm run dev      # visualiseur de galaxie sur http://localhost:5173
npm run gen      # génération en console, sans navigateur (germe aléatoire)
npm run gen -- ITHARA-4718 300 6   # germe, nombre de systèmes, joueurs
npm test         # invariants du générateur
npm run check    # vérification des types
```

## Règle d'architecture

Le projet est coupé en deux moitiés qui ne se mélangent jamais.

```
src/core/    le moteur de règles — ne dessine rien, ne connaît ni Three.js ni le DOM
src/view/    l'affichage — ne décide rien, lit ce que le noyau a produit
data/        l'équilibrage — JSON éditable à la main, source de vérité
```

Cette séparation n'est pas cosmétique : c'est ce qui rend le portage Unity
abordable. Le jour venu, seul `src/view/` est réécrit. Le noyau est soit
réutilisé tel quel derrière un serveur, soit transposé en C# — il est isolé et
couvert par des tests, donc la transposition est mécanique. Et `data/` ne bouge
pas du tout : tout l'équilibrage réglé pendant des mois est conservé.

En pratique : **aucun fichier de `src/core/` ne doit importer quoi que ce soit
de `src/view/` ni de `three`.**

## Où en est le projet

Fait :

- génération déterministe d'une galaxie de 300 systèmes à partir d'un germe
- 1 à 12 planètes par système, 15 types de mondes, gisements, lunes, anneaux
- formes de vie indigènes, artefacts enfouis, xénomatériaux uniques à la partie
- réseau de routes de saut, nébuleuses infranchissables, trous de ver
- modèle de déplacement complet et arbitrage de propulsion
- visualiseur web de la carte de saut avec fiches de systèmes

À faire : voir [`docs/04-questions-ouvertes.md`](docs/04-questions-ouvertes.md).

## Documents de conception

| Document | Contenu |
|---|---|
| [`docs/00-conception.md`](docs/00-conception.md) | Décisions actées, boucle de jeu, périmètre |
| [`docs/01-ressources.md`](docs/01-ressources.md) | Catalogue des ressources et sa logique |
| [`docs/02-carte-et-deplacement.md`](docs/02-carte-et-deplacement.md) | Génération de la carte, modèle de trajet |
| [`docs/03-recherche-et-releve.md`](docs/03-recherche-et-releve.md) | Arbre de recherche, relevé astronomique |
| [`docs/04-questions-ouvertes.md`](docs/04-questions-ouvertes.md) | Ce qui reste à trancher |
