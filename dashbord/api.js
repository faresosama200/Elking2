/* ======================================
   TalentHub Multi-Role — Shared API
   api.js  (loaded by all dashboard pages)
   ====================================== */

/* Detect dashboard location and resolve the PHP API across common dev setups. */
const dashboardDepth = window.location.pathname.includes('/dashbord/admin/') ? '../..' :
                      window.location.pathname.includes('/dashbord/') ? '../..' : '.';
const API_CACHE_KEY = "th_api_base";
const API_OVERRIDE_KEY = "th_api_override";
let resolvedApiBasePromise;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLocalStaticDev() {
  return window.location.hostname === "127.0.0.1"
    && window.location.port === "5500";
}

function isGitHubPages() {
  return window.location.hostname === "faresosama200.github.io";
}

// Production backend URL on Render.com
const RENDER_API_URL = "https://backend-production-dc0f.up.railway.app/api";

function getExplicitApiBase() {
  const byQuery = new URLSearchParams(window.location.search).get("api");
  const byWindow = window.TALENTHUB_API_BASE;
  const byStorage = localStorage.getItem(API_OVERRIDE_KEY);
  const explicit = normalizeApiBase(byQuery || byWindow || byStorage);

  if (!byQuery && isLocalStaticDev() && /\/php-api\/index\.php$/i.test(explicit)) {
    return "";
  }

  if (byQuery && explicit) {
    localStorage.setItem(API_OVERRIDE_KEY, explicit);
  }

  return explicit;
}

function buildApiCandidates() {
  const host = window.location.hostname || "localhost";
  const protocol = host === "127.0.0.1" ? "http:" : (window.location.protocol === "file:" ? "http:" : window.location.protocol);
  const candidates = [];
  const explicitApi = getExplicitApiBase();
  const preferNodeApi = isLocalStaticDev() && !explicitApi;

  if (explicitApi) {
    candidates.push(explicitApi);
  }

  // On GitHub Pages, always use Render.com backend first
  if (isGitHubPages()) {
    candidates.push(RENDER_API_URL);
    return unique(candidates);
  }

  if (preferNodeApi) {
    candidates.push("http://127.0.0.1:4000/api");
    candidates.push("http://localhost:4000/api");
  }

  if (window.location.protocol !== "file:") {
    candidates.push(new URL(dashboardDepth + "/php-api/index.php", window.location.href).toString());
  }

  candidates.push(protocol + "//" + host + "/talenthub/php-api/index.php");
  candidates.push(protocol + "//" + host + "/php-api/index.php");
  candidates.push("http://localhost/talenthub/php-api/index.php");
  candidates.push("http://127.0.0.1/talenthub/php-api/index.php");
  candidates.push("http://localhost:8080/php-api/index.php");
  candidates.push("http://127.0.0.1:8080/php-api/index.php");
  // Node.js backend fallback (port 4000)
  candidates.push("http://localhost:4000/api");
  candidates.push("http://127.0.0.1:4000/api");

  // Always fall back to production Railway backend
  candidates.push(RENDER_API_URL);

  return unique(candidates);
}

async function probeApi(base) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 1500) : null;

  try {
    const response = await fetch(base + "/health", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function resolveApiBase() {
  if (resolvedApiBasePromise) {
    return resolvedApiBasePromise;
  }

  resolvedApiBasePromise = (async function () {
    const candidates = buildApiCandidates();
    const cached = window.sessionStorage.getItem(API_CACHE_KEY);

    if (cached && candidates.includes(cached) && await probeApi(cached)) {
      return cached;
    }

    for (const candidate of candidates) {
      if (await probeApi(candidate)) {
        window.sessionStorage.setItem(API_CACHE_KEY, candidate);
        return candidate;
      }
    }

    window.sessionStorage.removeItem(API_CACHE_KEY);
    return candidates[0];
  }());

  return resolvedApiBasePromise;
}

const API = buildApiCandidates()[0];

function getToken() {
  return localStorage.getItem("th_token");
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("th_user") || "null");
  } catch {
    return null;
  }
}

function saveAuth(data) {
  localStorage.setItem("th_token", data.accessToken);
  localStorage.setItem("th_refresh", data.refreshToken);
  localStorage.setItem("th_user", JSON.stringify(data.user));
}

function clearAuth() {
  localStorage.removeItem("th_token");
  localStorage.removeItem("th_refresh");
  localStorage.removeItem("th_user");
}

/* ---------- Role-based navigation ---------- */
function requireAuth() {
  const user = getUser();
  const token = getToken();
  if (!token || !user) {
    window.location.href = dashboardDepth + "/login/login.html";
    return false;
  }
  return true;
}

function requireRole(requiredRole) {
  const user = getUser();
  if (!user || user.role !== requiredRole) {
    clearAuth();
    window.location.href = dashboardDepth + "/login/login.html";
    return false;
  }
  return true;
}

function requireRoles(rolesArray) {
  const user = getUser();
  if (!user || !rolesArray.includes(user.role)) {
    clearAuth();
    window.location.href = dashboardDepth + "/login/login.html";
    return false;
  }
  return true;
}

function getRoleRoute() {
  const user = getUser();
  if (!user) return dashboardDepth + "/login/login.html";
  
  const roleRoutes = {
    ADMIN: dashboardDepth + "/dashbord/admin/dashbord.html",
    STUDENT: dashboardDepth + "/dashbord/student/dashboard.html",
    COMPANY: dashboardDepth + "/dashbord/company/dashboard.html",
    UNIVERSITY: dashboardDepth + "/dashbord/university/dashboard.html"
  };
  return roleRoutes[user.role] || dashboardDepth + "/login/login.html";
}

/* ---------- Enum/Status localization ---------- */
function arStatus(value) {
  const map = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    PENDING: "قيد المراجعة",
    REVIEWED: "تمت المراجعة",
    ACCEPTED: "مقبول",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    OPEN: "مفتوحة",
    CLOSED: "مغلقة"
  };
  return map[value] || value || "-";
}

function arRole(value) {
  const map = {
    ADMIN: "مدير",
    STUDENT: "طالب",
    COMPANY: "شركة",
    UNIVERSITY: "جامعة"
  };
  return map[value] || value || "-";
}

function arJobType(value) {
  const map = {
    FULL_TIME: "دوام كامل",
    PART_TIME: "دوام جزئي",
    INTERNSHIP: "تدريب",
    REMOTE: "عن بعد"
  };
  return map[value] || value || "-";
}

/* ---------- Authenticated fetch ---------- */
let _refreshing = null;

async function _doRefresh() {
  const refresh = localStorage.getItem("th_refresh");
  if (!refresh) throw new Error("no_refresh");
  const apiBase = await resolveApiBase();
  const res = await fetch(apiBase + "/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh })
  });
  if (!res.ok) {
    clearAuth();
    window.location.href = dashboardDepth + "/login/login.html";
    throw new Error("refresh_failed");
  }
  const data = await res.json();
  localStorage.setItem("th_token", data.accessToken);
  if (data.refreshToken) localStorage.setItem("th_refresh", data.refreshToken);
  return data.accessToken;
}

async function apiFetch(path, options = {}) {
  const apiBase = await resolveApiBase();
  let token = getToken();
  const response = await fetch(apiBase + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    ...options
  });

  if (response.status === 401) {
    // Try refresh once
    try {
      if (!_refreshing) _refreshing = _doRefresh();
      token = await _refreshing;
    } finally {
      _refreshing = null;
    }
    const retry = await fetch(apiBase + path, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      ...options
    });
    if (!retry.ok) {
      const data = await retry.json().catch(() => ({}));
      const error = new Error(data.message || "فشل تنفيذ الطلب");
      error.status = retry.status;
      throw error;
    }
    return retry.json();
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || "فشل تنفيذ الطلب");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/* ---------- Toast ---------- */
function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = Object.assign(document.createElement("div"), { id: "toast-container" });
    document.body.appendChild(container);
  }
  const toast = Object.assign(document.createElement("div"), {
    className: "toast-msg " + type,
    textContent: message
  });
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* ---------- Logout ---------- */
function requireAdmin() {
  /* For backward compatibility - admin pages should use requireRole('ADMIN') */
  return requireRole('ADMIN');
}

function logout() {
  apiFetch("/auth/logout", { method: "POST" }).finally(() => {
    clearAuth();
    window.location.href = dashboardDepth + "/login/login.html";
  });
}
