"""Generate a fully synthetic promoter-screening dataset for the demo dashboard.

Nothing here is derived from real experimental data. Promoter IDs, families,
experiments and values are invented; the only real-world names used are
common, publicly available cell lines and generic tissue names.

Model
-----
Each promoter gets a latent baseline strength plus a family-specific bias for
each biological context (cell line or tissue). Observed values are noisy
replicate draws around that latent signal. Coverage is deliberately
incomplete (not every promoter is tested everywhere) because answering
"has this been tested, and where?" is the point of the dashboard.

A handful of runs carry planted QC problems whose values are distorted, so the
include/exclude QC controls have a visible effect.

Usage:  python scripts/generate_data.py   (writes public/data/dataset.json)
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

SEED = 7
rng = random.Random(SEED)

OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "dataset.json"

FAMILIES = {
    # family: affinity per context (added to log2 strength)
    "Ubiquitous": {},
    "Muscle-tuned": {"C2C12 myotubes": 1.6, "iPSC myotubes": 1.8, "Quadriceps": 2.0, "Heart": 1.2},
    "Neuron-tuned": {"Neuro-2a": 1.7, "iPSC neurons": 1.9, "Brain": 1.8},
    "Liver-tuned": {"HepG2": 1.8, "Liver": 2.1},
    "Minimal": {},
}

CELL_LINES = ["HEK293", "HeLa", "HepG2", "C2C12 myotubes", "Neuro-2a", "iPSC myotubes", "iPSC neurons"]
TISSUES = ["Liver", "Quadriceps", "Heart", "Brain"]
TIMEPOINTS = ["Week 2", "Week 4", "Week 8"]

IN_VITRO_FLAGS = {
    "low_viability": "Viability < 70% at harvest",
    "transfection_failure": "Positive control below expected range",
    "poor_differentiation": "iPSC differentiation markers below threshold",
}
IN_VIVO_FLAGS = {
    "injection_issue": "Dosing deviation noted for this animal",
    "imaging_saturation": "Signal saturated; value is a lower bound",
}


def make_promoters() -> list[dict]:
    promoters = [
        {"id": "CTRL-POS", "family": "Control", "length_bp": 1600, "design_round": "Ref",
         "is_control": True, "notes": "Strong constitutive reference used for normalization"},
        {"id": "CTRL-NEG", "family": "Control", "length_bp": 0, "design_round": "Ref",
         "is_control": True, "notes": "Promoterless reporter (background)"},
    ]
    families = list(FAMILIES)
    for i in range(1, 37):
        fam = families[(i - 1) % len(families)]
        length = rng.randint(180, 420) if fam == "Minimal" else rng.randint(350, 1300)
        promoters.append({
            "id": f"SP-{i:03d}",
            "family": fam,
            "length_bp": length,
            "design_round": f"R{1 + (i - 1) // 12}",
            "is_control": False,
            "notes": "",
        })
    return promoters


def latent_log2(p: dict, base: dict[str, float], context: str) -> float:
    """Latent log2 expression relative to CTRL-POS (0 = equal to reference)."""
    if p["id"] == "CTRL-POS":
        return 0.0
    if p["id"] == "CTRL-NEG":
        return -7.0
    bias = FAMILIES[p["family"]].get(context, 0.0)
    # tissue-tuned promoters are weaker off-target
    if FAMILIES[p["family"]] and context not in FAMILIES[p["family"]]:
        bias -= 1.2
    return base[p["id"]] + bias


def main() -> None:
    promoters = make_promoters()
    base = {}
    for p in promoters:
        if p["is_control"]:
            continue
        mu = {"Minimal": -2.6, "Ubiquitous": -0.8}.get(p["family"], -1.6)
        base[p["id"]] = rng.gauss(mu, 0.9)

    test_ids = [p["id"] for p in promoters if not p["is_control"]]

    # ---------------- in vitro ----------------
    in_vitro = []
    exp_n = 0
    for round_name in ["R1", "R2", "R3"]:
        round_ids = [p["id"] for p in promoters if p["design_round"] == round_name]
        for batch in range(2):
            exp_n += 1
            exp_id = f"IVT-{exp_n:02d}"
            lines = rng.sample(CELL_LINES, k=rng.randint(2, 4))
            chosen = rng.sample(round_ids, k=rng.randint(6, 10))
            # later rounds re-test a few earlier hits
            if round_name != "R1":
                chosen += rng.sample(test_ids[:12], k=2)
            for line in lines:
                for pid in ["CTRL-POS", "CTRL-NEG"] + chosen:
                    p = next(x for x in promoters if x["id"] == pid)
                    flag = None
                    shift = 0.0
                    roll = rng.random()
                    if line.startswith("iPSC") and roll < 0.12:
                        flag, shift = "poor_differentiation", -1.5
                    elif roll < 0.04:
                        flag, shift = "low_viability", -1.0
                    elif roll < 0.06:
                        flag, shift = "transfection_failure", -2.0
                    for rep in range(1, 4):
                        lv = latent_log2(p, base, line) + shift + rng.gauss(0, 0.35)
                        rel = 2 ** lv
                        pct_pos = round(min(98.0, max(0.3, 100 * (1 - math.exp(-0.9 * rel)))), 1)
                        in_vitro.append({
                            "experiment_id": exp_id,
                            "promoter_id": pid,
                            "context": line,
                            "replicate": rep,
                            "relative_expression": round(rel, 4),
                            "pct_positive": pct_pos,
                            "qc_flag": flag,
                        })

    # ---------------- in vivo ----------------
    in_vivo = []
    candidates = sorted(test_ids, key=lambda i: -base[i])[:14]
    studies = [
        ("IVV-01", "IV", candidates[:6]),
        ("IVV-02", "IM", candidates[3:9]),
        ("IVV-03", "IV", candidates[6:12]),
        ("IVV-04", "IM", candidates[9:14]),
    ]
    animal_n = 0
    for study_id, route, ids in studies:
        tissues = ["Quadriceps", "Heart"] if route == "IM" else TISSUES
        for pid in ["CTRL-POS"] + ids:
            p = next(x for x in promoters if x["id"] == pid)
            for animal in range(1, 5):
                animal_n += 1
                animal_id = f"M{animal_n:03d}"
                inj_issue = rng.random() < 0.05
                for tp_i, tp in enumerate(TIMEPOINTS):
                    for tissue in tissues:
                        lv = latent_log2(p, base, tissue) + 0.4 * tp_i + rng.gauss(0, 0.5)
                        flag = None
                        if inj_issue:
                            flag, lv = "injection_issue", lv - 2.2
                        radiance = 10 ** (6.0 + 0.30103 * lv)  # photons/s/cm2/sr
                        if radiance > 5e6:
                            flag, radiance = "imaging_saturation", 5e6
                        in_vivo.append({
                            "study_id": study_id,
                            "route": route,
                            "animal_id": animal_id,
                            "promoter_id": pid,
                            "context": tissue,
                            "timepoint": tp,
                            "radiance": round(radiance, 1),
                            "qc_flag": flag,
                        })

    dataset = {
        "meta": {
            "description": "Fully synthetic demo data. Not derived from any real experiment.",
            "seed": SEED,
            "normalization": "In vitro values are relative to CTRL-POS in the same experiment and cell line; "
                             "in vivo radiance is total flux in photons/s/cm2/sr.",
            "qc_flags": {**IN_VITRO_FLAGS, **IN_VIVO_FLAGS},
            "cell_lines": CELL_LINES,
            "tissues": TISSUES,
            "timepoints": TIMEPOINTS,
        },
        "promoters": promoters,
        "in_vitro": in_vitro,
        "in_vivo": in_vivo,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dataset, indent=1))
    print(f"wrote {OUT}  promoters={len(promoters)}  in_vitro={len(in_vitro)}  in_vivo={len(in_vivo)}")


if __name__ == "__main__":
    main()
