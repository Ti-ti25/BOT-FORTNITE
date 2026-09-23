import json
import os
import re
from datetime import datetime

JSON_FILE = 'tournaments.json'

def parse_fr_date(date_str, time_hour):
    months = {
        'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
        'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12
    }
    parts = date_str.strip().split()
    day = int(parts[0])
    month = months[parts[1].lower()]
    year = int(parts[2]) if len(parts) > 2 else 2026
    
    # Compensation décalage UTC+2 (heure d'été)
    utc_hour = time_hour - 2
    return datetime(year, month, day, utc_hour, 0, 0)

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
    format_type = lines[1]
    mode = lines[2]
    date_raw = lines[3]
    hours_raw = lines[4]

    # Extraction heures (18h20h -> début 18h, fin 20h)
    hours = re.findall(r'(\d+)h', hours_raw)
    start_hour = int(hours[0]) if len(hours) >= 1 else 18
    end_hour = int(hours[1]) if len(hours) >= 2 else 20

    # Date unique pour la session
    start_dt = parse_fr_date(date_raw, start_hour)
    end_dt = parse_fr_date(date_raw, end_hour)

    new_entry = {
        "id": f"tournament-{int(datetime.now().timestamp())}",
        "name": name,
        "type": format_type,
        "region": "EU",
        "startDate": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDate": end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "description": f"🎮 **Mode :** {mode}\n👥 **Format :** {format_type}"
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

    print(f"\n✅ Session enregistrée pour le {date_raw} ({start_hour}h00 - {end_hour}h00) !")

if __name__ == '__main__':
    main()