# Loopuff

[简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Un jeu pour apprendre à programmer avec Tolang : lire un programme, prévoir son résultat, le modifier, puis résoudre un problème sans modèle.

[Jouer](https://shixilin.com/games/loopuff/fr/) · [Premiers pas](https://shixilin.com/games/loopuff/fr/guide/start/) · [Parcours avancé](https://shixilin.com/games/loopuff/fr/guide/advance/)

Le site propose treize missions et deux parcours, avec des exemples exécutables, des explications, des modifications guidées et des tâches indépendantes. Les diagnostics utilisent plusieurs entrées ; la vitesse de frappe ne mesure pas la maîtrise de la programmation. Les douze langues et leur ordre correspondent au site shixilin.com.

La salle de jeux comprend une console portable en pixels : blocs à empiler, défense en char et tir spatial. `choose(1); start();` choisit et lance une cartouche ; `pause()` met en pause et `finish()` termine la partie en cours. Le panneau de commande envoie les instructions dans l’ordre. Les stratégies automatiques reçoivent un nouvel état du jeu toutes les 250 ms. Ces fonctions sont fournies par la console, pas par la bibliothèque standard de Tolang. La nouvelle partie reste dans la session de la page ; les sauvegardes des cours et des jeux existants conservent leur fonctionnement.

Les programmes utilisent un interpréteur pédagogique limité, distinct du compilateur Tolang complet et de la TVM. Les brouillons et résultats des cours restent disponibles dans le navigateur. Les résultats sont invalidés lorsqu’on modifie le code.

## Développement

```text
npm install
npm test
npm run build
npm run dev
```

Le serveur local indique son adresse au démarrage. Les tests vérifient l’exécution, les règles des jeux, les sauvegardes, les parcours et les langues. La vérification visuelle et les interactions dans le navigateur restent nécessaires.

Le projet original est sous PolyForm Noncommercial 1.0.0 ; voir LICENSE et NOTICE. Seules les tables de rotation des pièces de blocs sont adaptées du projet Javascript Tetris de Jake Gordon et ses contributeurs, sous MIT ; leur licence est conservée dans public/licenses/javascript-tetris.txt.
