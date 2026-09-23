require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optionnel

if (!TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN et/ou CLIENT_ID manquants dans le fichier .env.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('competitions')
    .setDescription('Affiche les compétitions Fortnite officielles des 7 derniers/prochains jours'),
].map((c) => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) // instantané, pour tester
      : Routes.applicationCommands(CLIENT_ID); // global, peut prendre jusqu'à 1h

    await rest.put(route, { body: commands });
    console.log(`Commande /competitions déployée (${GUILD_ID ? 'serveur de test' : 'global'}).`);
  } catch (err) {
    console.error(err);
  }
})();
const commands = [
  new SlashCommandBuilder()
    .setName('competitions')
    .setDescription('Affiche les compétitions Fortnite officielles des 7 derniers/prochains jours'),
  new SlashCommandBuilder()
    .setName('ajouter')
    .setDescription('Ajouter un tournoi Fortnite (Réservé au créateur)')
    .addStringOption(option =>
      option.setName('nom')
        .setDescription('Nom du tournoi')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type de tournoi (ex: FNCS, Cash Cup, Duo...)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Date au format YYYY-MM-DD')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('debut')
        .setDescription('Heure de début (ex: 18:00)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('fin')
        .setDescription('Heure de fin (ex: 20:00)')
        .setRequired(true)),
].map((c) => c.toJSON());
