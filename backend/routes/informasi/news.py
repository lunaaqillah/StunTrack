"""
Ambil berita terbaru terkait stunting untuk ditampilkan di section #news
pada index.html.

Menggunakan Google News RSS karena tidak membutuhkan API key dan lebih
stabil dibanding scraping HTML situs berita satu per satu.

Data yang diambil:

- Judul berita
- Link berita
- Sumber berita
- Tanggal terbit
- Deskripsi singkat

Hasil disimpan sementara di cache agar tidak setiap request melakukan
fetch ulang ke Google News.
"""


# ==========================================
# SECTION: Imports
# ==========================================

from flask import Blueprint, jsonify, current_app
import urllib.request
import urllib.error
import ssl
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
import re
import html
import time

news_bp = Blueprint("news", __name__, url_prefix="/api/news")

_CACHE = {"data": None, "timestamp": 0}
_CACHE_TTL_SECONDS = 30 * 60

# Sumber RSS dicoba berurutan; kalau yang pertama gagal, lanjut ke berikutnya.
_RSS_URLS = [
    "https://news.google.com/rss/search?q=stunting%20indonesia"
    "&hl=id-ID&gl=ID&ceid=ID:id",
    "https://www.bing.com/news/search?q=stunting+indonesia&format=rss"
    "&setlang=id-ID&cc=ID",
]

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/124 Safari/537.36"
    )
}


# ==========================================
# SECTION: Helper Functions
# ==========================================
# ==================== 1. MEMBERSIHKAN HTML BERITA ====================

def _clean_html(raw_html):

    if not raw_html:
        return ""
    text = re.sub(r"<[^>]+>", "", raw_html)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


# ==================== 2. MEMBERSIHKAN JUDUL BERITA ====================

def _clean_title(title, source):

    if not source:
        return title
    for dash in (" - ", " – ", " — "):
        suffix = f"{dash}{source}"
        if title.endswith(suffix):
            return title[: -len(suffix)].strip()
    return title


# ==================== 3. MEMPROSES TANGGAL BERITA ====================

_MIN_DATE = datetime.min.replace(tzinfo=timezone.utc)


def _parse_date(date):
    # Selalu kembalikan datetime ber-timezone agar aman dibandingkan saat sort.
    # (Sebelumnya mengembalikan 0 saat gagal parse -> TypeError di sort().)
    try:
        dt = parsedate_to_datetime(date)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return _MIN_DATE


# ==================== 4. MEMBUAT KONTEKS SSL ====================

def _ssl_context():
    # Python di macOS (installer python.org) sering tidak punya sertifikat root
    # -> CERTIFICATE_VERIFY_FAILED. Pakai bundle certifi kalau tersedia.
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


# ==================== 5. MENGAMBIL BERITA TERKAIT STUNTING ====================

def _fetch_from_url(url, limit):
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=8, context=_ssl_context()) as response:
        xml_data = response.read()
    root = ET.fromstring(xml_data)
    items = []
    for item in root.findall("./channel/item"):
        raw_title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source_el = item.find("source")
        if source_el is None:
            # Bing memakai namespace News:Source
            source_el = next(
                (el for el in item if el.tag.endswith("}Source")), None
            )
        source = (
            source_el.text.strip() if source_el is not None and source_el.text else ""
        )
        description = _clean_html(item.findtext("description"))
        if not raw_title or not link.startswith(("http://", "https://")):
            continue
        items.append(
            {
                "title": _clean_title(raw_title, source),
                "link": link,
                "source": source,
                "pub_date": pub_date,
                "description": description,
            }
        )

    items.sort(key=lambda x: _parse_date(x["pub_date"]), reverse=True)
    return items[:limit]


def _fetch_stunting_news(limit=8):
    last_error = None
    for url in _RSS_URLS:
        try:
            items = _fetch_from_url(url, limit)
            if items:
                return items
            last_error = RuntimeError(f"Feed kosong: {url}")
        except Exception as e:  # jaringan, SSL, timeout, XML rusak, dll.
            current_app.logger.warning("Fetch berita gagal (%s): %r", url, e)
            last_error = e
    raise last_error or RuntimeError("Tidak ada sumber berita")


# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 5. MENGIRIM DATA BERITA STUNTING ====================

@news_bp.route("/stunting", methods=["GET"])
def get_stunting_news():
    now = time.time()

    if _CACHE["data"] is not None and (now - _CACHE["timestamp"]) < _CACHE_TTL_SECONDS:
        return jsonify(_CACHE["data"])
    try:
        items = _fetch_stunting_news()
        _CACHE["data"] = items
        _CACHE["timestamp"] = now
        return jsonify(items)
    except Exception as e:
        # Kalau fetch gagal, pakai cache lama (walau sudah kedaluwarsa).
        if _CACHE["data"] is not None:
            return jsonify(_CACHE["data"])
        return jsonify({"error": f"Gagal mengambil berita: {str(e)}"}), 502
