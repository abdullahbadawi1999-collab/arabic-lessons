// يتأكد إن ملفات lessons/*.json ماشية على schema/lesson.schema.json وعلى قواعد المحتوى.
// الاستخدام: npm run validate            (كل الدروس)
//            npm run validate -- lessons/ism-alfa3il.json
// بيخرج بـ 1 لو فيه أي ERROR. الـ WARN للتنبيه بس.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LESSONS = join(ROOT, "lessons");
const GH = !!process.env.GITHUB_ACTIONS;

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
const checkSchema = ajv.compile(JSON.parse(readFileSync(join(ROOT, "schema/lesson.schema.json"), "utf8")));

/* ---------- التقرير ---------- */
const reports = [];
function report(file){
  const r = { file: relative(ROOT, file).replace(/\\/g, "/"), raw: "", errors: [], warnings: [], note: "" };
  const add = list => (at, msg, qid) => list.push({ at, msg, qid });
  r.error = add(r.errors); r.warn = add(r.warnings);
  reports.push(r);
  return r;
}
function lineOf(r, qid){
  if (!qid || !r.raw) return 0;
  const m = new RegExp(`"id"\\s*:\\s*"${qid.replace(/[-]/g, "\\-")}"`).exec(r.raw);
  return m ? r.raw.slice(0, m.index).split("\n").length : 0;
}
function readJson(file, r){
  try { r.raw = readFileSync(file, "utf8"); } catch (e) { r.error("", "الملف مش موجود"); return null; }
  try { return JSON.parse(r.raw.replace(/^﻿/, "")); } catch (e) { r.error("", "JSON مش سليم: " + e.message); return null; }
}

/* ---------- أخطاء الـ schema ---------- */
const TYPES = { string: "نص", array: "قايمة", object: "object", boolean: "true أو false", integer: "رقم صحيح", number: "رقم", null: "null" };
function schemaMessage(e){
  const p = e.params;
  switch (e.keyword) {
    case "required": return `ناقص الحقل «${p.missingProperty}»`;
    case "additionalProperties": return `حقل مش معروف «${p.additionalProperty}»`;
    case "type": return `لازم يبقى ${String(p.type).split(",").map(t => TYPES[t] || t).join(" أو ")}`;
    case "enum": return `لازم يبقى واحد من: ${p.allowedValues.join("، ")}`;
    case "const": return `لازم يبقى «${p.allowedValue}»`;
    case "minItems": return `لازم يبقى فيه ${p.limit} على الأقل`;
    case "maxItems": return `لازم يبقى فيه ${p.limit} على الأكتر`;
    case "minProperties": return "فاضي";
    case "minLength": return "نص فاضي";
    case "pattern": return `الشكل مش مسموح (${p.pattern})`;
    case "minimum": return `أقل رقم مسموح ${p.limit}`;
    case "maximum": return `أكبر رقم مسموح ${p.limit}`;
  }
  return e.message;
}
const dotted = ptr => ptr.split("/").slice(1).map(s => /^\d+$/.test(s) ? `[${s}]` : "." + s).join("").replace(/^\./, "");

/* ---------- قواعد المحتوى ---------- */
const plain = t => t.replace(/\[\[|\]\]|\*\*|[{}]/g, "").replace(/\s+/g, " ").trim();
function noDuplicates(options, at, r, qid){
  const seen = new Map();
  options.forEach((o, k) => {
    const t = plain(o.t);
    if (seen.has(t)) r.error(`${at}.options[${k}]`, `اختيار مكرر: «${o.t}» زي الاختيار ${seen.get(t)}`, qid);
    else seen.set(t, k);
  });
}
function walkStrings(v, at, fn){
  if (typeof v === "string") fn(v, at);
  else if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, `${at}[${i}]`, fn));
  else if (v && typeof v === "object") for (const k in v) walkStrings(v[k], at ? `${at}.${k}` : k, fn);
}

function checkLesson(L, file, r){
  const want = basename(file, ".json");
  if (L.id !== want) r.error("id", `الـ id «${L.id}» لازم يبقى زي اسم الملف «${want}»`);

  // الاكتشاف
  let screens = 0;
  L.discover.forEach((st, si) => st.screens.forEach((sc, i) => {
    screens++;
    if (sc.type !== "q") return;
    const at = `discover[${si}].screens[${i}]`;
    const ok = sc.options.filter(o => o.ok).length;
    if (ok !== 1) r.error(at, `لازم يبقى فيه اختيار صح واحد بالظبط (لقيت ${ok})`);
    noDuplicates(sc.options, at, r);
    if (!(sc.example && sc.example.length) && !/\[\[|«/.test(sc.prompt + (sc.body || "")))
      r.warn(at, "السؤال مفيهوش example ولا كلمة مميزة في نصه، فممكن يعتمد على حاجة اتعرضت قبله");
  }));

  // التدريبات
  const D = L.drill, all = [], ids = new Map(), groupIds = new Set();
  D.groups.forEach((g, gi) => {
    const at = `drill.groups[${gi}]`;
    if (groupIds.has(g.id)) r.error(`${at}.id`, `id المجموعة «${g.id}» متكرر`);
    groupIds.add(g.id);
    const unlock = g.unlockScore ?? D.unlockScore;
    if (unlock > g.questions.length) r.error(g.unlockScore != null ? `${at}.unlockScore` : "drill.unlockScore", `${unlock} أكبر من عدد أسئلة المجموعة «${g.id}» (${g.questions.length})`);
    g.questions.forEach((q, qi) => {
      all.push([`${at}.questions[${qi}]`, q]);
      if (g.showRule && !q.rule) r.warn(`${at}.questions[${qi}]`, "المجموعة بتعرض القاعدة بس السؤال مفيهوش rule", q.id);
    });
  });
  for (const [tag, list] of Object.entries(D.reserve)) {
    if (!(tag in D.tags)) r.error(`drill.reserve.${tag}`, `الـ tag «${tag}» مش متعرّف في drill.tags`);
    list.forEach((q, qi) => {
      const at = `drill.reserve.${tag}[${qi}]`;
      all.push([at, q]);
      if (q.tag !== tag) r.error(`${at}.tag`, `الـ tag «${q.tag}» مش زي المفتاح اللي السؤال جواه «${tag}»`, q.id);
    });
  }

  for (const [at, q] of all) {
    if (ids.has(q.id)) r.error(`${at}.id`, `id السؤال «${q.id}» متكرر، أول مرة في ${ids.get(q.id)}`, q.id);
    else ids.set(q.id, at);
    if (!(q.tag in D.tags)) r.error(`${at}.tag`, `الـ tag «${q.tag}» مش متعرّف في drill.tags`, q.id);
    q.options.forEach((o, k) => { if (k !== q.answer && !o.fb) r.error(`${at}.options[${k}]`, "اختيار غلط ومفيش له fb", q.id); });
    if (q.options[q.answer].fb) r.warn(`${at}.options[${q.answer}]`, "الإجابة الصح ليها fb، والمحرّك مش بيعرضه", q.id);
    noDuplicates(q.options, at, r, q.id);
  }

  const used = new Set(D.groups.flatMap(g => g.questions.map(q => q.tag)));
  for (const tag of used) if (!(D.reserve[tag] || []).length) r.error("drill.reserve", `الـ tag «${tag}» مستخدم في الأسئلة ومفيش له أسئلة في reserve`);
  for (const tag in D.tags) if (!used.has(tag)) r.warn(`drill.tags.${tag}`, "tag متعرّف ومش مستخدم في أي سؤال");

  // الترميز
  walkStrings(L, "", (s, at) => {
    const n = re => (s.match(re) || []).length;
    if (n(/\[\[/g) !== n(/\]\]/g) || n(/\{/g) !== n(/\}/g) || n(/\*\*/g) % 2) r.error(at, `ترميز مش مقفول: «${s}»`);
  });

  const reserve = Object.values(D.reserve).reduce((a, l) => a + l.length, 0);
  r.note = `${screens} شاشة، ${all.length - reserve} سؤال، ${reserve} احتياطي`;
}

/* ---------- الفهرس ---------- */
function checkIndex(){
  const file = join(LESSONS, "index.json"), r = report(file), listed = new Set();
  const idx = readJson(file, r);
  if (!idx) return listed;
  if (!Array.isArray(idx.years)) { r.error("years", "لازم يبقى قايمة"); return listed; }
  idx.years.forEach((y, yi) => {
    if (!Array.isArray(y.units)) return r.error(`years[${yi}].units`, "لازم يبقى قايمة");
    y.units.forEach((u, ui) => {
      if (!Array.isArray(u.lessons)) return r.error(`years[${yi}].units[${ui}].lessons`, "لازم يبقى قايمة");
      u.lessons.forEach((l, li) => {
        const at = `years[${yi}].units[${ui}].lessons[${li}]`;
        for (const k of ["id", "title", "desc"]) if (typeof l[k] !== "string" || !l[k]) r.error(`${at}.${k}`, "ناقص أو فاضي");
        if (typeof l.ready !== "boolean") r.error(`${at}.ready`, "لازم يبقى true أو false");
        if (listed.has(l.id)) r.error(`${at}.id`, `الدرس «${l.id}» متكرر في الفهرس`);
        listed.add(l.id);
        if (l.ready && !existsSync(join(LESSONS, `${l.id}.json`))) r.error(at, `معلّم ready والملف lessons/${l.id}.json مش موجود`);
      });
    });
  });
  r.note = `${listed.size} درس`;
  return listed;
}

/* ---------- التشغيل ---------- */
const listed = checkIndex();
const args = process.argv.slice(2);
const files = args.length ? args.map(f => resolve(f))
  : readdirSync(LESSONS).filter(f => f.endsWith(".json") && f !== "index.json").sort().map(f => join(LESSONS, f));
for (const file of files) {
  const r = report(file);
  const L = readJson(file, r);
  if (!L) continue;
  if (!listed.has(basename(file, ".json"))) r.warn("", "الدرس مش موجود في lessons/index.json");
  if (!checkSchema(L)) {
    for (const e of checkSchema.errors) if (e.keyword !== "if" && e.keyword !== "propertyNames") r.error(dotted(e.instancePath), schemaMessage(e));
    continue; // قواعد المحتوى محتاجة الشكل يبقى سليم الأول
  }
  checkLesson(L, file, r);
}

let nErr = 0, nWarn = 0;
const esc = s => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
for (const r of reports) {
  nErr += r.errors.length; nWarn += r.warnings.length;
  const ok = !r.errors.length && !r.warnings.length;
  console.log(`${ok ? "OK  " : r.errors.length ? "FAIL" : "WARN"} ${r.file}${r.note ? `  (${r.note})` : ""}`);
  for (const [kind, list] of [["ERROR", r.errors], ["WARN ", r.warnings]]) for (const i of list) {
    const where = `${i.at || "(الملف)"}${i.qid ? ` [${i.qid}]` : ""}`;
    console.log(`  ${kind} ${where}: ${i.msg}`);
    if (GH) { const line = lineOf(r, i.qid); console.log(`::${kind === "ERROR" ? "error" : "warning"} file=${r.file}${line ? `,line=${line}` : ""}::${esc(`${where}: ${i.msg}`)}`); }
  }
}
console.log(`\n${reports.length} ملفات · ${nErr} خطأ · ${nWarn} تحذير`);
process.exit(nErr ? 1 : 0);
