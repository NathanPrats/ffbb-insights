"""
Pipeline FFBB complet depuis une URL de classement.

Depuis n'importe quelle URL FFBB de classement, ce script :
  1. Déduit automatiquement ligue, compétition, phase et poule
  2. Scrape le classement  → data/<ligue>-<competition>/classement.json
  3. Scrape le calendrier  → data/<ligue>-<competition>/calendrier.json
  4. Lance l'analyse Go    (optionnel, --analyse)

Usage :
    python ffbb_pipeline.py --url "https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/dm3/classement?phase=200000002873855&poule=200000003020596"
    python ffbb_pipeline.py --url "..." --analyse
    python ffbb_pipeline.py --url "..." --analyse --top 2
    python ffbb_pipeline.py --url "..." --analyse --bottom 2
"""

import argparse
import subprocess
import sys
from pathlib import Path

from ffbb_rsc import parse_ffbb_url
from scraper_classement import scrape_classement
from scraper_calendrier import scrape_calendrier_to_file


def _separator(label: str) -> None:
    width = 60
    print(f"\n{'─' * width}")
    print(f"  {label}")
    print(f"{'─' * width}")


def run_pipeline(
    url: str,
    out_dir: Path,
    run_analyse: bool,
    top: int,
    bottom: int,
) -> None:
    meta = parse_ffbb_url(url)

    _separator("Compétition détectée")
    print(f"  Ligue      : {meta['ligue'].upper()}")
    print(f"  Compétition: {meta['competition'].upper()}")
    print(f"  Comité     : {meta['comite']}")
    print(f"  Phase      : {meta['phase']}")
    print(f"  Poule      : {meta['poule']}")
    print(f"  Dossier    : {out_dir}/")

    out_dir.mkdir(parents=True, exist_ok=True)
    classement_path = out_dir / "classement.json"
    calendrier_path = out_dir / "calendrier.json"

    _separator("[1/2] Classement")
    scrape_classement(meta["classement_url"], str(classement_path), meta)

    _separator("[2/2] Calendrier")
    scrape_calendrier_to_file(meta["calendrier_url"], str(calendrier_path), meta)

    print(f"\n✓ Données prêtes dans {out_dir}/")

    if not run_analyse:
        print(
            f"\n  Lancer l'analyse :\n"
            f"  ./bin/analyse --input {classement_path} --calendrier {calendrier_path}"
        )
        return

    _separator("[3/3] Analyse")

    binary = Path("bin/analyse")
    if not binary.exists():
        print("  Compilation du binaire Go...")
        result = subprocess.run(["go", "build", "-o", "bin/analyse", "./cmd/analyse"], check=False)
        if result.returncode != 0:
            print("  Échec de la compilation. Lancer `make build` manuellement.", file=sys.stderr)
            sys.exit(1)

    cmd = [
        str(binary),
        f"--input={classement_path}",
        f"--calendrier={calendrier_path}",
    ]
    if bottom > 0:
        cmd.append(f"--bottom={bottom}")
    elif top != 1:
        cmd.append(f"--top={top}")

    subprocess.run(cmd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pipeline FFBB complet : classement + calendrier + analyse depuis une URL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--url", required=True,
        help="URL de la page classement FFBB (ex: https://competitions.ffbb.com/.../classement?phase=X&poule=Y)",
    )
    parser.add_argument(
        "--dir", default="data",
        help="Dossier racine de sortie (défaut: data/). Un sous-dossier <ligue>-<competition> est créé automatiquement.",
    )
    parser.add_argument(
        "--analyse", action="store_true",
        help="Lancer l'analyse Go après le scraping",
    )
    parser.add_argument(
        "--top", type=int, default=1,
        help="Nombre de places hautes pour les projections (défaut: 1 = champion)",
    )
    parser.add_argument(
        "--bottom", type=int, default=0,
        help="Nombre de places basses pour les projections de relégation",
    )
    args = parser.parse_args()

    meta = parse_ffbb_url(args.url)
    out_dir = Path(args.dir) / meta["slug"]

    run_pipeline(
        url=args.url,
        out_dir=out_dir,
        run_analyse=args.analyse,
        top=args.top,
        bottom=args.bottom,
    )


if __name__ == "__main__":
    main()
