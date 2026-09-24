require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { DateTime } = require('luxon');
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_ID = process.env.ADMIN_ID;
const TOURNAMENTS_FILE = path.join(__dirname, 'tournaments.json');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PARIS_ZONE = 'Europe/Paris';

if (!TOKEN || !CHANNEL_ID) {
  console.error('DISCORD_TOKEN et/ou CHANNEL_ID manquants dans le fichier .env.');
  process.exit(1);
}
if (!ADMIN_ID) {
  console.warn('ADMIN_ID absent du .env : /ajouter et /supprimer seront refusés à tout le monde.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Couleur d'embed par CATÉGORIE (pas par format de jeu)
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
  timeZone: PARIS_ZONE,
});

function readTournamentsFile() {
  try {
    if (!fs.existsSync(TOURNAMENTS_FILE)) return [];
    const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('tournaments.json doit contenir un tableau.');
    return parsed;
  } catch (err) {
    console.error('Erreur de lecture de tournaments.json :', err.message);
    return [];
  }
}

function writeTournamentsFile(tournaments) {
  fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(tournaments, null, 2), 'utf-8');
}

// Purge uniquement ce qui est plus vieux que la fenêtre affichée (fin < J-7),
// pour ne pas effacer un tournoi d'hier avant que /competitions ait pu le montrer.
function pruneOldTournaments() {
  const all = readTournamentsFile();
  const cutoff = Date.now() - WEEK_MS;
  const kept = all.filter((t) => new Date(t.endDate || t.startDate).getTime() >= cutoff);
  if (kept.length !== all.length) writeTournamentsFile(kept);
  return kept;
}

// Fenêtre : de -7 jours à +7 jours autour de maintenant
function getTournamentsInWindow() {
  const now = Date.now();
  const windowStart = now - WEEK_MS;
  const windowEnd = now + WEEK_MS;

  return pruneOldTournaments()
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

// Convertit une date/heure locale de Paris (saisie humaine) en ISO UTC,
// en gérant automatiquement l'heure d'été/hiver (contrairement à un simple -2h fixe).
function parisLocalToUtcIso(dateStr, timeStr) {
  const dt = DateTime.fromFormat(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', { zone: PARIS_ZONE });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO({ suppressMilliseconds: true });
}

function formatTournamentDate(startIso, endIso) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;

  const dateFmt = { weekday: 'long', day: 'numeric', month: 'long', timeZone: PARIS_ZONE };
  const timeFmt = { hour: '2-digit', minute: '2-digit', timeZone: PARIS_ZONE };

  const dateLabel = start.toLocaleDateString('fr-FR', dateFmt);
  const startTime = start.toLocaleTimeString('fr-FR', timeFmt).replace(':00', 'h').replace(':', 'h');
  const endTime = end.toLocaleTimeString('fr-FR', timeFmt).replace(':00', 'h').replace(':', 'h');

  const sameDay = start.toLocaleDateString('fr-FR', { timeZone: PARIS_ZONE })
    === end.toLocaleDateString('fr-FR', { timeZone: PARIS_ZONE });

  if (sameDay) {
    return startTime === endTime ? `${dateLabel} à ${startTime}` : `${dateLabel} de ${startTime} à ${endTime}`;
  }
  return `${dateLabel} → ${end.toLocaleDateString('fr-FR', dateFmt)}`;
}

function buildEmbed(t) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${t.name || 'Compétition Fortnite'}`)
    .setDescription(t.description || "Voir l'onglet Compétition en jeu pour les détails.")
    .addFields(
      { name: 'Quand', value: formatTournamentDate(t.startDate, t.endDate), inline: true },
      { name: 'Catégorie', value: t.type || 'Non précisée', inline: true },
    )
    .setColor(COLORS[t.type] || COLORS.Default)
    .setFooter({ text: 'Compétitions Fortnite' })
    .setTimestamp(new Date(t.startDate));

  if (t.format) embed.addFields({ name: 'Format', value: t.format, inline: true });
  if (t.region) embed.addFields({ name: 'Région', value: t.region, inline: true });
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

  // Récap automatique tous les dimanches à 18h00, heure de Paris
  cron.schedule('0 18 * * 0', async () => {
    console.log('Récapitulatif automatique du dimanche 18h00...');
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) await sendRecap(channel);
    } catch (err) {
      console.error('Erreur lors du récap automatique :', err);
    }
  }, { timezone: PARIS_ZONE });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'competitions') {
    await interaction.deferReply();
    try {
      await sendRecap(interaction.channel);
      await interaction.editReply('Voilà les compétitions en cours ! 🏆');
    } catch (err) {
      console.error('Erreur lors de la commande /competitions :', err);
      await interaction.editReply('Une erreur est survenue en récupérant les compétitions.');
    }
    return;
  }

  if (interaction.commandName === 'ajouter') {
    if (interaction.user.id !== ADMIN_ID) {
      await interaction.reply({ content: "Tu n'as pas la permission d'utiliser cette commande !", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const nom = interaction.options.getString('nom');
    const categorie = interaction.options.getString('categorie');
    const date = interaction.options.getString('date');
    const debut = interaction.options.getString('debut');
    const fin = interaction.options.getString('fin');
    const format = interaction.options.getString('format');
    const lien = interaction.options.getString('lien');

    const startDate = parisLocalToUtcIso(date, debut);
    const endDate = parisLocalToUtcIso(date, fin);

    if (!startDate || !endDate) {
      await interaction.editReply(
        '❌ Date ou heure invalide. Utilise le format AAAA-MM-JJ pour la date et HH:MM pour les heures (ex : 2026-09-27 et 18:00).',
      );
      return;
    }

    try {
      const newEntry = {
        id: `tournament-${Date.now()}`,
        name: nom,
        type: categorie,
        region: 'EU',
        startDate,
        endDate,
        format: format || undefined,
        link: lien || undefined,
        description: `🎮 **Catégorie :** ${categorie}${format ? `\n👥 **Format :** ${format}` : ''}`,
      };

      const tournaments = readTournamentsFile();
      tournaments.push(newEntry);
      writeTournamentsFile(tournaments);

      await interaction.editReply(`✅ Le tournoi **${nom}** a bien été ajouté pour le ${date} de ${debut} à ${fin} (heure de Paris) !`);
    } catch (err) {
      console.error("Erreur lors de l'ajout du tournoi :", err);
      await interaction.editReply("❌ Une erreur est survenue lors de l'enregistrement du tournoi.");
    }
    return;
  }

  if (interaction.commandName === 'supprimer') {
    if (interaction.user.id !== ADMIN_ID) {
      await interaction.reply({ content: "Tu n'as pas la permission d'utiliser cette commande !", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getString('id_ou_nom').trim();

    try {
      const tournaments = readTournamentsFile();
      const initialLength = tournaments.length;

      const filtered = tournaments.filter((t) => {
        const matchId = t.id === target;
        const matchName = t.name && t.name.toLowerCase().includes(target.toLowerCase());
        return !(matchId || matchName);
      });

      if (filtered.length === initialLength) {
        await interaction.editReply(`❌ Aucun tournoi trouvé correspondant à "${target}". Vérifie l'ID ou le nom.`);
        return;
      }

      writeTournamentsFile(filtered);
      await interaction.editReply(`✅ Le(s) tournoi(s) correspondant à **"${target}"** ont bien été supprimés !`);
    } catch (err) {
      console.error('Erreur lors de la suppression du tournoi :', err);
      await interaction.editReply('❌ Une erreur est survenue lors de la suppression.');
    }
  }
});

client.login(TOKEN);
