import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../2_theme/ThemeContext';
import { useDatabase } from '../3_database/DatabaseContext';
import {
  DAY_NAMES,
  evaluatePontoWindow,
  resolveDynamicPontoUrl,
  timeToMinutes,
} from '../4_services/pontoEngine';
import { soundAlertService } from '../4_services/soundAlertService';
import { ProfileHeaderCard } from '../5_components/ProfileHeaderCard';
import { DedicatedPontoButton } from '../5_components/DedicatedPontoButton';
import { ClassScheduleCard } from '../5_components/ClassScheduleCard';
import { ShadcnButton, ShadcnCard } from '../5_components/ShadcnPrimitives';

export const HomeScreen: React.FC<{ onNavigateAdmin: () => void }> = ({ onNavigateAdmin }) => {
  const { theme } = useAppTheme();
  const { activeSemester, classes, institutions, pontoRules, addPontoLog } = useDatabase();

  const [selectedDay, setSelectedDay] = useState<number>(3); // Quarta-feira (com aula especial 11h00 Sul)
  const [simulatedTime, setSimulatedTime] = useState<string>('10:55');

  const currentMinutes = timeToMinutes(simulatedTime);

  const dayClasses = classes
    .filter((c) => c.semester === activeSemester && c.dayOfWeek === selectedDay)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const activeClass =
    dayClasses.find((c) => {
      const ev = evaluatePontoWindow(c, currentMinutes);
      return ev.status === 'ENTRADA_ABERTA' || ev.status === 'SAIDA_ABERTA';
    }) ||
    dayClasses[0] ||
    classes[0];

  const activeInstitution =
    institutions.find((i) => i.id === activeClass?.institutionId) || institutions[0];

  const evaluation = activeClass
    ? evaluatePontoWindow(activeClass, currentMinutes)
    : null;

  const resolvedPonto = activeClass
    ? resolveDynamicPontoUrl(
        activeClass.institutionId,
        selectedDay,
        activeClass.shift,
        pontoRules,
        institutions
      )
    : { url: 'https://portal.iesb.br/ponto-docente', matchedRuleLabel: 'Padrão' };

  useEffect(() => {
    if (activeClass && evaluation?.isUrgent) {
      const key = `${selectedDay}_${activeClass.id}_${evaluation.status}`;
      soundAlertService.triggerPontoAlert(key, false);
    }
  }, [selectedDay, simulatedTime, activeClass, evaluation]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Card de Perfil com Upload de Foto e Nome logo abaixo */}
      <ProfileHeaderCard />

      {/* Painel do Ponto Eletrônico e Botão Dedicado Único */}
      {activeClass && evaluation && (
        <ShadcnCard>
          <View style={styles.clockHeader}>
            <View>
              <Text style={[styles.dayLabel, { color: theme.colors.accent }]}>
                {DAY_NAMES[selectedDay]} • Semestre {activeSemester}
              </Text>
              <Text style={[styles.clockBig, { color: theme.colors.foreground }]}>
                {simulatedTime}:00
              </Text>
            </View>
            <ShadcnButton
              label="🔔 Testar Alerta Sonoro"
              variant="gold"
              onPress={() => soundAlertService.triggerPontoAlert(undefined, true)}
            />
          </View>

          <View
            style={[
              styles.statusBox,
              {
                backgroundColor: theme.colors.muted,
                borderColor: evaluation.isUrgent ? theme.colors.accent : theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.statusTitle, { color: theme.colors.foreground }]}>
              {evaluation.badgeText}
            </Text>
            <Text style={[styles.statusSub, { color: theme.colors.mutedForeground }]}>
              Janela (±15 min): {evaluation.windowLabel}
            </Text>
          </View>

          {/* Botão Único Inteligente de Ponto */}
          <DedicatedPontoButton
            activeClass={activeClass}
            institution={activeInstitution}
            evaluation={evaluation}
            resolvedUrl={resolvedPonto.url}
            matchedRuleLabel={resolvedPonto.matchedRuleLabel}
            onPontoTriggered={() =>
              addPontoLog({
                timestamp: `${DAY_NAMES[selectedDay]} ${simulatedTime}`,
                institutionName: activeInstitution.name,
                shift: activeClass.shift,
                phase: evaluation.phase === 'Saída' ? 'Saída' : 'Entrada',
                subject: activeClass.subject,
                campus: activeClass.campus,
                url: resolvedPonto.url,
              })
            }
          />
        </ShadcnCard>
      )}

      {/* Simulador Rápido de Cenários de Horário */}
      <ShadcnCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.foreground }]}>
          🎛️ Simular Horários de Ponto (±15 min)
        </Text>
        <View style={styles.simPresetsRow}>
          {[
            { day: 1, time: '08:05', label: 'Seg 08:05 (Mat)' },
            { day: 1, time: '10:50', label: 'Seg 10:50 (Saída)' },
            { day: 3, time: '10:55', label: 'Qua 10:55 (11h Sul)' },
            { day: 3, time: '12:05', label: 'Qua 12:05 (Saída Sul)' },
            { day: 3, time: '19:05', label: 'Qua 19:05 (Noturno)' },
          ].map((preset) => (
            <TouchableOpacity
              key={`${preset.day}_${preset.time}`}
              onPress={() => {
                setSelectedDay(preset.day);
                setSimulatedTime(preset.time);
              }}
              style={[
                styles.presetBtn,
                {
                  backgroundColor: theme.colors.muted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={{ color: theme.colors.foreground, fontSize: 11, fontWeight: '700' }}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ShadcnCard>

      {/* Seletor de Dia e Lista de Aulas */}
      <View style={styles.daysRow}>
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => setSelectedDay(d)}
            style={[
              styles.dayPill,
              {
                backgroundColor:
                  selectedDay === d ? theme.colors.primary : theme.colors.card,
                borderColor:
                  selectedDay === d ? theme.colors.accent : theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: selectedDay === d ? '#FFFFFF' : theme.colors.foreground,
                fontWeight: '800',
                fontSize: 12,
              }}
            >
              {DAY_NAMES[d].slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {dayClasses.map((cls) => {
        const inst =
          institutions.find((i) => i.id === cls.institutionId) || institutions[0];
        return (
          <ClassScheduleCard
            key={cls.id}
            item={cls}
            institution={inst}
            currentMinutes={currentMinutes}
            onEdit={() => onNavigateAdmin()}
          />
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { padding: 14, gap: 14 },
  clockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayLabel: { fontSize: 12, fontWeight: '800' },
  clockBig: { fontSize: 30, fontWeight: '900', fontFamily: 'monospace' },
  statusBox: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  statusTitle: { fontSize: 13, fontWeight: '800' },
  statusSub: { fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  simPresetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});
