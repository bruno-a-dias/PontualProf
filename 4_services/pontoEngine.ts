import {
  ClassScheduleItem,
  Institution,
  PontoRule,
  PontoWindowEvaluation,
  ShiftType,
} from '../1_types/types';

export const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export function timeToMinutes(hhmm: string): number {
  const [hStr, mStr] = (hhmm || '00:00').split(':');
  return (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
}

export function minutesToTime(totalMin: number): string {
  const norm = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calcula as janelas de ponto eletrônico:
 * - Entrada: 15 minutos antes do início até 15 minutos após o início.
 * - Saída: 15 minutos antes do término até 15 minutos após o término.
 */
export function evaluatePontoWindow(
  cls: ClassScheduleItem,
  currentMinutes: number
): PontoWindowEvaluation {
  const startMin = timeToMinutes(cls.startTime);
  const endMin = timeToMinutes(cls.endTime);

  const inOpenMin = startMin - 15;
  const inCloseMin = startMin + 15;
  const outOpenMin = endMin - 15;
  const outCloseMin = endMin + 15;

  const inOpenStr = minutesToTime(inOpenMin);
  const inCloseStr = minutesToTime(inCloseMin);
  const outOpenStr = minutesToTime(outOpenMin);
  const outCloseStr = minutesToTime(outCloseMin);

  if (currentMinutes >= inOpenMin && currentMinutes <= inCloseMin) {
    const remaining = inCloseMin - currentMinutes;
    return {
      status: 'ENTRADA_ABERTA',
      phase: 'Entrada',
      badgeText: `🟢 PONTO DE ENTRADA ABERTO (${remaining} min restantes)`,
      windowLabel: `${inOpenStr} — ${inCloseStr}`,
      isUrgent: true,
      inOpenStr,
      inCloseStr,
      outOpenStr,
      outCloseStr,
    };
  }

  if (currentMinutes >= outOpenMin && currentMinutes <= outCloseMin) {
    const remaining = outCloseMin - currentMinutes;
    return {
      status: 'SAIDA_ABERTA',
      phase: 'Saída',
      badgeText: `🟡 PONTO DE SAÍDA ABERTO (${remaining} min restantes)`,
      windowLabel: `${outOpenStr} — ${outCloseStr}`,
      isUrgent: true,
      inOpenStr,
      inCloseStr,
      outOpenStr,
      outCloseStr,
    };
  }

  if (currentMinutes < inOpenMin) {
    const diff = inOpenMin - currentMinutes;
    return {
      status: 'AGUARDANDO_ENTRADA',
      phase: 'Pré-Aula',
      badgeText: `⏳ Entrada abre em ${diff} min (${inOpenStr})`,
      windowLabel: `Entrada: ${inOpenStr}–${inCloseStr}`,
      isUrgent: false,
      inOpenStr,
      inCloseStr,
      outOpenStr,
      outCloseStr,
    };
  }

  if (currentMinutes > inCloseMin && currentMinutes < outOpenMin) {
    const diff = outOpenMin - currentMinutes;
    return {
      status: 'EM_AULA',
      phase: 'Em Aula',
      badgeText: `📖 Em aula • Saída abre em ${diff} min (${outOpenStr})`,
      windowLabel: `Saída: ${outOpenStr}–${outCloseStr}`,
      isUrgent: false,
      inOpenStr,
      inCloseStr,
      outOpenStr,
      outCloseStr,
    };
  }

  return {
    status: 'ENCERRADA',
    phase: 'Encerrada',
    badgeText: `✔️ Aula encerrada (limite foi ${outCloseStr})`,
    windowLabel: `${inOpenStr} / ${outCloseStr}`,
    isUrgent: false,
    inOpenStr,
    inCloseStr,
    outOpenStr,
    outCloseStr,
  };
}

/**
 * Resolve automaticamente qual URL de ponto o botão dedicado único deve acionar
 * de acordo com a Instituição, Dia da Semana e Turno atual.
 */
export function resolveDynamicPontoUrl(
  institutionId: string,
  dayOfWeek: number,
  shift: ShiftType,
  rules: PontoRule[],
  institutions: Institution[]
): { url: string; matchedRuleLabel: string } {
  const dayStr = String(dayOfWeek) as PontoRule['dayOfWeek'];

  // 1. Regra específica de Instituição + Dia da Semana + Turno
  let rule = rules.find(
    (r) => r.institutionId === institutionId && r.dayOfWeek === dayStr && r.shift === shift
  );
  if (rule) return { url: rule.url, matchedRuleLabel: `Dia + Turno (${shift})` };

  // 2. Regra de Instituição + Qualquer Dia + Turno
  rule = rules.find(
    (r) => r.institutionId === institutionId && r.dayOfWeek === 'ALL' && r.shift === shift
  );
  if (rule) return { url: rule.url, matchedRuleLabel: `Turno ${shift}` };

  // 3. Regra de Instituição + Dia + Qualquer Turno
  rule = rules.find(
    (r) => r.institutionId === institutionId && r.dayOfWeek === dayStr && r.shift === 'ALL'
  );
  if (rule) return { url: rule.url, matchedRuleLabel: `${DAY_NAMES[dayOfWeek]} (Geral)` };

  // 4. Link padrão da Instituição
  const inst = institutions.find((i) => i.id === institutionId) || institutions[0];
  return {
    url: inst ? inst.defaultPontoUrl : 'https://portal.iesb.br/ponto-docente',
    matchedRuleLabel: inst ? `Padrão ${inst.name}` : 'Link Base',
  };
}
