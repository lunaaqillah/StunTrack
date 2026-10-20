# ============================================================
# SECTION: Imports
# ============================================================

import hashlib
import os
import re
import secrets
import json
from pathlib import Path
from datetime import date, datetime, timedelta
from urllib.parse import quote

from dateutil import parser
from dateutil.relativedelta import relativedelta
from flask import Blueprint, current_app, jsonify, redirect, request
from flask_mail import Message
from sqlalchemy import func

from backend.config import mail
from backend.emails.utils import attach_logo, render_email_template
from backend.models import (
    db,
    DetailFaktorRisiko,
    IdentitasBalita,
    IdentitasOrangTua,
    KonfirmasiToken,
    Pengisian,
)

_DATA_DIR = Path(__file__).resolve().parents[1] / 'data'
with open(_DATA_DIR / 'riwayat_gondok.json', encoding='utf-8') as f:
    RIWAYAT_GONDOK_CONFIG = json.load(f)
RIWAYAT_GONDOK_VALUES = RIWAYAT_GONDOK_CONFIG['values']


# ============================================================
# SECTION: Blueprints
# ============================================================

identitas_orang_tua_bp = Blueprint(
    'identitas_orang_tua',
    __name__,
    url_prefix='/identitas_orang_tua',
)
identitas_balita_bp = Blueprint(
    'identitas_balita',
    __name__,
    url_prefix='/identitas_balita',
)
hapus_data_bp = Blueprint(
    'hapus_data',
    __name__,
    url_prefix='/account',
)


@identitas_orang_tua_bp.route('/reference/riwayat_gondok', methods=['GET'])
def get_riwayat_gondok_reference():
    return jsonify(RIWAYAT_GONDOK_CONFIG)


# ============================================================
# SECTION: Identitas Orang Tua
# ============================================================

# ==================== 1. MEMERIKSA EMAIL ORANG TUA ====================

@identitas_orang_tua_bp.route('/check_email/<email>', methods=['GET'])
def check_email(email):

    orang_tua = IdentitasOrangTua.query.filter(IdentitasOrangTua.email.ilike(email)).first()
    if orang_tua:

        balitas = IdentitasBalita.query.filter_by(id_orang_tua=orang_tua.id_orang_tua).all()
        children = []
        for b in balitas:
            children.append({
                'id_balita': b.id_balita,
                'nama_balita': b.nama_balita,
                'jenis_kelamin': b.jenis_kelamin,
                'tanggal_lahir': str(b.tanggal_lahir)
            })
        return jsonify({
            'exists': True,
            'parent': {
                'id_orang_tua': orang_tua.id_orang_tua,
                'nama_orang_tua': orang_tua.nama_orang_tua,
                'tanggal_lahir': str(orang_tua.tanggal_lahir),
                'pekerjaan': orang_tua.pekerjaan,
                'alamat': orang_tua.alamat,
                'pendidikan': orang_tua.pendidikan,
                'email': orang_tua.email,
                'riwayat_gondok': orang_tua.riwayat_gondok
            },
            'children': children
        })
    else:
        return jsonify({'exists': False})


# ==================== 2. MENGAMBIL IDENTITAS ORANG TUA BERDASARKAN ID ====================

@identitas_orang_tua_bp.route('/<id_orang_tua>', methods=['GET'])
def get_identitas_orang_tua_by_id(id_orang_tua):
    orang_tua = IdentitasOrangTua.query.get_or_404(id_orang_tua)
    return jsonify({
        'id_orang_tua': orang_tua.id_orang_tua,
        'nama_orang_tua': orang_tua.nama_orang_tua,
        'tanggal_lahir': str(orang_tua.tanggal_lahir),
        'pekerjaan': orang_tua.pekerjaan,
        'alamat': orang_tua.alamat,
        'pendidikan': orang_tua.pendidikan,
        'email': orang_tua.email,
        'riwayat_gondok': orang_tua.riwayat_gondok
    })


# ==================== 3. MEMBUAT IDENTITAS ORANG TUA ====================

@identitas_orang_tua_bp.route('', methods=['POST'])
def create_identitas_orang_tua():
    data = request.get_json(silent=True) or {}
    try:

        required_fields = ['tanggal_lahir', 'pekerjaan', 'alamat', 'pendidikan', 'email', 'riwayat_gondok']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Field {field} is required and cannot be empty'}), 400

        if 'nama_orang_tua' not in data or not data['nama_orang_tua']:
            data['nama_orang_tua'] = 'ANONIM'
        email = data['email'].strip()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
            return jsonify({'error': 'Format email tidak valid'}), 400
        data['email'] = email


        if data['riwayat_gondok'] not in RIWAYAT_GONDOK_VALUES:
            allowed = ', '.join(RIWAYAT_GONDOK_VALUES.keys())
            return jsonify({'error': f'riwayat_gondok must be one of: {allowed}'}), 400

        from dateutil import parser
        try:
            tanggal_lahir_obj = parser.parse(data['tanggal_lahir']).date()
        except (TypeError, ValueError, OverflowError):
            return jsonify({'error': 'tanggal_lahir format invalid'}), 400
        if tanggal_lahir_obj > date.today():
            return jsonify({'error': 'tanggal_lahir tidak boleh berada di masa depan'}), 400

        new_orang_tua = IdentitasOrangTua(
            nama_orang_tua=data.get('nama_orang_tua') or 'ANONIM',
            tanggal_lahir=tanggal_lahir_obj,
            pekerjaan=data['pekerjaan'],
            alamat=data['alamat'],
            pendidikan=data['pendidikan'],
            email=data['email'],
            riwayat_gondok=data['riwayat_gondok']
        )


        existing = IdentitasOrangTua.query.filter(IdentitasOrangTua.id_orang_tua == new_orang_tua.id_orang_tua).first()
        if existing:
            existing.nama_orang_tua = new_orang_tua.nama_orang_tua
            existing.tanggal_lahir = new_orang_tua.tanggal_lahir
            existing.pekerjaan = new_orang_tua.pekerjaan
            existing.alamat = new_orang_tua.alamat
            existing.pendidikan = new_orang_tua.pendidikan
            existing.email = new_orang_tua.email
            existing.riwayat_gondok = new_orang_tua.riwayat_gondok
            db.session.commit()
            return jsonify({'message': 'Orang tua updated successfully', 'id_orang_tua': existing.id_orang_tua}), 200


        existing_by_email_dob = IdentitasOrangTua.query.filter(
            IdentitasOrangTua.email.ilike(new_orang_tua.email),
            IdentitasOrangTua.tanggal_lahir == new_orang_tua.tanggal_lahir
        ).first()
        if existing_by_email_dob:
            existing_by_email_dob.nama_orang_tua = new_orang_tua.nama_orang_tua
            existing_by_email_dob.pekerjaan = new_orang_tua.pekerjaan
            existing_by_email_dob.alamat = new_orang_tua.alamat
            existing_by_email_dob.pendidikan = new_orang_tua.pendidikan
            existing_by_email_dob.riwayat_gondok = new_orang_tua.riwayat_gondok
            db.session.commit()
            return jsonify({'message': 'Orang tua updated successfully', 'id_orang_tua': existing_by_email_dob.id_orang_tua}), 200

        db.session.add(new_orang_tua)
        db.session.commit()
        return jsonify({'message': 'Orang tua created successfully', 'id_orang_tua': new_orang_tua.id_orang_tua}), 201


    except Exception:
        db.session.rollback()
        current_app.logger.exception('Gagal membuat orang tua')
        return jsonify({'error': 'Gagal menyimpan data orang tua'}), 500


# ==================== 4. MEMPERBARUI IDENTITAS ORANG TUA ====================

@identitas_orang_tua_bp.route('/<id_orang_tua>', methods=['PUT'])
def update_identitas_orang_tua(id_orang_tua):
    orang_tua = IdentitasOrangTua.query.get_or_404(id_orang_tua)
    data = request.get_json(silent=True) or {}
    try:

        if 'riwayat_gondok' in data and data['riwayat_gondok'] not in RIWAYAT_GONDOK_VALUES:
            allowed = ', '.join(RIWAYAT_GONDOK_VALUES.keys())
            return jsonify({'error': f'riwayat_gondok must be one of: {allowed}'}), 400

        if 'tanggal_lahir' in data:
            from dateutil import parser
            try:
                parser.parse(data['tanggal_lahir']).date()
            except (TypeError, ValueError, OverflowError):
                return jsonify({'error': 'tanggal_lahir format invalid'}), 400

        orang_tua.nama_orang_tua = data.get('nama_orang_tua', orang_tua.nama_orang_tua)


        orang_tua.pekerjaan = data.get('pekerjaan', orang_tua.pekerjaan)
        orang_tua.alamat = data.get('alamat', orang_tua.alamat)
        orang_tua.pendidikan = data.get('pendidikan', orang_tua.pendidikan)
        orang_tua.riwayat_gondok = data.get('riwayat_gondok', orang_tua.riwayat_gondok)
        db.session.commit()
        return jsonify({'message': 'Orang tua updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update orang tua: {str(e)}'}), 500

# ============================================================
# SECTION: Identitas Balita
# ============================================================

# ==================== 1. MENERJEMAHKAN FORMAT TANGGAL INDONESIA ====================

def translate_indonesian_date(date_str):
    indonesian_to_english = {
        'Januari': 'January', 'Februari': 'February', 'Maret': 'March', 'April': 'April',
        'Mei': 'May', 'Juni': 'June', 'Juli': 'July', 'Agustus': 'August',
        'September': 'September', 'Oktober': 'October', 'November': 'November', 'Desember': 'December'
    }
    for indo, eng in indonesian_to_english.items():
        date_str = date_str.replace(indo, eng)
    return date_str


# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 2. MENGAMBIL IDENTITAS BALITA BERDASARKAN ID ====================

@identitas_balita_bp.route('/<id_balita>', methods=['GET'])
def get_identitas_balita_by_id(id_balita):
    balita = IdentitasBalita.query.get_or_404(id_balita)
    return jsonify({
        'id_balita': balita.id_balita,
        'nama_balita': balita.nama_balita,
        'tanggal_lahir': str(balita.tanggal_lahir),
        'jenis_kelamin': balita.jenis_kelamin,
        'id_orang_tua': balita.id_orang_tua
    })


# ==================== 3. MEMBUAT IDENTITAS BALITA ====================

@identitas_balita_bp.route('', methods=['POST'])
def create_identitas_balita():
    data = request.get_json()
    try:

        required_fields = ['nama_balita', 'tanggal_lahir', 'jenis_kelamin', 'id_orang_tua']
        for field in required_fields:
            if field not in data or data[field] is None:
                return jsonify({'error': f'Field {field} is required'}), 400

        if data['jenis_kelamin'] not in ['Laki-laki', 'Perempuan']:
            return jsonify({'error': 'jenis_kelamin must be "Laki-laki" or "Perempuan"'}), 400

        try:
            tanggal = parser.parse(data['tanggal_lahir']).date()
        except (TypeError, ValueError, OverflowError):
            return jsonify({'error': 'tanggal_lahir format invalid'}), 400
        if tanggal > date.today():
            return jsonify({'error': 'tanggal_lahir tidak boleh berada di masa depan'}), 400

        if not IdentitasOrangTua.query.get(data['id_orang_tua']):
            return jsonify({'error': 'id_orang_tua does not exist'}), 400
        age = relativedelta(date.today(), tanggal)
        if age.years > 5 or (age.years == 5 and age.months > 0):
            return jsonify({'error': 'Usia balita maksimal 5 tahun'}), 400

        existing_balita = IdentitasBalita.query.filter(
            func.lower(IdentitasBalita.nama_balita) == data['nama_balita'].lower(),
            IdentitasBalita.tanggal_lahir == tanggal,
            IdentitasBalita.id_orang_tua == data['id_orang_tua']
        ).first()
        if existing_balita:
            return jsonify({
                'message': 'Balita already exists',
                'id_balita': existing_balita.id_balita
            }), 200
        new_balita = IdentitasBalita(
            nama_balita=data['nama_balita'],
            tanggal_lahir=tanggal,
            jenis_kelamin=data['jenis_kelamin'],
            id_orang_tua=data['id_orang_tua']
        )
        db.session.add(new_balita)
        db.session.commit()
        return jsonify({'message': 'Balita created successfully', 'id_balita': new_balita.id_balita}), 201
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Gagal menyimpan data balita'}), 500


# ==================== 4. MEMPERBARUI IDENTITAS BALITA ====================

@identitas_balita_bp.route('/<id_balita>', methods=['PUT'])
def update_identitas_balita(id_balita):
    balita = IdentitasBalita.query.get_or_404(id_balita)
    data = request.get_json()
    try:

        if 'jenis_kelamin' in data and data['jenis_kelamin'] not in ['Laki-laki', 'Perempuan']:
            return jsonify({'error': 'jenis_kelamin must be "Laki-laki" or "Perempuan"'}), 400

        if 'tanggal_lahir' in data:
            try:
                tanggal_baru = parser.parse(data['tanggal_lahir']).date()
            except (TypeError, ValueError, OverflowError):
                return jsonify({'error': 'tanggal_lahir format invalid'}), 400
            if tanggal_baru > date.today():
                return jsonify({'error': 'tanggal_lahir tidak boleh berada di masa depan'}), 400
            age = relativedelta(date.today(), tanggal_baru)
            if age.years > 5 or (age.years == 5 and age.months > 0):
                return jsonify({'error': 'Usia balita maksimal 5 tahun'}), 400

        if 'id_orang_tua' in data:
            if not IdentitasOrangTua.query.get(data['id_orang_tua']):
                return jsonify({'error': 'id_orang_tua does not exist'}), 400
        balita.nama_balita = data.get('nama_balita', balita.nama_balita)
        if 'tanggal_lahir' in data:
            balita.tanggal_lahir = parser.parse(data['tanggal_lahir']).date()
        balita.jenis_kelamin = data.get('jenis_kelamin', balita.jenis_kelamin)
        balita.id_orang_tua = data.get('id_orang_tua', balita.id_orang_tua)
        db.session.commit()
        return jsonify({'message': 'Balita updated successfully'})
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Gagal memperbarui data balita'}), 500


# ==================== 5. MEMERIKSA DATA BALITA UNTUK PEMULIHAN ====================

@identitas_balita_bp.route('/restore', methods=['GET'])
def restore_identitas_balita():
    id_orang_tua = request.args.get('id_orang_tua')
    nama = request.args.get('nama')
    tanggal_lahir = request.args.get('tanggal_lahir')

    if not id_orang_tua or not nama or not tanggal_lahir:
        return jsonify({'error': 'id_orang_tua, nama, and tanggal_lahir are required'}), 400

    try:

        tanggal_parsed = parser.parse(translate_indonesian_date(tanggal_lahir)).date()
    except Exception as e:
        return jsonify({'error': f'Invalid tanggal_lahir format: {str(e)}'}), 400

    balita = IdentitasBalita.query.filter(
        func.lower(IdentitasBalita.nama_balita) == nama.strip().lower(),
        IdentitasBalita.tanggal_lahir == tanggal_parsed,
        IdentitasBalita.id_orang_tua == id_orang_tua
    ).first()

    if not balita:
        return jsonify({'found': False})

    latest_pengisian = Pengisian.query.filter_by(id_balita=balita.id_balita) \
        .order_by(Pengisian.tanggal_pengisian.desc()).first()

    return jsonify({
        'found': True,
        'balita': {
            'id_balita': balita.id_balita,
            'nama_balita': balita.nama_balita,
            'tanggal_lahir': str(balita.tanggal_lahir),
            'jenis_kelamin': balita.jenis_kelamin,
            'id_orang_tua': balita.id_orang_tua
        },
        'latest_pengisian': {
            'tb_balita': latest_pengisian.tb_balita,
            'bb_balita': latest_pengisian.bb_balita,
            'tanggal_pengisian': str(latest_pengisian.tanggal_pengisian)
        } if latest_pengisian else None
    })


# ==================== 6. MENCARI DATA BALITA ====================

@identitas_balita_bp.route('/search', methods=['GET'])
def search_balita():
    nama = request.args.get('nama')
    tanggal_balita = request.args.get('tanggal_balita')
    tanggal_orang_tua = request.args.get('tanggal_orang_tua')

    if not nama or not tanggal_balita or not tanggal_orang_tua:
        return jsonify({'error': 'nama, tanggal_balita, and tanggal_orang_tua are required'}), 400

    try:

        tanggal_balita_parsed = parser.parse(translate_indonesian_date(tanggal_balita)).date()
        tanggal_orang_tua_parsed = parser.parse(translate_indonesian_date(tanggal_orang_tua)).date()
    except Exception as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400


    balita = IdentitasBalita.query.join(IdentitasOrangTua).filter(
        IdentitasBalita.nama_balita.ilike(f'%{nama.strip()}%'),
        IdentitasBalita.tanggal_lahir == tanggal_balita_parsed,
        IdentitasOrangTua.tanggal_lahir == tanggal_orang_tua_parsed
    ).first()

    if not balita:
        return jsonify({'error': 'No matching balita found'}), 404


    orang_tua = balita.orang_tua


    latest_pengisian = Pengisian.query.filter_by(id_balita=balita.id_balita).order_by(Pengisian.tanggal_pengisian.desc()).first()

    response = {
        'balita': {
            'id_balita': balita.id_balita,
            'nama_balita': balita.nama_balita,
            'tanggal_lahir': str(balita.tanggal_lahir),
            'jenis_kelamin': balita.jenis_kelamin,
            'tinggi_badan': latest_pengisian.tb_balita if latest_pengisian else None,
            'berat_badan': latest_pengisian.bb_balita if latest_pengisian else None,
            'status_pertumbuhan': latest_pengisian.status_pertumbuhan if latest_pengisian else None
        },
        'orang_tua': {
            'nama_orang_tua': orang_tua.nama_orang_tua,
            'tanggal_lahir': str(orang_tua.tanggal_lahir),
            'email': orang_tua.email,
            'pekerjaan': orang_tua.pekerjaan,
            'pendidikan': orang_tua.pendidikan,
            'riwayat_gondok': orang_tua.riwayat_gondok,
            'alamat': orang_tua.alamat
        }
    }

    return jsonify(response)

# ============================================================
# SECTION: Penghapusan Data
# ============================================================

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


# ==================== 2. MEMBUAT HASH TOKEN ====================

def _hash_token(token: str) -> str:

    return hashlib.sha256(token.encode('utf-8')).hexdigest()


# ==================== 3. MENGAMBIL DATA REQUEST ====================

def _get_request_data():
    if request.is_json:
        return request.get_json() or {}
    return request.form.to_dict() or {}


# ==================== 4. MENGHAPUS HIERARKI DATA ORANG TUA ====================

def _purge_orang_tua_hierarchy(orang_tua_id: str):
    """Delete: orang_tua -> balita -> pengisian -> detail_faktor_risiko"""
    balitas = IdentitasBalita.query.filter_by(id_orang_tua=orang_tua_id).all()
    balita_ids = [b.id_balita for b in balitas]

    pengisians = Pengisian.query.filter(Pengisian.id_balita.in_(balita_ids)).all() if balita_ids else []
    pengisian_ids = [p.id_pengisian for p in pengisians]

    if pengisian_ids:
        details = DetailFaktorRisiko.query.filter(DetailFaktorRisiko.id_pengisian.in_(pengisian_ids)).all()
        for d in details:
            db.session.delete(d)

    for p in pengisians:
        db.session.delete(p)

    for b in balitas:
        db.session.delete(b)

    orang_tua = IdentitasOrangTua.query.get(orang_tua_id)
    if orang_tua:
        db.session.delete(orang_tua)

    db.session.commit()


# ==================== 5. MENGIRIM EMAIL KONFIRMASI ====================

def _send_confirmation_email(template_name, subject, orang_tua, confirm_url):
    """Kirim email konfirmasi hapus data."""
    msg = Message(
        subject=subject,
        sender=('StunTrack', current_app.config['MAIL_DEFAULT_SENDER']),
        recipients=[orang_tua.email],
    )
    msg.html = render_email_template(
        template_name,
        nama_orang_tua=orang_tua.nama_orang_tua or 'Orang Tua',
        email=orang_tua.email,
        confirm_url=confirm_url,
    )
    try:

        attach_logo(msg)
        mail.send(msg)
    except Exception:

        pass


# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 6. MENANGANI REQUEST DELETE ====================

@hapus_data_bp.route('/request-delete', methods=['POST'])
def request_delete():
    """Request penghapusan via email confirm.
    Body: { email: string }
    It will delete orang tua hierarchy by email owner.
    """
    data = _get_request_data()
    email = (data.get('email') or '').strip()
    if not email:
        return jsonify({'error': 'email is required'}), 400

    orang_tua = IdentitasOrangTua.query.filter(IdentitasOrangTua.email.ilike(email)).first()
    if not orang_tua:
        return jsonify({'message': 'Jika data ditemukan, email konfirmasi akan dikirim.'}), 200

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=2)

    record = KonfirmasiToken(
        email=orang_tua.email,
        token_hash=_hash_token(token),
        expires_at=expires_at,
    )
    db.session.add(record)
    db.session.commit()

    confirm_url = f"{_get_base_url()}/account/confirm-delete/{record.token_hash}?token={token}"
    _send_confirmation_email('delete_data.html', 'Konfirmasi Penghapusan Data - StunTrack', orang_tua, confirm_url)

    return jsonify({'message': 'Jika data ditemukan, email konfirmasi akan dikirim.'}), 200


# ==================== 7. MENANGANI CONFIRM DELETE ====================

@hapus_data_bp.route('/confirm-delete/<token_hash>', methods=['GET'])
def confirm_delete(token_hash):
    token = request.args.get('token') or ''
    if not token:
        return redirect("/?delete_error=invalid")

    record = KonfirmasiToken.query.filter_by(token_hash=token_hash).first()
    if not record:
        return redirect("/?delete_error=invalid")

    if record.used_at is not None:


        orang_tua = IdentitasOrangTua.query.filter(IdentitasOrangTua.email.ilike(record.email)).first()
        deleted_email = orang_tua.email if orang_tua else ''
        return redirect(f"/?delete_success=1&email={quote(deleted_email)}")

    if record.expires_at < datetime.utcnow():
        return redirect("/?delete_error=expired")

    if _hash_token(token) != record.token_hash:
        return redirect("/?delete_error=invalid")


    record.used_at = datetime.utcnow()
    db.session.commit()


    orang_tua = IdentitasOrangTua.query.filter(IdentitasOrangTua.email.ilike(record.email)).first()
    deleted_email = orang_tua.email if orang_tua else ''


    _purge_orang_tua_hierarchy(record.target_id)


    return redirect(f"/?delete_success=1&email={quote(deleted_email)}")
