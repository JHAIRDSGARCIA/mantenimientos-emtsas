import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform, Linking, Modal, TextInput } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getPhotoUrl } from '@/lib/storage';
import { theme } from '@/lib/theme';
import { PRIORITY_LABELS, PRIORITY_COLORS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, STATUS_LABELS, STATUS_COLORS, ORDER_TYPE_LABELS, ORDER_TYPE_COLORS } from '@/lib/types';
import type { ServiceOrder, Maintenance, Observation, FormField, UserRole, Priority, Profile } from '@/lib/types';
import { Card, Badge, Button, EmptyState, Select } from '@/components/ui';
import { dbGetOrderDetail, dbSaveOrderDetail, dbDeleteOrder, fullSync, isOnline } from '@/lib/offline';
import { ArrowLeft, MapPin, Calendar, User, Wrench, Play, CheckCircle, MessageSquare, Pencil, Trash2, ExternalLink } from 'lucide-react-native';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const role: UserRole = profile?.role || 'technician';
  const canManage = role === 'admin' || role === 'supervisor';
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAddress, setEditAddress] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('media');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadTechnicians = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'technician').eq('active', true).order('full_name');
    if (data) setTechnicians(data as Profile[]);
  }, []);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await dbGetOrderDetail(id);
      if (detail) {
        setOrder(detail.order);
        setMaintenance(detail.maintenance);
        setObservations(detail.observations || []);
      }
      setLoading(false);
      const connected = await isOnline();
      if (connected) {
        await fullSync(role, profile?.id || '');
        const fresh = await dbGetOrderDetail(id);
        if (fresh) {
          setOrder(fresh.order);
          setMaintenance(fresh.maintenance);
        }
        if (fresh?.maintenance) {
          const { data: obsData } = await supabase.from('observations').select('*, author_profile:profiles(*)').eq('maintenance_id', fresh.maintenance.id).order('created_at', { ascending: false });
          const serverObs = (obsData as unknown as Observation[]) || [];
          setObservations(serverObs);
          await dbSaveOrderDetail({ order: fresh.order, maintenance: fresh.maintenance, observations: serverObs });
        } else if (fresh) {
          setObservations(fresh.observations || []);
        }
      }
    } catch (err) {
      console.error('Error loading order detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id, role, profile?.id]);

  useFocusEffect(useCallback(() => { loadData(); loadTechnicians(); }, [loadData, loadTechnicians]));

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  if (!order) return <View style={styles.container}><Text style={styles.errorText}>Orden no encontrada</Text></View>;

  const openGoogleMaps = (lat: number, lng: number) => {
    const url = Platform.OS === 'web' ? `https://www.google.com/maps?q=${lat},${lng}` : `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url);
  };

  const startEdit = () => {
    if (!order) return;
    setEditAddress(order.address);
    setEditDescription(order.description);
    setEditPriority(order.priority);
    setEditAssignedTo(order.assigned_to || '');
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!order || !editAddress.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('service_orders').update({ address: editAddress.trim(), description: editDescription.trim(), priority: editPriority, assigned_to: editAssignedTo || null }).eq('id', order.id);
      if (error) throw error;
      setShowEditModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteOrder = () => {
    Alert.alert('Eliminar orden', '¿Está seguro de eliminar esta orden de servicio?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('service_orders').delete().eq('id', order!.id);
          if (error) throw error;
          await dbDeleteOrder(order!.id);
          router.back();
        } catch (err) {
          Alert.alert('Error', err instanceof Error ? err.message : 'Error al eliminar');
        }
      } },
    ]);
  };

  const orderPhotoUrl = getPhotoUrl(order.photo_path);
  const maintPhotoUrl = getPhotoUrl(maintenance?.photo_path || null);
  const canExecute = role === 'technician' && order.status === 'pendiente' && order.assigned_to === profile?.id;
  const canViewMaintenance = maintenance !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.text} /></TouchableOpacity><Text style={styles.title}>Orden de Servicio</Text></View>
      <Card>
        <View style={styles.badgeRow}>
          <Badge label={ORDER_STATUS_LABELS[order.status]} color={ORDER_STATUS_COLORS[order.status]} />
          <Badge label={`Prioridad ${PRIORITY_LABELS[order.priority]}`} color={PRIORITY_COLORS[order.priority]} />
          <Badge label={ORDER_TYPE_LABELS[order.order_type] || 'Mantenimiento'} color={ORDER_TYPE_COLORS[order.order_type] || ORDER_TYPE_COLORS['Mantenimiento']} />
        </View>
        <Text style={styles.address}>{order.address}</Text>
        <Text style={styles.description}>{order.description || 'Sin descripción'}</Text>
        <View style={styles.infoRow}><Calendar size={16} color={theme.colors.textSecondary} /><Text style={styles.infoText}>Creada: {new Date(order.created_at).toLocaleString()}</Text></View>
        {order.latitude !== null && (
          <View style={styles.infoRow}><MapPin size={16} color={theme.colors.textSecondary} /><Text style={styles.infoText}>{order.latitude.toFixed(6)}, {order.longitude?.toFixed(6)}</Text><TouchableOpacity onPress={() => openGoogleMaps(order.latitude!, order.longitude!)} style={styles.mapLink}><ExternalLink size={16} color="#0088cc" /></TouchableOpacity></View>
        )}
        {order.assigned_to_profile && <View style={styles.infoRow}><User size={16} color={theme.colors.textSecondary} /><Text style={styles.infoText}>Técnico: {order.assigned_to_profile.full_name}</Text></View>}
        {order.created_by_profile && <View style={styles.infoRow}><User size={16} color={theme.colors.textSecondary} /><Text style={styles.infoText}>Creado por: {order.created_by_profile.full_name}</Text></View>}
        {orderPhotoUrl && <View style={styles.photoSection}><Text style={styles.photoLabel}>Foto de la orden:</Text><Image source={{ uri: orderPhotoUrl }} style={styles.photo} /></View>}
      </Card>
      {canManage && order.status === 'pendiente' && (
        <View style={styles.actionRow}><Button title="Editar" onPress={startEdit} variant="outline" style={{ flex: 1 }} icon={<Pencil size={18} color={theme.colors.primary} />} /><Button title="Eliminar" onPress={deleteOrder} variant="danger" style={{ flex: 1 }} icon={<Trash2 size={18} color="#fff" />} /></View>
      )}
      {canExecute && <Button title="Ejecutar mantenimiento" onPress={() => router.push(`/(tabs)/orders/${order.id}/execute` as any)} icon={<Play size={20} color="#fff" />} />}
      {canViewMaintenance && maintenance && (
        <>
          <Text style={styles.sectionTitle}>Mantenimiento realizado</Text>
          <Card>
            <View style={styles.badgeRow}><Badge label={STATUS_LABELS[maintenance.status]} color={STATUS_COLORS[maintenance.status]} /></View>
            <View style={styles.maintInfo}>
              <InfoRow label="Tipo de lámpara" value={maintenance.tipo_lampara} />
              <InfoRow label="Potencia" value={maintenance.potencia} />
              <InfoRow label="Tipo de poste" value={maintenance.tipo_poste} />
              {maintenance.notes && <InfoRow label="Notas" value={maintenance.notes} />}
              {maintenance.photo_taken_at && <InfoRow label="Fecha/hora foto" value={new Date(maintenance.photo_taken_at).toLocaleString()} />}
              {maintenance.photo_latitude !== null && (
                <View style={styles.infoRow}><MapPin size={16} color={theme.colors.textSecondary} /><Text style={styles.infoText}>{maintenance.photo_latitude?.toFixed(6)}, {maintenance.photo_longitude?.toFixed(6)}</Text><TouchableOpacity onPress={() => openGoogleMaps(maintenance.photo_latitude!, maintenance.photo_longitude!)} style={styles.mapLink}><ExternalLink size={16} color="#0088cc" /></TouchableOpacity></View>
              )}
            </View>
            {maintPhotoUrl && <View style={styles.photoSection}><Text style={styles.photoLabel}>Foto del trabajo:</Text><Image source={{ uri: maintPhotoUrl }} style={styles.photo} /></View>}
          </Card>
          {observations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Observaciones del supervisor</Text>
              {observations.map((obs) => (
                <Card key={obs.id}><View style={styles.obsHeader}><MessageSquare size={16} color={theme.colors.primary} /><Text style={styles.obsAuthor}>{obs.author_profile?.full_name || 'Supervisor'}</Text><Text style={styles.obsDate}>{new Date(obs.created_at).toLocaleDateString()}</Text></View><Text style={styles.obsComment}>{obs.comment}</Text></Card>
              ))}
            </>
          )}
          {role !== 'technician' && <Button title="Ir a revisión" onPress={() => router.push(`/(tabs)/reviews/${maintenance.id}` as any)} variant="outline" icon={<Wrench size={20} color={theme.colors.primary} />} />}
        </>
      )}
      {!canViewMaintenance && role === 'technician' && order.status === 'pendiente' && (
        <EmptyState icon={<Wrench size={48} color={theme.colors.neutral300} />} title="Sin mantenimiento" subtitle="Presiona 'Ejecutar' para registrar el mantenimiento" />
      )}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.editModalOverlay}><View style={styles.editModalContent}><Text style={styles.editModalTitle}>Editar orden de servicio</Text><TextInput style={styles.editInput} value={editAddress} onChangeText={setEditAddress} placeholder="Dirección" placeholderTextColor={theme.colors.textMuted} /><TextInput style={[styles.editInput, styles.editTextArea]} value={editDescription} onChangeText={setEditDescription} placeholder="Descripción" placeholderTextColor={theme.colors.textMuted} multiline textAlignVertical="top" /><Text style={{ fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 6 }}>Prioridad</Text><View style={styles.editPriorityRow}>{(['alta', 'media', 'baja'] as Priority[]).map((p) => (<TouchableOpacity key={p} style={[styles.editPriorityChip, editPriority === p && { backgroundColor: p === 'alta' ? '#DC2626' : p === 'media' ? '#F59E0B' : '#10B981', borderColor: 'transparent' }]} onPress={() => setEditPriority(p)}><Text style={[styles.editPriorityText, editPriority === p && { color: '#fff' }]}>{p === 'alta' ? 'Alta' : p === 'media' ? 'Media' : 'Baja'}</Text></TouchableOpacity>))}</View><Text style={{ fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 6 }}>Asignar a técnico</Text><Select value={editAssignedTo ? technicians.find(t => t.id === editAssignedTo)?.full_name || '' : ''} options={technicians.map(t => t.full_name)} onSelect={(name) => { const tech = technicians.find(t => t.full_name === name); setEditAssignedTo(tech?.id || ''); }} placeholder="Sin asignar" /><View style={styles.editActions}><Button title="Cancelar" onPress={() => setShowEditModal(false)} variant="outline" style={{ flex: 1 }} /><Button title="Guardar" onPress={saveEdit} loading={savingEdit} style={{ flex: 1 }} /></View></View></View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <View style={styles.infoRowContainer}><Text style={styles.infoRowLabel}>{label}:</Text><Text style={styles.infoRowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  errorText: { fontSize: theme.fontSize.md, color: theme.colors.error, textAlign: 'center', marginTop: theme.spacing.xxl },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: theme.spacing.sm },
  address: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  description: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, marginBottom: theme.spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoText: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  photoSection: { marginTop: theme.spacing.sm },
  photoLabel: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 6 },
  photo: { width: '100%', height: 200, borderRadius: theme.radius.md },
  sectionTitle: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  maintInfo: { gap: 6, marginTop: theme.spacing.sm },
  infoRowContainer: { flexDirection: 'row', gap: 8 },
  infoRowLabel: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral600, minWidth: 120 },
  infoRowValue: { fontSize: theme.fontSize.sm, color: theme.colors.text, flex: 1 },
  obsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  obsAuthor: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.text, flex: 1 },
  obsDate: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  obsComment: { fontSize: theme.fontSize.sm, color: theme.colors.neutral700 },
  mapLink: { padding: 4, marginLeft: 4 },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.lg },
  editModalContent: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, maxHeight: '80%' },
  editModalTitle: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
  editInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm },
  editTextArea: { minHeight: 80, textAlignVertical: 'top' },
  editPriorityRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.sm },
  editPriorityChip: { flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', backgroundColor: theme.colors.background },
  editPriorityText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700 },
  editActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
});
