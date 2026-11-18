import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../2_theme/ThemeContext';
import { useDatabase } from '../3_database/DatabaseContext';
import { DAY_NAMES, timeToMinutes } from '../4_services/pontoEngine';
import { ClassScheduleCard } from '../5_components/ClassScheduleCard';
import { ShadcnButton } from '../5_components/ShadcnPrimitives';

export const WeeklyScheduleScreen: React.FC<{ onNavigateAdmin: () => void }> = ({
  onNavigateAdmin,
}) => {
  const { theme } = useAppTheme();
  const { activeSemester, classes, institutions, deleteClass } = useDatabase();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          📅 Grade Semanal Completa ({activeSemester})
        </Text>
        <ShadcnButton label="➕ Nova Aula" onPress={onNavigateAdmin} />
      </View>

      {[1, 2, 3, 4, 5, 6].map((dayNum) => {
        const dayClasses = classes
          .filter((c) => c.semester === activeSemester && c.dayOfWeek === dayNum)
          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        if (dayClasses.length === 0) return null;

        return (
          <View key={dayNum} style={styles.dayGroup}>
            <Text style={[styles.dayHeader, { color: theme.colors.accent }]}>
              {DAY_NAMES[dayNum]} ({dayClasses.length} aula(s))
            </Text>
            {dayClasses.map((item) => {
              const inst =
                institutions.find((i) => i.id === item.institutionId) || institutions[0];
              return (
                <ClassScheduleCard
                  key={item.id}
                  item={item}
                  institution={inst}
                  currentMinutes={480}
                  onEdit={() => onNavigateAdmin()}
                  onDelete={deleteClass}
                />
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 14, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  dayGroup: { gap: 10 },
  dayHeader: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
});
