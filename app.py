# ==========================================
# SECTION: Imports
# ==========================================

from flask import Flask, send_file, send_from_directory
from backend.config import Config, mail
from backend.models import db
from flask_migrate import Migrate
from backend.routes.identitas import (
    hapus_data_bp,
    identitas_balita_bp,
    identitas_orang_tua_bp,
)
from backend.routes.survei.pengisian import pengisian_bp
from backend.routes.survei.kuesioner import kuesioner_bp
from backend.routes.survei.prediksi import prediksi_bp
from backend.routes.informasi.contact import contact_bp
from backend.routes.admin.auth import admin_auth_bp, ensure_default_admin
from backend.data.seed_responden import ensure_data_responden
from backend.routes.admin.dashboard_analytics import admin_dashboard_analytics_bp
from backend.routes.informasi.news import news_bp
import os
import webbrowser
import time
import threading


# ==========================================
# SECTION: Configuration
# ==========================================

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
migrate = Migrate(app, db)
mail.init_app(app)

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'backend', 'StunTrack.db')

with app.app_context():
    db_is_new = not os.path.exists(DATABASE_PATH)
    # Referensi instrumen (variabel, indikator, item, dan skala) berada di
    # backend/data/variable_database.py dan tidak disimpan sebagai tabel DB.
    db.create_all()
    ensure_default_admin(app)
    # Pastikan 400 data responden penelitian selalu ada, walau DB terhapus.
    ensure_data_responden(app)

app.register_blueprint(identitas_orang_tua_bp)
app.register_blueprint(identitas_balita_bp)
app.register_blueprint(pengisian_bp)
app.register_blueprint(kuesioner_bp)
app.register_blueprint(prediksi_bp)
app.register_blueprint(contact_bp)
app.register_blueprint(hapus_data_bp)
app.register_blueprint(admin_auth_bp)
app.register_blueprint(admin_dashboard_analytics_bp)
app.register_blueprint(news_bp)


# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 1. MENAMBAHKAN SECURITY HEADERS ====================

@app.after_request
def add_security_headers(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    return response


# ==================== 2. MENAMPILKAN HALAMAN UTAMA ====================

@app.route('/')
def home():
    return send_file('frontend/index.html')

# ==================== 3. MENYAJIKAN ASSET FRONTEND ====================

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('frontend/assets', filename)

# ==================== 4. MENYAJIKAN FILE FRONTEND ====================

@app.route('/frontend/<path:filename>')
def serve_frontend(filename):
    return send_from_directory('frontend', filename)

# ==================== 5. MENYAJIKAN HALAMAN INDEX ====================

@app.route('/frontend/')
def serve_index():
    return send_file('frontend/index.html')

# ==================== 6. MENYAJIKAN HALAMAN KUESIONER ====================

@app.route('/kuesioner.html')
def serve_kuesioner():
    return send_file('frontend/kuesioner.html')

# ==================== 7. MENYAJIKAN HALAMAN RINGKASAN ====================

@app.route('/summary.html')
def serve_summary():
    return send_file('frontend/summary.html')

# ==================== 8. MENYAJIKAN HALAMAN ANALISIS ====================

@app.route('/analysis.html')
def serve_analysis():
    return send_file('frontend/analysis.html')

# ==================== 9. MENYAJIKAN HALAMAN LOGIN ADMIN ====================

@app.route('/admin-login.html')
def serve_admin_login():
    return send_file('frontend/admin-login.html')

# ==================== 10. MENYAJIKAN DASHBOARD ADMIN ====================

@app.route('/admin-dashboard.html')
def serve_admin_dashboard():
    return send_file('frontend/admin-dashboard.html')

# ==================== 11. MENANGANI HALAMAN TIDAK DITEMUKAN ====================

@app.errorhandler(404)
def page_not_found(e):
    return send_file('frontend/404.html'), 404

# ==========================================
# SECTION: Helper Functions
# ==========================================
# ==================== 12. MEMBUKA APLIKASI DI BROWSER ====================

def open_browser():
    time.sleep(1)
    webbrowser.open('http://localhost:5000/')

if __name__ == '__main__':
    try:
        from livereload import Server


        server = Server(app.wsgi_app)
        server.watch('frontend/**/*.html')
        server.watch('frontend/assets/css/**/*.css')
        server.watch('frontend/assets/js/**/*.js')
        server.watch('backend/**/*.py')
        threading.Thread(target=open_browser).start()
        server.serve(host='0.0.0.0', port=5000, debug=True)
    except ImportError:
        print("Tip: install 'livereload' (pip install livereload) biar browser auto-refresh saat file diubah.")
        threading.Thread(target=open_browser).start()
        app.run(host='0.0.0.0', port=5000, debug=True)
