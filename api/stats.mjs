// صفحة الإحصائيات للمعلم (أجهزة التجربة اللي بتبدأ بـ claude-test مش بتتعد): محمية بكلمة سر (STATS_KEY في إعدادات Vercel).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql, ensureTable, LESSONS } from "./_db.mjs";

// أسماء المجموعات ونماذج الامتحان بتتقري من ملفات الدروس نفسها (vercel.json بيضمّها للدالة)
const ORD = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const metaCache = new Map();
function lessonMeta(id){
  if (!metaCache.has(id)) {
    let L = null;
    try { if (/^[a-z0-9-]+$/.test(id || "")) L = JSON.parse(readFileSync(join(process.cwd(), "lessons", id + ".json"), "utf8")); } catch {}
    const groups = L?.drill?.groups || [], exams = L?.exams || [];
    const gi = g => { const i = groups.findIndex(x => x.id === g); return i < 0 ? 99 : i; };
    const xi = x => { const i = exams.findIndex(e => e.id === x); return i < 0 ? 99 : i; };
    metaCache.set(id, {
      groupIndex: gi, examIndex: xi,
      groupName: g => { const i = gi(g); return i < 99 ? `أسئلة الجزء ${ORD[i] || i + 1} (${groups[i].level})` : g; },
      examName: x => { const i = xi(x); return i < 99 ? exams[i].title : x; },
    });
  }
  return metaCache.get(id);
}
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
.refresh{margin:10px 0;padding:10px 14px}
.today{background:#fff;border:1px solid #E2E5F0;border-radius:14px;padding:12px 16px;margin:10px 0}.today h3{margin:0;font-size:17px}.today p{margin:0 0 6px}.today ul{margin:0;padding-inline-start:20px}.today li{margin:3px 0}.today ul ul{font-size:14.5px}
details.chat{font-size:inherit;color:inherit;margin:8px 0;padding:0}details.chat>summary{cursor:pointer;list-style:none;padding:10px 14px}details.chat>summary::-webkit-details-marker{display:none}
details.chat[open]>summary{border-bottom:1px solid #E2E5F0}details.chat>:not(summary){margin-inline:14px}details.chat>:last-child{margin-bottom:12px}
details.chat .chat-meta{margin:0}details.chat .q{font-size:15.5px;font-weight:600}details.chat .q::before{content:"◂ ";color:#3A4FD6}details.chat[open] .q::before{content:"▾ "}
.tag{background:#E1F6EE;color:#0F7A58;border-radius:99px;padding:0 8px;font-weight:700}.msg.ctx{background:#FFF8E6}.ok{background:#E1F6EE;color:#0F7A58;border-radius:10px;padding:8px 12px;font-weight:700}</style></head><body>${body}</body></html>`;

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
      COUNT(*) FILTER (WHERE kind = 'video') AS videos,
      COUNT(*) FILTER (WHERE kind = 'group') AS groups,
      COUNT(*) FILTER (WHERE kind = 'exam') AS exams,
      COUNT(*) FILTER (WHERE kind = 'tutor') AS tutor,
      COUNT(DISTINCT device) FILTER (WHERE kind = 'tutor') AS tutor_devices
    FROM events WHERE lesson IS NOT NULL AND device NOT LIKE 'claude-test%' GROUP BY lesson ORDER BY opens DESC`;
  const places = await sql`SELECT detail, COUNT(*) AS n FROM events WHERE kind = 'tutor' AND device NOT LIKE 'claude-test%' GROUP BY detail ORDER BY n DESC`;
  const days = await sql`SELECT (ts AT TIME ZONE 'Africa/Cairo')::date AS day, COUNT(DISTINCT device) AS devices, COUNT(*) FILTER (WHERE kind = 'tutor') AS tutor
    FROM events WHERE ts > now() - interval '14 days' AND device NOT LIKE 'claude-test%' GROUP BY day ORDER BY day DESC`;
  // ===== النهارده بالتفصيل: كل درس اتفتح كام مرة ومن كام طالب، وعمل فيه إيه بالظبط =====
  const todayRows = await sql`SELECT lesson, kind, split_part(COALESCE(detail, ''), ':', 1) AS item,
      COUNT(*) AS n, COUNT(DISTINCT device) AS d,
      string_agg(split_part(detail, ':', 2), ' ، ' ORDER BY ts) FILTER (WHERE kind = 'groupdone') AS scores
    FROM events
    WHERE lesson IS NOT NULL AND device NOT LIKE 'claude-test%'
      AND (ts AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date
    GROUP BY 1, 2, 3`;
  const byLesson = new Map();
  for (const r of todayRows) {
    if (!byLesson.has(r.lesson)) byLesson.set(r.lesson, []);
    byLesson.get(r.lesson).push(r);
  }
  // العدد بالعربي الصح: مرة واحدة، مرتين، ٣ مرات، ١١ مرة…
  const count = (n, unit, one, two, few) => { n = Number(n); return n === 1 ? one : n === 2 ? two : AR(n) + " " + (n >= 3 && n <= 10 ? few : unit); };
  const times = (n, d) => `${count(n, "مرة", "مرة واحدة", "مرتين", "مرات")} (${count(d, "طالب", "طالب واحد", "طالبين", "طلاب")})`;
  const scoreTxt = s => (s || "").split(" ، ").filter(Boolean).map(x => AR(x.replace("/", " من "))).join(" ، ");
  const lessonToday = id => {
    const rows = byLesson.get(id) || [];
    const get = (kind, item) => rows.filter(r => r.kind === kind && (item == null || r.item === item));
    const one = kind => get(kind)[0];
    const open = one("lesson"), video = one("video"), disc = one("discover"), discDone = one("discoverdone"), tutor = one("tutor");
    const meta = lessonMeta(id);
    const groupIds = [...new Set(rows.filter(r => r.kind === "group" || r.kind === "groupdone").map(r => r.item))];
    groupIds.sort((a, b) => meta.groupIndex(a) - meta.groupIndex(b));
    const examIds = [...new Set(rows.filter(r => r.kind === "exam").map(r => r.item))];
    examIds.sort((a, b) => meta.examIndex(a) - meta.examIndex(b));
    const lines = [];
    lines.push(`<li><b>فيديو الشرح:</b> ${video ? times(video.n, video.d) : "محدش فتحه"}</li>`);
    lines.push(`<li><b>اكتشف القاعدة:</b> ${disc ? "بدأها " + times(disc.n, disc.d) : "محدش بدأها"}${discDone ? ` · خلّصها ${times(discDone.n, discDone.d)}` : ""}</li>`);
    lines.push(`<li><b>التدريبات:</b> ${groupIds.length ? `<ul>${groupIds.map(g => {
      const st = get("group", g)[0], dn = get("groupdone", g)[0];
      return `<li>${esc(meta.groupName(g))}: ${st ? "بدأها " + times(st.n, st.d) : ""}${dn ? `${st ? " · " : ""}خلّصها ${times(dn.n, dn.d)} — الدرجات: ${scoreTxt(dn.scores)}` : ""}</li>`;
    }).join("")}</ul>` : "محدش دخلها"}</li>`);
    lines.push(`<li><b>نماذج الامتحان:</b> ${examIds.length ? `<ul>${examIds.map(x => { const r = get("exam", x)[0]; return `<li>${esc(meta.examName(x))}: ${times(r.n, r.d)}</li>`; }).join("")}</ul>` : "محدش فتحها"}</li>`);
    lines.push(`<li><b>أسئلة للمعلم الآلي:</b> ${tutor ? `${count(tutor.n, "سؤال", "سؤال واحد", "سؤالين", "أسئلة")} (${count(tutor.d, "طالب", "طالب واحد", "طالبين", "طلاب")})` : "مفيش"}</li>`);
    return `<div class="today"><h3>${esc(name(id))}</h3><p class="note">${open ? `اتفتح ${times(open.n, open.d)}` : "متفتحش من صفحة الدرس النهارده"}</p><ul>${lines.join("")}</ul></div>`;
  };
  const todayIds = Object.keys(LESSONS).filter(id => byLesson.has(id)).concat([...byLesson.keys()].filter(id => !LESSONS[id]));

  // ===== ملاحظات الطلاب («قول ملاحظاتك» في الصفحة الرئيسية) =====
  const notes = await sql`SELECT id, ts, name, message FROM feedback
    WHERE device IS NULL OR device NOT LIKE 'claude-test%' ORDER BY ts DESC LIMIT 200`;

  // ===== رسايل المعلم الآلي: النهارده بس، وزرار يعرض القديم =====
  const showAll = field("all") === "1";
  const openId = Number(field("id")) || null;
  const chats = showAll
    ? await sql`SELECT id, ts, device, lesson, place, context, message, reply, correction, seen_at FROM tutor_log
        WHERE device IS NULL OR device NOT LIKE 'claude-test%' ORDER BY ts DESC LIMIT 300`
    : await sql`SELECT id, ts, device, lesson, place, context, message, reply, correction, seen_at FROM tutor_log
        WHERE (device IS NULL OR device NOT LIKE 'claude-test%')
          AND (ts AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date ORDER BY ts DESC`;
  // كل جهاز بياخد رقم «طالب ١، ٢…» حسب أول مرة سأل فيها (من الأول خالص)، فالرقم بيفضل ثابت في النهارده والقديم
  const firsts = await sql`SELECT device FROM tutor_log WHERE device IS NULL OR device NOT LIKE 'claude-test%' GROUP BY device ORDER BY MIN(ts)`;
  const studentNo = new Map(firsts.map((f, i) => [f.device || "?", i + 1]));
  const when = ts => new Date(ts).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  const clock = ts => new Date(ts).toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "numeric", minute: "2-digit" });
  const text = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const hidden = `<input type="hidden" name="key" value="${esc(key)}">`;
  const modeBtn = showAll
    ? `<form method="post" class="refresh">${hidden}<button>ارجع لرسايل النهارده بس</button></form>`
    : `<form method="post" class="refresh">${hidden}<input type="hidden" name="all" value="1"><button>اعرض كل الرسايل القديمة</button></form>`;

  const card = (n, label) => `<div class="card"><b>${AR(n)}</b><span>${label}</span></div>`;
  const since = tot.since ? new Date(tot.since).toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo" }) : "—";
  return res.status(200).send(page(`
    <h1>إحصائيات المنصة</h1>${saved ? `<p class="ok">${esc(saved)}</p>` : ""}<form method="post" class="refresh">${hidden}${showAll ? `<input type="hidden" name="all" value="1">` : ""}<button>حدّث الصفحة</button><span class="note"> عشان تشوف آخر الرسايل، واللي الطلاب شافوه من التصحيحات.</span></form><p class="note">كل جهاز بيتعد مرة واحدة (من غير أسماء). العدّ شغال من ${esc(since)}.</p>
    <h2>الطلاب اللي دخلوا</h2>
    <div class="cards">${card(tot.today, "النهارده")}${card(tot.week, "آخر ٧ أيام")}${card(tot.ever, "من الأول")}</div>
    <h2>الدروس النهارده بالتفصيل</h2>
    <p class="note">«بدأها» يعني دخل المجموعة، و«خلّصها» يعني جاوب على كل أسئلتها، ودرجته جنبها (تسجيل «خلّصها» والدرجات شغال من ١٢ نوفمبر).</p>
    ${todayIds.length ? todayIds.map(lessonToday).join("") : `<p class="note">النهارده لسه محدش فتح أي درس.</p>`}
    <h2>ملاحظات الطلاب</h2>
    <p class="note">اللي الطلاب كتبوه في «قول ملاحظاتك» في الصفحة الرئيسية، الأحدث فوق.</p>
    ${notes.length ? notes.map(n => `<div class="chat"><div class="chat-meta"><b>${n.name ? esc(n.name) : "من غير اسم"}</b> · <span>${esc(when(n.ts))}</span></div><div class="msg me">${text(n.message)}</div></div>`).join("") : `<p class="note">لسه محدش بعت ملاحظات.</p>`}
    <h2>اسأل المعلم الآلي</h2>
    <div class="cards">${card(tot.tutor_all, "سؤال من الأول")}${card(tot.tutor_week, "سؤال في آخر ٧ أيام")}${card(tot.tutor_devices, "طالب استخدمه")}</div>
    ${places.length ? `<table style="margin-top:10px"><tr><th>المكان</th><th>عدد الأسئلة</th></tr>${places.map(p => `<tr><td>${esc(PLACES[p.detail] || p.detail || "—")}</td><td>${AR(p.n)}</td></tr>`).join("")}</table>` : ""}
    <h2>الدروس من الأول</h2>
    <table><tr><th>الدرس</th><th>طلاب فتحوه</th><th>مرات الفتح</th><th>فتحوا الفيديو</th><th>مجموعات اتحلت</th><th>نماذج امتحان</th><th>أسئلة للمعلم الآلي</th></tr>
      ${lessons.map(l => `<tr><td>${esc(name(l.lesson))}</td><td>${AR(l.devices)}</td><td>${AR(l.opens)}</td><td>${AR(l.videos)}</td><td>${AR(l.groups)}</td><td>${AR(l.exams)}</td><td>${AR(l.tutor)} (${AR(l.tutor_devices)} طالب)</td></tr>`).join("") || `<tr><td colspan="7">لسه مفيش بيانات</td></tr>`}
    </table>
    <h2>آخر ١٤ يوم</h2>
    <table><tr><th>اليوم</th><th>طلاب</th><th>أسئلة للمعلم الآلي</th></tr>
      ${days.map(d => `<tr><td>${esc(new Date(d.day).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }))}</td><td>${AR(d.devices)}</td><td>${AR(d.tutor)}</td></tr>`).join("") || `<tr><td colspan="3">لسه مفيش بيانات</td></tr>`}
    </table>
    <h2 id="chats">رسايل المعلم الآلي ${showAll ? "— كل الرسايل" : "— النهارده"}</h2>
    <p class="note">${showAll ? `آخر ${AR(chats.length)} رسالة` : `${AR(chats.length)} ${chats.length === 1 ? "سؤال" : "أسئلة"} النهارده`}، الأحدث فوق. دوس على أي سؤال عشان تشوف موضعه في الدرس، ورد المعلم الآلي، وتكتب تصحيح لو الرد غلط. «طالب ١، ٢…» رقم للجهاز مش اسم، وبيفضل ثابت لنفس الطالب.</p>
    ${chats.map(c => `<details class="chat" id="c${c.id}"${openId === Number(c.id) ? " open" : ""}>
      <summary><div class="chat-meta"><b>طالب ${AR(studentNo.get(c.device || "?") || "؟")}</b> · ${esc(name(c.lesson))} · ${esc(PLACES[c.place] || c.place || "—")} · <span>${esc(showAll ? when(c.ts) : clock(c.ts))}</span>${c.correction ? ` · <span class="tag">${c.seen_at ? "صحّحته والطالب شافه" : "صحّحته"}</span>` : ""}</div>
        <div class="q">${text(c.message)}</div></summary>
      ${c.context ? `<div class="msg ctx"><span>موضع السؤال (اللي كان قدام الطالب في الصفحة):</span>${text(c.context)}</div>` : ""}
      <div class="msg bot"><span>رد المعلم الآلي:</span>${text(c.reply)}</div>
      ${c.correction ? `<div class="msg fix"><span>تصحيحك:</span>${text(c.correction)}<i>${c.seen_at ? "الطالب شافه " + esc(when(c.seen_at)) : "لسه الطالب ما شافهوش"}</i></div>` : ""}
      <details class="fx"><summary>${c.correction ? "عدّل التصحيح أو امسحه" : "اكتب تصحيح للطالب"}</summary>
        <form method="post" action="#c${c.id}">${hidden}${showAll ? `<input type="hidden" name="all" value="1">` : ""}<input type="hidden" name="action" value="correct"><input type="hidden" name="id" value="${c.id}">
          <textarea name="correction" placeholder="اكتب التصحيح اللي هيوصل للطالب. لو مسحت الكلام وحفظت، التصحيح بيتشال.">${esc(c.correction || "")}</textarea>
          <button>احفظ التصحيح</button></form></details>
    </details>`).join("") || `<p class="note">${showAll ? "لسه مفيش رسايل." : "النهارده لسه محدش سأل المعلم الآلي."}</p>`}
    ${modeBtn}`));
}
