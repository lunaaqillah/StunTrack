// ==========================================
// SECTION: Initialization
// ==========================================
const printCache = {};
const chartRenderPromises = {};
const gondokAlertPromises = {};
let riwayatGondokConfigPromise = null;

function getRiwayatGondokConfig() {
  if (!riwayatGondokConfigPromise) {
    riwayatGondokConfigPromise = fetchJson('/identitas_orang_tua/reference/riwayat_gondok');
  }
  return riwayatGondokConfigPromise;
}
let growthReferenceData = null;

// Fetch JSON yang aman: mencegah HTML error page Flask diparse sebagai JSON.
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  let payload = null;
  if (contentType.includes('application/json')) {
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (_) {
      throw new Error(`Respons JSON dari ${url} tidak valid.`);
    }
  } else {
    throw new Error(`Server mengembalikan halaman HTML untuk ${url} (HTTP ${response.status}). Pastikan backend STUNTRACK yang dijalankan adalah versi terbaru.`);
  }
  if (!response.ok) {
    const error = new Error(payload?.error || `Gagal mengambil data (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

document.addEventListener('DOMContentLoaded', function () {
  Promise.allSettled([fetchGrowthReference(), fetchFaktorRisikoExplanations()]).then(() => {
    loadAnalysisData();
  });
});

// ==========================================
// SECTION: Analysis Data
// ==========================================
function redirectTo404() {
  window.location.replace('/404.html');
}


// Memuat data analisis
function loadAnalysisData() {
  const urlParams = new URLSearchParams(window.location.search);
  const ids = urlParams.getAll("id");
  if (ids.length === 0) {
    redirectTo404();
    return;
  }
  if (ids.length === 1) {
    loadSingleAnalysis(ids[0]);
    return;
  }
  populateTabs(ids);
}

// ==========================================
// SECTION: Tab Rendering
// ==========================================
// Membangun tab analisis
function populateTabs(ids) {
  const tabsContainer = document.getElementById('balitaTabs');
  const contentContainer = document.getElementById('balitaTabContent');
  tabsContainer.innerHTML = '';
  contentContainer.innerHTML = '';
  const uniqueBalitas = new Map();
  const promises = ids.map(id => fetchJson(`/pengisian/${id}`).then(pengisianData => {
    const balitaId = pengisianData.id_balita;
    if (!uniqueBalitas.has(balitaId)) {
      uniqueBalitas.set(balitaId, { pengisianData, id });
    }
    return true;
  }).catch(err => {
    console.error("Error fetching pengisian data:", err);
    return err;
  }));
  Promise.all(promises).then(results => {
    if (uniqueBalitas.size === 0 || results.every(result => result instanceof Error && result.status === 404)) {
      redirectTo404();
      return;
    }
    let index = 0;
    uniqueBalitas.forEach(({ pengisianData, id }) => {
      fetchJson(`/identitas_balita/${pengisianData.id_balita}`)
        .then(balita => {
          const namaBalita = balita.nama_balita;
          const tab = document.createElement('li');
          tab.className = 'nav-item';
          tab.role = 'presentation';
          tab.innerHTML = `
            <a class="nav-link ${index === 0 ? 'active show' : ''}" id="balita-tab-${index}" data-bs-toggle="tab" data-bs-target="#balita-pane-${index}" role="tab" aria-controls="balita-pane-${index}" aria-selected="${index === 0 ? 'true' : 'false'}">
              <h4>${namaBalita}</h4>
            </a>
          `;
          tabsContainer.appendChild(tab);
          const pane = document.createElement('div');
          pane.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`;
          pane.id = `balita-pane-${index}`;
          pane.role = 'tabpanel';
          pane.setAttribute('aria-labelledby', `balita-tab-${index}`);
          pane.appendChild(generateAnalysisContent(id, pengisianData, balita));
          contentContainer.appendChild(pane);
          initTooltips(pane);
          setTimeout(() => {
            loadFaktorRisikoForPane(id, `faktor-risiko-content-${id}`, pengisianData);
            renderGrowthChartFor(id);
            loadRiwayatGondokAlert(id, balita.id_orang_tua);
          }, 100);
          index++;
        })
        .catch(err => console.error("Error fetching balita data:", err));
    });
  });
}

// ==========================================
// SECTION: Analysis Rendering
// ==========================================
// Memuat analisis tunggal
function loadSingleAnalysis(idPengisian) {
  const contentContainer = document.getElementById('balitaTabContent');
  contentContainer.innerHTML = '';
  fetchJson(`/pengisian/${idPengisian}`)
    .then(pengisianData => {
      fetchJson(`/identitas_balita/${pengisianData.id_balita}`)
        .then(balitaData => {
          contentContainer.appendChild(generateAnalysisContent(idPengisian, pengisianData, balitaData));
          initTooltips(contentContainer);
          loadFaktorRisikoForPane(idPengisian, `faktor-risiko-content-${idPengisian}`, pengisianData);
          renderGrowthChartFor(idPengisian);
          loadRiwayatGondokAlert(idPengisian, balitaData.id_orang_tua);
        })
        .catch(err => {
          console.error("Error fetching balita data:", err);
          if (err.status === 404) {
            redirectTo404();
          }
        });
    })
    .catch(err => {
      console.error("Error fetching pengisian data:", err);
      if (err.status === 404) {
        redirectTo404();
      }
    });
}

document.addEventListener('DOMContentLoaded', function () {
  if (typeof AOS !== 'undefined') {
    AOS.refresh();
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }
});
// Membangun konten analisis
function generateAnalysisContent(idPengisian, pengisianData, balitaData) {
  const gender = balitaData.jenis_kelamin;
  const stunting = pengisianData.status_pertumbuhan;
  let stuntingImageSrc = "";
  if (stunting === "Normal") {
    stuntingImageSrc = gender === "Laki-laki" ? "/assets/img/BG-GOOD.png" : "/assets/img/GG-GOOD.png";
  } else if (stunting === "Pendek" || stunting === "Sangat Pendek") {
    stuntingImageSrc = gender === "Laki-laki" ? "/assets/img/BG-BAD.png" : "/assets/img/GG-BAD.png";
  }
  const birthDate = new Date(balitaData.tanggal_lahir);
  const fillingDate = new Date(pengisianData.tanggal_pengisian);
  const ageInMonths = (fillingDate.getFullYear() - birthDate.getFullYear()) * 12 + (fillingDate.getMonth() - birthDate.getMonth());
  const years = Math.floor(ageInMonths / 12);
  const months = ageInMonths % 12;
  const ageStr = years > 0 ? `${years} tahun ${months} bulan` : `${ageInMonths} bulan`;
  const keteranganStunting = {
    "Normal": "Tinggi sesuai usia dan perlu dipertahankan",
    "Pendek": "Tinggi di bawah standar dan membutuhkan intervensi lebih lanjut",
    "Sangat Pendek": "Tinggi sangat rendah dan membutuhkan intervensi lebih lanjut"
  };
  const statusColorMap = {
    "Normal": { bg: "#E5F7EA", accent: "#1FA454", glow: "rgba(31,164,84,0.16)" },
    "Pendek": { bg: "#FFF1DE", accent: "#F08C1C", glow: "rgba(240,140,28,0.16)" },
    "Sangat Pendek": { bg: "#FBE6E6", accent: "#D62839", glow: "rgba(214,40,57,0.16)" }
  };
  const statusColor = statusColorMap[stunting] || { bg: "#F1F2F4", accent: "#8C97A3", glow: "rgba(140,151,163,0.16)" };
  const genderKey = gender === "Laki-laki" ? "Laki-laki" : "Perempuan";
  const clampedAge = Math.max(0, Math.min(60, ageInMonths));
  const actualHeightVal = parseFloat(pengisianData.tb_balita) || 0;
  const medianAtAge = Math.round(getMedianHeight(genderKey, clampedAge) * 10) / 10;
  const heightDiff = Math.round((actualHeightVal - medianAtAge) * 10) / 10;
  let diffColor, diffIcon, diffLabel;
  if (heightDiff >= -1) {
    diffColor = "#1FA454"; diffIcon = "bi-check-circle-fill";
    diffLabel = "sehat pada usia yang sama berdasarkan standar WHO.";
  } else if (heightDiff >= -3) {
    diffColor = "#F08C1C"; diffIcon = "bi-exclamation-circle-fill";
    diffLabel = "berada di bawah batas standar.";
  } else {
    diffColor = "#D62839"; diffIcon = "bi-exclamation-triangle-fill";
    diffLabel = "berada jauh di bawah standar.";
  }
  printCache[idPengisian] = {
    nama: balitaData.nama_balita || "N/A",
    tglPengisian: formatTanggalIndo(pengisianData.tanggal_pengisian),
    tglLahir: formatTanggalIndo(balitaData.tanggal_lahir),
    jenisKelamin: balitaData.jenis_kelamin || "N/A",
    umur: ageStr || "N/A",
    tinggi: pengisianData.tb_balita || "N/A",
    berat: pengisianData.bb_balita || "N/A",
    status: pengisianData.status_pertumbuhan || "-",
    keterangan: keteranganStunting[pengisianData.status_pertumbuhan] || "",
    statusColor: statusColor,
    diffLabel: diffLabel,
    medianAtAge: medianAtAge,
    actualHeightVal: actualHeightVal,
    clampedAge: clampedAge
  };
  const tpl = document.getElementById('tpl-analysis-content');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.id = `analysis-content-${idPengisian}`;
  node.style.setProperty('--accent-color', statusColor.accent);
  node.style.setProperty('--glow-color', statusColor.glow);
  node.querySelector('.js-nama-balita').textContent = balitaData.nama_balita || "N/A";
  node.querySelector('.js-tgl-pengisian').textContent = formatTanggalIndo(pengisianData.tanggal_pengisian) || "N/A";
  node.querySelector('.js-jenis-kelamin').textContent = balitaData.jenis_kelamin || "N/A";
  node.querySelector('.js-tinggi-badan').textContent = pengisianData.tb_balita ? pengisianData.tb_balita + " cm" : "N/A";
  node.querySelector('.js-tgl-lahir').textContent = formatTanggalIndo(balitaData.tanggal_lahir) || "N/A";
  node.querySelector('.js-umur').textContent = ageStr || "N/A";
  node.querySelector('.js-berat-badan').textContent = pengisianData.bb_balita ? pengisianData.bb_balita + " kg" : "N/A";
  node.querySelector('.js-zoom-in').addEventListener('click', () => zoomGrowthChart(`growth-chart-${idPengisian}`, 1.3));
  node.querySelector('.js-zoom-out').addEventListener('click', () => zoomGrowthChart(`growth-chart-${idPengisian}`, 0.77));
  node.querySelector('.js-zoom-reset').addEventListener('click', () => resetGrowthChartZoom(`growth-chart-${idPengisian}`));
  node.querySelector('.js-diff-label').textContent = diffLabel;
  node.querySelector('.js-clamped-age').textContent = clampedAge;
  node.querySelector('.js-median-who').textContent = `${medianAtAge} cm`;
  node.querySelector('.js-actual-height').textContent = `${actualHeightVal} cm`;
  const canvas = node.querySelector('.js-growth-canvas');
  canvas.id = `growth-chart-${idPengisian}`;
  canvas.dataset.idBalita = balitaData.id_balita || pengisianData.id_balita;
  canvas.dataset.idPengisian = idPengisian;
  canvas.dataset.gender = genderKey;
  canvas.dataset.birthdate = balitaData.tanggal_lahir || '';
  canvas.dataset.currentAge = clampedAge;
  canvas.dataset.currentValue = actualHeightVal;
  canvas.dataset.currentDate = pengisianData.tanggal_pengisian || '';
  canvas.dataset.color = statusColor.accent;
  canvas.dataset.bg = statusColor.bg;
  node.querySelector('.js-growth-legend').id = `growth-chart-legend-${idPengisian}`;
  const img = node.querySelector('.js-stunting-img');
  if (stuntingImageSrc) {
    img.src = stuntingImageSrc;
    img.style.display = 'block';
  }
  node.querySelector('.js-status-text').textContent = `Balita ${pengisianData.status_pertumbuhan || "-"}`;
  node.querySelector('.js-status-desc').textContent = keteranganStunting[pengisianData.status_pertumbuhan] || "";
  node.querySelector('.js-status-badges').id = `status-badges-${idPengisian}`;
  node.querySelector('.js-gondok-alert').id = `riwayat-gondok-alert-${idPengisian}`;
  node.querySelector('.js-btn-pdf').addEventListener('click', function () {
    simpanAnalisisSebagaiPDF(idPengisian, this);
  });
  node.querySelector('.js-faktor-risiko-content').id = `faktor-risiko-content-${idPengisian}`;
  node.querySelector('.js-perbandingan-content').id = `perbandingan-content-${idPengisian}`;
  node.querySelector('.js-prediksi-y-content').id = `prediksi-y-content-${idPengisian}`;
  return node;
}
// Merender badge status analisis
function renderStatusBadges(idPengisian, historyList, ctx) {
  const container = document.getElementById(`status-badges-${idPengisian}`);
  if (!container) return;
  const { birthDate, genderKey, currentAge, currentValue, currentDateStr, accentColor, statusBgColor } = ctx;
  const currentDate = new Date(currentDateStr);
  const others = historyList
    .filter(item => String(item.id_pengisian) !== String(idPengisian))
    .map(item => ({ ...item, _date: new Date(item.tanggal_pengisian) }))
    .filter(item => !isNaN(item._date));
  others.sort((a, b) => b._date - a._date);
  let badgesHtml = '';
  const prevEntry = !isNaN(currentDate)
    ? others.find(item => item._date < currentDate)
    : others[0];
  if (prevEntry) {
    const prevAge = ageInMonthsFromDates(birthDate, prevEntry.tanggal_pengisian);
    const prevValue = parseFloat(prevEntry.tb_balita);
    if (prevAge !== null && !isNaN(prevValue)) {
      const prevDiff = prevValue - getMedianHeight(genderKey, prevAge);
      const currDiff = currentValue - getMedianHeight(genderKey, currentAge);
      const delta = Math.round((currDiff - prevDiff) * 100) / 100;
      let bg, color, icon, text;
      bg = statusBgColor || '#F1F2F4';
      color = accentColor || '#5a6674';
      if (delta > 0.15) {
        text = 'Membaik dari pengukuran sebelumnya';
      } else if (delta < -0.15) {
        text = 'Memburuk dari pengukuran sebelumnya';
      } else {
        text = 'Stabil dari pengukuran sebelumnya';
      }
      badgesHtml += `<span class="d-inline-flex align-items-center rounded-pill px-3 py-1" style="background:${bg};color:${color};font-size:0.76rem;font-weight:700;">
    </i>${text}
  </span>`;
      if (printCache[idPengisian]) printCache[idPengisian].trend = { text, color };
    }
  } else {
    badgesHtml += `<span class="d-inline-flex align-items-center rounded-pill px-3 py-1" style="background:#F1F2F4;color:#5a6674;font-size:0.76rem;font-weight:700;">
  </i>Perbarui data bulan depan!
</span>`;
    if (printCache[idPengisian]) printCache[idPengisian].trend = { text: 'Perbarui data bulan depan!', color: '#5a6674' };
  }
  container.innerHTML = badgesHtml;
}

// ==========================================
// SECTION: Growth Chart
// ==========================================
// Merender grafik pertumbuhan analisis
function renderGrowthChartFor(idPengisian) {
  const canvas = document.getElementById(`growth-chart-${idPengisian}`);
  if (!canvas) return Promise.resolve();
  if (chartRenderPromises[idPengisian]) return chartRenderPromises[idPengisian];
  canvas.dataset.rendered = "true";
  const idBalita = canvas.dataset.idBalita;
  const birthDate = canvas.dataset.birthdate;
  const genderKey = canvas.dataset.gender;
  const currentAge = parseInt(canvas.dataset.currentAge, 10);
  const currentValue = parseFloat(canvas.dataset.currentValue);
  const currentDateStr = canvas.dataset.currentDate;
  const accentColor = canvas.dataset.color || "#2d465e";
  const statusBgColor = canvas.dataset.bg || "#F1F2F4";
  const renderPromise = fetchJson(`/pengisian/balita/${idBalita}`)
    .then(res => res.ok ? res.json() : [])
    .catch(() => [])
    .then(historyRaw => {
      const historyList = Array.isArray(historyRaw) ? historyRaw : (historyRaw.data || []);
      renderStatusBadges(idPengisian, historyList, {
        idBalita, birthDate, genderKey, currentAge, currentValue, currentDateStr, accentColor, statusBgColor
      });
      const historyPoints = historyList
        .filter(item => String(item.id_pengisian) !== String(idPengisian))
        .map(item => {
          const age = ageInMonthsFromDates(birthDate, item.tanggal_pengisian);
          const value = parseFloat(item.tb_balita);
          if (age === null || isNaN(value)) return null;
          return { age, value };
        })
        .filter(Boolean);
      const who = buildWhoGrowthReferenceDatasets(genderKey);
      const { labels } = who;
      const historyData = who.allMonths.map(m => {
        const match = historyPoints.filter(p => p.age === m);
        return match.length ? match[match.length - 1].value : null;
      });
      const currentData = who.allMonths.map(m => m === currentAge ? currentValue : null);
      const actualData = who.allMonths.map((m, i) => historyData[i] !== null ? historyData[i] : currentData[i]);
      const actualPointColors = who.allMonths.map(m => '#2d465e');
      const actualPointRadius = who.allMonths.map((m, i) => actualData[i] === null ? 0 : (m === currentAge ? 5 : 3));
      new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            ...who.datasets,
            ...buildGrowthActualLineDatasets('Riwayat Pengukuran & Tinggi Saat Ini', actualData, actualPointRadius, actualPointColors)
          ]
        },
        options: buildGrowthChartOptions()
      });
      renderGrowthChartLegend(`growth-chart-legend-${idPengisian}`, `growth-chart-${idPengisian}`, buildGrowthChartLegendItems('Riwayat Pengukuran & Tinggi Saat Ini'));
    });
  chartRenderPromises[idPengisian] = renderPromise;
  return renderPromise;
}

// ==========================================
// SECTION: Parent History
// ==========================================
// Memuat riwayat gondok orang tua
function loadRiwayatGondokAlert(idPengisian, idOrangTua) {
  const el = document.getElementById(`riwayat-gondok-alert-${idPengisian}`);
  if (!el || !idOrangTua) return Promise.resolve();
  const p = fetchJson(`/identitas_orang_tua/${idOrangTua}`)
    .then(orangTua => {
      return getRiwayatGondokConfig().then(config => {
        const raw = (orangTua.riwayat_gondok || '').toString().trim().toLowerCase();
        const normalized = config.aliases[raw] || orangTua.riwayat_gondok;
        const info = config.values[normalized] || config.values.Tidak;
        const hasGondok = normalized === 'Ya';
        const gondokTitle = info.title;
        const gondokDesc = info.description;
        const gondokColor = info.color;
        const gondokBg = info.background;
        if (printCache[idPengisian]) {
          printCache[idPengisian].gondok = { hasGondok, title: gondokTitle, desc: gondokDesc, color: gondokColor, bg: gondokBg };
        }
        el.innerHTML = `
        <div class="rounded-4 p-3 text-center" style="background:${gondokBg};">
          <div style="font-size:0.85rem;font-weight:800;color:${gondokColor};line-height:1.3;text-transform:uppercase;letter-spacing:0.4px;">${gondokTitle}</div>
          <div style="font-size:0.75rem;color:#5a6674;line-height:1.5;margin-top:4px;text-align:justify;">${gondokDesc}</div>
        </div>`;
      });
    })
    .catch(err => console.error("Error fetching orang tua data for riwayat gondok alert:", err));
  gondokAlertPromises[idPengisian] = p;
  return p;
}

let explanations = {};

// ==========================================
// SECTION: Perbandingan Status Gizi & Risiko
// ==========================================
// Gaya tampilan per level kesesuaian (dari backend: perbandingan.level)
const PERBANDINGAN_LEVEL_STYLE = {
  aman: { color: '#1FA454', bg: '#E5F7EA', icon: 'bi-check-circle-fill', eyebrow: 'Perlu Dipertahankan' },
  pantau: { color: '#E8B93A', bg: '#FDF3DC', icon: 'bi-binoculars-fill', eyebrow: 'Perlu Dipantau' },
  waspada: { color: '#F08C1C', bg: '#FFF1DE', icon: 'bi-exclamation-circle-fill', eyebrow: 'Perlu Diwaspadai' },
  telusuri: { color: '#2F80ED', bg: '#E8F1FD', icon: 'bi-search-heart-fill', eyebrow: 'Perlu Ditelusuri' },
  perhatian: { color: '#F08C1C', bg: '#FFF1DE', icon: 'bi-flag-fill', eyebrow: 'Perlu Penanganan Bertahap' },
  darurat: { color: '#D62839', bg: '#FBE6E6', icon: 'bi-exclamation-triangle-fill', eyebrow: 'Perlu Penanganan Intensif' }
};
// Warna aksen untuk pil Status Pertumbuhan, mengikuti kategori TB/U (WHO)
const STATUS_STUNTING_WARNA = {
  'Normal': '#1FA454',
  'Pendek': '#F08C1C',
  'Sangat Pendek': '#D62839'
};
// Merender kartu perbandingan status pertumbuhan (WHO) vs kategori risiko kuesioner
function renderPerbandingan(idPengisian, contentId, perbandingan, prediksiKeseluruhan) {
  const element = document.getElementById(contentId);
  if (!element) return;
  if (!perbandingan || !prediksiKeseluruhan) {
    element.innerHTML = '';
    return;
  }
  const style = PERBANDINGAN_LEVEL_STYLE[perbandingan.level] || PERBANDINGAN_LEVEL_STYLE.perhatian;
  const warnaRisiko = prediksiKeseluruhan.warna || { accent: style.color, bg: style.bg };
  const warnaStunting = STATUS_STUNTING_WARNA[perbandingan.status_pertumbuhan] || style.color;
  const selarasBadge = perbandingan.is_selaras
    ? `<span class="d-inline-flex align-items-center gap-1 rounded-pill px-3 py-1 flex-shrink-0" style="background:#ffffff;color:#1FA454;font-size:0.74rem;font-weight:700;border:1px solid #1FA45445;"><i class="bi bi-link-45deg"></i>Sejalan</span>`
    : `<span class="d-inline-flex align-items-center gap-1 rounded-pill px-3 py-1 flex-shrink-0" style="background:#ffffff;color:#F08C1C;font-size:0.74rem;font-weight:700;border:1px solid #F08C1C45;"><i class="bi bi-shuffle"></i>Berbeda Arah</span>`;
  const statCard = (icon, label, value, color) => `
    <div class="flex-fill d-flex align-items-center gap-2 rounded-3 px-3 py-2" style="background:#ffffff;border:1px solid ${color}40;min-width:0;">
      <div class="d-flex align-items-center justify-content-center flex-shrink-0" style="width:34px;height:34px;border-radius:10px;background:${color}1a;">
        <i class="bi ${icon}" style="color:${color};font-size:1rem;"></i>
      </div>
      <div style="min-width:0;">
        <div style="font-size:0.64rem;font-weight:700;color:#8C97A3;text-transform:uppercase;letter-spacing:0.4px;">${label}</div>
        <div style="font-size:0.9rem;font-weight:800;color:${color};line-height:1.3;">${value}</div>
      </div>
    </div>`;
  const html = `
    <div class="rounded-4 p-3 p-md-4 h-100 d-flex flex-column justify-content-center position-relative overflow-hidden" style="background:#ffffff;border:1px solid ${style.color}30;box-shadow:0 6px 20px rgba(45,70,94,0.06);">
      <div class="position-absolute top-0 start-0 w-100 h-100" style="opacity:0.55;pointer-events:none;
        background-image:
          radial-gradient(${style.color}26 1.6px, transparent 1.6px),
          radial-gradient(${style.color}1c 1.4px, transparent 1.4px),
          radial-gradient(${style.color}14 1.9px, transparent 1.9px);
        background-size: 30px 30px, 46px 46px, 64px 64px;
        background-position: 4px 6px, 22px 34px, 48px 12px;"></div>
      <div class="position-relative">
        <div class="d-flex align-items-center gap-2 mb-3">
          <i class="bi ${style.icon} flex-shrink-0" style="color:${style.color};font-size:1.2rem;line-height:1;"></i>
          <div class="flex-grow-1" style="min-width:0;">
            <div class="d-flex align-items-center flex-wrap gap-2">
              <h3 class="mb-0 flex-grow-1" style="color:#2d465e;font-weight:800;font-size:1.2rem;min-width:0;">${perbandingan.judul}</h3>
              ${selarasBadge}
            </div>
          </div>
        </div>
        <div class="d-flex flex-column flex-sm-row gap-2 mb-3">
          ${statCard('bi-rulers', 'Status Pertumbuhan', perbandingan.status_pertumbuhan, warnaStunting)}
          ${statCard('bi-graph-up-arrow', 'Kategori Risiko Stunting', perbandingan.kategori_risiko, warnaRisiko.accent)}
        </div>
        <p class="mb-0" style="color:#465a6b;font-size:0.88rem;line-height:1.65;text-align:justify;">${perbandingan.deskripsi}</p>
      </div>
    </div>`;
  element.innerHTML = html;
  if (printCache[idPengisian]) {
    printCache[idPengisian].perbandingan = { ...perbandingan, warnaRisiko, warnaStunting, style };
  }
}

// Data deskripsi & posisi tiap zona pada gauge interaktif Rendah/Sedang/Tinggi
const RISK_GAUGE_ZONES = {
  rendah: { pct: 15, color: '#1FA454', desc: 'Z ≤ −1 SD — skor jauh di bawah rata-rata, risiko stunting rendah.' },
  sedang: { pct: 50, color: '#F08C1C', desc: '−1 SD < Z < +1 SD — skor mendekati rata-rata populasi, risiko stunting sedang.' },
  tinggi: { pct: 85, color: '#D62839', desc: 'Z ≥ +1 SD — skor jauh di atas rata-rata, risiko stunting tinggi.' }
};

// Mengaktifkan interaksi hover/tap pada gauge Rendah/Sedang/Tinggi (menampilkan tooltip & highlight zona)
function initRiskGaugeInteractivity(scopeEl, idPengisian, activeLevel) {
  const tooltipEl = scopeEl.querySelector(`#risk-tooltip-${idPengisian}`);
  const zoneEls = Array.from(scopeEl.querySelectorAll('.risk-gauge-zone'));
  const labelEls = Array.from(scopeEl.querySelectorAll('.risk-gauge-label'));
  if (!tooltipEl || (!zoneEls.length && !labelEls.length)) return;

  let pinnedZone = null;

  function paint(zone) {
    labelEls.forEach((label) => {
      const isActive = label.dataset.zone === zone;
      const data = RISK_GAUGE_ZONES[label.dataset.zone];
      label.style.color = isActive ? data.color : '';
      label.style.transform = isActive ? 'scale(1.12)' : 'scale(1)';
    });
    zoneEls.forEach((zoneEl) => {
      zoneEl.classList.toggle('is-active', zoneEl.dataset.zone === zone);
    });
    if (zone && RISK_GAUGE_ZONES[zone]) {
      const data = RISK_GAUGE_ZONES[zone];
      tooltipEl.textContent = data.desc;
      tooltipEl.style.background = data.color;
      tooltipEl.style.left = data.pct + '%';
      tooltipEl.classList.add('is-visible');
      // Geser posisi tooltip via JS agar tidak terpotong keluar kartu, dengan ukuran/lebar
      // yang tetap konsisten untuk ketiga zona (Rendah/Sedang/Tinggi) di semua ukuran layar.
      requestAnimationFrame(() => {
        const wrap = tooltipEl.parentElement;
        if (!wrap) return;
        const wrapRect = wrap.getBoundingClientRect();
        const tipRect = tooltipEl.getBoundingClientRect();
        const half = tipRect.width / 2;
        const idealCenter = wrapRect.left + (wrapRect.width * data.pct) / 100;
        const minCenter = wrapRect.left + half + 4;
        const maxCenter = wrapRect.right - half - 4;
        const clampedCenter = Math.min(Math.max(idealCenter, minCenter), maxCenter);
        const leftPct = ((clampedCenter - wrapRect.left) / wrapRect.width) * 100;
        tooltipEl.style.left = leftPct + '%';
      });
    } else {
      tooltipEl.classList.remove('is-visible');
    }
  }

  [...zoneEls, ...labelEls].forEach((el) => {
    el.addEventListener('mouseenter', () => paint(el.dataset.zone));
    el.addEventListener('mouseleave', () => paint(pinnedZone));
    el.addEventListener('click', () => {
      pinnedZone = pinnedZone === el.dataset.zone ? null : el.dataset.zone;
      paint(pinnedZone || activeLevel);
    });
  });

  // Highlight zona aktif (sesuai hasil skor) secara default saat kartu pertama kali tampil
  paint(activeLevel);
}

// Merender visual besar skor & kategori prediksi risiko stunting keseluruhan (gauge meter)
function renderPrediksiY(idPengisian, contentId, prediksiKeseluruhan) {
  const element = document.getElementById(contentId);
  if (!element) return;
  if (!prediksiKeseluruhan) {
    element.innerHTML = '';
    return;
  }
  const { z_score, kategori, level, warna } = prediksiKeseluruhan;
  const iconByLevel = {
    tinggi: 'bi-exclamation-triangle-fill',
    sedang: 'bi-exclamation-circle-fill',
    rendah: 'bi-shield-fill-check'
  };
  const icon = iconByLevel[level] || 'bi-graph-up-arrow';
  const clamped = Math.max(-2.5, Math.min(2.5, z_score));
  const pct = ((clamped + 2.5) / 5) * 100;
  const html = `
    <div class="mb-3">
      <h4 class="mb-2 text-center u-ff-Mont-HeavyDEMO-var-headi" style="color:#2d465e;font-weight:800;">Prediksi Risiko Stunting</h4>
      <p class="text-center mb-0 u-c-var-muted_fs-0-88rem">
        Skor ini merupakan gabungan dari seluruh 10 faktor pada kuesioner (X1&ndash;X10), lalu dikategorikan menjadi
        Rendah, Sedang, atau Tinggi berdasarkan seberapa jauh skornya menyimpang dari rata-rata populasi acuan
        (mengikuti Aturan Empiris, 1 SD).
      </p>
    </div>
    <div class="rounded-4 p-4 mb-4 position-relative overflow-hidden" style="background:linear-gradient(135deg,#F7F9FB 0%,#EEF2F6 100%);border:1px solid #E7EBEF;box-shadow:0 6px 20px rgba(45,70,94,0.05);">
      <div class="position-absolute top-0 start-0 w-100 h-100" style="opacity:0.6;pointer-events:none;
        background-image:
          radial-gradient(${warna.accent}22 1.6px, transparent 1.6px),
          radial-gradient(${warna.accent}16 1.4px, transparent 1.4px);
        background-size: 32px 32px, 50px 50px;
        background-position: 6px 8px, 26px 30px;"></div>
      <div class="d-flex flex-column flex-lg-row align-items-stretch gap-4 position-relative">
        <div class="risk-score-card d-flex flex-column align-items-center justify-content-center text-center flex-shrink-0 rounded-4 p-3" style="background:#ffffff;border:1px solid #E7EBEF;">
          <div class="u-c-var-muted_fs-0-88rem mb-2" style="font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Skor Risiko (Z)</div>
          <div class="mb-2" style="font-family:'Mont-HeavyDEMO', var(--heading-font);font-size:34px;font-weight:800;color:${warna.accent};line-height:1.15;">${z_score >= 0 ? '+' : ''}${Number(z_score).toFixed(2)}</div>
          <span class="d-inline-flex align-items-center gap-1 rounded-pill px-3 py-1" style="background:${warna.accent};color:#fff;font-size:0.9rem;font-weight:700;letter-spacing:0.8px;box-shadow:0 4px 12px ${warna.accent}45;">
            <i class="bi ${icon}"></i>Risiko ${kategori}
          </span>
        </div>
        <div class="d-none d-lg-block flex-shrink-0" style="width:1px;align-self:stretch;background:#DCE3EA;"></div>
        <div class="flex-grow-1 w-100 d-flex flex-column justify-content-center">
          <div class="position-relative" style="padding-top:18px;">
            <div class="position-absolute" style="left:${pct}%;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;z-index:3;pointer-events:none;transition:left 0.2s ease;">
              <div style="width:14px;height:14px;border-radius:50%;background:#2d465e;border:3px solid #fff;box-shadow:0 2px 8px rgba(45,70,94,0.4);"></div>
              <div style="width:2px;height:10px;background:#2d465e;"></div>
            </div>
            <div class="risk-gauge-tooltip" id="risk-tooltip-${idPengisian}"></div>
            <div class="risk-gauge-bar position-relative" style="height:14px;border-radius:20px;overflow:hidden;background:linear-gradient(90deg,#1FA454 0%,#1FA454 30%,#F08C1C 30%,#F08C1C 70%,#D62839 70%,#D62839 100%);box-shadow:inset 0 1px 3px rgba(0,0,0,0.08);">
              <div class="risk-gauge-zone" data-zone="rendah" style="position:absolute;left:0;top:0;width:30%;height:100%;"></div>
              <div class="risk-gauge-zone" data-zone="sedang" style="position:absolute;left:30%;top:0;width:40%;height:100%;"></div>
              <div class="risk-gauge-zone" data-zone="tinggi" style="position:absolute;left:70%;top:0;width:30%;height:100%;"></div>
            </div>
          </div>
          <div class="d-flex justify-content-between mt-2 u-c-var-muted_fs-0-88rem" style="font-weight:700;">
            <span class="risk-gauge-label" data-zone="rendah">Rendah</span>
            <span class="risk-gauge-label" data-zone="sedang">Sedang</span>
            <span class="risk-gauge-label" data-zone="tinggi">Tinggi</span>
          </div>
        </div>
      </div>
    </div>`;
  element.innerHTML = html;
  initRiskGaugeInteractivity(element, idPengisian, level);
  if (printCache[idPengisian]) {
    printCache[idPengisian].prediksiY = { z_score, kategori, level, warna };
  }
}

// ==========================================
// SECTION: Risk Factor Data
// ==========================================
// Memuat faktor risiko stunting untuk pane
function loadFaktorRisikoForPane(idPengisian, contentId, pengisianData) {
  // Hasil model sudah disimpan sebagai snapshot pada saat pengisian dibuat.
  // Halaman analisis hanya membaca snapshot tersebut dari database melalui
  // endpoint /pengisian/<id>; tidak ada perhitungan ulang di halaman ini.
  const data = pengisianData && pengisianData.analysis;
  if (!data) {
    const element = document.getElementById(contentId);
    if (element) {
      element.innerHTML = `
        <div class="alert alert-warning rounded-4 border-0" role="alert">
          Hasil analisis belum tersedia untuk pengisian ini.
        </div>`;
    }
    return;
  }

  const semuaKontribusi = data.kontribusi_risiko || [];
  const { influentialAll, nonInfluentialAll, influential, nonInfluential, influentialExtra, nonInfluentialExtra } = splitFaktorRisiko(semuaKontribusi);
  renderPerbandingan(idPengisian, `perbandingan-content-${idPengisian}`, data.perbandingan, data.prediksi_keseluruhan);
  renderPrediksiY(idPengisian, `prediksi-y-content-${idPengisian}`, data.prediksi_keseluruhan);
  if (printCache[idPengisian]) {
    const mapFaktor = (isNaik) => k => {
      const exp = explanations[k.variable];
      return {
        nama: (exp && exp.name) || k.label || k.variable,
        nilai: k.kontribusi,
        desc: exp ? (isNaik ? exp.berpengaruh : exp.tidak) : ''
      };
    };
    printCache[idPengisian].faktorNaik = influentialAll.map(mapFaktor(true));
    printCache[idPengisian].faktorTurun = nonInfluentialAll.map(mapFaktor(false));
  }

  let content = `
    <div class="d-flex align-items-center justify-content-center mb-3">
      <h4 class="mb-0 u-ff-Mont-HeavyDEMO-var-headi" style="color: #2d465e; font-weight: 700;">Faktor Risiko Stunting</h4>
    </div>
    <p class="text-center mb-3" style="color:#5a6674;font-size:0.85rem;">
      Nilai <strong style="color:#D62839;">positif (+)</strong> berarti faktor tersebut <strong>meningkatkan</strong> risiko stunting,
      sedangkan nilai <strong style="color:#1FA454;">negatif (-)</strong> berarti faktor tersebut <strong>menurunkan</strong> risiko stunting.
    </p>
    <div class="rounded-4 p-3 p-md-4" style="background:#ffffff;border:1px solid #E7EBEF;">
      <div style="position:relative;height:360px;">
        <canvas id="faktor-chart-${idPengisian}"></canvas>
      </div>
    </div>
    `;
  content += buildFaktorDirectionHTML(
    influential, influentialExtra, 'naik', `faktor-extra-naik-${idPengisian}`, 'Kontribusi',
    'Faktor yang Meningkatkan Risiko Terbesar terhadap Kondisi Stunting',
    'Tidak ditemukan faktor yang meningkatkan risiko stunting pada hasil ini.'
  );
  content += buildFaktorDirectionHTML(
    nonInfluential, nonInfluentialExtra, 'turun', `faktor-extra-turun-${idPengisian}`, 'Kontribusi',
    'Faktor yang Menurunkan Risiko Terbesar terhadap Kondisi Stunting',
    'Tidak ditemukan faktor yang menurunkan risiko stunting pada hasil ini.'
  );
  const element = document.getElementById(contentId);
  if (element) {
    element.innerHTML = content;
    renderFaktorRisikoChart(`faktor-chart-${idPengisian}`, semuaKontribusi);
  } else {
    console.error("Element not found for contentId:", contentId);
  }
}

// ==========================================
// SECTION: PDF Export
// ==========================================
// Menyimpan analisis sebagai PDF
async function simpanAnalisisSebagaiPDF(idPengisian, triggerBtn) {
  const data = printCache[idPengisian];
  if (!data) {
    window.print();
    return;
  }
  const originalBtnHtml = triggerBtn ? triggerBtn.innerHTML : null;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Menyiapkan PDF...';
  }
  try {
    await renderGrowthChartFor(idPengisian);
  } catch (e) {
    console.error('Gagal menunggu render grafik untuk PDF:', e);
  }
  try {
    if (gondokAlertPromises[idPengisian]) await gondokAlertPromises[idPengisian];
  } catch (e) {
    console.error('Gagal menunggu data riwayat gondok untuk PDF:', e);
  }
  const chartCanvas = document.getElementById(`growth-chart-${idPengisian}`);
  let chartImg = '';
  try {
    if (chartCanvas) chartImg = chartCanvas.toDataURL('image/png', 1.0);
  } catch (e) {
    chartImg = '';
  }
  const faktorChartCanvas = document.getElementById(`faktor-chart-${idPengisian}`);
  let faktorChartImg = '';
  try {
    if (faktorChartCanvas) faktorChartImg = faktorChartCanvas.toDataURL('image/png', 1.0);
  } catch (e) {
    faktorChartImg = '';
  }
  const tanggalCetak = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date());
  // Mengubah warna HEX menjadi RGBA
  const hexToRgba = (hex, alpha) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
  };
  // Membangun baris informasi
  const rowKV = (icon, label, value) => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:#F7F9FB;border-radius:10px;">
      <div style="width:26px;height:26px;border-radius:50%;background:#EAA0A3;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="bi ${icon}" style="color:#fff;font-size:12px;"></i>
      </div>
      <div style="min-width:0;">
        <div style="font-size:8.5px;font-weight:700;color:#8C97A3;letter-spacing:0.5px;text-transform:uppercase;">${label}</div>
        <div style="font-size:11.5px;font-weight:700;color:#2d465e;">${value}</div>
      </div>
    </div>`;
  const dashed = `<div style="border-top:1px dashed #C9D3DC;margin:20px 0;"></div>`;
  // Membangun teks eyebrow
  const eyebrow = (text, icon) => `
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:12px;">
      <div style="width:26px;height:26px;border-radius:8px;background:#2d465e;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="bi ${icon}" style="color:#fff;font-size:12px;"></i>
      </div>
      <div style="font-size:20px;font-weight:800;color:#2d465e;letter-spacing:0.3px;">${text}</div>
    </div>`;
  // Menentukan warna faktor risiko stunting
  const faktorColor = (nilai) => (nilai < 0 ? '#1FA454' : '#D62839');
  // Membangun daftar faktor risiko stunting
  const faktorList = (list, isNaik) => {
    if (!list || list.length === 0) return '';
    return list.map(f => {
      const color = faktorColor(f.nilai);
      const border = f.nilai < 0 ? '#BFE8CC' : '#F3D2D4';
      return `
        <div style="margin-bottom:10px;padding:12px 14px;background:#fff;border:1px solid ${border};border-radius:12px;page-break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="display:flex;align-items:center;gap:7px;min-width:0;">
              <i class="bi ${isNaik ? 'bi-arrow-up-short' : 'bi-arrow-down-short'}" style="color:${color};font-size:16px;flex-shrink:0;"></i>
              <span style="font-size:11.5px;font-weight:700;color:#2d465e;">${f.nama}</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
              <span style="font-size:10.5px;font-weight:800;color:${color};white-space:nowrap;">${f.nilai >= 0 ? '+' : ''}${Number(f.nilai).toFixed(3)}</span>
            </div>
          </div>
          <div style="border-top:1px dashed ${border};margin:9px 0 8px;"></div>
          <div style="font-size:10px;color:#5a6674;line-height:1.6;">${f.desc || ''}</div>
        </div>`;
    }).join('');
  };
  const perbandinganBlock = data.perbandingan ? `
    ${dashed}
    ${eyebrow('Perbandingan Status Pertumbuhan &amp; Prediksi Risiko', 'bi-clipboard2-pulse-fill')}
    <div style="background:${data.perbandingan.style.bg};border:1px solid ${data.perbandingan.style.color}33;border-radius:14px;padding:16px;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <i class="bi ${data.perbandingan.style.icon}" style="color:${data.perbandingan.style.color};font-size:15px;line-height:1;"></i>
        <div style="font-size:12.5px;font-weight:800;color:#2d465e;flex:1;min-width:0;">${data.perbandingan.judul}</div>
        ${data.perbandingan.is_selaras
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:#fff;color:#1FA454;font-size:9px;font-weight:700;border:1px solid #1FA45445;">Sejalan</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:#fff;color:#F08C1C;font-size:9px;font-weight:700;border:1px solid #F08C1C45;">Berbeda Arah</span>`}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <div style="flex:1;min-width:140px;background:#fff;border:1px solid ${(data.perbandingan.warnaStunting || '#2d465e')}40;border-radius:10px;padding:8px 10px;">
          <div style="font-size:8px;font-weight:700;color:#8C97A3;text-transform:uppercase;letter-spacing:0.4px;">Status Pertumbuhan</div>
          <div style="font-size:11px;font-weight:800;color:${data.perbandingan.warnaStunting || '#2d465e'};">${data.perbandingan.status_pertumbuhan}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#fff;border:1px solid ${data.perbandingan.warnaRisiko.accent}40;border-radius:10px;padding:8px 10px;">
          <div style="font-size:8px;font-weight:700;color:#8C97A3;text-transform:uppercase;letter-spacing:0.4px;">Risiko Stunting</div>
          <div style="font-size:11px;font-weight:800;color:${data.perbandingan.warnaRisiko.accent};">${data.perbandingan.kategori_risiko}</div>
        </div>
      </div>
      <div style="font-size:10px;color:#5a6674;line-height:1.7;text-align:justify;">${data.perbandingan.deskripsi}</div>
    </div>` : '';
  const prediksiYPct = data.prediksiY
    ? Math.max(0, Math.min(100, ((Math.max(-2.5, Math.min(2.5, Number(data.prediksiY.z_score))) + 2.5) / 5) * 100))
    : 50;
  const prediksiYBlock = data.prediksiY ? `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#F7F9FB;border-radius:14px;padding:14px 16px;margin-bottom:14px;page-break-inside:avoid;">
      <div style="text-align:center;min-width:110px;">
        <div style="font-size:22px;font-weight:800;color:${data.prediksiY.warna.accent};">${data.prediksiY.z_score >= 0 ? '+' : ''}${Number(data.prediksiY.z_score).toFixed(2)}</div>
        <span style="display:inline-block;margin-top:3px;padding:3px 11px;border-radius:20px;background:${data.prediksiY.warna.accent};color:#fff;font-size:9px;font-weight:700;">RISIKO ${data.prediksiY.kategori.toUpperCase()}</span>
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="position:relative;padding-top:12px;">
          <div style="position:absolute;left:${prediksiYPct}%;top:0;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #2d465e;"></div>
          <div style="height:10px;border-radius:20px;overflow:hidden;background:linear-gradient(90deg,#1FA454 0%,#1FA454 30%,#F08C1C 30%,#F08C1C 70%,#D62839 70%,#D62839 100%);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:9px;font-weight:700;color:#5a6674;">
          <span>Rendah</span><span>Sedang</span><span>Tinggi</span>
        </div>
      </div>
    </div>` : '';
  const trendBlock = data.trend ? `
    <div style="text-align:center;margin-top:14px;">
      <span style="display:inline-block;padding:5px 14px;border-radius:20px;background:rgba(255,255,255,0.65);color:${data.trend.color};font-size:10.5px;font-weight:700;">${data.trend.text}</span>
    </div>` : '';
  const faktorChartBlock = faktorChartImg ? `
    <div style="background:#fff;border:1px solid #E7EBEF;border-radius:14px;padding:10px;margin-bottom:14px;page-break-inside:avoid;">
      <img src="${faktorChartImg}" style="width:100%;border-radius:8px;" />
    </div>` : '';
  const faktorSection = (data.faktorNaik && data.faktorNaik.length) || (data.faktorTurun && data.faktorTurun.length) ? `
    ${dashed}
    ${eyebrow('Prediksi Risiko Stunting', 'bi-graph-up')}
    ${prediksiYBlock}
    ${eyebrow('Faktor Risiko Stunting', 'bi-bar-chart-line-fill')}
    ${faktorChartBlock}
    <div style="font-size:9.5px;color:#8C97A3;margin-bottom:14px;line-height:1.6;">
      Warna dan panah pada tiap kartu menunjukkan arah pengaruhnya terhadap risiko stunting:
      <ul style="margin:6px 0 0;padding-left:16px;">
        <li><strong style="color:#D62839;">Merah &uarr;</strong> = menaikkan risiko</li>
        <li><strong style="color:#1FA454;">h=Hijau &darr;</strong> = menurunkan risiko</li>
      </ul>
    </div>
    ${data.faktorNaik && data.faktorNaik.length ? `
      <div style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#D62839;margin-bottom:8px;">
        <i class="bi bi-exclamation-triangle-fill"></i>Faktor yang Meningkatkan Risiko
      </div>
      ${faktorList(data.faktorNaik, true)}` : ''}
    ${data.faktorTurun && data.faktorTurun.length ? `
      <div style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#1FA454;margin:14px 0 8px;">
        <i class="bi bi-shield-fill-check"></i>Faktor yang Menurunkan Risiko
      </div>
      ${faktorList(data.faktorTurun, false)}` : ''}
  ` : '';
  const receiptHtml = `
    <div style="font-family:'Poppins',sans-serif;max-width:720px;margin:0 auto;border-radius:20px;overflow:hidden;color:#2d465e;border:1px solid #E7EBEF;">
      <!-- Header: bg putih polos (logo tidak selalu bisa dimuat saat cetak, jadi hindari bg gelap) -->
      <div style="background:#ffffff;padding:24px;position:relative;overflow:hidden;border-bottom:1px solid #E7EBEF;">
        <div style="position:relative;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="assets/img/LOGO.png" alt="StunTrack" style="height:34px;" />
          </div>
          <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:#F7F9FB;color:#2d465e;font-size:9.5px;font-weight:600;">
            <i class="bi bi-calendar-check"></i>${tanggalCetak}
          </span>
        </div>
      </div>
      <div style="padding:24px;background:#fff;">
      <!-- Data Balita -->
      ${eyebrow('Data Balita', 'bi-person-vcard-fill')}
      <div style="margin-bottom:8px;">
        ${rowKV('bi-person-fill', 'Nama Balita', data.nama)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${rowKV('bi-gender-ambiguous', 'Jenis Kelamin', data.jenisKelamin)}
        ${rowKV('bi-cake2-fill', 'Tanggal Lahir', data.tglLahir)}
        ${rowKV('bi-hourglass-split', 'Umur', data.umur)}
        ${rowKV('bi-calendar-event-fill', 'Tanggal Pengisian', data.tglPengisian)}
        ${rowKV('bi-arrows-vertical', 'Tinggi Badan', data.tinggi + ' cm')}
        ${rowKV('bi-speedometer2', 'Berat Badan', data.berat + ' kg')}
      </div>
      ${dashed}
      <!-- Status Pertumbuhan & Glosarium Kategori: sebelahan kanan-kiri -->
      <div style="display:flex;gap:14px;align-items:stretch;flex-wrap:wrap;">
        <div style="flex:1 1 0;min-width:220px;text-align:center;page-break-inside:avoid;position:relative;overflow:hidden;background:${data.statusColor.bg};border-radius:16px;padding:26px 16px;">
          <div style="position:absolute;width:130px;height:130px;border-radius:50%;background:${hexToRgba(data.statusColor.accent, 0.14)};top:-60px;right:-40px;"></div>
          <div style="position:absolute;width:70px;height:70px;border-radius:50%;background:${hexToRgba(data.statusColor.accent, 0.16)};bottom:-30px;left:-20px;"></div>
          <div style="position:relative;">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:20px;background:${data.statusColor.accent};color:#fff;font-size:10.5px;font-weight:700;letter-spacing:0.5px;">
              <i class="bi bi-shield-fill-check"></i>STATUS PERTUMBUHAN
            </span>
            <div style="font-size:26px;font-weight:800;margin:12px 0 2px;">Balita ${data.status}</div>
            <div style="font-size:11.5px;color:#5a6674;line-height:1.6;">${data.keterangan}</div>
            ${trendBlock}
          </div>
        </div>
        <div style="flex:1 1 0;min-width:220px;background:#F7F9FB;border-radius:12px;padding:14px 16px;">
          <div style="font-size:10px;font-weight:700;color:#2d465e;margin-bottom:8px;">Keterangan Kategori Status Pertumbuhan:</div>
          <ul style="margin:0;padding-left:16px;font-size:10px;color:#5a6674;line-height:1.8;">
            <li><span style="color:#1FA454;font-weight:700;">Normal</span> — Tinggi sesuai usia dan perlu dipertahankan</li>
            <li><span style="color:#F08C1C;font-weight:700;">Pendek</span> — Tinggi di bawah standar dan memerlukan perbaikan asupan</li>
            <li><span style="color:#D62839;font-weight:700;">Sangat Pendek</span> — Tinggi sangat rendah dan membutuhkan intervensi lebih lanjut</li>
          </ul>
        </div>
      </div>
      ${dashed}
      <!-- Grafik Tinggi Badan -->
      ${eyebrow('Grafik Tinggi Badan Berdasarkan Umur', 'bi-bar-chart-line-fill')}
      <div style="background:#F7F9FB;border-radius:14px;padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          <div style="font-size:11.5px;color:#2d465e;">Tinggi badan balita <strong>${data.diffLabel}</strong></div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:${chartImg ? '12px' : '0'};">
          <div style="font-size:10px;color:#8C97A3;">Median WHO (${data.clampedAge} bln): <strong style="color:#465a6b;">${data.medianAtAge} cm</strong></div>
          <div style="font-size:10px;color:#8C97A3;">Tinggi Balita: <strong style="color:#465a6b;">${data.actualHeightVal} cm</strong></div>
        </div>
        ${chartImg
      ? `<img src="${chartImg}" style="width:100%;border-radius:10px;background:#F7F9FB;page-break-inside:avoid;" />`
      : `<div style="text-align:center;padding:24px 12px;background:#F7F9FB;border-radius:10px;font-size:10px;color:#8C97A3;">Grafik belum tersedia untuk laporan ini.</div>`}
      </div>
      <div style="background:#F7F9FB;border-radius:12px;padding:12px 14px;margin-top:10px;font-size:9.5px;color:#5a6674;line-height:1.8;">
        <strong style="color:#2d465e;">Cara membaca grafik:</strong>
        Garis putus-putus abu-abu adalah <em>median WHO</em>, yaitu rata-rata tinggi badan balita sehat pada usia yang sama —
        dipakai sebagai acuan standar pertumbuhan. Garis merah (-3 SD) sampai hijau tua (+3 SD) menunjukkan rentang sebaran tinggi badan
        balita sehat pada umumnya; makin dekat atau di bawah garis merah, makin berisiko stunting. Titik/garis biru tua menunjukkan
        riwayat pengukuran dan tinggi badan balita saat ini.
      </div>
      ${data.gondok ? `
      <div style="text-align:center;background:${data.gondok.bg};border-radius:14px;padding:16px;margin-top:16px;">
        <div style="font-size:12px;font-weight:800;color:${data.gondok.color};line-height:1.3;text-transform:uppercase;letter-spacing:0.4px;">${data.gondok.title}</div>
        <div style="font-size:10px;color:#5a6674;line-height:1.7;margin-top:6px;text-align:justify;">${data.gondok.desc}</div>
      </div>` : ''}
      ${faktorSection}
      ${perbandinganBlock}
      ${dashed}
      <div style="text-align:center;">
        <img src="assets/img/LOGO.png" alt="StunTrack" style="height:20px;opacity:0.5;margin-bottom:6px;" />
        <div style="font-size:9px;color:#8C97A3;letter-spacing:0.3px;">Laporan ini dibuat otomatis oleh StunTrack untuk membantu pemantauan tumbuh kembang balita.</div>
      </div>
      </div>
    </div>
  `;
  let root = document.getElementById('pdf-receipt-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'pdf-receipt-root';
    document.body.appendChild(root);
  }
  root.innerHTML = receiptHtml;
  window.print();
  if (triggerBtn) {
    triggerBtn.disabled = false;
    triggerBtn.innerHTML = originalBtnHtml;
  }
}
