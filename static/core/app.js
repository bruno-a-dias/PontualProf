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

  const emptySnapshot = () => ({
    activeSemester: "2027/1",
    semesters: ["2027/1"],
    userProfile: { name: "", role: "", photoUri: "" },
    institutions: [],
    pontoRules: [],
    classes: [],
    pontoLogs: [],
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
    if (
      !value.semesters.every(validString) ||
      !value.institutions.every(validInstitution) ||
      !value.pontoRules.every(validRule) ||
      !value.classes.every(validClass) ||
      !value.pontoLogs.every(validLog)
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

  function renderClassCard(item, actions = true) {
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
          </div>
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
      ? `<div class="class-list">${classes.map((item) => renderClassCard(item, false)).join("")}</div>`
      : renderEmpty("Sem aulas neste dia", "Adicione uma aula à grade ou importe seu backup local.", `<button type="button" class="button button-secondary" data-action="add-class">Adicionar aula</button>`);

    return `
      <div class="page-stack">
        <div class="page-heading">
          <div><span class="eyebrow">VISÃO DO DIA</span><h1>Olá${profile.name.trim() ? `, ${escapeHTML(profile.name.trim().split(/\s+/)[0])}` : ""}.</h1><p>${escapeHTML(todayLabel)} · semestre ${escapeHTML(state.activeSemester)}</p></div>
        </div>

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
            <div class="status-copy"><strong>${escapeHTML(evaluation?.label || "Nenhuma aula para este dia")}</strong><small>${activeClass ? `${escapeHTML(activeClass.startTime)}–${escapeHTML(activeClass.endTime)} · janela de ponto ±15 min` : "Cadastre uma aula ou importe os seus dados."}</small></div>
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

        <section class="day-strip" aria-label="Selecionar dia da semana">
          ${DAY_SHORT.map((day, index) => `<button type="button" class="day-button" data-action="select-day" data-day="${index}" aria-pressed="${selectedDay === index}"><span>${day}</span><small>${index === now.getDay() ? "Hoje" : ""}</small></button>`).join("")}
        </section>

        <section class="page-stack" aria-labelledby="today-classes-title">
          <div class="card-heading"><h2 id="today-classes-title">Aulas de ${escapeHTML(selectedDayLabel)}</h2><button type="button" class="button button-quiet button-small" data-action="add-class">＋ Aula</button></div>
          ${todayClasses}
        </section>
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
        ${groups || renderEmpty("Sua grade está vazia", "Importe o backup do app anterior ou cadastre a primeira aula.", `<button type="button" class="button button-primary" data-action="add-class">Cadastrar aula</button>`)}
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

        <section class="card settings-section">
          <div><span class="eyebrow">PERÍODO LETIVO</span><h2>Semestres</h2><p class="card-description">O novo período pode iniciar com uma cópia da grade ativa.</p></div>
          <div class="class-tags">${state.semesters.map((semester) => `<button type="button" class="tag ${semester === state.activeSemester ? "is-accent" : ""}" data-action="activate-semester" data-semester="${escapeHTML(semester)}">${escapeHTML(semester)}${semester === state.activeSemester ? " · ativo" : ""}</button>`).join("")}</div>
          <form id="semester-form" class="form-stack" onsubmit="return false">
            <div class="inline-form"><label>Novo semestre<input name="semester" required maxlength="20" placeholder="Ex.: 2027/2"></label><button type="button" class="button button-secondary" data-action="create-semester">Criar</button></div>
            <label class="check-row"><input type="checkbox" name="clone" checked> Clonar aulas do semestre ativo</label>
          </form>
        </section>
      </div>`;
  }

  function renderData() {
    const logs = state.pontoLogs.map((entry) => `
      <div class="data-row log-row"><div class="data-row-copy"><strong>${escapeHTML(entry.institutionName)} · ${escapeHTML(entry.phase)}</strong><small>${escapeHTML(entry.subject)} · ${escapeHTML(entry.campus)}</small></div><time>${escapeHTML(entry.timestamp)}</time></div>`).join("");
    return `
      <div class="page-stack">
        <div class="page-heading"><div><span class="eyebrow">ARMAZENAMENTO LOCAL</span><h1>Seus dados.</h1><p>Privados neste navegador. Não são enviados ao Django.</p></div></div>

        <section class="card">
          <div class="card-heading"><div><span class="eyebrow">NESTE DISPOSITIVO</span><h2>Visão geral</h2></div><span class="tag is-accent">IndexedDB</span></div>
          <div class="stats-grid">
            <div class="stat"><strong>${state.classes.length}</strong><small>Aulas</small></div>
            <div class="stat"><strong>${state.institutions.length}</strong><small>Instituições</small></div>
            <div class="stat"><strong>${state.pontoLogs.length}</strong><small>Batidas</small></div>
          </div>
          <p class="card-description">Cada navegador mantém seu próprio banco. Para levar seus dados a outro aparelho, exporte o JSON aqui e importe-o no destino.</p>
        </section>

        <section class="card settings-section">
          <div><span class="eyebrow">BACKUP PORTÁTIL</span><h2>Exportar ou importar</h2><p class="card-description">O arquivo é lido e gravado localmente; não há envio ao servidor.</p></div>
          <button type="button" class="button button-primary button-wide" data-action="export-backup">⇩ Exportar backup JSON</button>
          <button type="button" class="button button-secondary button-wide" data-action="import-backup">＋ Importar backup JSON</button>
          <div class="notice"><strong>Atenção:</strong> importar substitui os dados deste navegador. Faça um backup antes de trocar o conteúdo.</div>
        </section>

        <section class="card settings-section">
          <div><span class="eyebrow">HISTÓRICO LOCAL</span><h2>Batidas de ponto</h2></div>
          ${logs ? `<div class="item-list">${logs}</div>` : renderEmpty("Nenhuma batida registrada", "Ao abrir o portal pelo botão de ponto, o evento será anotado aqui.")}
        </section>
      </div>`;
  }

  function render() {
    renderHeader();
    main.innerHTML = activePage === "home"
      ? renderHome()
      : activePage === "schedule"
        ? renderSchedule()
        : activePage === "settings"
          ? renderSettings()
          : renderData();
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.page === activePage);
      if (button.dataset.page === activePage) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function setPage(page, focusMain = false) {
    if (!["home", "schedule", "settings", "data"].includes(page)) return;
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
    changeState((next) => {
      const index = next.classes.findIndex((entry) => entry.id === id);
      if (index >= 0) next.classes[index] = item;
      else next.classes.push(item);
    }, "Aula salva na grade deste dispositivo.");
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
    render();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js")
        .catch((error) => showToast(`O modo offline não pôde ser ativado: ${error.message}`));
    }
    window.setInterval(() => {
      if (activePage === "home") render();
    }, 60_000);
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("keydown", handleFormKeydown);

  initialize().catch((error) => {
    main.innerHTML = `<section class="card"><span class="eyebrow">ARMAZENAMENTO LOCAL</span><h1>Não foi possível abrir seus dados.</h1><p class="card-description">${escapeHTML(error.message)} Atualize a página ou tente outro navegador. Seus dados não foram enviados nem substituídos.</p></section>`;
    showToast("Falha ao inicializar o banco local.");
  });
})();
