import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useAppTheme } from '../2_theme/ThemeContext';
import { ClassScheduleItem, Institution, PontoWindowEvaluation } from '../1_types/types';

interface DedicatedPontoButtonProps {
  activeClass: ClassScheduleItem;
  institution: Institution;
  evaluation: PontoWindowEvaluation;
  resolvedUrl: string;
  matchedRuleLabel: string;
  onPontoTriggered: () => void;
}

export const DedicatedPontoButton: React.FC<DedicatedPontoButtonProps> = ({
  activeClass,
  institution,
  evaluation,
  resolvedUrl,
  matchedRuleLabel,
  onPontoTriggered,
}) => {
  const { theme } = useAppTheme();

  const handlePress = async () => {
    onPontoTriggered();
    try {
      await Linking.openURL(resolvedUrl);
    } catch {
      // Caso o link não possa ser aberto no simulador
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.88}
        style={[
          styles.ctaButton,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.accent,
          },
        ]}
      >
        <View style={styles.leftRow}>
          <View style={styles.iconBox}>
            <Text style={{ fontSize: 22 }}>👆</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.ctaTitle}>BATER PONTO ELETRÔNICO</Text>
              <View style={[styles.ruleChip, { backgroundColor: theme.colors.accent }]}>
                <Text style={styles.ruleChipText}>{matchedRuleLabel}</Text>
              </View>
            </View>
            <Text style={styles.ctaSubtitle}>
              {institution.name} • {activeClass.shift} ({evaluation.phase}) — {activeClass.campus}
            </Text>
            <Text style={styles.urlText} numberOfLines={1}>
              🔗 {resolvedUrl}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginVertical: 6 },
  ctaButton: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
  },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  ctaTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  ruleChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ruleChipText: { color: '#000000', fontSize: 10, fontWeight: '800' },
  ctaSubtitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 3 },
  urlText: { color: '#FEF08A', fontSize: 11, marginTop: 3, fontFamily: 'monospace' },
});
