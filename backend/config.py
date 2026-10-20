# ==========================================
# SECTION: Imports
# ==========================================

import os
import secrets
from flask_mail import Mail
from dotenv import load_dotenv


load_dotenv()


# ==========================================
# SECTION: Configuration
# ==========================================
# ==================== 1. MENGAMBIL ATAU MEMBUAT SECRET KEY ====================

def _get_or_generate_secret_key() -> str:
    """Ambil SECRET_KEY dari env var. Kalau belum diisi, generate secret
    acak untuk sesi development kali ini SAJA (bukan nilai tetap yang bisa
    ditebak dari source code), sambil kasih warning ke terminal.

    PENTING: kalau SECRET_KEY berubah tiap restart, semua session login
    admin yang aktif akan otomatis logout. Untuk produksi / dipakai lebih
    dari satu proses (mis. beberapa worker gunicorn), WAJIB set
    STUNTRACK_SECRET_KEY di .env supaya nilainya konsisten.
    """
    key = os.environ.get('STUNTRACK_SECRET_KEY')
    if key:
        return key
    print(
        "[WARNING] STUNTRACK_SECRET_KEY belum diset di .env -- memakai secret "
        "key acak untuk sesi kali ini saja. Session admin akan ke-reset tiap "
        "app di-restart. Tambahkan STUNTRACK_SECRET_KEY ke file .env untuk "
        "produksi (lihat .env.example)."
    )
    return secrets.token_hex(32)


# ==================== 2. MENGAMBIL ATAU MEMBUAT PASSWORD ADMIN ====================

def _get_or_generate_admin_password() -> str:
    """Ambil password admin default dari env var. Kalau belum diisi, generate
    password acak dan ditampilkan SEKALI di terminal saat app pertama kali
    dijalankan (bukan nilai tetap 'StunTrackOfficial' yang nempel di kode).
    """
    password = os.environ.get('STUNTRACK_ADMIN_PASSWORD')
    if password:
        return password
    generated = secrets.token_urlsafe(12)
    print(
        "[WARNING] STUNTRACK_ADMIN_PASSWORD belum diset di .env -- password "
        f"admin default di-generate otomatis: {generated}\n"
        "          Catat password ini sekarang, atau set STUNTRACK_ADMIN_PASSWORD "
        "di .env supaya tetap sama tiap restart (lihat .env.example)."
    )
    return generated


# ==========================================
# SECTION: Configuration
# ==========================================

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(os.path.dirname(__file__), 'StunTrack.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False


    SECRET_KEY = _get_or_generate_secret_key()


    ADMIN_DEFAULT_EMAIL = os.environ.get('STUNTRACK_ADMIN_EMAIL', 'admin@example.com')
    ADMIN_DEFAULT_PASSWORD = _get_or_generate_admin_password()


    from datetime import timedelta
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.environ.get('STUNTRACK_COOKIE_SECURE', '0') == '1'


    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get('STUNTRACK_MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('STUNTRACK_MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('STUNTRACK_MAIL_USERNAME', '')


    CONTACT_NOTIFICATION_EMAIL = os.environ.get('STUNTRACK_CONTACT_EMAIL') or MAIL_USERNAME

    if not MAIL_USERNAME or not MAIL_PASSWORD:
        print(
            "[WARNING] STUNTRACK_MAIL_USERNAME / STUNTRACK_MAIL_PASSWORD belum diset "
            "di .env -- pengiriman email (OTP login admin, hasil analisis, dll) akan "
            "gagal sampai ini diisi. Lihat .env.example."
        )


mail = Mail()
