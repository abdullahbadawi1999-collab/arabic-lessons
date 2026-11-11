// تصحيحات المعلم: الموقع بيسأل هنا أول ما الطالب يفتحه «فيه تصحيح من المعلم لجهازي؟»،
// ولما الطالب يدوس «تمام، فهمت» بيبعت هنا إنه شافه عشان ميظهرلوش تاني.
import { sql, ensureTable, cors, LESSONS } from "./_db.mjs";

export default async function handler(req, res){
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  res.setHeader("Cache-Control", "no-store");
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const device = String(body?.device || "").slice(0, 64);
  if (!sql || !device || device === "anon") return res.status(200).json({ notes: [] });
  try {
    await ensureTable();
    const seen = (Array.isArray(body?.seen) ? body.seen : []).map(Number).filter(Number.isInteger).slice(0, 50);
    if (seen.length) {
      const done = await sql`UPDATE tutor_log SET seen_at = now() WHERE device = ${device} AND id = ANY(${seen}::bigint[]) RETURNING id`;
      return res.status(200).json({ ok: true, updated: done.length });
    }
    const rows = await sql`SELECT id, lesson, message, reply, correction FROM tutor_log
      WHERE device = ${device} AND correction IS NOT NULL AND seen_at IS NULL ORDER BY corrected_at LIMIT 10`;
    return res.status(200).json({ notes: rows.map(r => ({ id: Number(r.id), lesson: LESSONS[r.lesson] || "", message: r.message, reply: r.reply || "", correction: r.correction })) });
  } catch (e) {
    console.error("notes:", e.message);
    return res.status(500).json({ error: "db", notes: [] });
  }
}
