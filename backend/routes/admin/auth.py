# ==========================================
# SECTION: Imports
# ==========================================

from flask import Blueprint, request, jsonify, session, current_app
from functools import wraps
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets

from werkzeug.security import check_password_hash, generate_password_hash
from flask_mail import Message

from backend.models import db, Admin, AdminLogin
from backend.config import mail
from backend.emails.utils import attach_logo, render_email_template

admin_auth_bp = Blueprint('admin_auth', __name__, url_prefix='/api/admin')

OTP_TTL_MINUTES = 10
MAX_OTP_ATTEMPTS = 5


# ==========================================
# SECTION: Authentication
# ==========================================
# ==================== 1. MEMBUAT HASH KODE OTP ====================

def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode('utf-8')).hexdigest()


# ==================== 2. MEMVALIDASI AKSES ADMIN ====================

def admin_required(view_func):
    """Decorator untuk melindungi endpoint yang hanya boleh diakses admin yang sudah login."""
# ==================== 3. MEMBUNGKUS AKSES ADMIN ====================

    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if not session.get('admin_id'):
            return jsonify({'error': 'Unauthorized. Silakan login sebagai admin.'}), 401
        return view_func(*args, **kwargs)
    return wrapper


# ==================== 4. MEMASTIKAN ADMIN DEFAULT TERSEDIA ====================

def ensure_default_admin(app):
    """Buat akun admin default (dari Config) jika tabel admin masih kosong.
    Dipanggil sekali saat aplikasi start (lihat app.py)."""
    with app.app_context():
        if Admin.query.first() is None:
            default_email = app.config.get('ADMIN_DEFAULT_EMAIL', 'admin@example.com')
            default_password = app.config['ADMIN_DEFAULT_PASSWORD']
            admin = Admin(
                email_admin=default_email,
                password_hash=generate_password_hash(default_password)
            )
            db.session.add(admin)
            db.session.commit()


# ==================== 5. MENGIRIM EMAIL OTP ====================

def _send_otp_email(to_email, code):
    msg = Message(
        subject='Kode Verifikasi Login Admin - StunTrack',
        sender=('StunTrack', current_app.config['MAIL_DEFAULT_SENDER']),
        recipients=[to_email],
    )
    msg.html = render_email_template('login_otp.html', code=code, otp_ttl_minutes=OTP_TTL_MINUTES)
    try:
        attach_logo(msg)
    except Exception:
        pass
    mail.send(msg)


# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 6. MEMPROSES LOGIN ADMIN TAHAP 1 ====================

@admin_auth_bp.route('/login', methods=['POST'])
def admin_login_step1():
    """Step 1: validasi email + password. Jika benar, kirim kode OTP ke email admin."""
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email dan password wajib diisi'}), 400

    admin = Admin.query.filter(Admin.email_admin.ilike(email)).first()
    if not admin or not check_password_hash(admin.password_hash, password):
        return jsonify({'error': 'Email atau password salah'}), 401

    login_id = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)

    otp = AdminLogin(
        id_login=login_id,
        id_admin=admin.id_admin,
        code_hash=_hash_code(code),
        expires_at=expires_at,
    )
    db.session.add(otp)
    db.session.commit()

    try:
        _send_otp_email(admin.email_admin, code)
    except Exception as e:
        return jsonify({'error': f'Gagal mengirim email verifikasi: {str(e)}'}), 500


    local, _, domain = admin.email_admin.partition('@')
    masked = (local[:2] + '***') if len(local) > 2 else (local[:1] + '***')
    masked_email = f"{masked}@{domain}"

    return jsonify({
        'message': 'Kode verifikasi telah dikirim ke email admin.',
        'login_id': login_id,
        'masked_email': masked_email,
        'expires_in_minutes': OTP_TTL_MINUTES,
    }), 200


# ==================== 7. MEMPROSES LOGIN ADMIN TAHAP 2 ====================

@admin_auth_bp.route('/verify-otp', methods=['POST'])
def admin_login_step2():
    """Step 2: verifikasi kode OTP yang dikirim ke email, lalu buat session login."""
    data = request.get_json(silent=True) or {}
    login_id = data.get('login_id') or ''
    code = (data.get('code') or '').strip()

    if not login_id or not code:
        return jsonify({'error': 'login_id dan code wajib diisi'}), 400

    otp = AdminLogin.query.filter_by(id_login=login_id).first()
    if not otp:
        return jsonify({'error': 'Sesi login tidak valid. Silakan login ulang.'}), 400

    if otp.used_at is not None:
        return jsonify({'error': 'Kode ini sudah digunakan. Silakan login ulang.'}), 400

    if otp.expires_at < datetime.utcnow():
        return jsonify({'error': 'Kode verifikasi sudah kedaluwarsa. Silakan login ulang.'}), 400

    if otp.attempts >= MAX_OTP_ATTEMPTS:
        return jsonify({'error': 'Terlalu banyak percobaan. Silakan login ulang.'}), 400

    if not hmac.compare_digest(_hash_code(code), otp.code_hash):
        otp.attempts += 1
        db.session.commit()
        sisa = MAX_OTP_ATTEMPTS - otp.attempts
        return jsonify({'error': f'Kode verifikasi salah. Sisa percobaan: {max(sisa, 0)}'}), 400

    otp.used_at = datetime.utcnow()
    admin = Admin.query.get(otp.id_admin)
    if admin:
        admin.active_at = datetime.utcnow()
        admin.last_login_at = datetime.utcnow()
    db.session.commit()

    admin = Admin.query.get(otp.id_admin)
    session.clear()
    session['admin_id'] = admin.id_admin
    session['admin_email'] = admin.email_admin
    session.permanent = True

    return jsonify({'message': 'Login berhasil', 'email': admin.email_admin}), 200


# ==================== 8. MEMPROSES LOGOUT ADMIN ====================

@admin_auth_bp.route('/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return jsonify({'message': 'Logout berhasil'}), 200


# ==================== 9. MEMERIKSA SESSION ADMIN ====================

@admin_auth_bp.route('/session', methods=['GET'])
def admin_session_check():
    if session.get('admin_id'):
        return jsonify({'logged_in': True, 'email': session.get('admin_email')}), 200
    return jsonify({'logged_in': False}), 200
