import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { dbGetOrders, fullSync, isOnline, dbGetOrderDetail } from '@/lib/offline';
import { theme } from '@/lib/theme';
import { PRIORITY_LABELS, PRIORITY_COLORS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_TYPE_LABELS, ORDER_TYPE_COLORS } from '@/lib/types';
import type { ServiceOrder, UserRole } from '@/lib/types';
import { Card, Badge, EmptyState, LoadingScreen } from '@/components/ui';
import { ClipboardList, Plus, ChevronRight, Bell } from 'lucide-react-native';

export default function OrdersListScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [filter, setFilter] = useState<'all' | 'pendiente' | 'en_progreso' | 'completada'>('all');
  const [obsMap, setObsMap] = useState<Record<string, boolean>>({});
  const role: UserRole = profile?.role || 'technician';
  const userId = profile?.id;

  const loadOrders = useCallback(async () => {
    if (!userId) return;
    try {
      const cached = await dbGetOrders(role, userId);
      setOrders(cached);
      const newObsMap: Record<string, boolean> = {};
      for (const order of cached) {
        const detail = await dbGetOrderDetail(order.id);
        if (detail?.maintenance && detail.maintenance.status === 'con_observacion') {
          newObsMap[order.id] = true;
        }
      }
      setObsMap(newObsMap);
      setLoading(false);
      const connected = await isOnline();
      if (connected) {
        await fullSync(role, userId);
        const fresh = await dbGetOrders(role, userId);
        setOrders(fresh);
        const freshObsMap: Record<string, boolean> = {};
        for (const order of fresh) {
          const detail = await dbGetOrderDetail(order.id);
          if (detail?.maintenance && detail.maintenance.status === 'con_observacion') {
            freshObsMap[order.id] = true;
          }
        }
        setObsMap(freshObsMap);
        return;
      }
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, userId]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(useCallback(() => {
    loadOrders();
    intervalRef.current = setInterval(async () => {
      if (!userId) return;
      const connected = await isOnline();
      if (connected) {
        await fullSync(role, userId);
        const fresh = await dbGetOrders(role, userId);
        setOrders(fresh);
      }
    }, 60000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [loadOrders, role, userId]));

  const onRefresh = () => { setRefreshing(true); loadOrders(); };
  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Órdenes de Servicio</Text>
        {role !== 'technician' && (
          <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/orders/new')}>
            <Plus size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.filterRow}>
        {[{ key: 'all', label: 'Todas' }, { key: 'pendiente', label: 'Pendientes' }, { key: 'en_progreso', label: 'En progreso' }, { key: 'completada', label: 'Completadas' }].map((f) => (
          <TouchableOpacity key={f.key} style={[styles.filterChip, filter === f.key && styles.filterChipActive]} onPress={() => setFilter(f.key as typeof filter)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={filteredOrders} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon={<ClipboardList size={48} color={theme.colors.neutral300} />} title="No hay órdenes de servicio" subtitle={role === 'technician' ? 'No tienes órdenes asignadas' : 'Crea una nueva orden de servicio'} />}
        renderItem={({ item }) => (
          <Card>
            <TouchableOpacity onPress={() => router.push(`/(tabs)/orders/${item.id}` as any)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardAddress}>{item.address}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.description || 'Sin descripción'}</Text>
                </View>
                {obsMap[item.id] && <View style={styles.notifBadge}><Bell size={14} color="#fff" /></View>}
                <ChevronRight size={20} color={theme.colors.neutral400} />
              </View>
              <View style={styles.badgeRow}>
                <Badge label={ORDER_STATUS_LABELS[item.status]} color={ORDER_STATUS_COLORS[item.status]} />
                <Badge label={`Prioridad ${PRIORITY_LABELS[item.priority]}`} color={PRIORITY_COLORS[item.priority]} />
                <Badge label={ORDER_TYPE_LABELS[item.order_type] || 'Mantenimiento'} color={ORDER_TYPE_COLORS[item.order_type] || ORDER_TYPE_COLORS['Mantenimiento']} />
              </View>
              <View style={styles.cardFooter}>
                {item.assigned_to_profile ? <Text style={styles.footerText}>Asignado a: {item.assigned_to_profile.full_name}</Text> : <Text style={styles.footerTextMuted}>Sin asignar</Text>}
                <Text style={styles.footerDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notifBadge: { backgroundColor: theme.colors.error, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  title: { fontSize: theme.fontSize.xxl, fontWeight: '700', color: theme.colors.text },
  fab: { backgroundColor: theme.colors.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  filterChip: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.neutral100 },
  filterChipActive: { backgroundColor: theme.colors.primary },
  filterText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral600, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardAddress: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  cardDesc: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.neutral100 },
  footerText: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary },
  footerTextMuted: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, fontStyle: 'italic' },
  footerDate: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
});
