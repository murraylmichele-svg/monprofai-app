# MonProf.ai — Checklist après chaque changement de code

À suivre chaque fois qu'un fichier `.js`, `.html` ou `.css` est modifié.
Sans ces étapes, le navigateur peut continuer à afficher l'ancienne
version du code pendant longtemps (mise en cache par le service worker).

## Les 5 étapes

1. **Faire le changement de code**
   Modifier le(s) fichier(s) concerné(s) et les envoyer sur GitHub (commit) comme d'habitude.

2. **Ouvrir `sw.js` et augmenter `CACHE_NAME`**
   Trouver la ligne `var CACHE_NAME = ...` près du haut du fichier et augmenter le numéro de version de 1 (ex. `v7` devient `v8`).
   Ceci indique à chaque navigateur qui visite le site : « les fichiers en cache sont dépassés, va chercher les nouveaux. »

3. **Ouvrir `index.html` et faire correspondre le numéro dans le pied de page**
   Trouver la ligne `<footer id="app-version-footer">` près du bas du fichier et la mettre au même numéro que celui utilisé à l'étape 2 (ex. `v8`).
   C'est ce qui permet de confirmer d'un coup d'œil que la nouvelle version est bien chargée.

4. **Envoyer `sw.js` et `index.html` ensemble**
   Sauvegarder/committer ces deux fichiers dans le même lot, pour que le numéro de version du cache et celui affiché dans le pied de page ne se désynchronisent jamais.

5. **Recharger et vérifier le pied de page**
   Ouvrir l'application (recharger complètement au besoin) et regarder le bas de la page.
   - Si le pied de page montre le nouveau numéro → c'est bon, la vraie version à jour est testée.
   - Si le pied de page montre encore l'ancien numéro → le cache n'a pas encore été rafraîchi. Recharger de nouveau après un moment, ou utiliser DevTools → Application → Service Workers → « Update on reload » pendant les tests actifs.

## Pourquoi ce problème existe

Les navigateurs ne vérifient pas automatiquement si `sw.js` a changé à chaque
chargement de page — habituellement, au maximum une fois par 24 heures. Le
fichier `index.html` force cette vérification à chaque chargement (via
`reg.update()`), mais le rafraîchissement du cache lui-même dépend toujours
du numéro `CACHE_NAME` dans `sw.js`. D'où l'importance de toujours faire les
étapes 2 et 3 ensemble.
