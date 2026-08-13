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
