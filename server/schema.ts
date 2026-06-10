import bcrypt from "bcryptjs";
import { query } from "./db.js";

const schemaSql = `
CREATE TABLE IF NOT EXISTS education_forms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS specialities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS disciplines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS student_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  speciality_id INTEGER NOT NULL REFERENCES specialities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login VARCHAR(50) NOT NULL UNIQUE,
  last_name VARCHAR(80) NOT NULL DEFAULT '',
  first_name VARCHAR(80) NOT NULL DEFAULT '',
  middle_name VARCHAR(80) NOT NULL DEFAULT '',
  password VARCHAR(100) NOT NULL DEFAULT '',
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'education_staff', 'teacher')),
  group_id INTEGER REFERENCES student_groups(id) ON DELETE SET NULL,
  discipline_id INTEGER REFERENCES disciplines(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  last_name VARCHAR(80) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80) NOT NULL DEFAULT '',
  admission_year INTEGER NOT NULL CHECK (admission_year BETWEEN 1990 AND 2100),
  education_form_id INTEGER NOT NULL REFERENCES education_forms(id) ON DELETE RESTRICT,
  group_id INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS teacher_groups (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS teacher_disciplines (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, discipline_id)
);

CREATE TABLE IF NOT EXISTS curriculum (
  id SERIAL PRIMARY KEY,
  speciality_id INTEGER NOT NULL REFERENCES specialities(id) ON DELETE CASCADE,
  discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
  hours INTEGER NOT NULL DEFAULT 1 CHECK (hours > 0),
  report_type VARCHAR(40) NOT NULL,
  UNIQUE (speciality_id, discipline_id, semester)
);

CREATE TABLE IF NOT EXISTS performance_records (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
  study_year INTEGER NOT NULL CHECK (study_year BETWEEN 1990 AND 2100),
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
  grade VARCHAR(20) NOT NULL CHECK (grade IN ('5', '4', '3', '2', 'Зачет', 'Незачет')),
  UNIQUE (student_id, discipline_id, study_year, semester)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discipline_id INTEGER REFERENCES disciplines(id) ON DELETE SET NULL;
ALTER TABLE curriculum ALTER COLUMN hours SET DEFAULT 1;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'education_staff' WHERE role = 'user';
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'education_staff', 'teacher'));

INSERT INTO teacher_groups (user_id, group_id)
SELECT id, group_id FROM users
WHERE role = 'teacher' AND group_id IS NOT NULL
ON CONFLICT (user_id, group_id) DO NOTHING;

INSERT INTO teacher_disciplines (user_id, discipline_id)
SELECT id, discipline_id FROM users
WHERE role = 'teacher' AND discipline_id IS NOT NULL
ON CONFLICT (user_id, discipline_id) DO NOTHING;

ALTER TABLE performance_records DROP CONSTRAINT IF EXISTS performance_records_grade_check;
ALTER TABLE performance_records
  ADD CONSTRAINT performance_records_grade_check
  CHECK (grade IN ('5', '4', '3', '2', 'Зачет', 'Незачет'));
`;

async function ensureDefaultAdmin() {
  const login = process.env.DEFAULT_ADMIN_LOGIN || "admin";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "admin";
  const passwordHash = await bcrypt.hash(password, 10);

  await query(
    `INSERT INTO users (login, last_name, first_name, middle_name, password, password_hash, role)
     VALUES ($1, 'Системный', 'Администратор', '', '', $2, 'admin')
     ON CONFLICT (login) DO UPDATE
     SET password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
       password = ''`,
    [login, passwordHash]
  );
}

export async function initDatabase() {
  await query(schemaSql);
  await ensureDefaultAdmin();
}
