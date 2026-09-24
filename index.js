require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TOURNAMENTS_FILE = path.join(__dirname, 'tournaments.json');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MON_DISCORD_ID = "1292831744562696267"; // Ton ID Discord sécurisé pour /ajouter

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
  const windowStart = now; // On commence strictement à maintenant
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

// Fonction pour un affichage court et lisible de la date
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
    await channel.send('📅 Aucune compétition Fortnite officielle dans les 7 prochains jours.');
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

// Gestion unique des interactions (commandes slash)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Gestion de la commande /competitions
  if (interaction.commandName === 'competitions') {
    await interaction.deferReply();
    try {
      await sendRecap(interaction.channel);
      await interaction.editReply('Voilà les compétitions en cours ! 🏆');
    } catch (err) {
      console.error('Erreur lors de la commande /competitions :', err);
      await interaction.editReply("Une erreur est survenue en récupérant les compétitions.");
    }
  }

  // Gestion de la commande /ajouter
  if (interaction.commandName === 'ajouter') {
    // Sécurité : Vérifie si c'est bien ton compte
    if (interaction.user.id !== MON_DISCORD_ID) {
      return interaction.reply({
        content: "Tu n'as pas la permission d'utiliser cette commande !",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const nom = interaction.options.getString('nom');
    const type = interaction.options.getString('type');
    const date = interaction.options.getString('date'); // Format attendu : YYYY-MM-DD
    const debut = interaction.options.getString('debut'); // Format attendu : HH:MM
    const fin = interaction.options.getString('fin');     // Format attendu : HH:MM

    try {
      const startDate = `${date}T${debut}:00`;
      const endDate = `${date}T${fin}:00`;

      const newEntry = {
        id: `tournament-${Date.now()}`,
        name: nom,
        type: type,
        region: "EU",
        startDate: startDate,
        endDate: endDate,
        description: `🎮 **Mode :** Battle Royale\n👥 **Format :** ${type}`
      };

      // Lecture et mise à jour propre du fichier tournaments.json
      let tournaments = [];
      if (fs.existsSync(TOURNAMENTS_FILE)) {
        const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8');
        tournaments = JSON.parse(raw);
      }

      tournaments.push(newEntry);
      fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(tournaments, null, 2), 'utf-8');

      await interaction.editReply(`✅ Le tournoi **${nom}** a bien été ajouté pour le ${date} de ${debut} à ${fin} !`);
    } catch (err) {
      console.error('Erreur lors de l\'ajout du tournoi :', err);
      await interaction.editReply("❌ Une erreur est survenue lors de l'enregistrement du tournoi.");
    }
  }
});

client.login(TOKEN);
