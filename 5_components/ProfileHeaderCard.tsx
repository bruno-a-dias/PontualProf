import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../2_theme/ThemeContext';
import { useDatabase } from '../3_database/DatabaseContext';
import { ShadcnBadge, ShadcnButton, ShadcnCard, ShadcnInput } from './ShadcnPrimitives';

export const ProfileHeaderCard: React.FC = () => {
  const { theme } = useAppTheme();
  const { userProfile, updateUserProfile, activeSemester, semesters, setActiveSemester } =
    useDatabase();
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(userProfile.name);
  const [tempRole, setTempRole] = useState(userProfile.role);

  const handlePickUserPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      updateUserProfile({ photoUri: uri });
    }
  };

  const handleSaveProfile = () => {
    updateUserProfile({
      name: tempName.trim() || userProfile.name,
      role: tempRole.trim() || userProfile.role,
    });
    setEditingName(false);
  };

  return (
    <ShadcnCard style={styles.container}>
      <View style={styles.topRow}>
        <ShadcnBadge label="DOCENTE" variant="primary" />
        <View style={styles.semesterRow}>
          {semesters.map((sem) => (
            <TouchableOpacity
              key={sem}
              onPress={() => setActiveSemester(sem)}
              style={[
                styles.semChip,
                {
                  backgroundColor:
                    sem === activeSemester ? theme.colors.accent : theme.colors.muted,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color:
                    sem === activeSemester
                      ? theme.colors.accentForeground
                      : theme.colors.foreground,
                }}
              >
                {sem}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Foto do Usuário Centralizada e Nome Logo Abaixo */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickUserPhoto} style={styles.avatarButton}>
          {userProfile.photoUri ? (
            <Image
              source={{ uri: userProfile.photoUri }}
              style={[styles.avatarImg, { borderColor: theme.colors.accent }]}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.accent,
                },
              ]}
            >
              <Text style={styles.avatarInitial}>👨‍🏫</Text>
            </View>
          )}
          <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ fontSize: 12 }}>📷</Text>
          </View>
        </TouchableOpacity>

        {/* Nome logo abaixo da foto */}
        <Text style={[styles.userName, { color: theme.colors.foreground }]}>
          {userProfile.name}
        </Text>
        <Text style={[styles.userRole, { color: theme.colors.mutedForeground }]}>
          {userProfile.role}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <ShadcnButton label="📤 Subir Foto" variant="outline" onPress={handlePickUserPhoto} />
        <ShadcnButton
          label={editingName ? 'Fechar' : '✏️ Editar Nome'}
          variant="outline"
          onPress={() => setEditingName(!editingName)}
        />
      </View>

      {editingName && (
        <View style={styles.editBox}>
          <ShadcnInput
            label="Seu Nome (exibido abaixo da foto)"
            value={tempName}
            onChangeText={setTempName}
          />
          <ShadcnInput
            label="Cargo / Semestre"
            value={tempRole}
            onChangeText={setTempRole}
          />
          <ShadcnButton label="Salvar Perfil" variant="primary" onPress={handleSaveProfile} />
        </View>
      )}
    </ShadcnCard>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  semesterRow: { flexDirection: 'row', gap: 6 },
  semChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  avatarSection: { alignItems: 'center', marginVertical: 14 },
  avatarButton: { position: 'relative' },
  avatarImg: { width: 92, height: 92, borderRadius: 46, borderWidth: 3 },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 36 },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  userName: { fontSize: 18, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  userRole: { fontSize: 12, fontWeight: '500', marginTop: 2, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editBox: { width: '100%', marginTop: 12 },
});
