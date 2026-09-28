-- ============================================================
--  PPDB SMK Al-Falah Bandung  –  Schema PostgreSQL
--  Jalankan: psql $DATABASE_URL -f schema.sql
-- ============================================================

-- Sequence untuk nomor pendaftaran (2027-00001, dst.)
CREATE SEQUENCE IF NOT EXISTS seq_pendaftar START 1;

-- ----------------------------------------------------------
--  Tabel jurusan
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS jurusan (
  id         SERIAL PRIMARY KEY,
  nama       VARCHAR(100) NOT NULL,
  kuota      INTEGER      NOT NULL DEFAULT 36,
  aktif      BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Data awal jurusan (jalankan sekali)
INSERT INTO jurusan (nama, kuota) VALUES
  ('Teknik Komputer dan Jaringan', 72),
  ('Rekayasa Perangkat Lunak',     72),
  ('Akuntansi',                    36),
  ('Teknik Kendaraan Ringan',      36)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------
--  Tabel pendaftar
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS pendaftar (
  id                 SERIAL       PRIMARY KEY,
  nomor_pendaftaran  VARCHAR(20)  UNIQUE NOT NULL,

  -- Data calon siswa
  nik                CHAR(16)     UNIQUE NOT NULL,
  nisn               CHAR(10)     NOT NULL,
  nama               VARCHAR(150) NOT NULL,
  tempat_lahir       VARCHAR(100) NOT NULL,
  tanggal_lahir      DATE         NOT NULL,
  jenis_kelamin      CHAR(1)      NOT NULL CHECK (jenis_kelamin IN ('L','P')),
  asal_sekolah       VARCHAR(150) NOT NULL,

  -- Alamat & kontak
  alamat             TEXT         NOT NULL,
  wa                 VARCHAR(15)  NOT NULL,
  email              VARCHAR(150) NOT NULL,

  -- Orang tua / wali
  nama_ortu          VARCHAR(150) NOT NULL,
  wa_ortu            VARCHAR(15)  NOT NULL,

  -- Pilihan jurusan
  jurusan1           INTEGER      NOT NULL REFERENCES jurusan(id),
  jurusan2           INTEGER      REFERENCES jurusan(id),

  -- Akun (login pakai NIK + password)
  password_hash      VARCHAR(255) NOT NULL,

  -- Status seleksi
  status             VARCHAR(20)  NOT NULL DEFAULT 'menunggu'
                       CHECK (status IN ('menunggu','verifikasi','diterima','ditolak')),
  catatan_panitia    TEXT,

  -- Timestamps
  created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_pend_nik    ON pendaftar(nik);
CREATE INDEX IF NOT EXISTS idx_pend_nomor  ON pendaftar(nomor_pendaftaran);
CREATE INDEX IF NOT EXISTS idx_pend_status ON pendaftar(status);
CREATE INDEX IF NOT EXISTS idx_pend_email  ON pendaftar(email);

-- ----------------------------------------------------------
--  Tabel berkas (unggahan dokumen – fase berikutnya)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS berkas (
  id                SERIAL       PRIMARY KEY,
  pendaftar_id      INTEGER      NOT NULL REFERENCES pendaftar(id) ON DELETE CASCADE,
  jenis             VARCHAR(50)  NOT NULL,   -- 'ijazah', 'kk', 'akta', 'foto', 'rapor'
  nama_file         VARCHAR(255) NOT NULL,
  path_file         TEXT         NOT NULL,
  ukuran_bytes      INTEGER,
  mime_type         VARCHAR(80),
  status_verifikasi VARCHAR(20)  NOT NULL DEFAULT 'menunggu'
                      CHECK (status_verifikasi IN ('menunggu','ok','ditolak')),
  uploaded_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_berkas_pend ON berkas(pendaftar_id);

-- ----------------------------------------------------------
--  Trigger: perbarui updated_at otomatis
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pendaftar_upd ON pendaftar;
CREATE TRIGGER trg_pendaftar_upd
  BEFORE UPDATE ON pendaftar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
