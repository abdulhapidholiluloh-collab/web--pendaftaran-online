/* ──────────────────────────────────────────────────────────
   main.js  –  halaman utama (index.html)
   ────────────────────────────────────────────────────────── */
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);

/* ── Jadwal pendaftaran (statis, ubah sesuai keputusan panitia) ── */
const BATAS = [
  {judul:"5 Januari – 28 Februari 2027", isi:"Pendaftaran gelombang 1. Hasil diumumkan awal Maret."},
  {judul:"1 Maret – 30 April 2027",      isi:"Pendaftaran gelombang 2. Hasil diumumkan 10 Mei."},
  {judul:"11 – 25 Mei 2027",             isi:"Daftar ulang bagi siswa yang diterima."},
];
$('daftar-batas').innerHTML = BATAS.map(b =>
  `<div class="batas"><b>${esc(b.judul)}</b><span>${esc(b.isi)}</span></div>`
).join('');

/* ── Jurusan: ambil dari API ────────────────────────────── */
async function muatJurusan() {
  try {
    const r = await fetch('/api/jurusan');
    if (!r.ok) throw new Error('gagal');
    const list = await r.json();
    $('daftar-jurusan').innerHTML = list.map(j =>
      `<article>
         <h3>${esc(j.nama)}</h3>
         <small>Kuota ${esc(j.kuota)} siswa</small>
       </article>`
    ).join('');
  } catch {
    $('daftar-jurusan').innerHTML =
      '<p style="padding:20px;color:var(--abu)">Gagal memuat data jurusan.</p>';
  }
}
muatJurusan();

/* ── Cek status pendaftaran ─────────────────────────────── */
const LABEL_STATUS = {
  menunggu:    'Menunggu verifikasi',
  verifikasi:  'Sedang diverifikasi',
  diterima:    '✅ Diterima',
  ditolak:     '❌ Tidak diterima',
};

$('form-cek').addEventListener('submit', async e => {
  e.preventDefault();
  const no  = $('no-daftar').value.trim();
  const out = $('hasil-cek');

  if (!no) { out.textContent = 'Isi nomor pendaftaran dulu.'; return; }

  out.textContent = 'Mengecek…';
  try {
    const r    = await fetch('/api/status?no=' + encodeURIComponent(no));
    const data = await r.json();

    if (r.status === 404) { out.textContent = 'Nomor pendaftaran tidak ditemukan.'; return; }
    if (!r.ok)            { out.textContent = data.pesan || 'Terjadi kesalahan.'; return; }

    const label   = LABEL_STATUS[data.status] ?? data.status;
    const catatan = data.catatan_panitia
      ? `<br><small style="color:var(--abu)">${esc(data.catatan_panitia)}</small>` : '';

    out.innerHTML =
      `<strong>${esc(data.nama)}</strong> – Nomor: ${esc(data.nomor_pendaftaran)}<br>
       Jurusan pilihan 1: ${esc(data.jurusan1_nama ?? '-')}<br>
       Status: <strong>${esc(label)}</strong>${catatan}`;
  } catch {
    out.textContent = 'Gagal menghubungi server. Coba lagi.';
  }
});

/* ── Panel cepat & chat ─────────────────────────────────── */
$('tgl-cepat').addEventListener('click', () => $('cepat').classList.toggle('tutup'));
$('tgl-chat').addEventListener('click',  () => $('chat').classList.toggle('kecil'));
