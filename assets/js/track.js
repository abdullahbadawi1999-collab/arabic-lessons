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
    // على الجهاز وقت التجربة مش بنعدّ، إلا لو trackTest متفعّل
    on = !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || !!localStorage.getItem("trackTest");
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
})();
