'use strict';
require('dotenv').config();

const express    = require('express');
const path       = require('path');
const { Pool }   = require('pg');
const bcrypt     = require('bcrypt');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');

// ── Database ────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => console.error('DB pool error:', err));

// ── App ─────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// Helmet: header keamanan dasar
app.use(helmet({
  contentSecurityPolicy: false,   // dibiarkan agar CDN font & script tetap jalan
}));

// Parse JSON body
app.use(express.json({ limit: '100kb' }));

// Sajikan file statis dari folder public/
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate Limiter ────────────────────────────────────────────
// Maksimal 10 pendaftaran per IP per 15 menit
const limiterDaftar = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { pesan: 'Terlalu banyak permintaan. Coba lagi 15 menit lagi.' },
});

// ── Helper validasi server-side ─────────────────────────────
function validasiBody(data) {
  const { nik, nisn, nama, tempat_lahir, tanggal_lahir, jenis_kelamin,
          asal_sekolah, alamat, wa, email, nama_ortu, wa_ortu,
          jurusan1, password } = data;

  if (!/^\d{16}$/.test(nik))                    return 'NIK harus 16 angka.';
  if (!/^\d{10}$/.test(nisn))                   return 'NISN harus 10 angka.';
  if (!nama || nama.trim().length < 3)           return 'Nama tidak valid.';
  if (!tempat_lahir)                             return 'Tempat lahir wajib diisi.';
  if (!tanggal_lahir || isNaN(new Date(tanggal_lahir))) return 'Tanggal lahir tidak valid.';
  if (!['L','P'].includes(jenis_kelamin))        return 'Jenis kelamin tidak valid.';
  if (!asal_sekolah)                             return 'Asal sekolah wajib diisi.';
  if (!alamat || alamat.trim().length < 10)      return 'Alamat terlalu pendek.';
  if (!/^(08|62)\d{8,13}$/.test(wa))            return 'Nomor WhatsApp siswa tidak valid.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email tidak valid.';
  if (!nama_ortu || nama_ortu.trim().length < 3) return 'Nama orang tua tidak valid.';
  if (!/^(08|62)\d{8,13}$/.test(wa_ortu))       return 'Nomor WhatsApp orang tua tidak valid.';
  if (!jurusan1)                                 return 'Pilihan jurusan 1 wajib diisi.';
  if (!password || password.length < 8)          return 'Kata sandi minimal 8 karakter.';
  return null; // valid
}

// ── API Routes ───────────────────────────────────────────────

/**
 * GET /api/jurusan
 * Kembalikan daftar jurusan aktif.
 */
app.get('/api/jurusan', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nama, kuota FROM jurusan WHERE aktif = true ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/jurusan:', err);
    res.status(500).json({ pesan: 'Gagal memuat data jurusan.' });
  }
});

/**
 * POST /api/daftar
 * Body JSON: semua field dari form daftar.html
 * Response 201: { nomor_pendaftaran }
 * Response 409: NIK sudah terdaftar
 * Response 400: validasi gagal
 */
app.post('/api/daftar', limiterDaftar, async (req, res) => {
  // 1. Validasi
  const galat = validasiBody(req.body);
  if (galat) return res.status(400).json({ pesan: galat });

  const {
    nik, nisn, nama, tempat_lahir, tanggal_lahir,
    jenis_kelamin, asal_sekolah, alamat, wa, email,
    nama_ortu, wa_ortu, jurusan1, jurusan2, password,
  } = req.body;

  // jurusan2 harus beda dari jurusan1 (atau null)
  const jur2 = jurusan2 && String(jurusan2) !== String(jurusan1)
    ? parseInt(jurusan2) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Cek duplikat NIK (kunci unik, bisa juga tangkap dari constraint)
    const cek = await client.query(
      'SELECT id FROM pendaftar WHERE nik = $1 FOR UPDATE', [nik]
    );
    if (cek.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ pesan: 'NIK ini sudah terdaftar.' });
    }

    // 3. Generate nomor pendaftaran (thread-safe via sequence)
    const tahun = new Date().getFullYear();
    const { rows: [{ urut }] } = await client.query(
      "SELECT nextval('seq_pendaftar') AS urut"
    );
    const nomor = `${tahun}-${String(urut).padStart(5, '0')}`;

    // 4. Hash password
    const hash = await bcrypt.hash(password, 12);

    // 5. Simpan ke database
    await client.query(
      `INSERT INTO pendaftar
         (nomor_pendaftaran, nik, nisn, nama, tempat_lahir, tanggal_lahir,
          jenis_kelamin, asal_sekolah, alamat, wa, email,
          nama_ortu, wa_ortu, jurusan1, jurusan2, password_hash)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        nomor,
        nik,
        nisn,
        nama.trim(),
        tempat_lahir.trim(),
        tanggal_lahir,
        jenis_kelamin,
        asal_sekolah.trim(),
        alamat.trim(),
        wa,
        email.trim().toLowerCase(),
        nama_ortu.trim(),
        wa_ortu,
        parseInt(jurusan1),
        jur2,
        hash,
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({ nomor_pendaftaran: nomor });

  } catch (err) {
    await client.query('ROLLBACK');
    // Tangkap pelanggaran UNIQUE (NIK) dari constraint PostgreSQL
    if (err.code === '23505' && err.constraint === 'pendaftar_nik_key') {
      return res.status(409).json({ pesan: 'NIK ini sudah terdaftar.' });
    }
    console.error('POST /api/daftar:', err);
    return res.status(500).json({ pesan: 'Pendaftaran gagal disimpan. Coba lagi.' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/status?no=2027-00001
 * Kembalikan status pendaftaran berdasarkan nomor.
 */
app.get('/api/status', async (req, res) => {
  const no = (req.query.no || '').trim();
  if (!no) return res.status(400).json({ pesan: 'Masukkan nomor pendaftaran.' });

  try {
    const result = await pool.query(
      `SELECT
         p.nomor_pendaftaran,
         p.nama,
         p.status,
         p.catatan_panitia,
         p.created_at,
         j1.nama AS jurusan1_nama,
         j2.nama AS jurusan2_nama
       FROM pendaftar p
       LEFT JOIN jurusan j1 ON p.jurusan1 = j1.id
       LEFT JOIN jurusan j2 ON p.jurusan2 = j2.id
       WHERE p.nomor_pendaftaran = $1`,
      [no]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ pesan: 'Nomor pendaftaran tidak ditemukan.' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/status:', err);
    return res.status(500).json({ pesan: 'Gagal mengambil data.' });
  }
});

// ── Fallback: semua route non-API → index.html ────────────────
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ pesan: 'Terjadi kesalahan server.' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Server berjalan → http://localhost:${PORT}`);
});
