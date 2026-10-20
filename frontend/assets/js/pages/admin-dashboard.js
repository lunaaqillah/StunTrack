// ==========================================
// SECTION: Setup
// ==========================================
// Memeriksa sesi admin
(async function checkSession() {
  try {
    const res = await fetch('/api/admin/session');
    const data = await res.json();
    if (!data.logged_in) { window.location.href = 'admin-login.html'; return; }
    document.getElementById('adminEmailLabel').textContent = data.email;
    initDashboard();
  } catch (e) {
    window.location.href = 'admin-login.html';
  }
})();

document.getElementById('logoutBtn').addEventListener('click', async function () {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = 'admin-login.html';
});

// ==========================================
// SECTION: Overview
// ==========================================
// Menginisialisasi dashboard admin. Halaman disusun seperti landing page
// (satu halaman dengan page-break per section, bukan berganti halaman/tab),
// sehingga seluruh data ringkasan & segmentasi langsung dimuat bersamaan
// dan menu "Ringkasan" / "Analisis Segmentasi" hanya melakukan smooth-scroll
// ke section terkait (ditangani oleh scrollspy umum di assets/js/main.js
// lewat href="#tab-overview" / "#tab-segmentasi").
async function initDashboard() {
  await Promise.all([loadClusterProfile(), loadClusterInsights()]);
  renderInsightSection();
}

// ==========================================
// SECTION: Analisis Segmentasi - State
// ==========================================
const segmentasiState = {
  variables: [],
  clusters: [],
  hierarchicalProfiles: {},
  activeSegment: 'tinggi'
};

// Urutan tampilan tingkat risiko: Tinggi -> Sedang -> Rendah
const RISK_LEVEL_ORDER = { tinggi: 0, sedang: 1, rendah: 2 };

function sortByRiskLevel(clusters) {
  return [...clusters].sort((a, b) => {
    const oa = RISK_LEVEL_ORDER[a.level] ?? 99;
    const ob = RISK_LEVEL_ORDER[b.level] ?? 99;
    return oa - ob;
  });
}

// ==========================================
// SECTION: Profil Hierarkis Risiko
// ==========================================
// Hasil segmentasi resmi hanya 3 cluster: Tinggi, Sedang, Rendah.
const HIERARCHY_SEGMENTS = [
  'tinggi',
  'sedang',
  'rendah'
];

// accent = warna segmen (titik, ikon, bar); bg = tint latar; ink = versi lebih gelap
// dari accent untuk teks/garis tipis supaya tetap terbaca; on = warna teks/ikon di atas accent.
const HIERARCHY_META = {
  tinggi: {
    accent: '#BB3E03',
    bg: '#F3DCD2',
    ink: '#BB3E03',
    on: '#FFFFFF',
    icon: 'bi-exclamation-circle-fill',
    note: 'Segmen ini menunjukkan karakteristik variabel yang secara keseluruhan relatif lebih tinggi dibandingkan segmen lainnya, sehingga dapat menjadi prioritas dalam penentuan sasaran intervensi.'
  },
  sedang: {
    accent: '#EE9B00',
    bg: '#FCEDD1',
    ink: '#835500',
    on: '#212E48',
    icon: 'bi-circle-half',
    note: 'Segmen ini menunjukkan karakteristik variabel yang berada di antara segmen risiko tinggi dan rendah, sehingga perlu mendapat perhatian dalam upaya pencegahan agar risiko tidak meningkat.'
  },
  rendah: {
    accent: '#0A9396',
    bg: '#D3ECEC',
    ink: '#0A9396',
    on: '#FFFFFF',
    icon: 'bi-check-circle-fill',
    note: 'Segmen ini menunjukkan karakteristik variabel yang relatif lebih rendah dibandingkan segmen lainnya, sehingga dapat menjadi kelompok pemantauan dalam mempertahankan kondisi yang mendukung pencegahan stunting.'
  }
};

function escapeHierarchyHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadClusterInsights() {
  try {
    const res = await fetch('/api/admin/cluster-insights');
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Gagal memuat profiling.');
    }

    segmentasiState.hierarchicalProfiles = data.profiles || {};
    renderHierarchyTabs();
    renderHierarchicalProfile(segmentasiState.activeSegment);
  } catch (e) {
    document.getElementById('hierarchicalInsightContent').innerHTML =
      '<div class="empty-note">Gagal memuat profiling hierarkis.</div>';
  }
}

function renderHierarchyTabs() {
  const tabs = document.querySelectorAll('#riskSegmentTabs .risk-segment-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    const seg = tab.dataset.segment;

    tab.classList.toggle('active', seg === segmentasiState.activeSegment);
    tab.style.setProperty('--seg-accent', HIERARCHY_META[seg]?.accent || '#20303f');
    tab.style.setProperty('--seg-ink', HIERARCHY_META[seg]?.ink || '#20303f');
  });

  tabs.forEach(tab => {
    if (tab.dataset.bound === '1') return;
    tab.dataset.bound = '1';
    tab.addEventListener('click', () => {
      segmentasiState.activeSegment = tab.dataset.segment;
      renderHierarchyTabs();
      renderHierarchicalProfile(segmentasiState.activeSegment);
    });
  });
}

function renderHierarchicalProfile(segment) {
  const profile = segmentasiState.hierarchicalProfiles[segment];
  const meta = HIERARCHY_META[segment] || HIERARCHY_META.sedang;
  const container = document.getElementById('hierarchicalInsightContent');
  if (!container) {
    console.warn('Elemen #hierarchicalInsightContent belum tersedia di HTML.');
    return;
  }

  if (!profile) {
    container.innerHTML = '<div class="empty-note">Profil segmen belum tersedia.</div>';
    return;
  }

  const topVariables = profile.top_variables || [];

  // Bagian "Fokus Permasalahan": ringkasan label 3 variabel paling menonjol.
  const focusTags = topVariables.map(v => `
    <span class="focus-tag">
      <span class="focus-tag-code">${escapeHierarchyHtml(v.code)}</span>
      ${escapeHierarchyHtml(v.label)}
    </span>
  `).join('');

  const variableCards = topVariables.map((v, index) => renderVariableRecCard({
    rank: index + 1,
    accent: meta.accent,
    bg: meta.bg,
    ink: meta.ink,
    code: v.code,
    title: v.label,
    percentage: v.percentage,
    implikasi: v.implikasi,
    rekomendasi: v.rekomendasi,
    sasaran: v.sasaran
  })).join('');

  // Indikator & item utama: hanya diambil dari variabel prioritas #1 pada
  // segmen ini (bukan satu kartu per masing-masing 3 variabel teratas),
  // lalu ditampilkan berdampingan dalam satu baris: item di kiri, indikator
  // di kanan.
  const topVariable = topVariables[0];
  const topIndicator = topVariable?.top_indicator;
  const topItem = topIndicator?.top_item;

  const itemCard = (topIndicator && topItem) ? renderRecCard({
    rank: 1,
    accent: meta.accent,
    bg: meta.bg,
    ink: meta.ink,
    code: topItem.code,
    title: topItem.question,
    titleClass: 'rc-title-question',
    percentage: topItem.percentage,
    implikasi: topItem.implikasi,
    rekomendasi: topItem.rekomendasi,
    footLabel: 'Bagian dari indikator',
    footValue: `${topIndicator.code} · ${topIndicator.label}`
  }) : '';

  const indicatorCard = topIndicator ? renderRecCard({
    rank: 1,
    accent: meta.accent,
    bg: meta.bg,
    ink: meta.ink,
    code: topIndicator.code,
    title: topIndicator.label,
    percentage: topIndicator.percentage,
    implikasi: topIndicator.implikasi,
    rekomendasi: topIndicator.rekomendasi,
    footLabel: 'Bagian dari variabel',
    footValue: topVariable ? `${topVariable.code} · ${topVariable.label}` : ''
  }) : '';

  container.innerHTML = `
    <div class="hierarchy-overview" style="--seg-accent:${meta.accent};--seg-bg:${meta.bg};--seg-ink:${meta.ink};--seg-on:${meta.on};">
      <div class="hierarchy-overview-icon"><i class="bi ${meta.icon}"></i></div>
      <div>
        <h3>${escapeHierarchyHtml(profile.label)}</h3>
        <p>${escapeHierarchyHtml(meta.note)}</p>
      </div>
      <div class="hierarchy-total">
        <strong>${Number(profile.percentage_of_total).toFixed(2)}%</strong>
      </div>
    </div>

    <div class="focus-issues" style="--seg-accent:${meta.accent};--seg-bg:${meta.bg};--seg-ink:${meta.ink};--seg-on:${meta.on};">
      <div class="focus-issues-head">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span>Temuan Utama</span>
      </div>
      <div class="focus-issues-tags">
        ${focusTags}
      </div>
    </div>

    <div class="rec-section">
      <div class="hierarchy-section-head">
        <div>
          <span>01</span>
          <div>
            <h4>Prioritas Variabel</h4>
            <p>Variabel yang menjadi fokus utama berdasarkan karakteristik dan hasil analisis pada segmen risiko.</p>
          </div>
        </div>
      </div>
      <div class="rec-grid">
        ${variableCards}
      </div>
    </div>

    <div class="rec-section-dual">
      <div class="rec-subgroup">
        <div class="hierarchy-section-head">
          <div>
            <span>02</span>
            <div>
              <h4>Prioritas Indikator</h4>
              <p>Indikator yang menjadi fokus utama dalam variabel prioritas berdasarkan hasil analisis pada segmen.</p>
            </div>
          </div>
        </div>
        <div class="rec-grid rec-grid-single">
          ${indicatorCard}
        </div>
      </div>

      <div class="rec-subgroup">
        <div class="hierarchy-section-head">
          <div>
            <span>03</span>
            <div>
              <h4>Prioritas Item</h4>
              <p>Item yang merepresentasikan aspek spesifik dari indikator prioritas sebagai fokus penanganan.</p>
            </div>
          </div>
        </div>
        <div class="rec-grid rec-grid-single">
          ${itemCard}
        </div>
      </div>
    </div>

  `;
}

// Format persentase dengan koma desimal ala Indonesia (mis. 91,24%).
function formatPercentId(value) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return pct.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Blok label + isi (dipakai ulang oleh kartu variabel maupun kartu
// indikator/item) supaya bentuk visual "Implikasi" & "Rekomendasi"
// konsisten sepanjang rantai hierarki.
function renderRecBlock(label, content, ink) {
  return `
    <div class="rec-card-block">
      <span class="rec-card-block-label" style="color:${ink};">${escapeHierarchyHtml(label)}</span>
      <p class="rec-card-block-text">${escapeHierarchyHtml(content || '—')}</p>
    </div>
  `;
}

// Kartu rekomendasi dipakai untuk level indikator & item: Implikasi (makna
// kondisi tersebut, menyebut nama indikator/variabel terkait) diikuti
// Rekomendasi (tindak lanjut yang disarankan), diakhiri footer yang
// menunjukkan induknya dalam rantai hierarki (variabel/indikator).
function renderRecCard({ rank, accent, bg, ink, code, title, percentage, implikasi, rekomendasi, footLabel, footValue, titleClass }) {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  return `
    <article class="rec-card">
      <div class="rec-card-rank" style="background:${bg};color:${ink};">0${rank}</div>
      <div class="rec-card-body">
        <div class="rec-card-head">
          <span class="rec-card-code">${escapeHierarchyHtml(code || '—')}</span>
          <span class="rec-card-pct" style="color:${ink};">${formatPercentId(pct)}%</span>
        </div>
        <h5 class="${titleClass || ''}">${escapeHierarchyHtml(title || '—')}</h5>
        <div class="rec-card-progress-track">
          <div class="rec-card-progress-fill" style="width:${pct}%;background:${accent};"></div>
        </div>
        ${renderRecBlock('Implikasi', implikasi, ink)}
        ${renderRecBlock('Rekomendasi', rekomendasi, ink)}
        ${footValue ? `
          <div class="rec-card-foot">
            <i class="bi bi-arrow-return-right"></i>
            <span><strong>${escapeHierarchyHtml(footLabel)}:</strong> ${escapeHierarchyHtml(footValue)}</span>
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

// Kartu rekomendasi khusus level variabel: Implikasi (makna kondisi
// tersebut, sudah menyebut nama variabelnya secara eksplisit di kalimat
// pembuka) dan Rekomendasi (tindak lanjut yang disarankan), diakhiri
// dengan Sasaran di bagian footer — supaya alurnya jelas: apa hasilnya ->
// apa artinya -> apa tindak lanjutnya.
function renderVariableRecCard({ rank, accent, bg, ink, code, title, percentage, implikasi, rekomendasi, sasaran }) {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  return `
    <article class="rec-card rec-card--variable">
      <div class="rec-card-rank" style="background:${bg};color:${ink};">0${rank}</div>
      <div class="rec-card-body">
        <div class="rec-card-head">
          <span class="rec-card-code">${escapeHierarchyHtml(code || '—')}</span>
          <span class="rec-card-pct" style="color:${ink};">${formatPercentId(pct)}%</span>
        </div>
        <h5>${escapeHierarchyHtml(title || '—')}</h5>
        <div class="rec-card-progress-track">
          <div class="rec-card-progress-fill" style="width:${pct}%;background:${accent};"></div>
        </div>
        ${renderRecBlock('Implikasi', implikasi, ink)}
        ${renderRecBlock('Rekomendasi', rekomendasi, ink)}
        <div class="rec-card-foot">
          <i class="bi bi-arrow-return-right"></i>
          <span><strong>Sasaran:</strong> ${escapeHierarchyHtml(sasaran || '—')}</span>
        </div>
      </div>
    </article>
  `;
}

// ==========================================
// SECTION: Ringkasan Segmentasi
// ==========================================
async function loadClusterProfile() {
  try {
    const res = await fetch('/api/admin/cluster-profile');
    const d = await res.json();

    if (!res.ok || d.error) {
      throw new Error(d.error || 'Gagal memuat ringkasan cluster.');
    }

    segmentasiState.variables = d.variables || [];
    segmentasiState.clusters = sortByRiskLevel(d.clusters || []);

    renderClusterSummaryCards();
  } catch (e) {
    const el = document.getElementById('clusterSummaryCards');
    if (el) {
      el.innerHTML =
        '<div class="empty-note">Gagal memuat ringkasan segmentasi.</div>';
    }
    console.error('loadClusterProfile:', e);
  }
}

// Kartu ringkasan jumlah responden per tingkat risiko
function renderClusterSummaryCards() {
  const total = segmentasiState.clusters.reduce(
    (sum, c) => sum + Number(c.n || 0),
    0
  );

  const cards = [`
    <div class="stat-card">
      <div class="stat-label">Total Responden</div>
      <div class="stat-value">${total.toLocaleString('id-ID')} responden</div>
      <div class="stat-sub">Seluruh data responden penelitian</div>
    </div>
  `];

  const riskDescription = {
    tinggi: 'Prioritas intervensi',
    sedang: 'Pencegahan peningkatan risiko',
    rendah: 'Pemantauan berkala'
  };

  segmentasiState.clusters.forEach(c => {
    const n = Number(c.n || 0);
    const pct = total > 0 ? (n / total) * 100 : 0;

    cards.push(`
      <div class="stat-card risk-${escapeHierarchyHtml(c.level)}">
        <div class="stat-label">Risiko ${escapeHierarchyHtml(c.label)}</div>
        <div class="stat-value">${n.toLocaleString('id-ID')} responden</div>
        <div class="stat-sub">
          ${pct.toFixed(2)}% · ${riskDescription[c.level] || ''}
        </div>
      </div>
    `);
  });

  const el = document.getElementById('clusterSummaryCards');
  if (el) el.innerHTML = cards.join('');

  renderRiskDistributionChart(total);
}

// ==========================================
// SECTION: Pie Chart Distribusi Risiko Stunting (Chart.js)
// ==========================================
// Warna irisan mengikuti warna titik pada kartu ringkasan (lihat CSS
// .risk-summary-cards), supaya kartu dan pie chart terbaca sebagai satu kesatuan.
const RISK_SUMMARY_COLORS = {
  tinggi: '#BB3E03',
  sedang: '#EE9B00',
  rendah: '#0A9396'
};

let riskDistributionChart = null;

// Plugin kecil (tanpa dependensi tambahan) untuk menampilkan persentase
// di LUAR irisan pie, tepat di sisi tengah busur masing-masing irisan.
const riskOutsideLabelPlugin = {
  id: 'riskOutsideLabels',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    const values = chart.data.datasets[0].data.map(v => Number(v) || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    if (!sum) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.font = '700 12px Poppins, sans-serif';
    ctx.fillStyle = '#212E48';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    meta.data.forEach((arc, i) => {
      if (!values[i] || arc.hidden) return;
      const angle = (arc.startAngle + arc.endAngle) / 2;
      const radius = arc.outerRadius + 24;
      const x = arc.x + Math.cos(angle) * radius;
      const y = arc.y + Math.sin(angle) * radius;
      ctx.fillText(`${((values[i] / sum) * 100).toFixed(2)}%`, x, y);
    });

    ctx.restore();
  }
};

function renderRiskDistributionChart(total) {
  const canvas = document.getElementById('riskDistributionChart');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js belum termuat; pie chart tidak dapat ditampilkan.');
    return;
  }

  const clusters = segmentasiState.clusters;

  if (riskDistributionChart) {
    riskDistributionChart.destroy();
    riskDistributionChart = null;
  }

  riskDistributionChart = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      // Urutan mengikuti kartu ringkasan: Tinggi -> Sedang -> Rendah
      labels: clusters.map(c => `Risiko Stunting ${c.label}`),
      datasets: [{
        data: clusters.map(c => Number(c.n || 0)),
        backgroundColor: clusters.map(c => RISK_SUMMARY_COLORS[c.level] || '#CBD2DC'),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Padding kiri-kanan lebih lega karena label persentase digambar di luar pie.
      layout: { padding: { top: 26, bottom: 26, left: 46, right: 46 } },
      // Pada layar HP (breakpoint sama dengan CSS: <= 520px), legend dipindah
      // ke bawah agar pie tidak mengecil.
      onResize(chart) {
        const pos = window.matchMedia('(max-width: 520px)').matches ? 'bottom' : 'right';
        if (chart.options.plugins.legend.position !== pos) {
          chart.options.plugins.legend.position = pos;
          chart.update('none');
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 14,
            color: '#212E48',
            font: { family: 'Poppins, sans-serif', size: 12, weight: '500' }
          }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const n = Number(ctx.parsed) || 0;
              const pct = total > 0 ? (n / total) * 100 : 0;
              return ` ${n.toLocaleString('id-ID')} responden (${pct.toFixed(2)}%)`;
            }
          }
        }
      }
    },
    plugins: [riskOutsideLabelPlugin]
  });
}

// ==========================================
// SECTION: Insight - Prioritas dan Rekomendasi Intervensi
// ==========================================
// Kesimpulan singkat & rekomendasi untuk keseluruhan responden Kecamatan
// Wajak, ditampilkan di menu "Insights". Rekomendasi disusun sebagai sintesis
// lintas cluster (bukan salinan rekomendasi satu variabel): Pola Asuh (X3)
// dominan di Risiko Tinggi dan Sedang sehingga dijadikan intervensi bersama,
// lalu aspek khas tiap cluster (X10 pada Risiko Tinggi, X6 dan X8 pada Risiko
// Sedang) dan aspek yang dipertahankan pada kelompok pemantauan (X1, X4, X7
// pada Risiko Rendah). Narasinya mengacu pada teks di SEGMENT_OVERRIDE_TEXTS
// (backend/routes/admin/dashboard_analytics.py); jika hasil klasterisasi
// berubah, sesuaikan teks di bawah ini.
const PRIORITY_SEGMENTS = ['tinggi', 'sedang', 'rendah'];

function renderInsightSection() {
  const container = document.getElementById('insightContent');
  if (!container) return;

  const profiles = segmentasiState.hierarchicalProfiles || {};
  const hasProfiles = PRIORITY_SEGMENTS.every(seg => profiles[seg]);

  if (!hasProfiles) {
    container.innerHTML = '<div class="empty-note">Kesimpulan dan rekomendasi belum tersedia.</div>';
    return;
  }

  const recs = [
    {
      title: 'Mengutamakan pendampingan pada segmen prioritas',
      text: 'Pendampingan sebaiknya dimulai dari segmen Risiko Tinggi, dilanjutkan pada segmen Risiko Sedang. Segmen Risiko Tinggi memerlukan penanganan paling awal karena memiliki tingkat risiko tertinggi, sedangkan segmen Risiko Sedang perlu dijaga agar tidak meningkat menjadi risiko tinggi.'
    },
    {
      title: 'Memperkuat pola asuh pada kedua segmen prioritas',
      text: 'Pola Asuh menjadi karakteristik dominan pada segmen Risiko Tinggi dan Risiko Sedang. Pendampingan diarahkan pada peningkatan keterlibatan orang tua saat anak makan, perhatian terhadap kecukupan porsi, serta penerapan aturan makan yang konsisten. Pada segmen Risiko Tinggi, penguatan tersebut perlu disertai pengelolaan sumber daya ekonomi keluarga, terutama pengaturan pengeluaran dan pemenuhan kebutuhan pokok, agar kebutuhan pangan dan gizi anak tetap terpenuhi.'
    },
    {
      title: 'Memfokuskan pada aspek spesifik pada tiap segmen prioritas',
      text: 'Pada segmen Risiko Tinggi, intervensi difokuskan pada Status Gizi Anak, meliputi kualitas dan keseimbangan menu, asupan vitamin, frekuensi makan, dan kecukupan porsi, dengan kandungan gizi menu sebagai aspek yang paling dominan. Pada segmen Risiko Sedang, fokus diarahkan pada Status Gizi Orang Tua, terutama keseimbangan menu, kandungan gizi, dan konsumsi makanan sumber vitamin secara rutin. Fokus lainnya adalah Peran Pemerintah Daerah melalui keberlanjutan edukasi, program pencegahan, serta peningkatan kualitas sanitasi dan ketersediaan air minum.'
    },
    {
      title: 'Mempertahankan capaian pada kelompok pemantauan',
      text: 'Pada segmen Risiko Rendah, upaya diarahkan untuk mempertahankan pengetahuan ibu mengenai stunting dan gizi, khususnya pemahaman tentang dampak kekurangan gizi jangka panjang terhadap stunting, serta kualitas layanan kesehatan dan praktik sanitasi lingkungan rumah tangga.'
    }
  ];

  container.innerHTML = `
    <div class="insight-body">
      <div class="insight-block">
        <header class="insight-head"><h5>Kesimpulan</h5></header>
        <p class="insight-prose">
          Hasil segmentasi mengidentifikasi tiga kelompok karakteristik risiko 
          stunting dengan kebutuhan penanganan yang berbeda. Kelompok Risiko Tinggi 
          menjadi prioritas intervensi, kelompok Risiko Sedang menjadi sasaran pencegahan 
          agar risiko tidak bergeser ke tingkat yang lebih tinggi, sedangkan kelompok Risiko 
          Rendah menjadi fokus pemantauan serta pemeliharaan kondisi yang telah relatif baik.
        </p>
      </div>

      <div class="insight-block">
        <header class="insight-head"><h5>Rekomendasi</h5></header>
        <ol class="insight-recs">
          ${recs.map(r => `
            <li>
              <div>
                <h6 class="insight-rec-title">${escapeHierarchyHtml(r.title)}</h6>
                <p class="insight-rec-text">${escapeHierarchyHtml(r.text)}</p>
              </div>
            </li>`).join('')}
        </ol>
      </div>
    </div>
  `;
}
