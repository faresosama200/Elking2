# مشروع التخرج TalentHub

منصة متكاملة لإدارة التوظيف والمهارات (واجهة أمامية + خادم خلفي) مع دعم العربية كلغة أساسية، ونظام مصادقة، ولوحات إدارة.

## وضع التشغيل المعتمد

- الوضع الأساسي (الموصى به): `backend/` (Node.js + Express + Prisma).
- وضع بديل للتجارب المحلية فقط: `php-api/` عبر XAMPP.
- الواجهة الأمامية في `dashbord/api.js` تملك آلية fallback لاختيار API المتاح، لكن في التسليم النهائي يفضّل الاعتماد على مسار واحد فقط.

## ملف التسليم

- دليل التسليم النهائي بالعربية: [PROJECT_DELIVERY_AR.md](PROJECT_DELIVERY_AR.md)

## هيكل المشروع

- `backend/`: خادم Express API مع Prisma ORM وقاعدة بيانات SQLite ونظام مصادقة واختبارات.
- `login/` و`register/` و`dashbord/`: صفحات الواجهة الأمامية ولوحات الإدارة.
- `ui-controls.js`: لوحة إعدادات موحدة عائمة (اللغة + الوضع).

## المميزات

- مصادقة JWT (`register` و`login` و`refresh` و`me` و`logout`)
- صفحات إدارة حسب الصلاحيات (طلاب، شركات، وظائف، مهارات، جامعات)
- تجربة عربية RTL مع إمكانية التحويل إلى الإنجليزية
- تبديل الوضع الفاتح/الداكن مع حفظ الاختيار
- تحقق بيانات في الخادم باستخدام Zod
- طبقة بيانات باستخدام Prisma
- اختبارات خلفية تلقائية (Vitest + Supertest)

## المتطلبات

- Node.js 20 أو أحدث (مستحسن)
- npm

## الإعداد

1. تثبيت حزم الخادم الخلفي:

```bash
npm --prefix backend install
```

2. إعداد ملف البيئة:

```bash
copy backend/.env.example backend/.env
```

3. توليد Prisma Client وتطبيق مخطط قاعدة البيانات:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
```

4. إنشاء بيانات أولية (Seeder) للمشرف:

```bash
npm run seed:api
```

## التشغيل

- تشغيل الخادم الخلفي في وضع التطوير:

```bash
npm run dev:api
```

- افتح صفحات الواجهة من جذر المشروع عبر أي Static Server (مثل VS Code Live Server).

- تشغيل سريع بضغطة واحدة على Windows:

	- اضغط مرتين على [START-TalentHub.bat](START-TalentHub.bat) من جذر المشروع.
	- أو استخدم [run-project.bat](run-project.bat) (أصبح يستخدم نفس المحرك الجديد).
	- سيقوم بتشغيل Backend + Frontend + Prisma + Seed والتحقق من /health ثم فتح صفحة الدخول تلقائيا.

- تشغيل سريع عبر npm:

```bash
npm run quick:start
```

- لو أردت فتح كل لوحات التحكم تلقائيا بعد التشغيل:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\quick-start.ps1 -OpenAllDashboards
```

- عند وجود أي مشكلة تشغيل، راجع ملفات السجلات داخل:

```text
.runtime-logs/
```

## الاختبارات

- تشغيل اختبارات الخادم الخلفي:

```bash
npm run test:api
```

- تشغيل اختبارات E2E (بعد تثبيت متطلبات المتصفح):

```bash
npm run test:e2e
```

- تشغيل فحص شامل (Lint + API Tests + E2E):

```bash
npm run check:all
```

- تشغيل فحص الجودة (Lint) للخادم الخلفي:

```bash
npm run lint:api
```

## حساب المشرف الافتراضي

- البريد الإلكتروني: `admin@talenthub.local`
- كلمة المرور: `Admin1234`

## ملاحظات الجاهزية للإنتاج

- استبدال مفاتيح JWT في `backend/.env`
- تقييد `CORS_ORIGIN` بدومين الواجهة النهائي
- الانتقال من SQLite إلى قاعدة بيانات إنتاجية عند التوسع
- إعداد مدير عمليات (PM2 أو Docker أو Service Manager)
- توحيد مسار الـ API في الواجهة (Node أو PHP) وإيقاف الاعتماد على fallback قبل التسليم النهائي
- استخدام `backend/.env.production.example` كمرجع لإعداد متغيرات بيئة الإنتاج

## CI/CD

- يوجد فحص تلقائي عند كل push و pull request عبر GitHub Actions في `.github/workflows/ci-check.yml`.
- هذا الفحص ينفذ: Prisma generate/push ثم `npm run check:all`.

## نشر المنصة (Frontend + Backend مجاني)

1. Frontend على GitHub Pages:
1. تأكد أن الفرع `main` يحتوي الملفات الحالية.
2. افتح GitHub Repository > Settings > Pages.
3. اجعل Source = GitHub Actions.
4. شغّل workflow [deploy-frontend-pages.yml](.github/workflows/deploy-frontend-pages.yml) أو نفّذ push جديد.
5. رابط الواجهة النهائي سيكون غالبا:
   [https://faresosama200.github.io/Elking2/login/login.html](https://faresosama200.github.io/Elking2/login/login.html)

2. Backend مجاني (Render):
1. افتح Render ثم New > Blueprint.
2. اربط نفس Repository وسيقرأ [render.yaml](render.yaml) تلقائيا.
3. بعد اكتمال النشر انسخ رابط الخدمة (مثال):
   `https://elking2-api.onrender.com/api`
4. تأكد أن `CORS_ORIGIN` في Render يشمل رابط GitHub Pages.

3. الربط النهائي:
1. ملفات الواجهة تستخدم رابط Render تلقائيا على GitHub Pages.
2. رابط التجربة الذي سترسله للناس:
   [https://faresosama200.github.io/Elking2/login/login.html](https://faresosama200.github.io/Elking2/login/login.html)
