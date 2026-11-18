import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ClassScheduleItem, Institution, PontoLogEntry, PontoRule, UserProfile } from '../1_types/types';

const LOCAL_JSON_KEY = '@pontual_local_database_v1';

export interface LocalDatabaseSnapshot {
  activeSemester: string;
  semesters: string[];
  userProfile: UserProfile;
  institutions: Institution[];
  pontoRules: PontoRule[];
  classes: ClassScheduleItem[];
  pontoLogs: PontoLogEntry[];
}

/**
 * Salva o snapshot completo localmente no dispositivo (offline-first).
 */
export async function saveLocalDatabase(snapshot: LocalDatabaseSnapshot): Promise<void> {
  const serialized = JSON.stringify(snapshot);
  await AsyncStorage.setItem(LOCAL_JSON_KEY, serialized);
}

/**
 * Carrega o banco de dados local salvo no dispositivo.
 */
export async function loadLocalDatabase(): Promise<LocalDatabaseSnapshot | null> {
  const raw = await AsyncStorage.getItem(LOCAL_JSON_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as LocalDatabaseSnapshot;
}

/**
 * Exporta os dados locais para um arquivo .json físico e abre o menu de compartilhamento do sistema.
 */
export async function exportDatabaseAsJsonFile(snapshot: LocalDatabaseSnapshot): Promise<string> {
  const fileUri = `${FileSystem.documentDirectory}pontual_backup_${snapshot.activeSemester.replace('/', '-')}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(snapshot, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
  return fileUri;
}

/**
 * Gera um script SQLite (.sql) compatível com expo-sqlite para backup relacional offline.
 */
export async function exportDatabaseAsSqliteDump(snapshot: LocalDatabaseSnapshot): Promise<string> {
  const lines: string[] = [
    '-- PONTUAL REACT NATIVE - DUMP SQLITE LOCAL',
    'BEGIN TRANSACTION;',
    'CREATE TABLE IF NOT EXISTS institutions (id TEXT PRIMARY KEY, name TEXT, logo_uri TEXT, default_ponto_url TEXT);',
    'CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, semester TEXT, institution_id TEXT, day_of_week INTEGER, shift TEXT, start_time TEXT, end_time TEXT, subject TEXT, campus TEXT, room_type TEXT, room_number TEXT);',
    'CREATE TABLE IF NOT EXISTS ponto_rules (id TEXT PRIMARY KEY, institution_id TEXT, day_of_week TEXT, shift TEXT, url TEXT);',
  ];

  snapshot.institutions.forEach((inst) => {
    const safeName = inst.name.replace(/'/g, "''");
    const safeUrl = inst.defaultPontoUrl.replace(/'/g, "''");
    lines.push(
      `INSERT OR REPLACE INTO institutions VALUES ('${inst.id}', '${safeName}', '${inst.logoUri}', '${safeUrl}');`
    );
  });

  snapshot.classes.forEach((c) => {
    const safeSub = c.subject.replace(/'/g, "''");
    const safeCampus = c.campus.replace(/'/g, "''");
    const safeRoom = c.roomNumber.replace(/'/g, "''");
    lines.push(
      `INSERT OR REPLACE INTO classes VALUES ('${c.id}', '${c.semester}', '${c.institutionId}', ${c.dayOfWeek}, '${c.shift}', '${c.startTime}', '${c.endTime}', '${safeSub}', '${safeCampus}', '${c.roomType}', '${safeRoom}');`
    );
  });

  snapshot.pontoRules.forEach((r) => {
    const safeUrl = r.url.replace(/'/g, "''");
    lines.push(
      `INSERT OR REPLACE INTO ponto_rules VALUES ('${r.id}', '${r.institutionId}', '${r.dayOfWeek}', '${r.shift}', '${safeUrl}');`
    );
  });

  lines.push('COMMIT;');

  const fileUri = `${FileSystem.documentDirectory}pontual_sqlite_local.sql`;
  await FileSystem.writeAsStringAsync(fileUri, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
  return fileUri;
}
