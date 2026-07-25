import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { ROLE_LABELS } from '@/lib/types';
import type { Profile, UserRole } from '@/lib/types';
import { fetchUsers, createUser, updateUser, deleteUser } from '@/lib/users-api';
import { Card, Badge, Button, EmptyState, LoadingScreen, Select } from '@/components/ui';
import { Users, Plus, Trash2, Edit3, X, Shield, UserCheck, Wrench } from 'lucide-react-native';

export default function UsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('technician');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    try { const data = await fetchUsers(); setUsers(data); } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al cargar usuarios'); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));
  const onRefresh = () => { setRefreshing(true); loadUsers(); };
  const openCreateModal = () => { setEditingUser(null); setEmail(''); setPassword(''); setFullName(''); setRole('technician'); setShowModal(true); };
  const openEditModal = (user: Profile) => { setEditingUser(user); setEmail(user.email); setPassword(''); setFullName(user.full_name); setRole(user.role); setShowModal(true); };

  const handleSubmit = async () => {
    if (!email.trim() || !fullName.trim()) { Alert.alert('Error', 'Email y nombre son obligatorios'); return; }
    if (!editingUser && !password.trim()) { Alert.alert('Error', 'La contraseña es obligatoria para nuevos usuarios'); return; }
    setSubmitting(true);
    try {
      if (editingUser) { await updateUser(editingUser.id, { full_name: fullName.trim(), role }); }
      else { await createUser({ email: email.trim(), password: password.trim(), full_name: fullName.trim(), role }); }
      setShowModal(false); loadUsers(); Alert.alert('Éxito', editingUser ? 'Usuario actualizado' : 'Usuario creado');
    } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar usuario'); } finally { setSubmitting(false); }
  };

  const handleDelete = (user: Profile) => {
    Alert.alert('Eliminar usuario', `¿Está seguro de eliminar a ${user.full_name}?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await deleteUser(user.id); loadUsers(); Alert.alert('Éxito', 'Usuario eliminado'); } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al eliminar'); } } }]);
  };

  const getRoleIcon = (r: UserRole) => { if (r === 'admin') return <Shield size={14} color={theme.colors.error} />; if (r === 'supervisor') return <UserCheck size={14} color={theme.colors.info} />; return <Wrench size={14} color={theme.colors.success} />; };
  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Gestión de Usuarios</Text><TouchableOpacity style={styles.fab} onPress={openCreateModal}><Plus size={22} color="#fff" /></TouchableOpacity></View>
      <FlatList data={users} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon={<Users size={48} color={theme.colors.neutral300} />} title="No hay usuarios" subtitle="Crea un nuevo usuario" />}
        renderItem={({ item }) => (
          <Card><View style={styles.userRow}><View style={styles.userInfo}><Text style={styles.userName}>{item.full_name}</Text><Text style={styles.userEmail}>{item.email}</Text><View style={styles.badgeRow}><View style={styles.roleBadge}>{getRoleIcon(item.role)}<Text style={styles.roleText}>{ROLE_LABELS[item.role]}</Text></View><Badge label={item.active ? 'Activo' : 'Inactivo'} color={item.active ? theme.colors.success : theme.colors.neutral400} /></View></View><View style={styles.actions}><TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}><Edit3 size={18} color={theme.colors.primary} /></TouchableOpacity><TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}><Trash2 size={18} color={theme.colors.error} /></TouchableOpacity></View></View></Card>
        )}
      />
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</Text><TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color={theme.colors.neutral700} /></TouchableOpacity></View><ScrollView style={styles.modalBody}><Text style={styles.label}>Nombre completo *</Text><TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Nombre del usuario" placeholderTextColor={theme.colors.textMuted} /><Text style={styles.label}>Email *</Text><TextInput style={[styles.input, editingUser && { opacity: 0.5 }]} value={email} onChangeText={setEmail} placeholder="correo@empresa.com" placeholderTextColor={theme.colors.textMuted} keyboardType="email-address" autoCapitalize="none" editable={!editingUser} />{!editingUser && (<><Text style={styles.label}>Contraseña *</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={theme.colors.textMuted} secureTextEntry /></>)}<Text style={styles.label}>Rol *</Text><View style={styles.roleSelector}>{(['admin', 'supervisor', 'technician'] as UserRole[]).map((r) => (<TouchableOpacity key={r} style={[styles.roleOption, role === r && styles.roleOptionActive]} onPress={() => setRole(r)}>{getRoleIcon(r)}<Text style={[styles.roleOptionText, role === r && { color: '#fff' }]}>{ROLE_LABELS[r]}</Text></TouchableOpacity>))}</View></ScrollView><Button title={submitting ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear usuario'} onPress={handleSubmit} loading={submitting} /></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  title: { fontSize: theme.fontSize.xxl, fontWeight: '700', color: theme.colors.text },
  fab: { backgroundColor: theme.colors.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  list: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  userEmail: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing.sm, paddingVertical: 4, borderRadius: theme.radius.full, backgroundColor: theme.colors.neutral100 },
  roleText: { fontSize: theme.fontSize.xs, fontWeight: '600', color: theme.colors.neutral700 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.neutral50, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  deleteBtn: { borderColor: '#FECACA' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.lg },
  modalContent: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  modalTitle: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  modalBody: { marginBottom: theme.spacing.md },
  label: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.neutral50, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm },
  roleSelector: { flexDirection: 'column', gap: 8 },
  roleOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  roleOptionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  roleOptionText: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.neutral700 },
});
