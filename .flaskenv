FLASK_APP=app.py
FLASK_ENV=development
FLASK_RUN_HOST=0.0.0.0
FLASK_RUN_PORT=5000

# Opsional: isi ini kalau app di-deploy di belakang reverse proxy / domain
# publik yang berbeda dari host:port yang dilihat Flask secara langsung.
# Dipakai untuk link di email (konfirmasi hapus data, hasil analisis).
# Kalau kosong, otomatis dipakai domain dari request yang masuk (aman untuk
# localhost maupun saat sudah online).
# APP_BASE_URL=https://stuntrack.example.com
