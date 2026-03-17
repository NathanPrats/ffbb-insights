"""
Scraper pour le calendrier FFBB.
Stratégie : Les rencontres de la saison sont dans un seul chunk RSC.
            Une seule requête suffit pour récupérer tout le calendrier.

Usage avec URL complète (recommandé) :
    python scraper_calendrier.py --url "https://competitions.ffbb.com/.../classement?phase=X&poule=Y"
    (l'URL de classement suffit — l'URL du calendrier est dérivée automatiquement)

Usage avec IDs bruts (backward compat, DM1 IDF par défaut) :
    python scraper_calendrier.py --phase 200000002872715 --poule 200000003018348 [--output data/calendrier.json]
"""

import re
import json
import argparse
from datetime import date, datetime

from ffbb_rsc import fetch_raw_html, extract_rsc_chunks, parse_ffbb_url

# URL de base par défaut (backward compat — DM1 Pré Régionale Masculine IDF)
_DEFAULT_BASE_URL = (
    "https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/prm"
)


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


def scrape_calendrier(url: str) -> list[dict]:
    """
    Récupère tout le calendrier de la saison en une seule requête depuis `url`.
    Le payload RSC contient toutes les rencontres de la saison.
    """
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


def scrape_calendrier_to_file(url: str, output: str, meta: dict | None = None) -> None:
    """Scrape le calendrier depuis `url` et sauvegarde dans `output`."""
    if meta is None:
        meta = {}

    journees = scrape_calendrier(url)

    result = {
        "phase":      meta.get("phase", ""),
        "poule":      meta.get("poule", ""),
        "scraped_at": date.today().isoformat(),
        "journees":   journees,
    }

    with open(output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total_matchs = sum(len(j["matchs"]) for j in journees)
    print(f"Calendrier sauvegardé dans {output} ({len(journees)} journées, {total_matchs} matchs).")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape le calendrier FFBB",
        epilog="Utiliser --url (URL du classement) OU --phase + --poule.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url",   help="URL de la page classement FFBB (l'URL du calendrier est dérivée automatiquement)")
    group.add_argument("--phase", help="ID de la phase (ex: 200000002872715)")
    parser.add_argument("--poule",    help="ID de la poule (requis avec --phase)")
    parser.add_argument("--base-url", default=_DEFAULT_BASE_URL,
                        help="URL de base utilisée avec --phase/--poule")
    parser.add_argument("--output", default="data/calendrier.json",
                        help="Fichier de sortie JSON (défaut: data/calendrier.json)")
    return parser.parse_args()


def main():
    args = parse_args()

    if args.url:
        meta = parse_ffbb_url(args.url)
        cal_url = meta["calendrier_url"]
    else:
        if not args.poule:
            raise SystemExit("--poule est requis quand --phase est utilisé")
        cal_url = f"{args.base_url}?phase={args.phase}&poule={args.poule}&jour={date.today().isoformat()}"
        meta = {"phase": args.phase, "poule": args.poule}

    scrape_calendrier_to_file(cal_url, args.output, meta)


if __name__ == "__main__":
    main()
