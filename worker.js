/**
 * Tiger Event — Instagram OAuth Token Worker
 * ------------------------------------------
 * ورك منفصل (ما يلمس موقعكم الأساسي) يسوي عملية تسجيل الدخول
 * والحصول على Access Token طويل الأمد لحساب انستقرام tiger4event.
 *
 * المتغيرات المطلوبة (Settings → Variables and Secrets بلوحة Cloudflare):
 *   IG_APP_ID        -> رقم Instagram app ID (من صفحة API setup with Instagram login)
 *   IG_APP_SECRET     -> Instagram app secret (نفس الصفحة) — خليه Secret مو Text عادي
 *   IG_REDIRECT_URI   -> رابط هذا الورك نفسه + /callback
 *                        مثال: https://tiger-ig-token.mohdjarour.workers.dev/callback
 *
 * الاستخدام:
 *   1) افتح  https://<اسم-الورك>.workers.dev/start   من المتصفح وسجل دخول بحساب tiger4event
 *   2) بعد الموافقة، انستقرام يرجعك لـ /callback تلقائيًا
 *   3) الصفحة تسوي التحويل للتوكن الطويل (60 يوم) وتعرضه لك جاهز للنسخ والحفظ
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return html(`
        <h1>Tiger Event — أداة توكن انستقرام</h1>
        <p>اضغط الزر تحت وسجل دخول بحساب <b>tiger4event</b>.</p>
        <a class="btn" href="/start">تسجيل الدخول وربط الحساب</a>
      `);
    }

    if (url.pathname === "/start") {
      if (!env.IG_APP_ID || !env.IG_REDIRECT_URI) {
        return html(errorBlock("متغيرات الإعداد ناقصة", "لازم تضيف IG_APP_ID و IG_REDIRECT_URI بإعدادات الورك أول."));
      }
      const scope = [
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
      ].join(",");

      const authUrl =
        "https://www.instagram.com/oauth/authorize" +
        `?client_id=${encodeURIComponent(env.IG_APP_ID)}` +
        `&redirect_uri=${encodeURIComponent(env.IG_REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}`;

      return Response.redirect(authUrl, 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const errDesc = url.searchParams.get("error_description");

      if (errDesc) {
        return html(errorBlock("انستقرام رفض تسجيل الدخول", errDesc));
      }
      if (!code) {
        return html(errorBlock("ما وصل كود", "الرابط ما فيه ?code= — جرب ترجع لصفحة /start من جديد."));
      }

      try {
        const form = new FormData();
        form.append("client_id", env.IG_APP_ID);
        form.append("client_secret", env.IG_APP_SECRET);
        form.append("grant_type", "authorization_code");
        form.append("redirect_uri", env.IG_REDIRECT_URI);
        form.append("code", code);

        const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          body: form,
        });
        const shortData = await shortRes.json();

        if (!shortRes.ok || !shortData.access_token) {
          return html(errorBlock("فشلت خطوة 1 (الحصول على توكن قصير)", JSON.stringify(shortData, null, 2)));
        }

        const exchangeUrl =
          "https://graph.instagram.com/access_token" +
          "?grant_type=ig_exchange_token" +
          `&client_secret=${encodeURIComponent(env.IG_APP_SECRET)}` +
          `&access_token=${encodeURIComponent(shortData.access_token)}`;

        const longRes = await fetch(exchangeUrl);
        const longData = await longRes.json();

        if (!longRes.ok || !longData.access_token) {
          return html(errorBlock("فشلت خطوة 2 (تحويل لتوكن طويل)", JSON.stringify(longData, null, 2)));
        }

        const expiresInDays = Math.round((longData.expires_in || 0) / 86400);

        return html(`
          <h1>تم بنجاح ✅</h1>
          <p>هذا التوكن الطويل (صالح تقريبًا ${expiresInDays} يوم). انسخه واحفظه كـ Secret باسم <b>IG_ACCESS_TOKEN</b> بإعدادات الورك، لأنه ما يظهر لك مرة ثانية.</p>
          <textarea readonly onclick="this.select()">${longData.access_token}</textarea>
          <p class="note">بعد ما تحفظه، هذي الصفحة ما راح تحتاجها إلا لو التوكن انتهى بعد 60 يوم وتبي تجدده.</p>
        `);
      } catch (e) {
        return html(errorBlock("خطأ غير متوقع", String(e)));
      }
    }
if (url.pathname === "/publish") {
      if (!env.IG_ACCESS_TOKEN) {
        return html(errorBlock("التوكن ناقص", "أضف IG_ACCESS_TOKEN بإعدادات الورك أول."));
      }
      const imageUrl = url.searchParams.get("image_url");
      const caption = url.searchParams.get("caption") || "";
      if (!imageUrl) {
        return html(errorBlock("رابط الصورة ناقص", "استخدم ?image_url=...&caption=..."));
      }

      try {
        const meRes = await fetch(`https://graph.instagram.com/me?fields=id&access_token=${env.IG_ACCESS_TOKEN}`);
        const meData = await meRes.json();
        if (!meData.id) {
          return html(errorBlock("ما قدرنا نجيب معرف الحساب", JSON.stringify(meData, null, 2)));
        }

        const containerRes = await fetch(`https://graph.instagram.com/v21.0/${meData.id}/media`, {
          method: "POST",
          body: new URLSearchParams({
            image_url: imageUrl,
            caption: caption,
            access_token: env.IG_ACCESS_TOKEN,
          }),
        });
        const containerData = await containerRes.json();
        if (!containerData.id) {
          return html(errorBlock("فشل إنشاء الحاوية", JSON.stringify(containerData, null, 2)));
        }

        const publishRes = await fetch(`https://graph.instagram.com/v21.0/${meData.id}/media_publish`, {
          method: "POST",
          body: new URLSearchParams({
            creation_id: containerData.id,
            access_token: env.IG_ACCESS_TOKEN,
          }),
        });
        const publishData = await publishRes.json();
        if (!publishData.id) {
          return html(errorBlock("فشل النشر", JSON.stringify(publishData, null, 2)));
        }

        return html(`<h1>✅ تم النشر بنجاح</h1><p>Post ID: ${publishData.id}</p>`);
      } catch (e) {
        return html(errorBlock("خطأ غير متوقع بالنشر", String(e)));
      }
}
    if (url.pathname === "/new") {
      return html(`
        <h1>Tiger Event — نشر جديد</h1>
        <p>قالب كابشن جاهز:</p>
        <select id="preset" style="width:100%;padding:10px;border-radius:8px;">
          <option value="">— اختر قالب (اختياري) —</option>
          <option value="wedding">أعراس</option>
          <option value="event">فعاليات وتنظيم</option>
          <option value="production">برودكشن</option>
          <option value="conference">مؤتمرات</option>
        </select>
        <p>اختر الصورة أو الفيديو:</p>
        <input type="file" id="img" accept="image/*,video/*" required>
        <p>الكابشن:</p>
        <textarea id="cap" placeholder="اكتب الكابشن هنا أو اختر قالب جاهز..." style="min-height:140px;"></textarea>
        <button type="button" id="publishBtn" class="btn" style="border:none;cursor:pointer;">نشر الآن</button>
        <div id="status" style="margin-top:16px;"></div>
        <script>
          const presets = {
            wedding: "✨ عروسين اليوم مميزين ونحرص نخلي كل تفصيلة بمناسبتكم بأحلى صورة 💍\\n\\n📍 الكويت\\n📩 تواصل معنا الحين\\n\\n#TigerEvent #أعراس #تنظيم_أعراس #الكويت",
            event: "🎉 فعالية جديدة ننظمها بكل التفاصيل من الألف للياء\\n\\n📍 الكويت\\n📩 تواصل معنا الحين\\n\\n#TigerEvent #تنظيم_فعاليات #الكويت #event_management",
            production: "🎬 خلف الكواليس... فريقنا شغال على إنتاج يليق بالمناسبة\\n\\n📍 الكويت\\n📩 تواصل معنا الحين\\n\\n#TigerEvent #برودكشن #production #الكويت",
            conference: "🎤 مؤتمر ناجح يبدأ بتنظيم احترافي، وهذا شغلنا بالضبط\\n\\n📍 الكويت\\n📩 تواصل معنا الحين\\n\\n#TigerEvent #مؤتمرات #conferences #الكويت"
          };
          document.getElementById('preset').addEventListener('change', function(){
            const val = presets[this.value];
            if (val) document.getElementById('cap').value = val;
          });

          async function pollStatus(containerId){
            const statusDiv = document.getElementById('status');
            let tries = 0;
            while (tries < 40) {
              await new Promise(function(r){ setTimeout(r, 3000); });
              const res = await fetch('/publish-status?id=' + containerId);
              const data = await res.json();
              if (data.status === 'FINISHED') return;
              if (data.status === 'ERROR') throw new Error('فشلت معالجة الفيديو');
              statusDiv.innerHTML = '<p>⏳ جاري معالجة الفيديو...</p>';
              tries++;
            }
            throw new Error('استغرقت المعالجة وقت طويل');
          }

          document.getElementById('publishBtn').addEventListener('click', async function(){
            const fileInput = document.getElementById('img');
            const caption = document.getElementById('cap').value;
            const statusDiv = document.getElementById('status');
            if (!fileInput.files[0]) return;
            statusDiv.innerHTML = '<p>⏳ جاري الرفع...</p>';
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            formData.append('caption', caption);
            try {
              const res = await fetch('/upload-and-publish', { method: 'POST', body: formData });
              const data = await res.json();
              if (!data.success) {
                statusDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                return;
              }
              if (data.isVideo) {
                await pollStatus(data.containerId);
              }
              statusDiv.innerHTML = '<p>⏳ جاري النشر النهائي...</p>';
              const finalRes = await fetch('/finalize?id=' + data.containerId);
              const finalData = await finalRes.json();
              if (finalData.success) {
                statusDiv.innerHTML = '<h1>✅ تم النشر بنجاح</h1><p>Post ID: ' + finalData.postId + '</p>';
              } else {
                statusDiv.innerHTML = '<pre>' + JSON.stringify(finalData, null, 2) + '</pre>';
              }
            } catch (err) {
              statusDiv.innerHTML = '<pre>خطأ: ' + err + '</pre>';
            }
          });
        </script>
      `);
    }

    if (url.pathname === "/upload-and-publish") {
      if (!env.IG_ACCESS_TOKEN || !env.IMAGES) {
        return new Response(JSON.stringify({ success: false, error: "الإعداد ناقص (توكن أو R2)" }), { headers: { "content-type": "application/json" } });
      }
      try {
        const formData = await request.formData();
        const file = formData.get("image");
        const caption = formData.get("caption") || "";
        if (!file) {
          return new Response(JSON.stringify({ success: false, error: "ما وصلت صورة" }), { headers: { "content-type": "application/json" } });
        }

        const ext = file.name.split(".").pop() || "jpg";
        const key = `posts/${Date.now()}.${ext}`;
        await env.IMAGES.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        const imageUrl = `https://${url.hostname}/img/${key}`;

        const meRes = await fetch(`https://graph.instagram.com/me?fields=id&access_token=${env.IG_ACCESS_TOKEN}`);
        const meData = await meRes.json();
        if (!meData.id) {
          return new Response(JSON.stringify({ success: false, error: "معرف الحساب", detail: meData }), { headers: { "content-type": "application/json" } });
        }

        const isVideo = file.type.startsWith("video/");
        const containerParams = isVideo
          ? { media_type: "REELS", video_url: imageUrl, caption: caption, access_token: env.IG_ACCESS_TOKEN }
          : { image_url: imageUrl, caption: caption, access_token: env.IG_ACCESS_TOKEN };

        const containerRes = await fetch(`https://graph.instagram.com/v21.0/${meData.id}/media`, {
          method: "POST",
          body: new URLSearchParams(containerParams),
        });
        const containerData = await containerRes.json();
        if (!containerData.id) {
          return new Response(JSON.stringify({ success: false, error: "إنشاء الحاوية", detail: containerData }), { headers: { "content-type": "application/json" } });
        }

        if (isVideo) {
          let status = "IN_PROGRESS";
          let tries = 0;
          while (status === "IN_PROGRESS" && tries < 30) {
            await new Promise((r) => setTimeout(r, 3000));
            const statusRes = await fetch(`https://graph.instagram.com/v21.0/${containerData.id}?fields=status_code&access_token=${env.IG_ACCESS_TOKEN}`);
            const statusData = await statusRes.json();
            status = statusData.status_code;
            tries++;
          }
          if (status !== "FINISHED") {
            return new Response(JSON.stringify({ success: false, error: "معالجة الفيديو فشلت أو استغرقت وقت طويل", status }), { headers: { "content-type": "application/json" } });
          }
        }

        const publishRes = await fetch(`https://graph.instagram.com/v21.0/${meData.id}/media_publish`, {
          method: "POST",
          body: new URLSearchParams({ creation_id: containerData.id, access_token: env.IG_ACCESS_TOKEN }),
        });
        const publishData = await publishRes.json();
        if (!publishData.id) {
          return new Response(JSON.stringify({ success: false, error: "النشر", detail: publishData }), { headers: { "content-type": "application/json" } });
        }

        return new Response(JSON.stringify({ success: true, postId: publishData.id }), { headers: { "content-type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: String(e) }), { headers: { "content-type": "application/json" } });
      }
    }

    if (url.pathname.startsWith("/img/")) {
      const key = url.pathname.replace("/img/", "");
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "image/jpeg" } });
    }
    return html(errorBlock("الصفحة مو موجودة", "جرب /start"));
  },
};

function errorBlock(title, detail) {
  return `<h1>⚠️ ${title}</h1><pre>${escapeHtml(detail)}</pre>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function html(body) {
  return new Response(
    `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tiger Event — Instagram Token</title>
<style>
  body { background:#0B1A2E; color:#fff; font-family:'Segoe UI',Tahoma,sans-serif; padding:28px 18px; line-height:1.7; }
  h1 { font-size:20px; color:#F8A337; }
  .btn { display:inline-block; margin-top:16px; background:#F8A337; color:#0B1A2E; font-weight:700;
         padding:14px 22px; border-radius:10px; text-decoration:none; }
  textarea { width:100%; min-height:110px; margin-top:14px; background:#101F38; color:#7CE0A0;
             border:1px solid #2E7D4F; border-radius:10px; padding:12px; font-family:monospace;
             font-size:13px; direction:ltr; text-align:left; }
  pre { background:#101F38; border:1px solid #1E3050; border-radius:10px; padding:14px;
        white-space:pre-wrap; direction:ltr; text-align:left; font-size:13px; }
  .note { color:#9FB0C8; font-size:13px; }
</style>
</head>
<body>${body}</body>
</html>`,
    { headers: { "content-type": "text/html; charset=UTF-8" } }
  );
}
