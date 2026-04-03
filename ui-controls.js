(function () {
  const LANG_KEY = "th_lang";
  const THEME_KEY = "th_theme";
  const ROOT_LANG = "ar";

  let shell;
  let trigger;
  let panel;
  let langBadge;
  let themeBadge;
  let panelOpen = false;

  function getLang() {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ar";
  }

  function setLang(lang) {
    const next = lang === "en" ? "en" : "ar";
    localStorage.setItem(LANG_KEY, next);
    applyDirection(next);
    applyGoogleTranslate(next);
    renderState();
  }

  function applyDirection(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
  }

  function getSavedTheme() {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  }

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function getTheme() {
    return getSavedTheme() || getSystemTheme();
  }

  function setTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    renderState();
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("th-theme-dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }

  function ensureStyle() {
    if (document.getElementById("th-ui-controls-style")) return;

    const style = document.createElement("style");
    style.id = "th-ui-controls-style";
    style.textContent = ""
      + ".th-ui-shell{position:fixed;right:18px;bottom:18px;z-index:99999;font-family:inherit}"
      + ".th-ui-trigger{display:inline-flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:10px 14px;background:linear-gradient(135deg,#0f8b8d,#2d4e8c);color:#fff;font-weight:800;box-shadow:0 14px 30px rgba(0,0,0,.23);cursor:pointer;transition:all .2s ease}"
      + ".th-ui-trigger:hover{transform:translateY(-1px);box-shadow:0 18px 34px rgba(0,0,0,.28)}"
      + ".th-ui-dot{width:6px;height:6px;border-radius:50%;background:#9efff0}"
      + ".th-ui-panel{position:absolute;right:0;bottom:56px;min-width:230px;background:#fff;border:1px solid #dbe5f2;border-radius:14px;box-shadow:0 22px 38px rgba(12,31,51,.2);padding:10px;opacity:0;pointer-events:none;transform:translateY(8px) scale(.98);transition:all .18s ease}"
      + ".th-ui-shell.open .th-ui-panel{opacity:1;pointer-events:auto;transform:translateY(0) scale(1)}"
      + ".th-ui-row{display:flex;align-items:center;justify-content:space-between;padding:8px 6px;margin-bottom:6px}"
      + ".th-ui-row:last-child{margin-bottom:0}"
      + ".th-ui-label{font-weight:800;color:#16354d;font-size:13px}"
      + ".th-ui-actions{display:flex;gap:6px}"
      + ".th-ui-btn{border:1px solid #cdd8e8;background:#f4f8fd;color:#1b3852;padding:6px 10px;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer}"
      + ".th-ui-btn:hover{background:#e9f2fc}"
      + ".th-ui-btn.active{background:#d7f2ee;border-color:#8bd0c8;color:#0d6265}"
      + ".th-ui-hint{padding:2px 6px 0;color:#73879e;font-size:11px}"
      + ".goog-te-banner-frame{display:none !important}"
      + ".goog-te-banner-frame.skiptranslate{display:none !important}"
      + "iframe.goog-te-banner-frame{display:none !important}"
      + "body > .skiptranslate{display:none !important}"
      + "html.translated-ltr,html.translated-rtl{margin-top:0 !important;padding-top:0 !important}"
      + "#goog-gt-tt{display:none !important}"
      + "body{top:0 !important;position:static !important}"

      + ".th-theme-dark body{background:#0f1724!important;color:#e6edf6!important}"
      + ".th-theme-dark .navbar,.th-theme-dark nav{background:#111d2c!important;color:#e6edf6!important;border-color:#24364d!important}"
      + ".th-theme-dark .card,.th-theme-dark .card-clean,.th-theme-dark .auth-card,.th-theme-dark .modal-content,.th-theme-dark .table,.th-theme-dark .table-responsive{background:#142233!important;color:#e6edf6!important;border-color:#29415c!important}"
      + ".th-theme-dark .table th,.th-theme-dark .table td{color:#e6edf6!important;border-color:#2a3d55!important}"
      + ".th-theme-dark .form-control,.th-theme-dark .form-select{background:#0f1b2b!important;color:#ecf4ff!important;border-color:#304861!important}"
      + ".th-theme-dark .form-control::placeholder{color:#9cb0c8!important}"
      + ".th-theme-dark .btn-outline-secondary,.th-theme-dark .btn-outline-primary,.th-theme-dark .btn-outline-danger,.th-theme-dark .btn-outline-success{border-color:#5f7b9e!important;color:#d7e5f7!important}"
      + ".th-theme-dark .text-muted{color:#9fb3c8!important}"
      + ".th-theme-dark .footer{background:#111d2c!important;color:#9fb3c8!important}"
      + ".th-theme-dark a{color:#8cc5ff}"
      + "@media (max-width:576px){"
      + ".th-ui-shell{right:10px;bottom:10px}"
      + ".th-ui-trigger{width:42px;height:42px;padding:0;justify-content:center;gap:0;border-radius:50%;font-size:0}"
      + ".th-ui-trigger .th-ui-dot{display:none}"
      + ".th-ui-trigger span:nth-child(2),.th-ui-trigger span:nth-child(3){display:none}"
      + ".th-ui-trigger span:first-child{font-size:18px;line-height:1}"
      + ".th-ui-panel{right:0;bottom:50px;min-width:178px;max-width:78vw;padding:8px;border-radius:12px}"
      + ".th-ui-row{padding:6px 4px;margin-bottom:4px}"
      + ".th-ui-label{font-size:11px}"
      + ".th-ui-actions{gap:4px;flex-wrap:wrap;justify-content:flex-end}"
      + ".th-ui-btn{padding:5px 8px;font-size:11px;border-radius:8px}"
      + ".th-ui-hint{font-size:10px;padding:2px 4px 0}"
      + "}";

    document.head.appendChild(style);
  }

  function ensureGoogleContainer() {
    if (document.getElementById("google_translate_element")) return;
    const holder = document.createElement("div");
    holder.id = "google_translate_element";
    holder.style.display = "none";
    document.body.appendChild(holder);
  }

  function ensureGoogleScript() {
    if (window.google && window.google.translate && window.google.translate.TranslateElement) return;
    if (document.getElementById("th-ui-google-script")) return;

    window.thInitGoogleTranslate = function () {
      new window.google.translate.TranslateElement(
        { pageLanguage: ROOT_LANG, autoDisplay: false },
        "google_translate_element"
      );
      applyGoogleTranslate(getLang());
    };

    const script = document.createElement("script");
    script.id = "th-ui-google-script";
    script.src = "https://translate.google.com/translate_a/element.js?cb=thInitGoogleTranslate";
    document.body.appendChild(script);
  }

  function setComboValue(lang) {
    const combo = document.querySelector(".goog-te-combo");
    if (!combo) return false;
    combo.value = lang;
    combo.dispatchEvent(new Event("change"));
    return true;
  }

  function applyGoogleTranslate(lang) {
    const target = lang === "en" ? "en" : "ar";
    const cookieVal = "/" + ROOT_LANG + "/" + target;
    document.cookie = "googtrans=" + cookieVal + ";path=/";

    if (setComboValue(target)) return;

    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      if (setComboValue(target) || attempts > 24) {
        clearInterval(timer);
      }
    }, 140);
  }

  function createButton(text, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "th-ui-btn";
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function createRow(labelText, buttons) {
    const row = document.createElement("div");
    row.className = "th-ui-row";

    const label = document.createElement("div");
    label.className = "th-ui-label";
    label.textContent = labelText;

    const actions = document.createElement("div");
    actions.className = "th-ui-actions";
    buttons.forEach(function (b) { actions.appendChild(b); });

    row.appendChild(label);
    row.appendChild(actions);
    return row;
  }

  function createUi() {
    shell = document.createElement("div");
    shell.className = "th-ui-shell";

    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "th-ui-trigger";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "إعدادات العرض واللغة");

    const icon = document.createElement("span");
    icon.textContent = "⚙";
    langBadge = document.createElement("span");
    themeBadge = document.createElement("span");
    const dot = document.createElement("span");
    dot.className = "th-ui-dot";

    trigger.appendChild(icon);
    trigger.appendChild(langBadge);
    trigger.appendChild(themeBadge);
    trigger.appendChild(dot);

    panel = document.createElement("div");
    panel.className = "th-ui-panel";
    panel.setAttribute("role", "menu");

    const arBtn = createButton("العربية", function () { setLang("ar"); });
    const enBtn = createButton("English", function () { setLang("en"); });
    const lightBtn = createButton("عادي", function () { setTheme("light"); });
    const darkBtn = createButton("داكن", function () { setTheme("dark"); });

    arBtn.dataset.lang = "ar";
    enBtn.dataset.lang = "en";
    lightBtn.dataset.theme = "light";
    darkBtn.dataset.theme = "dark";

    panel.appendChild(createRow("اللغة", [arBtn, enBtn]));
    panel.appendChild(createRow("الوضع", [lightBtn, darkBtn]));

    const hint = document.createElement("div");
    hint.className = "th-ui-hint";
    hint.textContent = "Alt + L للغة | Alt + D للوضع";
    panel.appendChild(hint);

    shell.appendChild(trigger);
    shell.appendChild(panel);
    document.body.appendChild(shell);

    trigger.addEventListener("click", function () {
      panelOpen = !panelOpen;
      shell.classList.toggle("open", panelOpen);
      trigger.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    });
  }

  function markActive() {
    const lang = getLang();
    const theme = getTheme();

    const allLang = panel.querySelectorAll("[data-lang]");
    allLang.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    const allTheme = panel.querySelectorAll("[data-theme]");
    allTheme.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });
  }

  function renderState() {
    const lang = getLang();
    const theme = getTheme();
    langBadge.textContent = lang === "ar" ? "AR" : "EN";
    themeBadge.textContent = theme === "dark" ? "☾" : "☀";
    markActive();
  }

  function closePanel() {
    panelOpen = false;
    shell.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  }

  function wireEvents() {
    document.addEventListener("click", function (e) {
      if (!panelOpen || !shell) return;
      if (!shell.contains(e.target)) closePanel();
    });

    document.addEventListener("keydown", function (e) {
      if (e.altKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        setLang(getLang() === "ar" ? "en" : "ar");
        closePanel();
        return;
      }

      if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setTheme(getTheme() === "dark" ? "light" : "dark");
        closePanel();
        return;
      }

      if (e.key === "Escape" && panelOpen) closePanel();
    });

    if (window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", function () {
        if (!getSavedTheme()) {
          applyTheme(getSystemTheme());
          renderState();
        }
      });
    }
  }

  function init() {
    ensureStyle();
    ensureGoogleContainer();
    ensureGoogleScript();
    createUi();
    wireEvents();

    applyDirection(getLang());
    applyGoogleTranslate(getLang());
    applyTheme(getTheme());
    renderState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
