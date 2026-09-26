require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const TOURNAMENTS_FILE = path.join(__dirname, 'tournaments.json');
const USER_AGENT = process.env.LIQUIPEDIA_USER_AGENT;
const API_BASE = 'https://liquipedia.net/fortnite/api.php';
const SOURCE_TAG = 'liquipedia-auto';

if (!USER_AGENT || USER_AGENT.includes('TonProjet')) {
  console.error(
    "LIQUIPEDIA_USER_AGENT manquant ou pas personnalisé dans .env.\n" +
    "Liquipedia impose un User-Agent identifiant ton projet + un contact (obligatoire, sinon blocage).\n" +
    "Exemple : LIQUIPEDIA_USER_AGENT=\"MonBotFortnite/1.0 (discord: tonpseudo)\"",
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function liquipediaFetch(params, { isParse = false } = {}) {
  const url = `${API_BASE}?${new URLSearchParams({ ...params, format: 'json' }).toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Liquipedia a répondu ${res.status} pour ${url}`);
  const data = await res.json();
  // Respect des quotas de l'API : 1 requête/2s en général, 1 requête "parse"/30s
  await sleep(isParse ? 30000 : 2000);
  return data;
}

async function getCategoryMembers(category) {
  const members = [];
  let cmcontinue;
  do {
    const data = await liquipediaFetch({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmnamespace: '0',
      cmlimit: '500',
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    members.push(...(data.query?.categorymembers || []).map((m) => m.title));
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);
  return members;
}

function extractField(wikitext, keys) {
  for (const key of keys) {
    const match = wikitext.match(new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n|}]+)`, 'i'));
    if (match) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return null;
}

// Liquipedia donne des dates dans plusieurs formats selon les pages ; on essaie les plus courants.
function parseLiquipediaDate(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/\[\[|\]\]/g, '').trim();
  const formats = ['yyyy-MM-dd', 'MMMM d, yyyy', 'MMM d, yyyy', 'd MMMM yyyy'];
  for (const fmt of formats) {
    const dt = DateTime.fromFormat(cleaned, fmt, { zone: 'Europe/Paris' });
    if (dt.isValid) return dt;
  }
  const iso = DateTime.fromISO(cleaned, { zone: 'Europe/Paris' });
  return iso.isValid ? iso : null;
}

function guessCategory(title, series) {
  const text = `${title} ${series || ''}`.toLowerCase();
  if (text.includes('fncs')) return 'FNCS';
  if (text.includes('cash cup')) return 'Cash Cup';
  if (text.includes('victory cup') || text.includes('arena')) return 'Arena';
  return 'Autre';
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function fetchTournamentDetails(title) {
  const data = await liquipediaFetch({ action: 'parse', page: title, prop: 'wikitext' }, { isParse: true });
  const wikitext = data.parse?.wikitext?.['*'];
  if (!wikitext) return null;

  const series = extractField(wikitext, ['series', 'name']);
  const format = extractField(wikitext, ['format']);
  const startRaw = extractField(wikitext, ['sdate', 'date']);
  const endRaw = extractField(wikitext, ['edate', 'date2', 'sdate', 'date']);

  const startDt = parseLiquipediaDate(startRaw);
  if (!startDt) {
    console.warn(`"${title}" ignoré : date introuvable ou non reconnue (${startRaw}).`);
    return null;
  }
  const endDt = parseLiquipediaDate(endRaw) || startDt.endOf('day');

  const displayName = title.split('/').slice(-2).join(' - ').replace(/_/g, ' ');
  const pageUrl = `https://liquipedia.net/fortnite/${encodeURIComponent(title.replace(/ /g, '_'))}`;

  return {
    id: `liquipedia-${slugify(title)}`,
    name: displayName,
    type: guessCategory(title, series),
    region: 'EU',
    format: format || undefined,
    startDate: startDt.startOf('day').toUTC().toISO({ suppressMilliseconds: true }),
    endDate: endDt.endOf('day').toUTC().toISO({ suppressMilliseconds: true }),
    description: `Source : [Liquipedia](${pageUrl}) (CC BY-SA). Horaire précis à confirmer sur fortnite.com/competitive.`,
    link: pageUrl,
    source: SOURCE_TAG,
  };
}

async function sync() {
  console.log('Récupération des tournois à venir (catégorie "Upcoming Tournaments")...');
  const upcoming = await getCategoryMembers('Upcoming_Tournaments');
  console.log('Récupération des tournois européens (catégorie "European Tournaments")...');
  const european = await getCategoryMembers('European_Tournaments');

  const europeanSet = new Set(european);
  const targets = upcoming.filter((title) => europeanSet.has(title));

  console.log(`${targets.length} tournoi(s) EU à venir trouvé(s) sur Liquipedia. Récupération des détails (peut prendre du temps, quota API oblige)...`);

  const fetched = [];
  for (const title of targets) {
    try {
      const entry = await fetchTournamentDetails(title);
      if (entry) fetched.push(entry);
    } catch (err) {
      console.error(`Erreur sur "${title}" :`, err.message);
    }
  }

  const existing = fs.existsSync(TOURNAMENTS_FILE)
    ? JSON.parse(fs.readFileSync(TOURNAMENTS_FILE, 'utf-8'))
    : [];
  const manualEntries = existing.filter((t) => t.source !== SOURCE_TAG);
  const merged = [...manualEntries, ...fetched];

  fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`Synchro terminée : ${fetched.length} tournoi(s) Liquipedia + ${manualEntries.length} entrée(s) manuelle(s) conservée(s).`);

  return { added: fetched.length, kept: manualEntries.length };
}

module.exports = { sync };

if (require.main === module) {
  sync().catch((err) => {
    console.error('Échec de la synchro :', err);
    process.exit(1);
  });
}
