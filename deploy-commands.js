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
    .setDescription('Ajouter un tournoi Fortnite')
    .addStringOption(option => option.setName('nom').setDescription('Nom').setRequired(true))
    .addStringOption(option => option.setName('type').setDescription('Type').setRequired(true))
    .addStringOption(option => option.setName('date').setDescription('Date YYYY-MM-DD').setRequired(true))
    .addStringOption(option => option.setName('debut').setDescription('Debut HH:MM').setRequired(true))
    .addStringOption(option => option.setName('fin').setDescription('Fin HH:MM').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Déploiement des commandes en cours...');
    const route = GUILD_ID 
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log('✅ Commandes déployées avec succès !');
  } catch (error) {
    console.error(error);
  }
})();
