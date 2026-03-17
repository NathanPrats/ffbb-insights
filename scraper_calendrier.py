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

_SUFFIX_RE = re.compile(r' - \d+$')


def _normalize(name: str) -> str:
    """Supprime le suffixe ' - N' pour comparer noms classement et calendrier."""
    return _SUFFIX_RE.sub("", name)

# URL de base par défaut (backward compat — DM1 Pré Régionale Masculine IDF)
_DEFAULT_BASE_URL = (
    "https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/prm"
)


def _extract_json_array_at(chunk: str, bracket: int) -> list[dict] | None:
    """Extrait un tableau JSON depuis la position `bracket` dans `chunk`."""
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
                    return None
    return None


def extract_rencontres_from_chunks(chunks: list[str]) -> list[list[dict]]:
    """
    Cherche TOUTES les occurrences du tableau JSON "rencontres" dans les chunks RSC.
    Retourne une liste de tableaux (un par occurrence trouvée).

    Plusieurs occurrences peuvent exister sur les compétitions multi-poules où
    le RSC contient les données de plusieurs poules simultanément.
    """
    all_arrays: list[list[dict]] = []
    for chunk in chunks:
        start = 0
        while True:
            idx = chunk.find('"rencontres":', start)
            if idx == -1:
                break
            bracket = chunk.find('[', idx)
            if bracket == -1:
                break
            arr = _extract_json_array_at(chunk, bracket)
            if arr is not None:
                all_arrays.append(arr)
            start = bracket + 1
    return all_arrays


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


def scrape_calendrier(url: str, team_filter: set[str] | None = None) -> list[dict]:
    """
    Récupère tout le calendrier de la saison en une seule requête depuis `url`.
    Le payload RSC contient toutes les rencontres de la saison.

    `team_filter` : ensemble de noms d'équipes normalisés (sans suffixe ' - N').
    Si fourni, seules les rencontres dont les deux équipes sont dans ce filtre
    sont conservées — nécessaire pour les compétitions multi-poules où le RSC
    peut retourner les rencontres d'une autre poule par défaut.
    """
    print(f"Fetching calendrier... ({url})")
    html = fetch_raw_html(url)
    chunks = extract_rsc_chunks(html)

    all_arrays = extract_rencontres_from_chunks(chunks)
    if not all_arrays:
        raise RuntimeError(
            "Impossible d'extraire les rencontres depuis le payload RSC. "
            "Vérifier si la structure du site FFBB a changé."
        )

    if team_filter:
        # Parcourir tous les tableaux et garder celui avec le plus de matchs
        # correspondant aux équipes du classement (compétitions multi-poules :
        # le RSC peut contenir les données de toutes les poules de la phase).
        best: list[dict] = []
        for arr in all_arrays:
            filtered = [
                r for r in arr
                if _normalize(r["idEngagementEquipe1"]["nom"]) in team_filter
                and _normalize(r["idEngagementEquipe2"]["nom"]) in team_filter
            ]
            if len(filtered) > len(best):
                best = filtered

        if not best:
            raise RuntimeError(
                "Aucune rencontre RSC ne correspond aux équipes du classement. "
                "L'URL du calendrier retourne peut-être des données d'une autre poule. "
                "Vérifier l'URL ou la structure du site FFBB."
            )

        rencontres_raw = best
        print(f"{len(all_arrays)} tableau(x) RSC → {len(rencontres_raw)} rencontres retenues pour cette poule.")
    else:
        rencontres_raw = all_arrays[0]
        print(f"{len(rencontres_raw)} rencontres trouvées.")

    return group_by_date(rencontres_raw)


def scrape_calendrier_to_file(
    url: str,
    output: str,
    meta: dict | None = None,
    team_filter: set[str] | None = None,
) -> None:
    """Scrape le calendrier depuis `url` et sauvegarde dans `output`."""
    if meta is None:
        meta = {}

    journees = scrape_calendrier(url, team_filter)

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
