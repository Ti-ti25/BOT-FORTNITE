# Bot Compétitions Fortnite

## ⚠️ Sécurité — à faire avant tout

Ton ancien token a été partagé en clair, il faut le régénérer :
Discord Developer Portal → ton application → **Bot** → **Reset Token**.
Ne remets plus jamais un token dans un fichier de code : il va dans `.env`, qui n'est jamais partagé ni commité (déjà dans `.gitignore`).

## Pourquoi ce bot est différent de la version précédente

L'ancienne version utilisait `fortnite-api.com/v2/news/br`, qui renvoie les **actualités du jeu** (skins, modes de jeu...), pas les compétitions. Il n'existe pas d'API publique et documentée pour les tournois officiels Epic (FNCS, Cash Cups, Arena) avec des dates structurées. Ce bot lit donc les compétitions depuis un fichier local, `tournaments.json`, que tu tiens à jour toi-même (idéalement avec l'outil web fourni à côté, pour éviter d'éditer le JSON à la main).

## Installation

1. `npm install`
2. Copie `.env.example` en `.env` et remplis :
   - `DISCORD_TOKEN` : ton nouveau token
   - `CLIENT_ID` : l'ID de ton application
   - `CHANNEL_ID` : le salon où poster les récaps
   - `GUILD_ID` (optionnel, recommandé pendant les tests) : l'ID de ton serveur
   - `ADMIN_ID` : ton ID Discord personnel, pour que toi seul puisses utiliser `/ajouter` et `/supprimer`
3. Déploie la commande slash : `npm run deploy-commands`
4. Lance le bot : `npm start`

## Mettre à jour les compétitions

Trois façons, au choix :

1. **Commande Discord `/ajouter`** (réservée à `ADMIN_ID`) : nom, catégorie (menu déroulant FNCS / Cash Cup / Arena / Autre), date, heures de début/fin **en heure de Paris**, format (optionnel), lien (optionnel).
2. **`python3 ajouter_tournoi.py`** : colle 5 lignes (nom, catégorie, format, date en français type "27 septembre 2026", heures type "18h20h").
3. **Éditer `tournaments.json` à la main** (ou coller le JSON généré par l'outil web) :

```json
{
  "id": "identifiant-unique",
  "name": "Nom affiché",
  "type": "FNCS",           // catégorie : "FNCS", "Cash Cup", "Arena" ou "Autre" — sert à la couleur de l'embed
  "format": "Trio",         // optionnel : Solo, Duo, Trio, Squad...
  "region": "EU",
  "startDate": "2026-09-27T17:00:00Z",  // toujours en UTC (le Z à la fin)
  "endDate": "2026-09-28T22:00:00Z",
  "description": "Texte libre affiché dans l'embed",
  "link": "https://www.fortnite.com/competitive",
  "image": ""                // URL d'image, optionnel
}
```

Pour supprimer un tournoi : `/supprimer` avec son ID ou un morceau de son nom (réservé à `ADMIN_ID`).

Aucun redémarrage nécessaire : le fichier est relu à chaque récap ou commande. Après avoir ajouté `/ajouter` ou `/supprimer`, redéploie les commandes une fois : `npm run deploy-commands`.

## Fonctionnement

- **Automatique** : tous les dimanches à 18h00 (heure du serveur qui héberge le bot), le bot poste dans `CHANNEL_ID` toutes les compétitions dont la période chevauche la fenêtre **-7 jours à +7 jours** autour de maintenant.
- **À la demande** : la commande `/competitions` fait exactement la même chose, dans le salon où elle est tapée.

## Limites à connaître

- Le bot ne va chercher aucune donnée sur Internet : si tu n'actualises pas `tournaments.json`, la liste ne bouge pas.
- Le cron du récap automatique est fixé sur le fuseau `Europe/Paris` (dimanche 18h heure de Paris, peu importe où le bot est hébergé).
- `/ajouter` et `ajouter_tournoi.py` te demandent toujours l'heure **de Paris** ; la conversion en UTC (avec gestion automatique de l'heure d'été/hiver) est faite par le code via `luxon` (JS) / `zoneinfo` (Python).
- Les tournois dont la fin remonte à plus de 7 jours sont automatiquement retirés de `tournaments.json` à chaque lecture (pour ne pas accumuler indéfiniment), mais ils restent visibles pendant ces 7 jours dans le récap.
