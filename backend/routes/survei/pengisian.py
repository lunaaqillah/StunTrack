# ==========================================
# SECTION: Imports
# ==========================================

from flask import Blueprint, request, jsonify, current_app
from backend.models import db, Pengisian, FaktorRisiko, DetailFaktorRisiko, IdentitasBalita, IdentitasOrangTua
from datetime import datetime
from dateutil.relativedelta import relativedelta
import os
import uuid
import math

from flask_mail import Message
from backend.config import mail
from backend.emails.utils import attach_logo, render_email_template
from backend.routes.survei.zscore import calculate_age_in_months, calculate_zscore_tb, classify_stunting, STATUS_PERTUMBUHAN_VALUES
from backend.routes.survei.scoring import _compute_composite_scores, _item_srs_value
from backend.routes.survei.prediksi import calculate_and_store_prediction, _stored_analysis
from backend.data.variable_database import ITEM_BY_ID
from backend.routes.survei.validation import (
    TB_MIN, TB_MAX, BB_MIN, BB_MAX, validate_child_age,
    validate_details, validate_height_history, parse_measurement,
)

pengisian_bp = Blueprint('pengisian', __name__, url_prefix='/pengisian')


# ==========================================
# SECTION: Helper Functions
# ==========================================
# ==================== 1. MENGAMBIL BASE URL UNTUK LINK EMAIL ====================

def _get_base_url() -> str:
    """Base URL (tanpa trailing slash) untuk dipakai di link email.

    Default: ambil dari domain/port request yang sedang berjalan (otomatis
    benar baik di localhost maupun saat sudah di-deploy). Bisa di-override
    lewat env var APP_BASE_URL, misalnya kalau app berjalan di belakang
    reverse proxy dengan domain publik yang berbeda dari yang dilihat Flask.
    """
    override = os.environ.get('APP_BASE_URL')
    if override:
        return override.rstrip('/')
    return request.host_url.rstrip('/')


# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 2. MENGAMBIL STATISTIK PENGISIAN ====================

@pengisian_bp.route('/stats', methods=['GET'])
def get_pengisian_stats():
    from sqlalchemy import func


    latest_dates = db.session.query(
        Pengisian.id_balita.label('id_balita'),
        func.max(Pengisian.tanggal_pengisian).label('max_tanggal')
    ).group_by(Pengisian.id_balita).subquery()


    latest_rows = db.session.query(Pengisian.status_pertumbuhan).join(
        latest_dates,
        db.and_(
            Pengisian.id_balita == latest_dates.c.id_balita,
            Pengisian.tanggal_pengisian == latest_dates.c.max_tanggal
        )
    ).all()

    total = len(latest_rows)
    counts = {status: sum(1 for r in latest_rows if r.status_pertumbuhan == status) for status in STATUS_PERTUMBUHAN_VALUES}
    normal = counts.get(STATUS_PERTUMBUHAN_VALUES[0], 0)
    pendek = counts.get(STATUS_PERTUMBUHAN_VALUES[1], 0)
    sangat_pendek = counts.get(STATUS_PERTUMBUHAN_VALUES[2], 0)

    return jsonify({
        'total': total,
        'normal': normal,
        'pendek': pendek,
        'sangat_pendek': sangat_pendek
    })


# ==================== 3. MENGAMBIL PENGISIAN BERDASARKAN ID ====================

@pengisian_bp.route('/<id_pengisian>', methods=['GET'])
def get_pengisian_by_id(id_pengisian):
    """Mengambil satu pengisian beserta snapshot hasil analisis dari database.

    Endpoint ini read-only: tidak menjalankan ulang prediksi/regresi.
    Semua nilai analisis diambil dari kolom pengisian/faktor_risiko yang
    sudah disimpan ketika pengisian dibuat.
    """
    try:
        pengisian = Pengisian.query.get(id_pengisian)
        if not pengisian:
            return jsonify({'error': 'Pengisian tidak ditemukan'}), 404

        details = DetailFaktorRisiko.query.filter_by(id_pengisian=id_pengisian).all()
        skor_map = pengisian.skor_dict()
        return jsonify({
        'id_pengisian': pengisian.id_pengisian,
        'id_balita': pengisian.id_balita,
        'tanggal_pengisian': str(pengisian.tanggal_pengisian),
        'usia_bulan': pengisian.usia_bulan,
        'tb_balita': round(pengisian.tb_balita, 3),
        'bb_balita': round(pengisian.bb_balita, 3),
        **{f'X{i}': round(skor_map.get(f'X{i}', 0.0), 3) for i in range(1, 11)},
        'nilai_tbu': round(pengisian.nilai_tbu, 3),
        'status_pertumbuhan': pengisian.status_pertumbuhan,
        'nilai_prediksi': round(pengisian.nilai_prediksi, 3) if pengisian.nilai_prediksi is not None else None,
        'status_risiko': pengisian.status_risiko,
        'perbandingan': pengisian.perbandingan,
        'status_perbandingan': pengisian.status_perbandingan,
        'analysis': _stored_analysis(pengisian),
        'details': [
            {'id_detail': d.id_detail, 'id_indikator': d.id_indikator, 'id_item': d.id_item, 'id_skala': d.id_skala, 'skor_srs': d.skor_srs}
            for d in details
        ],
        })
    except Exception:
        current_app.logger.exception('Gagal mengambil pengisian %s', id_pengisian)
        return jsonify({'error': 'Gagal mengambil data pengisian'}), 500

# ==================== 4. MEMBUAT DATA PENGISIAN ====================

@pengisian_bp.route('', methods=['POST'])
def create_pengisian():
    data = request.get_json(silent=True) or {}
    try:
        required_fields = ('id_balita', 'tb_balita', 'bb_balita', 'details')
        missing = [field for field in required_fields if data.get(field) is None]
        if missing:
            return jsonify({'error': f"Field {missing[0]} wajib diisi"}), 400

        balita = IdentitasBalita.query.get(data['id_balita'])
        if not balita:
            return jsonify({'error': 'Balita tidak ditemukan'}), 404

        tb = parse_measurement(data['tb_balita'], 'Tinggi badan', TB_MIN, TB_MAX)
        bb = parse_measurement(data['bb_balita'], 'Berat badan', BB_MIN, BB_MAX)
        age_months = validate_child_age(balita)
        validate_height_history(balita, tb)
        validate_details(data['details'])


        # Dulu di-loop & dihitung ulang lewat calculate_age_in_months per baris; sekarang
        # cukup query langsung karena usia_bulan disimpan sebagai kolom di pengisian
        # (juga sudah dijaga oleh UNIQUE(id_balita, usia_bulan) di level database).
        duplicate = Pengisian.query.filter_by(id_balita=balita.id_balita, usia_bulan=age_months).first()
        if duplicate:
            return jsonify({
                'error': 'Balita sudah memiliki pengisian pada usia saat ini',
                'duplicate_id': duplicate.id_pengisian,
            }), 409

        composite_scores = _compute_composite_scores(data['details'])
        nilai_tbu = calculate_zscore_tb(tb, age_months, balita.jenis_kelamin)

        new_pengisian = Pengisian(
            id_pengisian=f"ANS-{uuid.uuid4().hex}",
            id_balita=balita.id_balita,
            tanggal_pengisian=datetime.now().date(),
            usia_bulan=age_months,
            tb_balita=tb,
            bb_balita=bb,
            nilai_tbu=nilai_tbu,
            status_pertumbuhan=classify_stunting(nilai_tbu),
        )
        db.session.add(new_pengisian)

        # Skor komposit per variabel (X1..X10) -- satu baris per variabel di pengisian_skor,
        # bukan lagi kolom tetap di tabel pengisian.
        for id_variabel, skor in composite_scores.items():
            db.session.add(FaktorRisiko(
                id_pengisian=new_pengisian.id_pengisian,
                id_variabel=id_variabel,
                skor_komposit=skor,
            ))

        for detail in data['details']:
            db.session.add(DetailFaktorRisiko(
                id_pengisian=new_pengisian.id_pengisian,
                id_indikator=ITEM_BY_ID[str(detail['id_item']).strip()]['id_indikator'],
                id_item=str(detail['id_item']).strip(),
                id_skala=int(detail['id_skala']),
                skor_srs=_item_srs_value(str(detail['id_item']).strip(), int(detail['id_skala'])),
            ))

        # Semua hasil model disimpan sekali sebagai snapshot histori.
        # Halaman analisis selanjutnya hanya membaca snapshot dari database.
        db.session.flush()
        calculate_and_store_prediction(new_pengisian)
        db.session.commit()
        return jsonify({
            'message': 'Pengisian berhasil disimpan',
            'id_pengisian': new_pengisian.id_pengisian,
        }), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400
    except Exception:
        db.session.rollback()
        current_app.logger.exception('Gagal membuat pengisian')
        return jsonify({'error': 'Gagal menyimpan pengisian'}), 500

# ==================== 5. MENGIRIM EMAIL HASIL ANALISIS ====================

@pengisian_bp.route('/send-email', methods=['POST'])
def send_email_consolidated():
    """Send one email using authoritative parent/child data from the database."""
    data = request.get_json(silent=True) or {}
    pengisian_ids = data.get('pengisian_ids')
    email = (data.get('email') or '').strip()

    if not isinstance(pengisian_ids, list) or not pengisian_ids or not email:
        return jsonify({'error': 'pengisian_ids dan email wajib diisi'}), 400
    if len(pengisian_ids) > 4 or len(set(pengisian_ids)) != len(pengisian_ids):
        return jsonify({'error': 'Daftar pengisian tidak valid'}), 400

    try:
        orang_tua = IdentitasOrangTua.query.filter(IdentitasOrangTua.email.ilike(email)).first()
        if not orang_tua:
            return jsonify({'error': 'Orang tua tidak ditemukan'}), 404

        pengisians = Pengisian.query.filter(Pengisian.id_pengisian.in_(pengisian_ids)).all()
        by_id = {p.id_pengisian: p for p in pengisians}
        if len(by_id) != len(pengisian_ids):
            return jsonify({'error': 'Terdapat pengisian yang tidak ditemukan'}), 404

        balita = IdentitasBalita.query.filter(
            IdentitasBalita.id_balita.in_([p.id_balita for p in pengisians]),
            IdentitasBalita.id_orang_tua == orang_tua.id_orang_tua,
        ).all()
        balita_by_id = {b.id_balita: b for b in balita}
        if len(balita_by_id) != len({p.id_balita for p in pengisians}):
            return jsonify({'error': 'Pengisian tidak terkait dengan akun orang tua tersebut'}), 403

        names = [balita_by_id[p.id_balita].nama_balita for p in pengisians]
        if len(names) == 1:
            names_text = names[0]
        elif len(names) == 2:
            names_text = f'{names[0]} dan {names[1]}'
        else:
            names_text = ', '.join(names[:-1]) + f', dan {names[-1]}'

        analysis_url = f"{_get_base_url()}/analysis.html?id=" + '&id='.join(pengisian_ids)
        msg = Message(
            subject='Hasil Analisis Kesehatan Balita - StunTrack',
            sender=('StunTrack', current_app.config['MAIL_DEFAULT_SENDER']),
            recipients=[orang_tua.email],
        )
        msg.html = render_email_template(
            'prediction_result.html',
            nama_orang_tua=orang_tua.nama_orang_tua or 'Orang Tua',
            balita_names=names_text,
            analysis_url=analysis_url,
        )
        attach_logo(msg)
        mail.send(msg)
        return jsonify({'message': 'Email berhasil dikirim'}), 200
    except Exception:
        current_app.logger.exception('Gagal mengirim email hasil analisis')
        return jsonify({'error': 'Gagal mengirim email hasil analisis'}), 500

# ==================== 6. MENGHAPUS DATA PENGISIAN ====================

@pengisian_bp.route('/<id_pengisian>', methods=['DELETE'])
def delete_pengisian(id_pengisian):
    pengisian = Pengisian.query.get_or_404(id_pengisian)
    data = request.get_json(silent=True) or {}
    parent_id = data.get('id_orang_tua') or request.args.get('id_orang_tua')


    if not parent_id:
        return jsonify({'error': 'id_orang_tua wajib diisi'}), 403

    balita = IdentitasBalita.query.get(pengisian.id_balita)
    if not balita or balita.id_orang_tua != parent_id:
        return jsonify({'error': 'Tidak berhak menghapus pengisian ini'}), 403

    try:
        DetailFaktorRisiko.query.filter_by(id_pengisian=id_pengisian).delete(synchronize_session=False)
        db.session.delete(pengisian)
        db.session.commit()
        return jsonify({'message': 'Pengisian dan detail terkait berhasil dihapus'})
    except Exception:
        db.session.rollback()
        current_app.logger.exception('Gagal menghapus pengisian %s', id_pengisian)
        return jsonify({'error': 'Gagal menghapus pengisian'}), 500

# ==================== 7. MEMERIKSA USIA PENGISIAN ====================

@pengisian_bp.route('/check-usia/<id_balita>', methods=['GET'])
def check_usia_pengisian(id_balita):
    balita = IdentitasBalita.query.get(id_balita)
    if not balita:
        return jsonify({'error': 'Balita not found'}), 404

    today = datetime.now().date()
    age_months_now = calculate_age_in_months(balita.tanggal_lahir, today)

    duplicate = Pengisian.query.filter_by(id_balita=id_balita, usia_bulan=age_months_now).first()


    next_fill_age = min(age_months_now + 1, 60)
    next_fill_date = balita.tanggal_lahir + relativedelta(months=next_fill_age)

    result = {
        'id_balita': id_balita,
        'nama_balita': balita.nama_balita,
        'age_months_now': age_months_now,
        'has_duplicate': duplicate is not None,
        'next_fill_age': next_fill_age,
        'next_fill_date': str(next_fill_date),
    }
    if duplicate:
        result['duplicate'] = {
            'id_pengisian': duplicate.id_pengisian,
            'tanggal_pengisian': str(duplicate.tanggal_pengisian),
        }
    return jsonify(result)


# ==================== 8. MENGAMBIL RIWAYAT PENGISIAN BALITA ====================

@pengisian_bp.route('/balita/<id_balita>', methods=['GET'])
def get_pengisian_by_balita(id_balita):
    pengisians = Pengisian.query.filter_by(id_balita=id_balita).order_by(Pengisian.tanggal_pengisian.desc()).all()
    balita = IdentitasBalita.query.get(id_balita)
    if not balita:
        return jsonify({'error': 'Balita not found'}), 404

    result = []
    for p in pengisians:

        age_months = p.usia_bulan
        age_years = math.floor(age_months / 12)
        age_remaining_months = age_months % 12
        age_str = f"{age_years} tahun {age_remaining_months} bulan" if age_years > 0 else f"{age_months} bulan"

        result.append({
            'id_pengisian': p.id_pengisian,
            'tanggal_pengisian': str(p.tanggal_pengisian),
            'umur': age_str,
            'tb_balita': round(p.tb_balita, 3) if p.tb_balita is not None else None,
            'bb_balita': round(p.bb_balita, 3) if p.bb_balita is not None else None,
            'status_pertumbuhan': p.status_pertumbuhan
        })
    return jsonify(result)
