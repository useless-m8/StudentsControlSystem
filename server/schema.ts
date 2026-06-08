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
  hours INTEGER NOT NULL CHECK (hours > 0),
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

const seedSql = `
INSERT INTO education_forms (name) VALUES
  ('Очная'),
  ('Заочная'),
  ('Очно-заочная')
ON CONFLICT (name) DO NOTHING;

INSERT INTO specialities (name) VALUES
  ('Информационные системы'),
  ('Программная инженерия')
ON CONFLICT (name) DO NOTHING;

INSERT INTO disciplines (name) VALUES
  ('Базы данных'),
  ('Программирование'),
  ('Математика'),
  ('Информационные технологии')
ON CONFLICT (name) DO NOTHING;

INSERT INTO student_groups (name, speciality_id)
SELECT 'ИС-22', id FROM specialities WHERE name = 'Информационные системы'
ON CONFLICT (name) DO NOTHING;

INSERT INTO student_groups (name, speciality_id)
SELECT 'ИС-23', id FROM specialities WHERE name = 'Информационные системы'
ON CONFLICT (name) DO NOTHING;

INSERT INTO student_groups (name, speciality_id)
SELECT 'ПИ-22', id FROM specialities WHERE name = 'Программная инженерия'
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (login, password, role, group_id)
SELECT 'admin', '', 'admin', NULL
ON CONFLICT (login) DO NOTHING;

INSERT INTO users (login, password, role, group_id)
SELECT 'staff', '', 'education_staff', NULL
ON CONFLICT (login) DO NOTHING;

INSERT INTO users (login, password, role, group_id, discipline_id)
SELECT 'teacher', '', 'teacher', sg.id, d.id
FROM student_groups sg, disciplines d
WHERE sg.name = 'ИС-22' AND d.name = 'Базы данных'
ON CONFLICT (login) DO NOTHING;

INSERT INTO students (last_name, first_name, middle_name, admission_year, education_form_id, group_id)
SELECT 'Иванов', 'Иван', 'Петрович', 2022, ef.id, sg.id
FROM education_forms ef, student_groups sg
WHERE ef.name = 'Очная' AND sg.name = 'ИС-22'
  AND NOT EXISTS (
    SELECT 1
    FROM students st
    WHERE st.last_name = 'Иванов'
      AND st.first_name = 'Иван'
      AND st.middle_name = 'Петрович'
      AND st.admission_year = 2022
      AND st.education_form_id = ef.id
      AND st.group_id = sg.id
  );

INSERT INTO students (last_name, first_name, middle_name, admission_year, education_form_id, group_id)
SELECT 'Петрова', 'Анна', 'Сергеевна', 2023, ef.id, sg.id
FROM education_forms ef, student_groups sg
WHERE ef.name = 'Очная' AND sg.name = 'ИС-23'
  AND NOT EXISTS (
    SELECT 1
    FROM students st
    WHERE st.last_name = 'Петрова'
      AND st.first_name = 'Анна'
      AND st.middle_name = 'Сергеевна'
      AND st.admission_year = 2023
      AND st.education_form_id = ef.id
      AND st.group_id = sg.id
  );

INSERT INTO curriculum (speciality_id, discipline_id, semester, hours, report_type)
SELECT s.id, d.id, 3, 72, 'Экзамен'
FROM specialities s, disciplines d
WHERE s.name = 'Информационные системы' AND d.name = 'Базы данных'
ON CONFLICT (speciality_id, discipline_id, semester) DO NOTHING;

INSERT INTO curriculum (speciality_id, discipline_id, semester, hours, report_type)
SELECT s.id, d.id, 2, 108, 'Зачет'
FROM specialities s, disciplines d
WHERE s.name = 'Программная инженерия' AND d.name = 'Программирование'
ON CONFLICT (speciality_id, discipline_id, semester) DO NOTHING;

INSERT INTO performance_records (student_id, discipline_id, study_year, semester, grade)
SELECT st.id, d.id, 2024, 3, '5'
FROM students st, disciplines d
WHERE st.id = (
  SELECT id FROM students
  WHERE last_name = 'Иванов' AND first_name = 'Иван' AND middle_name = 'Петрович'
  ORDER BY id
  LIMIT 1
)
AND d.name = 'Базы данных'
ON CONFLICT (student_id, discipline_id, study_year, semester) DO NOTHING;

INSERT INTO performance_records (student_id, discipline_id, study_year, semester, grade)
SELECT st.id, d.id, 2024, 2, '4'
FROM students st, disciplines d
WHERE st.id = (
  SELECT id FROM students
  WHERE last_name = 'Петрова' AND first_name = 'Анна' AND middle_name = 'Сергеевна'
  ORDER BY id
  LIMIT 1
)
AND d.name = 'Программирование'
ON CONFLICT (student_id, discipline_id, study_year, semester) DO NOTHING;
`;

async function cleanupDemoDuplicates() {
  await query(`
    WITH duplicates AS (
      SELECT id,
        MIN(id) OVER (
          PARTITION BY last_name, first_name, middle_name, admission_year, education_form_id, group_id
        ) AS keep_id
      FROM students
      WHERE (last_name, first_name, middle_name) IN (
        ('Иванов', 'Иван', 'Петрович'),
        ('Петрова', 'Анна', 'Сергеевна')
      )
    ),
    duplicate_rows AS (
      SELECT id, keep_id FROM duplicates WHERE id <> keep_id
    )
    UPDATE users u
    SET student_id = d.keep_id
    FROM duplicate_rows d
    WHERE u.student_id = d.id
  `);

  await query(`
    WITH duplicates AS (
      SELECT id,
        MIN(id) OVER (
          PARTITION BY last_name, first_name, middle_name, admission_year, education_form_id, group_id
        ) AS keep_id
      FROM students
      WHERE (last_name, first_name, middle_name) IN (
        ('Иванов', 'Иван', 'Петрович'),
        ('Петрова', 'Анна', 'Сергеевна')
      )
    )
    DELETE FROM students st
    USING duplicates d
    WHERE st.id = d.id AND d.id <> d.keep_id
  `);
}

async function ensureDemoPasswords() {
  const adminHash = await bcrypt.hash("admin", 10);
  const staffHash = await bcrypt.hash("staff", 10);
  const teacherHash = await bcrypt.hash("teacher", 10);

  await query(
    `UPDATE users
     SET password_hash = $1,
       password = '',
       last_name = COALESCE(NULLIF(last_name, ''), 'Системный'),
       first_name = COALESCE(NULLIF(first_name, ''), 'Администратор'),
       middle_name = COALESCE(middle_name, '')
     WHERE login = 'admin'`,
    [adminHash]
  );
  await query(
    `UPDATE users
     SET password_hash = $1,
       password = '',
       role = 'education_staff',
       last_name = COALESCE(NULLIF(last_name, ''), 'Смирнова'),
       first_name = COALESCE(NULLIF(first_name, ''), 'Мария'),
       middle_name = COALESCE(NULLIF(middle_name, ''), 'Алексеевна'),
       group_id = NULL,
       student_id = NULL,
       discipline_id = NULL
     WHERE login IN ('user', 'staff')`,
    [staffHash]
  );
  await query(
    `UPDATE users
     SET password_hash = $1,
       password = '',
       role = 'teacher',
       last_name = COALESCE(NULLIF(last_name, ''), 'Кузнецов'),
       first_name = COALESCE(NULLIF(first_name, ''), 'Андрей'),
       middle_name = COALESCE(NULLIF(middle_name, ''), 'Викторович'),
       group_id = COALESCE(group_id, (SELECT id FROM student_groups WHERE name = 'ИС-22')),
       student_id = NULL,
       discipline_id = COALESCE(discipline_id, (SELECT id FROM disciplines WHERE name = 'Базы данных'))
     WHERE login = 'teacher'`,
    [teacherHash]
  );

  await query(
    `INSERT INTO teacher_groups (user_id, group_id)
     SELECT u.id, sg.id
     FROM users u, student_groups sg
     WHERE u.login = 'teacher' AND sg.name = 'ИС-22'
     ON CONFLICT (user_id, group_id) DO NOTHING`
  );
  await query(
    `INSERT INTO teacher_disciplines (user_id, discipline_id)
     SELECT u.id, d.id
     FROM users u, disciplines d
     WHERE u.login = 'teacher' AND d.name = 'Базы данных'
     ON CONFLICT (user_id, discipline_id) DO NOTHING`
  );
}

export async function initDatabase() {
  await query(schemaSql);
  await query(seedSql);
  await cleanupDemoDuplicates();
  await ensureDemoPasswords();
}
