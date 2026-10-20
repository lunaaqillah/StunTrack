"""Referensi instrumen StunTrack (fixed research reference).

Sumber data instrumen berada di backend/data/variable_database.json dan
skala Likert berada di backend/data/skala.json. File ini hanya menyediakan
loader dan indeks agar modul lama tetap menggunakan API Python yang sama.
"""

import json
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parent

with open(_DATA_DIR / "variable_database.json", encoding="utf-8") as f:
    _REFERENCE = json.load(f)
with open(_DATA_DIR / "skala.json", encoding="utf-8") as f:
    _SCALE_REFERENCE = json.load(f)

VARIABLE_DEFINITIONS = _REFERENCE["variables"]
INDICATOR_DEFINITIONS = _REFERENCE["indicators"]
KUESIONER_ITEMS = _REFERENCE["items"]
SKALA_PENGISIAN = _SCALE_REFERENCE["scales"]

VARIABLE_BY_ID = {v["id_variabel"]: v for v in VARIABLE_DEFINITIONS}
INDICATOR_BY_ID = {v["id_indikator"]: v for v in INDICATOR_DEFINITIONS}
ITEM_BY_ID = {v["id_item"]: v for v in KUESIONER_ITEMS}
ITEM_TO_INDICATOR = {v["id_item"]: v["id_indikator"] for v in KUESIONER_ITEMS}
ITEM_TO_VARIABLE = {v["id_item"]: v["id_variabel"] for v in KUESIONER_ITEMS}
ITEMS_BY_VARIABLE = {}
for item in KUESIONER_ITEMS:
    ITEMS_BY_VARIABLE.setdefault(item["id_variabel"], []).append(item["id_item"])
