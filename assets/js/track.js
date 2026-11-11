// عدّاد الزيارات: كل جهاز بياخد رقم عشوائي (من غير أي اسم ولا بيانات شخصية)، وبنبعت للدالة على Vercel
// لما حد يفتح الرئيسية أو درس أو مجموعة أو نموذج امتحان. لو فيه أي مشكلة بيسكت ومش بيأثر على الموقع.
(function(){
  window.API_BASE = location.hostname.endsWith(".vercel.app") ? "/api" : "https://arabic-lessons-nine.vercel.app/api";
  let id = null, on = true;
  try {
    const o = localStorage.getItem("apiBase"); // للتجربة بس
    if (o) window.API_BASE = o;
    id = localStorage.getItem("device:v1");
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem("device:v1", id); }
    // بنعدّ على رابط الطلاب (GitHub) بس: مش وقت التجربة على الجهاز، ولا على نسخة Vercel اللي Vercel بيفتحها لوحده وقت النشر
    on = location.hostname.endsWith("github.io") || !!localStorage.getItem("trackTest");
  } catch (e) { id = "anon"; }
  window.deviceId = id;
  window.track = function(kind, lesson, detail){
    if (!on) return;
    const body = JSON.stringify({ device: id, kind, lesson: lesson || null, detail: detail || null });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(window.API_BASE + "/hit", body)) return;
      fetch(window.API_BASE + "/hit", { method: "POST", body, keepalive: true }).catch(function(){});
    } catch (e) {}
  };

  // تصحيحات المعلم: لو المعلم صحّح رد من ردود المعلم الآلي على سؤال الطالب ده، بيظهرله مربع أول ما يفتح المنصة
  if (!on || id === "anon") return;
  function post(body){
    return fetch(window.API_BASE + "/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  function show(notes){
    const box = document.createElement("div");
    box.className = "tnote-back";
    box.innerHTML = '<div class="tnote" role="dialog" aria-modal="true" aria-labelledby="tnote-h">'
      + '<h2 id="tnote-h">تصحيح من المعلم</h2>'
      + '<p class="tnote-sub">المعلم راجع ' + (notes.length > 1 ? "أسئلة سألتها" : "سؤال سألته") + ' للمعلم الآلي، وكتبلك التصحيح ده:</p>'
      + notes.map(n => '<div class="tnote-item">'
        + '<div class="tnote-q"><span>سؤالك' + (n.lesson ? " في درس «" + esc(n.lesson) + "»" : "") + ':</span>' + md(n.message) + '</div>'
        + '<div class="tnote-fix">' + md(n.correction) + '</div></div>').join("")
      + '<div class="actions"><button class="btn" type="button">تمام، فهمت</button></div></div>';
    document.body.appendChild(box);
    const btn = box.querySelector("button");
    btn.focus();
    btn.addEventListener("click", function(){
      post({ device: id, seen: notes.map(n => n.id) }).catch(function(){});
      box.remove();
    });
  }
  function check(){
    post({ device: id }).then(r => r.json()).then(j => { if (j && j.notes && j.notes.length) show(j.notes); }).catch(function(){});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", check); else check();
})();
