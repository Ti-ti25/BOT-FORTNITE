import json
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(SCRIPT_DIR, 'tournaments.json')
PARIS_TZ = ZoneInfo('Europe/Paris')

MONTHS = {
    'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
    'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12,
}


def parse_fr_datetime_to_utc(date_str, hour):
    """Interprète une date/heure comme heure LOCALE de Paris (gère été/hiver
    automatiquement via zoneinfo), puis la convertit en UTC."""
    parts = date_str.strip().split()
    day = int(parts[0])
    month = MONTHS[parts[1].lower()]
    year = int(parts[2]) if len(parts) > 2 else 2026

    local_dt = datetime(year, month, day, hour, 0, 0, tzinfo=PARIS_TZ)
    return local_dt.astimezone(ZoneInfo('UTC'))


def main():
    print("📋 Colle tes 5 lignes d'une session, puis appuie sur ENTRÉE :")
    lines = []
    while True:
        try:
            line = input()
            if not line.strip() and len(lines) >= 5:
                break
            if line.strip():
                lines.append(line.strip())
            if len(lines) == 5:
                break
        except EOFError:
            break

    if len(lines) < 5:
        print("❌ Erreur : Il faut coller 5 lignes.")
        return

    name = lines[0].replace(':', '').strip()
    categorie = lines[1]   # ex: FNCS, Cash Cup, Arena
    format_jeu = lines[2]  # ex: Solo, Duo, Trio, Squad
    date_raw = lines[3]
    hours_raw = lines[4]

    hours = re.findall(r'(\d+)h', hours_raw)
    start_hour = int(hours[0]) if len(hours) >= 1 else 18
    end_hour = int(hours[1]) if len(hours) >= 2 else 20

    start_dt = parse_fr_datetime_to_utc(date_raw, start_hour)
    end_dt = parse_fr_datetime_to_utc(date_raw, end_hour)

    new_entry = {
        "id": f"tournament-{int(datetime.now().timestamp())}",
        "name": name,
        "type": categorie,
        "region": "EU",
        "startDate": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDate": end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "format": format_jeu,
        "description": f"🎮 **Catégorie :** {categorie}\n👥 **Format :** {format_jeu}",
    }

    tournaments = []
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            try:
                tournaments = json.load(f)
            except json.JSONDecodeError:
                tournaments = []

    tournaments.append(new_entry)

    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(tournaments, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Session enregistrée pour le {date_raw} ({start_hour}h-{end_hour}h, heure de Paris) !")


if __name__ == '__main__':
    main()
