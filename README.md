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
3. Déploie la commande slash : `npm run deploy-commands`
4. Lance le bot : `npm start`

## Mettre à jour les compétitions

Édite `tournaments.json` (ou colle le JSON généré par l'outil web). Chaque entrée :

```json
{
  "id": "identifiant-unique",
  "name": "Nom affiché",
  "type": "FNCS",           // "FNCS", "Cash Cup", "Arena" ou autre
  "region": "EU",
  "startDate": "2026-09-27T17:00:00Z",  // toujours en UTC (le Z à la fin)
  "endDate": "2026-09-28T22:00:00Z",
  "description": "Texte libre affiché dans l'embed",
  "link": "https://www.fortnite.com/competitive",
  "image": ""                // URL d'image, optionnel
}
```

Aucun redémarrage nécessaire : le fichier est relu à chaque récap ou commande.

## Fonctionnement

- **Automatique** : tous les dimanches à 18h00 (heure du serveur qui héberge le bot), le bot poste dans `CHANNEL_ID` toutes les compétitions dont la période chevauche la fenêtre **-7 jours à +7 jours** autour de maintenant.
- **À la demande** : la commande `/competitions` fait exactement la même chose, dans le salon où elle est tapée.

## Limites à connaître

- Le bot ne va chercher aucune donnée sur Internet : si tu n'actualises pas `tournaments.json`, la liste ne bouge pas.
- Les horaires du cron dépendent du fuseau horaire du serveur qui exécute le bot (souvent UTC sur un hébergeur). Ajuste `'0 18 * * 0'` dans `index.js` si besoin.
