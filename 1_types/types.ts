export type ThemeMode = 'light' | 'dark' | 'rubro';

export type ShiftType = 'Matutino' | 'Especial' | 'Vespertino' | 'Noturno';

export type RoomType = 'Sala' | 'Laboratório';

export interface UserProfile {
  name: string;
  role: string;
  photoUri: string;
}

export interface Institution {
  id: string;
  name: string;
  logoUri: string;
  defaultPontoUrl: string;
}

export interface PontoRule {
  id: string;
  institutionId: string;
  dayOfWeek: 'ALL' | '0' | '1' | '2' | '3' | '4' | '5' | '6';
  shift: 'ALL' | ShiftType;
  url: string;
}

export interface ClassScheduleItem {
  id: string;
  semester: string;
  institutionId: string;
  dayOfWeek: number; // 1 = Segunda ... 6 = Sábado
  shift: ShiftType;
  startTime: string; // HH:MM (ex: "08:15", "11:00", "19:15")
  endTime: string;   // HH:MM (ex: "11:00", "12:15", "22:00")
  subject: string;
  campus: string;
  roomType: RoomType;
  roomNumber: string;
  notes?: string;
}

export interface PontoLogEntry {
  id: string;
  timestamp: string;
  institutionName: string;
  shift: ShiftType;
  phase: 'Entrada' | 'Saída' | 'Manual';
  subject: string;
  campus: string;
  url: string;
}

export interface PontoWindowEvaluation {
  status: 'ENTRADA_ABERTA' | 'SAIDA_ABERTA' | 'AGUARDANDO_ENTRADA' | 'EM_AULA' | 'ENCERRADA';
  phase: 'Entrada' | 'Saída' | 'Pré-Aula' | 'Em Aula' | 'Encerrada';
  badgeText: string;
  windowLabel: string;
  isUrgent: boolean;
  inOpenStr: string;
  inCloseStr: string;
  outOpenStr: string;
  outCloseStr: string;
}
