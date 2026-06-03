import dotenv from "dotenv";
import pg, { type QueryResultRow } from "pg";

dotenv.config({ quiet: true });

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 55432),
  database: process.env.PGDATABASE || "students_course",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return pool.query<T>(text, params);
}

export async function closePool() {
  await pool.end();
}
