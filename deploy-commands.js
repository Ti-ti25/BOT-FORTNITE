require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN et/ou CLIENT_ID manquants.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('competitions')
    .setDescription('Affiche les compétitions Fortnite officielles des 7 derniers/prochains jours'),

  new SlashCommandBuilder()
    .setName('ajouter')
    .setDescription('Ajouter un tournoi Fortnite (réservé à l\'administrateur)')
    .addStringOption((option) =>
      option.setName('nom').setDescription('Nom du tournoi').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('categorie')
        .setDescription('Catégorie de la compétition')
        .setRequired(true)
        .addChoices(
          { name: 'FNCS', value: 'FNCS' },
          { name: 'Cash Cup', value: 'Cash Cup' },
          { name: 'Arena', value: 'Arena' },
          { name: 'Autre', value: 'Autre' },
        ))
    .addStringOption((option) =>
      option.setName('date').setDescription('Date au format AAAA-MM-JJ, ex: 2026-09-27').setRequired(true))
    .addStringOption((option) =>
      option.setName('debut').setDescription('Heure de début (Paris), format HH:MM, ex: 18:00').setRequired(true))
    .addStringOption((option) =>
      option.setName('fin').setDescription('Heure de fin (Paris), format HH:MM, ex: 20:00').setRequired(true))
    .addStringOption((option) =>
      option.setName('format').setDescription('Format de jeu, ex: Solo, Duo, Trio, Squad').setRequired(false))
    .addStringOption((option) =>
      option.setName('lien').setDescription('Lien vers les infos officielles').setRequired(false)),

  new SlashCommandBuilder()
    .setName('supprimer')
    .setDescription('Supprimer un tournoi par ID ou par nom (réservé à l\'administrateur)')
    .addStringOption((option) =>
      option.setName('id_ou_nom').setDescription('ID exact ou morceau du nom du tournoi').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Resynchroniser les tournois EU depuis Liquipedia (réservé à l\'administrateur)'),
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Déploiement des commandes en cours...');
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log(`✅ Commandes déployées avec succès (${GUILD_ID ? 'serveur de test' : 'global'}) !`);
  } catch (error) {
    console.error(error);
  }
})();
