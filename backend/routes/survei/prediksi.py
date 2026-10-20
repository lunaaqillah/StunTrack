# ==========================================
# SECTION: Imports
# ==========================================

import json

from flask import Blueprint, jsonify
from backend.models import Pengisian, FaktorRisiko
from backend.data.variable_database import VARIABLE_BY_ID

from backend.routes.survei.zscore import growth_workbook
from backend.routes.survei.scoring import COEF_MEAN, COEF_STD, COEF_Y, COEF_INTERCEPT


# ==========================================
# SECTION: Configuration
# ==========================================

from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parents[2] / 'data'

with open(_DATA_DIR / 'faktor_risiko_explanations.json', encoding='utf-8') as f:
    _faktor_risiko_explanations = json.load(f)

with open(_DATA_DIR / 'perbandingan_matrix.json', encoding='utf-8') as f:
    PERBANDINGAN_MATRIX = json.load(f)
with open(_DATA_DIR / 'status_risiko.json', encoding='utf-8') as f:
    STATUS_RISIKO_CONFIG = json.load(f)
_RISIKO_KATEGORI = STATUS_RISIKO_CONFIG['statuses']

prediksi_bp = Blueprint('prediksi', __name__, url_prefix='/prediksi')


# ==========================================
# SECTION: Business Logic
# ==========================================
# ==================== 1. MENGHITUNG KONTRIBUSI RISIKO ====================

def _hitung_kontribusi_risiko(pengisian):
    """Menghitung kontribusi faktor untuk saat hasil analisis dibuat/disimpan."""
    skor_map = pengisian.skor_dict()
    hasil = []
    for var, koef in COEF_Y.items():
        skor_komposit = skor_map.get(var)
        mean = COEF_MEAN.get(var)
        std = COEF_STD.get(var)
        if skor_komposit is None or mean is None or not std:
            continue
        z_score = (skor_komposit - mean) / std
        hasil.append({
            'variable': var,
            'weighted': round(float(skor_komposit), 3),
            'z_score': round(float(z_score), 3),
            'kontribusi': round(float(koef * z_score), 4)
        })
    return hasil


def _hitung_prediksi_keseluruhan(kontribusi_risiko):
    """Menghitung prediksi risiko saat hasil analisis pertama kali disimpan."""
    total_kontribusi = sum(k['kontribusi'] for k in kontribusi_risiko)
    return float(COEF_INTERCEPT) + total_kontribusi


def _klasifikasikan_risiko_kuesioner(y_pred_z):
    for row in _RISIKO_KATEGORI:
        lower_ok = row.get('min') is None or (y_pred_z >= row['min'] if row.get('min_inclusive', False) else y_pred_z > row['min'])
        upper_ok = row.get('max') is None or (y_pred_z <= row['max'] if row.get('max_inclusive', False) else y_pred_z < row['max'])
        if lower_ok and upper_ok:
            return row
    raise ValueError(f'Prediksi risiko tidak dapat diklasifikasikan: {y_pred_z}')


def _bangun_perbandingan(status_pertumbuhan, kategori_risiko):
    """Mengambil hasil perbandingan dari matrix referensi tanpa menghitung ulang."""
    info = PERBANDINGAN_MATRIX.get(status_pertumbuhan, {}).get(kategori_risiko['level'])
    if info is None:
        return None
    return {
        'status_pertumbuhan': status_pertumbuhan,
        'kategori_risiko': kategori_risiko['value'],
        'judul': info['judul'],
        'deskripsi': info['deskripsi'],
        'level': info['level'],
        'is_selaras': info['is_selaras'],
    }


def calculate_and_store_prediction(pengisian):
    """Menghitung dan menyimpan snapshot analisis sekali saat pengisian dibuat.

    Setelah snapshot tersimpan, halaman analisis hanya membaca nilai dari database.
    """
    kontribusi_risiko = _hitung_kontribusi_risiko(pengisian)
    faktor_by_var = {f.id_variabel: f for f in pengisian.faktor_risikos}
    for item in kontribusi_risiko:
        faktor = faktor_by_var.get(item['variable'])
        if faktor:
            faktor.skor_zscore = item['z_score']
            faktor.kontribusi = item['kontribusi']

    y_pred_z = _hitung_prediksi_keseluruhan(kontribusi_risiko)
    kategori = _klasifikasikan_risiko_kuesioner(y_pred_z)
    perbandingan = _bangun_perbandingan(pengisian.status_pertumbuhan, kategori)

    pengisian.nilai_prediksi = round(y_pred_z, 3)
    pengisian.status_risiko = kategori['value']
    if perbandingan:
        pengisian.perbandingan = bool(perbandingan['is_selaras'])
        pengisian.status_perbandingan = perbandingan['level']
    return perbandingan


def _stored_analysis(pengisian):
    """Menyusun response analisis hanya dari snapshot yang tersimpan di database."""
    if pengisian.nilai_prediksi is None or not pengisian.status_risiko:
        return None

    kategori = next((row for row in _RISIKO_KATEGORI if row['value'] == pengisian.status_risiko), None)
    if kategori is None:
        return None

    kontribusi_risiko = []
    for faktor in pengisian.faktor_risikos:
        meta = VARIABLE_BY_ID.get(faktor.id_variabel, {})
        kontribusi_risiko.append({
            'variable': faktor.id_variabel,
            'label': meta.get('keterangan', faktor.id_variabel),
            'weighted': round(float(faktor.skor_komposit), 3),
            'z_score': round(float(faktor.skor_zscore), 3) if faktor.skor_zscore is not None else None,
            'kontribusi': round(float(faktor.kontribusi), 4) if faktor.kontribusi is not None else 0.0,
        })

    kontribusi_risiko.sort(key=lambda item: item['variable'])
    faktor_meningkatkan = sorted(
        [k for k in kontribusi_risiko if k['kontribusi'] > 0],
        key=lambda k: k['kontribusi'], reverse=True
    )[:3]
    faktor_menurunkan = sorted(
        [k for k in kontribusi_risiko if k['kontribusi'] < 0],
        key=lambda k: k['kontribusi']
    )[:3]

    perbandingan = None
    matrix_by_status = PERBANDINGAN_MATRIX.get(pengisian.status_pertumbuhan, {})
    for info in matrix_by_status.values():
        if info.get('level') == pengisian.status_perbandingan:
            perbandingan = {
                'status_pertumbuhan': pengisian.status_pertumbuhan,
                'kategori_risiko': pengisian.status_risiko,
                'judul': info['judul'],
                'deskripsi': info['deskripsi'],
                'level': info['level'],
                'is_selaras': bool(pengisian.perbandingan),
            }
            break

    return {
        'id_pengisian': pengisian.id_pengisian,
        'weighted_values': {item['variable']: item['weighted'] for item in kontribusi_risiko},
        'kontribusi_risiko': kontribusi_risiko,
        'faktor_meningkatkan_risiko': faktor_meningkatkan,
        'faktor_menurunkan_risiko': faktor_menurunkan,
        'prediksi_keseluruhan': {
            'z_score': round(float(pengisian.nilai_prediksi), 3),
            'kategori': pengisian.status_risiko,
            'level': kategori['level'],
            'warna': {'accent': kategori['accent'], 'bg': kategori['bg']},
        },
        'perbandingan': perbandingan,
    }

# ==================== 2. MEMUAT REFERENSI MEDIAN TBU ====================

def _load_tbu_median(sheet_name):
    ws = growth_workbook[sheet_name]
    data = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        month = row[0]
        median = row[2]
        sd = row[4]
        if month is None or median is None:
            continue
        point = {'m': int(month), 'h': round(float(median), 1)}
        if sd is not None:
            point['sd'] = round(float(sd), 2)
        data.append(point)
    return data

_growth_reference_boys = _load_tbu_median('TBU_BOYS')
_growth_reference_girls = _load_tbu_median('TBU_GIRLS')

# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 3. MENGHITUNG PREDIKSI Y2 ====================

@prediksi_bp.route('/y2/<id_pengisian>', methods=['GET'])
def get_y2_prediction(id_pengisian):
    """Mengambil snapshot analisis yang sudah tersimpan di database.

    Endpoint ini read-only: tidak menghitung ulang model dan tidak mengubah database.
    """
    try:
        pengisian = Pengisian.query.get_or_404(id_pengisian)
        data = _stored_analysis(pengisian)
        if data is None:
            return jsonify({'error': 'Hasil analisis belum tersedia untuk pengisian ini'}), 409
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Failed to get stored Y2 prediction: {str(e)}'}), 500

# ==================== 4. MENGAMBIL REFERENSI PERTUMBUHAN ====================

@prediksi_bp.route('/growth-reference', methods=['GET'])
def get_growth_reference():
    try:
        return jsonify({
            'Laki-laki': _growth_reference_boys,
            'Perempuan': _growth_reference_girls
        })
    except Exception as e:
        return jsonify({'error': f'Failed to get growth reference: {str(e)}'}), 500

# ==================== 5. MENGAMBIL PENJELASAN FAKTOR RISIKO STUNTING ====================

@prediksi_bp.route('/faktor-risiko-explanations', methods=['GET'])
def get_faktor_risiko_explanations():
    try:
        return jsonify(_faktor_risiko_explanations)
    except Exception as e:
        return jsonify({'error': f'Failed to get faktor risiko stunting explanations: {str(e)}'}), 500
