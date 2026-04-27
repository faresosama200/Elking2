@echo off
:: تشغيل المشروع كاملاً - Backend + Frontend
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo =====================================
echo   TalentHub Quick Run
echo =====================================
echo.

REM === Check backend dependencies ===
if not exist "%ROOT%backend\node_modules" (
	echo [INFO] تثبيت حزم الخادم الخلفي لأول مرة ...
	call npm --prefix backend install || (
		echo [خطأ] فشل تثبيت الحزم. تحقق من اتصال الإنترنت أو صلاحيات النظام.
		pause
		exit /b 1
	)
)

REM === Check backend .env file ===
if not exist "%ROOT%backend\.env" (
	echo [تحذير] ملف البيئة backend\.env غير موجود!
	echo يرجى نسخ backend\.env.example إلى backend\.env وضبط الإعدادات قبل التشغيل الكامل.
	echo سيتم المتابعة، لكن قد تواجه أخطاء مصادقة أو إعدادات.
	pause
)

REM === Generate Prisma Client ===
echo [INFO] تجهيز قاعدة البيانات ...
cd /d "%ROOT%backend"
call node node_modules/prisma/build/index.js generate >nul 2>&1
call node node_modules/prisma/build/index.js db push --accept-data-loss >nul 2>&1
call node src/seed.js 2>&1
cd /d "%ROOT%"

REM === Start backend API ===
echo Starting backend API on http://localhost:4000 ...
start "TalentHub API" cmd /k "cd /d ""%ROOT%backend"" && node src/server.js"

REM === Start frontend server ===
echo Starting frontend server on http://127.0.0.1:5500 ...
start "TalentHub Frontend" cmd /k "cd /d ""%ROOT%"" && node serve-frontend.js"

echo Waiting a few seconds before opening browser...
timeout /t 4 /nobreak >nul

REM === Open login page ===
start "" "http://127.0.0.1:5500/login/login.html"

echo.
echo [تم التشغيل] المشروع يعمل الآن. أبقِ نوافذ الأوامر مفتوحة.
echo لإيقاف المشروع، أغلق نافذتي "TalentHub API" و"TalentHub Frontend".
echo إذا ظهرت لك رسائل خطأ أعلاه، راجع التعليمات في README.md.
echo.
pause
