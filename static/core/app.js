(() => {
  "use strict";

  const DB_NAME = "pontual-device-data";
  const DB_VERSION = 1;
  const STORE_NAME = "snapshots";
  const SNAPSHOT_ID = "current";
  const LEGACY_KEY = "@pontual_local_database_v1";
  const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const SHIFT_NAMES = ["Matutino", "Especial", "Vespertino", "Noturno"];
  const L = window.PontualLib;

  const main = document.getElementById("main-content");
  const semesterSelect = document.getElementById("active-semester");
  const dialog = document.getElementById("class-dialog");
  const classForm = document.getElementById("class-form");
  const toast = document.getElementById("toast");
  let database;
  let state;
  let activePage = "home";
  let selectedDay = new Date().getDay();
  let editingInstitutionId = "";
  let pendingInstitutionLogo = "";
  let toastTimer;
  let scheduleView = "list";
  let diaryTurma = "";
  let diaryFilter = "all";
  let storagePersisted = null;
  let conflictMap = {};

  const defaultSettings = () => ({ remindersEnabled: false, reminderLead: 5, backupReminderDays: 30, lastBackupAt: "" });

  const emptySnapshot = () => ({
    activeSemester: "2027/1",
    semesters: ["2027/1"],
    userProfile: { name: "", role: "", photoUri: "" },
    institutions: [],
    pontoRules: [],
    classes: [],
    pontoLogs: [],
    diary: [],
    settings: defaultSettings(),
  });

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function makeId(prefix) {
    const suffix = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${suffix}`;
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function validateSnapshot(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      typeof value.activeSemester === "string" &&
      Array.isArray(value.semesters) &&
      value.userProfile &&
      typeof value.userProfile === "object" &&
      Array.isArray(value.institutions) &&
      Array.isArray(value.pontoRules) &&
      Array.isArray(value.classes) &&
      Array.isArray(value.pontoLogs)
    );
  }

  function normalizeSnapshot(value) {
    if (!validateSnapshot(value)) {
      throw new Error("O arquivo não contém um backup Pontual válido.");
    }
    const validString = (item) => typeof item === "string";
    const validClass = (item) =>
      item && typeof item === "object" &&
      validString(item.id) && validString(item.semester) &&
      validString(item.institutionId) && Number.isInteger(Number(item.dayOfWeek)) &&
      Number(item.dayOfWeek) >= 0 && Number(item.dayOfWeek) <= 6 &&
      SHIFT_NAMES.includes(item.shift) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime) &&
      validString(item.subject) && validString(item.campus) &&
      ["Sala", "Laboratório"].includes(item.roomType) && validString(item.roomNumber);
    const validInstitution = (item) =>
      item && typeof item === "object" && validString(item.id) &&
      validString(item.name) && validString(item.logoUri) &&
      validString(item.defaultPontoUrl);
    const validRule = (item) =>
      item && typeof item === "object" && validString(item.id) &&
      validString(item.institutionId) &&
      (item.dayOfWeek === "ALL" || /^[0-6]$/.test(String(item.dayOfWeek))) &&
      (item.shift === "ALL" || SHIFT_NAMES.includes(item.shift)) &&
      validString(item.url) && Boolean(safeHttpUrl(item.url));
    const validLog = (item) =>
      item && typeof item === "object" && validString(item.id) &&
      validString(item.timestamp) && validString(item.institutionName) &&
      validString(item.shift) && validString(item.phase) &&
      validString(item.subject) && validString(item.campus) && validString(item.url);
    const validDiary = (item) =>
      item && typeof item === "object" && validString(item.id) && validString(item.semester) &&
      validString(item.institutionId) && validString(item.subject) && Boolean(L.parseISODate(item.date)) &&
      L.DIARY_STATUSES.some((status) => status.value === item.status) &&
      validString(item.content ?? "") && validString(item.notes ?? "");
    if (
      !value.semesters.every(validString) ||
      !value.institutions.every(validInstitution) ||
      !value.pontoRules.every(validRule) ||
      !value.classes.every(validClass) ||
      !value.pontoLogs.every(validLog) ||
      !(value.diary ?? []).every(validDiary)
    ) {
      throw new Error("O backup está incompleto ou contém registros inválidos.");
    }
    return {
      activeSemester: value.activeSemester || value.semesters[0] || "2027/1",
      semesters: [...new Set(value.semesters.filter((item) => typeof item === "string" && item.trim()))],
      userProfile: {
        name: typeof value.userProfile.name === "string" ? value.userProfile.name : "",
        role: typeof value.userProfile.role === "string" ? value.userProfile.role : "",
        photoUri: typeof value.userProfile.photoUri === "string" ? value.userProfile.photoUri : "",
      },
      institutions: value.institutions,
      pontoRules: value.pontoRules,
      classes: value.classes,
      pontoLogs: value.pontoLogs,
      diary: L.renumberAll((value.diary ?? []).map((item) => ({
        classId: "", startTime: "", periods: 1, ...item,
        content: item.content ?? "", notes: item.notes ?? "", periods: Math.min(8, Math.max(1, Number(item.periods) || 1)),
      }))),
      settings: {
        ...defaultSettings(),
        ...(value.settings && typeof value.settings === "object" ? {
          remindersEnabled: value.settings.remindersEnabled === true,
          reminderLead: [5, 10, 15].includes(Number(value.settings.reminderLead)) ? Number(value.settings.reminderLead) : 5,
          backupReminderDays: Number(value.settings.backupReminderDays) > 0 ? Number(value.settings.backupReminderDays) : 30,
          lastBackupAt: typeof value.settings.lastBackupAt === "string" ? value.settings.lastBackupAt : "",
        } : {}),
      },
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("Este navegador não oferece o armazenamento local necessário."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Não foi possível abrir o banco local."));
      request.onblocked = () => reject(new Error("Feche outras abas do Pontual para atualizar o armazenamento."));
    });
  }

  function readStoredSnapshot() {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_ID);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error || new Error("Não foi possível ler os dados locais."));
    });
  }

  function writeStoredSnapshot(value) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ id: SNAPSHOT_ID, value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Não foi possível salvar neste dispositivo."));
      transaction.onabort = () => reject(transaction.error || new Error("O salvamento local foi cancelado."));
    });
  }

  async function persistState() {
    await writeStoredSnapshot(state);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3400);
  }

  async function changeState(mutator, successMessage) {
    const nextState = structuredClone(state);
    mutator(nextState);
    state = nextState;
    render();
    scheduleReminders();
    try {
      await persistState();
      if (successMessage) showToast(successMessage);
    } catch (error) {
      showToast(`Alteração visível, mas não salva: ${error.message}`);
    }
  }

  function setTheme(theme) {
    if (!["light", "dark", "rubro"].includes(theme)) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pontual-theme", theme);
    } catch (error) {
      showToast(`Não foi possível guardar a preferência visual: ${error.message}`);
    }
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    });
    document.querySelector('meta[name="theme-color"]').content =
      theme === "light" ? "#f2f2f7" : theme === "dark" ? "#101113" : "#0b0b0d";
  }

  function timeToMinutes(value) {
    const [hour, minute] = String(value || "00:00").split(":").map(Number);
    return (hour || 0) * 60 + (minute || 0);
  }

  function minutesToTime(value) {
    const normalized = ((value % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  }

  function evaluateClass(item, currentMinutes) {
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    const inOpen = start - 15;
    const inClose = start + 15;
    const outOpen = end - 15;
    const outClose = end + 15;
    const windows = {
      inOpen: minutesToTime(inOpen),
      inClose: minutesToTime(inClose),
      outOpen: minutesToTime(outOpen),
      outClose: minutesToTime(outClose),
    };
    if (currentMinutes >= inOpen && currentMinutes <= inClose) {
      return { ...windows, phase: "Entrada", open: true, label: `Entrada aberta · ${inClose - currentMinutes} min restantes`, icon: "↗" };
    }
    if (currentMinutes >= outOpen && currentMinutes <= outClose) {
      return { ...windows, phase: "Saída", open: true, label: `Saída aberta · ${outClose - currentMinutes} min restantes`, icon: "↘" };
    }
    if (currentMinutes < inOpen) {
      return { ...windows, phase: "Pré-Aula", open: false, label: `Entrada abre às ${windows.inOpen}`, icon: "◷" };
    }
    if (currentMinutes > inClose && currentMinutes < outOpen) {
      return { ...windows, phase: "Em Aula", open: false, label: `Saída abre às ${windows.outOpen}`, icon: "▣" };
    }
    return { ...windows, phase: "Encerrada", open: false, label: `Limite de saída às ${windows.outClose}`, icon: "✓" };
  }

  function resolvePontoUrl(item) {
    const day = String(item.dayOfWeek);
    const matches = [
      (rule) => rule.institutionId === item.institutionId && rule.dayOfWeek === day && rule.shift === item.shift,
      (rule) => rule.institutionId === item.institutionId && rule.dayOfWeek === "ALL" && rule.shift === item.shift,
      (rule) => rule.institutionId === item.institutionId && rule.dayOfWeek === day && rule.shift === "ALL",
    ];
    const labels = [`Dia + turno (${item.shift})`, `Turno ${item.shift}`, `${DAY_NAMES[item.dayOfWeek] || "Dia"} · geral`];
    for (let index = 0; index < matches.length; index += 1) {
      const rule = state.pontoRules.find(matches[index]);
      if (rule && safeHttpUrl(rule.url)) return { url: safeHttpUrl(rule.url), label: labels[index] };
    }
    const institution = state.institutions.find((entry) => entry.id === item.institutionId);
    return {
      url: safeHttpUrl(institution?.defaultPontoUrl),
      label: institution ? `Padrão ${institution.name}` : "Sem link configurado",
    };
  }

  function institutionName(id) {
    return state.institutions.find((institution) => institution.id === id)?.name || "Instituição não definida";
  }

  function sortedClasses(day = null) {
    return state.classes
      .filter((item) => item.semester === state.activeSemester && (day === null || Number(item.dayOfWeek) === day))
      .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));
  }

  function renderHeader() {
    const semesters = state.semesters.length ? state.semesters : [state.activeSemester || "2027/1"];
    if (!semesters.includes(state.activeSemester)) semesters.unshift(state.activeSemester);
    semesterSelect.innerHTML = semesters
      .map((semester) => `<option value="${escapeHTML(semester)}">${escapeHTML(semester)}</option>`)
      .join("");
    semesterSelect.value = state.activeSemester;
  }

  function avatarMarkup(profile, className = "avatar") {
    if (profile.photoUri) {
      return `<span class="${className}"><img src="${escapeHTML(profile.photoUri)}" alt=""></span>`;
    }
    const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "P";
    return `<span class="${className}" aria-hidden="true">${escapeHTML(initials)}</span>`;
  }

  function renderEmpty(title, description, action = "") {
    return `<div class="empty-state"><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(description)}</p>${action ? `<div style="margin-top:13px">${action}</div>` : ""}</div></div>`;
  }

  function renderClassCard(item, actions = true, diaryShortcut = false) {
    const clash = conflictNames(item);
    const room = item.roomType === "Laboratório" ? "Laboratório" : "Sala";
    return `
      <article class="class-card">
        <div class="class-time">${escapeHTML(item.startTime)}<br>${escapeHTML(item.endTime)}</div>
        <div class="class-main">
          <h3>${escapeHTML(item.subject || "Disciplina sem nome")}</h3>
          <p>${escapeHTML(institutionName(item.institutionId))} · ${escapeHTML(item.campus || "Campus não definido")}</p>
          <div class="class-tags">
            <span class="tag">${escapeHTML(item.shift)}</span>
            <span class="tag is-accent">${escapeHTML(room)} ${escapeHTML(item.roomNumber || "—")}</span>
            ${clash.length ? `<span class="tag is-danger" title="${escapeHTML(clash.join(", "))}">Conflito de horário</span>` : ""}
          </div>
          ${diaryShortcut ? `<button type="button" class="button button-quiet button-small class-diary" data-action="add-diary" data-class-id="${escapeHTML(item.id)}" data-date="${L.toISODate(L.latestDateForWeekday(item.dayOfWeek))}">✎ Diário</button>` : ""}
        </div>
        ${actions ? `<div class="class-actions">
          <button type="button" class="icon-button" data-action="edit-class" data-id="${escapeHTML(item.id)}" aria-label="Editar ${escapeHTML(item.subject)}">✎</button>
          <button type="button" class="icon-button is-danger" data-action="delete-class" data-id="${escapeHTML(item.id)}" aria-label="Excluir ${escapeHTML(item.subject)}">×</button>
        </div>` : ""}
      </article>`;
  }

  function renderHome() {
    const now = new Date();
    const classes = sortedClasses(selectedDay);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const activeClass = classes.find((item) => {
      const evaluation = evaluateClass(item, currentMinutes);
      return evaluation.phase === "Entrada" || evaluation.phase === "Saída";
    }) || classes.find((item) => timeToMinutes(item.startTime) >= currentMinutes) || classes[0];
    const evaluation = activeClass ? evaluateClass(activeClass, currentMinutes) : null;
    const profile = state.userProfile;
    const selectedDayLabel = DAY_NAMES[selectedDay];
    const todayLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const pointLink = activeClass ? resolvePontoUrl(activeClass) : null;
    const todayClasses = classes.length
      ? `<div class="class-list">${classes.map((item) => renderClassCard(item, false, true)).join("")}</div>`
      : renderEmpty("Sem aulas neste dia", "Adicione uma aula à grade ou importe seu backup local.", `<button type="button" class="button button-secondary" data-action="add-class">Adicionar aula</button>`);

    return `
      <div class="page-stack page-home">
        <div class="page-heading">
          <div><span class="eyebrow">VISÃO DO DIA</span><h1>Olá${profile.name.trim() ? `, ${escapeHTML(profile.name.trim().split(/\s+/)[0].replace(/\.+$/, ""))}` : ""}.</h1><p>${escapeHTML(todayLabel)} · semestre ${escapeHTML(state.activeSemester)}</p></div>
        </div>

        ${renderHomeAlerts()}
        <div class="home-grid">
        <div class="page-stack home-side">
        <section class="card profile-card" aria-label="Perfil docente">
          ${avatarMarkup(profile)}
          <div class="profile-copy"><h2>${escapeHTML(profile.name || "Seu perfil docente")}</h2><p>${escapeHTML(profile.role || "Configure seu nome e vínculo em Ajustes")}</p></div>
          <button type="button" class="icon-button" data-action="edit-profile" aria-label="Editar perfil">✎</button>
        </section>

        <section class="card hero-card" aria-label="Horário e status do ponto">
          <div class="hero-topline">
            <div><div class="hero-day">${escapeHTML(selectedDayLabel)} · ${escapeHTML(state.activeSemester)}</div><div class="hero-time" id="live-clock">${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div><div class="hero-date">${escapeHTML(todayLabel)}</div></div>
            <span class="live-pill">HORÁRIO LOCAL</span>
          </div>
          <div class="status-panel ${evaluation?.open ? "is-open" : ""}">
            <div class="status-copy"><strong>${escapeHTML(evaluation?.label || "Nenhuma aula para este dia")}</strong><small>${activeClass ? `${escapeHTML(activeClass.startTime)}–${escapeHTML(activeClass.endTime)} · janela de ponto ±15 min${selectedDay === now.getDay() ? ` · ${escapeHTML(L.countdownText(activeClass, now))}` : ""}` : "Cadastre uma aula ou importe os seus dados."}</small></div>
            <span class="status-icon" aria-hidden="true">${evaluation?.icon || "＋"}</span>
          </div>
        </section>

        ${activeClass && evaluation && pointLink ? `
          <section class="card point-card" aria-label="Ação de ponto eletrônico">
            <div class="point-class">
              <span class="eyebrow">PRÓXIMO PONTO · ${escapeHTML(evaluation.phase.toUpperCase())}</span>
              <h2 class="point-class-title">${escapeHTML(activeClass.subject || "Disciplina")}</h2>
              <div class="point-meta">${escapeHTML(institutionName(activeClass.institutionId))} · ${escapeHTML(activeClass.shift)} · ${escapeHTML(activeClass.campus)}</div>
              <div class="point-window">
                <div class="window-chip"><small>Entrada</small><strong>${evaluation.inOpen} – ${evaluation.inClose}</strong></div>
                <div class="window-chip"><small>Saída</small><strong>${evaluation.outOpen} – ${evaluation.outClose}</strong></div>
              </div>
            </div>
            ${pointLink.url ? `<a class="point-action" href="${escapeHTML(pointLink.url)}" target="_blank" rel="noopener noreferrer" data-action="record-ponto" data-class-id="${escapeHTML(activeClass.id)}"><span><strong>ABRIR SISTEMA DE PONTO</strong><small>${escapeHTML(pointLink.label)} · ${escapeHTML(pointLink.url)}</small></span><span class="point-arrow" aria-hidden="true">↗</span></a>` : `<div class="point-action" aria-disabled="true"><span><strong>Configure o link de ponto</strong><small>Adicione uma URL em Ajustes → Regras de ponto.</small></span></div>`}
          </section>` : ""}

        </div>
        <div class="page-stack home-main">
        <section class="day-strip" aria-label="Selecionar dia da semana">
          ${DAY_SHORT.map((day, index) => `<button type="button" class="day-button" data-action="select-day" data-day="${index}" aria-pressed="${selectedDay === index}"><span>${day}</span><small>${index === now.getDay() ? "Hoje" : ""}</small></button>`).join("")}
        </section>

        <section class="page-stack" aria-labelledby="today-classes-title">
          <div class="card-heading"><h2 id="today-classes-title">Aulas de ${escapeHTML(selectedDayLabel)}</h2><button type="button" class="button button-quiet button-small" data-action="add-class">＋ Aula</button></div>
          ${todayClasses}
        </section>
        </div>
        </div>
      </div>`;
  }

  function renderSchedule() {
    const groups = DAY_NAMES.map((day, dayNumber) => {
      const items = sortedClasses(dayNumber);
      if (!items.length) return "";
      return `<section class="card">
        <div class="card-heading"><div><span class="eyebrow">${escapeHTML(DAY_SHORT[dayNumber])}</span><h2>${escapeHTML(day)}</h2></div><span class="tag">${items.length} ${items.length === 1 ? "aula" : "aulas"}</span></div>
        <div class="class-list">${items.map((item) => renderClassCard(item)).join("")}</div>
      </section>`;
    }).join("");
    return `
      <div class="page-stack">
        <div class="page-heading"><div><span class="eyebrow">ORGANIZAÇÃO</span><h1>Sua grade.</h1><p>Horários e salas do semestre ${escapeHTML(state.activeSemester)}.</p></div><button type="button" class="button button-primary" data-action="add-class">＋ Aula</button></div>
        ${renderScheduleSummary()}${groups ? (scheduleView === "week" ? renderWeekView() : `<div class="card-grid">${groups}</div>`) : renderEmpty("Sua grade está vazia", "Importe o backup do app anterior ou cadastre a primeira aula.", `<button type="button" class="button button-primary" data-action="add-class">Cadastrar aula</button>`)}
      </div>`;
  }

  function renderInstitutionOptions(selected = "") {
    if (!state.institutions.length) return '<option value="">Cadastre uma instituição primeiro</option>';
    return state.institutions.map((institution) =>
      `<option value="${escapeHTML(institution.id)}" ${institution.id === selected ? "selected" : ""}>${escapeHTML(institution.name)}</option>`
    ).join("");
  }

  function renderSettings() {
    const profile = state.userProfile;
    const institutionRows = state.institutions.map((institution) => `
      <div class="data-row"><div class="data-row-copy"><strong>${escapeHTML(institution.name)}</strong><small>${escapeHTML(institution.defaultPontoUrl || "Sem link padrão")}</small></div>
        <div class="data-row-actions"><button type="button" class="icon-button" data-action="edit-institution" data-id="${escapeHTML(institution.id)}" aria-label="Editar ${escapeHTML(institution.name)}">✎</button><button type="button" class="icon-button is-danger" data-action="delete-institution" data-id="${escapeHTML(institution.id)}" aria-label="Excluir ${escapeHTML(institution.name)}">×</button></div></div>`).join("");
    const ruleRows = state.pontoRules.map((rule) => `
      <div class="data-row"><div class="data-row-copy"><strong>${escapeHTML(institutionName(rule.institutionId))} · ${escapeHTML(rule.dayOfWeek === "ALL" ? "Todos os dias" : DAY_NAMES[Number(rule.dayOfWeek)] || rule.dayOfWeek)} · ${escapeHTML(rule.shift === "ALL" ? "Todos os turnos" : rule.shift)}</strong><small>${escapeHTML(rule.url)}</small></div>
        <button type="button" class="icon-button is-danger" data-action="delete-rule" data-id="${escapeHTML(rule.id)}" aria-label="Excluir regra">×</button></div>`).join("");
    return `
      <div class="page-stack">
        <div class="page-heading"><div><span class="eyebrow">PERSONALIZAÇÃO</span><h1>Ajustes.</h1><p>Seu perfil, vínculos e regras salvos neste navegador.</p></div></div>
        <div class="card-grid">

        <section class="card settings-section">
          <div><span class="eyebrow">QUEM USA</span><h2>Perfil docente</h2></div>
          <div class="photo-preview">${avatarMarkup(profile)}<button type="button" class="button button-quiet button-small" data-action="select-profile-photo">Trocar foto</button></div>
          <form id="profile-form" class="form-stack" onsubmit="return false">
            <label>Nome<input name="name" maxlength="100" value="${escapeHTML(profile.name)}" placeholder="Seu nome"></label>
            <label>Vínculo / cargo<input name="role" maxlength="120" value="${escapeHTML(profile.role)}" placeholder="Docente · instituição"></label>
            <button type="button" class="button button-primary" data-action="save-profile">Salvar perfil</button>
          </form>
        </section>

        <section class="card settings-section">
          <div><span class="eyebrow">VÍNCULOS</span><h2>Instituições</h2><p class="card-description">Cadastre os portais de ponto e logos de cada vínculo.</p></div>
          ${institutionRows ? `<div class="item-list">${institutionRows}</div>` : renderEmpty("Nenhuma instituição cadastrada", "Adicione uma instituição para associar aulas e links de ponto.")}
          <form id="institution-form" class="form-stack" onsubmit="return false">
            <input type="hidden" name="id" value="${escapeHTML(editingInstitutionId)}">
            <label>Nome / sigla<input name="name" required maxlength="100" placeholder="Ex.: IESB"></label>
            <label>Link padrão de ponto<input name="defaultPontoUrl" type="url" placeholder="https://..."></label>
            <div class="photo-preview">${pendingInstitutionLogo ? `<span class="avatar"><img src="${escapeHTML(pendingInstitutionLogo)}" alt=""></span>` : ""}<button type="button" class="button button-quiet button-small" data-action="select-institution-logo">Escolher logo</button></div>
            <div class="data-row-actions"><button type="button" class="button button-quiet button-small" data-action="cancel-institution-edit">${editingInstitutionId ? "Cancelar edição" : "Limpar"}</button><button type="button" class="button button-primary button-small" data-action="save-institution">${editingInstitutionId ? "Salvar alterações" : "＋ Instituição"}</button></div>
          </form>
        </section>

        <section class="card settings-section">
          <div><span class="eyebrow">AUTOMAÇÃO</span><h2>Regras de ponto</h2><p class="card-description">O link específico de dia e turno tem prioridade sobre o link padrão.</p></div>
          ${ruleRows ? `<div class="item-list">${ruleRows}</div>` : renderEmpty("Sem regras personalizadas", "As aulas usarão o link padrão da instituição.")}
          <form id="rule-form" class="form-stack" onsubmit="return false">
            <label>Instituição<select name="institutionId" required>${renderInstitutionOptions()}</select></label>
            <div class="form-grid">
              <label>Dia<select name="dayOfWeek"><option value="ALL">Todos os dias</option>${DAY_NAMES.map((day, index) => `<option value="${index}">${escapeHTML(day)}</option>`).join("")}</select></label>
              <label>Turno<select name="shift"><option value="ALL">Todos os turnos</option>${SHIFT_NAMES.map((shift) => `<option>${shift}</option>`).join("")}</select></label>
            </div>
            <label>URL do sistema<input name="url" type="url" required placeholder="https://portal.exemplo.edu/ponto"></label>
            <button type="button" class="button button-secondary" data-action="save-rule">Salvar regra de ponto</button>
          </form>
        </section>

        ${renderAppearance()}
        ${renderReminderSettings()}
        <section class="card settings-section">
          <div><span class="eyebrow">PERÍODO LETIVO</span><h2>Semestres</h2><p class="card-description">O novo período pode iniciar com uma cópia da grade ativa.</p></div>
          <div class="class-tags">${state.semesters.map((semester) => `<button type="button" class="tag ${semester === state.activeSemester ? "is-accent" : ""}" data-action="activate-semester" data-semester="${escapeHTML(semester)}">${escapeHTML(semester)}${semester === state.activeSemester ? " · ativo" : ""}</button>`).join("")}</div>
          <form id="semester-form" class="form-stack" onsubmit="return false">
            <div class="inline-form"><label>Novo semestre<input name="semester" required maxlength="20" placeholder="Ex.: 2027/2"></label><button type="button" class="button button-secondary" data-action="create-semester">Criar</button></div>
            <label class="check-row"><input type="checkbox" name="clone" checked> Clonar aulas do semestre ativo</label>
          </form>
        </section>
        </div>
      </div>`;
  }

  function renderData() {
    const logs = state.pontoLogs.map((entry) => `
      <div class="data-row log-row"><div class="data-row-copy"><strong>${escapeHTML(entry.institutionName)} · ${escapeHTML(entry.phase)}</strong><small>${escapeHTML(entry.subject)} · ${escapeHTML(entry.campus)}${confirmLabel(entry)}</small></div><time>${escapeHTML(entry.timestamp)}</time></div>`).join("");
    return `
      <div class="page-stack">
        <div class="page-heading"><div><span class="eyebrow">ARMAZENAMENTO LOCAL</span><h1>Seus dados.</h1><p>Privados neste navegador. Não são enviados ao Django.</p></div></div>
        <div class="card-grid">

        <section class="card">
          <div class="card-heading"><div><span class="eyebrow">NESTE DISPOSITIVO</span><h2>Visão geral</h2></div><span class="tag is-accent">IndexedDB</span></div>
          <div class="stats-grid">
            <div class="stat"><strong>${state.classes.length}</strong><small>Aulas</small></div>
            <div class="stat"><strong>${state.institutions.length}</strong><small>Instituições</small></div>
            <div class="stat"><strong>${state.pontoLogs.length}</strong><small>Batidas</small></div>
            <div class="stat"><strong>${state.diary.length}</strong><small>Diário</small></div>
          </div>
          <p class="card-description">Cada navegador mantém seu próprio banco. Para levar seus dados a outro aparelho, exporte o JSON aqui e importe-o no destino.</p>
        </section>

        ${renderBackupStatus()}
        ${renderSheetImport()}
        <section class="card settings-section">
          <div><span class="eyebrow">BACKUP PORTÁTIL</span><h2>Exportar ou importar</h2><p class="card-description">O arquivo é lido e gravado localmente; não há envio ao servidor.</p></div>
          <button type="button" class="button button-primary button-wide" data-action="export-backup">⇩ Exportar backup JSON</button>
          <button type="button" class="button button-secondary button-wide" data-action="import-backup">＋ Importar backup JSON</button>
          <div class="notice"><strong>Atenção:</strong> importar substitui os dados deste navegador. Faça um backup antes de trocar o conteúdo.</div>
        </section>

        <section class="card settings-section">
          <div class="card-heading"><div><span class="eyebrow">HISTÓRICO LOCAL</span><h2>Batidas de ponto</h2></div><button type="button" class="button button-quiet button-small" data-action="export-logs">Exportar CSV</button></div>
          ${logs ? `<div class="item-list">${logs}</div>` : renderEmpty("Nenhuma batida registrada", "Ao abrir o portal pelo botão de ponto, o evento será anotado aqui.")}
        </section>
        </div>
      </div>`;
  }

  function renderAppearance() {
    const current = document.documentElement.dataset.theme || "rubro";
    const options = [
      ["light", "☼", "Claro", "Fundo branco, ótimo ao ar livre"],
      ["dark", "◐", "Escuro", "Cinza escuro com destaque azul"],
      ["rubro", "●", "Rubro e ouro", "Preto com vermelho e dourado"],
    ];
    return `
      <section class="card settings-section">
        <div><span class="eyebrow">APARÊNCIA</span><h2>Tema visual</h2><p class="card-description">A escolha fica salva neste aparelho.</p></div>
        <div class="theme-options" role="group" aria-label="Tema visual">
          ${options.map(([value, icon, name, text]) => `
            <button type="button" class="theme-option" data-theme-choice="${value}" aria-pressed="${current === value}">
              <span class="theme-icon theme-icon-${value}" aria-hidden="true">${icon}</span>
              <span><strong>${name}</strong><small>${text}</small></span>
            </button>`).join("")}
        </div>
      </section>`;
  }

  // ====================================================================================
  // Diário de classe, lembretes, ponto confirmado, backup, semana, planilhas
  // ====================================================================================
  const diaryDialog = document.getElementById("diary-dialog");
  const diaryForm = document.getElementById("diary-form");
  const planDialog = document.getElementById("plan-dialog");
  const planForm = document.getElementById("plan-form");
  const WEEK_SCALE = 1.1; // px per minute in the weekly view
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  const todayISO = () => L.toISODate(new Date());

  function downloadText(filename, text, mime = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;opacity:0";
      document.body.append(area);
      area.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      area.remove();
      return copied;
    }
  }

  const slug = (value) => String(value || "arquivo").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "arquivo";

  // ------------------------------------------------------------------ Diário

  /** One "turma" = the same subject at the same institution in the active semester. */
  function turmaList() {
    const map = new Map();
    const add = (source, withClass) => {
      const key = L.diaryKey(source);
      if (!map.has(key)) map.set(key, { key, subject: source.subject, institutionId: source.institutionId, classes: [] });
      if (withClass) map.get(key).classes.push(source);
    };
    state.classes.filter((item) => item.semester === state.activeSemester).forEach((item) => add(item, true));
    state.diary.filter((entry) => entry.semester === state.activeSemester).forEach((entry) => add(entry, false));
    return [...map.values()].sort((left, right) => left.subject.localeCompare(right.subject, "pt-BR"));
  }

  const countsForNumber = (entry) => L.DIARY_STATUSES.find((item) => item.value === entry.status)?.counts;

  /** An entry still needs the teacher's attention when its date has come and the text is missing. */
  function isPending(entry) {
    if (entry.date > todayISO()) return false;
    return entry.status === "Prevista" || (countsForNumber(entry) && !entry.content.trim());
  }

  function findDiaryEntry(source, date) {
    return state.diary.find((entry) =>
      L.diaryKey(entry) === L.diaryKey(source) && entry.date === date && (entry.startTime || "") === (source.startTime || ""));
  }

  function todayDiaryGaps(now = new Date()) {
    const today = L.toISODate(now);
    const current = now.getHours() * 60 + now.getMinutes();
    return sortedClasses()
      .filter((item) => Number(item.dayOfWeek) === now.getDay() && current >= L.timeToMinutes(item.startTime))
      .filter((item) => {
        const entry = findDiaryEntry(item, today);
        return !entry || (entry.status === "Prevista" && !entry.content.trim());
      });
  }

  function diaryEntriesFor(key) {
    return L.renumber(state.diary.filter((entry) => L.diaryKey(entry) === key));
  }

  function renderDiaryRow(entry) {
    const skipped = !countsForNumber(entry);
    const pending = isPending(entry);
    const weekday = L.DAY_SHORT[L.parseISODate(entry.date)?.getDay() ?? 0];
    const tone = skipped ? "" : entry.status === "Reposição" ? "is-accent" : pending ? "is-danger" : "";
    const empty = (text) => `<span class="muted">${text}</span>`;
    return `
      <tr class="${pending ? "is-pending" : ""} ${skipped ? "is-skipped" : ""}">
        <td data-label="Aula nº" class="col-number">${escapeHTML(L.lessonLabel(entry))}</td>
        <td data-label="Data" class="col-date">${escapeHTML(L.formatBR(entry.date))} <small>${escapeHTML(weekday)}</small></td>
        <td data-label="Conteúdo ministrado" class="col-content">${entry.content.trim() ? escapeHTML(entry.content) : empty(skipped ? "—" : "Preencher…")}</td>
        <td data-label="Observações" class="col-notes ${entry.notes.trim() ? "" : "is-empty"}">${entry.notes.trim() ? escapeHTML(entry.notes) : empty("—")}</td>
        <td data-label="Situação" class="col-status"><span class="tag ${tone}">${escapeHTML(entry.status)}</span></td>
        <td class="col-actions no-print"><div class="row-actions">
          <button type="button" class="icon-button" data-action="edit-diary" data-id="${escapeHTML(entry.id)}" aria-label="Editar aula de ${escapeHTML(L.formatBR(entry.date))}">✎</button>
          <button type="button" class="icon-button" data-action="copy-field" data-field="content" data-id="${escapeHTML(entry.id)}" aria-label="Copiar conteúdo de ${escapeHTML(L.formatBR(entry.date))}" title="Copiar conteúdo">⧉</button>
        </div></td>
      </tr>`;
  }

  function renderDiary() {
    const heading = `<div class="page-heading"><div><span class="eyebrow">LIVRO DIÁRIO</span><h1>Diário de classe.</h1><p>Registre aqui e depois copie ou exporte para o sistema da instituição.</p></div></div>`;
    const turmas = turmaList();
    if (!turmas.length) {
      return `<div class="page-stack">${heading}${renderEmpty("Nenhuma disciplina neste semestre", "Cadastre suas aulas na grade (ou importe uma planilha em Dados) para começar o diário.", `<button type="button" class="button button-primary" data-action="add-class">Cadastrar aula</button>`)}</div>`;
    }
    if (!turmas.some((turma) => turma.key === diaryTurma)) diaryTurma = turmas[0].key;
    const turma = turmas.find((item) => item.key === diaryTurma);
    const entries = diaryEntriesFor(diaryTurma);
    const pendingCount = entries.filter(isPending).length;
    const shown = diaryFilter === "pending" ? entries.filter(isPending) : entries;
    const gaps = todayDiaryGaps();
    const profile = state.userProfile;
    const gapsCard = gaps.length ? `
      <section class="card alert-card is-primary no-print">
        <span class="eyebrow">HOJE</span><h2>Aulas de hoje sem registro</h2>
        <div class="item-list">${gaps.map((item) => `
          <div class="data-row"><div class="data-row-copy"><strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.startTime)}–${escapeHTML(item.endTime)} · ${escapeHTML(institutionName(item.institutionId))}</small></div>
          <button type="button" class="button button-primary button-small" data-action="add-diary" data-class-id="${escapeHTML(item.id)}" data-date="${todayISO()}">Registrar</button></div>`).join("")}</div>
      </section>` : "";
    const table = shown.length ? `
      <div class="diary-table-wrap"><table class="diary-table">
        <thead><tr><th>Aula nº</th><th>Data</th><th>Conteúdo ministrado</th><th>Observações</th><th>Situação</th><th class="no-print"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${shown.map(renderDiaryRow).join("")}</tbody>
      </table></div>`
      : renderEmpty(
        diaryFilter === "pending" ? "Nada pendente" : "Nenhuma aula registrada ainda",
        diaryFilter === "pending" ? "Todas as aulas até hoje já têm conteúdo." : "Registre a aula de hoje ou gere as datas previstas do semestre para ir preenchendo.",
        diaryFilter === "pending" ? "" : `<button type="button" class="button button-primary" data-action="add-diary">Registrar aula</button>`,
      );
    return `
      <div class="page-stack page-diary">
        ${heading}
        ${gapsCard}
        <section class="card diary-card">
          <div class="print-only print-header">
            <h2>Diário de classe — ${escapeHTML(turma.subject)}</h2>
            <p>${escapeHTML(institutionName(turma.institutionId))} · Semestre ${escapeHTML(state.activeSemester)}${profile.name ? ` · Prof. ${escapeHTML(profile.name)}` : ""}</p>
          </div>
          <div class="diary-toolbar no-print">
            <label>Disciplina / turma
              <select data-diary-select aria-label="Disciplina">${turmas.map((item) => `<option value="${escapeHTML(item.key)}" ${item.key === diaryTurma ? "selected" : ""}>${escapeHTML(item.subject)} · ${escapeHTML(institutionName(item.institutionId))}</option>`).join("")}</select>
            </label>
            <div class="segmented" role="group" aria-label="Filtro">
              <button type="button" data-action="set-diary-filter" data-filter="all" aria-pressed="${diaryFilter === "all"}">Todas (${entries.length})</button>
              <button type="button" data-action="set-diary-filter" data-filter="pending" aria-pressed="${diaryFilter === "pending"}">Pendentes (${pendingCount})</button>
            </div>
          </div>
          <div class="diary-actions no-print">
            <button type="button" class="button button-primary button-small" data-action="add-diary">＋ Registrar aula</button>
            <button type="button" class="button button-secondary button-small" data-action="plan-diary">Gerar datas do semestre</button>
            <button type="button" class="button button-quiet button-small" data-action="copy-diary">Copiar tabela</button>
            <button type="button" class="button button-quiet button-small" data-action="export-diary">Baixar CSV</button>
            <button type="button" class="button button-quiet button-small" data-action="print-diary">Imprimir / PDF</button>
            <button type="button" class="button button-quiet button-small" data-action="export-diary-all">CSV de todas as disciplinas</button>
          </div>
          ${table}
          <p class="card-description no-print">O número da aula é calculado pela ordem das datas (aula dupla vira “3–4”; faltas e feriados não consomem número). <strong>Copiar tabela</strong> cola direto no Excel/Planilhas; o botão ⧉ de cada linha copia só o conteúdo, para colar no campo do sistema da instituição.</p>
        </section>
      </div>`;
  }

  function diaryStatusOptions(selected) {
    return L.DIARY_STATUSES.map((item) => `<option ${item.value === selected ? "selected" : ""}>${escapeHTML(item.value)}</option>`).join("");
  }

  function periodsFor(turma, date) {
    const weekday = L.parseISODate(date)?.getDay();
    const item = turma?.classes.find((entry) => Number(entry.dayOfWeek) === weekday) || turma?.classes[0];
    return item ? L.suggestedPeriods(item) : 1;
  }

  function autofillDiaryPeriods() {
    const turma = turmaList().find((item) => item.key === diaryForm.elements.namedItem("turma").value);
    diaryForm.elements.namedItem("periods").value = periodsFor(turma, diaryForm.elements.namedItem("date").value);
  }

  let diaryEditingId = "";

  function openDiaryDialog({ id = "", classId = "", date = "" } = {}) {
    const turmas = turmaList();
    if (!turmas.length) {
      showToast("Cadastre uma aula na grade antes de usar o diário.");
      return;
    }
    const item = state.classes.find((entry) => entry.id === classId);
    const existing = state.diary.find((entry) => entry.id === id) || (item && date ? findDiaryEntry(item, date) : null);
    const key = existing ? L.diaryKey(existing) : item ? L.diaryKey(item) : diaryTurma;
    const turma = turmas.find((entry) => entry.key === key) || turmas[0];
    diaryEditingId = existing?.id || "";
    diaryForm.reset();
    const select = diaryForm.elements.namedItem("turma");
    select.innerHTML = turmas.map((entry) => `<option value="${escapeHTML(entry.key)}">${escapeHTML(entry.subject)} · ${escapeHTML(institutionName(entry.institutionId))}</option>`).join("");
    select.value = turma.key;
    diaryForm.elements.namedItem("status").innerHTML = diaryStatusOptions(existing?.status || "Realizada");
    const chosenDate = existing?.date || date || todayISO();
    diaryForm.elements.namedItem("date").value = chosenDate;
    diaryForm.elements.namedItem("periods").value = existing?.periods || periodsFor(turma, chosenDate);
    diaryForm.elements.namedItem("content").value = existing?.content || "";
    diaryForm.elements.namedItem("notes").value = existing?.notes || "";
    document.getElementById("diary-dialog-title").textContent = existing ? "Editar aula" : "Registrar aula";
    document.getElementById("delete-diary").hidden = !existing;
    diaryDialog.showModal();
    diaryForm.elements.namedItem("content").focus();
  }

  function saveDiary() {
    if (!diaryForm.reportValidity()) return;
    const data = new FormData(diaryForm);
    const turma = turmaList().find((entry) => entry.key === String(data.get("turma")));
    const date = String(data.get("date") || "");
    const parsed = L.parseISODate(date);
    if (!turma || !parsed) {
      showToast("Escolha a disciplina e uma data válida.");
      return;
    }
    const item = turma.classes.find((entry) => Number(entry.dayOfWeek) === parsed.getDay());
    const id = diaryEditingId || makeId("diary");
    const entry = {
      id,
      classId: item?.id || "",
      semester: state.activeSemester,
      institutionId: turma.institutionId,
      subject: turma.subject,
      date,
      startTime: item?.startTime || "",
      periods: Math.min(8, Math.max(1, Number(data.get("periods")) || 1)),
      status: String(data.get("status")),
      content: String(data.get("content") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
    };
    if (state.diary.some((other) => other.id !== id && L.diaryKey(other) === turma.key && other.date === date && (other.startTime || "") === entry.startTime)) {
      showToast("Já existe um registro desta aula nesta data. Edite o existente.");
      return;
    }
    changeState((next) => {
      const index = next.diary.findIndex((other) => other.id === id);
      if (index >= 0) next.diary[index] = entry;
      else next.diary.push(entry);
      next.diary = L.renumberAll(next.diary);
    }, "Registro salvo no diário deste dispositivo.");
    diaryTurma = turma.key;
    diaryDialog.close();
  }

  function deleteDiary() {
    if (!diaryEditingId || !window.confirm("Excluir este registro do diário?")) return;
    const id = diaryEditingId;
    changeState((next) => { next.diary = L.renumberAll(next.diary.filter((entry) => entry.id !== id)); }, "Registro removido.");
    diaryDialog.close();
  }

  function openPlanDialog() {
    const turma = turmaList().find((entry) => entry.key === diaryTurma);
    if (!turma?.classes.length) {
      showToast("Esta disciplina não tem horário na grade. Cadastre a aula primeiro.");
      return;
    }
    const start = new Date();
    planForm.elements.namedItem("start").value = L.toISODate(start);
    planForm.elements.namedItem("end").value = L.toISODate(L.addDays(start, 17 * 7));
    document.getElementById("plan-summary").textContent =
      `${turma.subject}: ${turma.classes.map((item) => `${L.DAY_SHORT[item.dayOfWeek]} ${item.startTime}`).join(", ")}`;
    planDialog.showModal();
  }

  function savePlan() {
    if (!planForm.reportValidity()) return;
    const data = new FormData(planForm);
    const start = String(data.get("start"));
    const end = String(data.get("end"));
    const turma = turmaList().find((entry) => entry.key === diaryTurma);
    if (!turma) return;
    const created = [];
    turma.classes.forEach((item) => {
      L.datesForWeekday(start, end, item.dayOfWeek).forEach((date) => {
        if (findDiaryEntry(item, date)) return;
        created.push({
          id: makeId("diary"), classId: item.id, semester: state.activeSemester, institutionId: item.institutionId,
          subject: item.subject, date, startTime: item.startTime, periods: L.suggestedPeriods(item),
          status: "Prevista", content: "", notes: "",
        });
      });
    });
    if (!created.length) {
      showToast("Nenhuma data nova neste período (ou o período é inválido).");
      return;
    }
    if (created.length > 400) {
      showToast("Período muito longo. Gere no máximo um semestre por vez.");
      return;
    }
    changeState((next) => {
      next.diary.push(...created);
      next.diary = L.renumberAll(next.diary);
    }, `${created.length} aulas previstas criadas. Marque feriados como “Sem aula”.`);
    planDialog.close();
  }

  function selectedTurma() {
    return turmaList().find((entry) => entry.key === diaryTurma);
  }

  async function copyDiary() {
    const turma = selectedTurma();
    if (!turma) return;
    const rows = L.diaryRows(state.diary.filter((entry) => L.diaryKey(entry) === turma.key));
    const copied = await copyText(L.toTSV(rows));
    showToast(copied ? "Tabela copiada. Cole no Excel, Planilhas ou no sistema da instituição." : "Não foi possível copiar. Use “Baixar CSV”.");
  }

  function exportDiary() {
    const turma = selectedTurma();
    if (!turma) return;
    const rows = L.diaryRows(state.diary.filter((entry) => L.diaryKey(entry) === turma.key));
    downloadText(`diario_${slug(turma.subject)}_${slug(state.activeSemester)}.csv`, L.toCSV(rows));
    showToast("CSV do diário gerado neste dispositivo.");
  }

  function exportDiaryAll() {
    const rows = [["Disciplina", "Instituição", "Aula nº", "Data", "Conteúdo ministrado", "Observações", "Situação"]];
    turmaList().forEach((turma) => {
      diaryEntriesFor(turma.key).forEach((entry) => rows.push([
        turma.subject, institutionName(turma.institutionId), L.lessonLabel(entry), L.formatBR(entry.date), entry.content, entry.notes, entry.status,
      ]));
    });
    if (rows.length === 1) {
      showToast("O diário deste semestre está vazio.");
      return;
    }
    downloadText(`diario_completo_${slug(state.activeSemester)}.csv`, L.toCSV(rows));
    showToast("CSV de todas as disciplinas gerado.");
  }

  async function copyDiaryField(id, field) {
    const entry = state.diary.find((item) => item.id === id);
    if (!entry) return;
    const text = field === "notes" ? entry.notes : entry.content;
    if (!text.trim()) {
      showToast("Este campo ainda está vazio.");
      return;
    }
    showToast((await copyText(text)) ? "Conteúdo copiado." : "Não foi possível copiar.");
  }

  function printDiary() {
    document.body.classList.add("printing");
    window.addEventListener("afterprint", () => document.body.classList.remove("printing"), { once: true });
    window.print();
  }

  // ------------------------------------------------------------------ Ponto: confirmação e esquecimentos

  const confirmLabel = (log) => (log.confirmed === true ? " · ✓ confirmado" : log.confirmed === false ? " · não concluído" : log.at ? " · aguardando confirmação" : "");

  function setPontoConfirmation(id, value) {
    changeState((next) => {
      const log = next.pontoLogs.find((entry) => entry.id === id);
      if (log) log.confirmed = value;
    }, value ? "Ponto confirmado no histórico." : "Ok, vamos lembrar você de registrar.");
  }

  function addManualPonto(classId, phase) {
    const item = state.classes.find((entry) => entry.id === classId);
    if (!item) return;
    changeState((next) => {
      next.pontoLogs.unshift({
        id: makeId("log"), classId: item.id, isoDate: todayISO(), at: Date.now(),
        timestamp: new Date().toLocaleString("pt-BR"), institutionName: institutionName(item.institutionId),
        shift: item.shift, phase, subject: item.subject, campus: item.campus, url: "", confirmed: true, manual: true,
      });
    }, `${phase} marcada como registrada.`);
  }

  function exportLogs() {
    if (!state.pontoLogs.length) {
      showToast("Ainda não há batidas no histórico.");
      return;
    }
    const rows = [["Data/hora", "Instituição", "Disciplina", "Campus", "Fase", "Situação", "Origem"]];
    state.pontoLogs.forEach((log) => rows.push([
      log.timestamp, log.institutionName, log.subject, log.campus, log.phase,
      log.confirmed === true ? "Confirmado" : log.confirmed === false ? "Não concluído" : "Sem confirmação",
      log.manual ? "Marcado manualmente" : "Aberto pelo app",
    ]));
    downloadText(`pontual_historico_ponto.csv`, L.toCSV(rows));
    showToast("Histórico de ponto exportado.");
  }

  // ------------------------------------------------------------------ Backup e armazenamento

  function backupAgeDays() {
    const time = state.settings.lastBackupAt ? Date.parse(state.settings.lastBackupAt) : NaN;
    return Number.isFinite(time) ? Math.floor((Date.now() - time) / 86_400_000) : null;
  }

  function needsBackup() {
    if (!state.classes.length && !state.diary.length) return false;
    const age = backupAgeDays();
    return age === null || age >= state.settings.backupReminderDays;
  }

  const backupText = () => {
    const age = backupAgeDays();
    return age === null ? "nunca feito" : age === 0 ? "hoje" : `há ${age} dia${age === 1 ? "" : "s"}`;
  };

  function renderBackupStatus() {
    const persisted = storagePersisted === true ? "protegido pelo navegador" : storagePersisted === false ? "pode ser apagado pelo navegador em pouco espaço" : "indisponível";
    return `
      <section class="card settings-section">
        <div><span class="eyebrow">SEGURANÇA DOS DADOS</span><h2>Backup e proteção</h2></div>
        <div class="data-row"><div class="data-row-copy"><strong>Último backup: ${escapeHTML(backupText())}</strong><small>Lembrete a cada ${state.settings.backupReminderDays} dias</small></div></div>
        <div class="data-row"><div class="data-row-copy"><strong>Armazenamento: ${escapeHTML(persisted)}</strong><small>Limpar dados do navegador apaga o diário. Exporte backups.</small></div>
          ${storagePersisted === false ? `<button type="button" class="button button-secondary button-small" data-action="persist-storage">Proteger</button>` : ""}</div>
      </section>`;
  }

  async function protectStorage() {
    try {
      storagePersisted = Boolean(await navigator.storage?.persist?.());
    } catch {
      storagePersisted = false;
    }
    showToast(storagePersisted ? "Armazenamento protegido neste navegador." : "O navegador não concedeu a proteção. Mantenha backups em dia.");
    render();
  }

  // ------------------------------------------------------------------ Lembretes e calendário

  let reminderTimers = [];

  async function showReminder(event) {
    const options = { body: event.body, tag: event.tag, icon: "/static/core/icon.svg", badge: "/static/core/icon.svg", data: { url: "/" } };
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        await registration.showNotification(event.title, options);
        return;
      }
    } catch { /* fall through to the page-level API */ }
    try { new Notification(event.title, options); } catch { /* notifications unavailable */ }
  }

  async function scheduleReminders() {
    reminderTimers.forEach((timer) => window.clearTimeout(timer));
    reminderTimers = [];
    if (!state?.settings.remindersEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const events = L.reminderEvents(sortedClasses(), now, state.settings.reminderLead);
    events.forEach((event) => reminderTimers.push(window.setTimeout(() => showReminder(event), event.at - now)));
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    reminderTimers.push(window.setTimeout(scheduleReminders, midnight - now));
    // Chrome (Android) can fire these even with the app closed; elsewhere the timers above apply.
    if ("showTrigger" in Notification.prototype && window.TimestampTrigger && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        for (const event of events) {
          await registration.showNotification(event.title, {
            body: event.body, tag: event.tag, icon: "/static/core/icon.svg", data: { url: "/" },
            showTrigger: new window.TimestampTrigger(event.at.getTime()),
          });
        }
      } catch { /* timers remain as fallback */ }
    }
  }

  async function toggleReminders() {
    if (state.settings.remindersEnabled) {
      await changeState((next) => { next.settings.remindersEnabled = false; }, "Lembretes desativados.");
      return;
    }
    if (!("Notification" in window)) {
      showToast("Este navegador não oferece notificações. Use o calendário (.ics).");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      showToast("Permissão negada. Libere as notificações nas configurações do navegador.");
      return;
    }
    await changeState((next) => { next.settings.remindersEnabled = true; }, "Lembretes ativados.");
  }

  function exportICS() {
    const form = document.getElementById("ics-form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const classes = sortedClasses();
    if (!classes.length) {
      showToast("Cadastre aulas na grade antes de exportar o calendário.");
      return;
    }
    try {
      const ics = L.buildICS({
        classes, institutionName, startISO: String(data.get("start")), endISO: String(data.get("end")), lead: Number(data.get("lead")),
      });
      downloadText(`pontual_grade_${slug(state.activeSemester)}.ics`, ics, "text/calendar;charset=utf-8");
      showToast("Calendário gerado. Abra o arquivo para adicionar à sua agenda.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderReminderSettings() {
    const supported = "Notification" in window;
    const permission = supported ? Notification.permission : "unsupported";
    const status = !supported ? "Sem suporte neste navegador"
      : permission === "denied" ? "Bloqueado nas configurações do navegador"
        : state.settings.remindersEnabled && permission === "granted" ? "Ativados" : "Desativados";
    const start = new Date();
    return `
      <section class="card settings-section">
        <div><span class="eyebrow">NÃO PERCA O PONTO</span><h2>Lembretes e calendário</h2>
          <p class="card-description">Receba um aviso antes de cada janela de ponto (entrada e saída).</p></div>
        <div class="data-row"><div class="data-row-copy"><strong>Notificações: ${escapeHTML(status)}</strong><small>Funcionam com o app aberto ou instalado na tela inicial. Em alguns Androids chegam até com o app fechado.</small></div>
          <button type="button" class="button ${state.settings.remindersEnabled ? "button-quiet" : "button-primary"} button-small" data-action="toggle-reminders" ${permission === "denied" || !supported ? "disabled" : ""}>${state.settings.remindersEnabled ? "Desativar" : "Ativar"}</button></div>
        <label>Avisar antes da janela abrir
          <select data-setting="reminderLead">${[5, 10, 15].map((minutes) => `<option value="${minutes}" ${state.settings.reminderLead === minutes ? "selected" : ""}>${minutes} minutos</option>`).join("")}</select></label>
        <hr class="section-divider">
        <form id="ics-form" class="form-stack" onsubmit="return false">
          <div><h3>Exportar para a agenda do celular</h3>
            <p class="card-description">Alarmes garantidos: gera um arquivo .ics com a grade semanal repetida no período, aceito por Google Agenda, Apple Calendário e Outlook.</p></div>
          <div class="form-grid">
            <label>De<input type="date" name="start" required value="${L.toISODate(start)}"></label>
            <label>Até<input type="date" name="end" required value="${L.toISODate(L.addDays(start, 17 * 7))}"></label>
          </div>
          <label>Alarme antes da aula<select name="lead">${[10, 15, 30, 60].map((minutes) => `<option value="${minutes}" ${minutes === 15 ? "selected" : ""}>${minutes} minutos</option>`).join("")}</select></label>
          <button type="button" class="button button-secondary" data-action="export-ics">Baixar calendário (.ics)</button>
        </form>
      </section>`;
  }

  // ------------------------------------------------------------------ Home: alertas e primeiros passos

  function renderOnboarding() {
    const hasInstitution = state.institutions.length > 0;
    const hasLink = state.institutions.some((item) => safeHttpUrl(item.defaultPontoUrl)) || state.pontoRules.length > 0;
    const hasClass = state.classes.some((item) => item.semester === state.activeSemester);
    if (hasInstitution && hasLink && hasClass) return "";
    const step = (done, title, text, button) => `
      <li class="check-step ${done ? "is-done" : ""}"><span class="step-mark" aria-hidden="true">${done ? "✓" : ""}</span>
        <div><strong>${title}</strong><small>${text}</small></div>${done ? "" : button}</li>`;
    return `
      <section class="card alert-card is-primary">
        <span class="eyebrow">COMECE AQUI</span><h2>Configure o Pontual em 3 passos</h2>
        <ol class="check-steps">
          ${step(hasInstitution, "Cadastre sua instituição", "Nome e link do portal de ponto.", `<button type="button" class="button button-primary button-small" data-action="go-page" data-target="settings">Abrir Ajustes</button>`)}
          ${step(hasLink, "Informe o link do ponto", "Para o botão “Abrir sistema de ponto” funcionar.", `<button type="button" class="button button-secondary button-small" data-action="go-page" data-target="settings">Configurar</button>`)}
          ${step(hasClass, "Adicione suas aulas", "Uma a uma ou importando uma planilha.", `<button type="button" class="button button-secondary button-small" data-action="add-class">Nova aula</button> <button type="button" class="button button-quiet button-small" data-action="go-page" data-target="data">Importar planilha</button>`)}
        </ol>
      </section>`;
  }

  function renderHomeAlerts() {
    const now = new Date();
    const cards = [renderOnboarding()];
    state.pontoLogs.filter((log) => log.confirmed === null && log.at && Date.now() - log.at < SIX_HOURS).slice(0, 2).forEach((log) => {
      cards.push(`
        <section class="card alert-card is-info">
          <span class="eyebrow">CONFIRMAR PONTO</span>
          <h2>Você concluiu o registro de ${escapeHTML(log.phase.toLowerCase())}?</h2>
          <p class="card-description">${escapeHTML(log.subject)} · ${escapeHTML(log.institutionName)}</p>
          <div class="alert-actions"><button type="button" class="button button-primary button-small" data-action="confirm-ponto" data-id="${escapeHTML(log.id)}" data-value="true">Sim, registrei</button>
            <button type="button" class="button button-quiet button-small" data-action="confirm-ponto" data-id="${escapeHTML(log.id)}" data-value="false">Ainda não</button></div>
        </section>`);
    });
    const missing = L.missingPonto(sortedClasses(), state.pontoLogs.filter((log) => log.classId), now);
    if (missing.length) {
      cards.push(`
        <section class="card alert-card is-warning">
          <span class="eyebrow">PONTO PENDENTE</span><h2>Possível ponto esquecido hoje</h2>
          <div class="item-list">${missing.slice(0, 4).map(({ item, phase }) => {
            const link = resolvePontoUrl(item).url;
            return `<div class="data-row"><div class="data-row-copy"><strong>${escapeHTML(phase)} · ${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.startTime)}–${escapeHTML(item.endTime)} · ${escapeHTML(institutionName(item.institutionId))}</small></div>
              <div class="data-row-actions">${link ? `<a class="button button-quiet button-small" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ""}
              <button type="button" class="button button-secondary button-small" data-action="manual-ponto" data-class-id="${escapeHTML(item.id)}" data-phase="${escapeHTML(phase)}">Já registrei</button></div></div>`;
          }).join("")}</div>
        </section>`);
    }
    const gaps = todayDiaryGaps(now);
    if (gaps.length) {
      cards.push(`
        <section class="card alert-card is-primary">
          <span class="eyebrow">DIÁRIO</span><h2>${gaps.length === 1 ? "1 aula de hoje" : `${gaps.length} aulas de hoje`} sem registro</h2>
          <p class="card-description">Anote o conteúdo agora, enquanto está fresco.</p>
          <div class="alert-actions">${gaps.slice(0, 3).map((item) => `<button type="button" class="button button-primary button-small" data-action="add-diary" data-class-id="${escapeHTML(item.id)}" data-date="${todayISO()}">${escapeHTML(item.subject)}</button>`).join("")}</div>
        </section>`);
    }
    if (needsBackup()) {
      cards.push(`
        <section class="card alert-card is-warning">
          <span class="eyebrow">BACKUP</span><h2>Seus dados só existem neste aparelho</h2>
          <p class="card-description">Último backup: ${escapeHTML(backupText())}. Exporte um arquivo para não perder grade e diário.</p>
          <div class="alert-actions"><button type="button" class="button button-primary button-small" data-action="export-backup">Fazer backup agora</button></div>
        </section>`);
    }
    const html = cards.filter(Boolean).join("");
    return html ? `<div class="alert-stack">${html}</div>` : "";
  }

  // ------------------------------------------------------------------ Grade: carga horária, conflitos, semana

  function conflictNames(item) {
    return (conflictMap[item.id] || []).map((id) => state.classes.find((entry) => entry.id === id)?.subject).filter(Boolean);
  }

  function renderScheduleSummary() {
    const classes = sortedClasses();
    if (!classes.length) return "";
    const load = L.weeklyWorkload(classes);
    const conflicts = classes.filter((item) => conflictMap[item.id]);
    const perInstitution = Object.entries(load.perInstitution)
      .map(([id, minutes]) => `<span class="tag">${escapeHTML(institutionName(id))}: ${escapeHTML(L.formatDuration(minutes))}</span>`).join("");
    return `
      <section class="card summary-card">
        <div class="card-heading"><div><span class="eyebrow">CARGA SEMANAL</span><h2>${escapeHTML(L.formatDuration(load.minutes))} <small class="muted">· ${load.periods} aulas de 50 min</small></h2></div>
          <div class="segmented" role="group" aria-label="Modo de exibição">
            <button type="button" data-action="schedule-view" data-view="list" aria-pressed="${scheduleView === "list"}">Lista</button>
            <button type="button" data-action="schedule-view" data-view="week" aria-pressed="${scheduleView === "week"}">Semana</button>
          </div></div>
        <div class="class-tags">${perInstitution}</div>
        ${conflicts.length ? `<div class="notice is-danger"><strong>Conflito de horário:</strong> ${escapeHTML([...new Set(conflicts.map((item) => `${item.subject} (${L.DAY_SHORT[item.dayOfWeek]} ${item.startTime})`))].join(", "))}.</div>` : ""}
      </section>`;
  }

  function renderWeekView() {
    const classes = sortedClasses();
    const days = [1, 2, 3, 4, 5, 6];
    if (classes.some((item) => Number(item.dayOfWeek) === 0)) days.push(0);
    const first = Math.floor(Math.min(...classes.map((item) => L.timeToMinutes(item.startTime))) / 60) * 60;
    const last = Math.ceil(Math.max(...classes.map((item) => L.timeToMinutes(item.endTime))) / 60) * 60;
    const height = (last - first) * WEEK_SCALE;
    const hours = [];
    for (let minute = first; minute < last; minute += 60) hours.push(minute);
    const today = new Date().getDay();
    const block = (item) => {
      const cluster = [item.id, ...(conflictMap[item.id] || [])].sort();
      const width = 100 / cluster.length;
      const left = cluster.indexOf(item.id) * width;
      const top = (L.timeToMinutes(item.startTime) - first) * WEEK_SCALE;
      const size = Math.max(28, L.durationMinutes(item) * WEEK_SCALE - 2);
      return `<button type="button" class="week-block ${conflictMap[item.id] ? "is-conflict" : ""}" data-action="edit-class" data-id="${escapeHTML(item.id)}"
        style="top:${top}px;height:${size}px;left:calc(${left}% + 2px);width:calc(${width}% - 4px)" aria-label="${escapeHTML(item.subject)}, ${escapeHTML(item.startTime)} às ${escapeHTML(item.endTime)}. Editar">
        <strong>${escapeHTML(item.subject)}</strong><small>${escapeHTML(item.startTime)}–${escapeHTML(item.endTime)}</small></button>`;
    };
    return `
      <section class="card week-card">
        <div class="week-scroll" tabindex="0" aria-label="Grade semanal">
          <div class="week-grid" style="--cols:${days.length};--week-height:${height}px">
            <div class="week-corner"></div>
            ${days.map((day) => `<div class="week-dayhead ${day === today ? "is-today" : ""}">${L.DAY_SHORT[day]}</div>`).join("")}
            <div class="week-axis">${hours.map((minute) => `<span style="top:${(minute - first) * WEEK_SCALE}px">${L.minutesToTime(minute)}</span>`).join("")}</div>
            ${days.map((day) => `<div class="week-col ${day === today ? "is-today" : ""}">${classes.filter((item) => Number(item.dayOfWeek) === day).map(block).join("")}</div>`).join("")}
          </div>
        </div>
      </section>`;
  }

  // ------------------------------------------------------------------ Planilha de aulas

  function renderSheetImport() {
    return `
      <section class="card settings-section">
        <div><span class="eyebrow">IMPORTAR GRADE</span><h2>Planilha de aulas</h2>
          <p class="card-description">Preencha no Excel/Planilhas e importe de uma vez. Colunas: Disciplina, Instituição, Dia, Início, Término (opcionais: Turno, Campus, Espaço, Sala, Observações). Salve como CSV.</p></div>
        <button type="button" class="button button-secondary button-wide" data-action="download-sheet-template">⇩ Baixar modelo (.csv)</button>
        <button type="button" class="button button-primary button-wide" data-action="import-sheet">＋ Importar planilha de aulas</button>
      </section>`;
  }

  async function importSheet(file) {
    const { rows, errors } = L.parseClassSheet(await file.text());
    if (!rows.length) throw new Error(errors[0] || "Nenhuma aula encontrada na planilha.");
    const ignored = errors.length ? `\n\n${errors.length} linha(s) serão ignoradas:\n- ${errors.slice(0, 5).join("\n- ")}` : "";
    if (!window.confirm(`Importar ${rows.length} aula(s) para o semestre ${state.activeSemester}?${ignored}`)) return;
    await changeState((next) => {
      const norm = (value) => String(value).trim().toLocaleLowerCase("pt-BR");
      rows.forEach((row) => {
        const name = row.institution || next.institutions[0]?.name || "Minha instituição";
        let institution = next.institutions.find((entry) => norm(entry.name) === norm(name));
        if (!institution) {
          institution = { id: makeId("institution"), name, logoUri: "", defaultPontoUrl: "" };
          next.institutions.push(institution);
        }
        next.classes.push({
          id: makeId("class"), semester: next.activeSemester, institutionId: institution.id, dayOfWeek: row.dayOfWeek,
          shift: row.shift, startTime: row.startTime, endTime: row.endTime, subject: row.subject, campus: row.campus,
          roomType: row.roomType, roomNumber: row.roomNumber, notes: row.notes,
        });
      });
    }, `${rows.length} aula(s) importada(s). Configure o link de ponto das novas instituições em Ajustes.`);
  }

  // ------------------------------------------------------------------ Dispatcher das novas ações

  function handleExtraAction(action, button) {
    const { id } = button.dataset;
    switch (action) {
      case "go-page": setPage(button.dataset.target, true); return true;
      case "set-diary-filter": diaryFilter = button.dataset.filter; render(); return true;
      case "add-diary": openDiaryDialog({ classId: button.dataset.classId, date: button.dataset.date }); return true;
      case "edit-diary": openDiaryDialog({ id }); return true;
      case "close-diary": diaryDialog.close(); return true;
      case "save-diary": saveDiary(); return true;
      case "delete-diary": deleteDiary(); return true;
      case "plan-diary": openPlanDialog(); return true;
      case "close-plan": planDialog.close(); return true;
      case "save-plan": savePlan(); return true;
      case "copy-diary": copyDiary(); return true;
      case "copy-field": copyDiaryField(id, button.dataset.field); return true;
      case "export-diary": exportDiary(); return true;
      case "export-diary-all": exportDiaryAll(); return true;
      case "print-diary": printDiary(); return true;
      case "schedule-view": scheduleView = button.dataset.view; render(); return true;
      case "toggle-reminders": toggleReminders(); return true;
      case "export-ics": exportICS(); return true;
      case "confirm-ponto": setPontoConfirmation(id, button.dataset.value === "true"); return true;
      case "manual-ponto": addManualPonto(button.dataset.classId, button.dataset.phase); return true;
      case "export-logs": exportLogs(); return true;
      case "persist-storage": protectStorage(); return true;
      case "download-sheet-template":
        downloadText("pontual_modelo_grade.csv", L.classSheetTemplate());
        return true;
      case "import-sheet": document.getElementById("sheet-file").click(); return true;
      default: return false;
    }
  }

  function handleExtraChange(event) {
    const target = event.target;
    if (target.matches?.("[data-diary-select]")) {
      diaryTurma = target.value;
      render();
      return true;
    }
    if (target.dataset?.setting === "reminderLead") {
      changeState((next) => { next.settings.reminderLead = Number(target.value) || 5; }, "Antecedência atualizada.");
      return true;
    }
    if (target.id === "sheet-file" && target.files?.[0]) {
      importSheet(target.files[0])
        .catch((error) => showToast(`Não foi possível importar: ${error.message}`))
        .finally(() => { target.value = ""; });
      return true;
    }
    if (target.form === diaryForm && ["date", "turma"].includes(target.name) && !diaryEditingId) {
      autofillDiaryPeriods();
      return true;
    }
    return false;
  }

  function render() {
    renderHeader();
    conflictMap = L.detectConflicts(sortedClasses());
    main.innerHTML = ({
      home: renderHome, schedule: renderSchedule, diary: renderDiary, settings: renderSettings, data: renderData,
    }[activePage] || renderHome)();
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.page === activePage);
      if (button.dataset.page === activePage) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function setPage(page, focusMain = false) {
    if (!["home", "schedule", "diary", "settings", "data"].includes(page)) return;
    activePage = page;
    render();
    if (focusMain) main.focus();
  }

  function setFormValue(form, name, value) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value ?? "";
  }

  function fillClassDialog(classId = "") {
    if (!state.institutions.length) {
      showToast("Cadastre ou importe uma instituição antes de criar aulas.");
      return;
    }
    const item = state.classes.find((entry) => entry.id === classId);
    classForm.reset();
    classForm.elements.namedItem("institutionId").innerHTML = renderInstitutionOptions(item?.institutionId || state.institutions[0].id);
    classForm.elements.namedItem("dayOfWeek").innerHTML = DAY_NAMES
      .map((day, index) => `<option value="${index}">${escapeHTML(day)}</option>`).join("");
    if (item) {
      Object.entries(item).forEach(([key, value]) => setFormValue(classForm, key, value));
      document.getElementById("class-dialog-title").textContent = "Editar aula";
    } else {
      setFormValue(classForm, "semester", state.activeSemester);
      setFormValue(classForm, "dayOfWeek", selectedDay);
      setFormValue(classForm, "startTime", "08:15");
      setFormValue(classForm, "endTime", "11:00");
      document.getElementById("class-dialog-title").textContent = "Nova aula";
    }
    dialog.showModal();
    classForm.elements.namedItem("subject").focus();
  }

  function clearInstitutionForm() {
    editingInstitutionId = "";
    pendingInstitutionLogo = "";
    render();
  }

  async function readImageFile(file) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("A imagem deve ter no máximo 2 MB para manter o banco local leve.");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem."));
      reader.readAsDataURL(file);
    });
  }

  async function handleProfilePhoto(file) {
    const photoUri = await readImageFile(file);
    await changeState((next) => {
      next.userProfile.photoUri = photoUri;
    }, "Foto de perfil salva neste dispositivo.");
  }

  async function handleInstitutionLogo(file) {
    pendingInstitutionLogo = await readImageFile(file);
    render();
  }

  function handleClassSubmit() {
    if (!classForm.reportValidity()) return;
    const formData = new FormData(classForm);
    const startTime = String(formData.get("startTime") || "");
    const endTime = String(formData.get("endTime") || "");
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      showToast("O horário de término precisa ser posterior ao início.");
      return;
    }
    const id = String(formData.get("id") || makeId("class"));
    const item = {
      id,
      semester: state.activeSemester,
      institutionId: String(formData.get("institutionId")),
      dayOfWeek: Number(formData.get("dayOfWeek")),
      shift: String(formData.get("shift")),
      startTime,
      endTime,
      subject: String(formData.get("subject") || "").trim(),
      campus: String(formData.get("campus") || "").trim(),
      roomType: String(formData.get("roomType")),
      roomNumber: String(formData.get("roomNumber") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
    };
    const previous = state.classes.find((entry) => entry.id === id);
    const clashes = L.detectConflicts([...state.classes.filter((entry) => entry.id !== id), item])[id] || [];
    const clashNames = clashes.map((other) => state.classes.find((entry) => entry.id === other)?.subject).filter(Boolean);
    changeState((next) => {
      const index = next.classes.findIndex((entry) => entry.id === id);
      if (index >= 0) next.classes[index] = item;
      else next.classes.push(item);
      if (previous && (previous.subject !== item.subject || previous.institutionId !== item.institutionId) &&
        !next.classes.some((entry) => entry.id !== id && L.diaryKey(entry) === L.diaryKey(previous))) {
        next.diary = L.renumberAll(next.diary.map((entry) => (L.diaryKey(entry) === L.diaryKey(previous)
          ? { ...entry, subject: item.subject, institutionId: item.institutionId } : entry)));
      }
    }, clashNames.length ? `Aula salva, mas conflita com: ${clashNames.join(", ")}.` : "Aula salva na grade deste dispositivo.");
    dialog.close();
  }

  function handleProfileSubmit() {
    const form = document.getElementById("profile-form");
    const data = new FormData(form);
    changeState((next) => {
      next.userProfile.name = String(data.get("name") || "").trim();
      next.userProfile.role = String(data.get("role") || "").trim();
    }, "Perfil salvo neste dispositivo.");
  }

  function handleInstitutionSubmit() {
    const form = document.getElementById("institution-form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const id = String(data.get("id") || makeId("institution"));
    const institution = {
      id,
      name: String(data.get("name") || "").trim(),
      logoUri: pendingInstitutionLogo || state.institutions.find((item) => item.id === id)?.logoUri || "",
      defaultPontoUrl: String(data.get("defaultPontoUrl") || "").trim(),
    };
    if (institution.defaultPontoUrl && !safeHttpUrl(institution.defaultPontoUrl)) {
      showToast("Informe uma URL válida iniciada por http:// ou https://.");
      return;
    }
    changeState((next) => {
      const index = next.institutions.findIndex((entry) => entry.id === id);
      if (index >= 0) next.institutions[index] = institution;
      else next.institutions.push(institution);
    }, "Instituição salva neste dispositivo.");
    clearInstitutionForm();
  }

  function handleRuleSubmit() {
    const form = document.getElementById("rule-form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const url = safeHttpUrl(String(data.get("url") || ""));
    if (!url) {
      showToast("Informe uma URL válida iniciada por http:// ou https://.");
      return;
    }
    const rule = {
      id: makeId("rule"),
      institutionId: String(data.get("institutionId") || ""),
      dayOfWeek: String(data.get("dayOfWeek") || "ALL"),
      shift: String(data.get("shift") || "ALL"),
      url,
    };
    changeState((next) => {
      const existing = next.pontoRules.findIndex((item) =>
        item.institutionId === rule.institutionId &&
        item.dayOfWeek === rule.dayOfWeek &&
        item.shift === rule.shift
      );
      if (existing >= 0) {
        rule.id = next.pontoRules[existing].id;
        next.pontoRules[existing] = rule;
      } else {
        next.pontoRules.push(rule);
      }
    }, "Regra de ponto salva neste dispositivo.");
    form.reset();
  }

  function handleSemesterSubmit() {
    const form = document.getElementById("semester-form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const semester = String(data.get("semester") || "").trim();
    if (!semester) return;
    const clone = data.get("clone") === "on";
    changeState((next) => {
      if (!next.semesters.includes(semester)) next.semesters.push(semester);
      if (clone) {
        const source = next.classes.filter((item) => item.semester === next.activeSemester);
        source.forEach((item) => next.classes.push({ ...item, id: makeId("class"), semester }));
      }
      next.activeSemester = semester;
    }, `Semestre ${semester} ativado.`);
  }

  function exportBackup() {
    state = { ...state, settings: { ...state.settings, lastBackupAt: new Date().toISOString() } };
    persistState().catch(() => {});
    const content = JSON.stringify(state, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pontual_backup_${state.activeSemester.replace(/[^\w-]/g, "-")}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exportado. O arquivo não foi enviado ao servidor.");
    render();
  }

  async function importBackup(file) {
    const text = await file.text();
    let imported;
    try {
      imported = normalizeSnapshot(JSON.parse(text));
    } catch (error) {
      throw new Error(error instanceof SyntaxError ? "O arquivo não contém um JSON válido." : error.message);
    }
    if (!window.confirm("Importar vai substituir os dados deste navegador. Deseja continuar?")) return;
    state = imported;
    await persistState();
    editingInstitutionId = "";
    pendingInstitutionLogo = "";
    render();
    showToast("Backup importado e salvo localmente neste navegador.");
  }

  async function recordPonto(item) {
    const pointLink = resolvePontoUrl(item);
    if (!pointLink.url) return;
    const evaluation = evaluateClass(item, new Date().getHours() * 60 + new Date().getMinutes());
    const phase = evaluation.phase === "Saída" ? "Saída" : "Entrada";
    await changeState((next) => {
      next.pontoLogs.unshift({
        id: makeId("log"),
        classId: item.id,
        isoDate: L.toISODate(new Date()),
        at: Date.now(),
        confirmed: null,
        timestamp: new Date().toLocaleString("pt-BR"),
        institutionName: institutionName(item.institutionId),
        shift: item.shift,
        phase,
        subject: item.subject,
        campus: item.campus,
        url: pointLink.url,
      });
    }, "Batida anotada no histórico local.");
  }

  function handleClick(event) {
    const themeButton = event.target.closest("[data-theme-choice]");
    if (themeButton) {
      setTheme(themeButton.dataset.themeChoice);
      return;
    }
    const navButton = event.target.closest("[data-page]");
    if (navButton) {
      setPage(navButton.dataset.page);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (handleExtraAction(action, button, event)) return;

    if (action === "select-day") {
      selectedDay = Number(button.dataset.day);
      render();
    } else if (action === "add-class") {
      fillClassDialog();
    } else if (action === "edit-class") {
      fillClassDialog(id);
    } else if (action === "close-class") {
      dialog.close();
    } else if (action === "delete-class") {
      const item = state.classes.find((entry) => entry.id === id);
      if (item && window.confirm(`Excluir “${item.subject}” da grade?`)) {
        changeState((next) => { next.classes = next.classes.filter((entry) => entry.id !== id); }, "Aula removida.");
      }
    } else if (action === "edit-profile") {
      setPage("settings", true);
      window.setTimeout(() => document.querySelector('#profile-form input[name="name"]')?.focus(), 0);
    } else if (action === "edit-institution") {
      const institution = state.institutions.find((entry) => entry.id === id);
      if (institution) {
        editingInstitutionId = id;
        pendingInstitutionLogo = institution.logoUri || "";
        render();
        const form = document.getElementById("institution-form");
        setFormValue(form, "name", institution.name);
        setFormValue(form, "defaultPontoUrl", institution.defaultPontoUrl);
        form.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (action === "cancel-institution-edit") {
      clearInstitutionForm();
    } else if (action === "delete-institution") {
      const referenced = state.classes.some((item) => item.institutionId === id) || state.pontoRules.some((item) => item.institutionId === id);
      if (referenced) {
        showToast("Antes de excluir, remova ou reassocie as aulas e regras desta instituição.");
      } else if (window.confirm("Excluir esta instituição?")) {
        changeState((next) => { next.institutions = next.institutions.filter((item) => item.id !== id); }, "Instituição removida.");
      }
    } else if (action === "delete-rule") {
      if (window.confirm("Excluir esta regra de ponto?")) {
        changeState((next) => { next.pontoRules = next.pontoRules.filter((item) => item.id !== id); }, "Regra removida.");
      }
    } else if (action === "activate-semester") {
      changeState((next) => { next.activeSemester = button.dataset.semester; }, `Semestre ${button.dataset.semester} ativado.`);
    } else if (action === "select-profile-photo") {
      document.getElementById("profile-photo-file").click();
    } else if (action === "select-institution-logo") {
      document.getElementById("institution-logo-file").click();
    } else if (action === "save-class") {
      handleClassSubmit();
    } else if (action === "save-profile") {
      handleProfileSubmit();
    } else if (action === "save-institution") {
      handleInstitutionSubmit();
    } else if (action === "save-rule") {
      handleRuleSubmit();
    } else if (action === "create-semester") {
      handleSemesterSubmit();
    } else if (action === "export-backup") {
      exportBackup();
    } else if (action === "import-backup") {
      document.getElementById("backup-file").click();
    } else if (action === "record-ponto") {
      const item = state.classes.find((entry) => entry.id === button.dataset.classId);
      if (item) {
        event.preventDefault();
        const pointLink = resolvePontoUrl(item);
        if (pointLink.url) window.open(pointLink.url, "_blank", "noopener,noreferrer");
        recordPonto(item).catch((error) => showToast(`Falha ao salvar no histórico local: ${error.message}`));
      }
    }
  }

  function handleFormKeydown(event) {
    if (event.key !== "Enter" || event.target.tagName === "TEXTAREA") return;
    const form = event.target.closest("form");
    const saveButton = form?.querySelector('[data-action^="save-"], [data-action="create-semester"]');
    if (saveButton) {
      event.preventDefault();
      saveButton.click();
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (handleExtraChange(event)) return;
    if (target === semesterSelect) {
      changeState((next) => { next.activeSemester = semesterSelect.value; }, `Semestre ${semesterSelect.value} ativado.`);
    } else if (target.id === "backup-file" && target.files?.[0]) {
      importBackup(target.files[0])
        .catch((error) => showToast(`Não foi possível importar: ${error.message}`))
        .finally(() => { target.value = ""; });
    } else if (target.id === "profile-photo-file" && target.files?.[0]) {
      handleProfilePhoto(target.files[0])
        .catch((error) => showToast(`Não foi possível salvar a foto: ${error.message}`))
        .finally(() => { target.value = ""; });
    } else if (target.id === "institution-logo-file" && target.files?.[0]) {
      handleInstitutionLogo(target.files[0])
        .catch((error) => showToast(`Não foi possível ler a logo: ${error.message}`))
        .finally(() => { target.value = ""; });
    }
  }

  async function initialize() {
    const savedTheme = (() => {
      try { return localStorage.getItem("pontual-theme"); } catch { return null; }
    })();
    setTheme(savedTheme || "rubro");
    database = await openDatabase();
    const saved = await readStoredSnapshot();
    if (saved !== null) {
      state = normalizeSnapshot(saved);
    } else {
      const legacyText = localStorage.getItem(LEGACY_KEY);
      if (legacyText) {
        state = normalizeSnapshot(JSON.parse(legacyText));
        await persistState();
        localStorage.removeItem(LEGACY_KEY);
      } else {
        state = emptySnapshot();
        await persistState();
      }
    }
    const requestedPage = new URLSearchParams(window.location.search).get("page");
    if (requestedPage) setPage(requestedPage);
    else render();
    scheduleReminders();
    navigator.storage?.persisted?.().then((value) => {
      storagePersisted = value;
      if (!value && (state.classes.length || state.diary.length)) navigator.storage.persist?.().then((granted) => { storagePersisted = granted; }).catch(() => {});
    }).catch(() => {});
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js")
        .catch((error) => showToast(`O modo offline não pôde ser ativado: ${error.message}`));
    }
    window.setInterval(() => {
      if (activePage === "home") render();
    }, 60_000);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !state) return;
    scheduleReminders();
    const waiting = state.pontoLogs.some((log) => log.confirmed === null && log.at && Date.now() - log.at < 30 * 60 * 1000);
    if (waiting && activePage !== "home") setPage("home");
    else if (activePage === "home") render();
  });
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("keydown", handleFormKeydown);

  initialize().catch((error) => {
    main.innerHTML = `<section class="card"><span class="eyebrow">ARMAZENAMENTO LOCAL</span><h1>Não foi possível abrir seus dados.</h1><p class="card-description">${escapeHTML(error.message)} Atualize a página ou tente outro navegador. Seus dados não foram enviados nem substituídos.</p></section>`;
    showToast("Falha ao inicializar o banco local.");
  });
})();
