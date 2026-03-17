"""
Scraper pour le classement FFBB.
Stratégie : Parse le tableau HTML rendu côté serveur dans la page Next.js.

Usage avec URL complète (recommandé) :
    python scraper_classement.py --url "https://competitions.ffbb.com/.../classement?phase=X&poule=Y"

Usage avec IDs bruts (backward compat, DM1 IDF par défaut) :
    python scraper_classement.py --phase 200000002872715 --poule 200000003018348 [--output dm1.json]
"""

import html as _html
import re
import json
import argparse
from datetime import date

from ffbb_rsc import fetch_raw_html, extract_rsc_chunks, parse_ffbb_url

# URL de base par défaut (backward compat — DM1 Pré Régionale Masculine IDF)
_DEFAULT_BASE_URL = (
    "https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/prm/classement"
)


def extract_standings_from_html(html: str) -> list[dict]:
    """
    Le classement est rendu directement dans le HTML en <tr> (SSR).
    Chaque ligne d'équipe est un <tr class="h-[65px] bg-white" data-onboarding="...">.
    Structure des colonnes :
      td[0]  rang     (<span class="mr-[20px]">N</span>)
      td[1]  equipe   (<div class="min-w-[228px]...">NOM</div>)
      td[2]  pts      (texte du lien)
      td[3]  joues / gagnes / perdus / nuls  (4 <div> imbriqués)
      td[4-7] colonnes accessoires (non utilisées)
      td[8]  deux valeurs (non utilisées)
      td[9]  spacer
      td[10] bp / bc / diff  (3 <div> imbriqués)
    """
    def get_div_numbers(td_html: str) -> list[int]:
        return [int(n) for n in re.findall(r'<div[^>]*>(\d+)</div>', td_html)]

    standings = []
    row_re = re.compile(
        r'<tr class="h-\[65px\] bg-white"[^>]*data-onboarding[^>]*>(.*?)</tr>',
        re.DOTALL,
    )
    td_re = re.compile(r'<td[^>]*>(.*?)</td>', re.DOTALL)

    for row_m in row_re.finditer(html):
        tds = [m.group(1) for m in td_re.finditer(row_m.group(1))]
        if len(tds) < 11:
            continue

        rang_m = re.search(r'<span[^>]*>(\d+)</span>', tds[0])
        equipe_m = re.search(r'<div class="min-w-\[228px\][^"]*">([^<]+)</div>', tds[1])
        if not rang_m or not equipe_m:
            continue

        rang = int(rang_m.group(1))
        equipe = _html.unescape(equipe_m.group(1).strip())

        pts_text = re.sub(r'<[^>]+>', '', tds[2]).strip()
        if not pts_text.isdigit():
            continue
        pts = int(pts_text)

        wl = get_div_numbers(tds[3])
        if len(wl) < 4:
            continue
        joues, gagnes, perdus, nuls = wl[0], wl[1], wl[2], wl[3]

        bpbc = get_div_numbers(tds[10])
        if len(bpbc) < 2:
            continue
        bp, bc = bpbc[0], bpbc[1]

        standings.append({
            "rang": rang,
            "equipe": equipe,
            "pts": pts,
            "joues": joues,
            "gagnes": gagnes,
            "perdus": perdus,
            "nuls": nuls,
            "bp": bp,
            "bc": bc,
            "penalites": 0,
        })

    return standings


def extract_from_rsc_payload(payload: str, standings: list) -> None:
    """Cherche les données de classement dans un payload RSC texte (conservé pour les tests unitaires)."""
    lines = payload.split("\n")
    for line in lines:
        if any(k in line for k in ['"rang"', '"classement"', '"position"', '"pts"']):
            try:
                json_part = re.sub(r'^\w+:', '', line.strip())
                data = json.loads(json_part)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and looks_like_team(item):
                            standings.append(normalize_team(item))
                elif isinstance(data, dict) and looks_like_team(data):
                    standings.append(normalize_team(data))
            except (json.JSONDecodeError, ValueError):
                continue


def looks_like_team(obj: dict) -> bool:
    """Vérifie si un dict ressemble à une entrée de classement."""
    keys = {k.lower() for k in obj.keys()}
    return bool(
        keys & {"rang", "classement", "position", "equipe", "club", "nom"}
        and keys & {"pts", "points", "victoires", "gagnes"}
    )


def normalize_team(raw: dict) -> dict:
    """Normalise les clés variables du payload en un format canonique."""
    key_map = {
        # Rang
        "rang": "rang", "rank": "rang", "position": "rang", "classement": "rang",
        # Équipe
        "equipe": "equipe", "club": "equipe", "nom": "equipe", "name": "equipe",
        "libelle": "equipe",
        # Statistiques
        "pts": "pts", "points": "pts",
        "joues": "joues", "matchs_joues": "joues", "j": "joues",
        "gagnes": "gagnes", "victoires": "gagnes", "g": "gagnes",
        "perdus": "perdus", "defaites": "perdus", "p": "perdus",
        "nuls": "nuls", "n": "nuls",
        "bp": "bp", "pour": "bp", "points_pour": "bp",
        "bc": "bc", "contre": "bc", "points_contre": "bc",
        "pen": "penalites", "penalites": "penalites",
    }
    normalized = {}
    for k, v in raw.items():
        canonical = key_map.get(k.lower(), k.lower())
        normalized[canonical] = v
    return normalized


def scrape_with_playwright(url: str) -> list[dict]:
    """Fallback : utilise Playwright pour rendre la page et parser le tableau."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright non installé. Installer avec : pip install playwright && playwright install chromium")
        return []

    standings = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=30_000)
        page.wait_for_selector("table, [class*='classement'], [class*='standing']", timeout=15_000)
        rows = page.query_selector_all(
            "table tbody tr, [class*='classement'] [class*='row'], [class*='standing'] [class*='row']"
        )
        for i, row in enumerate(rows):
            cells = row.query_selector_all("td, [class*='cell']")
            texts = [c.inner_text().strip() for c in cells]
            if len(texts) >= 4:
                try:
                    standings.append({
                        "rang": i + 1,
                        "equipe": texts[1] if len(texts) > 1 else texts[0],
                        "pts": int(texts[2]) if texts[2].isdigit() else None,
                        "joues": int(texts[3]) if len(texts) > 3 and texts[3].isdigit() else None,
                        "gagnes": int(texts[4]) if len(texts) > 4 and texts[4].isdigit() else None,
                        "perdus": int(texts[5]) if len(texts) > 5 and texts[5].isdigit() else None,
                        "nuls": int(texts[6]) if len(texts) > 6 and texts[6].isdigit() else None,
                        "bp": int(texts[7]) if len(texts) > 7 and texts[7].isdigit() else None,
                        "bc": int(texts[8]) if len(texts) > 8 and texts[8].isdigit() else None,
                        "penalites": int(texts[9]) if len(texts) > 9 and texts[9].isdigit() else 0,
                    })
                except (ValueError, IndexError):
                    continue
        browser.close()
    return standings


def scrape_classement(url: str, output: str, meta: dict | None = None) -> None:
    """
    Scrape le classement FFBB depuis `url` et sauvegarde le résultat dans `output`.

    `meta` est un dict optionnel avec les clés ligue/comite/competition/phase/poule
    (typiquement issu de parse_ffbb_url). S'il est absent, les valeurs sont déduites de l'URL.
    """
    if meta is None:
        try:
            meta = parse_ffbb_url(url)
        except ValueError:
            meta = {}

    print(f"Fetching classement... ({url})")
    try:
        html = fetch_raw_html(url)
        print(f"HTML fetched ({len(html)} chars). Parsing HTML table...")
        standings = extract_standings_from_html(html)
    except Exception as e:
        print(f"Erreur lors de la récupération de la page : {e}")
        standings = []

    if not standings:
        print("HTML parsing yielded no results. Trying Playwright fallback...")
        standings = scrape_with_playwright(url)

    if not standings:
        raise RuntimeError(
            "Impossible de récupérer le classement : le parsing HTML et le fallback Playwright "
            "n'ont retourné aucune donnée. Vérifier si la structure du site FFBB a changé."
        )

    result = {
        "competition": meta.get("competition", ""),
        "ligue":       meta.get("ligue", ""),
        "comite":      meta.get("comite", ""),
        "phase":       meta.get("phase", ""),
        "poule":       meta.get("poule", ""),
        "source_url":  url,
        "scraped_at":  date.today().isoformat(),
        "classement":  standings,
    }

    with open(output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Classement sauvegardé dans {output} ({len(standings)} équipes).")
    for team in standings:
        print(f"  {team['rang']:2d}. {team['equipe']:<50} {team['pts']} pts")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape le classement FFBB",
        epilog="Utiliser --url OU --phase + --poule.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url",   help="URL complète de la page classement FFBB")
    group.add_argument("--phase", help="ID de la phase (ex: 200000002872715)")
    parser.add_argument("--poule",    help="ID de la poule (requis avec --phase)")
    parser.add_argument("--base-url", default=_DEFAULT_BASE_URL,
                        help="URL de base utilisée avec --phase/--poule")
    parser.add_argument("--output", default="data/dm1.json",
                        help="Fichier de sortie JSON (défaut: data/dm1.json)")
    return parser.parse_args()


def main():
    args = parse_args()

    if args.url:
        meta = parse_ffbb_url(args.url)
        url = meta["classement_url"]
    else:
        if not args.poule:
            raise SystemExit("--poule est requis quand --phase est utilisé")
        url = f"{args.base_url}?phase={args.phase}&poule={args.poule}"
        meta = {"phase": args.phase, "poule": args.poule}

    scrape_classement(url, args.output, meta)


if __name__ == "__main__":
    main()
