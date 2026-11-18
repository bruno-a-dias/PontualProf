import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { ClassScheduleItem, Institution } from '../1_types/types';
import { useAppTheme } from '../2_theme/ThemeContext';
import { evaluatePontoWindow } from '../4_services/pontoEngine';
import { ShadcnBadge, ShadcnButton, ShadcnCard } from './ShadcnPrimitives';

interface ClassScheduleCardProps {
  item: ClassScheduleItem;
  institution: Institution;
  currentMinutes: number;
  onEdit?: (item: ClassScheduleItem) => void;
  onDelete?: (id: string) => void;
}

export const ClassScheduleCard: React.FC<ClassScheduleCardProps> = ({
  item,
  institution,
  currentMinutes,
  onEdit,
  onDelete,
}) => {
  const { theme } = useAppTheme();
  const ev = evaluatePontoWindow(item, currentMinutes);
  const roomIcon = item.roomType === 'Laboratório' ? '💻' : '🏫';

  return (
    <ShadcnCard
      style={
        ev.isUrgent
          ? { borderColor: theme.colors.accent, borderWidth: 2 }
          : undefined
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.instRow}>
          {institution.logoUri ? (
            <Image source={{ uri: institution.logoUri }} style={styles.instLogo} />
          ) : (
            <View style={[styles.instFallback, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.instFallbackText}>{institution.name.slice(0, 4)}</Text>
            </View>
          )}
          <View>
            <View style={styles.badgesRow}>
              <ShadcnBadge label={item.shift} variant="primary" />
              <ShadcnBadge label={item.campus} variant="gold" />
            </View>
            <Text style={[styles.subjectTitle, { color: theme.colors.foreground }]}>
              {item.subject}
            </Text>
          </View>
        </View>

        <View style={[styles.timeBox, { backgroundColor: theme.colors.muted }]}>
          <Text style={[styles.timeText, { color: theme.colors.foreground }]}>
            {item.startTime} – {item.endTime}
          </Text>
        </View>
      </View>

      {/* Sala ou Laboratório + Número e Nome da Instituição */}
      <View style={styles.metaRow}>
        <ShadcnBadge
          label={`${roomIcon} ${item.roomType}: ${item.roomNumber}`}
          variant="muted"
        />
        <ShadcnBadge label={`🏛️ ${institution.name}`} variant="muted" />
      </View>

      {/* Janelas de Ponto Eletrônico (±15 minutos) */}
      <View style={styles.windowsGrid}>
        <View
          style={[
            styles.windowCell,
            { backgroundColor: theme.colors.muted, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.windowLabel, { color: theme.colors.mutedForeground }]}>
            PONTO ENTRADA (±15m)
          </Text>
          <Text style={[styles.windowValue, { color: theme.colors.foreground }]}>
            {ev.inOpenStr} às {ev.inCloseStr}
          </Text>
        </View>

        <View
          style={[
            styles.windowCell,
            { backgroundColor: theme.colors.muted, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.windowLabel, { color: theme.colors.mutedForeground }]}>
            PONTO SAÍDA (±15m)
          </Text>
          <Text style={[styles.windowValue, { color: theme.colors.foreground }]}>
            {ev.outOpenStr} às {ev.outCloseStr}
          </Text>
        </View>
      </View>

      {(onEdit || onDelete) && (
        <View style={styles.footerActions}>
          {onEdit && (
            <ShadcnButton
              label="✏️ Informar Matéria / Sala"
              variant="outline"
              onPress={() => onEdit(item)}
            />
          )}
          {onDelete && (
            <ShadcnButton
              label="🗑️ Excluir"
              variant="outline"
              onPress={() => onDelete(item.id)}
            />
          )}
        </View>
      )}
    </ShadcnCard>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  instRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  instLogo: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFFFFF' },
  instFallback: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instFallbackText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  subjectTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  timeBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  timeText: { fontSize: 12, fontWeight: '800', fontFamily: 'monospace' },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  windowsGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  windowCell: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1 },
  windowLabel: { fontSize: 10, fontWeight: '700' },
  windowValue: { fontSize: 12, fontWeight: '800', marginTop: 2, fontFamily: 'monospace' },
  footerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
