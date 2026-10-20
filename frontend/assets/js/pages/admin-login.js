
// ==========================================
// SECTION: Utilities
// ==========================================
// Menampilkan pesan error
function showError(msg) {
  const box = document.getElementById('errorBox');
  document.getElementById('successBox').style.display = 'none';
  box.textContent = msg;
  box.style.display = 'block';
}
// Menampilkan pesan sukses
function showSuccess(msg) {
  const box = document.getElementById('successBox');
  document.getElementById('errorBox').style.display = 'none';
  box.textContent = msg;
  box.style.display = 'block';
}
// Menghapus pesan alert
function clearAlerts() {
  document.getElementById('errorBox').style.display = 'none';
  document.getElementById('successBox').style.display = 'none';
}
// Mengatur status loading tombol
function setBtnLoading(btn, loading, originalText) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner-border spinner-border-sm-inline spinner-border" role="status"></span> Memproses...'
    : originalText;
}

// ==========================================
// SECTION: Session Check
// ==========================================
fetch('/api/admin/session').then(r => r.json()).then(d => {
  if (d.logged_in) window.location.href = 'admin-dashboard.html';
}).catch(() => {});

// ==========================================
// SECTION: Login
// ==========================================
let currentLoginId = null;

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  clearAlerts();
  const btn = document.getElementById('loginBtn');
  setBtnLoading(btn, true, 'Masuk');
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Login gagal.');
      setBtnLoading(btn, false, 'Masuk');
      return;
    }
    currentLoginId = data.login_id;
    document.getElementById('maskedEmail').textContent = data.masked_email;
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.add('active');
    showSuccess('Kode verifikasi telah dikirim ke email Anda.');
    setBtnLoading(btn, false, 'Masuk');
  } catch (err) {
    showError('Terjadi kesalahan koneksi. Silakan coba lagi.');
    setBtnLoading(btn, false, 'Masuk');
  }
});

document.getElementById('togglePassword').addEventListener('click', function () {
  const input = document.getElementById('password');
  const icon = document.getElementById('togglePasswordIcon');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  icon.classList.toggle('bi-eye', !isHidden);
  icon.classList.toggle('bi-eye-slash', isHidden);
});

// ==========================================
// SECTION: OTP Verification
// ==========================================
document.getElementById('otpForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  clearAlerts();
  const btn = document.getElementById('verifyBtn');
  setBtnLoading(btn, true, 'Verifikasi & Masuk');
  try {
    const res = await fetch('/api/admin/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: currentLoginId,
        code: document.getElementById('otpCode').value.trim()
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Verifikasi gagal.');
      setBtnLoading(btn, false, 'Verifikasi & Masuk');
      return;
    }
    showSuccess('Login berhasil! Mengarahkan ke dashboard...');
    setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 700);
  } catch (err) {
    showError('Terjadi kesalahan koneksi. Silakan coba lagi.');
    setBtnLoading(btn, false, 'Verifikasi & Masuk');
  }
});
