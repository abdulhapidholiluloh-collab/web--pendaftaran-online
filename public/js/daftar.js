/* Ubah ke true setelah API /api/daftar siap (Node/PHP/dll + PostgreSQL) */
const API_AKTIF = false;

/* Nanti ambil dari API: fetch('/api/jurusan') */
const JURUSAN = [
  {id:1, nama:"Teknik Komputer dan Jaringan"},
  {id:2, nama:"Rekayasa Perangkat Lunak"},
  {id:3, nama:"Akuntansi"},
  {id:4, nama:"Teknik Kendaraan Ringan"}
];

const $ = id => document.getElementById(id);
const form = $('form-daftar');
const angka = v => v.replace(/\D/g, '');

/* isi pilihan jurusan */
const opsi = JURUSAN.map(j => `<option value="${j.id}">${j.nama}</option>`).join('');
$('jurusan1').innerHTML = '<option value="">Pilih jurusan</option>' + opsi;
$('jurusan2').innerHTML = '<option value="">Tidak ada</option>' + opsi;

/* aturan validasi: kembalikan teks galat, atau '' jika benar */
const val = id => (form.elements[id].value || '').trim();
const cekWA = v => /^(08|62)\d{8,13}$/.test(angka(v)) ? '' : 'Isi nomor WhatsApp yang benar, contoh 081234567890.';
const aturan = {
  nik: () => /^\d{16}$/.test(val('nik')) ? '' : 'NIK harus 16 angka.',
  nisn: () => /^\d{10}$/.test(val('nisn')) ? '' : 'NISN harus 10 angka.',
  nama: () => val('nama').length >= 3 ? '' : 'Isi nama lengkap sesuai ijazah.',
  tempat_lahir: () => val('tempat_lahir') ? '' : 'Isi tempat lahir.',
  tanggal_lahir: () => {
    const v = val('tanggal_lahir');
    if (!v) return 'Isi tanggal lahir.';
    const umur = (Date.now() - new Date(v)) / 31557600000;
    return umur >= 12 && umur <= 20 ? '' : 'Tanggal lahir tidak wajar, periksa lagi.';
  },
  jenis_kelamin: () => val('jenis_kelamin') ? '' : 'Pilih jenis kelamin.',
  asal_sekolah: () => val('asal_sekolah') ? '' : 'Isi asal sekolah.',
  alamat: () => val('alamat').length >= 10 ? '' : 'Isi alamat lengkap.',
  wa: () => cekWA(val('wa')),
  email: () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email')) ? '' : 'Isi email yang benar.',
  nama_ortu: () => val('nama_ortu').length >= 3 ? '' : 'Isi nama orang tua atau wali.',
  wa_ortu: () => cekWA(val('wa_ortu')),
  jurusan1: () => val('jurusan1') ? '' : 'Pilih jurusan.',
  jurusan2: () => val('jurusan2') && val('jurusan2') === val('jurusan1') ? 'Pilihan 2 harus beda dari pilihan 1.' : '',
  password: () => val('password').length >= 8 ? '' : 'Kata sandi minimal 8 karakter.',
  password2: () => form.elements.password2.value === form.elements.password.value ? '' : 'Kata sandi tidak sama.',
  setuju: () => form.elements.setuju.checked ? '' : 'Centang persetujuan untuk melanjutkan.'
};

function tampilGalat(id, teks) {
  $('err-' + id).textContent = teks;
  form.elements[id].setAttribute('aria-invalid', teks ? 'true' : 'false');
}
function cekField(id) { const t = aturan[id](); tampilGalat(id, t); return !t; }

/* NIK: hanya angka + penghitung */
form.elements.nik.addEventListener('input', e => {
  e.target.value = angka(e.target.value).slice(0, 16);
  $('hitung-nik').textContent = e.target.value.length + '/16';
  petunjukNIK();
});
form.elements.nisn.addEventListener('input', e => { e.target.value = angka(e.target.value).slice(0, 10); });

/* Petunjuk (tidak memblokir): 6 digit tengah NIK = tanggal lahir, hari + 40 untuk perempuan */
function petunjukNIK() {
  const nik = val('nik'), tgl = val('tanggal_lahir'), jk = val('jenis_kelamin');
  let teks = '';
  if (nik.length === 16 && tgl && jk) {
    let hari = +nik.slice(6, 8); if (hari > 40) hari -= 40;
    const jkNik = +nik.slice(6, 8) > 40 ? 'P' : 'L';
    const [th, bl, hr] = tgl.split('-').map(Number);
    if (hari !== hr || +nik.slice(8, 10) !== bl || +nik.slice(10, 12) !== th % 100 || jkNik !== jk)
      teks = 'NIK tampak tidak cocok dengan tanggal lahir atau jenis kelamin. Periksa lagi.';
  }
  $('hint-nik').textContent = teks;
}
['tanggal_lahir', 'jenis_kelamin'].forEach(id => form.elements[id].addEventListener('change', petunjukNIK));

/* cek saat pindah kolom */
Object.keys(aturan).forEach(id => {
  form.elements[id].addEventListener('blur', () => { if (val(id) || id === 'setuju') cekField(id); });
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  $('err-umum').textContent = '';
  const salah = Object.keys(aturan).filter(id => !cekField(id));
  if (salah.length) { form.elements[salah[0]].focus(); return; }

  const data = Object.fromEntries(new FormData(form));
  delete data.password2; delete data.setuju;
  data.wa = angka(data.wa); data.wa_ortu = angka(data.wa_ortu);

  const tombol = $('kirim'); tombol.disabled = true; tombol.textContent = 'Mengirim...';
  try {
    let nomor;
    if (API_AKTIF) {
      const r = await fetch('/api/daftar', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      const hasil = await r.json().catch(() => ({}));
      if (r.status === 409) { tampilGalat('nik', 'NIK ini sudah terdaftar. Silakan login atau hubungi panitia.'); form.elements.nik.focus(); return; }
      if (!r.ok) throw new Error(hasil.pesan || 'gagal');
      nomor = hasil.nomor_pendaftaran;
    } else {
      nomor = 'CONTOH-00001'; /* mode contoh: belum tersambung ke database */
    }
    $('nomor-daftar').textContent = nomor;
    form.hidden = true;
    const s = $('sukses'); s.hidden = false; s.focus(); window.scrollTo({top: 0});
  } catch (err) {
    $('err-umum').textContent = 'Pendaftaran gagal dikirim. Periksa koneksi dan coba lagi.';
  } finally {
    tombol.disabled = false; tombol.textContent = 'Kirim pendaftaran';
  }
});
