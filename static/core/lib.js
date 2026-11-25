/* Pontual — pure helpers (no DOM, no storage). Works in the browser and in Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PontualLib = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const SHIFT_NAMES = ["Matutino", "Especial", "Vespertino", "Noturno"];

  /** Diary statuses. `counts` decides whether the lesson advances the lesson number. */
  const DIARY_STATUSES = [
    { value: "Realizada", counts: true },
    { value: "Reposição", counts: true },
    { value: "Prevista", counts: true },
    { value: "Falta do professor", counts: false },
    { value: "Sem aula (feriado/recesso)", counts: false },
  ];
  const STATUS_COUNTS = Object.fromEntries(DIARY_STATUSES.map((item) => [item.value, item.counts]));

  const pad = (value) => String(value).padStart(2, "0");

  function timeToMinutes(value) {
    const [hour, minute] = String(value || "00:00").split(":").map(Number);
    return (hour || 0) * 60 + (minute || 0);
  }

  function minutesToTime(value) {
    const normalized = ((value % 1440) + 1440) % 1440;
    return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
  }

  /** Local date as YYYY-MM-DD (never UTC, so late-evening classes keep their day). */
  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseISODate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return toISODate(date) === value ? date : null;
  }

  function formatBR(value) {
    const date = parseISODate(value);
    return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : String(value || "");
  }

  function addDays(date, amount) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  /** Most recent date (today included) that falls on the given weekday. */
  function latestDateForWeekday(weekday, today = new Date()) {
    const diff = (today.getDay() - Number(weekday) + 7) % 7;
    return addDays(today, -diff);
  }

  /** Every date in [start, end] (ISO strings) that falls on the weekday. */
  function datesForWeekday(startISO, endISO, weekday) {
    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    if (!start || !end || end < start) return [];
    const first = addDays(start, (Number(weekday) - start.getDay() + 7) % 7);
    const dates = [];
    for (let cursor = first; cursor <= end; cursor = addDays(cursor, 7)) dates.push(toISODate(cursor));
    return dates;
  }

  // ---------------------------------------------------------------- CSV / TSV

  function csvCell(value, delimiter) {
    let text = String(value ?? "");
    // Neutralise spreadsheet formula injection when opened in Excel/Sheets.
    if (/^[=+\-@]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
    const needsQuotes = text.includes(delimiter) || /["\r\n]/.test(text);
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
  }

  /** Semicolon + BOM is what Brazilian Excel opens correctly with accents. */
  function toCSV(rows, { delimiter = ";", bom = true } = {}) {
    const body = rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join("\r\n");
    return (bom ? "\ufeff" : "") + body + "\r\n";
  }

  /** Tab-separated text: pastes cell-by-cell into Excel, Sheets and most web grids. */
  function toTSV(rows) {
    return rows
      .map((row) => row.map((cell) => String(cell ?? "").replace(/[\t\r\n]+/g, " ").trim()).join("\t"))
      .join("\n");
  }

  function detectDelimiter(headerLine) {
    const counts = { ";": 0, ",": 0, "\t": 0 };
    let quoted = false;
    for (const character of headerLine) {
      if (character === '"') quoted = !quoted;
      else if (!quoted && character in counts) counts[character] += 1;
    }
    return Object.entries(counts).sort((left, right) => right[1] - left[1])[0][0];
  }

  function parseCSV(text) {
    const source = String(text || "").replace(/^\ufeff/, "");
    const firstLine = source.split(/\r?\n/, 1)[0] || "";
    const delimiter = detectDelimiter(firstLine);
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"') quoted = true;
      else if (character === delimiter) { row.push(cell); cell = ""; }
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(cell); cell = "";
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
      } else cell += character;
    }
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    return rows;
  }

  // ---------------------------------------------------------------- Diary

  function normalizeSubject(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  }

  /** Entries that belong to the same diary share semester + institution + subject. */
  function diaryKey(entry) {
    return `${entry.semester}|${entry.institutionId}|${normalizeSubject(entry.subject)}`;
  }

  /**
   * Re-computes the lesson numbers of one diary. Numbers follow chronological order and
   * advance by `periods` (a double class on one day is "3–4"). Skipped statuses get no number.
   */
  function renumber(entries) {
    const sorted = [...entries].sort((left, right) =>
      left.date.localeCompare(right.date) || String(left.startTime || "").localeCompare(String(right.startTime || "")));
    let counter = 0;
    return sorted.map((entry) => {
      const periods = Math.max(1, Number(entry.periods) || 1);
      if (!STATUS_COUNTS[entry.status]) return { ...entry, number: 0, numberEnd: 0 };
      const number = counter + 1;
      counter += periods;
      return { ...entry, number, numberEnd: counter };
    });
  }

  function lessonLabel(entry) {
    if (!entry.number) return "—";
    return entry.numberEnd > entry.number ? `${entry.number}–${entry.numberEnd}` : String(entry.number);
  }

  /** Re-numbers every diary inside a flat list, keeping each entry's identity. */
  function renumberAll(entries) {
    const groups = new Map();
    entries.forEach((entry) => {
      const key = diaryKey(entry);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });
    const result = [];
    groups.forEach((group) => result.push(...renumber(group)));
    return result;
  }

  function diaryRows(entries) {
    return [
      ["Nº da aula", "Data", "Conteúdo ministrado", "Observações", "Situação"],
      ...renumber(entries).map((entry) => [
        lessonLabel(entry),
        formatBR(entry.date),
        entry.content || "",
        entry.notes || "",
        entry.status,
      ]),
    ];
  }

  // ---------------------------------------------------------------- Schedule

  function durationMinutes(item) {
    return Math.max(0, timeToMinutes(item.endTime) - timeToMinutes(item.startTime));
  }

  /** Suggested number of class periods for a slot (50-minute periods, at least 1). */
  function suggestedPeriods(item) {
    return Math.max(1, Math.round(durationMinutes(item) / 50));
  }

  /** Map of class id → ids of the classes that overlap it on the same day and semester. */
  function detectConflicts(classes) {
    const conflicts = {};
    for (let i = 0; i < classes.length; i += 1) {
      for (let j = i + 1; j < classes.length; j += 1) {
        const a = classes[i];
        const b = classes[j];
        if (a.semester !== b.semester || Number(a.dayOfWeek) !== Number(b.dayOfWeek)) continue;
        if (timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime)) {
          (conflicts[a.id] ||= []).push(b.id);
          (conflicts[b.id] ||= []).push(a.id);
        }
      }
    }
    return conflicts;
  }

  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest}min`;
    return rest ? `${hours}h${pad(rest)}` : `${hours}h`;
  }

  function weeklyWorkload(classes) {
    const perInstitution = {};
    let minutes = 0;
    let periods = 0;
    classes.forEach((item) => {
      const duration = durationMinutes(item);
      minutes += duration;
      periods += suggestedPeriods(item);
      perInstitution[item.institutionId] = (perInstitution[item.institutionId] || 0) + duration;
    });
    return { minutes, periods, perInstitution };
  }

  // ---------------------------------------------------------------- Ponto

  /** Minutes before/after the class boundary during which the ponto is accepted. */
  const PONTO_WINDOW = 15;

  /**
   * Today's classes whose ponto window has already closed without a confirmed record.
   * `logs` need `classId`, `isoDate` and `phase`; a log answered "no" does not count.
   */
  function missingPonto(classes, logs, now = new Date()) {
    const today = toISODate(now);
    const current = now.getHours() * 60 + now.getMinutes();
    const missing = [];
    classes
      .filter((item) => Number(item.dayOfWeek) === now.getDay())
      .forEach((item) => {
        const recorded = (phase) => logs.some((log) =>
          log.classId === item.id && log.isoDate === today && log.phase === phase && log.confirmed !== false);
        if (current > timeToMinutes(item.startTime) + PONTO_WINDOW && !recorded("Entrada")) {
          missing.push({ item, phase: "Entrada" });
        }
        if (current > timeToMinutes(item.endTime) + PONTO_WINDOW && !recorded("Saída")) {
          missing.push({ item, phase: "Saída" });
        }
      });
    return missing;
  }

  function countdownText(item, now = new Date()) {
    const current = now.getHours() * 60 + now.getMinutes();
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    if (current < start) return `Começa em ${formatDuration(start - current)}`;
    if (current < end) return `Termina em ${formatDuration(end - current)}`;
    return "Aula encerrada";
  }

  // ---------------------------------------------------------------- Reminders / calendar

  /**
   * Notifications for the remaining ponto windows of one day.
   * They fire `lead` minutes before each window opens (entry and exit).
   */
  function reminderEvents(classes, now = new Date(), lead = 5, options = {}) {
    const events = [];
    const at = (minute) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, minute, 0, 0);
    classes
      .filter((item) => Number(item.dayOfWeek) === now.getDay())
      .forEach((item) => {
        [
          { phase: "Entrada", minute: timeToMinutes(item.startTime) - PONTO_WINDOW - lead, opens: timeToMinutes(item.startTime) - PONTO_WINDOW },
          { phase: "Saída", minute: timeToMinutes(item.endTime) - PONTO_WINDOW - lead, opens: timeToMinutes(item.endTime) - PONTO_WINDOW },
        ].forEach(({ phase, minute, opens }) => {
          const when = at(minute);
          if (when.getTime() <= now.getTime()) return;
          events.push({
            at: when,
            kind: "ponto",
            page: "home",
            tag: `pontual-${item.id}-${phase}-${toISODate(now)}`,
            title: `Ponto de ${phase.toLowerCase()} em ${lead} min`,
            body: `${item.subject} · ${item.startTime}–${item.endTime} · janela abre às ${minutesToTime(opens)}`,
          });
        });
        if (options.diary) {
          const when = at(timeToMinutes(item.endTime) + 5);
          if (when.getTime() > now.getTime()) {
            events.push({
              at: when,
              kind: "diary",
              page: "diary",
              classId: item.id,
              date: toISODate(now),
              tag: `pontual-diary-${item.id}-${toISODate(now)}`,
              title: "Aula terminou",
              body: `${item.subject}: registre o conteúdo no diário`,
            });
          }
        }
      });
    return events.sort((left, right) => left.at - right.at);
  }

  function icsEscape(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  /** RFC 5545 line folding at 75 characters. */
  function icsFold(line) {
    if (line.length <= 75) return line;
    const parts = [line.slice(0, 75)];
    for (let index = 75; index < line.length; index += 74) parts.push(` ${line.slice(index, index + 74)}`);
    return parts.join("\r\n");
  }

  function icsDateTime(date, minutes) {
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
  }

  /**
   * Weekly recurring events with an alarm. Times are "floating" (local), so the calendar app
   * shows them at the same wall-clock hour wherever the teacher is.
   */
  function buildICS({ classes = [], assessments = [], institutionName = () => "", startISO, endISO, lead = 15, now = new Date() }) {
    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    if (classes.length && (!start || !end || end < start)) throw new Error("Informe um período válido para o calendário.");
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const ymd = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    const until = end ? `${ymd(end)}T235959` : "";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pontual//Grade docente//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Pontual — Grade docente"];
    classes.forEach((item) => {
      const first = datesForWeekday(startISO, endISO, item.dayOfWeek)[0];
      if (!first) return;
      const date = parseISODate(first);
      const place = [item.roomType, item.roomNumber].filter(Boolean).join(" ");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${item.id}@pontual.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDateTime(date, timeToMinutes(item.startTime))}`,
        `DTEND:${icsDateTime(date, timeToMinutes(item.endTime))}`,
        `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
        `SUMMARY:${icsEscape(item.subject)}`,
        `LOCATION:${icsEscape([institutionName(item.institutionId), item.campus, place].filter(Boolean).join(" · "))}`,
        `DESCRIPTION:${icsEscape(`Janela de ponto: ${minutesToTime(timeToMinutes(item.startTime) - PONTO_WINDOW)}–${minutesToTime(timeToMinutes(item.startTime) + PONTO_WINDOW)}${item.notes ? `\n${item.notes}` : ""}`)}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(`${item.subject} começa em ${lead} min — hora do ponto`)}`,
        `TRIGGER:-PT${Math.max(0, lead)}M`,
        "END:VALARM",
        "END:VEVENT",
      );
    });
    assessments.forEach((item) => {
      const date = parseISODate(item.date);
      if (!date) return;
      const timed = /^\d{2}:\d{2}$/.test(item.time || "");
      lines.push("BEGIN:VEVENT", `UID:${item.id}@pontual.local`, `DTSTAMP:${stamp}`);
      if (timed) {
        const minutes = timeToMinutes(item.time);
        lines.push(`DTSTART:${icsDateTime(date, minutes)}`, `DTEND:${icsDateTime(date, Math.min(minutes + 60, 1439))}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(addDays(date, 1))}`);
      }
      lines.push(
        `SUMMARY:${icsEscape(`${item.type}: ${item.title} (${item.subject})`)}`,
        `DESCRIPTION:${icsEscape(item.notes || "")}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(`${item.type} amanhã: ${item.title}`)}`,
        timed ? "TRIGGER:-P1D" : "TRIGGER:-PT6H",
        "END:VALARM",
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    return `${lines.map(icsFold).join("\r\n")}\r\n`;
  }

  // ---------------------------------------------------------------- Spreadsheet import

  const normalizeHeader = (value) => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const HEADER_ALIASES = {
    subject: ["disciplina", "materia", "componente", "subject"],
    institution: ["instituicao", "escola", "universidade", "institution"],
    day: ["dia", "diadasemana", "diasemana", "day"],
    start: ["inicio", "horainicio", "start", "de"],
    end: ["termino", "fim", "horafim", "end", "ate"],
    shift: ["turno", "shift"],
    campus: ["campus", "unidade"],
    roomType: ["espaco", "tipo", "tipodesala"],
    room: ["sala", "salalaboratorio", "laboratorio", "room"],
    notes: ["observacoes", "observacao", "notas", "notes"],
  };

  function parseDay(value) {
    const text = normalizeHeader(value);
    if (/^[0-6]$/.test(text)) return Number(text);
    const names = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const index = names.findIndex((name) => text.startsWith(name.slice(0, 3)));
    return index;
  }

  function parseTime(value) {
    const match = /^(\d{1,2})[:h](\d{2})?$/i.exec(String(value || "").trim());
    if (!match) return "";
    const hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    return hour > 23 || minute > 59 ? "" : `${pad(hour)}:${pad(minute)}`;
  }

  function defaultShift(start) {
    const minutes = timeToMinutes(start);
    if (minutes < 12 * 60) return "Matutino";
    if (minutes < 18 * 60) return "Vespertino";
    return "Noturno";
  }

  /** Parses a class spreadsheet. Returns valid rows plus a human-readable error per bad line. */
  function parseClassSheet(text) {
    const table = parseCSV(text);
    if (table.length < 2) return { rows: [], errors: ["A planilha precisa de um cabeçalho e ao menos uma linha."] };
    const headers = table[0].map(normalizeHeader);
    const column = (name) => headers.findIndex((header) => HEADER_ALIASES[name].includes(header));
    const index = Object.fromEntries(Object.keys(HEADER_ALIASES).map((name) => [name, column(name)]));
    const missing = ["subject", "day", "start", "end"].filter((name) => index[name] < 0);
    if (missing.length) {
      return { rows: [], errors: [`Colunas obrigatórias ausentes: ${missing.map((name) => ({ subject: "Disciplina", day: "Dia", start: "Início", end: "Término" })[name]).join(", ")}.`] };
    }
    const rows = [];
    const errors = [];
    table.slice(1).forEach((cells, lineIndex) => {
      const line = lineIndex + 2;
      const get = (name) => (index[name] >= 0 ? String(cells[index[name]] ?? "").trim() : "");
      const subject = get("subject");
      const dayOfWeek = parseDay(get("day"));
      const startTime = parseTime(get("start"));
      const endTime = parseTime(get("end"));
      if (!subject) return void errors.push(`Linha ${line}: disciplina vazia.`);
      if (dayOfWeek < 0) return void errors.push(`Linha ${line}: dia da semana inválido (“${get("day")}”).`);
      if (!startTime || !endTime) return void errors.push(`Linha ${line}: use horários como 08:15.`);
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return void errors.push(`Linha ${line}: o término precisa ser depois do início.`);
      const shift = SHIFT_NAMES.find((name) => normalizeHeader(name) === normalizeHeader(get("shift"))) || defaultShift(startTime);
      const roomType = normalizeHeader(get("roomType")).startsWith("lab") || normalizeHeader(get("room")).startsWith("lab") ? "Laboratório" : "Sala";
      rows.push({
        subject,
        institution: get("institution"),
        dayOfWeek,
        startTime,
        endTime,
        shift,
        campus: get("campus") || "Campus principal",
        roomType,
        roomNumber: get("room") || "—",
        notes: get("notes"),
      });
    });
    return { rows, errors };
  }

  function classSheetTemplate() {
    return toCSV([
      ["Disciplina", "Instituição", "Dia", "Início", "Término", "Turno", "Campus", "Espaço", "Sala", "Observações"],
      ["Cálculo I", "Minha Instituição", "Segunda", "08:15", "09:55", "Matutino", "Campus Sul", "Sala", "B-104", ""],
      ["Banco de Dados", "Minha Instituição", "Quarta", "19:00", "20:40", "Noturno", "Campus Sul", "Laboratório", "L-02", "Levar notebook"],
    ]);
  }


  // ---------------------------------------------------------------- Holidays (Brazil, national)

  /** Meeus/Jones/Butcher algorithm for Easter Sunday. */
  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  /** National holidays; `optional` marks "ponto facultativo" days that many schools still observe. */
  function brazilHolidays(year) {
    const fixed = [
      ["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"],
      ["09-07", "Independência do Brasil"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"],
      ["11-15", "Proclamação da República"], ["11-20", "Consciência Negra"], ["12-25", "Natal"],
    ];
    const easter = easterSunday(year);
    const moving = (offset) => toISODate(addDays(easter, offset));
    const list = fixed.map(([monthDay, name]) => ({ date: `${year}-${monthDay}`, name, optional: false }));
    list.push(
      { date: moving(-48), name: "Carnaval (segunda-feira)", optional: true },
      { date: moving(-47), name: "Carnaval (terça-feira)", optional: true },
      { date: moving(-2), name: "Sexta-feira Santa", optional: false },
      { date: moving(60), name: "Corpus Christi", optional: true },
    );
    return list.sort((left, right) => left.date.localeCompare(right.date));
  }

  /** date → holiday, for every holiday inside [startISO, endISO]. */
  function holidayMap(startISO, endISO) {
    const map = {};
    const start = parseISODate(startISO);
    const end = parseISODate(endISO);
    if (!start || !end) return map;
    for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
      brazilHolidays(year).forEach((holiday) => {
        if (holiday.date >= startISO && holiday.date <= endISO) map[holiday.date] = holiday;
      });
    }
    return map;
  }

  function daysBetween(fromISO, toISO) {
    const from = parseISODate(fromISO);
    const to = parseISODate(toISO);
    if (!from || !to) return NaN;
    return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000);
  }

  // ---------------------------------------------------------------- Teaching plan (syllabus)

  /** One topic per line; strips bullets/numbering, collapses spaces and drops duplicates. */
  function parseTopics(text) {
    const seen = new Set();
    const topics = [];
    String(text || "").split(/\r?\n/).forEach((line) => {
      const topic = line.replace(/^\s*(?:[-–•*]|\d+[.)\-:])\s*/, "").trim().replace(/\s+/g, " ");
      const key = topic.toLocaleLowerCase("pt-BR");
      if (!topic || seen.has(key)) return;
      seen.add(key);
      topics.push(topic.slice(0, 200));
    });
    return topics.slice(0, 200);
  }

  const byDate = (left, right) => left.date.localeCompare(right.date) || String(left.startTime || "").localeCompare(String(right.startTime || ""));

  /** topic id → date of the first lesson (given or replacement) that covered it. */
  function coveredTopics(entries) {
    const map = new Map();
    [...entries].sort(byDate).forEach((entry) => {
      if (entry.status !== "Realizada" && entry.status !== "Reposição") return;
      (entry.topicIds || []).forEach((id) => { if (!map.has(id)) map.set(id, entry.date); });
    });
    return map;
  }

  /** topic id → date of the first planned ("Prevista") lesson it was assigned to. */
  function plannedTopics(entries) {
    const map = new Map();
    [...entries].sort(byDate).forEach((entry) => {
      if (entry.status !== "Prevista") return;
      (entry.topicIds || []).forEach((id) => { if (!map.has(id)) map.set(id, entry.date); });
    });
    return map;
  }

  function nextTopic(topics, entries) {
    const covered = coveredTopics(entries);
    return topics.find((topic) => !covered.has(topic.id)) || null;
  }

  function syllabusProgress(topics, entries) {
    const covered = coveredTopics(entries);
    const done = topics.filter((topic) => covered.has(topic.id)).length;
    const counting = entries.filter((entry) => STATUS_COUNTS[entry.status]);
    return {
      total: topics.length,
      covered: done,
      percent: topics.length ? Math.round((done / topics.length) * 100) : 0,
      lessonsGiven: counting.filter((entry) => entry.status !== "Prevista").length,
      lessonsTotal: counting.length,
    };
  }

  /** Assigns the not-yet-covered topics, in order, to planned lessons that have none. entryId → [topicId]. */
  function distributeTopics(topics, entries) {
    const covered = coveredTopics(entries);
    const assigned = new Set();
    entries.forEach((entry) => (entry.topicIds || []).forEach((id) => assigned.add(id)));
    const free = topics.filter((topic) => !covered.has(topic.id) && !assigned.has(topic.id));
    const targets = entries.filter((entry) => entry.status === "Prevista" && !(entry.topicIds || []).length).sort(byDate);
    const result = {};
    targets.forEach((entry, index) => { if (free[index]) result[entry.id] = [free[index].id]; });
    return result;
  }

  // ---------------------------------------------------------------- Assessments

  const EXAM_TYPES = ["Prova", "Trabalho", "Entrega", "Seminário", "Outro"];

  const byDateTime = (left, right) => left.date.localeCompare(right.date) || String(left.time || "").localeCompare(String(right.time || ""));

  function upcomingAssessments(items, now = new Date(), days = 14) {
    const today = toISODate(now);
    return items
      .filter((item) => !item.done && item.date >= today && daysBetween(today, item.date) <= days)
      .sort(byDateTime);
  }

  function assessmentRows(items) {
    return [
      ["Disciplina", "Tipo", "Título", "Data", "Hora", "Peso", "Média da turma", "Situação", "Observações"],
      ...[...items].sort(byDateTime).map((item) => [
        item.subject, item.type, item.title, formatBR(item.date), item.time || "", item.weight || "", item.average || "",
        item.done ? "Concluída" : "Pendente", item.notes || "",
      ]),
    ];
  }

  /** Reminders the evening before (18:00) and the morning of (07:00) each pending assessment. */
  function assessmentEvents(items, now = new Date()) {
    const events = [];
    items.filter((item) => !item.done).forEach((item) => {
      const day = parseISODate(item.date);
      if (!day) return;
      const label = `${item.type}: ${item.title} · ${item.subject}${item.time ? ` às ${item.time}` : ""}`;
      const eve = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 18, 0, 0);
      const morning = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 0, 0);
      const base = { kind: "exam", page: "diary", tab: "exams", body: label };
      if (eve > now) events.push({ ...base, at: eve, tag: `pontual-exam-${item.id}-eve`, title: "Avaliação amanhã" });
      if (morning > now) events.push({ ...base, at: morning, tag: `pontual-exam-${item.id}-day`, title: "Avaliação hoje" });
    });
    return events.sort((left, right) => left.at - right.at);
  }

  return {
    DAY_NAMES, DAY_SHORT, SHIFT_NAMES, DIARY_STATUSES, PONTO_WINDOW,
    timeToMinutes, minutesToTime, toISODate, parseISODate, formatBR, addDays,
    latestDateForWeekday, datesForWeekday,
    toCSV, toTSV, parseCSV,
    diaryKey, renumber, renumberAll, lessonLabel, diaryRows,
    durationMinutes, suggestedPeriods, detectConflicts, formatDuration, weeklyWorkload,
    missingPonto, countdownText, reminderEvents,
    buildICS, parseClassSheet, classSheetTemplate,
    easterSunday, brazilHolidays, holidayMap, daysBetween,
    parseTopics, coveredTopics, plannedTopics, nextTopic, syllabusProgress, distributeTopics,
    EXAM_TYPES, upcomingAssessments, assessmentRows, assessmentEvents,
  };
});
