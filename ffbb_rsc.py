"""
Utilitaires partagés pour le scraping FFBB.

Gestion des requêtes HTTP et extraction des chunks RSC (React Server Components)
streamés dans le HTML des pages Next.js de competitions.ffbb.com.
"""

import re
import json
import requests
from datetime import date
from urllib.parse import urlparse, parse_qs

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


def fetch_raw_html(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    return response.text


def extract_rsc_chunks(html: str) -> list[str]:
    """
    Extrait les payloads RSC depuis les balises :
        <script>self.__next_f.push([index, "payload"])</script>

    Retourne uniquement les chunks dont le second élément est une chaîne
    (les chunks de données, pas les chunks de contrôle).
    """
    chunks = []
    raw_scripts = re.findall(
        r'<script[^>]*>self\.__next_f\.push\(\[(.*?)\]\)</script>',
        html,
        re.DOTALL,
    )
    for raw in raw_scripts:
        try:
            parsed = json.loads(f"[{raw}]")
            if len(parsed) >= 2 and isinstance(parsed[1], str):
                chunks.append(parsed[1])
        except (json.JSONDecodeError, IndexError):
            continue
    return chunks


def parse_ffbb_url(url: str) -> dict:
    """
    Analyse une URL FFBB de classement et retourne tous les paramètres nécessaires
    au pipeline (phase, poule, métadonnées, URLs dérivées).

    Exemple d'entrée :
        https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/dm3/classement
        ?phase=200000002873855&poule=200000003020596

    Retourne :
        {
            "phase":          "200000002873855",
            "poule":          "200000003020596",
            "ligue":          "idf",
            "comite":         "0078",
            "competition":    "dm3",
            "slug":           "idf-dm3",
            "classement_url": "https://.../classement?phase=...&poule=...",
            "calendrier_url": "https://?phase=...&poule=...&jour=YYYY-MM-DD",
        }
    """
    parsed = urlparse(url)
    params = parse_qs(parsed.query)

    if "phase" not in params or "poule" not in params:
        raise ValueError(
            f"URL FFBB invalide — paramètres phase/poule manquants : {url}\n"
            "Format attendu : https://competitions.ffbb.com/ligues/<ligue>/comites/<comite>"
            "/competitions/<competition>/classement?phase=<id>&poule=<id>"
        )

    segments = [s for s in parsed.path.split("/") if s]

    def segment_after(key: str) -> str:
        try:
            idx = segments.index(key)
            return segments[idx + 1] if idx + 1 < len(segments) else ""
        except ValueError:
            return ""

    ligue = segment_after("ligues")
    comite = segment_after("comites")
    competition = segment_after("competitions")

    # Chemin de base sans /classement
    base_path = parsed.path
    if base_path.endswith("/classement"):
        base_path = base_path[: -len("/classement")]

    base = f"{parsed.scheme}://{parsed.netloc}{base_path}"
    query = f"phase={params['phase'][0]}&poule={params['poule'][0]}"

    return {
        "phase":          params["phase"][0],
        "poule":          params["poule"][0],
        "ligue":          ligue,
        "comite":         comite,
        "competition":    competition,
        "slug":           f"{ligue}-{competition}".lower(),
        "classement_url": f"{base}/classement?{query}",
        # Le calendrier FFBB n'a pas de segment /calendrier — c'est la page racine
        # de la compétition avec un paramètre &jour= (n'importe quelle date fonctionne)
        "calendrier_url": f"{base}?{query}&jour={date.today().isoformat()}",
    }
