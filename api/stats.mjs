// صفحة الإحصائيات للمعلم (أجهزة التجربة اللي بتبدأ بـ claude-test مش بتتعد): محمية بكلمة سر (STATS_KEY في إعدادات Vercel).
import { sql, ensureTable, LESSONS } from "./_db.mjs";
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
button{font:inherit;font-weight:700;background:#3A4FD6;color:#fff;border:0;border-radius:10px;padding:10px 20px;cursor:pointer}.err{color:#D93A45}
.chat{background:#fff;border:1px solid #E2E5F0;border-radius:14px;padding:12px 14px;margin:10px 0}.chat-meta{font-size:13px;color:#5A6080;margin-bottom:6px}.chat-meta b{color:#7A4FD6}
details{font-size:13px;color:#5A6080;margin-bottom:6px}summary{cursor:pointer}.ctx{background:#F0F2FA;border-radius:8px;padding:6px 10px;margin-top:4px}
.msg{border-radius:10px;padding:8px 12px;margin-top:6px;font-size:15px}.msg span{display:block;font-size:12px;font-weight:700;color:#5A6080}.msg.me{background:#E8EBFF}.msg.bot{background:#F0F2FA}.msg.fix{background:#E1F6EE}.msg.fix i{display:block;font-size:12px;color:#5A6080;font-style:normal;margin-top:4px}
.chat details.fx{margin:8px 0 0}.chat form{margin:6px 0 0;padding:10px;border-radius:10px}textarea{font:inherit;font-size:15px;width:100%;box-sizing:border-box;min-height:80px;padding:8px 10px;border:1.5px solid #E2E5F0;border-radius:10px;margin-bottom:8px}
.refresh{margin:10px 0;padding:10px 14px}.ok{background:#E1F6EE;color:#0F7A58;border-radius:10px;padding:8px 12px;font-weight:700}</style></head><body>${body}</body></html>`;

const form = (msg = "") => page(`<h1>إحصائيات المنصة</h1><form method="post"><label>كلمة السر</label><input type="password" name="key" autofocus>${msg ? `<p class="err">${msg}</p>` : ""}<button>دخول</button></form>`);

export default async function handler(req, res){
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const KEY = process.env.STATS_KEY || "";
  if (req.method !== "POST") return res.status(200).send(form());
  const field = n => typeof req.body === "object" ? req.body?.[n] : new URLSearchParams(String(req.body || "")).get(n);
  const key = field("key");
  if (!KEY) return res.status(200).send(form("لسه محتاج تحط STATS_KEY في إعدادات Vercel."));
  if (key !== KEY) return res.status(200).send(form("كلمة السر غلط."));
  if (!sql) return res.status(200).send(page(`<h1>إحصائيات المنصة</h1><p class="err">قاعدة البيانات لسه مش متوصلة. اربط Neon بالمشروع من Storage في Vercel.</p>`));
  await ensureTable();

  // المعلم كتب (أو مسح) تصحيح على رد من ردود المعلم الآلي
  let saved = "";
  if (field("action") === "correct") {
    const id = Number(field("id"));
    const fix = String(field("correction") || "").trim().slice(0, 2000);
    if (Number.isInteger(id)) {
      if (fix) await sql`UPDATE tutor_log SET correction = ${fix}, corrected_at = now(), seen_at = NULL WHERE id = ${id}`;
      else await sql`UPDATE tutor_log SET correction = NULL, corrected_at = NULL, seen_at = NULL WHERE id = ${id}`;
      saved = fix ? "اتحفظ التصحيح، وهيظهر للطالب ده أول ما يفتح المنصة من نفس الجهاز." : "اتشال التصحيح.";
    }
  }

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
  const chats = await sql`SELECT id, ts, device, lesson, place, context, message, reply, correction, seen_at FROM tutor_log
    WHERE device IS NULL OR device NOT LIKE 'claude-test%' ORDER BY ts DESC LIMIT 200`;
  // كل جهاز بياخد رقم «طالب ١، ٢…» حسب أول مرة سأل فيها، عشان المعلم يعرف الرسايل اللي من نفس الطالب
  const studentNo = new Map();
  [...chats].reverse().forEach(c => { const k = c.device || "?"; if (!studentNo.has(k)) studentNo.set(k, studentNo.size + 1); });
  const when = ts => new Date(ts).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  const text = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

  const card = (n, label) => `<div class="card"><b>${AR(n)}</b><span>${label}</span></div>`;
  const since = tot.since ? new Date(tot.since).toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo" }) : "—";
  return res.status(200).send(page(`
    <h1>إحصائيات المنصة</h1>${saved ? `<p class="ok">${esc(saved)}</p>` : ""}<form method="post" class="refresh"><input type="hidden" name="key" value="${esc(key)}"><button>حدّث الصفحة</button><span class="note"> عشان تشوف آخر الرسايل، واللي الطلاب شافوه من التصحيحات.</span></form><p class="note">كل جهاز بيتعد مرة واحدة (من غير أسماء). العدّ شغال من ${esc(since)}.</p>
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
    </table>
    <h2>رسايل المعلم الآلي</h2>
    <p class="note">آخر ${AR(chats.length)} رسالة، الأحدث فوق. «طالب ١، ٢…» رقم للجهاز مش اسم، وبيفضل ثابت لنفس الطالب. لو رد غلط، اكتب تصحيح تحته: هيظهر للطالب أول ما يفتح المنصة تاني من نفس الجهاز.</p>
    ${chats.map(c => `<div class="chat" id="c${c.id}">
      <div class="chat-meta"><b>طالب ${AR(studentNo.get(c.device || "?"))}</b> · ${esc(name(c.lesson))} · ${esc(PLACES[c.place] || c.place || "—")} · <span>${esc(when(c.ts))}</span></div>
      ${c.context ? `<details><summary>اللي كان قدامه في الصفحة</summary><div class="ctx">${text(c.context)}</div></details>` : ""}
      <div class="msg me"><span>الطالب:</span>${text(c.message)}</div>
      <div class="msg bot"><span>المعلم الآلي:</span>${text(c.reply)}</div>
      ${c.correction ? `<div class="msg fix"><span>تصحيحك:</span>${text(c.correction)}<i>${c.seen_at ? "الطالب شافه " + esc(when(c.seen_at)) : "لسه الطالب ما شافهوش"}</i></div>` : ""}
      <details class="fx"><summary>${c.correction ? "عدّل التصحيح أو امسحه" : "اكتب تصحيح للطالب"}</summary>
        <form method="post" action="#c${c.id}"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="action" value="correct"><input type="hidden" name="id" value="${c.id}">
          <textarea name="correction" placeholder="اكتب التصحيح اللي هيوصل للطالب. لو مسحت الكلام وحفظت، التصحيح بيتشال.">${esc(c.correction || "")}</textarea>
          <button>احفظ التصحيح</button></form></details>
    </div>`).join("") || `<p class="note">لسه مفيش رسايل.</p>`}`));
}
