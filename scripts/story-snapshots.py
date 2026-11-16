"""Gera as missões do modo história em public/story/, rodando o próprio Mission Fire Engine (sem servidor).

O site é estático (Cloudflare) e não roda Python. O modo história só usa as missões de referência do motor, com
configuração fixa, então cada simulação é calculada aqui uma vez pelo código do motor e publicada como arquivo.
Nenhum número é escrito à mão: os arquivos são a resposta de POST /api/missions/simulations do motor, reduzida aos
campos que a história lê, com o commit do motor e a data em missions.json.

Uso, com o Python do ambiente do motor (fastapi, numpy, scipy...):

    ../mission-fire-engine/backend/.venv/Scripts/python.exe scripts/story-snapshots.py
    python scripts/story-snapshots.py --engine /caminho/para/mission-fire-engine

Rode de novo sempre que o motor mudar e publique os arquivos gerados.
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

FRONT = Path(__file__).resolve().parents[1]

# só o que src/features/story lê (mfe.ts, chapters.ts, scene.ts); o resto da resposta fica de fora
SERIES = ["habitat", "t_day", "r_au", "x_au", "y_au", "earth_x", "earth_y", "dest_x", "dest_y", "solar_flux_w_m2",
          "gravity_g", "component_k", "margin_k", "pressure_kpa", "oxygen_pct", "ventilation_cm_s", "phase",
          "evidence_tier", "ml_spread_mm_s", "ml_spread_sd_mm_s", "ml_spread_ratio", "ml_domain"]
EVENT = ["id", "day", "kind", "severity", "title", "description", "classification"]
SUMMARY = ["hours_over_limit", "hours_outside_tabulated", "evidence_share", "ml_spread_max_ratio",
           "ml_spread_max_day", "hours_ml_in_domain"]


def trim(r: dict) -> dict:
    sp = r["config"]["spacecraft"]
    return {
        "simulation_id": r["simulation_id"], "label": r["label"], "profile": r["profile"],
        "series": {k: r["series"][k] for k in SERIES if k in r["series"]},
        "events": [{k: e[k] for k in EVENT} for e in r["events"]],
        "summary": {k: r["summary"][k] for k in SUMMARY if k in r["summary"]},
        "config": {"label": r["config"]["label"], "profile": r["config"]["profile"], "spacecraft": {
            "crew": sp["crew"], "ventilation_cm_s": sp["ventilation_cm_s"],
            "component": {k: sp["component"][k] for k in ("name", "operational_limit_k", "material")}}},
    }


def git(engine: Path, *args: str) -> str:
    try:
        return subprocess.run(["git", "-C", str(engine), *args], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--engine", type=Path, default=FRONT.parent / "mission-fire-engine", help="pasta do mission-fire-engine")
    ap.add_argument("--out", type=Path, default=FRONT / "public" / "story")
    a = ap.parse_args()
    engine = a.engine.resolve()
    sys.path.insert(0, str(engine / "backend"))
    try:
        from fastapi.testclient import TestClient
        from mfe.api import app
    except ImportError as e:
        sys.exit(f"Não consegui importar o motor em {engine}: {e}. Use o Python do ambiente do motor (backend/.venv).")

    client = TestClient(app)
    presets = client.get("/api/presets").json()
    a.out.mkdir(parents=True, exist_ok=True)
    index = {}
    for sid, sc in presets["scenarios"].items():
        r = client.post("/api/missions/simulations", json=sc["config"])
        r.raise_for_status()
        (a.out / f"{sid}.json").write_text(json.dumps(trim(r.json()), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index[sid] = {"name": sc["name"], "description": sc["description"], "file": f"{sid}.json"}
        print(f"{sid}: {len(r.json()['series']['t_day'])} amostras")

    dirty = bool(git(engine, "status", "--porcelain", "--", "backend", "data"))
    meta = {
        "source": "stars-beyond/mission-fire-engine",
        "engine_commit": git(engine, "rev-parse", "--short", "HEAD") + ("-dirty" if dirty else ""),
        "engine_commit_date": git(engine, "log", "-1", "--format=%cI"),
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "missions": index,
    }
    (a.out / "missions.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(index)} missões em {a.out} (motor {meta['engine_commit']})")


if __name__ == "__main__":
    main()
