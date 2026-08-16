# La recherche et le relevé

## Les cinq branches

| Branche | Ce qu'elle débloque | Sa promesse |
|---|---|---|
| **Propulsion & Navigation** | Temps de saut, portée, rendement carburant, capacité de fret, détection puis création de trous de ver | *Rapprocher la galaxie* |
| **Construction & Industrie** | Bâtiments, rendement d'extraction, chantiers orbitaux, automatisation et robots, terraformation | *Faire plus avec le même sol* |
| **Biologie & Xénologie** | Nourriture, survie en milieu hostile, clonage, étude des espèces, croisements, médecine, confinement | *Peupler et comprendre le vivant* |
| **Armement & Défense** | Armes, blindages, boucliers, doctrines de flotte, fortification des nœuds de saut | *Tenir ce qu'on a pris* |
| **Astronomie & Détection** | Portée des télescopes, niveau de détail des relevés, nombre de relevés simultanés, détection d'anomalies | *Savoir où aller avant d'y aller* |

Environ 60 technologies au total, plus les **branches secrètes** : absentes au
départ, elles n'apparaissent qu'après la découverte d'un artefact ou d'un
xénomatériau, et diffèrent à chaque partie.

Les **robots** vivent dans Construction (châssis, automatisation, remplacement
de main-d'œuvre), leurs paliers les plus avancés exigeant aussi un niveau en
Biologie : la cognition artificielle s'inspire du vivant étudié. Un pont entre
deux branches plutôt qu'une sixième branche isolée.

## Le relevé astronomique

Cinq niveaux de connaissance par système :

| Niveau | Ce que le joueur voit | Comment l'obtenir |
|---|---|---|
| **L0 — Inconnu** | Un point, sa classe stellaire | Gratuit, à distance |
| **L1 — Repéré** | Nombre de planètes, silhouettes grossières | Télescope, portée limitée par la technologie |
| **L2 — Relevé** | Types exacts, ressources principales, présence d'un monde habitable | Éclaireur sur place, ou observatoire si la technologie le permet |
| **L3 — Analysé** | Gisements chiffrés, dangers, formes de vie, potentiel de colonisation réel | Relevé approfondi, plus long |
| **L4 — Sondé** | Anomalies, artefacts, xénomatériaux, épaves | Équipement spécialisé |

### La file de relevé

**Un seul système peut être analysé à la fois**, quel que soit le nombre
d'éclaireurs sur le terrain. Les autres attendent, données en soute.
L'astronomie fait passer cette file à 2, 3, 4 puis 6 places simultanées.

C'est la contrainte la plus intéressante du système, parce qu'elle rend le
nombre de vaisseaux non pertinent : ce qui limite l'exploration, c'est la
capacité d'analyse, pas la capacité de déplacement.

### L'arbitrage que ça crée

Couplé aux quarante minutes de traversée, le relevé oppose en permanence deux
stratégies :

- **Envoyer des éclaireurs** — lent, coûteux, mais seul moyen d'atteindre L3 et
  L4, donc de coloniser en connaissance de cause ou de trouver un artefact.
- **Investir en télescopes** — immédiat, à distance, sans risque, mais plafonne
  au L2 : on saura qu'un monde est tempéré, pas qu'il est piégé.

Et une erreur de lecture au L1 se paie cher : vingt minutes de trajet pour
découvrir que le monde « habitable » est en rotation synchrone, sans eau, ou
occupé.

Paramètres dans [`data/config.json`](../data/config.json), section `releve`.
