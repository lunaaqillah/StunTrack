// ==========================================
// SECTION: Initialization
// ==========================================
let growthReferenceData = null;

document.addEventListener('DOMContentLoaded', function () {
  const growthReferenceReady = fetchGrowthReference();
  const urlParams = new URLSearchParams(window.location.search);
  const nama = urlParams.get('nama');
  const tanggal = urlParams.get('tanggal');
  const tanggalOrangTua = urlParams.get('tanggal-orang-tua');
  if (!nama || !tanggal || !tanggalOrangTua) {
    const summarySection = document.querySelector('.summary-card .card-body');
    summarySection.innerHTML = '<div class="alert alert-warning" role="alert">Parameter pencarian tidak lengkap. Silakan kembali ke halaman utama dan isi formulir dengan benar.</div>';
    return;
  }
  fetch(`/identitas_balita/search?nama=${encodeURIComponent(nama)}&tanggal_balita=${encodeURIComponent(tanggal)}&tanggal_orang_tua=${encodeURIComponent(tanggalOrangTua)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || !data.balita || !data.orang_tua) {
        showNotFoundState();
        return;
      }
      showDataSections();
      updateHeroProfile(data.balita);
      updateOrangTuaProfile(data.orang_tua);
      fetch(`/pengisian/balita/${data.balita.id_balita}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(riwayatData => {
          populateRiwayat(riwayatData);
          updateHeroFromRiwayat(riwayatData, data.balita.jenis_kelamin);
          const genderKey = (data.balita.jenis_kelamin || '').toLowerCase().includes('laki') ? 'Laki-laki' : 'Perempuan';
          growthReferenceReady.then(() => {
            renderGrowthChartSummary(genderKey, data.balita.tanggal_lahir, riwayatData);
          });
        })
        .catch(error => {
          console.error('Error fetching riwayat:', error);
          document.getElementById('riwayat-content').innerHTML = '<div class="alert alert-warning" role="alert">Riwayat pengisian tidak dapat dimuat.</div>';
        });
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      showNotFoundState();
    });
});

// ==========================================
// SECTION: Page State
// ==========================================
// Menyesuaikan tinggi state data tidak ditemukan
function adjustNotFoundHeight() {
  const notFoundEl = document.getElementById('not-found-state');
  if (!notFoundEl || notFoundEl.style.display === 'none' || getComputedStyle(notFoundEl).display === 'none') return;
  const headerEl = document.getElementById('header');
  const footerEl = document.getElementById('footer');
  const headerH = headerEl ? headerEl.offsetHeight : 0;
  const footerH = footerEl ? footerEl.offsetHeight : 0;
  const available = window.innerHeight - headerH - footerH;
  notFoundEl.style.minHeight = Math.max(available, 300) + 'px';
}
window.addEventListener('resize', adjustNotFoundHeight);
// Menampilkan state data tidak ditemukan
function showNotFoundState() {
  document.getElementById('summary').style.display = 'none';
  document.getElementById('grafik-pertumbuhan').style.display = 'none';
  document.getElementById('riwayat').style.display = 'none';
  const pageTitleEl = document.querySelector('.page-title');
  if (pageTitleEl) pageTitleEl.style.display = 'none';
  const notFoundEl = document.getElementById('not-found-state');
  if (notFoundEl) notFoundEl.style.display = 'flex';
  requestAnimationFrame(adjustNotFoundHeight);
}
// Menampilkan section data
function showDataSections() {
  document.getElementById('summary').style.display = '';
  document.getElementById('grafik-pertumbuhan').style.display = '';
  document.getElementById('riwayat').style.display = '';
}

// ==========================================
// SECTION: History Rendering
// ==========================================
// Merender badge riwayat gondok
let riwayatGondokConfigPromise = null;
function getRiwayatGondokConfig() {
  if (!riwayatGondokConfigPromise) {
    riwayatGondokConfigPromise = fetch('/identitas_orang_tua/reference/riwayat_gondok').then(res => res.json());
  }
  return riwayatGondokConfigPromise;
}

function renderRiwayatGondokPill(value) {
  const el = document.getElementById('riwayat-gondok-orang-tua');
  if (!el) return;
  getRiwayatGondokConfig().then(config => {
    const v = (value || '').toString().trim().toLowerCase();
    const normalized = config.aliases[v] || value;
    const info = config.values[normalized] || config.values.Tidak;
    const hasGondok = normalized === 'Ya';
    el.className = 'rg-pill ' + (hasGondok ? 'rg-yes' : 'rg-no');
    el.querySelector('span').textContent = info.label;
  });
}
// Menentukan class badge status
function getStatusPillClass(status) {
  if (!status) return 'status-unknown';
  const s = status.toString().trim().toLowerCase();
  if (s === 'sangat pendek') return 'status-sangat-pendek';
  if (s === 'pendek') return 'status-pendek';
  if (s === 'normal') return 'status-normal';
  return 'status-unknown';
}
// Menentukan warna aksen status
function getStatusAccentColor(status) {
  const cls = getStatusPillClass(status);
  if (cls === 'status-normal') return '#1FA454';
  if (cls === 'status-pendek') return '#F08C1C';
  if (cls === 'status-sangat-pendek') return '#D62839';
  return '#8C97A3';
}

// ==========================================
// SECTION: Profile Rendering
// ==========================================
// Memperbarui profil balita
function updateHeroProfile(balita) {
  const nama = balita.nama_balita || 'N/A';
  document.getElementById('hero-nama-balita').textContent = nama;
  const genderBadge = document.getElementById('hero-gender-badge');
  const gender = (balita.jenis_kelamin || '').toString();
  const isLaki = gender.toLowerCase().includes('laki');
  genderBadge.querySelector('i').className = 'bi ' + (isLaki ? 'bi-gender-male' : 'bi-gender-female');
  genderBadge.querySelector('span').textContent = gender || 'N/A';
  const avatarEl = document.getElementById('hero-avatar');
  if (avatarEl && gender) {
    avatarEl.querySelector('i').className = 'bi ' + (isLaki ? 'bi-emoji-smile' : 'bi-emoji-smile-fill');
  }
  const birthBadge = document.getElementById('hero-birth-badge');
  birthBadge.querySelector('span').textContent = formatTanggalIndo(balita.tanggal_lahir);
  document.getElementById('hero-stat-tb').textContent = balita.tinggi_badan ? `${balita.tinggi_badan} cm` : '-';
  document.getElementById('hero-stat-bb').textContent = balita.berat_badan ? `${balita.berat_badan} kg` : '-';
}
// Memperbarui profil orang tua
function updateOrangTuaProfile(orangTua) {
  document.getElementById('nama-orang-tua').textContent = (orangTua.nama_orang_tua || 'ANONIM');
  document.getElementById('tanggal-lahir-orang-tua').textContent = formatTanggalIndo(orangTua.tanggal_lahir);
  document.getElementById('email-orang-tua').textContent = (orangTua.email || 'N/A');
  document.getElementById('pekerjaan-orang-tua').textContent = (orangTua.pekerjaan || 'N/A');
  document.getElementById('pendidikan-orang-tua').textContent = (orangTua.pendidikan || 'N/A');
  renderRiwayatGondokPill(orangTua.riwayat_gondok);
  document.getElementById('alamat-orang-tua').textContent = (orangTua.alamat || 'N/A');
}
// Memperbarui profil berdasarkan riwayat
function updateHeroFromRiwayat(riwayatData, gender) {
  document.getElementById('hero-stat-jumlah').textContent = riwayatData.length;
  const statusBadge = document.getElementById('hero-status-badge');
  const ageBadge = document.getElementById('hero-age-badge');
  if (riwayatData.length === 0) {
    statusBadge.style.display = 'none';
    ageBadge.style.display = 'none';
    return;
  }
  const terakhir = riwayatData[0];
  const statusTerakhir = terakhir.status_pertumbuhan || 'N/A';
  const accent = getStatusAccentColor(statusTerakhir);
  if (terakhir.umur) {
    ageBadge.querySelector('span').textContent = terakhir.umur;
    ageBadge.style.display = 'inline-flex';
  }
  statusBadge.style.background = accent;
  statusBadge.querySelector('span').textContent = `Status Terakhir: ${statusTerakhir}`;
  statusBadge.style.display = 'inline-flex';
}

// ==========================================
// SECTION: Growth Chart
// ==========================================
// Merender grafik pertumbuhan ringkasan
function renderGrowthChartSummary(genderKey, birthDate, historyList) {
  const canvas = document.getElementById('growth-chart-summary');
  if (!canvas || typeof Chart === 'undefined') return;
  const historyPoints = (historyList || [])
    .map(item => {
      const age = ageInMonthsFromDates(birthDate, item.tanggal_pengisian);
      const value = parseFloat(item.tb_balita);
      if (age === null || isNaN(value)) return null;
      return { age, value };
    })
    .filter(Boolean);
  if (historyPoints.length === 0) {
    document.getElementById('growth-chart-summary-empty').style.display = '';
    canvas.style.display = 'none';
    return;
  }
  const who = buildWhoGrowthReferenceDatasets(genderKey);
  const { labels } = who;
  const historyData = who.allMonths.map(m => {
    const match = historyPoints.filter(p => p.age === m);
    return match.length ? match[match.length - 1].value : null;
  });
  const pointRadius = who.allMonths.map((m, i) => historyData[i] === null ? 0 : 3.5);
  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        ...who.datasets,
        ...buildGrowthActualLineDatasets('Riwayat Pengukuran', historyData, pointRadius, '#2d465e')
      ]
    },
    options: buildGrowthChartOptions()
  });
  renderGrowthChartLegend('growth-chart-legend-summary', 'growth-chart-summary', buildGrowthChartLegendItems('Riwayat Pengukuran'));
}

// ==========================================
// SECTION: History Data
// ==========================================
// Mengisi riwayat pengisian
function populateRiwayat(riwayatData) {
  const riwayatContent = document.getElementById('riwayat-content');
  const emptyEl = document.getElementById('riwayat-content-empty');
  riwayatContent.innerHTML = '';
  if (riwayatData.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  const accentMap = {
    'status-normal': '#1FA454',
    'status-pendek': '#F08C1C',
    'status-sangat-pendek': '#D62839',
    'status-unknown': '#8C97A3'
  };
  const tpl = document.getElementById('tpl-riwayat-item');
  const timeline = document.createElement('div');
  timeline.className = 'riwayat-timeline';
  riwayatData.forEach(item => {
    const statusText = item.status_pertumbuhan || 'N/A';
    const pillClass = getStatusPillClass(item.status_pertumbuhan);
    const dotColor = accentMap[pillClass] || accentMap['status-unknown'];
    const tb = (item.tb_balita !== null && item.tb_balita !== undefined) ? item.tb_balita : 'N/A';
    const bb = (item.bb_balita !== null && item.bb_balita !== undefined) ? item.bb_balita : 'N/A';

    const node = tpl.content.firstElementChild.cloneNode(true);
    node.style.setProperty('--dot-color', dotColor);
    node.querySelector('.js-rd-day').textContent = formatTanggalIndo(item.tanggal_pengisian);
    node.querySelector('.js-rd-age').textContent = item.umur || 'N/A';
    node.querySelector('.js-tb').textContent = `${tb} cm`;
    node.querySelector('.js-bb').textContent = `${bb} kg`;
    const pillEl = node.querySelector('.js-status-pill');
    pillEl.classList.add(pillClass);
    pillEl.textContent = statusText;
    node.querySelector('.js-btn-cek').addEventListener('click', () => cekRiwayat(item.id_pengisian));
    timeline.appendChild(node);
  });
  riwayatContent.appendChild(timeline);
  scheduleRiwayatHeightCap();
}

let riwayatHeightObserver = null;
// Membatasi tinggi scroll riwayat
function capRiwayatScrollHeight() {
  const scrollBody = document.getElementById('riwayat-scroll-body');
  if (!scrollBody) return;
  const timeline = scrollBody.querySelector('.riwayat-timeline');
  const items = timeline ? timeline.querySelectorAll(':scope > .riwayat-item') : [];
  const grafikCard = document.querySelector('#grafik-pertumbuhan .riwayat-card');
  if (items.length <= 5) {
    scrollBody.style.maxHeight = '';
    scrollBody.style.overflowY = 'visible';
    if (grafikCard) { grafikCard.style.maxHeight = ''; grafikCard.style.overflowY = ''; }
    return;
  }
  const paddingTop = parseFloat(getComputedStyle(scrollBody).paddingTop) || 0;
  const paddingBottom = parseFloat(getComputedStyle(scrollBody).paddingBottom) || 0;
  const timelineRect = timeline.getBoundingClientRect();
  const fifthItemRect = items[4].getBoundingClientRect();
  const visibleContentHeight = fifthItemRect.bottom - timelineRect.top;
  scrollBody.style.maxHeight = Math.ceil(visibleContentHeight + paddingTop + paddingBottom) + 'px';
  scrollBody.style.overflowY = 'auto';
  const riwayatCard = document.querySelector('#riwayat .riwayat-card');
  if (riwayatCard && grafikCard) {
    grafikCard.style.maxHeight = riwayatCard.getBoundingClientRect().height + 'px';
    grafikCard.style.overflowY = 'auto';
  }
}
// Menjadwalkan pembatasan tinggi riwayat
function scheduleRiwayatHeightCap() {
  capRiwayatScrollHeight();
  requestAnimationFrame(() => requestAnimationFrame(capRiwayatScrollHeight));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(capRiwayatScrollHeight).catch(() => { });
  }
  const timelineEl = document.querySelector('#riwayat-content .riwayat-timeline');
  if (riwayatHeightObserver) riwayatHeightObserver.disconnect();
  if (timelineEl && window.ResizeObserver) {
    riwayatHeightObserver = new ResizeObserver(() => capRiwayatScrollHeight());
    riwayatHeightObserver.observe(timelineEl);
  }
}
window.addEventListener('resize', () => { if (typeof capRiwayatScrollHeight === 'function') capRiwayatScrollHeight(); });
// Mengecek riwayat pengisian
function cekRiwayat(idPengisian) {
  window.location.href = `analysis.html?id=${encodeURIComponent(idPengisian)}`;
}

document.querySelectorAll('[data-growth-action]').forEach((button) => {
  button.addEventListener('click', () => {
const action = button.dataset.growthAction;
if (action === 'zoom-in') zoomGrowthChart('growth-chart-summary', 1.2);
if (action === 'zoom-out') zoomGrowthChart('growth-chart-summary', 0.8);
if (action === 'reset') resetGrowthChartZoom('growth-chart-summary');
  });
});
