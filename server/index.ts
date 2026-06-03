import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { createAuthToken, type AuthUser, verifyAuthToken } from "./auth.js";
import { getDataScope } from "./accessScope.js";
import { query } from "./db.js";
import { initDatabase } from "./schema.js";

type AuthRequest = Request & {
  user?: AuthUser;
};

type TableName =
  | "education_forms"
  | "specialities"
  | "disciplines"
  | "student_groups"
  | "students"
  | "curriculum"
  | "performance_records";

const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "students-course-secret";
const app = express();

app.use(cors());
app.use(express.json());

function asyncHandler(
  handler: (request: AuthRequest, response: Response) => Promise<void>
) {
  return (request: Request, response: Response) => {
    handler(request as AuthRequest, response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Server error";
      response.status(500).json({ message });
    });
  };
}

function badRequest(response: Response, message: string) {
  response.status(400).json({ message });
}

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function requireFields(
  body: Record<string, unknown>,
  response: Response,
  fields: string[]
) {
  const missed = fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || value === "";
  });

  if (missed.length > 0) {
    badRequest(response, `Заполните поля: ${missed.join(", ")}`);
    return false;
  }

  return true;
}

function publicRoute(request: Request) {
  return (
    request.path === "/api/health" ||
    (request.method === "POST" && request.path === "/api/auth/login") ||
    (request.method === "POST" && request.path === "/api/auth/register") ||
    (request.method === "GET" && request.path === "/api/auth/register-options")
  );
}

function authMiddleware(request: AuthRequest, response: Response, next: NextFunction) {
  if (publicRoute(request)) {
    next();
    return;
  }

  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    response.status(401).json({ message: "Необходима авторизация" });
    return;
  }

  try {
    request.user = verifyAuthToken(token, jwtSecret);
    next();
  } catch {
    response.status(401).json({ message: "Сессия истекла, войдите заново" });
  }
}

function adminOnly(request: AuthRequest, response: Response, next: NextFunction) {
  if (publicRoute(request) || request.method === "GET") {
    next();
    return;
  }

  if (request.user?.role !== "admin") {
    response.status(403).json({ message: "Недостаточно прав доступа" });
    return;
  }

  next();
}

app.use(authMiddleware);
app.use(adminOnly);

async function removeById(table: TableName, id: string, response: Response) {
  const result = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [
    Number(id),
  ]);

  if (result.rowCount === 0) {
    response.status(404).json({ message: "Запись не найдена" });
    return;
  }

  response.status(204).send();
}

async function findUser(loginValue: string) {
  const result = await query<{
    id: number;
    login: string;
    passwordHash: string | null;
    password: string;
    role: AuthUser["role"];
    groupId: number | null;
    studentId: number | null;
  }>(
    `SELECT id, login, password_hash AS "passwordHash", password, role,
      group_id AS "groupId", student_id AS "studentId"
     FROM users
     WHERE login = $1`,
    [loginValue]
  );

  return result.rows[0] || null;
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get(
  "/api/auth/register-options",
  asyncHandler(async (_request, response) => {
    const groups = await query(
      `SELECT g.id, g.name, g.speciality_id AS "specialityId", s.name AS "specialityName"
       FROM student_groups g
       JOIN specialities s ON s.id = g.speciality_id
       ORDER BY g.name`
    );
    const educationForms = await query("SELECT id, name FROM education_forms ORDER BY id");
    response.json({ groups: groups.rows, educationForms: educationForms.rows });
  })
);

app.post(
  "/api/auth/register",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (
      !requireFields(body, response, [
        "login",
        "password",
        "lastName",
        "firstName",
        "admissionYear",
        "educationFormId",
        "groupId",
      ])
    ) {
      return;
    }

    const loginValue = String(body.login).trim();
    const password = String(body.password);
    const lastName = String(body.lastName).trim();
    const firstName = String(body.firstName).trim();
    const middleName = String(body.middleName || "").trim();
    const admissionYear = Number(body.admissionYear);
    const educationFormId = Number(body.educationFormId);
    const groupId = Number(body.groupId);

    if (loginValue.length < 3 || password.length < 4) {
      badRequest(response, "Логин должен быть от 3 символов, пароль от 4 символов");
      return;
    }

    const existingUser = await findUser(loginValue);
    if (existingUser) {
      response.status(409).json({ message: "Пользователь с таким логином уже существует" });
      return;
    }

    const groupExists = await query("SELECT id FROM student_groups WHERE id = $1", [groupId]);
    if (groupExists.rowCount === 0) {
      badRequest(response, "Выбранная группа не найдена");
      return;
    }

    const educationFormExists = await query("SELECT id FROM education_forms WHERE id = $1", [educationFormId]);
    if (educationFormExists.rowCount === 0) {
      badRequest(response, "Выбранная форма обучения не найдена");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const studentResult = await query<{ id: number }>(
      `INSERT INTO students (
        last_name, first_name, middle_name, admission_year, education_form_id, group_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [lastName, firstName, middleName, admissionYear, educationFormId, groupId]
    );

    const result = await query<AuthUser>(
      `INSERT INTO users (login, password, password_hash, role, group_id, student_id)
       VALUES ($1, '', $2, 'user', $3, $4)
       RETURNING id, login, role, group_id AS "groupId", student_id AS "studentId"`,
      [loginValue, passwordHash, groupId, studentResult.rows[0].id]
    );

    const user = result.rows[0];
    response.status(201).json({ user, token: createAuthToken(user, jwtSecret) });
  })
);

app.post(
  "/api/auth/login",
  asyncHandler(async (request, response) => {
    const { login, password } = request.body as {
      login?: string;
      password?: string;
    };

    if (!login || !password) {
      badRequest(response, "Введите логин и пароль");
      return;
    }

    const userRow = await findUser(login);

    if (!userRow) {
      response.status(401).json({ message: "Неверный логин или пароль" });
      return;
    }

    const passwordValid = userRow.passwordHash
      ? await bcrypt.compare(password, userRow.passwordHash)
      : userRow.password === password;

    if (!passwordValid) {
      response.status(401).json({ message: "Неверный логин или пароль" });
      return;
    }

    const user: AuthUser = {
      id: userRow.id,
      login: userRow.login,
      role: userRow.role,
      groupId: userRow.groupId,
      studentId: userRow.studentId,
    };

    response.json({ user, token: createAuthToken(user, jwtSecret) });
  })
);

app.get(
  "/api/app-data",
  asyncHandler(async (request, response) => {
    const user = request.user;

    if (!user) {
      response.status(401).json({ message: "Необходима авторизация" });
      return;
    }

    const { groupScope, studentScope } = getDataScope(user);

    const [
      educationForms,
      groups,
      students,
      performance,
      specialities,
      curriculum,
      disciplines,
    ] = await Promise.all([
      query("SELECT id, name FROM education_forms ORDER BY id"),
      query(
        `SELECT id, name, speciality_id AS "specialityId"
         FROM student_groups
         WHERE $1::int IS NULL OR id = $1
         ORDER BY id`,
        [groupScope]
      ),
      query(
        `SELECT id, last_name AS "lastName", first_name AS "firstName",
          middle_name AS "middleName", admission_year AS "admissionYear",
          education_form_id AS "educationFormId", group_id AS "groupId"
         FROM students
         WHERE ($1::int IS NULL OR group_id = $1)
           AND ($2::int IS NULL OR id = $2)
         ORDER BY last_name, first_name, id`,
        [groupScope, studentScope]
      ),
      query(
        `SELECT pr.id, pr.student_id AS "studentId", pr.discipline_id AS "disciplineId",
          pr.study_year AS "studyYear", pr.semester, pr.grade
         FROM performance_records pr
         JOIN students st ON st.id = pr.student_id
         WHERE ($1::int IS NULL OR st.group_id = $1)
           AND ($2::int IS NULL OR st.id = $2)
         ORDER BY pr.study_year DESC, pr.semester DESC, pr.id`,
        [groupScope, studentScope]
      ),
      query(
        `SELECT DISTINCT s.id, s.name
         FROM specialities s
         LEFT JOIN student_groups g ON g.speciality_id = s.id
         WHERE $1::int IS NULL OR g.id = $1
         ORDER BY s.id`,
        [groupScope]
      ),
      query(
        `SELECT c.id, c.speciality_id AS "specialityId", c.discipline_id AS "disciplineId",
          c.semester, c.hours, c.report_type AS "reportType"
         FROM curriculum c
         WHERE $1::int IS NULL OR c.speciality_id = (
           SELECT speciality_id FROM student_groups WHERE id = $1
         )
         ORDER BY c.semester, c.id`,
        [groupScope]
      ),
      query(
        `SELECT DISTINCT d.id, d.name
         FROM disciplines d
         LEFT JOIN curriculum c ON c.discipline_id = d.id
         WHERE $1::int IS NULL OR c.speciality_id = (
           SELECT speciality_id FROM student_groups WHERE id = $1
         )
         ORDER BY d.id`,
        [groupScope]
      ),
    ]);

    response.json({
      educationForms: educationForms.rows,
      specialities: specialities.rows,
      disciplines: disciplines.rows,
      groups: groups.rows,
      students: students.rows,
      curriculum: curriculum.rows,
      performance: performance.rows,
    });
  })
);

app.post(
  "/api/directories/:kind",
  asyncHandler(async (request, response) => {
    const tableByKind: Record<string, TableName> = {
      educationForms: "education_forms",
      specialities: "specialities",
      disciplines: "disciplines",
    };
    const table = tableByKind[routeParam(request.params.kind)];

    if (!table) {
      response.status(404).json({ message: "Справочник не найден" });
      return;
    }

    const body = request.body as { name?: string };
    if (!requireFields(body, response, ["name"])) return;

    const result = await query<{ id: number; name: string }>(
      `INSERT INTO ${table} (name) VALUES ($1) RETURNING id, name`,
      [body.name?.trim()]
    );

    response.status(201).json(result.rows[0]);
  })
);

app.put(
  "/api/directories/:kind/:id",
  asyncHandler(async (request, response) => {
    const tableByKind: Record<string, TableName> = {
      educationForms: "education_forms",
      specialities: "specialities",
      disciplines: "disciplines",
    };
    const table = tableByKind[routeParam(request.params.kind)];

    if (!table) {
      response.status(404).json({ message: "Справочник не найден" });
      return;
    }

    const body = request.body as { name?: string };
    if (!requireFields(body, response, ["name"])) return;

    const result = await query<{ id: number; name: string }>(
      `UPDATE ${table} SET name = $1 WHERE id = $2 RETURNING id, name`,
      [body.name?.trim(), Number(routeParam(request.params.id))]
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Запись не найдена" });
      return;
    }

    response.json(result.rows[0]);
  })
);

app.delete(
  "/api/directories/:kind/:id",
  asyncHandler(async (request, response) => {
    const tableByKind: Record<string, TableName> = {
      educationForms: "education_forms",
      specialities: "specialities",
      disciplines: "disciplines",
    };
    const table = tableByKind[routeParam(request.params.kind)];

    if (!table) {
      response.status(404).json({ message: "Справочник не найден" });
      return;
    }

    await removeById(table, routeParam(request.params.id), response);
  })
);

app.post(
  "/api/groups",
  asyncHandler(async (request, response) => {
    const body = request.body as { name?: string; specialityId?: number };
    if (!requireFields(body, response, ["name", "specialityId"])) return;

    const result = await query(
      `INSERT INTO student_groups (name, speciality_id)
       VALUES ($1, $2)
       RETURNING id, name, speciality_id AS "specialityId"`,
      [body.name?.trim(), Number(body.specialityId)]
    );

    response.status(201).json(result.rows[0]);
  })
);

app.put(
  "/api/groups/:id",
  asyncHandler(async (request, response) => {
    const body = request.body as { name?: string; specialityId?: number };
    if (!requireFields(body, response, ["name", "specialityId"])) return;

    const result = await query(
      `UPDATE student_groups SET name = $1, speciality_id = $2
       WHERE id = $3
       RETURNING id, name, speciality_id AS "specialityId"`,
      [body.name?.trim(), Number(body.specialityId), Number(routeParam(request.params.id))]
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Группа не найдена" });
      return;
    }

    response.json(result.rows[0]);
  })
);

app.delete(
  "/api/groups/:id",
  asyncHandler(async (request, response) => {
    await removeById("student_groups", routeParam(request.params.id), response);
  })
);

app.post(
  "/api/students",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (
      !requireFields(body, response, [
        "lastName",
        "firstName",
        "admissionYear",
        "educationFormId",
        "groupId",
      ])
    ) {
      return;
    }

    const result = await query(
      `INSERT INTO students (
        last_name, first_name, middle_name, admission_year, education_form_id, group_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, last_name AS "lastName", first_name AS "firstName",
        middle_name AS "middleName", admission_year AS "admissionYear",
        education_form_id AS "educationFormId", group_id AS "groupId"`,
      [
        String(body.lastName).trim(),
        String(body.firstName).trim(),
        String(body.middleName || "").trim(),
        Number(body.admissionYear),
        Number(body.educationFormId),
        Number(body.groupId),
      ]
    );

    response.status(201).json(result.rows[0]);
  })
);

app.put(
  "/api/students/:id",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (
      !requireFields(body, response, [
        "lastName",
        "firstName",
        "admissionYear",
        "educationFormId",
        "groupId",
      ])
    ) {
      return;
    }

    const result = await query(
      `UPDATE students
       SET last_name = $1, first_name = $2, middle_name = $3,
         admission_year = $4, education_form_id = $5, group_id = $6
       WHERE id = $7
       RETURNING id, last_name AS "lastName", first_name AS "firstName",
        middle_name AS "middleName", admission_year AS "admissionYear",
        education_form_id AS "educationFormId", group_id AS "groupId"`,
      [
        String(body.lastName).trim(),
        String(body.firstName).trim(),
        String(body.middleName || "").trim(),
        Number(body.admissionYear),
        Number(body.educationFormId),
        Number(body.groupId),
        Number(routeParam(request.params.id)),
      ]
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Студент не найден" });
      return;
    }

    response.json(result.rows[0]);
  })
);

app.delete(
  "/api/students/:id",
  asyncHandler(async (request, response) => {
    await removeById("students", routeParam(request.params.id), response);
  })
);

app.post(
  "/api/curriculum",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (!requireFields(body, response, ["specialityId", "disciplineId", "semester", "hours", "reportType"])) return;

    const result = await query(
      `INSERT INTO curriculum (speciality_id, discipline_id, semester, hours, report_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, speciality_id AS "specialityId", discipline_id AS "disciplineId",
        semester, hours, report_type AS "reportType"`,
      [
        Number(body.specialityId),
        Number(body.disciplineId),
        Number(body.semester),
        Number(body.hours),
        String(body.reportType).trim(),
      ]
    );

    response.status(201).json(result.rows[0]);
  })
);

app.put(
  "/api/curriculum/:id",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (!requireFields(body, response, ["specialityId", "disciplineId", "semester", "hours", "reportType"])) return;

    const result = await query(
      `UPDATE curriculum
       SET speciality_id = $1, discipline_id = $2, semester = $3, hours = $4, report_type = $5
       WHERE id = $6
       RETURNING id, speciality_id AS "specialityId", discipline_id AS "disciplineId",
        semester, hours, report_type AS "reportType"`,
      [
        Number(body.specialityId),
        Number(body.disciplineId),
        Number(body.semester),
        Number(body.hours),
        String(body.reportType).trim(),
        Number(routeParam(request.params.id)),
      ]
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Запись учебного плана не найдена" });
      return;
    }

    response.json(result.rows[0]);
  })
);

app.delete(
  "/api/curriculum/:id",
  asyncHandler(async (request, response) => {
    await removeById("curriculum", routeParam(request.params.id), response);
  })
);

app.post(
  "/api/performance",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (!requireFields(body, response, ["studentId", "disciplineId", "studyYear", "semester", "grade"])) return;

    const result = await query(
      `INSERT INTO performance_records (student_id, discipline_id, study_year, semester, grade)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, student_id AS "studentId", discipline_id AS "disciplineId",
        study_year AS "studyYear", semester, grade`,
      [
        Number(body.studentId),
        Number(body.disciplineId),
        Number(body.studyYear),
        Number(body.semester),
        String(body.grade),
      ]
    );

    response.status(201).json(result.rows[0]);
  })
);

app.put(
  "/api/performance/:id",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (!requireFields(body, response, ["studentId", "disciplineId", "studyYear", "semester", "grade"])) return;

    const result = await query(
      `UPDATE performance_records
       SET student_id = $1, discipline_id = $2, study_year = $3, semester = $4, grade = $5
       WHERE id = $6
       RETURNING id, student_id AS "studentId", discipline_id AS "disciplineId",
        study_year AS "studyYear", semester, grade`,
      [
        Number(body.studentId),
        Number(body.disciplineId),
        Number(body.studyYear),
        Number(body.semester),
        String(body.grade),
        Number(routeParam(request.params.id)),
      ]
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Оценка не найдена" });
      return;
    }

    response.json(result.rows[0]);
  })
);

app.delete(
  "/api/performance/:id",
  asyncHandler(async (request, response) => {
    await removeById("performance_records", routeParam(request.params.id), response);
  })
);

app.get(
  "/api/reports/summary",
  asyncHandler(async (request, response) => {
    const requestedGroupId = request.query.groupId ? Number(request.query.groupId) : null;
    const groupId = request.user?.role === "admin" ? requestedGroupId : request.user?.groupId || null;

    const result = await query(
      `WITH filtered_students AS (
        SELECT * FROM students
        WHERE $1::int IS NULL OR group_id = $1
      )
      SELECT
        (SELECT COUNT(*)::int FROM filtered_students) AS "studentsCount",
        (SELECT COUNT(*)::int FROM disciplines) AS "disciplinesCount",
        (SELECT COUNT(*)::int FROM performance_records pr
          JOIN filtered_students fs ON fs.id = pr.student_id) AS "gradesCount"`,
      [groupId]
    );

    response.json(result.rows[0]);
  })
);

async function start() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`API server started on http://localhost:${port}`);
  });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
