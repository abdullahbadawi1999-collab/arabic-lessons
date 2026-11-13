// «قول ملاحظاتك»: الطالب بيبعت رسالة للمعلم من الصفحة الرئيسية، وبتظهر في صفحة الإحصائيات.
import { sql, ensureTable, cors } from "./_db.mjs";

// حد بسيط: ١٠ رسايل في الساعة لكل جهاز (بيتصفّر لما الدالة تتشغّل من جديد)
const HITS = new Map();
function tooMany(key){
  const now = Date.now(), list = (HITS.get(key) || []).filter(t => now - t < 60 * 60 * 1000);
  list.push(now); HITS.set(key, list);
  return list.length > 10;
}

export default async function handler(req, res){
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const message = String(body?.message || "").trim().slice(0, 2000);
  const name = String(body?.name || "").trim().slice(0, 80) || null;
  const device = String(body?.device || "").slice(0, 64) || null;
  if (!message) return res.status(400).json({ error: "اكتب ملاحظتك الأول." });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (tooMany(device || ip || "?")) return res.status(429).json({ error: "بعتّ رسايل كتير، جرّب تاني بعد شوية." });
  if (!sql) return res.status(500).json({ error: "مقدرناش نبعت دلوقتي، جرّب تاني بعد شوية." });
  try {
    await ensureTable();
    await sql`INSERT INTO feedback (device, name, message) VALUES (${device}, ${name}, ${message})`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("feedback:", e.message);
    return res.status(500).json({ error: "مقدرناش نبعت دلوقتي، جرّب تاني بعد شوية." });
  }
}
