# Questions ouvertes

Les valeurs par défaut ci-dessous ont été adoptées **en provisoire** pour ne pas
bloquer le démarrage. Tout vit dans `data/` : changer un nom, une durée ou un
barème est une ligne à modifier, pas une refonte.

## À nommer

| Sujet | Valeur provisoire |
|---|---|
| Nom du jeu | `Space` (nom du dépôt) |
| Nom de la monnaie | **Kaerium** — alternatives proposées : Vhorite, Orrhium |

## Réglages adoptés par défaut

| Sujet | Valeur | Où la changer |
|---|---|---|
| Durée de partie visée | 2 h 30 | `data/config.json` › `partie.duree_cible_min` |
| Taille de carte | 300 systèmes (150 / 300 / 600) | `data/config.json` › `carte.tailles` |
| Emplacements par planète | 4 à 16 selon le monde | `src/core/planets.ts` |
| Systèmes habitables | 8 à 12 % | `data/planet-types.json` › `rarete` |
| Traversée au palier 0 | ≈ 41 min | `data/config.json` › `deplacement` |

## Décisions de gameplay à trancher

### Carte et exploration

- Un trou de ver percé par un joueur est-il **empruntable par ses adversaires** ?
  Très fort en tension, potentiellement punitif.
- Les trous de ver naturels sont-ils à sens unique ?
- La **planète-mère** est-elle une entité neutre commune à tous les joueurs
  (marché, quêtes, renforts), ou chaque joueur a-t-il la sienne ? Peut-elle
  couper les vivres selon la politique menée ?

### Colonie et population

- Coût moral et politique du **clonage**. Proposition : les clones sont rapides
  et bon marché mais accumulent un compteur de conscience ; passé un seuil ils
  réclament des droits, puis se révoltent — et la répression coûte de la
  légitimité, ce qui affecte le commerce et les alliances.
- **Révoltes** : une jauge unique de loyauté par colonie, alimentée par le
  confort, la distance à la capitale, la composition de population, le régime
  politique et les événements ?
- **Politique** : interne (factions qui votent des lois) ou externe (diplomatie,
  traités) ? Recommandation pour la v1 : interne seulement, mieux lié aux
  révoltes.

### Vivant et xénologie

- Combien d'espèces intelligentes par partie ? Recommandation : 6 à 10 espèces
  **écrites à la main** avec une forte identité (comme les Vhael des maquettes),
  plus une génération procédurale pour la faune non intelligente.
- **Croisements** : proposition — un hybride hérite de traits des deux parents
  avec une part d'aléatoire, évalué sur quatre axes : productivité, résistance
  environnementale, aptitude au combat, intelligence. L'intelligence est ce qui
  rend l'hybride le plus utile *et* le plus dangereux. À valider.
- Ton du volet biologique : assumé et sombre, avec conséquences politiques, ou
  traité de façon légère ? Ça change toute l'écriture.

### Combat

- Contrôle direct des flottes en temps réel, ou ordres et auto-résolution avec
  rapport de bataille détaillé ? Recommandation forte pour une cible web
  multiplateforme : **auto-résolution**, avec composition de flotte et doctrine
  paramétrables. Le contrôle direct multiplie par cinq le travail de réseau,
  d'IA et d'assets.
- Conception de vaisseaux : coques prédéfinies, ou éditeur de modules ?
  Recommandation : coques avec 3 ou 4 emplacements.
- Peut-on **éliminer** un joueur, ou la guerre sert-elle seulement à contester
  des ressources et des routes ?

### Cadre

- **Conditions de victoire** : domination, score économique, percée scientifique
  finale, survie ? Recommandation : trois conditions parallèles, pour que les
  stratégies divergent.
- Que se passe-t-il quand un joueur se déconnecte en multijoueur ?
- Internationalisation dès maintenant, ou français d'abord ?

## Dette technique connue

- Les textes de l'interface sont écrits en dur dans `src/view/`. À externaliser
  avant que le volume ne rende l'opération coûteuse.
- Les données JSON sont importées à la compilation. Pour du contenu modifiable
  par les joueurs, il faudra passer à un chargement à l'exécution.
- Le visualiseur charge la galaxie entière d'un coup. À 600 systèmes ça passe,
  mais la vue système devra générer ses planètes à la demande.
