"""
Scraper pour le calendrier FFBB - Pré Régionale Masculine
Cible : https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/prm?phase=<id>&poule=<id>&jour=YYYY-MM-DD
Stratégie : Les 132 rencontres de la saison sont dans un seul chunk RSC (chunk data de la page).
            Une seule requête suffit pour récupérer tout le calendrier.

Usage:
    python3 scraper_calendrier.py --phase 200000002872715 --poule 200000003018348 [--output data/calendrier.json]
"""

import re
import json
import argparse
from datetime import date, datetime

from ffbb_rsc import fetch_raw_html, extract_rsc_chunks

BASE_URL = "https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/prm"

# Date arbitraire pour déclencher le rendu RSC complet de la saison
SEED_DATE = "2026-01-10"


def build_url(phase: str, poule: str, jour: str) -> str:
    return f"{BASE_URL}?phase={phase}&poule={poule}&jour={jour}"


def extract_rencontres_from_chunks(chunks: list[str]) -> list[dict]:
    """
    Cherche le tableau JSON "rencontres" dans les chunks RSC.
    Ce tableau contient toutes les rencontres de la saison.
    Retourne la liste brute des objets rencontre.
    """
    for chunk in chunks:
        idx = chunk.find('"rencontres":')
        if idx == -1:
            continue

        bracket = chunk.find('[', idx)
        if bracket == -1:
            continue

        depth = 0
        for i in range(bracket, len(chunk)):
            if chunk[i] == '[':
                depth += 1
            elif chunk[i] == ']':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(chunk[bracket:i + 1])
                    except json.JSONDecodeError:
                        break

    return []


def normalize_rencontre(raw: dict) -> dict:
    """Transforme un objet rencontre brut en format canonique du calendrier."""
    dt = datetime.fromisoformat(raw["date_rencontre"])
    return {
        "heure": dt.strftime("%H:%M"),
        "domicile": raw["idEngagementEquipe1"]["nom"],
        "visiteur": raw["idEngagementEquipe2"]["nom"],
        "score_dom": int(raw["resultatEquipe1"]) if raw.get("resultatEquipe1") else None,
        "score_vis": int(raw["resultatEquipe2"]) if raw.get("resultatEquipe2") else None,
        "joue": bool(raw.get("joue", False)),
    }


def group_by_date(rencontres_raw: list[dict]) -> list[dict]:
    """Groupe les rencontres brutes par date et les normalise."""
    by_date: dict[str, list[dict]] = {}
    for r in rencontres_raw:
        dt = datetime.fromisoformat(r["date_rencontre"])
        jour = dt.date().isoformat()
        by_date.setdefault(jour, []).append(normalize_rencontre(r))

    return [
        {"date": jour, "matchs": matchs}
        for jour, matchs in sorted(by_date.items())
    ]


def scrape_calendrier(phase: str, poule: str) -> list[dict]:
    """
    Récupère tout le calendrier de la saison en une seule requête.
    Le payload RSC d'une page calendrier quelconque contient les 132 rencontres.
    """
    url = build_url(phase, poule, SEED_DATE)
    print(f"Fetching calendrier... ({url})")
    html = fetch_raw_html(url)
    chunks = extract_rsc_chunks(html)

    rencontres_raw = extract_rencontres_from_chunks(chunks)
    if not rencontres_raw:
        raise RuntimeError(
            "Impossible d'extraire les rencontres depuis le payload RSC. "
            "Vérifier si la structure du site FFBB a changé."
        )

    print(f"{len(rencontres_raw)} rencontres trouvées.")
    return group_by_date(rencontres_raw)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape le calendrier FFBB")
    parser.add_argument("--phase",  required=True, help="ID de la phase (ex: 200000002872715)")
    parser.add_argument("--poule",  required=True, help="ID de la poule  (ex: 200000003018348)")
    parser.add_argument("--output", default="data/calendrier.json", help="Fichier de sortie JSON (défaut: data/calendrier.json)")
    return parser.parse_args()


def main():
    args = parse_args()

    journees = scrape_calendrier(args.phase, args.poule)

    result = {
        "phase": args.phase,
        "poule": args.poule,
        "scraped_at": date.today().isoformat(),
        "journees": journees,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total_matchs = sum(len(j["matchs"]) for j in journees)
    print(f"Calendrier sauvegardé dans {args.output} ({len(journees)} journées, {total_matchs} matchs).")


if __name__ == "__main__":
    main()
