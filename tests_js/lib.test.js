const test = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../static/core/lib.js");

const entry = (date, over = {}) => ({
  id: date, semester: "2027/1", institutionId: "i1", subject: "Cálculo I",
  date, periods: 1, status: "Realizada", content: "", notes: "", ...over,
});

test("renumber follows chronological order and advances by periods", () => {
  const result = lib.renumber([
    entry("2027-03-10", { periods: 2 }),
    entry("2027-03-03"),
    entry("2027-03-17"),
  ]);
  assert.deepEqual(result.map((item) => lib.lessonLabel(item)), ["1", "2–3", "4"]);
  assert.deepEqual(result.map((item) => item.date), ["2027-03-03", "2027-03-10", "2027-03-17"]);
});

test("renumber skips absences and holidays without breaking the sequence", () => {
  const result = lib.renumber([
    entry("2027-03-03"),
    entry("2027-03-10", { status: "Sem aula (feriado/recesso)" }),
    entry("2027-03-17", { status: "Falta do professor" }),
    entry("2027-03-24", { status: "Reposição" }),
  ]);
  assert.deepEqual(result.map((item) => lib.lessonLabel(item)), ["1", "—", "—", "2"]);
});

test("renumberAll keeps diaries of different subjects independent", () => {
  const result = lib.renumberAll([
    entry("2027-03-03"),
    entry("2027-03-03", { id: "b", subject: "  banco   de dados " }),
    entry("2027-03-10", { id: "c", subject: "Banco de Dados" }),
  ]);
  const byId = Object.fromEntries(result.map((item) => [item.id, item.number]));
  assert.equal(byId["2027-03-03"], 1);
  assert.equal(byId.b, 1);
  assert.equal(byId.c, 2);
});

test("diaryRows exports the requested table columns", () => {
  const rows = lib.diaryRows([entry("2027-03-03", { content: "Limites", notes: "Prova na próxima aula" })]);
  assert.deepEqual(rows[0], ["Nº da aula", "Data", "Conteúdo ministrado", "Observações", "Situação"]);
  assert.deepEqual(rows[1], ["1", "03/03/2027", "Limites", "Prova na próxima aula", "Realizada"]);
});

test("CSV uses BOM + semicolons, quotes special cells and blocks formula injection", () => {
  const csv = lib.toCSV([["a;b", 'diz "oi"', "linha1\nlinha2", "=HYPERLINK(1)", "-5"]]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv.slice(1).trim(), '"a;b";"diz ""oi""";"linha1\nlinha2";\'=HYPERLINK(1);-5');
});

test("TSV flattens tabs and line breaks so pasted cells stay aligned", () => {
  assert.equal(lib.toTSV([["a\tb", "x\ny"], ["1", "2"]]), "a b\tx y\n1\t2");
});

test("parseCSV round-trips quoted cells and detects the delimiter", () => {
  const rows = lib.parseCSV('Disciplina,Dia\n"Cálculo, I",Segunda\r\nBanco,"Qua"');
  assert.deepEqual(rows, [["Disciplina", "Dia"], ["Cálculo, I", "Segunda"], ["Banco", "Qua"]]);
});

test("datesForWeekday lists each weekly occurrence in range", () => {
  assert.deepEqual(lib.datesForWeekday("2027-03-01", "2027-03-31", 3), ["2027-03-03", "2027-03-10", "2027-03-17", "2027-03-24", "2027-03-31"]);
  assert.deepEqual(lib.datesForWeekday("2027-03-31", "2027-03-01", 3), []);
});

test("latestDateForWeekday returns today or the most recent past occurrence", () => {
  const wednesday = new Date(2027, 2, 10);
  assert.equal(lib.toISODate(lib.latestDateForWeekday(3, wednesday)), "2027-03-10");
  assert.equal(lib.toISODate(lib.latestDateForWeekday(1, wednesday)), "2027-03-08");
  assert.equal(lib.toISODate(lib.latestDateForWeekday(5, wednesday)), "2027-03-05");
});

test("parseISODate rejects impossible dates", () => {
  assert.equal(lib.parseISODate("2027-02-30"), null);
  assert.equal(lib.formatBR("2027-03-03"), "03/03/2027");
});

const cls = (id, day, start, end, over = {}) => ({
  id, semester: "2027/1", institutionId: "i1", dayOfWeek: day, startTime: start, endTime: end,
  subject: id, campus: "Sul", roomType: "Sala", roomNumber: "1", shift: "Matutino", ...over,
});

test("detectConflicts flags overlapping classes on the same day only", () => {
  const conflicts = lib.detectConflicts([
    cls("a", 1, "08:00", "10:00"),
    cls("b", 1, "09:30", "11:00", { institutionId: "i2" }),
    cls("c", 1, "10:00", "12:00"),
    cls("d", 2, "08:00", "10:00"),
  ]);
  assert.deepEqual(conflicts.a, ["b"]);
  assert.deepEqual(conflicts.b, ["a", "c"]);
  assert.equal(conflicts.d, undefined);
});

test("weeklyWorkload sums minutes and periods per institution", () => {
  const load = lib.weeklyWorkload([cls("a", 1, "08:00", "09:40"), cls("b", 2, "19:00", "20:40", { institutionId: "i2" })]);
  assert.equal(load.minutes, 200);
  assert.equal(load.periods, 4);
  assert.deepEqual(load.perInstitution, { i1: 100, i2: 100 });
  assert.equal(lib.formatDuration(200), "3h20");
});

test("missingPonto reports closed windows without a confirmed record", () => {
  const now = new Date(2027, 2, 10, 10, 30); // Wednesday
  const classes = [cls("a", 3, "08:00", "09:40")];
  assert.deepEqual(lib.missingPonto(classes, [], now).map((entry) => entry.phase), ["Entrada", "Saída"]);
  const logs = [
    { classId: "a", isoDate: "2027-03-10", phase: "Entrada", confirmed: true },
    { classId: "a", isoDate: "2027-03-10", phase: "Saída", confirmed: false },
  ];
  assert.deepEqual(lib.missingPonto(classes, logs, now).map((entry) => entry.phase), ["Saída"]);
  assert.deepEqual(lib.missingPonto(classes, [], new Date(2027, 2, 10, 7, 0)), []);
});

test("countdownText describes the time until start or end", () => {
  const item = cls("a", 3, "08:00", "09:40");
  assert.equal(lib.countdownText(item, new Date(2027, 2, 10, 6, 30)), "Começa em 1h30");
  assert.equal(lib.countdownText(item, new Date(2027, 2, 10, 9, 10)), "Termina em 30min");
  assert.equal(lib.countdownText(item, new Date(2027, 2, 10, 10, 0)), "Aula encerrada");
});

test("reminderEvents schedules only future alerts, before each window opens", () => {
  const now = new Date(2027, 2, 10, 7, 0);
  const events = lib.reminderEvents([cls("a", 3, "08:00", "09:40")], now, 5);
  assert.equal(events.length, 2);
  assert.equal(events[0].at.getHours() * 60 + events[0].at.getMinutes(), 7 * 60 + 40);
  assert.equal(events[1].at.getHours() * 60 + events[1].at.getMinutes(), 9 * 60 + 20);
  assert.equal(lib.reminderEvents([cls("a", 3, "08:00", "09:40")], new Date(2027, 2, 10, 9, 0), 5).length, 1);
  assert.equal(lib.reminderEvents([cls("a", 2, "08:00", "09:40")], now, 5).length, 0);
});

test("buildICS creates weekly events with alarms, escaping and CRLF folding", () => {
  const ics = lib.buildICS({
    classes: [cls("a", 3, "08:15", "09:55", { subject: "Cálculo, I; turma A", notes: "Levar\nprojetor" })],
    institutionName: () => "UFX",
    startISO: "2027-03-01",
    endISO: "2027-06-30",
    lead: 15,
    now: new Date(Date.UTC(2027, 0, 1)),
  });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART:20270303T081500\r\n"));
  assert.ok(ics.includes("DTEND:20270303T095500\r\n"));
  assert.ok(ics.includes("RRULE:FREQ=WEEKLY;UNTIL=20270630T235959\r\n"));
  assert.ok(ics.includes("SUMMARY:Cálculo\\, I\\; turma A\r\n"));
  assert.ok(ics.includes("TRIGGER:-PT15M\r\n"));
  assert.ok(ics.split("\r\n").every((line) => line.length <= 75));
  assert.throws(() => lib.buildICS({ classes: [], institutionName: () => "", startISO: "x", endISO: "y" }));
});

test("parseClassSheet maps flexible headers and reports bad lines", () => {
  const sheet = [
    "Disciplina;Instituição;Dia;Início;Término;Sala",
    "Cálculo I;UFX;Segunda-feira;8:15;09:55;Lab 2",
    ";UFX;Terça;08:00;09:00;1",
    "Física;UFX;Funday;08:00;09:00;1",
    "Redes;UFX;Quarta;10:00;09:00;1",
    "Banco;UFX;qui;19h;20h40;L-1",
  ].join("\n");
  const { rows, errors } = lib.parseClassSheet(sheet);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    subject: "Cálculo I", institution: "UFX", dayOfWeek: 1, startTime: "08:15", endTime: "09:55",
    shift: "Matutino", campus: "Campus principal", roomType: "Laboratório", roomNumber: "Lab 2", notes: "",
  });
  assert.equal(rows[1].dayOfWeek, 4);
  assert.equal(rows[1].startTime, "19:00");
  assert.equal(rows[1].shift, "Noturno");
  assert.equal(errors.length, 3);
  assert.match(errors[0], /Linha 3/);
});

test("parseClassSheet requires the mandatory columns", () => {
  assert.match(lib.parseClassSheet("Foo;Bar\n1;2").errors[0], /Colunas obrigatórias/);
});

test("the downloadable spreadsheet template is importable", () => {
  const { rows, errors } = lib.parseClassSheet(lib.classSheetTemplate());
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
});
