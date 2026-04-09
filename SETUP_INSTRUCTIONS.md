# 🎯 TalentHub - دليل الاختبار والتشغيل (وضع PHP البديل)

> هذا الدليل خاص بتشغيل المسار البديل `php-api/` عبر XAMPP.
> المسار الأساسي المعتمد للمشروع هو `backend/` (Node.js) كما هو موضح في `README.md` و `backend/README.md`.

## ✅ الحالة الحالية

### ما تم إنجازه:
- ✅ Frontend كامل (Login, Register, Dashboard, جميع صفحات الـ Admin)
- ✅ PHP API مكتوب كاملاً (`php-api/index.php`)
- ✅ MySQL Database Schema مُنشأ وفيه `talenthub` database
- ✅ حساب الأدمن مُنشأ وجاهز
- ✅ XAMPP 8.2 مُثبّت (PHP + Apache + MySQL)
- ✅ الـ Frontend موصول بـ API بشكل صحيح
- ✅ جميع طلبات API CRUD مُعرّفة

---

## 🚀 كيفية الاختبار والتشغيل

## متى تستخدم هذا الدليل؟

- استخدمه فقط إذا أردت تشغيل النسخة البديلة المبنية على PHP + MySQL.
- إذا كان هدفك تشغيل النسخة الأساسية (Node.js + Prisma)، استخدم تعليمات `README.md` في جذر المشروع.

### طريقة 1️⃣: الاختبار السريع (API Test Console)

1. **اتبع الخطوات التالية:**
   - تأكد من أن XAMPP Control Panel مفتوح وـ Apache مشغّل
   - افتح متصفح جديد واذهب إلى: `http://localhost/dashbord/test-api.html`
   
2. **في صفحة الاختبار:**
   - اضغط **"Test Health Check"** للتأكد من الاتصال
   - اضغط **"Test Login (Admin)"** لتسجيل الدخول
   - اضغط **"Run Full E2E Test"** لاختبار جميع الـ endpoints

> **ملاحظة:** إذا لم تستطع الوصول لـ `localhost/dashbord/`، اتبع الخطوات أدناه لنسخ المشروع إلى htdocs.

---

### طريقة 2️⃣: التشغيل الكامل (من الصفر)

**إذا كنت تريد بدء الكل من جديد:**

#### الخطوة 1: تشغيل XAMPP
```
1. افتح XAMPP Control Panel من: C:\xampp\xampp-control.exe
2. اضغط "Start" لـ Apache
3. اضغط "Start" لـ MySQL
4. انتظر حتى يبدآ (يجب أن يصبح الـ status أخضر)
```

#### الخطوة 2: نسخ المشروع إلى htdocs
```
انسخ المجلد: C:\Users\Alh16\Downloads\تبع حامد\مشروع التخرج
إلى: C:\xampp\htdocs\talenthub
```

#### الخطوة 3: التحقق من قاعدة البيانات
```
1. افتح PHPMyAdmin: http://localhost/phpmyadmin/
2. تسجيل الدخول: Username = root (بدون كلمة مرور)
3. انظر الـ databases على اليسار
4. تأكد من وجود database اسمه "talenthub"
5. إذا لم تكن موجودة:
   - اذهب إلى tab "SQL"
   - انسخ محتوى: C:\xampp\htdocs\talenthub\php-api\schema.sql
   - الصقه واضغط Execute
```

#### الخطوة 4: اختبار الدخول
```
1. افتح: http://localhost/talenthub/login/login.html
2. سجّل دخول بـ:
   - البريد: admin@talenthub.local
   - كلمة المرور: Admin1234
3. إذا دخلت بنجاح = كل شيء يعمل! ✅
```

---

## 📋 تفاصيل الـ API

### Endpoints الأساسية

#### Authentication
```
POST /php-api/index.php/auth/login
POST /php-api/index.php/auth/register
POST /php-api/index.php/auth/logout
GET  /php-api/index.php/health
```

#### Admin Resources
```
GET    /students          (مع pagination)
GET    /students/{id}
POST   /students          (إضافة)
PUT    /students/{id}     (تحديث)
DELETE /students/{id}     (حذف)

GET    /companies          (نفس النمط)
GET    /universities       (نفس النمط)
GET    /jobs              (نفس النمط)
GET    /skills            (نفس النمط)

GET    /dashboard         (إحصائيات)
```

### مثال على الطلب
```javascript
// GET Students
fetch('http://localhost:8080/php-api/index.php/students?page=1&limit=10', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
.then(r => r.json())
.then(data => console.log(data))
```

---

## 🧪 اختبار CRUD العمليات

### 1. إضافة طالب جديد
```javascript
POST /students
{
  "fullName": "أحمد محمد",
  "email": "ahmed@example.com",
  "universityId": "1",
  "cv": "سيرة ذاتية"
}
```

### 2. تحديث طالب
```javascript
PUT /students/{id}
{
  "fullName": "أحمد السيد",
  "cv": "سيرة جديدة"
}
```

### 3. حذف طالب
```javascript
DELETE /students/{id}
```

#### نفس النمط يحترم لـ:
- Companies
- Universities
- Jobs
- Skills

---

## 🔧 استكشاف الأخطاء

### المشكلة: "Connection refused" عند فتح Login
**الحل:**
1. تأكد من أن Apache يعمل (أخضر في XAMPP Control)
2. تأكد من أن المشروع موجود في: `C:\xampp\htdocs\talenthub\`
3. جرب: `http://localhost/talenthub/login/login.html`

### المشكلة: "Database connection failed"
**الحل:**
1. افتح XAMPP Control Panel
2. اضغط "Start" لـ MySQL
3. افتح PHPMyAdmin وتحقق من أن database موجود
4. إذا لم تكن موجودة، استورد `schema.sql` يدويًا

### المشكلة: "Invalid token" أو "Unauthorized"
**الحل:**
1. تأكد من تسجيل الدخول مولاً
2. استخدام الـ token المُرجع من تسجيل الدخول
3. أرسل: `Authorization: Bearer TOKEN_HERE` في رؤوس الطلب

---

## 👤 بيانات الدخول

### Full Admin Account
```
Email: admin@talenthub.local
Password: Admin1234
```

---

## 📁 هيكل الملفات

```
مشروع التخرج/
├── login/
│   ├── login.html       (صفحة الدخول)
│   ├── login.css
│   └── register.html    (صفحة التسجيل)
├── dashbord/
│   ├── dashbord.html    (لوحة التحكم الرئيسية)
│   ├── api.js           (مشترك - الدوال الـ API)
│   ├── admin-students.html
│   ├── admin-companies.html
│   ├── admin-universities.html
│   ├── admin-jobs.html
│   ├── admin-skills.html
│   └── test-api.html    ⭐ (أداة الاختبار)
├── php-api/
│   ├── index.php        (الـ API كاملة)
│   ├── config/
│   │   └── config.php   (إعدادات الـ Database)
│   └── schema.sql       (قاعدة البيانات)
├── style.css
├── index.html           (الصفحة الرئيسية)
└── ui-controls.js       (مشترك)
```

---

## ✨ التالي (Optional Enhancements)

بعد التأكد من أن كل شيء يعمل:

- [ ] إضافة صفحة "Add New Student" مع form
- [ ] إضافة صفحة "Edit Student" مع form
- [ ] إضافة Sweet Alert للتأكيد قبل الحذف
- [ ] تحسين error handling والرسائل
- [ ] إضافة loading spinners
- [ ] تحسين التصميم والـ responsive design
- [ ] إضافة export/import للـ Excel
- [ ] إضافة تصفية وتصنيف متقدمة

---

## 📞 الملاحظات المهمة

⚠️ **لا تنسى تشغيل Apache و MySQL قبل الاختبار**
⚠️ **كل الـ CRUD operations تتطلب Admin Authorization/Token**
⚠️ **هذا المسار بديل عن Node.js؛ لا تخلط بين endpoint الخاصة بـ PHP و endpoint الخاصة بـ Node في نفس جلسة الاختبار**

---

## 🎉 النجاح!

إذا استطعت تسجيل الدخول بنجاح وشفت Dashboard، فأنت:
- ✅ تملك database متصلة
- ✅ Apache يعمل
- ✅ PHP يعمل
- ✅ الـ Frontend موصول بـ Backend

**الآن يمكنك البدء في اختبار جميع العمليات الـ CRUD!** 🚀

