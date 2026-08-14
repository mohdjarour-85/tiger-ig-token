if (url.pathname === "/schedule") {
      return html(`
        <h1>Tiger Event — جدولة بوست</h1>
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
        <p>وقت النشر:</p>
        <input type="datetime-local" id="dt" style="width:100%;padding:10px;border-radius:8px;">
        <button type="button" id="saveBtn" class="btn" style="border:none;cursor:pointer;">جدولة البوست</button>
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
          document.getElementById('saveBtn').addEventListener('click', async function(){
            const btn = this;
            if (btn.disabled) return;
            const fileInput = document.getElementById('img');
            const caption = document.getElementById('cap').value;
            const dt = document.getElementById('dt').value;
            const statusDiv = document.getElementById('status');
            if (!fileInput.files[0] || !dt) {
              statusDiv.innerHTML = '<p>لازم تختار ملف ووقت النشر</p>';
              return;
            }
            btn.disabled = true;
            statusDiv.innerHTML = '<p>⏳ جاري الحفظ...</p>';
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            formData.append('caption', caption);
            formData.append('scheduled_time', dt);
            try {
              const res = await fetch('/save-schedule', { method: 'POST', body: formData });
              const data = await res.json();
              if (data.success) {
                statusDiv.innerHTML = '<h1>✅ تم جدولة البوست</h1><p>هينشر تلقائيًا بالوقت المحدد</p>';
              } else {
                statusDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
              }
            } catch (err) {
              statusDiv.innerHTML = '<pre>خطأ: ' + String(err) + '</pre>';
            } finally {
              btn.disabled = false;
            }
          });
        </script>
      `);
    }

    if (url.pathname === "/save-schedule") {
      if (!env.IMAGES || !env.DB) {
        return new Response(JSON.stringify({ success: false, error: "الإعداد ناقص (R2 أو DB)" }), { headers: { "content-type": "application/json" } });
      }
      try {
        const formData = await request.formData();
        const file = formData.get("image");
        const caption = formData.get("caption") || "";
        const scheduledTime = formData.get("scheduled_time");
        if (!file || !scheduledTime) {
          return new Response(JSON.stringify({ success: false, error: "بيانات ناقصة" }), { headers: { "content-type": "application/json" } });
        }

        const ext = file.name.split(".").pop() || "jpg";
        const key = `posts/${Date.now()}.${ext}`;
        await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

        const mediaType = file.type.startsWith("video/") ? "video" : "image";

        await env.DB.prepare(
          "INSERT INTO scheduled_posts (media_key, media_type, caption, scheduled_time) VALUES (?, ?, ?, ?)"
        ).bind(key, mediaType, caption, scheduledTime).run();

        return new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: String(e) }), { headers: { "content-type": "application/json" } });
      }
    }

</parameter>
