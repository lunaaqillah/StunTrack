// ==========================================
// SECTION: Initialization
// ==========================================
// Memperbarui progress bar
function updateProgressbar(step) {
  const progressSteps = document.querySelectorAll('.progress-step');
  const progress = document.getElementById('progress');
  progressSteps.forEach((progressStep, idx) => {
    progressStep.classList.toggle('progress-step-active', idx <= step);
  });
  const progressActive = document.querySelectorAll('.progress-step-active');
  progress.style.width = ((progressActive.length - 1) / (progressSteps.length - 1)) * 100 + '%';
}

const SECTION_IDS = ['pendahuluan', 'petunjuk-pengisian', 'orang-tua', 'balita', 'kuesioner', 'selesai'];
const STEP_SECTIONS = {
  0: ['pendahuluan', 'petunjuk-pengisian'],
  1: ['orang-tua'],
  2: ['balita'],
  3: ['kuesioner'],
  4: ['selesai']
};
// Menampilkan section sesuai langkah
function showSection(step) {
  SECTION_IDS.forEach(id => document.getElementById(id).style.display = 'none');
  (STEP_SECTIONS[step] || []).forEach(id => document.getElementById(id).style.display = 'block');
  updateProgressbar(step);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.progress-step').forEach((step, index) => {
  step.addEventListener('click', () => {
    if (!step.classList.contains('progress-step-active')) return;
    const currentActiveSteps = document.querySelectorAll('.progress-step-active').length - 1;
    if (index === 1 && currentActiveSteps > 1) {
      resetToOrangTuaSection();
    }
    showSection(index);
  });
});

document.getElementById('kembaliBtnKuesioner').addEventListener('click', () => showSection(2));

document.getElementById('nextBtnKuesioner').addEventListener('click', function () {
  if (this.disabled) return;
  showSection(4);
  document.getElementById('submitBtn').disabled = false;
});

document.getElementById('kembaliBtnSelesai').addEventListener('click', () => showSection(3));

document.getElementById('submitBtn').addEventListener('click', function () {
  if (this.disabled) return;
  this.disabled = true;
  this.textContent = 'Submitting...';
  const submitOverlay = document.getElementById('submitOverlay');
  if (submitOverlay) submitOverlay.classList.add('active');
  submitKuesioner().finally(() => {
    if (window.location.pathname.includes('kuesioner.html')) {
      this.disabled = false;
      this.textContent = 'Submit';
      if (submitOverlay) submitOverlay.classList.remove('active');
    }
  });
});

// ==========================================
// SECTION: Introduction
// ==========================================
const proceedBtn = document.getElementById('proceedBtn');

document.getElementById('agreementCheckbox').addEventListener('change', function () {
  proceedBtn.disabled = !this.checked;
});

proceedBtn.addEventListener('click', function () {
  showSection(1);
});

document.querySelectorAll('a[href^="/"]').forEach(link => {
  link.addEventListener('click', function (e) {
    if (!confirm('Apakah Anda ingin meninggalkan halaman ini? Respons yang belum dikirim tidak akan disimpan.')) {
      e.preventDefault();
    }
  });
});

// ==========================================
// SECTION: Parent Information
// ==========================================
const orangTuaForm = document.getElementById('orangTuaForm');
const lanjutkanBtn = document.getElementById('lanjutkanBtn');
const emailField = document.getElementById('emailInput');
// Memvalidasi form orang tua
function checkFormValidity() {
  const requiredFilled = [...orangTuaForm.querySelectorAll('input[required], select[required]')]
    .every(field => field.value.trim());
  const gondokChecked = [...orangTuaForm.querySelectorAll('input[name="riwayat_gondok"]')]
    .some(radio => radio.checked);
  const emailValid = !emailField.value || emailField.checkValidity();
  lanjutkanBtn.disabled = !(requiredFilled && gondokChecked && emailValid);
}

['input', 'change'].forEach(evt => orangTuaForm.addEventListener(evt, checkFormValidity));

emailField.addEventListener('input', function () {
  if (this.value && !this.checkValidity()) {
    this.reportValidity();
  }
});

let existingParentData = null;
const MAX_BALITA_PER_PENGISIAN = 4;

const TB_BALITA_MIN = 40;
const TB_BALITA_MAX = 130;
const BB_BALITA_MIN = 1;
const BB_BALITA_MAX = 40;
let verifiedParentEmail = null;

checkFormValidity();

document.getElementById('kembaliBtnOrangTua').addEventListener('click', function () {
  existingParentData = null;
  balitaCount = 1;
  verifiedParentEmail = null;
  document.getElementById('balitaContainer').innerHTML = `
    <div class="balita-entry mb-3 p-3 border rounded" style="position: relative;">
      <h5 style="font-family: 'Mont-HeavyDEMO', var(--heading-font);">Balita 1</h5>
      <hr>
      <div class="row gy-3">
        <div class="col-md-6">
          <input type="text" name="balita_nama[]" class="form-control" placeholder="Nama Lengkap Balita" required>
        </div>
        <div class="col-md-6">
          <div class="input-group">
            <input type="text" name="balita_tanggal_lahir[]" class="form-control date-input" placeholder="Tanggal Lahir" required readonly>
            <span class="input-group-text" style="cursor: pointer;">
              <i class="bi bi-calendar"></i>
            </span>
          </div>
        </div>
        <div class="col-md-3">
          <input type="number" step="0.1" min="40" max="130" name="balita_tinggi_badan[]" class="form-control" placeholder="Tinggi Badan (cm)" required>
        </div>
        <div class="col-md-3">
          <input type="number" step="0.1" min="1" max="40" name="balita_berat_badan[]" class="form-control" placeholder="Berat Badan (kg)" required>
        </div>
        <div class="col-md-6">
          <div class="d-flex align-items-center">
            <label class="me-3">Jenis Kelamin:</label>
            <div class="d-flex align-items-center">
              <div class="me-3">
                <input type="radio" id="jk_laki_0" name="balita_jenis_kelamin[0]" value="Laki-laki" required>
                <label for="jk_laki_0" class="ms-1">Laki-laki</label>
              </div>
              <div>
                <input type="radio" id="jk_perempuan_0" name="balita_jenis_kelamin[0]" value="Perempuan" required>
                <label for="jk_perempuan_0" class="ms-1">Perempuan</label>
              </div>
            </div>
          </div>
          <small class="text-muted">* Pilih jenis kelamin balita.</small>
        </div>
      </div>
    </div>
  `;

  emailField.disabled = false;
  emailField.value = '';
  const tanggalInput = document.querySelector('input[name="tanggal_lahir"]');
  if (tanggalInput) {
    tanggalInput.disabled = false;
    tanggalInput.value = '';
  }

  checkFormValidity();
  emailField.focus();
  showSection(0);
});
// Menampilkan section balita
function showBalitaSection() {
  document.getElementById('orang-tua').style.display = 'none';
  document.getElementById('balita').style.display = 'block';
  updateProgressbar(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

lanjutkanBtn.addEventListener('click', async function () {
  if (lanjutkanBtn.disabled) return;

  const email = emailField.value.trim();
  if (existingParentData && verifiedParentEmail === email) {
    showBalitaSection();
    return;
  }

  if (email && emailField.checkValidity()) {
    try {
      const response = await fetch(`/identitas_orang_tua/check_email/${encodeURIComponent(email)}`);
      const data = await response.json();
      if (data.exists) {
        existingParentData = data;
        populateEmailExistsModal(data);
        new bootstrap.Modal(document.getElementById('emailExistsModal'), { backdrop: 'static', keyboard: false }).show();
        return;
      }
    } catch (error) {
      console.error('Error checking email:', error);
    }
  }

  showBalitaSection();
  if (existingParentData) {
    populateBalitaSection(existingParentData);
  }
});
// Mengubah format tanggal
function convertDateFormat(dateString) {
  if (!dateString) return dateString;
  const parsed = parseDate(dateString);
  if (!parsed || isNaN(parsed)) return dateString;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// SECTION: Parent Data
// ==========================================
// Mengambil data orang tua
function getOrangTuaData() {
  return {
    nama_orang_tua: document.querySelector('input[name="nama_responden"]').value || null,
    tanggal_lahir: convertDateFormat(document.querySelector('input[name="tanggal_lahir"]').value),
    pekerjaan: document.querySelector('select[name="pekerjaan"]').value,
    alamat: document.querySelector('input[name="alamat"]').value,
    pendidikan: document.querySelector('select[name="pendidikan"]').value,
    email: document.querySelector('input[name="email"]').value,
    riwayat_gondok: document.querySelector('input[name="riwayat_gondok"]:checked').value
  };
}
// Mengisi modal email yang sudah terdaftar
function populateEmailExistsModal(data) {
  const parentInfo = document.getElementById('parentInfo');
  const childrenInfo = document.getElementById('childrenInfo');
  parentInfo.innerHTML = `
    <h6 style="color: #212E48; font-family: 'Mont-HeavyDEMO', var(--heading-font); font-size: 1.2rem; text-align: center; ">Informasi Orang Tua</h6>
    <hr>
    <table class="table table-borderless" style="opacity: 0.75;">
      <tbody">
        <tr>
          <td><strong>Nama</strong></td>
          <td>${data.parent?.nama_orang_tua || 'Tidak ada'}</td>
        </tr>
        <tr>
          <td><strong>Email</strong></td>
          <td>${data.parent?.email || 'Tidak ada'}</td>
        </tr>
        <tr>
          <td><strong>Tanggal Lahir</strong></td>
          <td>${data.parent?.tanggal_lahir ? formatTanggalIndo(data.parent.tanggal_lahir) : 'Tidak ada'}</td>
        </tr>
        <tr>
          <td><strong>Pekerjaan</strong></td>
          <td>${data.parent?.pekerjaan || 'Tidak ada'}</td>
        </tr>
        <tr>
          <td><strong>Alamat</strong></td>
          <td>${data.parent?.alamat || 'Tidak ada'}</td>
        </tr>
        <tr>
          <td><strong>Pendidikan</strong></td>
          <td>${data.parent?.pendidikan || 'Tidak ada'}</td>
        </tr>
        <tr>
          <td><strong>Riwayat Gondok</strong></td>
          <td>${data.parent?.riwayat_gondok || 'Tidak ada'}</td>
        </tr>
      </tbody>
    </table>
    <hr>
  `;
  let childrenHtml = '<h6 style="color: #212E48; font-family: \'Mont-HeavyDEMO\', var(--heading-font); font-size: 1.2rem; text-align: center;">Balita Terdaftar</h6>';
  if (data.children && data.children.length > 0) {
    childrenHtml += `
      <hr>
      <table class="table table-borderless" style="margin: 0; opacity: 0.75;">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Jenis Kelamin</th>
          </tr>
        </thead>
        <tbody>
    `;
    data.children.forEach(child => {
      childrenHtml += `
        <tr>
          <td>${child.nama_balita}</td>
          <td>${child.jenis_kelamin}</td>
        </tr>
      `;
    });
    childrenHtml += `
        </tbody>
      </table>
      <hr>
    `;
  } else {
    childrenHtml += '<p>Tidak ada balita terdaftar.</p>';
  }
  childrenInfo.innerHTML = childrenHtml;
}
// Mengisi form orang tua dengan data tersimpan
function prefillOrangTuaForm(parent) {
  const tanggalLahirInput = document.querySelector('input[name="tanggal_lahir"]');
  tanggalLahirInput.value = formatTanggalIndo(parent.tanggal_lahir);
  tanggalLahirInput.disabled = true;

  const emailInput = document.querySelector('input[name="email"]');
  emailInput.value = parent.email;
  emailInput.disabled = true;

  const gondokRadio = document.querySelector(`input[name="riwayat_gondok"][value="${parent.riwayat_gondok}"]`);
  if (gondokRadio && !document.querySelector('input[name="riwayat_gondok"]:checked')) {
    gondokRadio.checked = true;
  }
}

// ==========================================
// SECTION: Email & Birth Date Validation
// ==========================================
document.getElementById('yaItuSayaBtn').addEventListener('click', function () {
  const emailModalEl = document.getElementById('emailExistsModal');
  const emailModal = emailModalEl ? bootstrap.Modal.getInstance(emailModalEl) : null;
  if (emailModal) emailModal.hide();

  balitaCount = 1;
  populateBirthDateModal(existingParentData?.children || []);

  const restoreEl = document.getElementById('restoreBalitaModal');
  if (restoreEl) {
    const restoreInstance = bootstrap.Modal.getInstance(restoreEl);
    if (restoreInstance) restoreInstance.hide();
  }

  const birthModalEl = document.getElementById('birthDateModal');
  if (birthModalEl) {
    bootstrap.Modal.getOrCreateInstance(birthModalEl, {
      backdrop: 'static',
      keyboard: false
    }).show();
  }
});
// Mengisi modal tanggal lahir balita
function populateBirthDateModal(children) {
  const inputsDiv = document.getElementById('birthDateInputs');
  let birthDateHtml = '';
  if (children.length > 0) {
    birthDateHtml = `
      <table class="table table-borderless" style="margin: 0;">
        <thead>
          <tr>
            <th>Nama Balita</th>
            <th>Jenis Kelamin</th>
            <th>Tanggal Lahir</th>
          </tr>
        </thead>
        <tbody>
    `;
    children.forEach((child, index) => {
      birthDateHtml += `
        <tr>
          <td>${child.nama_balita}</td>
          <td>${child.jenis_kelamin}</td>
          <td>
            <div class="input-group">
              <input type="text" class="form-control date-input" id="birthDate_${index}" data-expected="${child.tanggal_lahir}" placeholder="Tanggal Lahir" required readonly>
              <span class="input-group-text" style="cursor: pointer;">
                <i class="bi bi-calendar"></i>
              </span>
            </div>
          </td>
        </tr>
      `;
    });
    birthDateHtml += `
        </tbody>
      </table>
    `;
  } else {
    birthDateHtml = '<p>Tidak ada balita terdaftar.</p>';
  }
  inputsDiv.innerHTML = birthDateHtml;

  setTimeout(() => {
    document.querySelectorAll('#birthDateInputs .date-input').forEach(input => {
      input.addEventListener("click", () => window.customDatepicker.showDatepicker(input));
    });
    document.querySelectorAll('#birthDateInputs .input-group-text').forEach(span => {
      span.addEventListener("click", () => {
        const input = span.closest('.input-group').querySelector('.date-input');
        window.customDatepicker.showDatepicker(input);
      });
    });
  }, 100);
}

document.getElementById('bukanSayaBtn').addEventListener('click', function () {
  alert('Silakan ubah email Anda karena sudah digunakan oleh orang lain.');

  resetOrangTuaBalitaInputs();

  checkFormValidity();

  const emailModalEl = document.getElementById('emailExistsModal');
  const emailModal = emailModalEl ? bootstrap.Modal.getInstance(emailModalEl) : null;
  if (emailModal) emailModal.hide();

  emailField.focus();
});

document.getElementById('verifyBirthDatesBtn').addEventListener('click', function () {
  const inputs = document.querySelectorAll('#birthDateInputs input[type="text"]');
  const allCorrect = [...inputs].every(input => {
    const expectedDate = new Date(input.getAttribute('data-expected'));
    const inputDate = parseDate(input.value);
    return expectedDate && inputDate &&
      expectedDate.getFullYear() === inputDate.getFullYear() &&
      expectedDate.getMonth() === inputDate.getMonth() &&
      expectedDate.getDate() === inputDate.getDate();
  });

  if (!allCorrect) {
    alert('Tanggal lahir tidak sesuai. Silakan coba lagi.');
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById('birthDateModal')).hide();
  prefillOrangTuaForm(existingParentData.parent);
  verifiedParentEmail = existingParentData?.parent?.email || getCurrentParentEmail();
  showBalitaSection();
  populateBalitaSection(existingParentData);
});

document.getElementById('birthDateModal').addEventListener('click', function (e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  const isBatalButton = (btn.getAttribute('data-bs-dismiss') === 'modal') &&
    (btn.textContent || '').trim().toLowerCase() === 'batal';

  if (isBatalButton) {
    resetEmailSessionAndBalita();
  }
});
// Mereset input orang tua dan balita
function resetOrangTuaBalitaInputs() {
  existingParentData = null;

  const balitaEntries = document.querySelectorAll('#balitaContainer .balita-entry');
  balitaCount = balitaEntries.length > 0 ? balitaEntries.length : 1;

  emailField.disabled = false;
  emailField.value = '';

  const tanggalInput = document.querySelector('input[name="tanggal_lahir"]');
  if (tanggalInput) {
    tanggalInput.disabled = false;
    tanggalInput.value = '';
  }

  const gondokChecked = document.querySelector('input[name="riwayat_gondok"]:checked');
  if (gondokChecked) gondokChecked.checked = false;

  document.querySelectorAll('#balitaContainer input').forEach(inp => {
    if (inp.name && (inp.name.includes('balita_nama') || inp.name.includes('balita_tanggal_lahir') || inp.name.includes('balita_jenis_kelamin') || inp.name.includes('balita_tinggi_badan') || inp.name.includes('balita_berat_badan'))) {
      inp.disabled = false;
    }
  });

  checkBalitaFormValidity();
  updateAddButtonVisibility();
}
// Mereset sesi email dan data balita
function resetEmailSessionAndBalita() {
  resetOrangTuaBalitaInputs();
  verifiedParentEmail = null;
  if (lanjutkanBtn) lanjutkanBtn.disabled = true;

  document.getElementById('balita').style.display = 'none';
  document.getElementById('orang-tua').style.display = 'block';
  updateProgressbar(1);
}

document.getElementById('hapusDataBtn').addEventListener('click', function () {
  if (!confirm('Penghapusan akan menghapus orang tua, semua balita, dan semua pengisian terkait. Lanjutkan permintaan konfirmasi via email?')) {
    return;
  }
  const hapusBtn = this;
  const verifyBtn = document.getElementById('verifyBirthDatesBtn');
  const batalBtn = document.querySelector('#birthDateModal button[data-bs-dismiss="modal"]');
  hapusBtn.disabled = true;
  hapusBtn.textContent = 'Memproses...';
  if (verifyBtn) verifyBtn.disabled = true;
  if (batalBtn) batalBtn.disabled = true;

  requestHapusDataEmail()
    .catch(err => {
      console.error(err);
      alert('Gagal mengajukan hapus data. Silakan coba lagi.');
    })
    .finally(() => {
      hapusBtn.disabled = false;
      hapusBtn.textContent = 'Hapus Data';
      if (verifyBtn) verifyBtn.disabled = false;
    });
});
// Mengambil email orang tua saat ini
function getCurrentParentEmail() {
  return emailField.value.trim();
}
// Mengambil email orang tua yang diharapkan
function getExpectedParentEmail() {
  return existingParentData?.parent?.email || getCurrentParentEmail();
}
// Meminta email untuk penghapusan data
function requestHapusDataEmail() {
  const email = getExpectedParentEmail();
  if (!email) {
    alert('Email orang tua tidak tersedia.');
    return;
  }
  return fetch('/account/request-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
    .then(r => r.json())
    .then(d => {
      alert(d.message || 'Permintaan hapus data diproses. Cek email Anda untuk konfirmasi.');
      window.location.href = '/';
    });
}

// ==========================================
// SECTION: Child Information
// ==========================================
// Menghitung usia dalam bulan
function calculateAgeInMonths(birthDateString, atDateString) {
  const birthDate = new Date(birthDateString);
  const atDate = atDateString ? new Date(atDateString) : new Date();
  let months = (atDate.getFullYear() - birthDate.getFullYear()) * 12 + (atDate.getMonth() - birthDate.getMonth());
  if (atDate.getDate() < birthDate.getDate()) months--;
  return Math.max(0, months);
}
// Menghitung usia
function calculateAge(birthDateString) {
  return Math.floor(calculateAgeInMonths(birthDateString) / 12);
}
// Memeriksa usia lebih dari lima tahun
function isOverFiveYears(birthDateString, atDateString) {
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return false;
  const atDate = atDateString ? new Date(atDateString) : new Date();
  const fifthBirthday = new Date(birthDate.getTime());
  fifthBirthday.setFullYear(fifthBirthday.getFullYear() + 5);
  return atDate.getTime() > fifthBirthday.getTime();
}
// Menormalisasi kunci data
function normalizeKey(nama, tanggalLahir) {
  const n = (nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const t = (tanggalLahir || '').trim();
  return `${n}|${t}`;
}
// Memformat usia dalam bulan
function formatUsiaBulan(totalMonths) {
  const months = Number(totalMonths) || 0;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return years > 0 ? `${years} tahun ${remainingMonths} bulan` : `${months} bulan`;
}
// Membangun elemen balita yang sudah terdaftar
function createExistingBalitaEntryElement(child, displayIndex) {
  const newBalita = document.createElement('div');
  newBalita.className = 'balita-entry mb-3 p-3 border rounded';
  newBalita.style.position = 'relative';
  newBalita.setAttribute('data-existing-balita', 'true');
  newBalita.innerHTML = `
    <h5 style="font-family: 'Mont-HeavyDEMO', var(--heading-font);">Balita ${displayIndex}</h5>
    <hr>
    <div class="row gy-3">
      <div class="col-md-6">
        <input type="text" name="balita_nama[]" class="form-control" placeholder="Nama Lengkap Balita" value="${child.nama_balita}" disabled required>
      </div>
      <div class="col-md-6">
        <!-- [main.js] memanggil formatTanggalIndo() dari main.js untuk menampilkan tanggal lahir balita yang sudah terdaftar dalam format Indonesia -->
        <input type="text" name="balita_tanggal_lahir[]" class="form-control" placeholder="Tanggal Lahir" value="${formatTanggalIndo(child.tanggal_lahir)}" disabled required>
      </div>
      <div class="col-md-3">
        <input type="number" step="0.1" min="40" max="130" name="balita_tinggi_badan[]" class="form-control" placeholder="Tinggi Badan (cm)" required>
      </div>
      <div class="col-md-3">
        <input type="number" step="0.1" min="1" max="40" name="balita_berat_badan[]" class="form-control" placeholder="Berat Badan (kg)" required>
      </div>
      <div class="col-md-6">
        <div class="d-flex align-items-center">
          <label class="me-3">Jenis Kelamin:</label>
          <div class="d-flex align-items-center">
            <div class="me-3">
              <input type="radio" id="jk_laki_${displayIndex - 1}" name="balita_jenis_kelamin[${displayIndex - 1}]" value="Laki-laki" ${child.jenis_kelamin === 'Laki-laki' ? 'checked' : ''} disabled required>
              <label for="jk_laki_${displayIndex - 1}" class="ms-1">Laki-laki</label>
            </div>
            <div>
              <input type="radio" id="jk_perempuan_${displayIndex - 1}" name="balita_jenis_kelamin[${displayIndex - 1}]" value="Perempuan" ${child.jenis_kelamin === 'Perempuan' ? 'checked' : ''} disabled required>
              <label for="jk_perempuan_${displayIndex - 1}" class="ms-1">Perempuan</label>
            </div>
          </div>
        </div>
        <small class="text-muted">* Pilih jenis kelamin balita.</small>
      </div>
    </div>
    <button type="button" class="btn btn-danger btn-sm mt-2 balita-remove-btn" title="Tidak sertakan balita ini dalam pengisian kali ini (data tetap tersimpan)" style="border-radius: 50%; width: 30px; height: 30px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #EAA0A3; border-color: #EAA0A3; position: absolute; top: 5px; right: 15px;"><i class="bi bi-x" style="font-weight: bold;"></i></button>
    <small class="text-muted d-block mt-2"><i class="bi bi-info-circle"></i> Balita ini sudah pernah terdaftar. Klik &times; jika balita ini tidak ikut diukur pada pengisian kali ini &mdash; data balita tetap tersimpan di sistem.</small>
  `;
  attachTbHistoryValidation(newBalita, child.id_balita, child.tanggal_lahir);
  return newBalita;
}
// Menampilkan modal batas jumlah balita
function showMaxBalitaInfoModal() {
  let modalEl = document.getElementById('maxBalitaInfoModal');
  if (!modalEl) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" id="maxBalitaInfoModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content" style="border-radius: 15px; border: none; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <div class="modal-header" style="background: #212E48; color: white; border-radius: 15px 15px 0 0; border-bottom: none;">
              <h5 class="modal-title" style="font-family: 'Mont-HeavyDEMO', var(--heading-font); font-size: 1.3rem; color: white; padding-left: 10px;">
                Batas Maksimal Balita per Pengisian
              </h5>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
              <p>Setiap pengisian kuesioner hanya dapat mencakup maksimal <strong id="maxBalitaInfoCount"></strong> balita untuk dianalisis.</p>
              <p>Balita Anda yang terdaftar sudah mencapai batas tersebut. Jika ada balita yang belum ingin diikutsertakan pada pengisian kali ini, silakan hapus balita tersebut dari form menggunakan tombol &times; pada kartu balita &mdash; data balita <strong>tidak akan hilang</strong> dari sistem.</p>
              <p class="mb-0">Untuk balita yang belum sempat dianalisis, Anda dapat melakukan pengisian kuesioner tersendiri kapan saja.</p>
            </div>
            <div class="modal-footer" style="padding: 1.25rem 1.5rem; justify-content: center;">
              <button type="button" class="btn" data-bs-dismiss="modal" style="border-radius: 25px; padding: 10px 30px; background-color: #EAA0A3; border-color: #EAA0A3; color: white; font-weight: 500;">Saya Mengerti</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);
    modalEl = document.getElementById('maxBalitaInfoModal');
  }
  modalEl.querySelector('#maxBalitaInfoCount').textContent = MAX_BALITA_PER_PENGISIAN;
  const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
  modal.show();
}
// Membuka modal pilihan balita
function openBalitaLimitSelectionModal(eligibleChildren, maxCount, onConfirm) {
  const existingModal = document.getElementById('balitaLimitSelectionModal');
  if (existingModal) existingModal.remove();

  const checklistItemsHtml = eligibleChildren.map((child, idx) => `
    <div class="form-check mb-2 p-2 border rounded d-flex align-items-center">
      <input class="form-check-input balita-select-checkbox ms-2 me-3" type="checkbox" style="width: 1.25em; height: 1.25em;" value="${idx}" id="balitaSelect_${idx}">
      <label class="form-check-label w-100 mb-0" for="balitaSelect_${idx}">
        <strong>${child.nama_balita}</strong><br>
        <small class="text-muted">${formatTanggalIndo(child.tanggal_lahir)}${child.jenis_kelamin ? ' &middot; ' + child.jenis_kelamin : ''}</small>
      </label>
    </div>
  `).join('');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="modal fade" id="balitaLimitSelectionModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content" style="border-radius: 15px; border: none; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
          <div class="modal-header" style="background: #212E48; color: white; border-radius: 15px 15px 0 0; border-bottom: none;">
            <h5 class="modal-title" style="font-family: 'Mont-HeavyDEMO', var(--heading-font); font-size: 1.4rem; color: white; padding-left: 10px;">
              Batas Maksimal Balita per Pengisian
            </h5>
          </div>
          <div class="modal-body" style="padding: 1.5rem;">
            <p>Setiap pengisian kuesioner hanya dapat mencakup maksimal <strong>${maxCount} balita</strong> untuk dianalisis. Kami menemukan <strong>${eligibleChildren.length} balita</strong> terdaftar pada akun ini, sehingga Anda perlu memilih balita mana saja yang ingin disertakan pada pengisian kali ini.</p>
            <p>Balita yang tidak dipilih tidak akan hilang dari sistem &mdash; Anda dapat melakukan pengisian kuesioner tersendiri untuk balita tersebut kapan saja.</p>
            <p>Silakan pilih balita mana saja (maksimal ${maxCount}) yang ingin disertakan pada pengisian kali ini:</p>
            <div id="balitaSelectionChecklist">
              ${checklistItemsHtml}
            </div>
            <div class="text-end mt-2">
              <span id="balitaSelectionCounter" style="font-size: 0.85rem; font-weight: 600; color: #212E48; background-color: rgba(234, 160, 163, 0.2); border: 1px solid #EAA0A3; border-radius: 20px; padding: 4px 14px; display: inline-block;"></span>
            </div>
          </div>
          <div class="modal-footer" style="padding: 1.5rem; justify-content: center;">
            <button type="button" class="btn" id="balitaSelectionConfirmBtn" disabled style="border-radius: 25px; padding: 10px 30px; background-color: #EAA0A3; border-color: #EAA0A3; color: white; font-weight: 500;">Lanjutkan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  const modalEl = document.getElementById('balitaLimitSelectionModal');

  const checkboxes = Array.from(modalEl.querySelectorAll('.balita-select-checkbox'));
  const counterEl = modalEl.querySelector('#balitaSelectionCounter');
  const confirmBtn = modalEl.querySelector('#balitaSelectionConfirmBtn');
  // Memperbarui state halaman
  function refreshState() {
    const checkedCount = checkboxes.filter(cb => cb.checked).length;
    counterEl.textContent = `${checkedCount}/${maxCount} dipilih`;
    checkboxes.forEach(cb => {
      if (!cb.checked) cb.disabled = checkedCount >= maxCount;
    });
    confirmBtn.disabled = checkedCount === 0;
  }
  checkboxes.forEach(cb => cb.addEventListener('change', refreshState));
  refreshState();

  const modalInstance = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

  confirmBtn.addEventListener('click', () => {
    const selectedChildren = [];
    checkboxes.forEach(cb => {
      if (cb.checked) selectedChildren.push(eligibleChildren[parseInt(cb.value, 10)]);
    });
    modalInstance.hide();
    onConfirm(selectedChildren);
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    modalEl.remove();
  }, { once: true });

  modalInstance.show();
}

// ==========================================
// SECTION: Child Data
// ==========================================
// Mengisi section balita
function populateBalitaSection(data) {
  const container = document.getElementById('balitaContainer');
  container.innerHTML = '';
  balitaCount = 0;

  const uniqueChildrenMap = new Map();
  data.children.forEach(child => {
    const key = child.nama_balita.trim().toLowerCase() + '|' + child.tanggal_lahir;
    if (!uniqueChildrenMap.has(key)) {
      uniqueChildrenMap.set(key, child);
    }
  });
  const uniqueChildren = Array.from(uniqueChildrenMap.values());

  const eligibleChildren = uniqueChildren.filter(child => !isOverFiveYears(child.tanggal_lahir));
  // Merender daftar balita
  function renderChildren(children) {
    children.forEach(child => {
      balitaCount++;
      container.appendChild(createExistingBalitaEntryElement(child, balitaCount));
    });
  }
  // Menyelesaikan proses setelah rendering
  function finalizeAfterRender() {
    checkBalitaFormValidity();
    updateAddButtonVisibility();
  }

  if (eligibleChildren.length > MAX_BALITA_PER_PENGISIAN) {
    openBalitaLimitSelectionModal(eligibleChildren, MAX_BALITA_PER_PENGISIAN, (selectedChildren) => {
      renderChildren(selectedChildren);
      finalizeAfterRender();
    });
    return;
  }

  renderChildren(eligibleChildren);

  if (eligibleChildren.length >= MAX_BALITA_PER_PENGISIAN) {
    showMaxBalitaInfoModal();
  } else {
    addNewBalitaEntry();
  }
  finalizeAfterRender();
}
// Memasang datepicker pada input balita
function attachDatepickerToEntry(entryEl) {
  if (!entryEl || !window.customDatepicker) return;
  const dateInput = entryEl.querySelector('.date-input[name="balita_tanggal_lahir[]"]');
  const iconSpan = entryEl.querySelector('.input-group-text');
  if (dateInput && dateInput.dataset.datepickerBound !== 'true') {
    dateInput.addEventListener('click', () => window.customDatepicker.showDatepicker(dateInput));
    dateInput.dataset.datepickerBound = 'true';
  }
  if (iconSpan && iconSpan.dataset.datepickerBound !== 'true') {
    iconSpan.addEventListener('click', () => {
      const input = iconSpan.closest('.input-group').querySelector('.date-input');
      if (input) window.customDatepicker.showDatepicker(input);
    });
    iconSpan.dataset.datepickerBound = 'true';
  }
}

let balitaCount = 1;
// Menambahkan input balita baru
function addNewBalitaEntry() {
  const container = document.getElementById('balitaContainer');
  const index = balitaCount;
  const newBalita = document.createElement('div');
  newBalita.className = 'balita-entry mb-3 p-3 border rounded';
  newBalita.style.position = 'relative';
  newBalita.innerHTML = `
    <h5 style="font-family: 'Mont-HeavyDEMO', var(--heading-font);">Balita ${index + 1}</h5>
    <hr>
    <div class="row gy-3">
      <div class="col-md-6">
        <input type="text" name="balita_nama[]" class="form-control" placeholder="Nama Lengkap Balita" required>
      </div>
      <div class="col-md-6">
        <div class="input-group">
          <input type="text" name="balita_tanggal_lahir[]" class="form-control date-input" placeholder="Tanggal Lahir" required readonly>
          <span class="input-group-text" style="cursor: pointer;">
            <i class="bi bi-calendar"></i>
          </span>
        </div>
      </div>
      <div class="col-md-3">
        <input type="number" step="0.1" min="40" max="130" name="balita_tinggi_badan[]" class="form-control" placeholder="Tinggi Badan (cm)" required>
      </div>
      <div class="col-md-3">
        <input type="number" step="0.1" min="1" max="40" name="balita_berat_badan[]" class="form-control" placeholder="Berat Badan (kg)" required>
      </div>
      <div class="col-md-6">
        <div class="d-flex align-items-center">
          <label class="me-3">Jenis Kelamin:</label>
          <div class="d-flex align-items-center">
            <div class="me-3">
              <input type="radio" id="jk_laki_${index}" name="balita_jenis_kelamin[${index}]" value="Laki-laki" required>
              <label for="jk_laki_${index}" class="ms-1">Laki-laki</label>
            </div>
            <div>
              <input type="radio" id="jk_perempuan_${index}" name="balita_jenis_kelamin[${index}]" value="Perempuan" required>
              <label for="jk_perempuan_${index}" class="ms-1">Perempuan</label>
            </div>
          </div>
        </div>
        <small class="text-muted">* Pilih jenis kelamin balita.</small>
      </div>
    </div>
    <button type="button" class="btn btn-danger btn-sm mt-2 balita-remove-btn" style="border-radius: 50%; width: 30px; height: 30px; padding: 0; display: flex; align-items: center; justify-content: center; background-color: #EAA0A3; border-color: #EAA0A3; position: absolute; top: 5px; right: 15px;"><i class="bi bi-x" style="font-weight: bold;"></i></button>
  `;
  container.appendChild(newBalita);
  balitaCount++;
  attachDatepickerToEntry(newBalita);
  return newBalita;
}
// Menambahkan data balita
function addBalita() {
  if (balitaCount >= MAX_BALITA_PER_PENGISIAN) {
    alert(`Maksimal penambahan balita adalah ${MAX_BALITA_PER_PENGISIAN}.`);
    return;
  }
  addNewBalitaEntry();
  checkBalitaFormValidity();
  updateAddButtonVisibility();
}
// Menghapus data balita
function removeBalita(button) {
  const entry = button.parentElement;
  const isExistingBalita = entry.getAttribute('data-existing-balita') === 'true';
  if (isExistingBalita) {
    const confirmed = confirm('Balita ini tidak akan disertakan dalam pengisian kali ini. Data balita TIDAK akan dihapus dari sistem, hanya tidak ikut diukur/dianalisis untuk pengisian sekarang. Lanjutkan?');
    if (!confirmed) return;
  }
  entry.remove();
  balitaCount--;
  updateBalitaNumbers();
  checkBalitaFormValidity();
  updateAddButtonVisibility();
}
// Memperbarui visibilitas tombol tambah
function updateAddButtonVisibility() {
  const addButton = document.getElementById('addBalitaBtn');
  if (addButton) {
    if (balitaCount >= MAX_BALITA_PER_PENGISIAN) {
      addButton.style.display = 'none';
    } else {
      addButton.style.display = 'inline-block';
    }
  }
}
// Memperbarui nomor urut balita
function updateBalitaNumbers() {
  const entries = document.querySelectorAll('.balita-entry');
  entries.forEach((entry, index) => {
    const h5 = entry.querySelector('h5');
    if (h5) h5.textContent = `Balita ${index + 1}`;
    const lakiRadio = entry.querySelector('input[type="radio"][value="Laki-laki"]');
    const perempuanRadio = entry.querySelector('input[type="radio"][value="Perempuan"]');
    if (lakiRadio && perempuanRadio) {
      const groupName = `balita_jenis_kelamin[${index}]`;
      const lakiId = `jk_laki_${index}`;
      const perempuanId = `jk_perempuan_${index}`;
      lakiRadio.name = groupName;
      lakiRadio.id = lakiId;
      perempuanRadio.name = groupName;
      perempuanRadio.id = perempuanId;
      const lakiLabel = entry.querySelector(`label[for^="jk_laki_"]`);
      const perempuanLabel = entry.querySelector(`label[for^="jk_perempuan_"]`);
      if (lakiLabel) lakiLabel.setAttribute('for', lakiId);
      if (perempuanLabel) perempuanLabel.setAttribute('for', perempuanId);
    }
  });
}

const balitaForm = document.getElementById('balitaForm');
const lanjutkanBalitaBtn = document.getElementById('lanjutkanBalitaBtn');
// Memvalidasi kewajaran tinggi dan berat badan
function isTBBBReasonable(input, min, max, unitLabel, fieldLabel, rangeText) {
  const raw = input.value.trim();
  if (raw === '') {
    input.classList.remove('is-invalid');
    return true;
  }
  const val = parseFloat(raw);
  const reasonable = !isNaN(val) && val >= min && val <= max;
  let feedback = input.nextElementSibling;
  if (!feedback || !feedback.classList.contains('invalid-feedback')) {
    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    input.insertAdjacentElement('afterend', feedback);
  }
  if (reasonable) {
    input.classList.remove('is-invalid');
  } else {
    input.classList.add('is-invalid');
    feedback.innerHTML = `${fieldLabel} tidak valid.<br>Masukkan nilai ${rangeText} ${unitLabel}.`;
  }
  return reasonable;
}

// ==========================================
// SECTION: Growth Validation
// ==========================================
const tbHistoryCache = new Map();
// Mengambil riwayat tinggi badan
function fetchTbHistory(idBalita) {
  if (tbHistoryCache.has(idBalita)) return tbHistoryCache.get(idBalita);
  const promise = fetch(`/pengisian/balita/${idBalita}`)
    .then(r => r.ok ? r.json() : [])
    .catch(() => []);
  tbHistoryCache.set(idBalita, promise);
  return promise;
}
// Memasang validasi riwayat tinggi badan
async function attachTbHistoryValidation(entry, idBalita, tanggalLahir) {
  if (!entry || !idBalita || !tanggalLahir) return;

  const history = await fetchTbHistory(idBalita);
  if (!Array.isArray(history) || history.length === 0) return;

  const currentAgeMonths = calculateAgeInMonths(tanggalLahir);
  let maxTb = null;
  let maxTbAgeLabel = '';
  history.forEach(h => {
    if (h.tb_balita == null || !h.tanggal_pengisian) return;
    const ageAtP = calculateAgeInMonths(tanggalLahir, h.tanggal_pengisian);
    if (ageAtP < currentAgeMonths && (maxTb === null || h.tb_balita > maxTb)) {
      maxTb = h.tb_balita;
      maxTbAgeLabel = h.umur || formatUsiaBulan(ageAtP);
    }
  });

  if (maxTb !== null) {
    entry.dataset.tbMinRequired = maxTb;
    entry.dataset.tbMinRequiredAgeLabel = maxTbAgeLabel;
  } else {
    delete entry.dataset.tbMinRequired;
    delete entry.dataset.tbMinRequiredAgeLabel;
  }
  checkBalitaFormValidity();
}
// Memeriksa tinggi badan tidak menurun
function isTBNotDecreasing(input, entry) {
  const raw = input.value.trim();
  const minRequired = entry?.dataset?.tbMinRequired ? parseFloat(entry.dataset.tbMinRequired) : null;
  if (raw === '' || minRequired === null || isNaN(minRequired)) return true;

  const val = parseFloat(raw);
  if (isNaN(val)) return true;

  let feedback = input.nextElementSibling;
  if (!feedback || !feedback.classList.contains('invalid-feedback')) {
    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    input.insertAdjacentElement('afterend', feedback);
  }

  if (val < minRequired) {
    input.classList.add('is-invalid');
    feedback.innerHTML = `Tinggi badan tidak valid.<br>Lebih kecil dari sebelumnya.<br>(${minRequired} cm pada usia ${entry.dataset.tbMinRequiredAgeLabel}).`;
    return false;
  }
  input.classList.remove('is-invalid');
  return true;
}
// Memvalidasi kewajaran usia balita
function isUmurBalitaReasonable(input) {
  const raw = input.value.trim();
  const wrapper = input.closest('.input-group') || input;

  let feedback = wrapper.nextElementSibling;
  if (!feedback || !feedback.classList.contains('invalid-feedback-umur')) {
    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback invalid-feedback-umur';
    wrapper.insertAdjacentElement('afterend', feedback);
  }

  if (raw === '') {
    input.classList.remove('is-invalid');
    feedback.style.display = 'none';
    return true;
  }

  const birthDate = convertDateFormat(raw);
  const age = calculateAge(birthDate);
  const reasonable = !isNaN(age) && age >= 0 && !isOverFiveYears(birthDate);

  if (reasonable) {
    input.classList.remove('is-invalid');
    feedback.style.display = 'none';
  } else {
    input.classList.add('is-invalid');
    feedback.innerHTML = `Tanggal lahir tidak valid.<br>Usia balita maksimal 5 tahun (usia saat ini: ${age} tahun).`;
    feedback.style.display = 'block';
  }
  return reasonable;
}
// Memvalidasi form balita
function checkBalitaFormValidity() {
  const balitaEntries = balitaForm.querySelectorAll('.balita-entry');
  let isValid = balitaEntries.length > 0;
  const requiredFields = balitaForm.querySelectorAll('input[required]');
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      isValid = false;
    }
  });

  balitaForm.querySelectorAll('input[name="balita_tinggi_badan[]"]').forEach(input => {
    if (!isTBBBReasonable(input, TB_BALITA_MIN, TB_BALITA_MAX, 'cm', 'Tinggi badan', '40–130')) {
      isValid = false;
      return;
    }
    const entryEl = input.closest('.balita-entry');
    if (entryEl && !isTBNotDecreasing(input, entryEl)) isValid = false;
  });
  balitaForm.querySelectorAll('input[name="balita_berat_badan[]"]').forEach(input => {
    if (!isTBBBReasonable(input, BB_BALITA_MIN, BB_BALITA_MAX, 'kg', 'Berat badan', '1-40')) isValid = false;
  });

  balitaForm.querySelectorAll('input[name="balita_tanggal_lahir[]"]').forEach(input => {
    if (!isUmurBalitaReasonable(input)) isValid = false;
  });

  const genderRadios = balitaForm.querySelectorAll('input[name^="balita_jenis_kelamin"]');
  const genderGroups = {};
  genderRadios.forEach(radio => {
    const group = radio.name;
    if (!genderGroups[group]) genderGroups[group] = [];
    genderGroups[group].push(radio);
  });
  for (const group in genderGroups) {
    const checked = genderGroups[group].some(radio => radio.checked);
    if (!checked) {
      isValid = false;
      break;
    }
  }
  lanjutkanBalitaBtn.disabled = !isValid;
}

balitaForm.addEventListener('input', checkBalitaFormValidity);
balitaForm.addEventListener('change', checkBalitaFormValidity);

checkBalitaFormValidity();

let restoreModalState = {
  entryEl: null,
  existingBalitaId: null,
  payload: null,
};
// Mereset state modal pemulihan
function resetRestoreModalState() {
  restoreModalState.entryEl = null;
  restoreModalState.existingBalitaId = null;
  restoreModalState.payload = null;
}
// Mereset ke section orang tua
function resetToOrangTuaSection() {
  existingParentData = null;
  verifiedParentEmail = null;

  const emailInputEl = document.getElementById('emailInput');
  if (emailInputEl) {
    emailInputEl.disabled = false;
    emailInputEl.value = '';
  }
  const tanggalLahirEl = document.querySelector('input[name="tanggal_lahir"]');
  if (tanggalLahirEl) {
    tanggalLahirEl.disabled = false;
    tanggalLahirEl.value = '';
  }
  const gondokChecked = document.querySelector('input[name="riwayat_gondok"]:checked');
  if (gondokChecked) gondokChecked.checked = false;
  checkFormValidity();

  document.getElementById('balitaContainer').innerHTML = '';
  balitaCount = 0;
  addNewBalitaEntry();
  updateAddButtonVisibility();
  checkBalitaFormValidity();

  savedAnswers = {};
  balitaData = [];
  const generalQuestionsEl = document.getElementById('generalQuestions');
  const balitaTabsEl = document.getElementById('balitaTabs');
  const balitaTabContentEl = document.getElementById('balitaTabContent');
  if (generalQuestionsEl) generalQuestionsEl.innerHTML = '';
  if (balitaTabsEl) balitaTabsEl.innerHTML = '';
  if (balitaTabContentEl) balitaTabContentEl.innerHTML = '';
  const nextBtnKuesionerEl = document.getElementById('nextBtnKuesioner');
  if (nextBtnKuesionerEl) nextBtnKuesionerEl.disabled = true;
  if (lanjutkanBalitaBtn) lanjutkanBalitaBtn.disabled = true;
}

document.getElementById('kembaliBtnBalita').addEventListener('click', function () {
  resetToOrangTuaSection();

  showSection(1);
});

const restoreModalEl = document.createElement('div');
restoreModalEl.innerHTML = `
  <div class="modal fade" id="restoreBalitaModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content" style="border-radius: 15px; border: none; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div class="modal-header" style="background: #212E48; color: white; border-radius: 15px 15px 0 0; border-bottom: none;">
          <h5 class="modal-title" style="font-family: 'Mont-HeavyDEMO', var(--heading-font); font-size: 1.5rem; color: white; padding-left: 15px;">
            Data Balita Ditemukan
          </h5>
        </div>
        <div class="modal-body" style="padding: 1.75rem 1.5rem;">
          <p style="margin-bottom: 1rem;" id="restoreBalitaIntroText">Kami menemukan data balita dengan identitas yang sama. Silakan pastikan apakah data berikut adalah balita Anda.</p>
          <div class="alert alert-warning" style="margin-bottom: 1rem; display:none;" id="restoreOverAgeAlert">
            <i class="bi bi-exclamation-triangle-fill"></i>
            Anak ini sudah berusia lebih dari 5 tahun, sehingga sudah berada di luar rentang usia yang dapat dianalisis oleh sistem. Data pengisian sebelumnya tetap tersimpan sebagai riwayat, namun pengisian baru untuk anak ini tidak dapat dilanjutkan.
          </div>
          <div class="alert alert-info" style="margin-bottom: 1rem; display:none;" id="restoreBalitaFoundInfo"></div>
          <table class="table table-sm table-borderless">
            <tbody>
              <tr><td class="fw-semibold" style="width: 35%;">Nama</td><td id="restoreNama"></td></tr>
              <tr><td class="fw-semibold">Tanggal Lahir</td><td id="restoreTanggalLahir"></td></tr>
              <tr><td class="fw-semibold">Jenis Kelamin</td><td id="restoreJenisKelamin"></td></tr>
              <tr><td class="fw-semibold">Tinggi Badan Terakhir</td><td id="restoreTinggi"></td></tr>
              <tr><td class="fw-semibold">Berat Badan Terakhir</td><td id="restoreBerat"></td></tr>
              <tr><td class="fw-semibold">Terakhir Diisi</td><td id="restoreTerakhirDiisi"></td></tr>
            </tbody>
          </table>
          <div class="text-muted" style="font-size: 0.9rem;" id="restoreConfirmHintText">Pastikan pilihan Anda sesuai sebelum melanjutkan.</div>
        </div>
        <div class="modal-footer" style="padding: 1.5rem 2rem; justify-content: center;">
          <button type="button" class="btn" data-restore-action="use" id="restoreUseBtn" style="border-radius: 25px; padding: 10px 30px; background-color: #EAA0A3; border-color: #EAA0A3; color: white; font-weight: 500;">Ya, Gunakan Data Ini</button>
          <button type="button" class="btn btn-outline-secondary" data-restore-action="not" id="restoreNotBtn" style="border-radius: 25px; padding: 10px 30px; font-weight: 500;">Batal</button>
          <button type="button" class="btn" data-restore-action="understand" id="restoreUnderstandBtn" style="display:none; border-radius: 25px; padding: 10px 30px; background-color: #EAA0A3; border-color: #EAA0A3; color: white; font-weight: 500;">Saya Mengerti</button>
        </div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(restoreModalEl);
// Menangani restore use btn
const restoreUseBtn = () => document.getElementById('restoreUseBtn');
// Menangani restore not btn
const restoreNotBtn = () => document.getElementById('restoreNotBtn');

let restoreModalInstance = null;
// Mengisi field modal pemulihan
function setRestoreModalFields(payload) {
  const b = payload?.balita || {};
  const p = payload?.latest_pengisian || {};
  document.getElementById('restoreNama').textContent = b.nama_balita || '-';
  document.getElementById('restoreTanggalLahir').textContent = b.tanggal_lahir ? formatTanggalIndo(b.tanggal_lahir) : '-';
  document.getElementById('restoreJenisKelamin').textContent = b.jenis_kelamin || '-';
  document.getElementById('restoreTinggi').textContent = p.tb_balita != null ? `${p.tb_balita} cm` : '-';
  document.getElementById('restoreBerat').textContent = p.bb_balita != null ? `${p.bb_balita} kg` : '-';
  document.getElementById('restoreTerakhirDiisi').textContent = p.tanggal_pengisian ? formatTanggalIndo(p.tanggal_pengisian) : '-';
}
// Membuka modal pemulihan
function openRestoreModal(payload, entryEl) {
  resetRestoreModalState();
  restoreModalState.entryEl = entryEl;
  restoreModalState.existingBalitaId = payload?.balita?.id_balita || null;
  restoreModalState.payload = payload;

  setRestoreModalFields(payload);

  const tanggalLahirBalita = payload?.balita?.tanggal_lahir;
  const isOverAge = !!tanggalLahirBalita && isOverFiveYears(tanggalLahirBalita);

  const introText = document.getElementById('restoreBalitaIntroText');
  const overAgeAlert = document.getElementById('restoreOverAgeAlert');
  const confirmHint = document.getElementById('restoreConfirmHintText');
  const useBtnEl = restoreUseBtn();
  const notBtnEl = restoreNotBtn();
  const understandBtnEl = document.getElementById('restoreUnderstandBtn');

  if (isOverAge) {
    if (introText) introText.style.display = 'none';
    if (overAgeAlert) overAgeAlert.style.display = 'block';
    if (confirmHint) confirmHint.style.display = 'none';
    if (useBtnEl) useBtnEl.style.display = 'none';
    if (notBtnEl) notBtnEl.style.display = 'none';
    if (understandBtnEl) understandBtnEl.style.display = 'inline-block';
  } else {
    if (introText) introText.style.display = '';
    if (overAgeAlert) overAgeAlert.style.display = 'none';
    if (confirmHint) confirmHint.style.display = '';
    if (useBtnEl) useBtnEl.style.display = 'inline-block';
    if (notBtnEl) notBtnEl.style.display = 'inline-block';
    if (understandBtnEl) understandBtnEl.style.display = 'none';
  }

  const modalEl = document.getElementById('restoreBalitaModal');
  restoreModalInstance = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
  modalEl.addEventListener('hidden.bs.modal', () => {
    resetRestoreModalState();
  }, { once: true });

  const notBtn = restoreNotBtn();
  // Menangani event modal
  const handler = () => {
    const entry = restoreModalState.entryEl;
    if (entry) {
      delete entry.dataset.tbMinRequired;
      delete entry.dataset.tbMinRequiredAgeLabel;
      const namaInput = entry.querySelector('input[name="balita_nama[]"]');
      const tanggalInput = entry.querySelector('input[name="balita_tanggal_lahir[]"]');
      const tinggiInput = entry.querySelector('input[name="balita_tinggi_badan[]"]');
      const beratInput = entry.querySelector('input[name="balita_berat_badan[]"]');
      if (namaInput) namaInput.value = '';
      if (tanggalInput) tanggalInput.value = '';
      if (tinggiInput) tinggiInput.value = '';
      if (beratInput) beratInput.value = '';
      entry.querySelectorAll('input[name^="balita_jenis_kelamin"]').forEach(r => r.checked = false);
    }
    const modal = bootstrap.Modal.getInstance(document.getElementById('restoreBalitaModal'));
    if (modal) modal.hide();
    checkBalitaFormValidity();
  };

  if (notBtn) {
    if (notBtn._bbPrevHandler) {
      notBtn.removeEventListener('click', notBtn._bbPrevHandler);
    }
    notBtn._bbPrevHandler = handler;
    notBtn.addEventListener('click', handler);
  }

  const understandBtn = document.getElementById('restoreUnderstandBtn');
  if (understandBtn) {
    if (understandBtn._bbPrevHandler) {
      understandBtn.removeEventListener('click', understandBtn._bbPrevHandler);
    }
    understandBtn._bbPrevHandler = handler;
    understandBtn.addEventListener('click', handler);
  }
  const useBtn = restoreUseBtn();
  // Menangani aksi penggunaan data
  const useHandler = () => {
    const entry = restoreModalState.entryEl;
    if (entry) {
      const namaInput = entry.querySelector('input[name="balita_nama[]"]');
      const tanggalInput = entry.querySelector('input[name="balita_tanggal_lahir[]"]');
      const key = normalizeKey(namaInput?.value || '', tanggalInput?.value || '');
      const otherEntries = Array.from(document.querySelectorAll('#balitaContainer .balita-entry')).filter(e => e !== entry);
      const alreadyShownElsewhere = otherEntries.some(e => {
        const n = e.querySelector('input[name="balita_nama[]"]')?.value || '';
        const t = e.querySelector('input[name="balita_tanggal_lahir[]"]')?.value || '';
        return normalizeKey(n, t) === key;
      });
      if (alreadyShownElsewhere) {
        alert('Data balita ini sudah ditampilkan di entry lain pada form ini. Setiap balita hanya boleh muncul satu kali.');
        if (namaInput) namaInput.value = '';
        if (tanggalInput) tanggalInput.value = '';
        const modalBlocked = bootstrap.Modal.getInstance(document.getElementById('restoreBalitaModal'));
        if (modalBlocked) modalBlocked.hide();
        checkBalitaFormValidity();
        return;
      }
      entry.setAttribute('data-existing-balita', 'true');

      const b = restoreModalState.payload?.balita || {};
      if (namaInput) {
        if (b.nama_balita) namaInput.value = b.nama_balita;
        namaInput.disabled = true;
      }
      if (tanggalInput) {
        tanggalInput.disabled = true;
      }
      const jkRadios = entry.querySelectorAll('input[name^="balita_jenis_kelamin"]');
      jkRadios.forEach(radio => {
        if (b.jenis_kelamin) {
          radio.checked = (radio.value === b.jenis_kelamin);
        }
        radio.disabled = true;
      });

      if (!entry.querySelector('.existing-balita-hint')) {
        const hint = document.createElement('small');
        hint.className = 'text-muted d-block mt-2 existing-balita-hint';
        hint.innerHTML = '<i class="bi bi-info-circle"></i> Balita ini sudah pernah terdaftar. Klik &times; jika balita ini tidak ikut diukur pada pengisian kali ini &mdash; data balita tetap tersimpan di sistem.';
        entry.appendChild(hint);
      }
      if (restoreModalState.existingBalitaId && b.tanggal_lahir) {
        attachTbHistoryValidation(entry, restoreModalState.existingBalitaId, b.tanggal_lahir);
      }
    }
    const modal = bootstrap.Modal.getInstance(document.getElementById('restoreBalitaModal'));
    if (modal) modal.hide();
    checkBalitaFormValidity();
  };
  if (useBtn) {
    if (useBtn._bbPrevHandler) {
      useBtn.removeEventListener('click', useBtn._bbPrevHandler);
    }
    useBtn._bbPrevHandler = useHandler;
    useBtn.addEventListener('click', useHandler);
  }

  restoreModalInstance.show();
}
// Menangani pemulihan data balita
async function handleBalitaRestoreIfNeeded(entryEl) {
  const namaInput = entryEl.querySelector('input[name="balita_nama[]"]');
  const tanggalInput = entryEl.querySelector('input[name="balita_tanggal_lahir[]"]');
  const nama = namaInput?.value || '';
  const tanggal = tanggalInput?.value || '';

  checkBalitaFormValidity();

  if (!nama.trim() || !tanggal.trim()) return;

  const key = normalizeKey(nama, tanggal);
  const entries = Array.from(document.querySelectorAll('#balitaContainer .balita-entry'));
  const duplicate = entries.some(e => {
    if (e === entryEl) return false;
    const n = e.querySelector('input[name="balita_nama[]"]')?.value || '';
    const t = e.querySelector('input[name="balita_tanggal_lahir[]"]')?.value || '';
    return normalizeKey(n, t) === key;
  });

  if (duplicate) {
    alert('Balita dengan nama dan tanggal lahir yang sama sudah ada pada form ini. Setiap balita hanya boleh diinput satu kali. Silakan masukkan identitas balita yang berbeda.');
    if (namaInput) namaInput.value = '';
    if (tanggalInput) tanggalInput.value = '';
    checkBalitaFormValidity();
    return;
  }

  const parentIdOrangTua = existingParentData?.parent?.id_orang_tua;
  if (!parentIdOrangTua) {
    return;
  }

  const restoreUrl = `/identitas_balita/restore?id_orang_tua=${encodeURIComponent(parentIdOrangTua)}&nama=${encodeURIComponent(nama)}&tanggal_lahir=${encodeURIComponent(tanggal)}`;

  try {
    const r = await fetch(restoreUrl);
    if (!r.ok) return;
    const payload = await r.json();
    if (!payload?.found) return;

    openRestoreModal(payload, entryEl);
  } catch (e) {
    console.error('restore error', e);
  }

}

document.getElementById('balitaContainer').addEventListener('blur', function (e) {
  const target = e.target;
  if (!target.matches) return;
  if (target.matches('input[name="balita_nama[]"], input[name="balita_tanggal_lahir[]"]')) {
    const entryEl = target.closest('.balita-entry');
    if (entryEl) handleBalitaRestoreIfNeeded(entryEl);
  }
}, true);

const duplicateUsiaModalEl = document.createElement('div');
duplicateUsiaModalEl.innerHTML = `
  <div class="modal fade" id="duplicateUsiaModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content" style="border-radius: 15px; border: none; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div class="modal-header" style="background: #212E48; color: white; border-radius: 15px 15px 0 0; border-bottom: none;">
          <h5 class="modal-title" style="font-family: 'Mont-HeavyDEMO', var(--heading-font); font-size: 1.4rem; color: white; padding-left: 10px;">
            Pengisian Sudah Pernah Dilakukan
          </h5>
        </div>
        <div class="modal-body" style="padding: 1.75rem 1.5rem;">
          <p id="duplicateUsiaText" style="margin-bottom: 0.5rem;"></p>
          <p style="margin-bottom: 0; color:#6c757d; font-size: 0.95rem;">Jika Anda melanjutkan, data pengisian pada tanggal tersebut akan dihapus dan digantikan dengan data pengisian yang baru.</p>
        </div>
        <div class="modal-footer" style="padding: 1.5rem 2rem; justify-content: center;">
          <button type="button" class="btn" id="duplicateUsiaYaBtn" style="border-radius: 25px; padding: 10px 30px; background-color: #EAA0A3; border-color: #EAA0A3; color: white; font-weight: 500;">Ya, Lanjutkan &amp; Ganti</button>
          <button type="button" class="btn btn-outline-secondary" id="duplicateUsiaTidakBtn" style="border-radius: 25px; padding: 10px 30px; font-weight: 500;">Tidak</button>
        </div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(duplicateUsiaModalEl);
// Mengonfirmasi duplikasi usia
function confirmDuplicateUsia(namaBalita, checkData) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById('duplicateUsiaModal');
    const textEl = document.getElementById('duplicateUsiaText');
    const yaBtn = document.getElementById('duplicateUsiaYaBtn');
    const tidakBtn = document.getElementById('duplicateUsiaTidakBtn');

    const tanggalLama = formatTanggalIndo(checkData?.duplicate?.tanggal_pengisian) || '-';
    const usia = formatUsiaBulan(checkData?.age_months_now);
    textEl.textContent = `Balita ${namaBalita} sudah pernah melakukan pengisian pada tanggal ${tanggalLama} untuk usia ${usia}. Apakah Anda ingin melanjutkan pengisian untuk usia yang sama ini?`;

    const modalInstance = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

    const submitOverlayEl = document.getElementById('submitOverlay');
    const overlayWasActive = !!(submitOverlayEl && submitOverlayEl.classList.contains('active'));
    if (overlayWasActive) submitOverlayEl.classList.remove('active');
    // Mengambil overlay pemulihan
    const restoreOverlay = () => {
      if (overlayWasActive && submitOverlayEl) submitOverlayEl.classList.add('active');
    };

    let resolved = false;
    // Membersihkan event modal
    const cleanup = () => {
      yaBtn.removeEventListener('click', onYa);
      tidakBtn.removeEventListener('click', onTidak);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    };
    // Menangani pilihan Ya
    const onYa = () => {
      resolved = true;
      modalInstance.hide();
      cleanup();
      restoreOverlay();
      resolve(true);
    };
    // Menangani pilihan Tidak
    const onTidak = () => {
      resolved = true;
      modalInstance.hide();
      cleanup();
      resolve(false);
    };
    // Menangani event modal ditutup
    const onHidden = () => {
      cleanup();
      if (!resolved) {
        restoreOverlay();
        resolve(false);
      }
    };

    yaBtn.addEventListener('click', onYa);
    tidakBtn.addEventListener('click', onTidak);
    modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });

    modalInstance.show();
  });
}

const multiDuplicateUsiaModalEl = document.createElement('div');
multiDuplicateUsiaModalEl.innerHTML = `
  <div class="modal fade" id="multiDuplicateUsiaModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content" style="border-radius: 15px; border: none; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div class="modal-header" style="background: #212E48; color: white; border-radius: 15px 15px 0 0; border-bottom: none;">
          <h5 class="modal-title" id="multiDuplicateUsiaModalTitle" style="font-family: 'Mont-HeavyDEMO', var(--heading-font); font-size: 1.4rem; color: white; padding-left: 10px;">
            Beberapa Balita Sudah Pernah Dianalisis
          </h5>
        </div>
        <div class="modal-body" style="padding: 1.75rem 1.5rem;">
          <p id="multiDuplicateUsiaIntroText" style="margin-bottom: 0.75rem;">Beberapa balita sudah pernah dianalisis pada umur yang sama dengan umur mereka saat ini:</p>
          <ul id="multiDuplicateUsiaList" style="margin-bottom: 1rem; padding-left: 1.25rem;"></ul>
          <p style="margin-bottom: 0; color:#6c757d; font-size: 0.95rem;">Pilih salah satu tindakan di bawah ini.</p>
        </div>
        <div class="modal-footer" style="padding: 1.5rem 2rem; justify-content: center; flex-wrap: wrap; gap: 10px;">
          <button type="button" class="btn" id="multiDuplicateKirimGantiBtn" style="border-radius: 25px; padding: 10px 20px; background-color: #EAA0A3; border-color: #EAA0A3; color: white; font-weight: 500;">Kirim Semua &amp; Perbarui yang Sudah Dianalisis</button>
          <button type="button" class="btn kuesioner-btn-outline-pink" id="multiDuplicateKirimBelumBtn" style="border-radius: 25px; padding: 10px 20px; font-weight: 500;">Kirim Hanya yang Belum Dianalisis</button>
          <button type="button" class="btn btn-outline-secondary" id="multiDuplicateBatalkanBtn" style="border-radius: 25px; padding: 10px 20px; font-weight: 500;">Batalkan Semua</button>
        </div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(multiDuplicateUsiaModalEl);
// Mengonfirmasi beberapa duplikasi usia
function confirmMultiDuplicateUsia(duplicates, allDuplicated) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById('multiDuplicateUsiaModal');
    const titleEl = document.getElementById('multiDuplicateUsiaModalTitle');
    const introEl = document.getElementById('multiDuplicateUsiaIntroText');
    const listEl = document.getElementById('multiDuplicateUsiaList');
    const kirimGantiBtn = document.getElementById('multiDuplicateKirimGantiBtn');
    const kirimBelumBtn = document.getElementById('multiDuplicateKirimBelumBtn');
    const batalkanBtn = document.getElementById('multiDuplicateBatalkanBtn');

    kirimBelumBtn.style.display = allDuplicated ? 'none' : '';
    titleEl.textContent = allDuplicated
      ? 'Semua Balita Sudah Pernah Dianalisis'
      : 'Beberapa Balita Sudah Pernah Dianalisis';
    introEl.textContent = allDuplicated
      ? 'Semua balita sudah pernah dianalisis pada umur yang sama dengan umur mereka saat ini:'
      : 'Beberapa balita sudah pernah dianalisis pada umur yang sama dengan umur mereka saat ini:';

    listEl.innerHTML = duplicates.map(dup => {
      const tanggalLama = formatTanggalIndo(dup.checkData?.duplicate?.tanggal_pengisian) || '-';
      const usia = formatUsiaBulan(dup.checkData?.age_months_now);
      return `<li><strong>${dup.nama}</strong> &mdash; sudah diisi pada ${tanggalLama} untuk usia ${usia}</li>`;
    }).join('');

    const modalInstance = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

    const submitOverlayEl = document.getElementById('submitOverlay');
    const overlayWasActive = !!(submitOverlayEl && submitOverlayEl.classList.contains('active'));
    if (overlayWasActive) submitOverlayEl.classList.remove('active');
    // Mengambil overlay pemulihan
    const restoreOverlay = () => {
      if (overlayWasActive && submitOverlayEl) submitOverlayEl.classList.add('active');
    };

    let resolved = false;
    // Membersihkan event modal
    const cleanup = () => {
      kirimGantiBtn.removeEventListener('click', onKirimGanti);
      kirimBelumBtn.removeEventListener('click', onKirimBelum);
      batalkanBtn.removeEventListener('click', onBatalkan);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    };
    // Menangani pilihan kirim dan ganti
    const onKirimGanti = () => {
      resolved = true;
      modalInstance.hide();
      cleanup();
      restoreOverlay();
      resolve('all');
    };
    // Menangani pilihan kirim nanti
    const onKirimBelum = () => {
      resolved = true;
      modalInstance.hide();
      cleanup();
      restoreOverlay();
      resolve('partial');
    };
    // Menangani pembatalan
    const onBatalkan = () => {
      resolved = true;
      modalInstance.hide();
      cleanup();
      resolve('cancel');
    };
    // Menangani event modal ditutup
    const onHidden = () => {
      cleanup();
      if (!resolved) {
        restoreOverlay();
        resolve('cancel');
      }
    };

    kirimGantiBtn.addEventListener('click', onKirimGanti);
    kirimBelumBtn.addEventListener('click', onKirimBelum);
    batalkanBtn.addEventListener('click', onBatalkan);
    modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });

    modalInstance.show();
  });
}

let lastOpenedBalitaDateInput = null;

document.getElementById('balitaContainer').addEventListener('click', function (e) {
  const dateInput = e.target.closest('input.date-input[name="balita_tanggal_lahir[]"]');
  const iconSpan = e.target.closest('.input-group-text');
  if (dateInput) {
    lastOpenedBalitaDateInput = dateInput;
  } else if (iconSpan) {
    const relatedInput = iconSpan.closest('.input-group')?.querySelector('input[name="balita_tanggal_lahir[]"]');
    if (relatedInput) lastOpenedBalitaDateInput = relatedInput;
  }
}, true)

const datepickerModalEl = document.getElementById('datepicker-modal');
if (datepickerModalEl) {
  const datepickerObserver = new MutationObserver(() => {
    const isHidden = getComputedStyle(datepickerModalEl).display === 'none';
    if (isHidden && lastOpenedBalitaDateInput) {
      const capturedInput = lastOpenedBalitaDateInput;
      lastOpenedBalitaDateInput = null;
      setTimeout(() => {
        const entryEl = capturedInput.closest('.balita-entry');
        if (entryEl) handleBalitaRestoreIfNeeded(entryEl);
      }, 50);
    }
  });
  datepickerObserver.observe(datepickerModalEl, { attributes: true, attributeFilter: ['style'] });
}

lanjutkanBalitaBtn.addEventListener('click', function () {
  if (!lanjutkanBalitaBtn.disabled) {
    const balitaEntries = document.querySelectorAll('.balita-entry');
    let ageValid = true;
    let invalidAgeChildren = [];
    balitaEntries.forEach(entry => {
      const tanggalLahirRaw = entry.querySelector('input[name="balita_tanggal_lahir[]"]').value;
      const tanggalLahir = convertDateFormat(tanggalLahirRaw);
      const age = calculateAge(tanggalLahir);
      if (isOverFiveYears(tanggalLahir)) {
        ageValid = false;
        const childName = entry.querySelector('input[name="balita_nama[]"]').value;
        invalidAgeChildren.push(`${childName} (${age} tahun)`);
      }
    });
    if (!ageValid) {
      alert(`Usia balita yang diinput lebih dari 5 tahun (maksimal 5 tahun). Silakan periksa data berikut:\n- ${invalidAgeChildren.join('\n- ')}`);
      return;
    }
    let ukuranValid = true;
    let invalidUkuranChildren = [];
    balitaEntries.forEach(entry => {
      const tinggiBadan = parseFloat(entry.querySelector('input[name="balita_tinggi_badan[]"]').value);
      const beratBadan = parseFloat(entry.querySelector('input[name="balita_berat_badan[]"]').value);
      if (!(tinggiBadan > 0) || !(beratBadan > 0)) {
        ukuranValid = false;
        const childName = entry.querySelector('input[name="balita_nama[]"]').value;
        invalidUkuranChildren.push(childName || '(nama belum diisi)');
      }
    });
    if (!ukuranValid) {
      alert(`Tinggi badan dan berat badan harus berupa angka positif (lebih dari 0). Silakan periksa data berikut:\n- ${invalidUkuranChildren.join('\n- ')}`);
      return;
    }
    document.getElementById('balita').style.display = 'none';
    document.getElementById('kuesioner').style.display = 'block';
    updateProgressbar(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadKuesionerData();
  }
});

// ==========================================
// SECTION: Questionnaire
// ==========================================
let kuesionerData = [];
let skalaData = [];
let balitaData = [];
let savedAnswers = {};

const GENERAL_VARIABLES = ['X1', 'X2', 'X4', 'X6', 'X7', 'X8'];
const REPEATED_VARIABLES = ['X3', 'X5', 'X9', 'X10'];

// ==========================================
// SECTION: Questionnaire Data
// ==========================================
// Memuat data kuesioner
async function loadKuesionerData() {
  try {
    const [kuesionerResponse, skalaResponse] = await Promise.all([
      fetch('/kuesioner'),
      fetch('/kuesioner/skala')
    ]);
    if (!kuesionerResponse.ok || !skalaResponse.ok) {
      throw new Error('Failed to load kuesioner data');
    }
    kuesionerData = await kuesionerResponse.json();
    skalaData = await skalaResponse.json();
    balitaData = getBalitaData();

    populateKuesionerTabs();
    loadSavedAnswers();

    const allQuestionsAnswered = checkAllQuestionsAnswered();
    document.getElementById('nextBtnKuesioner').disabled = !allQuestionsAnswered;
  } catch (error) {
    console.error('Error loading kuesioner data:', error);
    alert('Gagal memuat data kuesioner. Silakan coba lagi.');
  }
}
// Mengambil data balita
function getBalitaData() {
  const balitaEntries = document.querySelectorAll('.balita-entry');
  const balitas = [];
  balitaEntries.forEach((entry, index) => {
    const nama = entry.querySelector('input[name="balita_nama[]"]').value;
    const tanggalLahir = convertDateFormat(entry.querySelector('input[name="balita_tanggal_lahir[]"]').value);
    const tinggiBadan = entry.querySelector('input[name="balita_tinggi_badan[]"]').value;
    const beratBadan = entry.querySelector('input[name="balita_berat_badan[]"]').value;
    const jenisKelamin = entry.querySelector(`input[name="balita_jenis_kelamin[${index}]"]:checked`)?.value;
    if (!(nama && tanggalLahir && tinggiBadan && beratBadan && jenisKelamin)) return;

    const balita = {
      nama: nama,
      tanggal_lahir: tanggalLahir,
      tinggi_badan: parseFloat(tinggiBadan),
      berat_badan: parseFloat(beratBadan),
      jenis_kelamin: jenisKelamin
    };

    const existingChild = existingParentData?.children.find(c => c.nama_balita === nama && c.tanggal_lahir === tanggalLahir);
    if (existingChild) {
      balita.existing_id = existingChild.id_balita;
    }
    balitas.push(balita);
  });
  return balitas;
}

// ==========================================
// SECTION: Questionnaire Rendering
// ==========================================
// Membangun tab kuesioner
function populateKuesionerTabs() {
  const generalContainer = document.getElementById('generalQuestions');
  const tabsContainer = document.getElementById('balitaTabs');
  const contentContainer = document.getElementById('balitaTabContent');
  generalContainer.innerHTML = '';
  tabsContainer.innerHTML = '';
  contentContainer.innerHTML = '';

  const variabelGroups = {};
  kuesionerData.forEach(item => {
    if (!variabelGroups[item.id_variabel]) variabelGroups[item.id_variabel] = [];
    variabelGroups[item.id_variabel].push(item);
  });

  let generalContent = '';
  GENERAL_VARIABLES.forEach(variabelId => {
    if (!variabelGroups[variabelId]) return;
    generalContent += buildCategoryBlock(variabelId, variabelGroups[variabelId], 'q_general', true);
  });
  generalContainer.innerHTML = generalContent;

  balitaData.forEach((balita, index) => {
    tabsContainer.appendChild(buildBalitaTab(balita, index));
    contentContainer.appendChild(buildBalitaPane(index, variabelGroups));
  });

  attachAutoScrollToRadios();
}

// ==========================================
// SECTION: Questionnaire Events
// ==========================================
// Membangun blok kategori pertanyaan
function buildCategoryBlock(variabelId, questions, radioNamePrefix, showDataCategory) {
  const categoryName = getVariabelName(variabelId);
  const dataAttr = showDataCategory ? ` data-category="${categoryName}"` : '';
  let html = `
    <div class="kv-var-card"${dataAttr}>
      <h4 class="kv-var-title">${categoryName}</h4>
      <div class="kv-var-body">
  `;
  groupByIndikator(questions).forEach(group => {
    html += `
      <div class="kv-indikator">
        <div class="kv-indikator-title">${group.label}</div>
        <div class="kv-indikator-questions">
    `;
    group.items.forEach(question => {
      html += buildQuestionItem(question, `${radioNamePrefix}_${question.id_item}`);
    });
    html += `</div></div>`;
  });
  html += `
      </div>
    </div>
  `;
  return html;
}
// Mengelompokkan pertanyaan per indikator (Variabel -> Indikator -> Item),
// urutan indikator mengikuti urutan kemunculan pertama pada data kuesioner
function groupByIndikator(questions) {
  const groups = {};
  const order = [];
  questions.forEach(question => {
    if (!groups[question.id_indikator]) {
      groups[question.id_indikator] = {
        id_indikator: question.id_indikator,
        label: question.indikator,
        items: [],
      };
      order.push(question.id_indikator);
    }
    groups[question.id_indikator].items.push(question);
  });
  return order.map(id => groups[id]);
}
// Singkatan skala jawaban untuk tampilan mobile
const SKALA_ABBR = {
  'Sangat Tidak Setuju': 'STS',
  'Tidak Setuju': 'TS',
  'Netral': 'N',
  'Setuju': 'S',
  'Sangat Setuju': 'SS'
};
// Membangun item pertanyaan
function buildQuestionItem(question, radioName) {
  let html = `
    <div class="question-item kv-question">
      <p class="kv-question-text">${question.pertanyaan}</p>
      <div class="skala-options">
  `;
  skalaData.forEach(skala => {
    html += `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="${radioName}" id="${radioName}_${skala.id_skala}" value="${skala.id_skala}" required>
        <label class="form-check-label" for="${radioName}_${skala.id_skala}">
          <span class="skala-full">${skala.skala}</span>
          <span class="skala-abbr">${SKALA_ABBR[skala.skala] || skala.skala}</span>
        </label>
      </div>
    `;
  });
  html += `
      </div>
    </div>
  `;
  return html;
}
// Membangun tab balita
function buildBalitaTab(balita, index) {
  const tab = document.createElement('li');
  tab.className = 'nav-item';
  tab.role = 'presentation';
  tab.innerHTML = `
    <a class="nav-link ${index === 0 ? 'active show' : ''}" id="balita-tab-${index}" data-bs-toggle="tab" data-bs-target="#balita-pane-${index}" role="tab" aria-controls="balita-pane-${index}" aria-selected="${index === 0 ? 'true' : 'false'}">
      <h4>${balita.nama}</h4>
    </a>
  `;
  return tab;
}
// Membangun pane balita
function buildBalitaPane(index, variabelGroups) {
  const pane = document.createElement('div');
  pane.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`;
  pane.id = `balita-pane-${index}`;
  pane.role = 'tabpanel';
  pane.setAttribute('aria-labelledby', `balita-tab-${index}`);

  let content = '';
  REPEATED_VARIABLES.forEach(variabelId => {
    if (!variabelGroups[variabelId]) return;
    content += buildCategoryBlock(variabelId, variabelGroups[variabelId], `q_${index}`, false);
  });
  pane.innerHTML = content;
  return pane;
}
// Mengambil nama variabel
function getVariabelName(idVariabel) {
  const variabels = {
    'X1': 'Pengetahuan Ibu',
    'X2': 'Tingkat Ekonomi',
    'X3': 'Pola Asuh',
    'X4': 'Layanan Kesehatan',
    'X5': 'Pola Makan Anak',
    'X6': 'Status Gizi Orang Tua',
    'X7': 'Lingkungan',
    'X8': 'Peran Pemerintah Daerah',
    'X9': 'Dukungan Keluarga',
    'X10': 'Status Gizi Anak'
  };
  return variabels[idVariabel] || idVariabel;
}

// ==========================================
// SECTION: Questionnaire Interaction
// ==========================================
// Memasang auto-scroll pada pilihan jawaban
function attachAutoScrollToRadios() {
  const allRadioButtons = document.querySelectorAll('#generalQuestions input[type="radio"], #balitaTabContent input[type="radio"]');
  allRadioButtons.forEach(radio => {
    radio.addEventListener('change', function () {
      savedAnswers[this.name] = this.value;
      scrollToNextQuestion(this.closest('.question-item'));

      checkAllQuestionsAnswered();
      setTimeout(() => {
        document.getElementById('nextBtnKuesioner').disabled = !checkAllQuestionsAnswered();
      }, 100);
    });
  });
}
// Menggulir ke pertanyaan berikutnya
function scrollToNextQuestion(questionItem) {
  const container = questionItem.closest('#generalQuestions') || questionItem.closest('.tab-pane');
  const allQuestions = container.querySelectorAll('.question-item');
  const currentIndex = Array.from(allQuestions).indexOf(questionItem);

  if (currentIndex < allQuestions.length - 1) {
    allQuestions[currentIndex + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (container.id === 'generalQuestions') {
    const firstTab = document.querySelector('#balitaTabs .nav-link');
    if (firstTab) {
      firstTab.click();
      setTimeout(scrollToFirstQuestionInActiveTab, 300);
    }
    return;
  }

  const allTabPanes = document.querySelectorAll('#balitaTabContent .tab-pane');
  const currentTabIndex = Array.from(allTabPanes).indexOf(container);
  if (currentTabIndex < allTabPanes.length - 1) {
    const nextTabLink = document.querySelectorAll('#balitaTabs .nav-link')[currentTabIndex + 1];
    if (nextTabLink) {
      nextTabLink.click();
      setTimeout(scrollToFirstQuestionInActiveTab, 300);
    }
  }
}
// Menggulir ke pertanyaan pertama pada tab aktif
function scrollToFirstQuestionInActiveTab() {
  const firstQuestion = document.querySelector('#balitaTabContent .tab-pane.active .question-item');
  if (firstQuestion) firstQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// Memeriksa kelengkapan jawaban
function checkAllQuestionsAnswered() {
  const allRadioButtons = document.querySelectorAll('#generalQuestions input[type="radio"], #balitaTabContent input[type="radio"]');
  const totalQuestions = document.querySelectorAll('#generalQuestions .question-item, #balitaTabContent .question-item').length;

  const answeredQuestions = new Set();
  allRadioButtons.forEach(radio => {
    if (radio.checked) answeredQuestions.add(radio.closest('.question-item'));
  });

  const progressPercentage = totalQuestions > 0 ? (answeredQuestions.size / totalQuestions) * 100 : 0;
  const progressBar = document.getElementById('questionnaireProgress');
  const progressText = document.getElementById('progressText');
  if (progressBar && progressText) {
    progressBar.style.width = progressPercentage + '%';
    progressBar.setAttribute('aria-valuenow', progressPercentage);
    progressText.textContent = Math.round(progressPercentage) + '%';
  }

  return answeredQuestions.size === totalQuestions;
}
// Memuat jawaban tersimpan
function loadSavedAnswers() {
  const allRadioButtons = document.querySelectorAll('#generalQuestions input[type="radio"], #balitaTabContent input[type="radio"]');
  allRadioButtons.forEach(radio => {
    if (savedAnswers[radio.name] === radio.value) radio.checked = true;
  });
}

// ==========================================
// SECTION: Submission
// ==========================================
// ==========================================
// SECTION: Submission Validation
// ==========================================
// Mengumpulkan seluruh jawaban
function collectAllAnswers() {
  const allAnswers = [];

  GENERAL_VARIABLES.forEach(variabelId => {
    kuesionerData.filter(q => q.id_variabel === variabelId).forEach(question => {
      const selectedRadio = document.querySelector(`input[name="q_general_${question.id_item}"]:checked`);
      if (selectedRadio) {
        allAnswers.push({ id_item: question.id_item, id_skala: parseInt(selectedRadio.value) });
      }
    });
  });

  balitaData.forEach((balita, balitaIndex) => {
    REPEATED_VARIABLES.forEach(variabelId => {
      kuesionerData.filter(q => q.id_variabel === variabelId).forEach(question => {
        const selectedRadio = document.querySelector(`input[name="q_${balitaIndex}_${question.id_item}"]:checked`);
        if (selectedRadio) {
          allAnswers.push({ id_item: question.id_item, id_skala: parseInt(selectedRadio.value), balita_index: balitaIndex });
        }
      });
    });
  });

  return allAnswers;
}
// Menghitung jumlah jawaban yang diharapkan
function getExpectedAnswerCount() {
  const totalGeneralQuestions = kuesionerData.filter(q => GENERAL_VARIABLES.includes(q.id_variabel)).length;
  const totalRepeatedQuestions = kuesionerData.filter(q => REPEATED_VARIABLES.includes(q.id_variabel)).length;
  return totalGeneralQuestions + (balitaData.length * totalRepeatedQuestions);
}

// ==========================================
// SECTION: Duplicate Submission Check
// ==========================================
// Mencari duplikasi usia
async function findDuplicateUsia() {
  const duplicates = [];
  for (let i = 0; i < balitaData.length; i++) {
    const balita = balitaData[i];
    if (!balita.existing_id) continue;
    try {
      const checkResp = await fetch(`/pengisian/check-usia/${balita.existing_id}`);
      if (!checkResp.ok) continue;
      const checkData = await checkResp.json();
      if (checkData.has_duplicate) duplicates.push({ index: i, nama: balita.nama, checkData });
    } catch (e) {
      console.error('Gagal memeriksa duplikasi usia:', e);
    }
  }
  return duplicates;
}
// Menangani duplikasi usia
async function resolveDuplicateUsia(duplicates) {
  const pengisianToDelete = {};
  const balitaToSkip = new Set();

  if (duplicates.length === 0) return { pengisianToDelete, balitaToSkip };

  if (balitaData.length === 1) {
    const dup = duplicates[0];
    const lanjutkan = await confirmDuplicateUsia(dup.nama, dup.checkData);
    if (!lanjutkan) {
      const params = new URLSearchParams({
        isi_lagi_notice: '1',
        nama_balita: dup.nama || '',
        next_fill_date: formatTanggalIndo(dup.checkData.next_fill_date) || '',
        next_fill_age: formatUsiaBulan(dup.checkData.next_fill_age)
      });
      window.location.href = `/?${params.toString()}`;
      return null;
    }
    pengisianToDelete[dup.index] = dup.checkData.duplicate.id_pengisian;
    return { pengisianToDelete, balitaToSkip };
  }

  const allDuplicated = duplicates.length === balitaData.length;
  const choice = await confirmMultiDuplicateUsia(duplicates, allDuplicated);

  if (choice === 'cancel') {
    window.location.href = '/';
    return null;
  }

  if (choice === 'all') {
    duplicates.forEach(dup => { pengisianToDelete[dup.index] = dup.checkData.duplicate.id_pengisian; });
    return { pengisianToDelete, balitaToSkip };
  }

  duplicates.forEach(dup => balitaToSkip.add(dup.index));
  if (balitaToSkip.size === balitaData.length) {
    alert('Semua balita sudah pernah dianalisis pada umur saat ini, sehingga tidak ada data yang dikirim.');
    window.location.href = '/';
    return null;
  }
  return { pengisianToDelete, balitaToSkip };
}

// ==========================================
// SECTION: Submission Request
// ==========================================
// Mengirim request JSON
async function submitJSON(url, method, payload, errorContext) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to ${errorContext}: ${errorData.error || response.statusText}`);
  }
  return response.json();
}
// Menyimpan data orang tua
async function saveOrangTuaData() {
  const orangTuaData = getOrangTuaData();

  if (existingParentData) {
    const updateData = { ...orangTuaData };
    delete updateData.tanggal_lahir;
    delete updateData.email;
    await submitJSON(`/identitas_orang_tua/${existingParentData.parent.id_orang_tua}`, 'PUT', updateData, 'update orang tua data');
    return existingParentData.parent.id_orang_tua;
  }

  const orangTuaResult = await submitJSON('/identitas_orang_tua', 'POST', orangTuaData, 'submit orang tua data');
  return orangTuaResult.id_orang_tua;
}
// Menyimpan data balita dan pengisian
async function saveBalitaAndPengisian(idOrangTua, allAnswers, pengisianToDelete, balitaToSkip) {
  const pengisianIds = [];

  for (let i = 0; i < balitaData.length; i++) {
    if (balitaToSkip.has(i)) continue;
    const balita = balitaData[i];

    let idBalita = balita.existing_id;
    if (!idBalita) {
      const balitaPayload = {
        nama_balita: balita.nama,
        tanggal_lahir: balita.tanggal_lahir,
        jenis_kelamin: balita.jenis_kelamin,
        id_orang_tua: idOrangTua
      };
      const balitaResult = await submitJSON('/identitas_balita', 'POST', balitaPayload, 'submit balita data');
      idBalita = balitaResult.id_balita;
    }

    const balitaAnswers = allAnswers.filter(answer => answer.balita_index === undefined || answer.balita_index === i);

    if (pengisianToDelete[i]) {
      try {
        const deleteResponse = await fetch(`/pengisian/${pengisianToDelete[i]}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_orang_tua: idOrangTua })
        });
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Gagal menghapus pengisian lama');
        }
      } catch (e) {
        console.error('Gagal menghapus pengisian lama:', e);
      }
    }

    const pengisianPayload = {
      id_balita: idBalita,
      tb_balita: balita.tinggi_badan,
      bb_balita: balita.berat_badan,
      details: balitaAnswers
    };
    const pengisianResult = await submitJSON('/pengisian', 'POST', pengisianPayload, 'submit pengisian data');
    pengisianIds.push(pengisianResult.id_pengisian);
  }

  return { pengisianIds };
}
// Mengirim email hasil konsolidasi
async function sendConsolidatedEmail(pengisianIds) {
  try {
    const orangTuaData = getOrangTuaData();
    await fetch('/pengisian/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pengisian_ids: pengisianIds,
        email: orangTuaData.email
      })
    });
  } catch (emailError) {
    console.error('Failed to send consolidated email:', emailError);
  }
}

// ==========================================
// SECTION: Submission Flow
// ==========================================
// Mengirim kuesioner
async function submitKuesioner() {
  try {
    const allAnswers = collectAllAnswers();
    if (allAnswers.length !== getExpectedAnswerCount()) {
      alert('Mohon lengkapi semua pertanyaan untuk semua balita.');
      return;
    }

    const duplicates = await findDuplicateUsia();
    const resolved = await resolveDuplicateUsia(duplicates);
    if (!resolved) return;
    const { pengisianToDelete, balitaToSkip } = resolved;

    const idOrangTua = await saveOrangTuaData();
    const { pengisianIds } = await saveBalitaAndPengisian(idOrangTua, allAnswers, pengisianToDelete, balitaToSkip);

    alert('Data berhasil disimpan! Terima kasih atas partisipasi Anda.');
    updateProgressbar(4);

    await sendConsolidatedEmail(pengisianIds);

    const idParams = pengisianIds.map(id => `id=${id}`).join('&');
    window.location.replace(`/analysis.html?${idParams}`);
  } catch (error) {
    console.error('Error submitting kuesioner:', error);
    alert('Gagal menyimpan data. Silakan coba lagi.');
  }
}

const addBalitaButton = document.getElementById('addBalitaBtn');
if (addBalitaButton) addBalitaButton.addEventListener('click', addBalita);

document.addEventListener('click', (event) => {
  const removeButton = event.target.closest('.balita-remove-btn');
  if (removeButton) removeBalita(removeButton);
});
