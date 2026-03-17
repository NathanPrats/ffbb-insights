"""
Tests unitaires pour scraper.py — fonctions de parsing RSC.
Basés sur les données réelles de data/dm1.json (classement PRM Poule A, 2026-03-16).

Exécution : pytest tests/
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scraper_classement import looks_like_team, normalize_team, extract_from_rsc_payload


# ---------------------------------------------------------------------------
# looks_like_team
# ---------------------------------------------------------------------------

def test_looks_like_team_valid_canonical():
    """Un dict avec les clés canoniques est reconnu comme une équipe."""
    team = {"rang": 1, "equipe": "TUES GERMANOISE", "pts": 26, "gagnes": 11}
    assert looks_like_team(team) is True


def test_looks_like_team_valid_aliases():
    """Les alias de clés (victoires, club, position) sont aussi reconnus."""
    team = {"position": 3, "club": "BC MAUREPAS - 2", "points": 23, "victoires": 8}
    assert looks_like_team(team) is True


def test_looks_like_team_rejects_partial():
    """Un dict avec seulement le nom de l'équipe (sans stats) est rejeté."""
    assert looks_like_team({"equipe": "JOUY BASKET CLUB"}) is False


def test_looks_like_team_rejects_unrelated():
    """Un dict sans rapport avec le classement est rejeté."""
    assert looks_like_team({"id": 42, "type": "navigation", "label": "Accueil"}) is False


# ---------------------------------------------------------------------------
# normalize_team
# ---------------------------------------------------------------------------

def test_normalize_team_canonical_passthrough():
    """Les clés déjà canoniques sont conservées sans modification."""
    raw = {
        "rang": 1, "equipe": "ENTENTE LE CHESNAY VERSAILLES 78 BASKET - 2",
        "pts": 29, "joues": 16, "gagnes": 13, "perdus": 3,
        "nuls": 0, "bp": 1208, "bc": 1054, "penalites": 0,
    }
    result = normalize_team(raw)
    assert result == raw


def test_normalize_team_aliases_mapped():
    """Les alias sont mappés vers les clés canoniques."""
    raw = {
        "position": 12, "club": "LES MUREAUX BC", "points": 14,
        "victoires": 0, "defaites": 14, "pour": 664, "contre": 1133,
    }
    result = normalize_team(raw)
    assert result["rang"] == 12
    assert result["equipe"] == "LES MUREAUX BC"
    assert result["pts"] == 14
    assert result["gagnes"] == 0
    assert result["perdus"] == 14
    assert result["bp"] == 664
    assert result["bc"] == 1133


# ---------------------------------------------------------------------------
# extract_from_rsc_payload
# ---------------------------------------------------------------------------

def test_extract_from_rsc_payload_extracts_team():
    """Un payload RSC contenant un objet équipe valide est extrait correctement."""
    team_obj = {
        "rang": 2, "equipe": "TUES GERMANOISE", "pts": 26,
        "joues": 15, "gagnes": 11, "perdus": 4, "nuls": 0,
        "bp": 1051, "bc": 834, "penalites": 0,
    }
    # Format RSC : <id>:<json>\n
    payload = f'abc:{json.dumps(team_obj)}\n'

    standings = []
    extract_from_rsc_payload(payload, standings)

    assert len(standings) == 1
    assert standings[0]["equipe"] == "TUES GERMANOISE"
    assert standings[0]["pts"] == 26


def test_extract_from_rsc_payload_extracts_list():
    """Un payload RSC contenant un tableau d'équipes extrait toutes les équipes."""
    teams = [
        {"rang": 1, "equipe": "POISSY BASKET ASSOCIATION - 2", "pts": 26, "gagnes": 10},
        {"rang": 2, "equipe": "AGS LES ESSARTS LE ROI",        "pts": 25, "gagnes": 10},
    ]
    payload = f'xyz:{json.dumps(teams)}\n'

    standings = []
    extract_from_rsc_payload(payload, standings)

    assert len(standings) == 2
    assert standings[0]["equipe"] == "POISSY BASKET ASSOCIATION - 2"
    assert standings[1]["equipe"] == "AGS LES ESSARTS LE ROI"


def test_extract_from_rsc_payload_ignores_non_team_lines():
    """Les lignes RSC sans données d'équipe sont ignorées sans erreur."""
    payload = (
        '1:{"type":"navigation","items":["Accueil","Classement"]}\n'
        '2:{"phase":"200000002872715","poule":"200000003018348"}\n'
    )
    standings = []
    extract_from_rsc_payload(payload, standings)
    assert standings == []
