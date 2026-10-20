"""Endpoint analytics dashboard admin: ringkasan total responden & sebaran
cluster (tabel data_responden).
"""


# ==========================================
# SECTION: Imports
# ==========================================

import json
import re
from pathlib import Path

from flask import Blueprint, jsonify
from sqlalchemy import func

from backend.data.variable_database import VARIABLE_BY_ID
from backend.models import db, DataResponden
from backend.routes.admin.auth import admin_required

admin_dashboard_analytics_bp = Blueprint('admin_dashboard_analytics', __name__, url_prefix='/api/admin')

# Variabel X1-X10 yang dipakai sebagai input clustering (lowercase, sesuai
# nama kolom di tabel data_responden).
VARIABEL_IDS = [f'x{i}' for i in range(1, 11)]

# Label & warna tingkat risiko (Rendah/Sedang/Tinggi) dipakai ulang dari
# referensi yang sama dengan status_risiko individu, supaya penamaan &
# warna cluster konsisten dengan bagian lain aplikasi.
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / 'data'
with open(_DATA_DIR / 'status_risiko.json', encoding='utf-8') as f:
    _STATUS_BY_LEVEL = {s['level']: s for s in json.load(f)['statuses']}
_LEVEL_ORDER = ['rendah', 'sedang', 'tinggi']

# Penjelasan & rekomendasi per variabel (X1-X10), dipakai ulang dari materi
# yang sama dengan halaman analisis individu (backend/routes/survei/prediksi.py)
# supaya narasi rekomendasi konsisten di seluruh aplikasi.
with open(_DATA_DIR / 'faktor_risiko_explanations.json', encoding='utf-8') as f:
    _FAKTOR_RISIKO_EXPLANATIONS = json.load(f)

# Kuesioner asli (variabel -> indikator -> item), dipakai supaya Rekomendasi
# di level indikator & variabel benar-benar disusun dari isi item aslinya
# (bukan kalimat generik yang lepas dari kuesioner).
with open(_DATA_DIR / 'variable_database.json', encoding='utf-8') as f:
    _VARIABLE_DB = json.load(f)

# Daftar pertanyaan item, dikelompokkan per id indikator (mis. "X10.1"),
# untuk menyusun kesimpulan Rekomendasi indikator dari seluruh itemnya.
_ITEMS_BY_INDICATOR = {}
for _item in _VARIABLE_DB['items']:
    _ITEMS_BY_INDICATOR.setdefault(_item['id_indikator'], []).append(_item['pertanyaan'])

# Daftar (id indikator, nama indikator), dikelompokkan per id variabel
# (mis. "X10"), untuk menyusun kesimpulan Rekomendasi variabel dari
# seluruh indikator (dan, secara tidak langsung, seluruh itemnya).
_INDICATORS_BY_VARIABLE = {}
for _ind in _VARIABLE_DB['indicators']:
    _INDICATORS_BY_VARIABLE.setdefault(_ind['id_variabel'], []).append(
        (_ind['id_indikator'], _ind['keterangan'])
    )


def _question_to_clause(question):
    """Mengubah kalimat tanya kuesioner ("Apakah ...?") menjadi klausa
    pernyataan singkat, dipakai sebagai isi Rekomendasi level item supaya
    benar-benar berasal dari pertanyaan item itu sendiri, bukan kalimat
    generik yang lepas dari isinya."""
    text = (question or '').strip()
    text = re.sub(r'^[Aa]pakah\s+', '', text)
    text = text.rstrip('?').strip()
    if text:
        text = text[0].lower() + text[1:]
    return text


def _format_pct(value):
    """Format angka persentase tanpa nol desimal yang tidak perlu
    (mis. 91.24 -> "91.2", 90.0 -> "90"), dipakai di kalimat Implikasi."""
    try:
        text = f'{float(value):.1f}'
    except (TypeError, ValueError):
        return '0'
    return text[:-2] if text.endswith('.0') else text


# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 1. MENGAMBIL RINGKASAN DATA RESPONDEN ====================

@admin_dashboard_analytics_bp.route('/responden-summary', methods=['GET'])
@admin_required
def get_responden_summary():
    """Ringkasan tabel data_responden: 400 data acuan penelitian (skor MSI X1-X10 +
    label cluster K-Means hasil notebook), BUKAN data transaksional dari tabel
    pengisian. Mengembalikan total baris & jumlah anggota tiap cluster."""
    try:
        total_responden = DataResponden.query.count()

        hasil_cluster = db.session.query(
            DataResponden.cluster, func.count(DataResponden.id_responden)
        ).group_by(DataResponden.cluster).all()

        cluster_counts = {str(cluster): jumlah for cluster, jumlah in hasil_cluster}

        return jsonify({
            'total_responden': total_responden,
            'cluster_counts': cluster_counts,
        })
    except Exception as e:
        return jsonify({'error': f'Gagal mengambil ringkasan responden: {str(e)}'}), 500


# ==================== 2. HELPER: PROFIL & PENAMAAN CLUSTER ====================

# Pemetaan FINAL cluster K-Means berdasarkan posisi centroid (rata-rata Z-score
# seluruh variabel) hasil notebook:
# Cluster 1 = Risiko Tinggi  (centroid tertinggi, n = 75)
# Cluster 2 = Risiko Rendah  (centroid terendah,  n = 144)
# Cluster 3 = Risiko Sedang  (n = 181)

# Pemetaan mengikuti hasil notebook terbaru. Nomor cluster K-Means
# bersifat arbitrer, sehingga label risiko ditetapkan berdasarkan
# posisi centroid: tertinggi = tinggi, terendah = rendah, sisanya = sedang.
CLUSTER_RISK_MAP = {
    1: 'tinggi',
    2: 'rendah',
    3: 'sedang',
}

def _build_cluster_profile(rows):
    """Menghitung rata-rata X1-X10 tiap cluster dan memberi label
    risiko berdasarkan hasil clustering K-Means pada notebook penelitian.
    """

    grouped = {}

    for r in rows:
        grouped.setdefault(r['cluster'], []).append(r)

    raw = []

    for cluster_id, members in grouped.items():

        means = {
            var: round(
                sum(m[var] for m in members) / len(members),
                4
            )
            for var in VARIABEL_IDS
        }

        raw.append({
            'cluster': cluster_id,
            'n': len(members),
            'means': means,
            'overall_mean': sum(means.values()) / len(means),
        })

    # Jangan mengurutkan cluster berdasarkan overall_mean.
    # Nomor cluster harus tetap mengikuti hasil K-Means.
    clusters = []

    for item in sorted(raw, key=lambda c: c['cluster']):

        level = CLUSTER_RISK_MAP.get(
            item['cluster'],
            'sedang'
        )

        status = _STATUS_BY_LEVEL.get(level, {})

        clusters.append({
            'cluster': item['cluster'],
            'level': level,
            'label': status.get(
                'value',
                level.capitalize()
            ),
            'accent': status.get('accent'),
            'bg': status.get('bg'),
            'n': item['n'],
            'means': item['means'],
        })

    return clusters


# ==================== 3. PROFIL CLUSTER (HEATMAP & DETAIL) ====================

@admin_dashboard_analytics_bp.route('/cluster-profile', methods=['GET'])
@admin_required
def get_cluster_profile():
    """Profil karakteristik tiap cluster (rata-rata X1-X10 per cluster),
    dipakai untuk heatmap profil cluster & panel detail profil cluster
    (dropdown Risiko Rendah/Sedang/Tinggi) di dashboard admin."""
    try:
        rows = [r.to_dict() for r in DataResponden.query.all()]

        variables = [
            {'id': vid, 'label': VARIABLE_BY_ID[vid.upper()]['keterangan']}
            for vid in VARIABEL_IDS
        ]

        return jsonify({
            'variables': variables,
            'clusters': _build_cluster_profile(rows),
        })
    except Exception as e:
        return jsonify({'error': f'Gagal mengambil profil cluster: {str(e)}'}), 500


# ==================== 4. PROFILING HIERARKIS ====================

# Sasaran (target) rekomendasi per variabel, dipakai pada kartu rekomendasi
# admin dashboard. Konten singkat, disusun berdasarkan konteks tiap variabel
# pada faktor_risiko_explanations.json.
SASARAN_BY_VARIABLE = {
    'X1': 'Ibu dan orang tua balita',
    'X2': 'Keluarga dengan kondisi ekonomi rentan',
    'X3': 'Orang tua / pengasuh balita',
    'X4': 'Fasilitas kesehatan (Posyandu/Puskesmas)',
    'X5': 'Anak dan orang tua',
    'X6': 'Ibu hamil dan menyusui',
    'X7': 'Lingkungan tempat tinggal keluarga',
    'X8': 'Instansi pemerintah daerah terkait',
    'X9': 'Keluarga dan lingkungan sosial',
    'X10': 'Anak pada kelompok risiko',
}

# Tiap cluster risiko condong ke salah satu sisi narasi faktor_risiko_explanations:
# 'berpengaruh' (variabel perlu intervensi/pencegahan) untuk cluster risiko
# tinggi & sedang, atau 'tidak' (kondisi baik, perlu dipertahankan) untuk
# cluster risiko rendah. Hasil segmentasi hanya 3 cluster: tinggi, sedang, rendah.
SEGMENT_LEANING = {
    'tinggi': 'berpengaruh',
    'sedang': 'berpengaruh',
    'rendah': 'tidak',
}

# Template Implikasi untuk level indikator & item: menjelaskan MENGAPA
# indikator/item tersebut menjadi yang tertinggi (atau terbaik) di
# segmennya, dengan menyertakan angka capaiannya sendiri sebagai bukti,
# bukan sekadar menyatakan posisinya.
_INDICATOR_IMPLIKASI_TEMPLATE = {
    'berpengaruh': 'Indikator "{indicator}" mencatat capaian tertinggi pada variabel {variable} di segmen ini '
                   '(capaian {percentage}%), sehingga kondisi pada indikator inilah yang paling memengaruhi '
                   'tingkat risiko variabel {variable} secara keseluruhan.',
    'tidak': 'Indikator "{indicator}" mencatat capaian terbaik pada variabel {variable} di segmen ini '
             '(capaian {percentage}%), sehingga kondisi pada indikator inilah yang paling mendukung capaian '
             'baik variabel {variable} secara keseluruhan.',
}
_ITEM_IMPLIKASI_TEMPLATE = {
    'berpengaruh': 'Poin ini mencatat capaian tertinggi pada indikator {indicator} di segmen ini '
                   '(capaian {percentage}%), sehingga kondisinya menjadi faktor utama yang membentuk '
                   'tingkat risiko indikator tersebut secara keseluruhan.',
    'tidak': 'Poin ini mencatat capaian terbaik pada indikator {indicator} di segmen ini '
             '(capaian {percentage}%), sehingga kondisinya menjadi faktor utama yang mendukung capaian '
             'baik indikator tersebut secara keseluruhan.',
}

# Rekomendasi level item: disusun langsung dari isi pertanyaan item itu
# sendiri (lihat _question_to_clause), bukan kalimat generik.
_ITEM_REKOMENDASI_TEMPLATE = {
    'berpengaruh': 'Poin "{clause}" perlu dijadikan sasaran utama edukasi dan pendampingan langsung kepada '
                   'keluarga agar kondisinya membaik.',
    'tidak': 'Kondisi baik pada poin "{clause}" perlu dipertahankan dan dapat dijadikan contoh praktik baik '
             'bagi keluarga lain.',
}

SEGMENT_OVERRIDE_TEXTS = {
    'tinggi': {
        'X10': {
            'implikasi': 'Status Gizi Anak menunjukkan bahwa aspek pemberian makanan kepada anak menjadi karakteristik '
            'yang paling dominan pada segmen ini. Kondisi tersebut tercermin dari aspek jenis dan jumlah makanan yang diberikan, '
            'yang mencakup kualitas menu, kandungan gizi, asupan vitamin, frekuensi makan, serta kecukupan porsi makanan anak.',
            'rekomendasi': 'Intervensi perlu diarahkan pada pemenuhan kebutuhan makan anak secara menyeluruh dengan memperhatikan '
            'kualitas dan keseimbangan menu, kandungan gizi, asupan vitamin, frekuensi makan, serta kecukupan porsi. Pendampingan '
            'kepada keluarga dapat difokuskan pada penerapan pola pemberian makan yang sesuai dengan kebutuhan gizi anak.',
        },
        'X3': {
            'implikasi': 'Pola Asuh menunjukkan bahwa praktik orang tua dalam mendampingi dan mengarahkan perilaku makan anak '
            'merupakan karakteristik yang dominan pada segmen ini. Kondisi tersebut tercermin dari perhatian orang tua saat anak '
            'makan serta penerapan aturan terhadap kebiasaan makan anak.',
            'rekomendasi': 'Penguatan pola asuh perlu dilakukan melalui pendampingan orang tua saat anak makan, '
            'perhatian terhadap porsi makanan, serta penerapan aturan makan yang konsisten. Pendekatan tersebut perlu tetap mempertimbangkan '
            'kenyamanan anak agar kebiasaan makan yang terbentuk dapat dipertahankan.',
        },
        'X2': {
            'implikasi': 'Tingkat Ekonomi menunjukkan bahwa kondisi ekonomi keluarga menjadi salah satu karakteristik yang dominan pada '
            'segmen ini. Karakteristik tersebut tercermin dari kemampuan keluarga memenuhi kebutuhan makan dan kebutuhan sehari-hari serta '
            'mengelola pengeluaran sesuai dengan pendapatan dan kebutuhan pokok.',
            'rekomendasi': 'Perlu diarahkan pada penguatan kemampuan keluarga dalam mengelola sumber daya ekonomi untuk memenuhi '
            'kebutuhan pangan. Prioritas dapat diberikan pada pengaturan pengeluaran, pemenuhan kebutuhan pokok, serta pemilihan bahan pangan '
            'yang tetap memenuhi kebutuhan gizi anak sesuai kemampuan keluarga.',
        },
        'X10.1': {
            'implikasi': 'Indikator Jenis Makanan menunjukkan bahwa kualitas makanan yang diberikan kepada anak menjadi aspek yang paling '
            'dominan dalam variabel Status Gizi Anak. Hal tersebut tercermin dari perhatian terhadap keseimbangan menu, kandungan gizi makanan, '
            'dan pemberian makanan yang mengandung vitamin.',
            'rekomendasi': 'Pendampingan perlu difokuskan pada penyusunan menu yang seimbang dan memenuhi kebutuhan gizi anak, disertai '
            'pemilihan makanan dengan kandungan zat gizi yang baik serta sumber vitamin yang memadai.',
        },
        'X10.1.2': {
            'implikasi': 'Kandungan gizi dalam menu makanan anak merupakan aspek yang paling dominan dalam indikator Jenis Makanan. '
            'Temuan tersebut menunjukkan bahwa kualitas gizi makanan menjadi bagian penting dalam karakteristik pemberian makanan.',
            'rekomendasi': 'Edukasi kepada keluarga perlu menekankan pemilihan dan penyusunan menu yang memiliki kandungan gizi sesuai '
            'kebutuhan anak. Perhatian terhadap kualitas zat gizi perlu ditempatkan sebagai bagian dari perencanaan makanan sehari-hari.',
        },
    },
    'sedang': {
        'X6': {
            'implikasi': 'Status Gizi Orang Tua menunjukkan bahwa pola konsumsi makanan orang tua menjadi karakteristik yang paling dominan pada segmen ini. '
            'Kondisi tersebut tercermin dari kualitas dan jumlah makanan yang dikonsumsi, termasuk keseimbangan menu, kandungan gizi, konsumsi vitamin, frekuensi makan, '
            'dan kecukupan porsi.',
            'rekomendasi': 'Perlu diarahkan pada penerapan pola makan yang seimbang dan teratur, dengan memperhatikan kualitas kandungan gizi, konsumsi sumber vitamin, '
            'serta kecukupan jumlah makanan. Pendampingan dapat dilakukan agar kebiasaan makan orang tua tetap terjaga dan tidak bergeser ke arah risiko yang lebih tinggi.',
        },
        'X3': {
            'implikasi': 'Pola Asuh menunjukkan bahwa praktik orang tua dalam mengarahkan perilaku makan anak menjadi salah satu karakteristik '
            'yang dominan pada segmen ini. Kondisi tersebut berkaitan dengan keterlibatan orang tua dalam menemani anak makan, memperhatikan porsi, '
            'serta menerapkan aturan terhadap kebiasaan makan anak.',
            'rekomendasi': 'Penguatan pola asuh dapat dilakukan dengan meningkatkan keterlibatan orang tua dalam waktu makan, memperhatikan kecukupan '
            'porsi, dan menerapkan aturan makan secara konsisten. Pengasuhan perlu diarahkan untuk membentuk kebiasaan makan yang teratur '
            'sekaligus responsif terhadap kebutuhan anak.',
        },
        'X8': {
            'implikasi': 'Peran Pemerintah Daerah menunjukkan bahwa keberadaan intervensi pemerintah menjadi karakteristik yang dominan pada segmen ini. '
            'Karakteristik tersebut mencakup kegiatan pembinaan melalui sosialisasi dan edukasi, serta upaya pencegahan melalui program peningkatan gizi '
            'dan penyediaan sarana pendukung kesehatan lingkungan.',
            'rekomendasi': 'Penguatan peran pemerintah daerah perlu dilakukan secara terpadu melalui keberlanjutan edukasi kepada masyarakat dan pelaksanaan '
            'program pencegahan. Pembinaan terkait gizi, pengasuhan, dan kesehatan reproduksi perlu berjalan seiring dengan upaya peningkatan kualitas '
            'sanitasi dan ketersediaan air minum.',
        },
        'X6.1': {
            'implikasi': 'Indikator Jenis Makanan menunjukkan bahwa kualitas makanan yang dikonsumsi orang tua menjadi aspek yang paling '
            'dominan dalam variabel Status Gizi Orang Tua. Hal tersebut tercermin dari keseimbangan menu, kandungan gizi makanan, '
            'dan konsumsi makanan yang mengandung vitamin.',
            'rekomendasi': 'Pendampingan perlu difokuskan pada penyusunan menu harian yang seimbang, pemilihan makanan dengan kandungan gizi yang baik, '
            'serta pemenuhan sumber vitamin secara rutin.',
        },
        'X6.1.3': {
            'implikasi': 'Konsumsi makanan yang mengandung vitamin secara rutin merupakan aspek yang paling dominan dalam indikator Jenis Makanan. '
            'Temuan tersebut menunjukkan bahwa asupan vitamin menjadi bagian penting dalam karakteristik pola makan orang tua pada segmen ini.',
            'rekomendasi': 'Edukasi kepada keluarga perlu menekankan pentingnya konsumsi makanan sumber vitamin secara rutin dalam menu sehari-hari '
            'sebagai bagian dari pola makan yang seimbang.',
        },
    },
    'rendah': {
        'X1': {
            'implikasi': 'Pengetahuan Ibu menunjukkan bahwa pemahaman mengenai stunting dan gizi menjadi karakteristik yang relatif baik pada segmen ini. Kondisi '
            'tersebut dibentuk oleh pemahaman terhadap istilah stunting serta pengetahuan mengenai faktor gizi yang berkaitan dengan tumbuh kembang anak.',
            'rekomendasi': 'Pengetahuan yang telah dimiliki perlu dipertahankan melalui penguatan pemahaman mengenai penyebab dan faktor risiko stunting serta '
            'pentingnya kecukupan gizi sejak masa kehamilan hingga periode pertumbuhan anak. Informasi tersebut dapat diterapkan dalam pengambilan keputusan '
            'terkait pemenuhan kebutuhan anak.',
        },
        'X4': {
            'implikasi': 'Layanan Kesehatan menunjukkan bahwa pengalaman keluarga terhadap kualitas pelayanan kesehatan menjadi karakteristik yang relatif baik pada '
            'segmen ini. Kondisi tersebut tercermin dari aspek fasilitas, keandalan pelayanan, daya tanggap petugas, serta rasa aman dalam memperoleh pelayanan '
            'kesehatan.',
            'rekomendasi': 'Kondisi pelayanan kesehatan yang telah mendukung perlu dipertahankan melalui penyediaan fasilitas yang memadai, pelayanan yang konsisten dan tepat '
            'waktu, respons petugas yang baik, serta penerapan pelayanan yang memberikan rasa aman bagi masyarakat.',
        },
        'X7': {
            'implikasi': 'Lingkungan menunjukkan bahwa praktik sanitasi dan kebersihan rumah tangga menjadi salah satu karakteristik yang relatif baik pada segmen ini. '
            'Kondisi tersebut tercermin dari penggunaan air bersih, kepemilikan dan pemeliharaan jamban, serta penerapan kebiasaan mencuci tangan.',
            'rekomendasi': 'Praktik sanitasi yang telah berjalan perlu dipertahankan secara konsisten, terutama dalam penggunaan air bersih, pemeliharaan jamban, '
            'serta kebiasaan mencuci tangan menggunakan air mengalir dan sabun. Konsistensi pada ketiga aspek tersebut penting untuk menjaga kondisi lingkungan rumah.',
        },
        'X1.2': {
            'implikasi': 'Indikator Pengetahuan Gizi menunjukkan bahwa pemahaman mengenai hubungan antara kecukupan gizi dan tumbuh kembang anak menjadi aspek yang '
            'relatif kuat dalam variabel Pengetahuan Ibu. Kondisi tersebut tercermin dari pemahaman mengenai pentingnya gizi ibu selama kehamilan serta dampak '
            'kekurangan gizi dalam jangka panjang terhadap anak.',
            'rekomendasi': 'Pemahaman mengenai pentingnya kecukupan gizi perlu dipertahankan dan diperkuat melalui penerapan pengetahuan tersebut dalam pemenuhan '
            'gizi sejak masa kehamilan hingga masa pertumbuhan anak. Edukasi dapat diarahkan agar pengetahuan yang dimiliki tetap diterapkan dalam praktik sehari-hari.',
        },
        'X1.2.2': {
            'implikasi': 'Pemahaman mengenai hubungan antara kekurangan gizi jangka panjang dan stunting merupakan aspek yang dominan dalam indikator '
            'Pengetahuan Gizi. Pemahaman tersebut berkaitan dengan kesadaran bahwa proses terjadinya stunting dapat berlangsung dalam jangka panjang.',
            'rekomendasi': 'Pemahaman tersebut perlu dipertahankan dengan terus memperkuat perhatian terhadap pemenuhan gizi sejak masa kehamilan hingga '
            'anak mencapai usia pertumbuhan. Pengetahuan mengenai dampak kekurangan gizi jangka panjang dapat menjadi dasar dalam menjaga pola pemenuhan '
            'gizi ibu dan anak secara berkelanjutan.',
        },
    },
}


def _build_indicator_recommendation(indicator_code, indicator_label, variable_label, leaning):
    """Menyusun Rekomendasi level indikator sebagai kesimpulan dari SELURUH
    item pada indikator tersebut (bukan hanya item dengan capaian
    tertinggi), sesuai isi pertanyaan aslinya di variable_database.json."""
    questions = _ITEMS_BY_INDICATOR.get((indicator_code or '').upper(), [])
    clauses = [c for c in (_question_to_clause(q) for q in questions) if c]
    clause_text = '; '.join(f'"{c}"' for c in clauses) if clauses else f'seluruh item pada indikator {indicator_label}'

    if leaning == 'berpengaruh':
        return (f'Rekomendasi pada indikator {indicator_label} merangkum seluruh poin di dalamnya, yaitu '
                f'{clause_text}. Arahkan pendampingan pada aspek-aspek tersebut secara menyeluruh agar '
                f'kondisi indikator ini membaik dan risiko pada variabel {variable_label} dapat ditekan.')
    return (f'Rekomendasi pada indikator {indicator_label} merangkum seluruh poin di dalamnya, yaitu '
            f'{clause_text}. Pertahankan capaian pada aspek-aspek tersebut secara menyeluruh agar kondisi '
            f'baik indikator ini dan variabel {variable_label} tetap terjaga.')


def _build_variable_recommendation(variable_code, variable_label, leaning):
    """Menyusun Rekomendasi level variabel sebagai KESIMPULAN dari seluruh
    item pada variabel tersebut: dirangkai lewat seluruh indikator di
    bawahnya (yang masing-masing sudah merupakan kesimpulan dari itemnya),
    supaya tetap ringkas walau jumlah itemnya banyak."""
    indicators = _INDICATORS_BY_VARIABLE.get((variable_code or '').upper(), [])
    indicator_labels = [f'{code} ({label})' for code, label in indicators]
    indicator_text = _join_labels_with_dan(indicator_labels) if indicator_labels else 'seluruh indikator di dalamnya'

    if leaning == 'berpengaruh':
        return (f'Kesimpulan rekomendasi pada variabel {variable_label} disusun dari seluruh item pada '
                f'indikator {indicator_text}. Secara umum, prioritaskan pendampingan dan edukasi pada seluruh '
                f'indikator tersebut agar kondisi variabel {variable_label} membaik dan risiko stunting pada '
                f'segmen ini dapat ditekan.')
    return (f'Kesimpulan rekomendasi pada variabel {variable_label} disusun dari seluruh item pada indikator '
            f'{indicator_text}. Secara umum, pertahankan capaian baik pada seluruh indikator tersebut agar '
            f'kondisi variabel {variable_label} tetap terjaga.')

# Kata ganti bilangan tingkat untuk menyusun kalimat pembuka Implikasi di
# level variabel (urutan ke-2, ke-3, dst. dalam satu segmen).
_ORDINAL_WORDS = {2: 'kedua', 3: 'ketiga', 4: 'keempat', 5: 'kelima', 6: 'keenam'}


def _ordinal_word(rank):
    return _ORDINAL_WORDS.get(rank, f'ke-{rank}')


def _sentence_case_label(label):
    """Mengubah label bertipe Title Case (mis. 'Status Gizi Anak') menjadi
    bentuk kalimat baku (mis. 'Status gizi anak') untuk disisipkan di awal
    kalimat narasi Temuan."""
    words = (label or '').split()
    if not words:
        return label or ''
    return ' '.join([words[0]] + [w.lower() for w in words[1:]])


def _join_labels_with_dan(labels):
    if not labels:
        return ''
    if len(labels) == 1:
        return labels[0]
    return ', '.join(labels[:-1]) + ' dan ' + labels[-1]


def _build_variable_position_statement(label, rank, leaning, prev_labels, percentage):
    """Menyusun kalimat pembuka Implikasi di level variabel: pernyataan
    berbasis peringkat (rank) DAN angka capaian (percentage) variabel
    tersebut dalam segmen, menyebut nama variabelnya secara eksplisit,
    sehingga menjelaskan mengapa variabel ini masuk sebagai yang tertinggi
    di segmen tersebut (bukan hanya menyatakan posisinya). Kalimat ini
    digabung dengan teks Implikasi dari faktor_risiko_explanations.json
    (bukan lagi field "Temuan" terpisah)."""
    display = _sentence_case_label(label)
    prev_text = _join_labels_with_dan(prev_labels)
    pct_text = f'{_format_pct(percentage)}%'

    if leaning == 'berpengaruh':
        if rank == 1:
            return (f'{display} menunjukkan karakteristik paling dominan pada segmen ini dibandingkan variabel '
                    f'lainnya, dengan capaian sebesar {pct_text} yang merupakan capaian tertinggi pada segmen ini.')
        return (f'{display} turut menjadi karakteristik yang dominan pada segmen ini dengan capaian sebesar '
                f'{pct_text}, berada di urutan {_ordinal_word(rank)} setelah {prev_text}.')

    if rank == 1:
        return (f'{display} menunjukkan capaian paling baik pada segmen ini dibandingkan variabel lainnya, '
                f'dengan capaian sebesar {pct_text} yang merupakan capaian tertinggi pada segmen ini.')
    return (f'{display} turut menjadi capaian baik pada segmen ini dengan capaian sebesar {pct_text}, '
            f'berada di urutan {_ordinal_word(rank)} setelah {prev_text}.')


def _enrich_variable_with_recommendation(var, leaning, rank, prev_labels, segment_key=None):
    """Menambahkan Implikasi, Rekomendasi & Sasaran ke satu entri variabel
    (beserta top_indicator & top_item di dalamnya jika ada), berdasarkan
    kecondongan narasi ('berpengaruh'/'tidak') segmen risikonya dan
    peringkat (rank) variabel tersebut dalam segmen.

    Untuk kode (variabel/indikator/item) yang sudah punya teks final
    tersendiri di SEGMENT_OVERRIDE_TEXTS (disusun manual per segmen),
    teks tersebut dipakai apa adanya sebagai pengganti hasil template
    otomatis, supaya narasi kartu rekomendasi persis sesuai draft yang
    sudah disetujui. Kode yang belum punya override tetap memakai
    template otomatis seperti sebelumnya (fallback), supaya tetap aman
    kalau data hasil clustering berubah di kemudian hari."""
    label = var.get('label') or ''
    code = (var.get('code') or '').upper()
    override = SEGMENT_OVERRIDE_TEXTS.get(segment_key, {}).get(code)

    if override:
        var['implikasi'] = override['implikasi']
        var['rekomendasi'] = override['rekomendasi']
    else:
        explanation = _FAKTOR_RISIKO_EXPLANATIONS.get(code, {})
        position_statement = _build_variable_position_statement(
            label or code, rank, leaning, prev_labels, var.get('percentage')
        )
        implikasi_text = explanation.get('implikasi', {}).get(leaning, '')
        var['implikasi'] = f'{position_statement} {implikasi_text}'.strip()
        # Rekomendasi variabel = kesimpulan dari seluruh item pada variabel ini
        # (lewat seluruh indikator di bawahnya), bukan lagi teks tetap dari
        # faktor_risiko_explanations.json.
        var['rekomendasi'] = _build_variable_recommendation(code, label or code, leaning)

    var['sasaran'] = SASARAN_BY_VARIABLE.get(code, 'Keluarga dan balita')

    indicator = var.get('top_indicator')
    if indicator:
        indicator_label = indicator.get('label') or indicator.get('code') or ''
        indicator_code = (indicator.get('code') or '').upper()
        variable_label = label or code

        indicator_override = SEGMENT_OVERRIDE_TEXTS.get(segment_key, {}).get(indicator_code)
        if indicator_override:
            indicator['implikasi'] = indicator_override['implikasi']
            indicator['rekomendasi'] = indicator_override['rekomendasi']
        else:
            indicator['implikasi'] = _INDICATOR_IMPLIKASI_TEMPLATE[leaning].format(
                indicator=indicator_label,
                variable=variable_label,
                percentage=_format_pct(indicator.get('percentage')),
            )
            # Rekomendasi indikator = kesimpulan dari seluruh item pada
            # indikator ini (bukan hanya item dengan capaian tertinggi).
            indicator['rekomendasi'] = _build_indicator_recommendation(
                indicator_code, indicator_label, variable_label, leaning
            )

        item = indicator.get('top_item')
        if item:
            item_code = (item.get('code') or '').upper()
            item_override = SEGMENT_OVERRIDE_TEXTS.get(segment_key, {}).get(item_code)
            if item_override:
                item['implikasi'] = item_override['implikasi']
                item['rekomendasi'] = item_override['rekomendasi']
            else:
                clause = _question_to_clause(item.get('question'))
                item['implikasi'] = _ITEM_IMPLIKASI_TEMPLATE[leaning].format(
                    indicator=indicator_label,
                    percentage=_format_pct(item.get('percentage')),
                )
                # Rekomendasi item = langsung dari isi pertanyaan item itu sendiri.
                item['rekomendasi'] = _ITEM_REKOMENDASI_TEMPLATE[leaning].format(clause=clause)

    return var


def _enrich_profiles_with_recommendations(profiles):
    for segment_key, profile in profiles.items():
        leaning = SEGMENT_LEANING.get(segment_key, 'berpengaruh')
        prev_labels = []
        for rank, var in enumerate(profile.get('top_variables', []), start=1):
            _enrich_variable_with_recommendation(var, leaning, rank, list(prev_labels), segment_key)
            prev_labels.append(_sentence_case_label(var.get('label') or var.get('code') or '').lower())
    return profiles


@admin_dashboard_analytics_bp.route('/cluster-insights', methods=['GET'])
@admin_required
def get_cluster_insights():
    """Mengembalikan profiling hierarkis hasil notebook:
    per variabel -> top indikator -> top item untuk tiga cluster risiko
    (tinggi, sedang, rendah),
    dilengkapi teks rekomendasi & sasaran di tiap level (variabel, indikator,
    item) untuk ditampilkan sebagai kartu rekomendasi di dashboard admin.
    """
    try:
        profile_path = _DATA_DIR / 'clustering_insights.json'

        with open(profile_path, encoding='utf-8') as f:
            data = json.load(f)

        data['profiles'] = _enrich_profiles_with_recommendations(data.get('profiles', {}))

        return jsonify(data)
    except Exception as e:
        return jsonify({
            'error': f'Gagal mengambil profiling hierarkis: {str(e)}'
        }), 500