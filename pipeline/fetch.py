"""Refresh the dashboard data.

Reads pipeline/sources.yml, pulls each source and writes JSON into site/data/.
Each source is independent: a failure is logged and the previous JSON for
that source is kept, so one broken API never blanks the whole dashboard.

Run locally:   python pipeline/fetch.py
With state data: DATA_GOV_IN_API_KEY=xxxx python pipeline/fetch.py
"""
import csv
import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data"
OUT.mkdir(parents=True, exist_ok=True)
CFG = yaml.safe_load((ROOT / "pipeline" / "sources.yml").read_text())
TIMEOUT = 60
status = {}


def save(name, payload):
    (OUT / f"{name}.json").write_text(json.dumps(payload, indent=1, ensure_ascii=False))


def run(name, fn):
    try:
        fn()
        status[name] = "ok"
        print(f"[ok]   {name}")
    except Exception as exc:  # keep going; old file stays in place
        status[name] = f"failed: {exc}"
        print(f"[fail] {name}: {exc}", file=sys.stderr)


def world_bank():
    cfg = CFG["world_bank"]
    out, missing = [], []
    for ind in cfg["indicators"]:
        url = (f"https://api.worldbank.org/v2/country/{cfg['country']}/indicator/"
               f"{ind['code']}?format=json&per_page=200")
        try:
            body = requests.get(url, timeout=TIMEOUT).json()
            if len(body) < 2 or not body[1]:
                raise ValueError("empty response")
        except Exception as exc:  # skip just this indicator
            missing.append(f"{ind['code']} ({exc})")
            continue
        points = sorted(
            ({"year": int(r["date"]), "value": round(r["value"], 2)}
             for r in body[1] if r["value"] is not None),
            key=lambda p: p["year"])
        out.append({**ind, "source": "World Bank Open Data",
                    "source_url": f"https://data.worldbank.org/indicator/{ind['code']}?locations=IN",
                    "points": points})
    if missing:
        status["world_bank_missing"] = missing
    if not out:
        raise RuntimeError("no World Bank indicators could be fetched")
    save("national", out)


def owid():
    cfg = CFG["owid"]
    text = requests.get(cfg["url"], timeout=TIMEOUT).text
    rows = [r for r in csv.DictReader(io.StringIO(text)) if r["iso_code"] == cfg["iso_code"]]
    out = []
    for s in cfg["series"]:
        points = [{"year": int(r["year"]), "value": round(float(r[s["column"]]), 1)}
                  for r in rows if r.get(s["column"])
                  and int(r["year"]) >= cfg.get("start_year", 0)]
        if not points:
            raise ValueError(f"no data for {s['column']}")
        out.append({**s, "source": "Our World in Data (Jones et al., based on PRIMAP-hist & GCP)",
                    "source_url": "https://github.com/owid/co2-data", "points": points})
    save("emissions", out)


def to_number(v):
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def data_gov_in():
    key = os.environ.get("DATA_GOV_IN_API_KEY")
    datasets = [d for d in CFG["data_gov_in"]["datasets"] if d.get("resource_id")]
    if not datasets:
        status["data_gov_in_note"] = "no resource IDs configured yet"
        return
    if not key:
        raise RuntimeError("DATA_GOV_IN_API_KEY not set")
    out = []
    for d in datasets:
        url = (f"https://api.data.gov.in/resource/{d['resource_id']}"
               f"?api-key={key}&format=json&limit=1000")
        body = requests.get(url, timeout=TIMEOUT).json()
        rows = []
        for r in body.get("records", []):
            state, val = r.get(d["state_field"]), to_number(r.get(d["value_field"]))
            if state and val is not None and "total" not in str(state).lower():
                rows.append({"state": str(state).strip(), "value": val})
        if not rows:
            raise ValueError(f"{d['id']}: no usable rows — check state_field/value_field")
        out.append({k: d[k] for k in ("id", "label", "unit", "theme")} | {
            "source": body.get("title") or "data.gov.in",
            "source_url": f"https://data.gov.in/resource/{d['resource_id']}",
            "updated": body.get("updated_date"),
            "rows": sorted(rows, key=lambda r: -r["value"])})
    save("states", out)


def register():
    path = ROOT / CFG["register_csv"]
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    rows.sort(key=lambda r: r["date"], reverse=True)
    save("register", rows)


run("world_bank", world_bank)
run("owid", owid)
run("data_gov_in", data_gov_in)
run("register", register)
save("meta", {"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
              "status": status})

# Fail the workflow only if nothing at all could be refreshed.
if all(v != "ok" for k, v in status.items() if not k.endswith(("_note", "_missing"))):
    sys.exit(1)
