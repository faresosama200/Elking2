/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('@playwright/test');

const apiBase = 'http://localhost:8080/php-api/index.php';
const webBase = 'http://localhost:8080';
const keepData = process.argv.includes('--keep-data');

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch (_err) {
    data = null;
  }
  return { res, data };
}

function randomEmail(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@mail.com`;
}

async function registerAndLogin(role) {
  const email = randomEmail(`uat_${role.toLowerCase()}`);
  const password = `Uat${role}123`;
  const payload = {
    fullName: `UAT ${role}`,
    email,
    password,
    role,
  };

  if (role === 'COMPANY') payload.companyName = 'UAT Company';
  if (role === 'UNIVERSITY') payload.universityName = 'UAT University';

  const register = await requestJson(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!register.res.ok) {
    throw new Error(`Register ${role} failed: HTTP ${register.res.status} ${JSON.stringify(register.data || {})}`);
  }

  const login = await requestJson(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!login.res.ok || !login.data || !login.data.accessToken) {
    throw new Error(`Login ${role} failed: HTTP ${login.res.status}`);
  }

  return { token: login.data.accessToken, user: login.data.user, email };
}

async function loginAdmin() {
  const login = await requestJson(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@talenthub.local',
      password: 'Admin1234',
    }),
  });

  if (!login.res.ok || !login.data || !login.data.accessToken) {
    throw new Error(`Admin login failed: HTTP ${login.res.status}`);
  }

  return { token: login.data.accessToken, user: login.data.user, email: 'admin@talenthub.local' };
}

async function runRoleVisual(browser, roleName, auth, pagePath, screenshotDir) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const responseErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      responseErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  await page.goto(`${webBase}/login/login.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('th_token', token);
    localStorage.setItem('th_user', JSON.stringify(user));
  }, { token: auth.token, user: auth.user });

  const targetUrl = `${webBase}${pagePath}`;
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const pngPath = path.join(screenshotDir, `${roleName.toLowerCase()}.png`);
  await page.screenshot({ path: pngPath, fullPage: true });

  const currentUrl = page.url();
  const hasRedirectIssue = !currentUrl.includes(pagePath);
  const criticalResponseErrors = responseErrors.filter((line) => !line.includes('/favicon.ico'));
  const criticalConsoleErrors = consoleErrors.filter((line) => !line.includes('Failed to load resource: the server responded with a status of 404'));

  await context.close();

  return {
    role: roleName,
    targetUrl,
    currentUrl,
    screenshot: pngPath,
    status: hasRedirectIssue || criticalResponseErrors.length || criticalConsoleErrors.length || pageErrors.length ? 'FAIL' : 'PASS',
    consoleErrors: criticalConsoleErrors,
    pageErrors,
    responseErrors: criticalResponseErrors,
  };
}

function cleanupTestUsers(emails) {
  const filtered = emails.filter((email) => email && email !== 'admin@talenthub.local');
  if (!filtered.length) {
    return { skipped: true, reason: 'no_test_users' };
  }

  const mysqlExe = 'C:/xampp/mysql/bin/mysql.exe';
  const emailList = filtered.map((email) => `'${email}'`).join(',');
  const sql = `DELETE FROM talenthub.users WHERE email IN (${emailList});`;

  try {
    execFileSync(mysqlExe, ['-u', 'root', '-e', sql], { stdio: 'pipe' });
    return { skipped: false, deletedEmails: filtered.length };
  } catch (error) {
    return {
      skipped: false,
      error: error && error.message ? error.message : 'cleanup_failed',
    };
  }
}

async function main() {
  const health = await requestJson(`${apiBase}/health`);
  if (!health.res.ok) {
    throw new Error('PHP API is not reachable on localhost:8080');
  }

  const screenshotDir = path.join(process.cwd(), 'uat-snapshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const authMap = {
    ADMIN: await loginAdmin(),
    STUDENT: await registerAndLogin('STUDENT'),
    COMPANY: await registerAndLogin('COMPANY'),
    UNIVERSITY: await registerAndLogin('UNIVERSITY'),
  };

  const testEmails = [
    authMap.STUDENT.email,
    authMap.COMPANY.email,
    authMap.UNIVERSITY.email,
  ];

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const results = [];
    results.push(await runRoleVisual(browser, 'ADMIN', authMap.ADMIN, '/dashbord/admin/dashbord.html', screenshotDir));
    results.push(await runRoleVisual(browser, 'STUDENT', authMap.STUDENT, '/dashbord/student/dashboard.html', screenshotDir));
    results.push(await runRoleVisual(browser, 'COMPANY', authMap.COMPANY, '/dashbord/company/dashboard.html', screenshotDir));
    results.push(await runRoleVisual(browser, 'UNIVERSITY', authMap.UNIVERSITY, '/dashbord/university/dashboard.html', screenshotDir));

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        passed: results.filter((r) => r.status === 'PASS').length,
        failed: results.filter((r) => r.status === 'FAIL').length,
      },
      results,
      testUsers: Object.fromEntries(Object.entries(authMap).map(([k, v]) => [k, v.email])),
      cleanup: keepData ? { skipped: true, reason: 'keep-data-flag' } : cleanupTestUsers(testEmails),
    };

    const reportPath = path.join(process.cwd(), 'uat-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`UAT_VISUAL_SUMMARY passed=${report.summary.passed} failed=${report.summary.failed} report=${reportPath}`);
    for (const item of results) {
      console.log(`UAT_ROLE role=${item.role} status=${item.status} screenshot=${item.screenshot}`);
      if (item.consoleErrors.length) {
        console.log(`UAT_ROLE_ERRORS role=${item.role} console=${item.consoleErrors.join(' | ')}`);
      }
      if (item.pageErrors.length) {
        console.log(`UAT_ROLE_ERRORS role=${item.role} page=${item.pageErrors.join(' | ')}`);
      }
      if (item.responseErrors.length) {
        console.log(`UAT_ROLE_ERRORS role=${item.role} response=${item.responseErrors.join(' | ')}`);
      }
    }

    if (report.cleanup.skipped) {
      console.log(`UAT_CLEANUP skipped=${report.cleanup.reason}`);
    } else if (report.cleanup.error) {
      console.log(`UAT_CLEANUP status=FAIL error=${report.cleanup.error}`);
    } else {
      console.log(`UAT_CLEANUP status=OK deletedEmails=${report.cleanup.deletedEmails}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('UAT_VISUAL_FAILED', err.message);
  process.exit(1);
});
