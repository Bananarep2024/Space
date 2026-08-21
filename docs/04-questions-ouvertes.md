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

## Rendu des planètes au portage Unity

Question ouverte : garder notre générateur procédural, ou reprendre un package
de l'Asset Store ? La réponse ne se joue qu'au moment du portage — un shader
Unity ne se transporte pas vers Three.js, donc un achat aujourd'hui dormirait
jusque-là.

### Les cinq critères de sélection

Dans l'ordre d'importance pour ce jeu précis :

1. **Le bruit est-il calculé sur GPU, ou lit-on des textures ?** Avec ~1 400
   mondes par partie, un pack de N planètes finies fait revenir chaque visage
   des dizaines de fois. C'est éliminatoire.
2. **Les paramètres sont-ils exposés au script C# ?** Il faut les piloter depuis
   `data/planet-types.json`, sinon on perd le lien entre le relevé et l'image.
3. **Peut-on imposer un germe ?** Sans reproductibilité, plus de sauvegarde
   légère ni de multijoueur à faible bande passante.
4. **Les traits de surface sont-ils adressables ?** Calotte polaire, niveau des
   mers, lave, bandes atmosphériques, anneaux, nuages.
5. **URP obligatoire, HDRP optionnel.** HDRP est hors sujet pour une cible
   multiplateforme.

### Candidats évalués

| Package | Nature | Germe | API C# | Verdict |
|---|---|---|---|---|
| **Procedural Planet Generation** (Parallel Cascades, 339842) | Shader Graph + VFX Graph + Render Graph, GPU | oui, plages de randomisation | génération en éditeur et au runtime | **recommandé** |
| **Procedural Planets** (Imphenzia, 287378 / 95581) | textures générées au runtime, ~100 propriétés | `CreatePlanet(position, seed, blueprint)` et surcharge JSON | la plus complète des quatre | solide alternative |
| **Space Graphics Toolkit** (4160) | boîte à outils spatiale complète | partiel | oui | surdimensionné ici |
| **Next-Gen Planets** (163061) | ~20 planètes texturées | non | non | écarté (critère 1) |

### Recommandation

**Procedural Planet Generation** de Parallel Cascades. Il est conçu pour
exactement notre usage — « space strategy games, solar system maps », des
planètes non atterrissables vues depuis l'espace — il couvre étoiles, géantes
gazeuses, anneaux, lunes et mondes telluriques, et il est bâti sur Shader Graph
et Render Graph, donc sans coût de génération de texture par monde.

**Alternative** : le package d'Imphenzia, si le pilotage par script se révèle
plus déterminant que la performance. Sa surcharge `CreatePlanet` acceptant une
chaîne JSON tomberait droit sur notre modèle de données. Réserve connue : sa
documentation signale que la génération dynamique de matériaux n'est pas
supportée en WebGL, avec un mécanisme de « bake » comme contournement.

### Ce que ça changerait dans le dépôt

Rien dans `src/core/`. Uniquement la couche vue, plus un bloc `unity` à ajouter
dans `data/planet-types.json` faisant correspondre nos 15 types et leurs traits
aux paramètres du package. Aucun de ces packages ne parle nativement notre
vocabulaire — banquise fracturée, bassin d'impact, champ de dunes, anneau teinté
par la température — donc une partie de ce lexique serait approchée plutôt que
rendue à l'identique. C'est le vrai coût de la reprise, et il se mesure au
moment du portage, pas avant.

## Dette technique connue

- Les textes de l'interface sont écrits en dur dans `src/view/`. À externaliser
  avant que le volume ne rende l'opération coûteuse.
- Les données JSON sont importées à la compilation. Pour du contenu modifiable
  par les joueurs, il faudra passer à un chargement à l'exécution.
- Le visualiseur charge la galaxie entière d'un coup. À 600 systèmes ça passe,
  mais la vue système devra générer ses planètes à la demande.
