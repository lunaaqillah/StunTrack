from datetime import datetime
import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class IdentitasOrangTua(db.Model):
    __tablename__ = 'identitas_orang_tua'
    id_orang_tua = db.Column(db.String(50), primary_key=True, default=lambda: f"ORTU-{uuid.uuid4().hex}")
    nama_orang_tua = db.Column(db.String(100), nullable=True)
    tanggal_lahir = db.Column(db.Date, nullable=False)
    pekerjaan = db.Column(db.String(100), nullable=False)
    alamat = db.Column(db.String(200), nullable=False)
    pendidikan = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True, index=True)
    riwayat_gondok = db.Column(db.Enum('Ya', 'Tidak'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    balitas = db.relationship('IdentitasBalita', backref='orang_tua', lazy=True, cascade='all, delete-orphan')


class IdentitasBalita(db.Model):
    __tablename__ = 'identitas_balita'
    id_balita = db.Column(db.String(50), primary_key=True, default=lambda: f"BLT-{uuid.uuid4().hex}")
    nama_balita = db.Column(db.String(100), nullable=False)
    tanggal_lahir = db.Column(db.Date, nullable=False)
    jenis_kelamin = db.Column(db.Enum('Laki-laki', 'Perempuan'), nullable=False)
    id_orang_tua = db.Column(db.String(50), db.ForeignKey('identitas_orang_tua.id_orang_tua'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    pengisians = db.relationship('Pengisian', backref='balita', lazy=True, cascade='all, delete-orphan')


class Pengisian(db.Model):
    __tablename__ = 'pengisian'
    id_pengisian = db.Column(db.String(50), primary_key=True, default=lambda: f"ANS-{uuid.uuid4().hex}")
    id_balita = db.Column(db.String(50), db.ForeignKey('identitas_balita.id_balita'), nullable=False, index=True)
    tanggal_pengisian = db.Column(db.Date, nullable=False, index=True)
    usia_bulan = db.Column(db.Integer, nullable=False)
    tb_balita = db.Column(db.Float, nullable=False)
    bb_balita = db.Column(db.Float, nullable=False)
    nilai_tbu = db.Column(db.Float, nullable=False)
    status_pertumbuhan = db.Column(db.Enum('Normal', 'Pendek', 'Sangat Pendek'), nullable=False, index=True)
    nilai_prediksi = db.Column(db.Float, nullable=True)
    status_risiko = db.Column(db.Enum('Rendah', 'Sedang', 'Tinggi'), nullable=True)
    perbandingan = db.Column(db.Boolean, nullable=True)
    status_perbandingan = db.Column(db.Enum('aman', 'pantau', 'waspada', 'telusuri', 'perhatian', 'darurat'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('id_balita', 'usia_bulan', name='uq_pengisian_balita_usia'),)

    faktor_risikos = db.relationship('FaktorRisiko', backref='pengisian_ref', lazy=True, cascade='all, delete-orphan')
    detail_faktor_risikos = db.relationship('DetailFaktorRisiko', backref='pengisian_ref', lazy=True, cascade='all, delete-orphan')

    def skor_dict(self):
        return {f.id_variabel: f.skor_komposit for f in self.faktor_risikos}


class FaktorRisiko(db.Model):
    __tablename__ = 'faktor_risiko'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_pengisian = db.Column(db.String(50), db.ForeignKey('pengisian.id_pengisian'), nullable=False, index=True)
    id_variabel = db.Column(db.String(10), nullable=False, index=True)
    skor_komposit = db.Column(db.Float, nullable=False)
    skor_zscore = db.Column(db.Float, nullable=True)
    kontribusi = db.Column(db.Float, nullable=True)
    __table_args__ = (db.UniqueConstraint('id_pengisian', 'id_variabel', name='uq_faktor_risiko_pengisian_variabel'),)


class DetailFaktorRisiko(db.Model):
    __tablename__ = 'detail_faktor_risiko'
    id_detail = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_pengisian = db.Column(db.String(50), db.ForeignKey('pengisian.id_pengisian'), nullable=False, index=True)
    id_indikator = db.Column(db.String(20), nullable=False, index=True)
    id_item = db.Column(db.String(20), nullable=False, index=True)
    id_skala = db.Column(db.SmallInteger, nullable=False)
    skor_srs = db.Column(db.Float, nullable=False)
    __table_args__ = (db.UniqueConstraint('id_pengisian', 'id_item', name='uq_detail_faktor_risiko_pengisian_item'),)


class Admin(db.Model):
    __tablename__ = 'admin'
    id_admin = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email_admin = db.Column(db.String(100), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    active_at = db.Column(db.DateTime, nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)


class AdminLogin(db.Model):
    __tablename__ = 'admin_login'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_login = db.Column(db.String(64), nullable=False, unique=True, index=True)
    id_admin = db.Column(db.Integer, db.ForeignKey('admin.id_admin'), nullable=False, index=True)
    code_hash = db.Column(db.String(128), nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)


class KonfirmasiToken(db.Model):
    __tablename__ = 'konfirmasi_token'
    id_konfirmasi = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(100), nullable=False, index=True)
    token_hash = db.Column(db.String(128), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

class DataResponden(db.Model):
    """Data 400 responden penelitian (skor MSI X1-X10 + label cluster K-Means).

    Tabel mandiri: TIDAK punya relasi/foreign key ke tabel lain. Dipakai
    sebagai data acuan hasil clustering, diisi lewat
    research/seed_data_responden.py
    """
    __tablename__ = 'data_responden'
    id_responden = db.Column(db.Integer, primary_key=True, autoincrement=False)
    x1 = db.Column(db.Float, nullable=False)
    x2 = db.Column(db.Float, nullable=False)
    x3 = db.Column(db.Float, nullable=False)
    x4 = db.Column(db.Float, nullable=False)
    x5 = db.Column(db.Float, nullable=False)
    x6 = db.Column(db.Float, nullable=False)
    x7 = db.Column(db.Float, nullable=False)
    x8 = db.Column(db.Float, nullable=False)
    x9 = db.Column(db.Float, nullable=False)
    x10 = db.Column(db.Float, nullable=False)
    cluster = db.Column(db.Integer, nullable=False, index=True)

    def to_dict(self):
        return {
            'id_responden': self.id_responden,
            **{f'x{i}': getattr(self, f'x{i}') for i in range(1, 11)},
            'cluster': self.cluster,
        }
