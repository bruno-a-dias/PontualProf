import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { RoomType, ShiftType } from '../1_types/types';
import { useAppTheme } from '../2_theme/ThemeContext';
import { useDatabase } from '../3_database/DatabaseContext';
import { ShadcnButton, ShadcnCard, ShadcnInput } from '../5_components/ShadcnPrimitives';

export const AdminPanelScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    activeSemester,
    institutions,
    pontoRules,
    upsertClass,
    upsertInstitution,
    upsertPontoRule,
    deletePontoRule,
    addSemester,
  } = useDatabase();

  // Estado do formulário de Matéria / Sala ou Laboratório
  const [dayOfWeek, setDayOfWeek] = useState<number>(3);
  const [shift, setShift] = useState<ShiftType>('Matutino');
  const [startTime, setStartTime] = useState<string>('08:15');
  const [endTime, setEndTime] = useState<string>('11:00');
  const [subject, setSubject] = useState<string>('');
  const [campus, setCampus] = useState<string>('Campus Sul');
  const [roomType, setRoomType] = useState<RoomType>('Sala');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [selectedInstId, setSelectedInstId] = useState<string>(institutions[0]?.id || 'inst_iesb');

  // Estado do formulário de Instituição + Logo
  const [newInstName, setNewInstName] = useState<string>('');
  const [newInstUrl, setNewInstUrl] = useState<string>('');
  const [newInstLogo, setNewInstLogo] = useState<string>('');

  // Estado do formulário de Regra de Link do Botão de Ponto por Dia/Turno
  const [ruleDay, setRuleDay] = useState<'ALL' | '1' | '2' | '3' | '4' | '5' | '6'>('ALL');
  const [ruleShift, setRuleShift] = useState<'ALL' | ShiftType>('Matutino');
  const [ruleUrl, setRuleUrl] = useState<string>('');

  // Estado de Novo Semestre
  const [newSemName, setNewSemName] = useState<string>('2027/2');

  const applyShiftPreset = (s: ShiftType, start: string, end: string) => {
    setShift(s);
    setStartTime(start);
    setEndTime(end);
    if (s === 'Especial') {
      setDayOfWeek(3);
      setCampus('Campus Sul');
    }
  };

  const handleSaveClass = () => {
    if (!subject.trim() || !roomNumber.trim()) return;
    upsertClass({
      id: `cls_${Date.now()}`,
      semester: activeSemester,
      institutionId: selectedInstId,
      dayOfWeek,
      shift,
      startTime,
      endTime,
      subject: subject.trim(),
      campus: campus.trim(),
      roomType,
      roomNumber: roomNumber.trim(),
    });
    setSubject('');
    setRoomNumber('');
  };

  const handlePickInstitutionLogo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setNewInstLogo(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
    }
  };

  const handleSaveInstitution = () => {
    if (!newInstName.trim() || !newInstUrl.trim()) return;
    upsertInstitution({
      id: `inst_${Date.now()}`,
      name: newInstName.trim(),
      logoUri: newInstLogo,
      defaultPontoUrl: newInstUrl.trim(),
    });
    setNewInstName('');
    setNewInstUrl('');
    setNewInstLogo('');
  };

  const handleSavePontoRule = () => {
    if (!ruleUrl.trim()) return;
    upsertPontoRule({
      id: `rule_${Date.now()}`,
      institutionId: selectedInstId,
      dayOfWeek: ruleDay,
      shift: ruleShift,
      url: ruleUrl.trim(),
    });
    setRuleUrl('');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 1. Cadastrar Matéria, Turno, Campus, Tipo (Sala ou Laboratório) e Número */}
      <ShadcnCard>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          ➕ Cadastrar Matéria, Campus e Sala/Laboratório ({activeSemester})
        </Text>

        <View style={styles.presetsRow}>
          <ShadcnButton
            label="☀️ Matutino (08:15–11:00)"
            variant="outline"
            onPress={() => applyShiftPreset('Matutino', '08:15', '11:00')}
          />
          <ShadcnButton
            label="🔥 Quarta Sul (11:00–12:15)"
            variant="outline"
            onPress={() => applyShiftPreset('Especial', '11:00', '12:15')}
          />
          <ShadcnButton
            label="🌙 Noturno (19:15–22:00)"
            variant="outline"
            onPress={() => applyShiftPreset('Noturno', '19:15', '22:00')}
          />
        </View>

        <ShadcnInput
          label="Nome da Matéria / Disciplina"
          value={subject}
          onChangeText={setSubject}
          placeholder="Ex: Arquitetura de Software"
        />

        <ShadcnInput
          label="Campus"
          value={campus}
          onChangeText={setCampus}
          placeholder="Ex: Campus Sul"
        />

        {/* Escolha entre Sala ou Laboratório */}
        <Text style={[styles.label, { color: theme.colors.foreground }]}>
          Tipo de Espaço (Sala ou Laboratório):
        </Text>
        <View style={styles.toggleRow}>
          {(['Sala', 'Laboratório'] as RoomType[]).map((rt) => (
            <TouchableOpacity
              key={rt}
              onPress={() => setRoomType(rt)}
              style={[
                styles.toggleChip,
                {
                  backgroundColor:
                    roomType === rt ? theme.colors.primary : theme.colors.muted,
                },
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
                {rt === 'Laboratório' ? '💻 Laboratório' : '🏫 Sala'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ShadcnInput
          label="Número da Sala ou Laboratório"
          value={roomNumber}
          onChangeText={setRoomNumber}
          placeholder="Ex: B-204 ou Lab 02"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <ShadcnInput
              label="Entrada (HH:MM)"
              value={startTime}
              onChangeText={setStartTime}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ShadcnInput label="Saída (HH:MM)" value={endTime} onChangeText={setEndTime} />
          </View>
        </View>

        <ShadcnButton label="💾 Salvar Aula na Grade" onPress={handleSaveClass} />
      </ShadcnCard>

      {/* 2. Cadastro de Instituições & Upload de Logo */}
      <ShadcnCard>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          🏛️ Instituições de Ensino & Upload de Logo
        </Text>
        <ShadcnInput
          label="Nome / Sigla da Instituição"
          value={newInstName}
          onChangeText={setNewInstName}
          placeholder="Ex: IESB ou 2ª Instituição"
        />
        <ShadcnInput
          label="Link Base do Sistema de Ponto"
          value={newInstUrl}
          onChangeText={setNewInstUrl}
          placeholder="https://portal.iesb.br/ponto-docente"
        />
        <View style={styles.row}>
          <ShadcnButton
            label={newInstLogo ? '✅ Logo Selecionada' : '🖼️ Subir Logo da Instituição'}
            variant="outline"
            onPress={handlePickInstitutionLogo}
          />
          <ShadcnButton label="➕ Salvar Instituição" onPress={handleSaveInstitution} />
        </View>
      </ShadcnCard>

      {/* 3. Personalização Inteligente do Botão Único de Ponto por Dia e Turno */}
      <ShadcnCard>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          🔗 Personalizar Link do Botão Único de Ponto (Por Dia e Turno)
        </Text>
        <ShadcnInput
          label="URL do Ponto para o Turno/Dia selecionado"
          value={ruleUrl}
          onChangeText={setRuleUrl}
          placeholder="https://portal.iesb.br/ponto-docente?turno=noturno"
        />
        <ShadcnButton label="➕ Salvar Regra Automática" onPress={handleSavePontoRule} />

        <View style={{ marginTop: 12, gap: 6 }}>
          {pontoRules.map((r) => (
            <View
              key={r.id}
              style={[
                styles.ruleRow,
                { backgroundColor: theme.colors.muted, borderColor: theme.colors.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.foreground, fontWeight: '800', fontSize: 12 }}>
                  Dia: {r.dayOfWeek} • Turno: {r.shift}
                </Text>
                <Text
                  style={{ color: theme.colors.accent, fontSize: 11, fontFamily: 'monospace' }}
                  numberOfLines={1}
                >
                  {r.url}
                </Text>
              </View>
              <ShadcnButton
                label="✕"
                variant="outline"
                onPress={() => deletePontoRule(r.id)}
              />
            </View>
          ))}
        </View>
      </ShadcnCard>

      {/* 4. Criar Semestres Futuros */}
      <ShadcnCard>
        <Text style={[styles.cardTitle, { color: theme.colors.foreground }]}>
          📆 Criar Próximo Semestre Letivo
        </Text>
        <ShadcnInput
          label="Identificação do Semestre"
          value={newSemName}
          onChangeText={setNewSemName}
          placeholder="Ex: 2027/2 ou 2028/1"
        />
        <ShadcnButton
          label="Clonar Grade para Novo Semestre"
          variant="gold"
          onPress={() => addSemester(newSemName.trim(), true)}
        />
      </ShadcnCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 14, gap: 16 },
  cardTitle: { fontSize: 15, fontWeight: '900', marginBottom: 12 },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleChip: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
});
