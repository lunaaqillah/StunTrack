// ==========================================
// SECTION: Initialization
// ==========================================
(function () {
  const params = new URLSearchParams(window.location.search);
  const deleteSuccess = params.get('delete_success');
  const email = params.get('email');
  if (deleteSuccess === '1') {
    const emailText = document.getElementById('deletedEmailText');
    if (emailText) emailText.textContent = email;
    const modalEl = document.getElementById('deleteSuccessModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      const url = new URL(window.location.href);
      url.searchParams.delete('delete_success');
      url.searchParams.delete('email');
      window.history.replaceState({}, document.title, url.pathname);
    }
  }
})();

(function () {
  const params = new URLSearchParams(window.location.search);
  const deleteError = params.get('delete_error');
  if (deleteError === 'expired' || deleteError === 'invalid') {
    const messages = {
      expired: 'Tautan konfirmasi penghapusan data ini sudah kedaluwarsa. Untuk menjaga keamanan akun Anda, tautan hanya berlaku selama 2 jam sejak email konfirmasi dikirim. Silakan ajukan permintaan penghapusan data kembali untuk mendapatkan tautan konfirmasi yang baru.',
      invalid: 'Tautan konfirmasi penghapusan data ini tidak valid atau sudah pernah digunakan sebelumnya. Jika Anda masih ingin menghapus data, silakan ajukan permintaan penghapusan data kembali untuk mendapatkan tautan konfirmasi yang baru.'
    };
    const textEl = document.getElementById('deleteErrorText');
    if (textEl) textEl.textContent = messages[deleteError];
    const modalEl = document.getElementById('deleteErrorModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      const url = new URL(window.location.href);
      url.searchParams.delete('delete_error');
      window.history.replaceState({}, document.title, url.pathname);
    }
  }
})();

(function () {
  const params = new URLSearchParams(window.location.search);
  const notice = params.get('isi_lagi_notice');
  if (notice === '1') {
    const namaBalita = params.get('nama_balita') || 'Balita Anda';
    const nextFillDate = params.get('next_fill_date') || '-';
    const nextFillAge = params.get('next_fill_age') || '-';
    const textEl = document.getElementById('isiLagiNoticeText');
    if (textEl) {
      textEl.textContent = `Data pengisian untuk ${namaBalita} tidak diganti. Silakan isi kembali saat usia balita ${nextFillAge}, yaitu pada tanggal ${nextFillDate}.`;
    }
    const modalEl = document.getElementById('isiLagiNoticeModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      const url = new URL(window.location.href);
      url.searchParams.delete('isi_lagi_notice');
      url.searchParams.delete('nama_balita');
      url.searchParams.delete('next_fill_date');
      url.searchParams.delete('next_fill_age');
      window.history.replaceState({}, document.title, url.pathname);
    }
  }
})();

// ==========================================
// SECTION: Page Animation
// ==========================================
// Menganimasikan angka statistik
function animateCounter(el, endValue, duration = 1000) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  // Menjalankan satu langkah animasi angka
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = Math.floor(start + (endValue - start) * progress);
    el.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = endValue;
    }
  }
  requestAnimationFrame(step);
}

document.addEventListener('DOMContentLoaded', function () {
  fetch('/pengisian/stats')
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal mengambil data statistik, status: ' + response.status);
      }
      return response.json();
    })
    .then(stats => {
      animateCounter(document.getElementById('kontributor-count'), stats.total);
      animateCounter(document.getElementById('normal-count'), stats.normal);
      animateCounter(document.getElementById('pendek-count'), stats.pendek);
      animateCounter(document.getElementById('severe-count'), stats.sangat_pendek);
    })
    .catch(error => console.error('Gagal mengambil statistik:', error));
});

// ==========================================
// SECTION: HTML Utilities
// ==========================================
// Mengamankan teks untuk HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
// Memformat tanggal berita
function formatNewsDate(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Memuat berita stunting terbaru
const NEWS_FALLBACK_URL = 'https://news.google.com/search?q=stunting%20indonesia&hl=id&gl=ID&ceid=ID:id';

function renderNewsError(container) {
  container.innerHTML = `
    <div class="col-12 text-center">
      <p class="mb-3">Berita terbaru belum bisa dimuat saat ini.</p>
      <button type="button" id="newsRetryBtn" class="btn btn-outline-primary me-2">
        <i class="bi bi-arrow-clockwise"></i> Coba lagi
      </button>
      <a href="${NEWS_FALLBACK_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
        Buka berita stunting <i class="bi bi-box-arrow-up-right"></i>
      </a>
    </div>`;
  const retry = document.getElementById('newsRetryBtn');
  if (retry) retry.addEventListener('click', loadNews);
}

function loadNews() {
  const container = document.getElementById('newsCardsContainer');
  if (!container) return;
  container.innerHTML = '<div class="col-12 text-center" id="newsLoadingNote">Memuat berita terbaru...</div>';
  fetch('/api/news/stunting')
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal mengambil berita, status: ' + response.status);
      }
      return response.json();
    })
    .then(items => {
      if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = '<p class="col-12 text-center">Belum ada berita yang tersedia.</p>';
        return;
      }
      container.innerHTML = items.slice(0, 4).map(item => {
        const tanggal = formatNewsDate(item.pub_date);
        const sub = [item.source, tanggal].filter(Boolean).join(' • ');
        const link = /^https?:\/\//i.test(item.link || '') ? item.link : '#';
        return `
        <div class="col-lg-3 col-md-6">
          <div class="service-card news-card">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              ${sub ? `<p class="news-card-meta">${escapeHtml(sub)}</p>` : ''}
              <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="read-more">
                Read More <i class="bi bi-arrow-right"></i>
              </a>
            </div>
          </div>
        </div>
      `;
      }).join('');
    })
    .catch(error => {
      console.error('Gagal mengambil berita:', error);
      renderNewsError(container);
    });
}

document.addEventListener('DOMContentLoaded', loadNews);

const contactForm = document.querySelector('.php-email-form');
if (contactForm) {
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message')
    };
    const sentMessage = this.querySelector('.sent-message');
    const submitBtn = this.querySelector('button[type="submit"]');
    sentMessage.style.display = 'none';
    submitBtn.disabled = true;
    fetch('/contact', {
      method: 'POST',
      body: new URLSearchParams(data)
    })
      .then(response => response.json())
      .then(result => {
        if (result.message) {
          sentMessage.style.display = 'block';
          this.reset();
        } else {
          alert(result.error || 'Terjadi kesalahan.');
        }
        submitBtn.disabled = false;
      })
      .catch(error => {
        alert('Terjadi kesalahan jaringan. Silakan coba lagi.');
        console.error('Error:', error);
        submitBtn.disabled = false;
      });
  });
}
