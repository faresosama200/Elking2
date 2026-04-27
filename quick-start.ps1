param(
  [switch]$OpenAllDashboards
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) {
  Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
  Write-Host "[OK]   $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
  Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Test-Endpoint($url) {
  try {
    $null = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
    return $true
  } catch {
    return $false
  }
}

function Wait-Endpoint($url, $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Endpoint $url) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root "backend"
$logsPath = Join-Path $root ".runtime-logs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed or missing from PATH."
}

if (-not (Test-Path $logsPath)) {
  New-Item -ItemType Directory -Path $logsPath | Out-Null
}

Write-Info "TalentHub quick start"
Write-Info "Project root: $root"

if (-not (Test-Path (Join-Path $backendPath "node_modules"))) {
  Write-Info "Installing backend dependencies..."
  npm --prefix backend install
}

$envFile = Join-Path $backendPath ".env"
$envExample = Join-Path $backendPath ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Copy-Item $envExample $envFile
  Write-Warn "Created backend/.env from .env.example"
}

Write-Info "Preparing database and seed data..."
Push-Location $backendPath
try {
  # Skip generate if backend is already running (DLL locked)
  if (-not (Test-Endpoint "http://127.0.0.1:4000/api/health")) {
    node node_modules/prisma/build/index.js generate 2>$null | Out-Null
    node node_modules/prisma/build/index.js db push --accept-data-loss 2>$null | Out-Null
  }
  node src/seed.js
} finally {
  Pop-Location
}

$backendHealth = "http://127.0.0.1:4000/api/health"
$frontendLogin = "http://127.0.0.1:5500/login/login.html"

if (Test-Endpoint $backendHealth) {
  Write-Ok "Backend already running on :4000"
} else {
  $backendOut = Join-Path $logsPath "backend.out.log"
  $backendErr = Join-Path $logsPath "backend.err.log"
  Write-Info "Starting backend..."
  Start-Process -FilePath node -ArgumentList "src/server.js" -WorkingDirectory $backendPath -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr | Out-Null
}

if (Test-Endpoint $frontendLogin) {
  Write-Ok "Frontend already running on :5500"
} else {
  $frontOut = Join-Path $logsPath "frontend.out.log"
  $frontErr = Join-Path $logsPath "frontend.err.log"
  Write-Info "Starting frontend..."
  Start-Process -FilePath node -ArgumentList "serve-frontend.js" -WorkingDirectory $root -RedirectStandardOutput $frontOut -RedirectStandardError $frontErr | Out-Null
}

if (-not (Wait-Endpoint $backendHealth 20)) {
  Write-Warn "Backend did not answer /api/health within timeout."
}

if (-not (Wait-Endpoint $frontendLogin 20)) {
  throw "Frontend did not serve login page in time. Check .runtime-logs/frontend.err.log"
}

Start-Process $frontendLogin | Out-Null
Write-Ok "Login page opened."

if ($OpenAllDashboards) {
  Start-Process "http://127.0.0.1:5500/dashbord/admin/dashbord.html" | Out-Null
  Start-Process "http://127.0.0.1:5500/dashbord/student/dashboard.html" | Out-Null
  Start-Process "http://127.0.0.1:5500/dashbord/company/dashboard.html" | Out-Null
  Start-Process "http://127.0.0.1:5500/dashbord/university/dashboard.html" | Out-Null
}

Write-Host ""
Write-Host "=========== Demo Accounts ===========" -ForegroundColor Magenta
Write-Host "Admin:      admin@talenthub.local / Admin1234"
Write-Host "Student:    student1@talenthub.local / Student1"
Write-Host "Company:    comp1@talenthub.local / Comp1234"
Write-Host "University: uni1@talenthub.local / Uni12345"
Write-Host "=====================================" -ForegroundColor Magenta
