// صفحة الإحصائيات للمعلم (أجهزة التجربة اللي بتبدأ بـ claude-test مش بتتعد): محمية بكلمة سر (STATS_KEY في إعدادات Vercel).
import { sql, ensureTable } from "./_db.mjs";

const LESSONS = { "al-mizan-alsarfi": "الميزان الصرفي", "ism-alfa3il": "اسم الفاعل", "ism-almaf3ol": "اسم المفعول", "siyagh-almubalagha": "صيغ المبالغة" };
const PLACES = { rule: "تحت القاعدة", drill: "في التدريبات", exam: "في نماذج الامتحان" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const AR = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const name = id => LESSONS[id] || id || "—";

const page = (body) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>إحصائيات المنصة</title>
<style>body{font-family:"Segoe UI",Tahoma,sans-serif;max-width:760px;margin:0 auto;padding:20px 16px 40px;background:#F5F6FB;color:#161A33;line-height:1.7}
h1{font-size:24px;margin:8px 0 4px}h2{font-size:17px;margin:26px 0 10px;color:#3A4FD6}.note{color:#5A6080;font-size:13.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.card{background:#fff;border:1px solid #E2E5F0;border-radius:14px;padding:12px 14px}
.card b{display:block;font-size:26px}.card span{font-size:13px;color:#5A6080}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #E2E5F0;border-radius:12px;overflow:hidden}
th,td{padding:8px 12px;text-align:start;border-bottom:1px solid #E2E5F0;font-size:14.5px}th{background:#F0F2FA;font-size:13px;color:#5A6080}
form{background:#fff;border:1px solid #E2E5F0;border-radius:14px;padding:18px;margin-top:20px}input{font:inherit;padding:10px;border:1.5px solid #E2E5F0;border-radius:10px;width:100%;box-sizing:border-box;margin:8px 0}
button{font:inherit;font-weight:700;background:#3A4FD6;color:#fff;border:0;border-radius:10px;padding:10px 20px;cursor:pointer}.err{color:#D93A45}</style></head><body>${body}</body></html>`;

const form = (msg = "") => page(`<h1>إحصائيات المنصة</h1><form method="post"><label>كلمة السر</label><input type="password" name="key" autofocus>${msg ? `<p class="err">${msg}</p>` : ""}<button>دخول</button></form>`);

export default async function handler(req, res){
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const KEY = process.env.STATS_KEY || "";
  if (req.method !== "POST") return res.status(200).send(form());
  const key = typeof req.body === "object" ? req.body?.key : new URLSearchParams(String(req.body || "")).get("key");
  if (!KEY) return res.status(200).send(form("لسه محتاج تحط STATS_KEY في إعدادات Vercel."));
  if (key !== KEY) return res.status(200).send(form("كلمة السر غلط."));
  if (!sql) return res.status(200).send(page(`<h1>إحصائيات المنصة</h1><p class="err">قاعدة البيانات لسه مش متوصلة. اربط Neon بالمشروع من Storage في Vercel.</p>`));
  await ensureTable();

  // «النهارده» بتوقيت القاهرة
  const [tot] = await sql`SELECT
      COUNT(DISTINCT device) FILTER (WHERE (ts AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date) AS today,
      COUNT(DISTINCT device) FILTER (WHERE ts > now() - interval '7 days') AS week,
      COUNT(DISTINCT device) AS ever,
      COUNT(*) FILTER (WHERE kind = 'tutor') AS tutor_all,
      COUNT(*) FILTER (WHERE kind = 'tutor' AND ts > now() - interval '7 days') AS tutor_week,
      COUNT(DISTINCT device) FILTER (WHERE kind = 'tutor') AS tutor_devices,
      MIN(ts) AS since
    FROM events WHERE device NOT LIKE 'claude-test%'`;
  const lessons = await sql`SELECT lesson,
      COUNT(DISTINCT device) FILTER (WHERE kind = 'lesson') AS devices,
      COUNT(*) FILTER (WHERE kind = 'lesson') AS opens,
      COUNT(*) FILTER (WHERE kind = 'group') AS groups,
      COUNT(*) FILTER (WHERE kind = 'exam') AS exams,
      COUNT(*) FILTER (WHERE kind = 'tutor') AS tutor,
      COUNT(DISTINCT device) FILTER (WHERE kind = 'tutor') AS tutor_devices
    FROM events WHERE lesson IS NOT NULL AND device NOT LIKE 'claude-test%' GROUP BY lesson ORDER BY opens DESC`;
  const places = await sql`SELECT detail, COUNT(*) AS n FROM events WHERE kind = 'tutor' AND device NOT LIKE 'claude-test%' GROUP BY detail ORDER BY n DESC`;
  const days = await sql`SELECT (ts AT TIME ZONE 'Africa/Cairo')::date AS day, COUNT(DISTINCT device) AS devices, COUNT(*) FILTER (WHERE kind = 'tutor') AS tutor
    FROM events WHERE ts > now() - interval '14 days' AND device NOT LIKE 'claude-test%' GROUP BY day ORDER BY day DESC`;

  const card = (n, label) => `<div class="card"><b>${AR(n)}</b><span>${label}</span></div>`;
  const since = tot.since ? new Date(tot.since).toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo" }) : "—";
  return res.status(200).send(page(`
    <h1>إحصائيات المنصة</h1><p class="note">كل جهاز بيتعد مرة واحدة (من غير أسماء). العدّ شغال من ${esc(since)}.</p>
    <h2>الطلاب اللي دخلوا</h2>
    <div class="cards">${card(tot.today, "النهارده")}${card(tot.week, "آخر ٧ أيام")}${card(tot.ever, "من الأول")}</div>
    <h2>اسأل المعلم الآلي</h2>
    <div class="cards">${card(tot.tutor_all, "سؤال من الأول")}${card(tot.tutor_week, "سؤال في آخر ٧ أيام")}${card(tot.tutor_devices, "طالب استخدمه")}</div>
    ${places.length ? `<table style="margin-top:10px"><tr><th>المكان</th><th>عدد الأسئلة</th></tr>${places.map(p => `<tr><td>${esc(PLACES[p.detail] || p.detail || "—")}</td><td>${AR(p.n)}</td></tr>`).join("")}</table>` : ""}
    <h2>الدروس</h2>
    <table><tr><th>الدرس</th><th>طلاب فتحوه</th><th>مرات الفتح</th><th>مجموعات اتحلت</th><th>نماذج امتحان</th><th>أسئلة للمعلم الآلي</th></tr>
      ${lessons.map(l => `<tr><td>${esc(name(l.lesson))}</td><td>${AR(l.devices)}</td><td>${AR(l.opens)}</td><td>${AR(l.groups)}</td><td>${AR(l.exams)}</td><td>${AR(l.tutor)} (${AR(l.tutor_devices)} طالب)</td></tr>`).join("") || `<tr><td colspan="6">لسه مفيش بيانات</td></tr>`}
    </table>
    <h2>آخر ١٤ يوم</h2>
    <table><tr><th>اليوم</th><th>طلاب</th><th>أسئلة للمعلم الآلي</th></tr>
      ${days.map(d => `<tr><td>${esc(new Date(d.day).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }))}</td><td>${AR(d.devices)}</td><td>${AR(d.tutor)}</td></tr>`).join("") || `<tr><td colspan="3">لسه مفيش بيانات</td></tr>`}
    </table>`));
}
