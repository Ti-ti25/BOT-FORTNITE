require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TOURNAMENTS_FILE = path.join(__dirname, 'tournaments.json');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

if (!TOKEN || !CHANNEL_ID) {
  console.error('DISCORD_TOKEN et/ou CHANNEL_ID manquants dans le fichier .env.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Couleur d'embed par type de compétition
const COLORS = {
  FNCS: 0x8E44AD,       // violet
  'Cash Cup': 0xE8B34D, // or
  Arena: 0x3498DB,      // bleu
  Default: 0x2ECC71,    // vert par défaut
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function loadTournaments() {
  try {
    const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('tournaments.json doit contenir un tableau.');
    return parsed;
  } catch (err) {
    console.error('Erreur de lecture de tournaments.json :', err.message);
    return [];
  }
}

function getTournamentsInWindow() {
  const now = Date.now();
  const windowStart = now; // <-- On commence strictement à maintenant (suppression des 7 jours en arrière)
  const windowEnd = now + WEEK_MS;

  return loadTournaments()
    .map((t) => ({
      ...t,
      _start: new Date(t.startDate).getTime(),
      _end: new Date(t.endDate || t.startDate).getTime(),
    }))
    .filter((t) => {
      if (Number.isNaN(t._start)) {
        console.warn(`Tournoi "${t.name || t.id}" ignoré : startDate invalide.`);
        return false;
      }
      return t._end >= windowStart && t._start <= windowEnd;
    })
    .sort((a, b) => a._start - b._start);
}

// Nouvelle fonction pour un affichage court et lisible
function formatTournamentDate(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : start;

  const optionsDay = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' };
  const dateFormatted = start.toLocaleDateString('fr-FR', optionsDay);

  const startHour = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', 'h');
  const endHour = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', 'h');

  const startClean = startHour.replace('h00', 'h');
  const endClean = endHour.replace('h00', 'h');

  // Si c'est la même journée
  if (start.toDateString() === end.toDateString()) {
    if (startClean === endClean) {
      return `${dateFormatted} à ${startClean}`;
    }
    return `${dateFormatted} de ${startClean} à ${endClean}`;
  }

  // Si c'est sur plusieurs jours
  return `${dateFormatted} → ${end.toLocaleDateString('fr-FR', optionsDay)}`;
}

function buildEmbed(t) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${t.name || 'Compétition Fortnite'}`)
    .setDescription(t.description || "Voir l'onglet Compétition en jeu pour les détails.")
    .addFields(
      { name: 'Quand', value: formatTournamentDate(t.startDate, t.endDate), inline: true },
      { name: 'Format', value: t.type || 'Non précisé', inline: true }
    )
    .setColor(COLORS[t.type] || COLORS.Default)
    .setFooter({ text: 'Compétitions Fortnite' })
    .setTimestamp(new Date(t.startDate));

  if (t.region) {
    embed.addFields({ name: 'Région', value: t.region, inline: true });
  }
  if (t.image) embed.setImage(t.image);
  if (t.link) embed.setURL(t.link);

  return embed;
}

async function sendRecap(channel) {
  const tournaments = getTournamentsInWindow();

  if (tournaments.length === 0) {
    await channel.send('📅 Aucune compétition Fortnite officielle dans les 7 derniers jours ni les 7 prochains jours.');
    return;
  }

  await channel.send(`📅 **Compétitions Fortnite — semaine du ${dateFormatter.format(new Date())}**`);
  for (const t of tournaments) {
    await channel.send({ embeds: [buildEmbed(t)] });
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Bot connecté sous le nom : ${c.user.tag}`);

  cron.schedule('0 18 * * 0', async () => {
    console.log('Récapitulatif automatique du dimanche 18h00...');
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) await sendRecap(channel);
    } catch (err) {
      console.error('Erreur lors du récap automatique :', err);
    }
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'competitions') return;

  await interaction.deferReply();
  try {
    await sendRecap(interaction.channel);
    await interaction.editReply('Voilà les compétitions en cours ! 🏆');
  } catch (err) {
    console.error('Erreur lors de la commande /competitions :', err);
    await interaction.editReply("Une erreur est survenue en récupérant les compétitions.");
  }
});

client.login(TOKEN);