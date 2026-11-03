// قاعدة Neon المشتركة بين الدوال. الملف ده بيبدأ بـ _ عشان Vercel ميعملوش دالة لوحده.
// رابط القاعدة بيتحط في Vercel تلقائيًا لما تربط Neon من Storage (DATABASE_URL أو POSTGRES_URL).
import { neon } from "@neondatabase/serverless";

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const sql = URL ? neon(URL) : null;

let ready = null;
// جدول واحد للأحداث: مفيش فيه أي بيانات شخصية، بس رقم عشوائي للجهاز.
export function ensureTable(){
  if (!sql) return Promise.resolve(false);
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT now(),
      device TEXT NOT NULL,
      kind TEXT NOT NULL,
      lesson TEXT,
      detail TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS events_ts ON events (ts)`;
    return true;
  })().catch(e => { ready = null; throw e; });
  return ready;
}

export const KINDS = ["visit", "lesson", "discover", "group", "exam", "tutor"];
const clip = (s, n) => (s == null ? null : String(s).slice(0, n));

export async function logEvent({ device, kind, lesson, detail }){
  if (!sql || !KINDS.includes(kind)) return false;
  const d = clip(device, 64);
  if (!d) return false;
  await ensureTable();
  await sql`INSERT INTO events (device, kind, lesson, detail) VALUES (${d}, ${kind}, ${clip(lesson, 64)}, ${clip(detail, 64)})`;
  return true;
}

export const ALLOWED_ORIGINS = [
  "https://abdullahbadawi1999-collab.github.io",
  "http://localhost:8766",
  "http://127.0.0.1:8766",
];
export function cors(req, res){
  const origin = req.headers.origin || "";
  const host = req.headers.host ? `https://${req.headers.host}` : "";
  if (ALLOWED_ORIGINS.includes(origin) || origin === host) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
