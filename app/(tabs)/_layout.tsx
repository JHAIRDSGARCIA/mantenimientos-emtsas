import { Redirect, Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { ClipboardList, CheckSquare, Users, ListChecks, LayoutGrid, FileSpreadsheet, UserCircle } from 'lucide-react-native';
import type { UserRole } from '@/lib/types';

export default function TabLayout() {
  const { profile, session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return <View style={styles.loading}><Text style={{ color: theme.colors.textSecondary }}>Cargando...</Text></View>;
  if (!session || !profile) return <Redirect href="/login" />;
  const role: UserRole = profile.role;
  const showOrders = role === 'admin' || role === 'supervisor' || role === 'technician';
  const showReviews = role === 'admin' || role === 'supervisor';
  const showExport = role === 'admin' || role === 'supervisor';
  const showUsers = role === 'admin';
  const showFormFields = role === 'admin';
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.neutral400, tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom + 4, height: 56 + insets.bottom }], tabBarLabelStyle: styles.tabBarLabel, tabBarItemStyle: { paddingVertical: 4 } }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ size, color }) => <LayoutGrid size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Órdenes', tabBarIcon: ({ size, color }) => <ClipboardList size={size} color={color} /> }} listeners={{ tabPress: (e) => { if (!showOrders) e.preventDefault(); } }} />
      <Tabs.Screen name="reviews" options={{ title: 'Revisión', tabBarIcon: ({ size, color }) => <CheckSquare size={size} color={color} /> }} listeners={{ tabPress: (e) => { if (!showReviews) e.preventDefault(); } }} />
      <Tabs.Screen name="export" options={{ title: 'Exportar', tabBarIcon: ({ size, color }) => <FileSpreadsheet size={size} color={color} /> }} listeners={{ tabPress: (e) => { if (!showExport) e.preventDefault(); } }} />
      <Tabs.Screen name="users" options={{ title: 'Usuarios', tabBarIcon: ({ size, color }) => <Users size={size} color={color} /> }} listeners={{ tabPress: (e) => { if (!showUsers) e.preventDefault(); } }} />
      <Tabs.Screen name="form-fields" options={{ title: 'Campos', tabBarIcon: ({ size, color }) => <ListChecks size={size} color={color} /> }} listeners={{ tabPress: (e) => { if (!showFormFields) e.preventDefault(); } }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ size, color }) => <UserCircle size={size} color={color} /> }} />
      <Tabs.Screen name="orders/new" options={{ href: null }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="orders/[id]/execute" options={{ href: null }} />
      <Tabs.Screen name="reviews/[id]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  tabBar: { backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  tabBarLabel: { fontSize: 11, fontWeight: '500' },
});
