// عدّاد الزيارات: الموقع بيبعت هنا لما حد يفتح الصفحة الرئيسية أو درس أو مجموعة أو نموذج امتحان.
import { logEvent, cors } from "./_db.mjs";

export default async function handler(req, res){
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body;
  // sendBeacon بيبعت النص كـ text/plain
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  try { await logEvent(body || {}); } catch (e) { console.error("hit:", e.message); }
  return res.status(204).end();
}
