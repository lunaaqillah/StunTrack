"""Server-side validation rules for questionnaire submissions.

These rules are authoritative. The browser may repeat them for UX, but a request
must still satisfy them here before anything is written to the database.
"""


# ==========================================
# SECTION: Imports
# ==========================================

from __future__ import annotations

from datetime import date
import math

from backend.models import Pengisian
from backend.data.variable_database import ITEM_BY_ID, SKALA_PENGISIAN
from backend.routes.survei.zscore import calculate_age_in_months


# ==========================================
# SECTION: Configuration
# ==========================================

TB_MIN = 40.0
TB_MAX = 130.0
BB_MIN = 1.0
BB_MAX = 40.0
MAX_AGE_MONTHS = 60
MAX_BALITA_PER_PENGISIAN = 4


# ==========================================
# SECTION: Validation
# ==========================================
# ==================== 1. MEMPROSES NILAI PENGUKURAN ====================

def parse_measurement(value, field_name: str, minimum: float, maximum: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} harus berupa angka yang valid")

    if not math.isfinite(number):
        raise ValueError(f"{field_name} harus berupa angka yang valid")
    if not minimum <= number <= maximum:
        raise ValueError(
            f"{field_name} harus berada pada rentang {minimum:g}-{maximum:g}"
        )
    return number


# ==================== 2. MEMVALIDASI USIA BALITA ====================

def validate_child_age(balita, today: date | None = None) -> int:
    today = today or date.today()
    if balita.tanggal_lahir > today:
        raise ValueError("Tanggal lahir balita tidak boleh berada di masa depan")

    age_months = calculate_age_in_months(balita.tanggal_lahir, today)
    if age_months > MAX_AGE_MONTHS:
        raise ValueError("Usia balita maksimal 5 tahun")
    return age_months


# ==================== 3. MEMVALIDASI DETAIL JAWABAN ====================

def validate_details(details: list[dict]) -> None:
    if not isinstance(details, list) or not details:
        raise ValueError("details harus berupa daftar dan tidak boleh kosong")

    if any(not isinstance(detail, dict) for detail in details):
        raise ValueError("Setiap detail jawaban harus berupa object")

    submitted_ids = [str(detail.get("id_item", "")).strip() for detail in details]
    if any(not item_id for item_id in submitted_ids):
        raise ValueError("Setiap detail wajib memiliki id_item")
    if len(submitted_ids) != len(set(submitted_ids)):
        raise ValueError("Tidak boleh ada id_item yang dikirim lebih dari sekali")

    expected_items = set(ITEM_BY_ID)
    submitted_set = set(submitted_ids)
    missing = expected_items - submitted_set
    unknown = submitted_set - expected_items

    if unknown:
        raise ValueError("Terdapat item kuesioner yang tidak valid")
    if missing:
        raise ValueError("Semua pertanyaan kuesioner wajib dijawab")

    valid_scales = {row["id_skala"] for row in SKALA_PENGISIAN}
    for detail in details:
        try:
            scale_id = int(detail.get("id_skala"))
        except (TypeError, ValueError):
            raise ValueError("id_skala harus berupa angka yang valid")
        if scale_id not in valid_scales:
            raise ValueError("Terdapat skala jawaban yang tidak valid")


# ==================== 4. MEMVALIDASI RIWAYAT TINGGI BADAN ====================

def validate_height_history(balita, current_height: float, today: date | None = None) -> None:
    """Keep the existing UX rule: height may not be lower than the highest
    previous measurement taken at a younger age.
    """
    today = today or date.today()
    current_age = calculate_age_in_months(balita.tanggal_lahir, today)
    previous = Pengisian.query.filter_by(id_balita=balita.id_balita).all()

    previous_heights = []
    for record in previous:
        age_at_record = calculate_age_in_months(
            balita.tanggal_lahir, record.tanggal_pengisian
        )
        if age_at_record < current_age and record.tb_balita is not None:
            previous_heights.append(record.tb_balita)

    if previous_heights and current_height < max(previous_heights):
        raise ValueError("Tinggi badan tidak boleh lebih kecil dari pengukuran sebelumnya")
