"""
seed_responden.py
=================
Memastikan tabel `data_responden` selalu berisi 400 data responden
penelitian setiap kali aplikasi dijalankan (lihat app.py).

Sumber datanya: backend/data/data_responden.json — snapshot hasil analisis
clustering (X1-X10 setelah MSI + standardisasi item + agregasi, serta label cluster
K-Means k=3). Snapshot ini dihasilkan oleh research/seed_data_responden.py dengan pipeline yang sama persis dengan notebook.

Jadi kalau StunTrack.db terhapus atau tabelnya kosong, data 400 responden
otomatis terisi ulang tanpa perlu Excel / pandas / sklearn saat runtime.
"""

import json
import os

from backend.models import DataResponden, db

JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_responden.json')

JUMLAH_RESPONDEN_DIHARAPKAN = 400

KOLOM_X = [f'x{i}' for i in range(1, 11)]


# ==================== 1. MEMBACA SNAPSHOT JSON ====================

def _baca_snapshot():
    if not os.path.exists(JSON_PATH):
        return None
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


# ==================== 2. MENGISI TABEL DATA RESPONDEN ====================

def ensure_data_responden(app, force=False):
    """Isi tabel data_responden dari snapshot JSON kalau masih kosong
    atau jumlah barisnya tidak sesuai. Dipanggil sekali saat aplikasi start.

    force=True akan menghapus isi tabel dan mengisi ulang dari snapshot.
    """
    with app.app_context():
        jumlah_sekarang = db.session.query(DataResponden).count()

        if not force and jumlah_sekarang == JUMLAH_RESPONDEN_DIHARAPKAN:
            return jumlah_sekarang

        records = _baca_snapshot()
        if not records:
            app.logger.warning(
                "[data_responden] Snapshot %s tidak ditemukan. Jalankan "
                "research/seed_data_responden.py untuk membuatnya.", JSON_PATH
            )
            return jumlah_sekarang

        # Isi ulang dari nol supaya tidak ada baris duplikat / setengah jadi
        db.session.query(DataResponden).delete()
        db.session.bulk_save_objects([
            DataResponden(
                id_responden=int(row['id_responden']),
                cluster=int(row['cluster']),
                **{k: float(row[k]) for k in KOLOM_X}
            )
            for row in records
        ])
        db.session.commit()

        jumlah_baru = db.session.query(DataResponden).count()
        app.logger.info(
            "[data_responden] %d data responden dimuat dari snapshot.", jumlah_baru
        )
        return jumlah_baru
