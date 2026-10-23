function start(L){
"use strict";
document.title = "درس " + L.title;
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
const LV = { "سهل": "lv-easy", "متوسط": "lv-med", "صعب": "lv-hard" };

/* ---------- حفظ التقدم (اختياري) ---------- */
const KEY = "lesson:" + L.id + ":v1";
let P = { discoverDone: false, discoverAt: 0, groups: {}, tags: {}, teacher: false };
try { const raw = localStorage.getItem(KEY); if (raw) P = Object.assign(P, JSON.parse(raw)); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

/* ---------- الاكتشاف: تسطيح الشاشات ---------- */
const FLAT = [];
L.discover.forEach(st => st.screens.forEach(sc => FLAT.push(Object.assign({ stage: st.stage }, sc))));
const RULES = FLAT.filter(s => s.type === "rule");
const groups = L.drill.groups;
const isUnlocked = i => P.teacher || i === 0 || ((P.groups[groups[i - 1].id] || {}).best || 0) >= L.drill.unlockScore;

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

/* ---------- الرئيسية ---------- */
function home(){
  const doneG = groups.filter(g => (P.groups[g.id] || {}).best >= L.drill.unlockScore).length;
  render(`
  <div class="hero enter">
    <div class="unit">${esc(L.unit)} · ${esc(L.grade)}</div>
    <h1>${esc(L.title)}</h1>
    <div class="pattern" aria-label="وزن فاعل: الألف حرف زائد">
      <span>ف</span><span class="z">ا</span><span>ع</span><span>ل</span>
    </div>
    <div class="pattern-cap">الحرف الملوّن هو الحرف الزايد… وده اللي هتكتشفه بنفسك.</div>
  </div>
  <div class="tiles">
    <button class="tile" data-act="discover" data-focus>
      <span class="num">١</span>
      <span class="tx"><b>اكتشف القاعدة</b><span>${ar(FLAT.length)} خطوة قصيرة · بتوصل للقاعدة بنفسك</span></span>
      ${P.discoverDone ? '<span class="st">خلّصتها</span>' : (P.discoverAt ? `<span class="st" style="color:var(--brand)">كمّل</span>` : "")}
    </button>
    <button class="tile" data-act="groups">
      <span class="num">٢</span>
      <span class="tx"><b>التدريبات</b><span>${ar(groups.length)} مجموعات · ${ar(groups.reduce((a, g) => a + g.questions.length, 0))} سؤال · سهل ومتوسط وصعب</span></span>
      ${doneG ? `<span class="st">${ar(doneG)} من ${ar(groups.length)}</span>` : ""}
    </button>
    <button class="tile" data-act="summary">
      <span class="num">٣</span>
      <span class="tx"><b>الملخص</b><span>كل القواعد في مكان واحد</span></span>
    </button>
  </div>
  <div class="foot" style="gap:16px;flex-wrap:wrap"><a class="link" href="./">كل الدروس</a><button class="link" data-act="teacher">${P.teacher ? "وضع المعلم شغّال: كل المجموعات مفتوحة (اقفله)" : "وضع المعلم: افتح كل المجموعات"}</button></div>`);
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
    fb.innerHTML = `<div class="fb good enter"><b class="h">صح!</b>${md(o.fb)}${s.after ? `<div style="margin-top:6px">${md(s.after)}</div>` : ""}</div>`;
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
    <div class="meta"><span>لازم تجيب ${ar(L.drill.unlockScore)} من ${ar(groups[0].questions.length)} عشان المجموعة اللي بعدها تتفتح</span></div>
    ${groups.map((g, i) => {
      const st = P.groups[g.id] || {}; const open = isUnlocked(i);
      return `<button class="grp enter ${LV[g.level]}" data-grp="${i}" ${open ? "" : "disabled"} ${i === 0 ? "data-focus" : ""}>
        <span class="lv"></span>
        <span class="tx"><span class="chip ${LV[g.level]}"><span class="dot"></span>${esc(g.level)}</span><b style="color:var(--ink)">${esc(g.title)}</b><span>${esc(g.desc)}</span></span>
        <span class="sc">${open ? (st.best != null ? `${ar(st.best)}/${ar(g.questions.length)}<em>أحسن نتيجة</em>` : `<em>ابدأ</em>`) : `<em>مقفولة</em>`}</span>
      </button>`;
    }).join("")}`);
}

/* ---------- الأسئلة ---------- */
let Z = null;
function startGroup(gi){
  const g = groups[gi];
  Z = { gi, g, list: g.questions.map(q => ({ q, review: false })), i: 0, score: 0, wrong: [], reviewStarted: false, done: false, answered: false, usedReserve: new Set(), tagRun: {} };
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
    <div class="meta"><span class="chip ${LV[g.level]}"><span class="dot"></span>${it.review ? "جولة مراجعة" : esc(g.level)}</span><span>${pos}</span></div>
    ${showRule ? `<div class="rule-mini enter"><span class="tag">القاعدة اللي هتحتاجها</span>${md(q.rule)}</div>` : ""}
    <div class="card enter" id="qcard">
      <div class="kind">${esc(q.kind)}</div>
      <div class="stem">${md(q.stem)}</div>
      ${q.sentence ? `<div class="sentence">${md(q.sentence)}</div>` : ""}
      <div class="opts ${q.options.every(o => o.t.length < 16) ? "two" : ""}">${Z.order.map((k, n) => `<button class="opt" data-qopt="${k}" ${n === 0 ? "data-focus" : ""}><span class="n">${ar(n + 1)}</span><span class="t">${md(q.options[k].t)}</span></button>`).join("")}</div>
      <div id="qfb"></div>
      <div class="actions" id="qact"></div>
    </div>`);
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
    fb.innerHTML = `<div class="fb good enter"><b class="h">${pick(["صح، برافو!", "مظبوط!", "تمام كده!", "إجابة صح!"])}</b>${md(q.explain)}</div>`;
  } else {
    const card = document.getElementById("qcard"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    fb.innerHTML = `<div class="fb bad enter"><b class="h">مش دي</b>${md(q.options[k].fb)}</div>
      <div class="explain enter"><span class="lbl">القاعدة على المثال ده</span>${md(q.explain)}</div>`;
  }
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
function reviewIntro(){
  Z.reviewStarted = true;
  const extra = Z.wrong.map(q => {
    const pool = (L.drill.reserve[q.tag] || []).filter(r => !Z.usedReserve.has(r.id));
    const r = pool.length ? pool[Math.floor(Math.random() * pool.length)] : q;
    Z.usedReserve.add(r.id);
    return { q: r, review: true };
  });
  Z.list = Z.list.concat(extra);
  const n = extra.length;
  render(`${topbar(L.title, Z.g.level + " · " + Z.g.title, "groups")}
    <div class="bar"><i style="width:100%"></i></div>
    <div class="card enter center" style="margin-top:18px">
      <span class="chip ${LV[Z.g.level]}"><span class="dot"></span>جولة مراجعة</span>
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
  const pass = s >= L.drill.unlockScore;
  const next = Z.gi + 1 < groups.length ? Z.gi + 1 : null;
  const C = 2 * Math.PI * 54, frac = s / n;
  const rows = Object.entries(Z.tagRun).map(([tag, v]) => {
    const p = v.ok / v.n, cls = p >= .8 ? "ok" : p >= .5 ? "mid" : "low", lbl = p >= .8 ? "متقن" : p >= .5 ? "قرّبت" : "راجعها";
    return `<div class="mrow"><span class="lb">${esc(L.drill.tags[tag] || tag)}</span><span class="mb"><i style="width:${Math.round(p * 100)}%"></i></span><span class="pill ${cls}">${lbl}</span></div>`;
  }).join("");
  render(`${topbar(L.title, g.level + " · " + g.title, "groups")}
    <div class="card enter" style="margin-top:14px">
      <div class="center">
        <span class="chip ${LV[g.level]}"><span class="dot"></span>${esc(g.level)}</span>
        <div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="60" cy="60" r="54" fill="none" stroke="${pass ? "var(--mint)" : "var(--sun)"}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}"/></svg><div class="v">${ar(s)}<small>من ${ar(n)}</small></div></div>
        <h2 class="title">${pass ? (s === n ? "العلامة الكاملة!" : "عدّيت المجموعة") : "قرّبت… محتاج " + ar(L.drill.unlockScore - s) + " كمان"}</h2>
        <p class="body">${pass ? (next != null ? "المجموعة اللي بعدها اتفتحت." : "كده خلّصت كل التدريبات.") : "عيد المجموعة، وركّز في القاعدة اللي فوق كل سؤال."}</p>
      </div>
      ${rows ? `<div class="mast"><div class="kind">نقاطك في المجموعة دي</div>${rows}</div>` : ""}
      <div class="actions" style="justify-content:center">
        ${pass && next != null ? `<button class="btn" data-grp="${next}" data-focus>المجموعة اللي بعدها</button>` : ""}
        <button class="btn ${pass && next != null ? "ghost" : ""}" data-grp="${Z.gi}" ${pass && next != null ? "" : "data-focus"}>عيد المجموعة</button>
        <button class="btn ghost" data-act="summary">الملخص</button>
      </div>
    </div>`);
}

/* ---------- الملخص ---------- */
function summary(){
  const all = RULES.concat(L.summaryExtra || []);
  const tagRows = Object.entries(P.tags).filter(([, v]) => v.n).map(([tag, v]) => {
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
  if (b.dataset.grp != null) { const gi = +b.dataset.grp; if (isUnlocked(gi)) startGroup(gi); return; }
  const a = b.dataset.act;
  if (a === "home") home();
  else if (a === "discover") discover(P.discoverDone ? 0 : (P.discoverAt || 0));
  else if (a === "dnext") dNext();
  else if (a === "dprev") discover(D.i - 1);
  else if (a === "groups") groupsView();
  else if (a === "summary") summary();
  else if (a === "qnext") qNext();
  else if (a === "rstart") { Z.i++; question(); }
  else if (a === "rskip") finishGroup();
  else if (a === "teacher") { P.teacher = !P.teacher; save(); home(); }
});
document.addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
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
    .catch(() => { app.innerHTML = '<div class="card" style="margin-top:24px"><h2 class="title">الدرس ده مش موجود</h2><p class="body">ارجع لقايمة الدروس واختار درس تاني.</p><div class="actions"><a class="btn" href="./" style="text-decoration:none">كل الدروس</a></div></div>'; });
})();
