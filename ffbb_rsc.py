"""
Utilitaires partagés pour le scraping FFBB.

Gestion des requêtes HTTP et extraction des chunks RSC (React Server Components)
streamés dans le HTML des pages Next.js de competitions.ffbb.com.
"""

import re
import json
import requests

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
