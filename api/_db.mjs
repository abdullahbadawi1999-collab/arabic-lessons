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
    // نص رسايل المعلم الآلي وردوده، عشان المعلم يشوفها في صفحة الإحصائيات
    await sql`CREATE TABLE IF NOT EXISTS tutor_log (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT now(),
      device TEXT,
      lesson TEXT,
      place TEXT,
      context TEXT,
      message TEXT NOT NULL,
      reply TEXT
    )`;
    // تصحيح المعلم على رد المعلم الآلي: بيظهر للطالب على نفس الجهاز أول ما يفتح المنصة
    await sql`ALTER TABLE tutor_log ADD COLUMN IF NOT EXISTS correction TEXT`;
    await sql`ALTER TABLE tutor_log ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ`;
    await sql`ALTER TABLE tutor_log ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ`;
    // الموديل اللي رد وعدد التوكنز، عشان صفحة الإحصائيات تحسب التكلفة
    await sql`ALTER TABLE tutor_log ADD COLUMN IF NOT EXISTS model TEXT`;
    await sql`ALTER TABLE tutor_log ADD COLUMN IF NOT EXISTS input_tokens INTEGER`;
    await sql`ALTER TABLE tutor_log ADD COLUMN IF NOT EXISTS output_tokens INTEGER`;
    // «قول ملاحظاتك»: رسايل الطلاب للمعلم من الصفحة الرئيسية (الاسم اختياري)
    await sql`CREATE TABLE IF NOT EXISTS feedback (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT now(),
      device TEXT,
      name TEXT,
      message TEXT NOT NULL
    )`;
    return true;
  })().catch(e => { ready = null; throw e; });
  return ready;
}

export const LESSONS = { "al-mizan-alsarfi": "الميزان الصرفي", "ism-alfa3il": "اسم الفاعل", "ism-almaf3ol": "اسم المفعول", "siyagh-almubalagha": "صيغ المبالغة", "ism-almakan": "اسم المكان" };

// سعر الموديلات بالدولار لكل مليون توكن [اللي بيتبعت، اللي بيتكتب] — التفكير بيتحسب مع اللي بيتكتب
export const PRICES = { "claude-opus-5-5": [4, 20], "claude-opus-5": [5, 25], "claude-opus-4-8": [5, 25], "claude-sonnet-5-5": [2, 10], "claude-sonnet-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };
export const costUSD = (model, inTok, outTok) => { const [i, o] = PRICES[model] || PRICES["claude-opus-5-5"]; return ((inTok || 0) * i + (outTok || 0) * o) / 1e6; };

export const KINDS = ["visit", "lesson", "video", "discover", "group", "groupdone", "discoverdone", "exam", "tutor"];
const clip = (s, n) => (s == null ? null : String(s).slice(0, n));

export async function logEvent({ device, kind, lesson, detail }){
  if (!sql || !KINDS.includes(kind)) return false;
  const d = clip(device, 64);
  if (!d) return false;
  await ensureTable();
  await sql`INSERT INTO events (device, kind, lesson, detail) VALUES (${d}, ${kind}, ${clip(lesson, 64)}, ${clip(detail, 64)})`;
  return true;
}

export async function logTutor({ device, lesson, place, context, message, reply, model, inputTokens, outputTokens }){
  if (!sql) return false;
  await ensureTable();
  const int = n => (Number.isFinite(n) ? Math.round(n) : null);
  await sql`INSERT INTO tutor_log (device, lesson, place, context, message, reply, model, input_tokens, output_tokens)
    VALUES (${clip(device, 64)}, ${clip(lesson, 64)}, ${clip(place, 16)}, ${clip(context, 1500)}, ${clip(message, 600)}, ${clip(reply, 4000)}, ${clip(model, 64)}, ${int(inputTokens)}, ${int(outputTokens)})`;
  return true;
}

export const ALLOWED_ORIGINS = [
  "https://abdullahbadawi1999.github.io", // لو الاسم اتغيّر تاني
  "https://abdullahbadawi1999-collab.github.io", // اسم حساب GitHub الحالي (اترجع للاسم ده)
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
