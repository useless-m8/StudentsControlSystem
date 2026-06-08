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
  | "users"
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

function getRoleScopeValues(
  role: AuthUser["role"],
  body: Record<string, unknown>,
  response: Response
) {
  if (role !== "teacher") {
    return { groupId: null, groupIds: [], disciplineId: null, disciplineIds: [] };
  }

  const groupIds = readIdArray(body.groupIds ?? body.groupId);
  const disciplineIds = readIdArray(body.disciplineIds ?? body.disciplineId);

  if (groupIds.length === 0 || disciplineIds.length === 0) {
    badRequest(response, "Для преподавателя выберите минимум одну группу и одну дисциплину");
    return null;
  }

  return {
    groupId: groupIds[0],
    groupIds,
    disciplineId: disciplineIds[0],
    disciplineIds,
  };
}

function readIdArray(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(
    values
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  ));
}

function getUserNameValues(role: AuthUser["role"], body: Record<string, unknown>, response: Response) {
  const lastName = String(body.lastName || "").trim();
  const firstName = String(body.firstName || "").trim();
  const middleName = String(body.middleName || "").trim();

  if ((role === "education_staff" || role === "teacher") && (!lastName || !firstName)) {
    badRequest(response, "Для сотрудника или преподавателя заполните фамилию и имя");
    return null;
  }

  return { lastName, firstName, middleName };
}

async function saveTeacherScopes(userId: number, role: AuthUser["role"], groupIds: number[], disciplineIds: number[]) {
  await query("DELETE FROM teacher_groups WHERE user_id = $1", [userId]);
  await query("DELETE FROM teacher_disciplines WHERE user_id = $1", [userId]);

  if (role !== "teacher") {
    return;
  }

  if (groupIds.length > 0) {
    await query(
      `INSERT INTO teacher_groups (user_id, group_id)
       SELECT $1, unnest($2::int[])
       ON CONFLICT (user_id, group_id) DO NOTHING`,
      [userId, groupIds]
    );
  }

  if (disciplineIds.length > 0) {
    await query(
      `INSERT INTO teacher_disciplines (user_id, discipline_id)
       SELECT $1, unnest($2::int[])
       ON CONFLICT (user_id, discipline_id) DO NOTHING`,
      [userId, disciplineIds]
    );
  }
}

async function ensureTeacherCanWritePerformance(
  request: AuthRequest,
  response: Response,
  studentId: number,
  disciplineId: number,
  recordId?: number
) {
  if (request.user?.role !== "teacher") {
    return true;
  }

  if (request.user.groupIds.length === 0 || request.user.disciplineIds.length === 0) {
    response.status(403).json({ message: "Преподаватель не привязан к группе или дисциплине" });
    return false;
  }

  if (!request.user.disciplineIds.includes(disciplineId)) {
    response.status(403).json({ message: "Преподаватель может работать только со своими дисциплинами" });
    return false;
  }

  const student = await query(
    `SELECT id FROM students WHERE id = $1 AND group_id = ANY($2::int[])`,
    [studentId, request.user.groupIds]
  );

  if (student.rowCount === 0) {
    response.status(403).json({ message: "Преподаватель может работать только со своими группами" });
    return false;
  }

  if (recordId === undefined) {
    return true;
  }

  const record = await query(
    `SELECT pr.id
     FROM performance_records pr
     JOIN students st ON st.id = pr.student_id
     WHERE pr.id = $1 AND st.group_id = ANY($2::int[]) AND pr.discipline_id = ANY($3::int[])`,
    [recordId, request.user.groupIds, request.user.disciplineIds]
  );

  if (record.rowCount === 0) {
    response.status(403).json({ message: "Преподаватель может изменять только оценки своей группы и дисциплины" });
    return false;
  }

  return true;
}

async function ensureTeacherCanDeletePerformance(
  request: AuthRequest,
  response: Response,
  recordId: number
) {
  if (request.user?.role !== "teacher") {
    return true;
  }

  if (request.user.groupIds.length === 0 || request.user.disciplineIds.length === 0) {
    response.status(403).json({ message: "Преподаватель не привязан к группе или дисциплине" });
    return false;
  }

  const record = await query(
    `SELECT pr.id
     FROM performance_records pr
     JOIN students st ON st.id = pr.student_id
     WHERE pr.id = $1 AND st.group_id = ANY($2::int[]) AND pr.discipline_id = ANY($3::int[])`,
    [recordId, request.user.groupIds, request.user.disciplineIds]
  );

  if (record.rowCount === 0) {
    response.status(403).json({ message: "Преподаватель может удалять только оценки своей группы и дисциплины" });
    return false;
  }

  return true;
}

function publicRoute(request: Request) {
  return (
    request.path === "/api/health" ||
    (request.method === "POST" && request.path === "/api/auth/login")
  );
}

function isForeignKeyViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

function dependencyDeleteMessage(table: TableName) {
  const messages: Partial<Record<TableName, string>> = {
    education_forms: "Нельзя удалить форму обучения, пока к ней привязаны студенты.",
    specialities: "Нельзя удалить специальность, пока к ней привязаны группы или записи учебного плана.",
    disciplines: "Нельзя удалить дисциплину, пока она используется в учебном плане, журнале или у преподавателей.",
    student_groups: "Нельзя удалить группу, пока к ней привязаны студенты или пользователи.",
    students: "Нельзя удалить студента, пока к нему привязаны связанные записи.",
    curriculum: "Нельзя удалить запись учебного плана, пока к ней привязаны связанные данные.",
  };

  return messages[table] || "Нельзя удалить запись, потому что она используется в других данных.";
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
    const user = verifyAuthToken(token, jwtSecret);
    request.user = {
      ...user,
      lastName: user.lastName || "",
      firstName: user.firstName || "",
      middleName: user.middleName || "",
      groupIds: Array.isArray(user.groupIds) ? user.groupIds : (user.groupId ? [user.groupId] : []),
      disciplineIds: Array.isArray(user.disciplineIds) ? user.disciplineIds : (user.disciplineId ? [user.disciplineId] : []),
    };
    next();
  } catch {
    response.status(401).json({ message: "Сессия истекла, войдите заново" });
  }
}

function canModify(request: AuthRequest, response: Response, next: NextFunction) {
  if (publicRoute(request) || request.method === "GET") {
    next();
    return;
  }

  const role = request.user?.role;
  const method = request.method;
  const path = request.path;
  const academicPath =
    path.startsWith("/api/directories") ||
    path.startsWith("/api/groups") ||
    path.startsWith("/api/curriculum");
  const allowed =
    role === "admin" ||
    (role === "education_staff" && path.startsWith("/api/students") && ["POST", "PUT"].includes(method)) ||
    (role === "education_staff" && academicPath && ["POST", "PUT", "DELETE"].includes(method)) ||
    (role === "education_staff" && path.startsWith("/api/performance") && ["POST", "PUT", "DELETE"].includes(method)) ||
    (role === "teacher" && path.startsWith("/api/performance") && ["POST", "PUT", "DELETE"].includes(method));

  if (!allowed) {
    response.status(403).json({ message: "Недостаточно прав доступа" });
    return;
  }

  next();
}

app.use(authMiddleware);
app.use(canModify);

async function removeById(table: TableName, id: string, response: Response) {
  let result;

  try {
    result = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [
      Number(id),
    ]);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      response.status(409).json({ message: dependencyDeleteMessage(table) });
      return;
    }

    throw error;
  }

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
    lastName: string;
    firstName: string;
    middleName: string;
    passwordHash: string | null;
    password: string;
    role: AuthUser["role"];
    groupId: number | null;
    groupIds: number[];
    studentId: number | null;
    disciplineId: number | null;
    disciplineIds: number[];
  }>(
    `SELECT u.id, u.login,
      u.last_name AS "lastName", u.first_name AS "firstName", u.middle_name AS "middleName",
      u.password_hash AS "passwordHash", u.password, u.role,
      u.group_id AS "groupId",
      COALESCE(
        (SELECT array_agg(tg.group_id ORDER BY tg.group_id) FROM teacher_groups tg WHERE tg.user_id = u.id),
        CASE WHEN u.group_id IS NULL THEN ARRAY[]::int[] ELSE ARRAY[u.group_id] END
      ) AS "groupIds",
      u.student_id AS "studentId",
      u.discipline_id AS "disciplineId",
      COALESCE(
        (SELECT array_agg(td.discipline_id ORDER BY td.discipline_id) FROM teacher_disciplines td WHERE td.user_id = u.id),
        CASE WHEN u.discipline_id IS NULL THEN ARRAY[]::int[] ELSE ARRAY[u.discipline_id] END
      ) AS "disciplineIds"
     FROM users u
     WHERE u.login = $1`,
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
       RETURNING id, login,
        '' AS "lastName", '' AS "firstName", '' AS "middleName",
        role, group_id AS "groupId",
        ARRAY[group_id] AS "groupIds",
        student_id AS "studentId",
        NULL::int AS "disciplineId",
        ARRAY[]::int[] AS "disciplineIds"`,
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
      lastName: userRow.lastName,
      firstName: userRow.firstName,
      middleName: userRow.middleName,
      role: userRow.role,
      groupId: userRow.groupId,
      groupIds: userRow.groupIds,
      studentId: userRow.studentId,
      disciplineId: userRow.disciplineId,
      disciplineIds: userRow.disciplineIds,
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

    const { groupScope, studentScope, disciplineScope } = getDataScope(user);

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
         WHERE $1::int[] IS NULL OR id = ANY($1::int[])
         ORDER BY id`,
        [groupScope]
      ),
      query(
        `SELECT id, last_name AS "lastName", first_name AS "firstName",
          middle_name AS "middleName", admission_year AS "admissionYear",
          education_form_id AS "educationFormId", group_id AS "groupId"
         FROM students
         WHERE ($1::int[] IS NULL OR group_id = ANY($1::int[]))
           AND ($2::int IS NULL OR id = $2)
         ORDER BY last_name, first_name, id`,
        [groupScope, studentScope]
      ),
      query(
        `SELECT pr.id, pr.student_id AS "studentId", pr.discipline_id AS "disciplineId",
          pr.study_year AS "studyYear", pr.semester, pr.grade
         FROM performance_records pr
         JOIN students st ON st.id = pr.student_id
         WHERE ($1::int[] IS NULL OR st.group_id = ANY($1::int[]))
           AND ($2::int IS NULL OR st.id = $2)
           AND ($3::int[] IS NULL OR pr.discipline_id = ANY($3::int[]))
         ORDER BY pr.study_year DESC, pr.semester DESC, pr.id`,
        [groupScope, studentScope, disciplineScope]
      ),
      query(
        `SELECT DISTINCT s.id, s.name
         FROM specialities s
         LEFT JOIN student_groups g ON g.speciality_id = s.id
         WHERE $1::int[] IS NULL OR g.id = ANY($1::int[])
         ORDER BY s.id`,
        [groupScope]
      ),
      query(
        `SELECT c.id, c.speciality_id AS "specialityId", c.discipline_id AS "disciplineId",
          c.semester, c.hours, c.report_type AS "reportType"
         FROM curriculum c
         WHERE ($1::int[] IS NULL OR c.speciality_id IN (
           SELECT speciality_id FROM student_groups WHERE id = ANY($1::int[])
         ))
           AND ($2::int[] IS NULL OR c.discipline_id = ANY($2::int[]))
         ORDER BY c.semester, c.id`,
        [groupScope, disciplineScope]
      ),
      query(
        `SELECT DISTINCT d.id, d.name
         FROM disciplines d
         LEFT JOIN curriculum c ON c.discipline_id = d.id
         WHERE ($1::int[] IS NULL OR c.speciality_id IN (
           SELECT speciality_id FROM student_groups WHERE id = ANY($1::int[])
         ))
           AND ($2::int[] IS NULL OR d.id = ANY($2::int[]))
         ORDER BY d.id`,
        [groupScope, disciplineScope]
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

app.get(
  "/api/users",
  asyncHandler(async (_request, response) => {
    const result = await query<AuthUser>(
      `SELECT u.id, u.login,
        u.last_name AS "lastName", u.first_name AS "firstName", u.middle_name AS "middleName",
        u.role, u.group_id AS "groupId",
        COALESCE(
          (SELECT array_agg(tg.group_id ORDER BY tg.group_id) FROM teacher_groups tg WHERE tg.user_id = u.id),
          CASE WHEN u.group_id IS NULL THEN ARRAY[]::int[] ELSE ARRAY[u.group_id] END
        ) AS "groupIds",
        u.student_id AS "studentId",
        u.discipline_id AS "disciplineId",
        COALESCE(
          (SELECT array_agg(td.discipline_id ORDER BY td.discipline_id) FROM teacher_disciplines td WHERE td.user_id = u.id),
          CASE WHEN u.discipline_id IS NULL THEN ARRAY[]::int[] ELSE ARRAY[u.discipline_id] END
        ) AS "disciplineIds"
       FROM users u
       ORDER BY u.id`
    );

    response.json(result.rows);
  })
);

app.post(
  "/api/users",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (!requireFields(body, response, ["login", "password", "role"])) return;

    const role = String(body.role) as AuthUser["role"];
    if (!["admin", "education_staff", "teacher"].includes(role)) {
      badRequest(response, "Некорректная роль пользователя");
      return;
    }

    const scopeValues = getRoleScopeValues(role, body, response);
    if (!scopeValues) return;
    const nameValues = getUserNameValues(role, body, response);
    if (!nameValues) return;

    const passwordHash = await bcrypt.hash(String(body.password), 10);
    const result = await query<AuthUser>(
      `INSERT INTO users (login, last_name, first_name, middle_name, password, password_hash, role, group_id, discipline_id)
       VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8)
       RETURNING id, login,
        last_name AS "lastName", first_name AS "firstName", middle_name AS "middleName",
        role, group_id AS "groupId",
        student_id AS "studentId", discipline_id AS "disciplineId"`,
      [
        String(body.login).trim(),
        nameValues.lastName,
        nameValues.firstName,
        nameValues.middleName,
        passwordHash,
        role,
        scopeValues.groupId,
        scopeValues.disciplineId,
      ]
    );

    await saveTeacherScopes(result.rows[0].id, role, scopeValues.groupIds, scopeValues.disciplineIds);

    response.status(201).json({
      ...result.rows[0],
      groupIds: scopeValues.groupIds,
      disciplineIds: scopeValues.disciplineIds,
    });
  })
);

app.put(
  "/api/users/:id",
  asyncHandler(async (request, response) => {
    const body = request.body as Record<string, unknown>;
    if (!requireFields(body, response, ["login", "role"])) return;

    const role = String(body.role) as AuthUser["role"];
    if (!["admin", "education_staff", "teacher"].includes(role)) {
      badRequest(response, "Некорректная роль пользователя");
      return;
    }

    const scopeValues = getRoleScopeValues(role, body, response);
    if (!scopeValues) return;
    const nameValues = getUserNameValues(role, body, response);
    if (!nameValues) return;

    const password = String(body.password || "");
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const result = await query<AuthUser>(
      `UPDATE users
       SET login = $1,
         last_name = $2,
         first_name = $3,
         middle_name = $4,
         role = $5,
         group_id = $6,
         discipline_id = $7,
         password_hash = COALESCE($8, password_hash)
       WHERE id = $9
       RETURNING id, login,
        last_name AS "lastName", first_name AS "firstName", middle_name AS "middleName",
        role, group_id AS "groupId",
        student_id AS "studentId", discipline_id AS "disciplineId"`,
      [
        String(body.login).trim(),
        nameValues.lastName,
        nameValues.firstName,
        nameValues.middleName,
        role,
        scopeValues.groupId,
        scopeValues.disciplineId,
        passwordHash,
        Number(routeParam(request.params.id)),
      ]
    );

    if (result.rowCount === 0) {
      response.status(404).json({ message: "Пользователь не найден" });
      return;
    }

    await saveTeacherScopes(result.rows[0].id, role, scopeValues.groupIds, scopeValues.disciplineIds);

    response.json({
      ...result.rows[0],
      groupIds: scopeValues.groupIds,
      disciplineIds: scopeValues.disciplineIds,
    });
  })
);

app.delete(
  "/api/users/:id",
  asyncHandler(async (request, response) => {
    await removeById("users", routeParam(request.params.id), response);
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

    const studentId = Number(body.studentId);
    const disciplineId = Number(body.disciplineId);
    if (!(await ensureTeacherCanWritePerformance(request, response, studentId, disciplineId))) return;

    const result = await query(
      `INSERT INTO performance_records (student_id, discipline_id, study_year, semester, grade)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, student_id AS "studentId", discipline_id AS "disciplineId",
        study_year AS "studyYear", semester, grade`,
      [
        studentId,
        disciplineId,
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

    const studentId = Number(body.studentId);
    const disciplineId = Number(body.disciplineId);
    const recordId = Number(routeParam(request.params.id));
    if (!(await ensureTeacherCanWritePerformance(request, response, studentId, disciplineId, recordId))) return;

    const result = await query(
      `UPDATE performance_records
       SET student_id = $1, discipline_id = $2, study_year = $3, semester = $4, grade = $5
       WHERE id = $6
       RETURNING id, student_id AS "studentId", discipline_id AS "disciplineId",
        study_year AS "studyYear", semester, grade`,
      [
        studentId,
        disciplineId,
        Number(body.studyYear),
        Number(body.semester),
        String(body.grade),
        recordId,
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
    const recordId = Number(routeParam(request.params.id));
    if (!(await ensureTeacherCanDeletePerformance(request, response, recordId))) return;

    await removeById("performance_records", String(recordId), response);
  })
);

app.get(
  "/api/reports/summary",
  asyncHandler(async (request, response) => {
    const requestedGroupId = request.query.groupId ? Number(request.query.groupId) : null;
    const groupIds = request.user?.role === "admin"
      ? (requestedGroupId ? [requestedGroupId] : null)
      : request.user?.groupIds || null;

    const result = await query(
      `WITH filtered_students AS (
        SELECT * FROM students
        WHERE $1::int[] IS NULL OR group_id = ANY($1::int[])
      )
      SELECT
        (SELECT COUNT(*)::int FROM filtered_students) AS "studentsCount",
        (SELECT COUNT(*)::int FROM disciplines) AS "disciplinesCount",
        (SELECT COUNT(*)::int FROM performance_records pr
          JOIN filtered_students fs ON fs.id = pr.student_id) AS "gradesCount"`,
      [groupIds]
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
