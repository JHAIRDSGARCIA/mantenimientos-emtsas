import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { ROLE_LABELS } from '@/lib/types';
import { Card } from '@/components/ui';
import { LogOut, User, Mail, Shield, RefreshCw, WifiOff, CheckCircle } from 'lucide-react-native';

export default function ProfileScreen() {
  const { profile, signOut, pendingSyncCount, triggerSync } = useAuth();
  const router = useRouter();
  const handleSignOut = () => { Alert.alert('Cerrar sesión', '¿Está seguro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Cerrar sesión', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } }]); };
  const handleSync = async () => { await triggerSync(); Alert.alert('Sincronización', 'Sincronización completada'); };
  if (!profile) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi Perfil</Text>
      <View style={styles.profileHeader}><View style={styles.avatar}><User size={40} color="#fff" /></View><Text style={styles.profileName}>{profile.full_name}</Text><View style={styles.roleBadge}><Shield size={14} color="#fff" /><Text style={styles.roleBadgeText}>{ROLE_LABELS[profile.role]}</Text></View></View>
      <Card><View style={styles.infoRow}><Mail size={18} color={theme.colors.textSecondary} /><Text style={styles.infoText}>{profile.email}</Text></View><View style={styles.infoRow}><User size={18} color={theme.colors.textSecondary} /><Text style={styles.infoText}>Estado: {profile.active ? 'Activo' : 'Inactivo'}</Text></View></Card>
      {pendingSyncCount > 0 && <Card><View style={styles.syncRow}><WifiOff size={20} color={theme.colors.warning} /><View style={{ flex: 1 }}><Text style={styles.syncTitle}>Pendientes de sincronización</Text><Text style={styles.syncCount}>{pendingSyncCount} mantenimiento(s)</Text></View><TouchableOpacity style={styles.syncButton} onPress={handleSync}><RefreshCw size={18} color={theme.colors.primary} /></TouchableOpacity></View></Card>}
      {pendingSyncCount === 0 && <Card><View style={styles.syncRow}><CheckCircle size={20} color={theme.colors.success} /><Text style={styles.syncTitle}>Todo sincronizado</Text></View></Card>}
      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}><LogOut size={20} color={theme.colors.error} /><Text style={styles.logoutText}>Cerrar sesión</Text></TouchableOpacity>
      <Text style={styles.version}>Versión 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  title: { fontSize: theme.fontSize.xxl, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing.lg, marginBottom: theme.spacing.md },
  profileHeader: { alignItems: 'center', marginBottom: theme.spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.md },
  profileName: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.full },
  roleBadgeText: { color: '#fff', fontSize: theme.fontSize.sm, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: theme.spacing.sm },
  infoText: { fontSize: theme.fontSize.md, color: theme.colors.text },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncTitle: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text },
  syncCount: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  syncButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: theme.spacing.md, borderWidth: 1, borderColor: '#FECACA', borderRadius: theme.radius.md, backgroundColor: '#FEF2F2', marginTop: theme.spacing.md },
  logoutText: { color: theme.colors.error, fontSize: theme.fontSize.md, fontWeight: '600' },
  version: { textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xl },
});
