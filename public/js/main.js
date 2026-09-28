/* Data sementara. Nanti ganti dengan fetch dari API (PostgreSQL), misalnya:
   fetch('/api/jurusan').then(r => r.json()).then(tampilJurusan) */
const JURUSAN = [
  {nama:"Teknik Komputer dan Jaringan", info:"Merakit komputer, mengelola jaringan, dan dasar keamanan siber.", kuota:72},
  {nama:"Rekayasa Perangkat Lunak", info:"Membuat aplikasi web dan mobile, dari desain sampai rilis.", kuota:72},
  {nama:"Akuntansi", info:"Pembukuan, laporan keuangan, dan aplikasi akuntansi.", kuota:36},
  {nama:"Teknik Kendaraan Ringan", info:"Perawatan dan perbaikan mesin serta sistem kendaraan.", kuota:36}
];
const BATAS = [
  {judul:"5 Januari – 28 Februari 2027", isi:"Pendaftaran gelombang 1 dibuka. Hasil diumumkan awal Maret."},
  {judul:"1 Maret – 30 April 2027", isi:"Pendaftaran gelombang 2. Hasil diumumkan 10 Mei."},
  {judul:"11 – 25 Mei 2027", isi:"Daftar ulang bagi siswa yang diterima."}
];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);

$('daftar-jurusan').innerHTML = JURUSAN.map(j =>
  `<article><h3>${esc(j.nama)}</h3><p>${esc(j.info)}</p><small>Kuota ${esc(j.kuota)} siswa</small></article>`).join('');
$('daftar-batas').innerHTML = BATAS.map(b =>
  `<div class="batas"><b>${esc(b.judul)}</b><span>${esc(b.isi)}</span></div>`).join('');

$('form-cek').addEventListener('submit', e => {
  e.preventDefault();
  const no = $('no-daftar').value.trim();
  $('hasil-cek').textContent = no ? 'Fitur ini aktif setelah database tersambung.' : 'Isi nomor pendaftaran dulu.';
  // Nanti: fetch('/api/status?no=' + encodeURIComponent(no))
});
$('tgl-cepat').addEventListener('click', () => $('cepat').classList.toggle('tutup'));
$('tgl-chat').addEventListener('click', () => $('chat').classList.toggle('kecil'));
