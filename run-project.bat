@echo off
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

REM === Check Prisma Client ===
if not exist "%ROOT%backend\node_modules\.prisma" (
	echo [INFO] توليد Prisma Client ...
	call npm --prefix backend run prisma:generate || (
		echo [خطأ] فشل توليد Prisma Client.
		pause
		exit /b 1
	)
)

REM === Start backend API ===
echo Starting backend API on http://localhost:4000 ...
start "TalentHub API" cmd /k "cd /d ""%ROOT%"" && npm run dev:api"

REM === Start frontend server ===
echo Starting frontend server on http://127.0.0.1:5500 ...
start "TalentHub Frontend" cmd /k "cd /d ""%ROOT%"" && npx --yes http-server@14.1.1 -p 5500 -c-1"

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
