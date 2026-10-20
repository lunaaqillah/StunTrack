"""
seed_data_responden.py
======================
Mengisi tabel `data_responden` di StunTrack.db dengan 400 data responden
hasil analisis clustering (X1-X10 hasil MSI + label cluster K-Means).

Pipeline-nya PERSIS mengikuti analisis_copy.ipynb:
    1. Baca dataa.xlsx sheet "DATA ASLI" (2 baris header: variabel + item)
    2. MSI (Method of Successive Interval) per item
    3. Standarisasi Z-score per item
    4. Agregasi item terstandarisasi -> variabel X1..X10 (rata-rata)
    5. K-Means (k=3, random_state=42, n_init=10), label +1 -> 1/2/3

Nilai X1-X10 yang disimpan = nilai SETELAH z-score (hasil langkah 4),
bukan nilai MSI mentah.

Script ini menulis DUA output:
    - tabel `data_responden` di StunTrack.db
    - backend/data/data_responden.json (snapshot, dipakai app.py untuk
      auto-seed tiap kali aplikasi start)

Tabel `data_responden` bersifat MANDIRI (tanpa foreign key ke tabel lain),
jadi aman dijalankan tanpa mengganggu data aplikasi yang sudah ada.

Cara pakai:
    python seed_data_responden.py
    python seed_data_responden.py --excel /path/dataa.xlsx --db /path/StunTrack.db
"""

import argparse
import json
import os
import sqlite3

import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# ==========================================
# SECTION: Konfigurasi
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_EXCEL = os.path.join(BASE_DIR, "dataa.xlsx")
DEFAULT_DB = os.path.join(BASE_DIR, "..", "backend", "StunTrack.db")
DEFAULT_JSON = os.path.join(BASE_DIR, "..", "backend", "data", "data_responden.json")

SHEET_NAME = "DATA ASLI"
TABLE_NAME = "data_responden"

RANDOM_STATE = 42
K = 3

VARIABEL = [f"X{i}" for i in range(1, 11)]


# ==========================================
# SECTION: MSI
# ==========================================

def msi_transform(series):
    """Method of Successive Interval untuk satu item skala 1-5."""
    series = pd.to_numeric(series, errors="coerce")

    categories = np.arange(1, 6)

    frequency = (
        series.value_counts()
        .reindex(categories, fill_value=0)
        .astype(float)
    )

    proportion = frequency / frequency.sum()

    cumulative = proportion.cumsum()
    cumulative_lower = cumulative.shift(fill_value=0)
    cumulative_upper = cumulative.copy()

    z_lower = np.where(cumulative_lower == 0, -np.inf, norm.ppf(cumulative_lower))
    z_upper = np.where(cumulative_upper == 1, np.inf, norm.ppf(cumulative_upper))

    density_lower = norm.pdf(z_lower)
    density_upper = norm.pdf(z_upper)

    scale_value = (density_lower - density_upper) / proportion.replace(0, np.nan)

    msi_value = scale_value - scale_value.min() + 1

    return series.map(msi_value.to_dict())


# ==========================================
# SECTION: Pipeline analisis
# ==========================================

def hitung_hasil_clustering(excel_path):
    raw = pd.read_excel(excel_path, sheet_name=SHEET_NAME, header=None)

    variabel_header = raw.iloc[0]
    item_header = raw.iloc[1]

    column_names = [
        f"{var}_{item}" for var, item in zip(variabel_header, item_header)
    ]

    df = raw.iloc[2:].copy()
    df.columns = column_names
    df = df.reset_index(drop=True)
    df = df.apply(pd.to_numeric, errors="coerce")

    variable_groups = {
        var: [col for col in df.columns if col.startswith(f"{var}_")]
        for var in VARIABEL
    }

    # --- MSI per item ---
    df_msi = pd.DataFrame(index=df.index)
    for var in VARIABEL:
        for item in variable_groups[var]:
            df_msi[item] = msi_transform(df[item])

    # --- Standardisasi Z-score PER ITEM ---
    # PERSIS mengikuti notebook penelitian.
    df_msi_z = pd.DataFrame(
        StandardScaler().fit_transform(df_msi),
        columns=df_msi.columns,
        index=df_msi.index,
    )

    # --- Agregasi ITEM TERSTANDARISASI -> variabel ---
    X_z = pd.DataFrame(index=df.index)
    for var in VARIABEL:
        X_z[var] = df_msi_z[variable_groups[var]].mean(axis=1)

    # --- K-Means ---
    kmeans = KMeans(n_clusters=K, random_state=RANDOM_STATE, n_init=10)
    cluster = kmeans.fit_predict(X_z) + 1

    hasil = X_z.copy()
    hasil.insert(0, "id_responden", range(1, len(hasil) + 1))
    hasil["cluster"] = cluster

    hasil.columns = ["id_responden"] + [v.lower() for v in VARIABEL] + ["cluster"]

    return hasil


# ==========================================
# SECTION: Tulis ke database
# ==========================================

DDL = f"""
CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
    id_responden INTEGER NOT NULL,
    x1  FLOAT NOT NULL,
    x2  FLOAT NOT NULL,
    x3  FLOAT NOT NULL,
    x4  FLOAT NOT NULL,
    x5  FLOAT NOT NULL,
    x6  FLOAT NOT NULL,
    x7  FLOAT NOT NULL,
    x8  FLOAT NOT NULL,
    x9  FLOAT NOT NULL,
    x10 FLOAT NOT NULL,
    cluster INTEGER NOT NULL,
    PRIMARY KEY (id_responden)
)
"""


def simpan_ke_db(hasil, db_path):
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(DDL)
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{TABLE_NAME}_cluster "
            f"ON {TABLE_NAME} (cluster)"
        )

        # Isi ulang dari nol supaya tidak dobel kalau script dijalankan lagi
        cur.execute(f"DELETE FROM {TABLE_NAME}")

        kolom = ["id_responden"] + [v.lower() for v in VARIABEL] + ["cluster"]
        cur.executemany(
            f"INSERT INTO {TABLE_NAME} ({', '.join(kolom)}) "
            f"VALUES ({', '.join(['?'] * len(kolom))})",
            [
                tuple(
                    int(row[k]) if k in ("id_responden", "cluster") else float(row[k])
                    for k in kolom
                )
                for _, row in hasil.iterrows()
            ],
        )
        conn.commit()

        jumlah = cur.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
        distribusi = cur.execute(
            f"SELECT cluster, COUNT(*) FROM {TABLE_NAME} GROUP BY cluster ORDER BY cluster"
        ).fetchall()
    finally:
        conn.close()

    return jumlah, distribusi


# ==========================================
# SECTION: Main
# ==========================================

def simpan_snapshot_json(hasil, json_path):
    """Simpan hasil ke JSON supaya aplikasi Flask bisa auto-seed ulang
    tanpa perlu Excel / pandas / sklearn saat runtime."""
    kolom = ["id_responden"] + [v.lower() for v in VARIABEL] + ["cluster"]

    records = [
        {
            k: (int(row[k]) if k in ("id_responden", "cluster") else round(float(row[k]), 10))
            for k in kolom
        }
        for _, row in hasil.iterrows()
    ]

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=1)

    return len(records)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--excel", default=DEFAULT_EXCEL)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--json", default=DEFAULT_JSON)
    args = parser.parse_args()

    hasil = hitung_hasil_clustering(args.excel)
    print(f"Jumlah responden diproses : {len(hasil)}")

    n_json = simpan_snapshot_json(hasil, args.json)
    print(f"Snapshot JSON ditulis     : {n_json} baris -> {os.path.normpath(args.json)}")

    jumlah, distribusi = simpan_ke_db(hasil, args.db)

    print(f"Baris tersimpan di '{TABLE_NAME}' : {jumlah}")
    print("\nDistribusi cluster:")
    for cluster, n in distribusi:
        print(f"  Cluster {cluster} : {n} responden")


if __name__ == "__main__":
    main()
