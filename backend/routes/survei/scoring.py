"""Logika skoring kuesioner X1-X10 dan koefisien model risiko.

Konfigurasi skoring dan koefisien dimuat satu kali dari coefficients.json agar
fitur pengisian, prediksi, dan dashboard menggunakan sumber data yang sama.
"""


# ==========================================
# SECTION: Imports
# ==========================================

import json
from pathlib import Path


# ==========================================
# SECTION: Configuration
# ==========================================

with open(Path(__file__).resolve().parents[2] / 'data' / 'coefficients.json', encoding='utf-8') as f:
    _coef_bundle = json.load(f)


_SRS_MAPPING = _coef_bundle['srs_mapping']
_REVERSE_ITEMS = set(_coef_bundle['reverse_items'])
_LIKERT_MAX_PLUS_MIN = _coef_bundle['likert_max_plus_min']
_INDICATOR_GROUPS = _coef_bundle['indicator_groups']


COEF_MEAN = _coef_bundle['standardization']['mean']
COEF_STD = _coef_bundle['standardization']['std']
COEF_Y = _coef_bundle['model_Y']['coefficients']
COEF_INTERCEPT = _coef_bundle['model_Y']['intercept']

_ITEM_META_CACHE = None


# ==========================================
# SECTION: Business Logic
# ==========================================
# ==================== 1. MEMETAKAN ITEM KUESIONER ====================

def _get_item_meta():
    """Petakan ID item hierarkis (X1.1.1) ke variabel dan key model."""
    global _ITEM_META_CACHE
    if _ITEM_META_CACHE is None:
        from backend.data.variable_database import KUESIONER_ITEMS
        _ITEM_META_CACHE = {
            item["id_item"]: {
                "var": item["id_variabel"],
                "id_indikator": item["id_indikator"],
                "notebook_item": item["id_item"],
            }
            for item in KUESIONER_ITEMS
        }
    return _ITEM_META_CACHE


# ==================== 3. MENGHITUNG NILAI SRS ITEM ====================

def _item_srs_value(nb_item, raw_skala):
    """Konversi satu jawaban mentah (id_skala, 1-5) menjadi skor SRS, mengikuti
    persis langkah 1-2 `score_variables_from_answers()` (Bagian 17 notebook):
      1. reverse-code dulu (jika item ada di reverse_items)
      2. konversi ke skala SRS lewat srs_mapping yang SAMA PERSIS dipakai saat membangun model
    Tidak ada standardisasi per item -- skor komposit per variabel dihitung dari
    rata-rata sederhana nilai SRS ini (lihat _compute_composite_scores).
    """
    if nb_item not in _SRS_MAPPING:
        return float(raw_skala)

    nilai = raw_skala
    if nb_item in _REVERSE_ITEMS:
        nilai = _LIKERT_MAX_PLUS_MIN - nilai
    return float(_SRS_MAPPING[nb_item][str(int(nilai))])


# ==================== 4. MENGHITUNG SKOR KOMPOSIT VARIABEL ====================

def _compute_composite_scores(details):
    """Hitung skor komposit X1-X10 dari detail jawaban (id_item, id_skala) satu pengisian,
    memakai rata-rata sederhana nilai SRS per variabel (rowMeans) -- TANPA standardisasi
    per item. Mengikuti alur score_variables_from_answers() di stunting_analysis.ipynb
    (Bagian 10 & 17).
    """
    meta = _get_item_meta()
    values_per_var = {f'X{i}': [] for i in range(1, 11)}

    for d in details:
        db_item = str(d['id_item'])
        raw_skala = int(d['id_skala'])
        info = meta.get(db_item)
        if not info or info['var'] not in values_per_var:
            continue
        values_per_var[info['var']].append(_item_srs_value(info['notebook_item'], raw_skala))

    return {
        var: (sum(vals) / len(vals) if vals else 0.0)
        for var, vals in values_per_var.items()
    }
