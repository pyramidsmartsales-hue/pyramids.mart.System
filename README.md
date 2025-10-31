## نشر على Render (مباشر)

### خطوات سريعة
1. ادفع الكود إلى GitHub على فرع `main` أو `render-deploy`.
2. في Render:
   - أنشئ **Web Service** واختر المستودع: Root directory = `server`
     - Build command: `npm install`
     - Start command: `npm start`
   - فاقد المتغيرات (Environment) في لوحة Render:
     - `MONGODB_URI` = (رابط MongoDB Atlas كامل)
     - `SESSION_STORE_PATH` = `./.wwebjs_auth`
     - `WHATSAPP_USE_CLOUD_API` = `false` (أو true لو تستخدم cloud)
     - (اختياري) `CLIENT_URL` = رابط الواجهة من Render

3. أنشئ **Static Site** في Render لنشر الواجهة:
   - Root directory = `client`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - في Environment: `VITE_API_URL` = `https://<your-backend-render-url>`

4. افتح رابط الواجهة، اضغط "Show QR" وتحقق من سجلات السيرفر لرؤية أحداث `wa:qr` و`wa:ready`.

> ملاحظة أمانية: لا ترفع ملف `.env` الحقيقي أو ملفات الجلسة `.wwebjs_auth` و`server/uploads` إلى GitHub. ضع المتغيرات السرية في Render Environment.
