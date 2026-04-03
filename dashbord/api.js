/* ======================================
   TalentHub Multi-Role — Shared API
   api.js  (loaded by all dashboard pages)
   ====================================== */

/* Detect dashboard location and set API path accordingly */
const dashboardDepth = window.location.pathname.includes('/dashbord/admin/') ? '../..' :
                      window.location.pathname.includes('/dashbord/') ? '../..' : '.';

const API =
  window.location.protocol === "file:"
    ? "http://localhost:8080/php-api/index.php"
    : new URL(dashboardDepth + "/php-api/index.php", window.location.href).toString();

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
    INTERNSHIP: "تدريب"
  };
  return map[value] || value || "-";
}

/* ---------- Authenticated fetch ---------- */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    ...options
  });

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
