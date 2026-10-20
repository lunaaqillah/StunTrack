// ==========================================
// SECTION: Initialization
// ==========================================
(function() {
  "use strict";
  // Mengubah scrolled
  function toggleScrolled() {
    const selectBody = document.querySelector('body');
    const selectHeader = document.querySelector('#header');
    if (!selectBody || !selectHeader) return;
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');
  // Mengatur navigasi mobile
  function mobileNavToogle() {
    document.querySelector('body').classList.toggle('mobile-nav-active');
    mobileNavToggleBtn.classList.toggle('bi-list');
    mobileNavToggleBtn.classList.toggle('bi-x');
  }
  if (mobileNavToggleBtn) {
    mobileNavToggleBtn.addEventListener('click', mobileNavToogle);
  }

  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', () => {
      if (document.querySelector('.mobile-nav-active')) {
        mobileNavToogle();
      }
    });

  });

  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function(e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      e.stopImmediatePropagation();
    });
  });

  let scrollTop = document.querySelector('.scroll-top');
  // Mengubah scroll top
  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  if (scrollTop) {
    scrollTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  window.addEventListener('load', toggleScrollTop);
  document.addEventListener('scroll', toggleScrollTop);
  // Menginisialisasi animasi AOS
  function aosInit() {
    if (typeof AOS === 'undefined') return;
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', aosInit);

  document.querySelectorAll('.faq-item h3, .faq-item .faq-toggle').forEach((faqItem) => {
    faqItem.addEventListener('click', () => {
      faqItem.parentNode.classList.toggle('faq-active');
    });
  });

  window.addEventListener('load', function(e) {
    if (window.location.hash) {
      if (document.querySelector(window.location.hash)) {
        setTimeout(() => {
          let section = document.querySelector(window.location.hash);
          let scrollMarginTop = getComputedStyle(section).scrollMarginTop;
          window.scrollTo({
            top: section.offsetTop - parseInt(scrollMarginTop),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  });

  let navmenulinks = document.querySelectorAll('.navmenu a');
  // Memperbarui status navigasi saat scroll
  function navmenuScrollspy() {
    navmenulinks.forEach(navmenulink => {
      if (!navmenulink.hash) return;
      let section = document.querySelector(navmenulink.hash);
      if (!section) return;
      let position = window.scrollY + 200;
      if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
        document.querySelectorAll('.navmenu a.active').forEach(link => link.classList.remove('active'));
        navmenulink.classList.add('active');
      } else {
        navmenulink.classList.remove('active');
      }
    })
  }
  window.addEventListener('load', navmenuScrollspy);
  document.addEventListener('scroll', navmenuScrollspy);

})();

  let currentDateInput = null;
  let currentDate = new Date();

// ==========================================
// SECTION: Date & Formatting
// ==========================================
function parseDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;

  const value = dateString.trim();
  if (!value) return null;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (isoMatch) {
    return createValidDate(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const indoMatch = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(value);
  if (indoMatch) {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthIndex = monthNames.findIndex(
      month => month.toLowerCase() === indoMatch[2].toLowerCase()
    );
    if (monthIndex !== -1) {
      return createValidDate(Number(indoMatch[3]), monthIndex, Number(indoMatch[1]));
    }
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(value);
  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? 2000 + Number(slashMatch[3]) : Number(slashMatch[3]);
    return createValidDate(year, Number(slashMatch[2]) - 1, Number(slashMatch[1]));
  }

  return null;
}

function createValidDate(year, month, day) {
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatTanggalIndo(dateInput) {
  if (!dateInput || dateInput === 'N/A') return 'N/A';

  const date = dateInput instanceof Date ? dateInput : parseDate(String(dateInput));
  if (!date || Number.isNaN(date.getTime())) return dateInput;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

// ==========================================
// SECTION: Datepicker
// ==========================================
function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDatepickerElements() {
  return {
    modal: document.getElementById('datepicker-modal'),
    overlay: document.getElementById('datepicker-overlay'),
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    monthSelect: document.getElementById('datepicker-month'),
    yearSelect: document.getElementById('datepicker-year'),
    days: document.getElementById('datepicker-days'),
    cancel: document.getElementById('datepicker-cancel')
  };
}

function clampCurrentDateToToday() {
  const today = getToday();
  const firstAllowedDate = new Date(1900, 0, 1);
  const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  if (currentMonth < firstAllowedDate) {
    currentDate = firstAllowedDate;
  } else if (currentMonth > new Date(today.getFullYear(), today.getMonth(), 1)) {
    currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }
}

function showDatepicker(input) {
  if (!input) return;

  const elements = getDatepickerElements();
  if (!elements.modal) return;

  currentDateInput = input;
  currentDate = parseDate(input.value) || getToday();
  clampCurrentDateToToday();
  renderCalendar();

  elements.modal.style.display = 'block';
  requestAnimationFrame(() => elements.modal.classList.add('show'));
  document.body.classList.add('datepicker-open');
}

function hideDatepicker() {
  const elements = getDatepickerElements();
  if (!elements.modal) return;

  elements.modal.classList.remove('show');
  elements.modal.style.display = 'none';
  currentDateInput = null;
  document.body.classList.remove('datepicker-open');
}

function renderCalendar() {
  const elements = getDatepickerElements();
  if (!elements.monthSelect || !elements.yearSelect || !elements.days) return;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const today = getToday();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  clampCurrentDateToToday();

  elements.monthSelect.innerHTML = '';
  monthNames.forEach((month, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = month;
    option.selected = index === currentDate.getMonth();
    option.disabled = currentDate.getFullYear() === currentYear && index > currentMonth;
    elements.monthSelect.appendChild(option);
  });

  elements.yearSelect.innerHTML = '';
  for (let year = currentYear; year >= 1900; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    option.selected = year === currentDate.getFullYear();
    elements.yearSelect.appendChild(option);
  }

  elements.days.innerHTML = '';

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const selectedDate = currentDateInput ? parseDate(currentDateInput.value) : null;
  const leadingDays = firstDay.getDay();
  const totalCells = 42;

  for (let index = leadingDays - 1; index >= 0; index--) {
    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), -index);
    appendDayElement(elements.days, day, true);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const isDisabled = date > today;
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
    const isToday = date.toDateString() === today.toDateString();
    appendDayElement(elements.days, date, isDisabled, isSelected, isToday);
  }

  const renderedCells = leadingDays + lastDay.getDate();
  for (let day = 1; renderedCells + day <= totalCells; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
    appendDayElement(elements.days, date, true);
  }
}

function appendDayElement(container, date, disabled = false, selected = false, today = false) {
  const dayElement = document.createElement('button');
  dayElement.type = 'button';
  dayElement.className = 'day';
  dayElement.textContent = date.getDate();
  dayElement.setAttribute('aria-label', formatTanggalIndo(date));

  if (disabled) {
    dayElement.classList.add('disabled');
    dayElement.disabled = true;
  } else {
    dayElement.addEventListener('click', () => {
      if (!currentDateInput) return;
      currentDateInput.value = formatTanggalIndo(date);
      currentDateInput.dispatchEvent(new Event('input', { bubbles: true }));
      currentDateInput.dispatchEvent(new Event('change', { bubbles: true }));
      hideDatepicker();
    });
  }

  if (selected) dayElement.classList.add('selected');
  if (today) dayElement.classList.add('today');

  container.appendChild(dayElement);
}

function initializeDatepicker() {
  const elements = getDatepickerElements();
  if (!elements.modal || !elements.overlay || !elements.prevMonth || !elements.nextMonth ||
      !elements.monthSelect || !elements.yearSelect || !elements.days || !elements.cancel) {
    return;
  }

  document.addEventListener('click', event => {
    const input = event.target.closest('.date-input');
    const icon = event.target.closest('.input-group-text');
    if (!input && !icon) return;

    const dateInput = input || icon.closest('.input-group')?.querySelector('.date-input');
    if (dateInput) {
      event.preventDefault();
      showDatepicker(dateInput);
    }
  });

  elements.prevMonth.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    clampCurrentDateToToday();
    renderCalendar();
  });

  elements.nextMonth.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    clampCurrentDateToToday();
    renderCalendar();
  });

  elements.monthSelect.addEventListener('change', event => {
    currentDate = new Date(currentDate.getFullYear(), Number(event.target.value), 1);
    clampCurrentDateToToday();
    renderCalendar();
  });

  elements.yearSelect.addEventListener('change', event => {
    currentDate = new Date(Number(event.target.value), currentDate.getMonth(), 1);
    clampCurrentDateToToday();
    renderCalendar();
  });

  elements.cancel.addEventListener('click', hideDatepicker);
  elements.overlay.addEventListener('click', hideDatepicker);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && elements.modal.classList.contains('show')) {
      hideDatepicker();
    }
  });
}

document.addEventListener('DOMContentLoaded', initializeDatepicker);
  // Memformat nilai kontribusi
  function formatKontribusi(v) {
    return (v >= 0 ? '+' : '') + v.toFixed(3);
  }

// ==========================================
// SECTION: Stunting Classification
// ==========================================
  // Mengklasifikasikan status pertumbuhan
  function classifyStunting(status) {
    const s = (status || '').toString().trim().toLowerCase();
    if (s === 'normal') return 'normal';
    if (s === 'pendek') return 'pendek';
    if (s === 'sangat pendek') return 'sangat';
    return 'unknown';
  }

// ==========================================
// SECTION: Risk Factor Rendering
// ==========================================
  // Membangun faktor card html
  function buildFaktorCardHTML(varData, arah, kontribusiLabel) {
    const exp = explanations[varData.variable];
    if (!exp) return '';
    const label = kontribusiLabel || 'Kontribusi';
    const isNaik = arah === 'naik';
    const borderColor = isNaik ? '#F3D2D4' : '#BFE8CC';
    const iconBg = isNaik ? '#FBE6E6' : '#E5F7EA';
    const iconColor = isNaik ? '#D62839' : '#1FA454';
    const iconClass = isNaik ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow';
    const desc = isNaik ? exp.berpengaruh : exp.tidak;
    return `
      <div class="h-100 rounded-4 d-flex flex-column" style="background: #ffffff; border: 1px solid ${borderColor}; padding: 1.5rem; box-shadow: 0 6px 18px -12px rgba(30,40,60,0.18);">
        <div class="d-flex align-items-center mb-3">
          <span class="d-inline-flex align-items-center justify-content-center me-2 flex-shrink-0" style="width:38px;height:38px;border-radius:10px;background:${iconBg};">
            <i class="bi ${iconClass}" style="color:${iconColor};font-size:1.05rem;"></i>
          </span>
          <h5 class="mb-0" style="color:#2d465e;font-weight:700;font-size:1.02rem;">${exp.name}</h5>
        </div>
        <p class="mb-3" style="color:#5a6674; font-size:0.92rem; line-height:1.55;">${desc}</p>
        <div class="mt-auto d-flex flex-wrap gap-2">
          <span class="badge rounded-pill" style="background:${iconBg};color:${iconColor};font-size:0.72rem;font-weight:600;padding:0.4em 0.9em;font-variant-numeric:tabular-nums;">${label}: ${formatKontribusi(varData.kontribusi)}</span>
        </div>
      </div>
    `;
  }
  // Membangun faktor row html
  function buildFaktorRowHTML(list, arah, extraClass, rowId, kontribusiLabel) {
    const idAttr = rowId ? ` id="${rowId}"` : '';
    return `<div${idAttr} class="faktor-grid${extraClass ? ' ' + extraClass : ''}">` +
      list.map(varData => buildFaktorCardHTML(varData, arah, kontribusiLabel)).join('') +
      '</div>';
  }
  // Membangun faktor heading html
  function buildFaktorHeadingHTML(text, marginTopClass) {
    const mt = marginTopClass || 'mt-4';
    return `
      <div class="d-flex align-items-center justify-content-center mb-4 ${mt}">
        <h4 class="mb-0 u-ff-Mont-HeavyDEMO-var-headi" style="color: #2d465e; font-weight: 700;">${text}</h4>
      </div>`;
  }
  // Membangun faktor empty note html
  function buildFaktorEmptyNoteHTML(text) {
    return `
      <div class="text-center py-4 px-3 rounded-4 mb-2" style="background:#F7F9FB;border:1px dashed #C9D3DC;">
        <i class="bi bi-info-circle" style="color:#8C97A3;font-size:1.3rem;"></i>
        <p class="mb-0 mt-2" style="color:#5a6674;font-size:0.92rem;">${text}</p>
      </div>`;
  }
  // Membangun faktor lihat lainnya html
  function buildFaktorLihatLainnyaHTML(extraId, count) {
    return `
      <div class="text-center mt-3">
        <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" data-shared-action="toggle-faktor-extra" data-target-id="${extraId}" data-count="${count}">
          <i class="bi bi-chevron-down me-1"></i>Lihat ${count} Faktor Lainnya
        </button>
      </div>`;
  }
  // Menangani split faktor risiko stunting
  function splitFaktorRisiko(semuaKontribusi) {
    const influentialAll = semuaKontribusi.filter(k => k.kontribusi > 0).sort((a, b) => b.kontribusi - a.kontribusi);
    const nonInfluentialAll = semuaKontribusi.filter(k => k.kontribusi < 0).sort((a, b) => a.kontribusi - b.kontribusi);
    return {
      influentialAll,
      nonInfluentialAll,
      influential: influentialAll.slice(0, 3),
      nonInfluential: nonInfluentialAll.slice(0, 3),
      influentialExtra: influentialAll.slice(3),
      nonInfluentialExtra: nonInfluentialAll.slice(3)
    };
  }
  // Membangun faktor direction html
  function buildFaktorDirectionHTML(top3, extra, arah, extraId, kontribusiLabel, headingText, emptyText, headingMarginTop) {
    let html = buildFaktorHeadingHTML(headingText, headingMarginTop);
    if (top3.length === 0) {
      html += buildFaktorEmptyNoteHTML(emptyText);
    } else {
      html += buildFaktorRowHTML(top3, arah, null, null, kontribusiLabel);
      if (extra.length > 0) {
        html += buildFaktorRowHTML(extra, arah, 'faktor-extra-row d-none', extraId, kontribusiLabel);
        html += buildFaktorLihatLainnyaHTML(extraId, extra.length);
      }
    }
    return html;
  }
  // Menginisialisasi tooltip
  function initTooltips(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
      if (typeof bootstrap !== 'undefined' && !bootstrap.Tooltip.getInstance(el)) {
        new bootstrap.Tooltip(el);
      }
    });
  }

// ==========================================
// SECTION: Age Utilities
// ==========================================
  // Menghitung usia dalam bulan
  function ageInMonthsFromDates(birthDateStr, measureDateStr) {
    const birth = new Date(birthDateStr);
    const measure = new Date(measureDateStr);
    if (isNaN(birth) || isNaN(measure)) return null;
    let months = (measure.getFullYear() - birth.getFullYear()) * 12 + (measure.getMonth() - birth.getMonth());
    return Math.max(0, Math.min(60, months));
  }

// ==========================================
// SECTION: Reference Data
// ==========================================
  // Mengambil growth reference
  function fetchGrowthReference() {
    return fetch('/prediksi/growth-reference')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        growthReferenceData = data;
        return data;
      })
      .catch(err => {
        console.error("Gagal mengambil growth reference dari backend:", err);
        growthReferenceData = null;
        return null;
      });
  }
  // Mengambil faktor risiko stunting explanations
  function fetchFaktorRisikoExplanations() {
    return fetch('/prediksi/faktor-risiko-explanations')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        explanations = data;
        return data;
      })
      .catch(err => {
        console.error("Gagal mengambil penjelasan faktor risiko stunting dari backend:", err);
        explanations = {};
        return null;
      });
  }

// ==========================================
// SECTION: Growth Reference Calculations
// ==========================================
  // Menginterpolasi data referensi pertumbuhan
  function interpolateGrowthField(gender, month, field) {
    const source = growthReferenceData;
    if (!source) return null;
    const data = source[gender] || source["Laki-laki"];
    if (!data || data.length === 0) return null;
    const m = Math.max(0, Math.min(60, month));
    for (let i = 0; i < data.length - 1; i++) {
      if (m >= data[i].m && m <= data[i + 1].m) {
        const a = data[i][field], b = data[i + 1][field];
        if (a == null || b == null) return null;
        const t = (m - data[i].m) / ((data[i + 1].m - data[i].m) || 1);
        return a + t * (b - a);
      }
    }
    const last = data[data.length - 1];
    return last[field] != null ? last[field] : null;
  }
  // Mengambil median tinggi referensi
  function getMedianHeight(gender, month) {
    const source = growthReferenceData;
    if (!source) return null;
    const data = source[gender] || source["Laki-laki"];
    if (!data || data.length === 0) return null;
    const m = Math.max(0, Math.min(60, month));
    for (let i = 0; i < data.length - 1; i++) {
      if (m >= data[i].m && m <= data[i + 1].m) {
        const t = (m - data[i].m) / ((data[i + 1].m - data[i].m) || 1);
        return data[i].h + t * (data[i + 1].h - data[i].h);
      }
    }
    return data[data.length - 1].h;
  }
  // Mengambil nilai standar deviasi referensi
  function getSDValue(gender, month) {
    const sd = interpolateGrowthField(gender, month, 'sd');
    if (sd != null) return sd;
    const median = getMedianHeight(gender, month);
    return median != null ? median * 0.04 : null;
  }
  // Menghitung z-score tinggi badan
  function getZScoreHeight(gender, month, z) {
    if (z === 0) return getMedianHeight(gender, month);
    const direct = interpolateGrowthField(gender, month, `z${z}`);
    if (direct != null) return direct;
    const median = getMedianHeight(gender, month);
    const sdValue = getSDValue(gender, month);
    if (median == null || sdValue == null) return null;
    return median + z * sdValue;
  }

// ==========================================
// SECTION: Growth Chart
// ==========================================
  // Membangun dataset referensi pertumbuhan WHO
  function buildWhoGrowthReferenceDatasets(genderKey) {
    const allMonths = [];
    for (let m = 0; m <= 60; m++) allMonths.push(m);
    const labels = allMonths.map(m => `${m}`);
    const medianData = allMonths.map(m => Math.round(getMedianHeight(genderKey, m) * 10) / 10);
    // Membulatkan nilai z-score
    const roundZ = (m, z) => Math.round(getZScoreHeight(genderKey, m, z) * 10) / 10;
    const sdMinus3 = allMonths.map(m => roundZ(m, -3));
    const sdMinus2 = allMonths.map(m => roundZ(m, -2));
    const sdMinus1 = allMonths.map(m => roundZ(m, -1));
    const sdPlus1 = allMonths.map(m => roundZ(m, 1));
    const sdPlus2 = allMonths.map(m => roundZ(m, 2));
    const sdPlus3 = allMonths.map(m => roundZ(m, 3));
    return {
      allMonths,
      labels,
      datasets: [
        { label: '-3 SD', data: sdMinus3, borderColor: 'rgba(214,40,57,0.45)', borderWidth: 1.25, pointRadius: 0, fill: false, tension: 0.35, order: 2 },
        { label: '-2 SD', data: sdMinus2, borderColor: 'rgba(240,140,28,0.45)', borderWidth: 1.25, pointRadius: 0, fill: false, tension: 0.35, order: 2 },
        { label: '-1 SD', data: sdMinus1, borderColor: 'rgba(232,185,58,0.45)', borderWidth: 1.25, pointRadius: 0, fill: false, tension: 0.35, order: 2 },
        { label: 'Median', data: medianData, borderColor: 'rgba(140,151,163,0.55)', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false, tension: 0.35, order: 2 },
        { label: '+1 SD', data: sdPlus1, borderColor: 'rgba(139,201,142,0.45)', borderWidth: 1.25, pointRadius: 0, fill: false, tension: 0.35, order: 2 },
        { label: '+2 SD', data: sdPlus2, borderColor: 'rgba(31,164,84,0.45)', borderWidth: 1.25, pointRadius: 0, fill: false, tension: 0.35, order: 2 },
        { label: '+3 SD', data: sdPlus3, borderColor: 'rgba(13,122,61,0.45)', borderWidth: 1.25, pointRadius: 0, fill: false, tension: 0.35, order: 2 }
      ]
    };
  }
  // Membangun konfigurasi grafik pertumbuhan
  function buildGrowthChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: false },
        legend: { display: false },
        tooltip: {
          filter: (item) => !(item.dataset && item.dataset._isHalo),
          callbacks: {
            title: (items) => items.length ? `Usia ${items[0].label} bulan` : ''
          }
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true, speed: 0.08 },
            pinch: { enabled: true },
            mode: 'x'
          },
          limits: { x: { min: 'original', max: 'original' } }
        }
      },
      scales: {
        y: { title: { display: true, text: 'Tinggi (cm)', font: { size: 11 } }, ticks: { font: { size: 11 } } },
        x: {
          title: { display: true, text: 'Usia (bulan)', font: { size: 11 } },
          ticks: {
            font: { size: 11 },
            autoSkip: false,
            // Hanya tampilkan label pada kelipatan 6 bulan (6,12,...,60)
            callback: function (value) {
              const label = this.getLabelForValue(value);
              const m = parseInt(label, 10);
              return (m > 0 && m % 6 === 0) ? label : null;
            }
          },
          grid: {
            // Garis lebih tebal & gelap pada usia ulang tahun (1,2,3,4,5 tahun)
            color: (ctx) => {
              const m = ctx.tick ? parseInt(ctx.tick.label, 10) : NaN;
              return [12, 24, 36, 48, 60].includes(m) ? 'rgba(45,70,94,0.4)' : 'rgba(0,0,0,0.06)';
            },
            lineWidth: (ctx) => {
              const m = ctx.tick ? parseInt(ctx.tick.label, 10) : NaN;
              return [12, 24, 36, 48, 60].includes(m) ? 2 : 1;
            }
          }
        }
      }
    };
  }
  // Membangun item legenda grafik pertumbuhan
  function buildGrowthChartLegendItems(actualLineLabel) {
    return [
      { label: '-3 SD', color: '#D62839', tip: 'Tinggi badan balita berada jauh di bawah standar. Di bawah garis ini termasuk kategori sangat pendek.' },
      { label: '-2 SD', color: '#F08C1C', tip: 'Tinggi badan balita berada di bawah batas standar. Di bawah garis ini termasuk kategori pendek.' },
      { label: '-1 SD', color: '#E8B93A', tip: 'Tinggi badan balita sedikit di bawah nilai tengah, tetapi masih dalam rentang normal.' },
      { label: 'Median', color: '#8C97A3', dashed: true, tip: 'Nilai tengah tinggi badan balita sehat pada usia yang sama berdasarkan standar WHO.' },
      { label: '+1 SD', color: '#8BC98E', tip: 'Tinggi badan balita sedikit di atas nilai tengah berdasarkan standar WHO.' },
      { label: '+2 SD', color: '#1FA454', tip: 'Tinggi badan balita berada di atas nilai tengah berdasarkan standar WHO.' },
      { label: '+3 SD', color: '#0D7A3D', tip: 'Tinggi badan balita berada jauh di atas nilai tengah berdasarkan standar WHO.' },
      { label: actualLineLabel, color: '#2d465e', hasPoint: true, tip: 'Menunjukkan tinggi badan balita pada setiap pengukuran yang tercatat.' }
    ];
  }
  // Membangun dataset garis pertumbuhan aktual
  function buildGrowthActualLineDatasets(label, data, pointRadius, pointBackgroundColor) {
    return [
      {
        label,
        data,
        borderColor: '#2d465e',
        borderWidth: 2.25,
        pointRadius,
        pointBackgroundColor,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
        spanGaps: true,
        showLine: true,
        tension: 0.25,
        fill: false,
        order: -1,
        _haloIndex: 8
      },
      {
        label: 'Riwayat (halo)',
        data,
        borderColor: '#ffffff',
        borderWidth: 4,
        pointRadius: 0,
        spanGaps: true,
        showLine: true,
        tension: 0.25,
        fill: false,
        order: 0,
        _isHalo: true
      }
    ];
  }
  // Merender legenda grafik pertumbuhan
  function renderGrowthChartLegend(containerId, chartCanvasId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map((item, index) => {
      const lineStyle = item.dashed
        ? `background-image: repeating-linear-gradient(to right, ${item.color} 0 5px, transparent 5px 9px); background-color: transparent;`
        : `background-color: ${item.color};`;
      const swatch = item.hasPoint
        ? `<span style="position:relative; display:inline-block; width:22px; height:12px; flex-shrink:0;">
                <span style="position:absolute; top:50%; left:0; right:0; height:2px; transform:translateY(-50%); background-color:${item.color};"></span>
                <span style="position:absolute; top:50%; left:50%; width:8px; height:8px; border-radius:50%; background:${item.color}; border:1.5px solid #fff; box-shadow:0 0 0 1px ${item.color}; transform:translate(-50%,-50%);"></span>
            </span>`
        : `<span style="display:inline-block; width:22px; height:2px; flex-shrink:0; ${lineStyle}"></span>`;
      const tip = item.tip
        ? `<i class="bi bi-question-circle-fill info-tip ms-1" data-bs-toggle="tooltip" data-bs-placement="top" title="${item.tip}" data-shared-action="stop-propagation"></i>`
        : '';
      return `<button type="button" class="growth-legend-item d-inline-flex align-items-center" style="gap:5px; margin:0 10px 6px 0; font-size:10.5px; color:#465a6b;" data-shared-action="toggle-growth-dataset" data-chart-id="${chartCanvasId}" data-dataset-index="${index}">${swatch}<span>${item.label}</span>${tip}</button>`;
    }).join('');
    initTooltips(container);
  }
  // Mengubah visibilitas dataset pertumbuhan
  function toggleGrowthDataset(chartCanvasId, datasetIndex, btnEl) {
    const chart = Chart.getChart(chartCanvasId);
    if (!chart) return;
    const meta = chart.getDatasetMeta(datasetIndex);
    meta.hidden = meta.hidden === null ? !chart.data.datasets[datasetIndex].hidden : !meta.hidden;
    const haloIndex = chart.data.datasets[datasetIndex]._haloIndex;
    if (haloIndex !== undefined) {
      const haloMeta = chart.getDatasetMeta(haloIndex);
      haloMeta.hidden = meta.hidden;
    }
    chart.update();
    btnEl.classList.toggle('legend-hidden', !!meta.hidden);
  }
  // Mengatur zoom grafik pertumbuhan
  function zoomGrowthChart(chartCanvasId, factor) {
    const chart = Chart.getChart(chartCanvasId);
    if (chart && typeof chart.zoom === 'function') chart.zoom(factor);
  }
  // Mengatur ulang zoom grafik pertumbuhan
  function resetGrowthChartZoom(chartCanvasId) {
    const chart = Chart.getChart(chartCanvasId);
    if (chart && typeof chart.resetZoom === 'function') chart.resetZoom();
  }

// ==========================================
// SECTION: Risk Factor Chart
// ==========================================
  // Merender grafik faktor risiko stunting
  function renderFaktorRisikoChart(canvasId, kontribusiRisiko, opts) {
    opts = opts || {};
    const datasetLabel = opts.datasetLabel || 'Kontribusi terhadap Risiko Stunting';
    const tooltipPrefix = opts.tooltipPrefix || 'Kontribusi';
    const axisLabel = opts.axisLabel || 'Kontribusi terhadap Risiko Stunting (Y)';
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const sorted = [...kontribusiRisiko].sort((a, b) => b.kontribusi - a.kontribusi);
    const labels = sorted.map(k => (explanations[k.variable] && explanations[k.variable].name) || k.variable);
    const values = sorted.map(k => k.kontribusi);
    const colors = values.map(v => v >= 0 ? '#D62839' : '#1FA454');
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: datasetLabel,
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${tooltipPrefix}: ${formatKontribusi(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: axisLabel, font: { size: 11 } },
            ticks: { font: { size: 11 } },
            grid: { color: '#eef1f4' }
          },
          y: {
            ticks: { font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }
  // Mengubah tampilan faktor risiko stunting tambahan
  function toggleFaktorExtra(elementId, btn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const willShow = el.classList.contains('d-none');
    el.classList.toggle('d-none');
    const count = btn.getAttribute('data-count');
    btn.innerHTML = willShow
      ? '<i class="bi bi-chevron-up me-1"></i>Sembunyikan Faktor Lainnya'
      : `<i class="bi bi-chevron-down me-1"></i>Lihat ${count} Faktor Lainnya`;
  }

document.addEventListener('click', (event) => {
  const stopTarget = event.target.closest('[data-shared-action="stop-propagation"]');
  if (stopTarget) {
    event.stopPropagation();
    return;
  }

  const actionTarget = event.target.closest('[data-shared-action]');
  if (!actionTarget) return;

  switch (actionTarget.dataset.sharedAction) {
    case 'toggle-faktor-extra':
      toggleFaktorExtra(actionTarget.dataset.targetId, actionTarget);
      break;
    case 'toggle-growth-dataset':
      toggleGrowthDataset(
        actionTarget.dataset.chartId,
        Number(actionTarget.dataset.datasetIndex),
        actionTarget
      );
      break;
    default:
      break;
  }
});

window.fetchGrowthReference = fetchGrowthReference;
window.fetchFaktorRisikoExplanations = fetchFaktorRisikoExplanations;

window.customDatepicker = {
  showDatepicker,
  hideDatepicker,
  parseDate,
};
