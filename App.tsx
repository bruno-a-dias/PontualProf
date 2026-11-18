import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { ThemeProvider, useAppTheme } from './2_theme/ThemeContext';
import { DatabaseProvider } from './3_database/DatabaseContext';
import { HomeScreen } from './6_screens/HomeScreen';
import { WeeklyScheduleScreen } from './6_screens/WeeklyScheduleScreen';
import { AdminPanelScreen } from './6_screens/AdminPanelScreen';
import { DatabaseBackupScreen } from './6_screens/DatabaseBackupScreen';
import { ThemeMode } from './1_types/types';

type TabKey = 'home' | 'schedule' | 'admin' | 'database';

function MainNavigationShell() {
  const { theme, themeMode, setThemeMode } = useAppTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  const themeOptions: { key: ThemeMode; label: string }[] = [
    { key: 'light', label: '☀️ Claro' },
    { key: 'dark', label: '🌙 Escuro' },
    { key: 'rubro', label: '🔥 Rubro & Ouro' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={themeMode === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={theme.colors.card}
      />

      {/* Faixa Superior Rubro & Ouro */}
      <View style={[styles.topStripe, { backgroundColor: theme.colors.primary }]} />

      {/* Header Fixo com Seletor de Temas */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoBadge,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.accent,
              },
            ]}
          >
            <Text style={styles.logoText}>P</Text>
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: theme.colors.foreground }]}>PONTUAL</Text>
            <Text style={[styles.brandSubtitle, { color: theme.colors.mutedForeground }]}>
              Grade & Ponto Docente
            </Text>
          </View>
        </View>

        {/* Seletor Rápido dos 3 Temas */}
        <View
          style={[
            styles.themeSwitchGroup,
            { backgroundColor: theme.colors.muted, borderColor: theme.colors.border },
          ]}
        >
          {themeOptions.map((opt) => {
            const active = themeMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setThemeMode(opt.key)}
                style={[
                  styles.themePill,
                  active && { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.themePillText,
                    { color: active ? '#FFFFFF' : theme.colors.foreground },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Conteúdo da Aba Ativa */}
      <View style={styles.contentArea}>
        {activeTab === 'home' && <HomeScreen onNavigateAdmin={() => setActiveTab('admin')} />}
        {activeTab === 'schedule' && <WeeklyScheduleScreen onNavigateAdmin={() => setActiveTab('admin')} />}
        {activeTab === 'admin' && <AdminPanelScreen />}
        {activeTab === 'database' && <DatabaseBackupScreen />}
      </View>

      {/* Barra de Navegação Inferior (Mobile-First) */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        {[
          { key: 'home', icon: '🏠', label: 'Início & Ponto' },
          { key: 'schedule', icon: '📅', label: 'Grade' },
          { key: 'admin', icon: '⚙️', label: 'Admin' },
          { key: 'database', icon: '💾', label: 'Dados Locais' },
        ].map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key as TabKey)}
              style={[
                styles.tabButton,
                isSelected && { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isSelected ? '#FFFFFF' : theme.colors.mutedForeground },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <DatabaseProvider>
      <ThemeProvider>
        <MainNavigationShell />
      </ThemeProvider>
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topStripe: { height: 4, width: '100%' },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  brandTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  brandSubtitle: { fontSize: 11, fontWeight: '500' },
  themeSwitchGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
  },
  themePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  themePillText: { fontSize: 11, fontWeight: '700' },
  contentArea: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
