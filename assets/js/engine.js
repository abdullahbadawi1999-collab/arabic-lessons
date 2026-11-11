function start(L){
"use strict";
document.title = "درس " + L.title;
const track = window.track || function(){};
track("lesson", L.id);
const app = document.getElementById("app");
const AR = "٠١٢٣٤٥٦٧٨٩";
const ar = n => String(n).replace(/\d/g, d => AR[d]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function md(s){
  if (s == null) return "";
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[(.+?)\]\]/g, '<span class="kw">$1</span>')
    .replace(/\{(.+?)\}/g, '<span class="add">$1</span>')
    .replace(/_{3,}/g, '<span class="blank" aria-label="فراغ"></span>');
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- حفظ التقدم (اختياري) ---------- */
const KEY = "lesson:" + L.id + ":v1";
let P = { discoverDone: false, discoverAt: 0, groups: {}, tags: {} };
try { const raw = localStorage.getItem(KEY); if (raw) P = Object.assign(P, JSON.parse(raw)); } catch (e) {}
delete P.teacher; // كان بيتحفظ من وضع المعلم القديم
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

/* ---------- الاكتشاف: تسطيح الشاشات ---------- */
const FLAT = [];
L.discover.forEach(st => st.screens.forEach(sc => FLAT.push(Object.assign({ stage: st.stage }, sc))));
const RULES = FLAT.filter(s => s.type === "rule");
const groups = L.drill.groups;
// الدرجة اللي الطالب بيعدّي بيها المجموعة: بتاع المجموعة نفسها، ولو مش موجود drill.unlockScore. كل المجموعات مفتوحة دايمًا.
const unlockOf = g => g.unlockScore ?? L.drill.unlockScore;
// لون المجموعة: مجموعات التعلّم بالترتيب أخضر ثم أصفر ثم لون الـ brand، واللي من غير قاعدة (showRule: false) بلون الصعب
let learnN = 0;
const LV = new Map(groups.map(g => [g, g.showRule ? (["lv-easy", "lv-med"][learnN++] || "lv-brand") : "lv-hard"]));
// اسم الجزء اللي بيتكتب أول كل كارت مجموعة: أسئلة الجزء الأول، الثاني، …
// كلمات التشجيع لما الطالب يجاوب صح: بتتنوّع كل مرة
const PRAISE = ["صح، برافو!", "مظبوط!", "تمام كده!", "إجابة صح!", "يسّلّااام، أحسنت"];
const ORD = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const partName = i => "أسئلة الجزء " + (ORD[i] || ar(i + 1));

/* ---------- عناصر مشتركة ---------- */
function topbar(title, sub, back){
  return `<div class="top">
    <button class="icon-btn" data-act="${back || "home"}" aria-label="رجوع">→ ${back === "home" || !back ? "الرئيسية" : "رجوع"}</button>
    <div class="name">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}</div>
  </div>`;
}
function ruleCard(r, i){
  return `<div class="rule enter"><span class="tag">القاعدة${i != null ? " " + ar(i) : ""}</span><h3>${md(r.title)}</h3><ol>${r.lines.map(l => `<li>${md(l)}</li>`).join("")}</ol></div>`;
}
function render(html){ app.innerHTML = html; window.scrollTo({ top: 0 }); const f = app.querySelector("[data-focus]"); if (f) f.focus({ preventScroll: true }); }

/* ---------- اسأل المعلم الآلي ---------- */
// زرار تحت القاعدة، وبعد إجابة سؤال التدريب، وتحت الإجابة النموذجية في نماذج الامتحان.
// بيبعت للدالة اللي على Vercel سؤال الطالب ومعاه اللي قدامه في الصفحة، والرد بيظهر جوه نفس المكان.
// TUTOR_LIVE بيتعمل true بعد ما الدالة على Vercel تتجرب. قبل كده الزرار بيظهر بس للتجربة (tutorUrl في localStorage).
const TUTOR_LIVE = true;
let tutorOverride = null;
try { tutorOverride = localStorage.getItem("tutorUrl"); } catch (e) {}
const TUTOR_URL = tutorOverride || (window.API_BASE || "https://arabic-lessons-nine.vercel.app/api") + "/ask";
const TUTOR_ON = TUTOR_LIVE || !!tutorOverride;
const plain = s => String(s ?? "").replace(/\[\[|\]\]|\*\*|[{}]/g, "").replace(/_{3,}/g, "____");
const TUTOR = {};
let tutorN = 0;
function tutorBox(context, place){
  if (!TUTOR_ON) return "";
  const key = "t" + (++tutorN);
  TUTOR[key] = { context, place, history: [] };
  return `<div class="tutor" id="${key}"><button class="btn ghost tutor-open" data-act="tutor" data-tkey="${key}">اسأل المعلم الآلي</button></div>`;
}
function tutorOpen(key){
  document.getElementById(key).innerHTML = `<div class="tutor-chat enter">
      <div class="tutor-head"><b>المعلم الآلي</b><span>بيرد على أسئلة النحو بس · أسئلتك بتوصل لمعلمك</span></div>
      <div class="tutor-log"></div>
      <div class="tutor-chips"><button class="chip" data-act="tquick" data-tkey="${key}">مش فاهم، اشرحلي بطريقة أسهل</button></div>
      <div class="tutor-row"><textarea class="tutor-input" rows="2" placeholder="اكتب سؤالك هنا"></textarea><button class="btn" data-act="tsend" data-tkey="${key}">ابعت</button></div>
    </div>`;
  document.querySelector(`#${key} .tutor-input`).focus({ preventScroll: true });
}
const bubble = (who, html) => `<div class="tmsg ${who}">${html}</div>`;
async function tutorSend(key, text){
  const box = document.getElementById(key), st = TUTOR[key];
  if (!box || !st || st.busy) return;
  const input = box.querySelector(".tutor-input");
  text = (text ?? input.value).trim();
  if (!text) return;
  input.value = "";
  const log = box.querySelector(".tutor-log");
  log.insertAdjacentHTML("beforeend", bubble("me", esc(text)) + bubble("bot wait", "بيكتب…"));
  st.busy = true;
  let reply;
  try {
    const r = await fetch(TUTOR_URL, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson: L.title, lessonId: L.id, place: st.place, device: window.deviceId, context: st.context, history: st.history, message: text }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.reply) throw new Error(data.error || "");
    reply = data.reply;
    st.history.push({ role: "user", text }, { role: "assistant", text: reply });
  } catch (e) {
    reply = null;
    // رسالة الدالة لو رجعت رد، غير كده (النت قاطع مثلًا) رسالة عامة بالعربي
    const msg = e instanceof TypeError ? "" : e.message;
    log.querySelector(".wait").outerHTML = bubble("bot err", esc(msg || "المعلم الآلي مش متاح دلوقتي، اتأكد من النت وجرّب تاني."));
  }
  if (reply != null) log.querySelector(".wait").outerHTML = bubble("bot", esc(reply).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>"));
  st.busy = false;
}

/* ---------- الرئيسية ---------- */
// وزن واحد: كل حرف (بحركته) في مربع، والحرف اللي بين {} ملوّن. أكتر من وزن: كل وزن في بطاقة.
function patternBlock(p){
  if (!p || !p.weights || !p.weights.length) return "";
  const many = p.weights.length > 1;
  let z = false;
  const tiles = w => (w.match(/[{}]|\P{M}\p{M}*/gu) || []).map(g => {
    if (g === "{" || g === "}") { z = g === "{"; return ""; }
    return g.trim() ? `<span${z ? ' class="z"' : ""}>${esc(g)}</span>` : "";
  }).join("");
  const label = (many ? "أوزان " : "وزن ") + p.weights.map(w => w.replace(/[{}]/g, "")).join("، ");
  return `<div class="pattern${many ? " many" : ""}" role="img" aria-label="${esc(label)}">
      ${many ? p.weights.map(w => `<span>${md(w)}</span>`).join("") : tiles(p.weights[0])}
    </div>
    ${p.caption ? `<div class="pattern-cap">${md(p.caption)}</div>` : ""}`;
}
function home(){
  const doneG = groups.filter(g => (P.groups[g.id] || {}).best >= unlockOf(g)).length;
  render(`
  <div class="hero enter">
    <div class="unit">${esc(L.unit)} · ${esc(L.grade)}</div>
    <h1>${esc(L.title)}</h1>
    ${patternBlock(L.pattern)}
  </div>
  <div class="tiles">
    <button class="tile" data-act="discover" data-focus>
      <span class="num">١</span>
      <span class="tx"><b>اكتشف القاعدة</b><span>${ar(FLAT.length)} خطوة قصيرة · بتوصل للقاعدة بنفسك</span></span>
      ${P.discoverDone ? '<span class="st">خلّصتها</span>' : (P.discoverAt ? `<span class="st" style="color:var(--brand)">كمّل</span>` : "")}
    </button>
    <button class="tile" data-act="groups">
      <span class="num">٢</span>
      <span class="tx"><b>التدريبات</b><span>${ar(groups.length)} مجموعات · ${ar(groups.reduce((a, g) => a + g.questions.length, 0))} سؤال</span></span>
      ${doneG ? `<span class="st">${ar(doneG)} من ${ar(groups.length)}</span>` : ""}
    </button>
    <button class="tile" data-act="summary">
      <span class="num">٣</span>
      <span class="tx"><b>الملخص</b><span>كل القواعد في مكان واحد</span></span>
    </button>
  </div>
  <div class="foot"><a class="btn" href="./">→ العودة للرئيسية</a></div>`);
}

/* ---------- الاكتشاف ---------- */
let D = { i: 0, solved: false, order: null };
function discover(i){
  D = { i: Math.max(0, Math.min(i, FLAT.length - 1)), solved: false, order: null };
  P.discoverAt = D.i; save();
  const s = FLAT[D.i];
  const pct = Math.round((D.i) / FLAT.length * 100);
  let inner = "";
  if (s.type === "info") {
    inner = `<div class="card enter"><div class="stage">${esc(s.stage)}</div><h2 class="title">${md(s.title)}</h2>
      ${s.body ? `<p class="body">${md(s.body)}</p>` : ""}
      ${exBlock(s.example)}
      <div class="actions"><button class="btn" data-act="dnext" data-focus>كمّل</button>${D.i ? '<button class="btn ghost" data-act="dprev">رجوع</button>' : ""}</div></div>`;
  } else if (s.type === "rule") {
    inner = `<div class="stage" style="margin-top:4px">${esc(s.stage)}</div>${ruleCard(s)}
      ${tutorBox(`الطالب بيقرا بطاقة القاعدة دي (مرحلة «${plain(s.stage)}»):\n${plain(s.title)}\n${s.lines.map(l => "- " + plain(l)).join("\n")}`, "rule")}
      <div class="actions"><button class="btn" data-act="dnext" data-focus>تمام، كمّل</button><button class="btn ghost" data-act="dprev">رجوع</button></div>`;
  } else {
    D.order = shuffle(s.options.map((o, k) => k));
    inner = `<div class="card enter" id="qcard"><div class="stage">${esc(s.stage)}</div><h2 class="title">${md(s.prompt)}</h2>
      ${s.body ? `<p class="body">${md(s.body)}</p>` : ""}
      ${exBlock(s.example)}
      <div class="opts">${D.order.map((k, n) => `<button class="opt" data-dopt="${k}"><span class="n">${ar(n + 1)}</span><span class="t">${md(s.options[k].t)}</span></button>`).join("")}</div>
      <div id="dfb"></div>
      <div class="actions" id="dact">${D.i ? '<button class="btn ghost" data-act="dprev">رجوع</button>' : ""}</div></div>`;
  }
  render(`${topbar(L.title, "اكتشف القاعدة")}
    <div class="bar" aria-label="التقدم"><i style="width:${pct}%"></i></div>
    <div class="meta"><span>خطوة ${ar(D.i + 1)} من ${ar(FLAT.length)}</span><span>${esc(s.stage)}</span></div>
    ${inner}`);
}
function exBlock(ex){ return ex && ex.length ? `<div class="examples">${ex.map(e => `<div class="ex">${md(e)}</div>`).join("")}</div>` : ""; }
function dAnswer(k){
  if (D.solved) return;
  const s = FLAT[D.i], o = s.options[k];
  const btn = app.querySelector(`[data-dopt="${k}"]`);
  const fb = document.getElementById("dfb");
  if (o.ok) {
    D.solved = true;
    btn.classList.add("right");
    app.querySelectorAll(".opt").forEach(b => { b.disabled = true; if (b !== btn) b.classList.add("dim"); });
    fb.innerHTML = `<div class="fb good enter"><b class="h">${pick(PRAISE)}</b>${md(o.fb)}${s.after ? `<div style="margin-top:6px">${md(s.after)}</div>` : ""}</div>`;
    document.getElementById("dact").innerHTML = `<button class="btn" data-act="dnext" data-focus>كمّل</button>${D.i ? '<button class="btn ghost" data-act="dprev">رجوع</button>' : ""}`;
    document.querySelector('[data-act="dnext"]').focus({ preventScroll: true });
  } else {
    btn.classList.add("wrong"); btn.disabled = true;
    const card = document.getElementById("qcard"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    fb.innerHTML = `<div class="fb bad enter"><b class="h">مش دي… فكّر تاني</b>${md(o.fb)}</div>`;
  }
}
function dNext(){
  if (D.i >= FLAT.length - 1) { P.discoverDone = true; P.discoverAt = 0; save(); return discoverEnd(); }
  discover(D.i + 1);
}
function discoverEnd(){
  render(`${topbar(L.title, "اكتشف القاعدة")}
    <div class="bar"><i style="width:100%"></i></div>
    <div class="card enter center" style="margin-top:18px">
      <h2 class="title">خلّصت الاكتشاف</h2>
      <p class="body">وصلت لـ ${ar(RULES.length)} قواعد بنفسك. اتفرج على الملخص، وبعدين ابدأ التدريبات.</p>
      <div class="actions" style="justify-content:center"><button class="btn" data-act="groups" data-focus>ابدأ التدريبات</button><button class="btn ghost" data-act="summary">الملخص</button></div>
    </div>`);
}

/* ---------- المجموعات ---------- */
function groupsView(){
  render(`${topbar(L.title, "التدريبات")}
    <div class="meta"><span>تقدر تبدأ بأي مجموعة</span></div>
    ${groups.map((g, i) => {
      const st = P.groups[g.id] || {};
      return `<button class="grp enter ${LV.get(g)}" data-grp="${i}" ${i === 0 ? "data-focus" : ""}>
        <span class="lv"></span>
        <span class="tx"><span class="part">${partName(i)}</span><span class="chip ${LV.get(g)}"><span class="dot"></span>${esc(g.level)}</span><b style="color:var(--ink)">${esc(g.title)}</b><span>${esc(g.desc)}</span></span>
        <span class="sc">${st.best != null ? `${ar(st.best)}/${ar(g.questions.length)}<em>أحسن نتيجة</em>` : `<em>ابدأ</em>`}</span>
      </button>`;
    }).join("")}
    ${EXAMS.length ? `<button class="grp enter lv-exam" data-act="exams">
        <span class="lv"></span>
        <span class="tx"><span class="part">نماذج امتحان</span><b style="color:var(--ink)">أسئلة زي الامتحان بالظبط</b><span>${ar(EXAMS.length)} أسئلة · الإجابة النموذجية مشروحة جنب كل سؤال</span></span>
        <span class="sc"><em>ابدأ</em></span>
      </button>` : ""}`);
}

/* ---------- نماذج الامتحان ---------- */
const EXAMS = L.exams || [];
const lines = a => a.map(l => `<p>${md(l)}</p>`).join("");
function examsList(){
  render(`${topbar(L.title, "نماذج امتحان", "groups")}
    <div class="meta"><span>اقرا الفقرة وحل كل سؤال، وبعدين اعرض الإجابة جنبه</span></div>
    ${EXAMS.map((e, i) => `<button class="grp enter lv-exam" data-exam="${i}" ${i === 0 ? "data-focus" : ""}>
        <span class="lv"></span>
        <span class="tx"><b style="color:var(--ink)">${esc(e.title)}</b><span>${esc(e.passage.replace(/\[\[|\]\]|\*\*|[{}]/g, "").slice(0, 70))}…</span></span>
        <span class="sc"><em>${ar(e.parts.length)} أسئلة</em></span>
      </button>`).join("")}`);
}
// كل سؤال جنبه زرار «اعرض الإجابة» بيفتح الإجابة النموذجية وشرحها لوحده
function examView(i){
  const e = EXAMS[i];
  track("exam", L.id, e.id);
  render(`${topbar(L.title, "نماذج امتحان · " + e.title, "exams")}
    <div class="meta"><span>${esc(e.title)}</span>${e.source ? `<span>${esc(e.source)}</span>` : ""}</div>
    <div class="card enter passage"><div class="kind">اقرأ الفقرة الآتية، ثم أجب:</div><div class="ptext">«${md(e.passage)}»</div></div>
    ${e.parts.map((p, pi) => `<div class="card enter xpart">
      <div class="stem"><span class="xlabel">(${esc(p.label)})</span> ${md(p.prompt).replace(/\n/g, "<br>")}</div>
      <textarea class="xinput" rows="2" placeholder="اكتب إجابتك هنا"></textarea>
      <div class="actions"><button class="btn ghost" data-reveal="${pi}">اعرض الإجابة</button></div>
      <div class="xmodel" id="xm${pi}" hidden>
        <div class="fb good"><b class="h">الإجابة النموذجية</b>${lines(p.answer)}</div>
        <div class="explain"><span class="lbl">ليه كده؟</span>${lines(p.explain)}</div>
        ${tutorBox(`الطالب بيحل نموذج امتحان.\nالفقرة: «${plain(e.passage)}»\nالسؤال (${plain(p.label)}): ${plain(p.prompt)}\nالإجابة النموذجية:\n${p.answer.map(plain).join("\n")}\nالشرح اللي قدامه:\n${p.explain.map(plain).join("\n")}`, "exam")}
      </div>
    </div>`).join("")}
    <div class="actions">
      ${i + 1 < EXAMS.length ? `<button class="btn" data-exam="${i + 1}">السؤال اللي بعده</button>` : ""}
      ${i > 0 ? `<button class="btn ghost" data-exam="${i - 1}">السؤال اللي قبله</button>` : ""}
      <button class="btn ghost" data-act="exams">كل النماذج</button>
    </div>`);
}
function toggleModel(b){
  const m = document.getElementById("xm" + b.dataset.reveal);
  m.hidden = !m.hidden;
  b.textContent = m.hidden ? "اعرض الإجابة" : "اخفي الإجابة";
}

/* ---------- الأسئلة ---------- */
let Z = null;
function startGroup(gi){
  const g = groups[gi];
  track("group", L.id, g.id);
  Z = { gi, g, list: g.questions.map(q => ({ q, review: false })), i: 0, score: 0, wrong: [], reviewStarted: false, done: false, answered: false, usedReview: new Set(), tagRun: {} };
  question();
}
function question(){
  const it = Z.list[Z.i], q = it.q, g = Z.g;
  Z.answered = false;
  Z.order = shuffle(q.options.map((o, k) => k));
  const mainN = g.questions.length;
  const pos = it.review ? `مراجعة ${ar(Z.i - mainN + 1)} من ${ar(Z.list.length - mainN)}` : `سؤال ${ar(Z.i + 1)} من ${ar(mainN)}`;
  const pct = it.review ? 100 : Math.round(Z.i / mainN * 100);
  const showRule = g.showRule && q.rule;
  render(`${topbar(L.title, g.level + " · " + g.title, "groups")}
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="meta"><span class="chip ${LV.get(g)}"><span class="dot"></span>${it.review ? "جولة مراجعة" : esc(g.level)}</span><span>${pos}</span></div>
    ${showRule ? `<div class="rule-mini enter"><span class="tag">القاعدة اللي هتحتاجها</span>${md(q.rule)}</div>` : ""}
    <div class="card enter" id="qcard">
      <div class="kind">${esc(q.kind)}</div>
      <div class="stem">${md(q.stem)}</div>
      ${q.sentence ? `<div class="sentence">${md(q.sentence)}</div>` : ""}
      <div id="qopts"><p class="note reveal-note">فكّر في الإجابة لوحدك الأول، وبعدين اعرض الخيارات.</p><div class="actions"><button class="btn" data-act="reveal" data-focus>اعرض الخيارات</button></div></div>
      <div id="qfb"></div>
      <div class="actions" id="qact"></div>
    </div>`);
}
// الخيارات مش بتظهر غير لما الطالب يطلبها، عشان يحاول يحل لوحده الأول
function revealOptions(){
  const q = Z.list[Z.i].q;
  document.getElementById("qopts").innerHTML = `<div class="opts enter ${q.options.every(o => o.t.length < 16) ? "two" : ""}">${Z.order.map((k, n) => `<button class="opt" data-qopt="${k}"><span class="n">${ar(n + 1)}</span><span class="t">${md(q.options[k].t)}</span></button>`).join("")}</div>`;
  app.querySelector(".opt").focus({ preventScroll: true });
}
function qAnswer(k){
  if (Z.answered) return;
  Z.answered = true;
  const it = Z.list[Z.i], q = it.q, ok = k === q.answer;
  app.querySelectorAll(".opt").forEach(b => {
    const kk = +b.dataset.qopt; b.disabled = true;
    if (kk === q.answer) b.classList.add("right");
    else if (kk === k) b.classList.add("wrong");
    else b.classList.add("dim");
  });
  const t = (P.tags[q.tag] = P.tags[q.tag] || { ok: 0, n: 0 }); t.n++; if (ok) t.ok++;
  const r = (Z.tagRun[q.tag] = Z.tagRun[q.tag] || { ok: 0, n: 0 }); r.n++; if (ok) r.ok++;
  if (!it.review) { if (ok) Z.score++; else Z.wrong.push(q); }
  save();
  const fb = document.getElementById("qfb");
  if (ok) {
    fb.innerHTML = `<div class="fb good enter"><b class="h">${pick(PRAISE)}</b>${md(q.explain)}</div>`;
  } else {
    const card = document.getElementById("qcard"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    fb.innerHTML = `<div class="fb bad enter"><b class="h">مش دي</b>${md(q.options[k].fb)}</div>
      <div class="explain enter"><span class="lbl">القاعدة على المثال ده</span>${md(q.explain)}</div>`;
  }
  fb.insertAdjacentHTML("beforeend", tutorBox([
    `الطالب بيحل سؤال تدريب (${plain(q.kind)}) في مجموعة «${plain(Z.g.level)}».`,
    `السؤال: ${plain(q.stem)}${q.sentence ? " " + plain(q.sentence) : ""}`,
    `الاختيارات: ${q.options.map(o => plain(o.t)).join(" / ")}`,
    `الإجابة الصح: ${plain(q.options[q.answer].t)}`,
    ok ? "الطالب جاوب صح." : `الطالب اختار: ${plain(q.options[k].t)} (غلط)، والتعليق اللي ظهرله: ${plain(q.options[k].fb)}`,
    `الشرح اللي ظهرله: ${plain(q.explain)}`,
    q.rule ? `القاعدة: ${plain(q.rule)}` : ""
  ].filter(Boolean).join("\n"), "drill"));
  const last = Z.i >= Z.list.length - 1;
  document.getElementById("qact").innerHTML = `<button class="btn" data-act="qnext" data-focus>${last && (Z.reviewStarted || !Z.wrong.length) ? "شوف النتيجة" : "التالي"}</button>`;
  document.querySelector('[data-act="qnext"]').focus({ preventScroll: true });
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function qNext(){
  if (Z.i < Z.list.length - 1) { Z.i++; return question(); }
  if (!Z.reviewStarted && Z.wrong.length) return reviewIntro();
  finishGroup();
}
// لكل سؤال غلط بنجيب نفس نوع السؤال (نفس الـ tag) بمثال مختلف. بندوّر بالترتيب في: reserve، وبعدين المجموعات التانية،
// وبعدين أسئلة المجموعة اللي جاوبها صح، وبعدين اللي غلط فيها. وفي كل مرة بنفضّل نفس الـ kind. السؤال نفسه بيرجع بس لو مفيش غيره خالص.
function similarTo(q){
  // الأول المثال الشبيه اللي متكتب للسؤال نفسه (twin)
  if (q.twin && !Z.usedReview.has(q.twin.id)) return Object.assign({}, q, q.twin, { twin: null });
  const others = groups.filter(g => g !== Z.g).flatMap(g => g.questions);
  const tiers = [L.drill.reserve[q.tag] || [], others, Z.g.questions.filter(x => !Z.wrong.includes(x)), Z.wrong];
  const fits = x => x.id !== q.id && x.tag === q.tag && !Z.usedReview.has(x.id);
  for (const sameKind of [true, false])
    for (const tier of tiers) {
      const pool = tier.filter(x => fits(x) && (!sameKind || x.kind === q.kind));
      if (pool.length) return pick(pool);
    }
  const any = tiers.flat().filter(x => x.id !== q.id && x.tag === q.tag); // اتسأل قبل كده في المراجعة، بس مثاله مختلف
  return any.length ? pick(any) : q;
}
function reviewIntro(){
  Z.reviewStarted = true;
  const extra = Z.wrong.map(q => {
    const r = similarTo(q);
    Z.usedReview.add(r.id);
    return { q: r, review: true };
  });
  Z.list = Z.list.concat(extra);
  const n = extra.length;
  render(`${topbar(L.title, Z.g.level + " · " + Z.g.title, "groups")}
    <div class="bar"><i style="width:100%"></i></div>
    <div class="card enter center" style="margin-top:18px">
      <span class="chip ${LV.get(Z.g)}"><span class="dot"></span>جولة مراجعة</span>
      <h2 class="title" style="margin-top:10px">خلّصت الـ ${ar(mainN())} سؤال · نتيجتك ${ar(Z.score)}</h2>
      <p class="body">غلطت في ${ar(n)} ${n === 1 ? "سؤال" : n <= 10 ? "أسئلة" : "سؤال"}. هنجيب لك ${n === 1 ? "سؤال شبهه" : "أسئلة شبهها"} عشان نتأكد إنك فهمت النقطة. الجولة دي مش بتتحسب في الدرجة.</p>
      <div class="actions" style="justify-content:center"><button class="btn" data-act="rstart" data-focus>يلا نراجع</button><button class="btn ghost" data-act="rskip">اعرض النتيجة</button></div>
    </div>`);
}
const mainN = () => Z.g.questions.length;
function finishGroup(){
  const g = Z.g, n = g.questions.length, s = Z.score;
  const st = (P.groups[g.id] = P.groups[g.id] || { best: null, attempts: 0 });
  st.attempts++; st.best = Math.max(st.best == null ? 0 : st.best, s); save();
  const unlock = unlockOf(g), pass = s >= unlock;
  const next = Z.gi + 1 < groups.length ? Z.gi + 1 : null;
  const C = 2 * Math.PI * 54, frac = s / n;
  const rows = Object.entries(Z.tagRun).map(([tag, v]) => {
    const p = v.ok / v.n, cls = p >= .8 ? "ok" : p >= .5 ? "mid" : "low", lbl = p >= .8 ? "متقن" : p >= .5 ? "قرّبت" : "راجعها";
    return `<div class="mrow"><span class="lb">${esc(L.drill.tags[tag] || tag)}</span><span class="mb"><i style="width:${Math.round(p * 100)}%"></i></span><span class="pill ${cls}">${lbl}</span></div>`;
  }).join("");
  render(`${topbar(L.title, g.level + " · " + g.title, "groups")}
    <div class="card enter" style="margin-top:14px">
      <div class="center">
        <span class="chip ${LV.get(g)}"><span class="dot"></span>${esc(g.level)}</span>
        <div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="60" cy="60" r="54" fill="none" stroke="${pass ? "var(--mint)" : "var(--sun)"}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}"/></svg><div class="v">${ar(s)}<small>من ${ar(n)}</small></div></div>
        <h2 class="title">${pass ? (s === n ? "العلامة الكاملة!" : "عدّيت المجموعة") : "قرّبت… محتاج " + ar(unlock - s) + " كمان عشان تعدّيها"}</h2>
        <p class="body">${pass ? (next != null ? "كمّل على المجموعة اللي بعدها." : "كده خلّصت كل التدريبات.") : g.showRule ? "عيد المجموعة، وركّز في القاعدة اللي فوق كل سؤال." : "عيد المجموعة، ولو محتاج تراجع القواعد افتح الملخص."}</p>
      </div>
      ${rows ? `<div class="mast"><div class="kind">نقاطك في المجموعة دي</div>${rows}</div>` : ""}
      <div class="actions" style="justify-content:center">
        ${pass && next != null ? `<button class="btn" data-grp="${next}" data-focus>المجموعة اللي بعدها</button>` : ""}
        <button class="btn ${pass && next != null ? "ghost" : ""}" data-grp="${Z.gi}" ${pass && next != null ? "" : "data-focus"}>عيد المجموعة</button>
        ${!pass && next != null ? `<button class="btn ghost" data-grp="${next}">المجموعة اللي بعدها</button>` : ""}
        <button class="btn ghost" data-act="summary">الملخص</button>
      </div>
    </div>`);
}

/* ---------- الملخص ---------- */
function summary(){
  const all = RULES.concat(L.summaryExtra || []);
  const tagRows = Object.entries(P.tags).filter(([tag, v]) => v.n && tag in L.drill.tags).map(([tag, v]) => {
    const p = v.ok / v.n, cls = p >= .8 ? "ok" : p >= .5 ? "mid" : "low", lbl = p >= .8 ? "متقن" : p >= .5 ? "قرّبت" : "راجعها";
    return `<div class="mrow"><span class="lb">${esc(L.drill.tags[tag] || tag)}</span><span class="mb"><i style="width:${Math.round(p * 100)}%"></i></span><span class="pill ${cls}">${lbl}</span></div>`;
  }).join("");
  render(`${topbar(L.title, "الملخص")}
    <div class="sumhead"><h2 class="title">ملخص ${esc(L.title)}</h2><p class="note">كل القواعد اللي اكتشفتها، بالترتيب.</p></div>
    ${tagRows ? `<div class="card enter" style="margin-bottom:14px"><div class="kind">مستواك لحد دلوقتي</div><div class="mast">${tagRows}</div></div>` : ""}
    <div class="sumlist">${all.map((r, i) => ruleCard(r, i + 1)).join("")}</div>
    <div class="actions"><button class="btn" data-act="groups" data-focus>روح للتدريبات</button><button class="btn ghost" data-act="discover">اكتشف من الأول</button></div>`);
}

/* ---------- الأحداث ---------- */
app.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.dopt != null) return dAnswer(+b.dataset.dopt);
  if (b.dataset.qopt != null) return qAnswer(+b.dataset.qopt);
  if (b.dataset.grp != null) return startGroup(+b.dataset.grp);
  if (b.dataset.exam != null) return examView(+b.dataset.exam);
  if (b.dataset.reveal != null) return toggleModel(b);
  const a = b.dataset.act;
  if (a === "tutor") return tutorOpen(b.dataset.tkey);
  if (a === "tsend") return tutorSend(b.dataset.tkey);
  if (a === "tquick") return tutorSend(b.dataset.tkey, b.textContent);
  if (a === "home") home();
  else if (a === "discover") { track("discover", L.id); discover(P.discoverDone ? 0 : (P.discoverAt || 0)); }
  else if (a === "dnext") dNext();
  else if (a === "dprev") discover(D.i - 1);
  else if (a === "groups") groupsView();
  else if (a === "exams") examsList();
  else if (a === "summary") summary();
  else if (a === "reveal") revealOptions();
  else if (a === "qnext") qNext();
  else if (a === "rstart") { Z.i++; question(); }
  else if (a === "rskip") finishGroup();
});
document.addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest("textarea, input"))) return;
  const n = "1234".indexOf(e.key) >= 0 ? +e.key : "١٢٣٤".indexOf(e.key) >= 0 ? "١٢٣٤".indexOf(e.key) + 1 : 0;
  if (n) { const o = app.querySelectorAll(".opt")[n - 1]; if (o && !o.disabled) { o.click(); e.preventDefault(); } }
});

home();
}
(function(){
  const id = (new URLSearchParams(location.search).get("id") || "").replace(/[^a-z0-9-]/gi, "");
  const app = document.getElementById("app");
  if (!id) { location.href = "./"; return; }
  fetch("lessons/" + id + ".json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(() => { app.innerHTML = '<div class="card" style="margin-top:24px"><h2 class="title">الدرس ده مش موجود</h2><p class="body">ارجع لقايمة الدروس واختار درس تاني.</p><div class="actions"><a class="btn" href="./">→ العودة للرئيسية</a></div></div>'; });
})();
