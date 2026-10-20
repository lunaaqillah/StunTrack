"""Helper bersama untuk pengiriman email (dipakai oleh semua route yang
mengirim email: admin/auth.py, identitas/hapus_data.py, informasi/contact.py,
survei/pengisian.py).

Sebelumnya setiap route menuliskan ulang kode yang sama untuk melampirkan
logo StunTrack (inline image via cid) dan menulis template HTML email
langsung sebagai f-string panjang di dalam fungsi Python. Sekarang template
disimpan sebagai file HTML terpisah di backend/emails/, dibaca dan
disubstitusi dengan `string.Template` (memakai sintaks $variable) supaya CSS
di dalam email -- yang memakai kurung kurawal seperti f-string sebelumnya --
tidak perlu di-escape lagi.
"""


# ==========================================
# SECTION: Imports
# ==========================================

import os
from string import Template

_LOGO_PATH = 'frontend/assets/img/LOGO.png'
_TEMPLATES_DIR = os.path.dirname(__file__)


# ==========================================
# SECTION: Helper Functions
# ==========================================
# ==================== 1. MELAMPIRKAN LOGO PADA EMAIL ====================

def attach_logo(msg):
    """Lampirkan LOGO.png StunTrack sebagai inline image (cid:logo_cid) ke sebuah
    flask_mail Message, dipakai di header/logo <img src="cid:logo_cid"> pada semua
    template email."""
    with open(_LOGO_PATH, 'rb') as logo_file:
        msg.attach('LOGO.png', 'image/png', logo_file.read(), 'inline', {'Content-ID': '<logo_cid>'})


# ==================== 2. MERENDER TEMPLATE EMAIL ====================

def render_email_template(template_name, **context):
    """Baca file HTML di backend/templates/emails/<template_name> dan substitusi
    placeholder $variable dengan nilai dari context."""
    path = os.path.join(_TEMPLATES_DIR, template_name)
    with open(path, encoding='utf-8') as f:
        template = Template(f.read())
    return template.substitute(**context)
