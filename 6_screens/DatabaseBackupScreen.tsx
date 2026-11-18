import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../2_theme/ThemeContext';
import { useDatabase } from '../3_database/DatabaseContext';
import {
  exportDatabaseAsJsonFile,
  exportDatabaseAsSqliteDump,
} from '../3_database/sqliteService';
import { ShadcnButton, ShadcnCard } from '../5_components/ShadcnPrimitives';

export const DatabaseBackupScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const db = useDatabase();

  const snapshot = {
    activeSemester: db.activeSemester,
    semesters: db.semesters,
    userProfile: db.userProfile,
    institutions: db.institutions,
    pontoRules: db.pontoRules,
    classes: db.classes,
    pontoLogs: db.pontoLogs,
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ShadcnCard>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          💾 Banco de Dados Local (JSON & SQLite Offline)
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
          Seus horários, fotos, logos e links ficam salvos localmente no aparelho sem depender de internet.
        </Text>

        <View style={styles.btnGrid}>
          <ShadcnButton
            label="⬇️ Exportar Backup (.JSON)"
            variant="primary"
            onPress={() => exportDatabaseAsJsonFile(snapshot)}
          />
          <ShadcnButton
            label="🗄️ Exportar Banco (.SQL / SQLite)"
            variant="gold"
            onPress={() => exportDatabaseAsSqliteDump(snapshot)}
          />
          <ShadcnButton
            label="🔄 Restaurar Grade Padrão 2027/1"
            variant="outline"
            onPress={db.resetToFactory2027}
          />
        </View>
      </ShadcnCard>

      <ShadcnCard>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          🕒 Histórico Local de Batidas de Ponto ({db.pontoLogs.length})
        </Text>
        {db.pontoLogs.map((log) => (
          <View
            key={log.id}
            style={[
              styles.logItem,
              { backgroundColor: theme.colors.muted, borderColor: theme.colors.border },
            ]}
          >
            <View>
              <Text style={{ color: theme.colors.foreground, fontWeight: '800', fontSize: 13 }}>
                {log.institutionName} • {log.shift} ({log.phase})
              </Text>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 11 }}>
                {log.subject} — {log.campus}
              </Text>
            </View>
            <Text style={{ color: theme.colors.accent, fontWeight: '800', fontSize: 12 }}>
              {log.timestamp}
            </Text>
          </View>
        ))}
      </ShadcnCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 14, gap: 16 },
  title: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 14 },
  btnGrid: { gap: 10 },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
});
