import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { exportMaintenancesToExcel, getStartDate, DateRange } from '@/lib/excel';
import { theme } from '@/lib/theme';
import type { Maintenance, Profile, FormField } from '@/lib/types';
import { Card, Button, Select } from '@/components/ui';
import { ArrowLeft, FileSpreadsheet, Calendar, ChevronRight, Download } from 'lucide-react-native';

export default function ExportScreen() {
  const router = useRouter();
  const [range, setRange] = useState<DateRange>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [selectedTech, setSelectedTech] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTechs, setLoadingTechs] = useState(true);
  const [allFormFields, setAllFormFields] = useState<FormField[]>([]);

  const loadTechnicians = useCallback(async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'technician').eq('active', true).order('full_name');
      setTechnicians((data as Profile[]) || []);
      const { data: fields } = await supabase.from('form_fields').select('*').order('sort_order');
      setAllFormFields((fields as FormField[]) || []);
    } catch (err) { console.error('Error loading technicians:', err); } finally { setLoadingTechs(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadTechnicians(); }, [loadTechnicians]));

  const handleExport = async () => {
    setLoading(true);
    try {
      const { start, end } = getStartDate(range, customStart, customEnd);
      let query = supabase.from('maintenances').select('*, service_order:service_orders(*), technician_profile:profiles(*)').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false });
      if (selectedTech) query = query.eq('technician_id', selectedTech);
      const { data, error } = await query;
      if (error) throw error;
      const maintenances = (data as unknown as Maintenance[]) || [];
      if (maintenances.length === 0) { Alert.alert('Sin datos', 'No hay mantenimientos en el rango de fechas seleccionado'); setLoading(false); return; }
      const maintWithFields = await Promise.all(maintenances.map(async (m) => { const { data: fvs } = await supabase.from('maintenance_field_values').select('*, field:form_fields(*)').eq('maintenance_id', m.id); return { ...m, field_values: (fvs as any[]) || [] }; }));
      const dateLabel = range === 'today' ? 'hoy' : range === 'week' ? 'ultima_semana' : range === 'month' ? 'ultimo_mes' : `${customStart || 'inicio'}_a_${customEnd || 'fin'}`;
      await exportMaintenancesToExcel(maintWithFields, `mantenimientos_${dateLabel}`, allFormFields);
      Alert.alert('Éxito', `Se exportaron ${maintWithFields.filter(m => m.status === 'aprobado').length} mantenimiento(s) aprobado(s)`);
    } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al exportar'); } finally { setLoading(false); }
  };

  const rangeOptions = [{ key: 'today', label: 'Hoy', desc: 'Mantenimientos de hoy' }, { key: 'week', label: 'Última semana', desc: 'Últimos 7 días' }, { key: 'month', label: 'Último mes', desc: 'Últimos 30 días' }, { key: 'custom', label: 'Personalizado', desc: 'Rango personalizado' }];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.text} /></TouchableOpacity><Text style={styles.title}>Exportar a Excel</Text></View>
      <Card><Text style={styles.sectionTitle}>Rango de fechas</Text>{rangeOptions.map((opt) => (<TouchableOpacity key={opt.key} style={[styles.rangeOption, range === opt.key && styles.rangeOptionActive]} onPress={() => setRange(opt.key as DateRange)}><View style={styles.rangeInfo}><Text style={[styles.rangeLabel, range === opt.key && { color: theme.colors.primary, fontWeight: '600' }]}>{opt.label}</Text><Text style={styles.rangeDesc}>{opt.desc}</Text></View>{range === opt.key && <View style={styles.rangeCheck} />}</TouchableOpacity>))}{range === 'custom' && (<View style={styles.customDates}><View style={styles.dateInput}><Text style={styles.dateLabel}>Desde</Text><TextInput style={styles.input} value={customStart} onChangeText={setCustomStart} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View><View style={styles.dateInput}><Text style={styles.dateLabel}>Hasta</Text><TextInput style={styles.input} value={customEnd} onChangeText={setCustomEnd} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View></View>)}</Card>
      <Card><Text style={styles.sectionTitle}>Filtrar por técnico (opcional)</Text>{loadingTechs ? <ActivityIndicator color={theme.colors.primary} /> : <Select value={selectedTech ? technicians.find((t) => t.id === selectedTech)?.full_name || '' : ''} options={technicians.map((t) => t.full_name)} onSelect={(name) => { const tech = technicians.find((t) => t.full_name === name); setSelectedTech(tech?.id || ''); }} placeholder="Todos los técnicos" />}</Card>
      <View style={styles.infoBox}><FileSpreadsheet size={20} color={theme.colors.success} /><Text style={styles.infoText}>El archivo Excel incluirá únicamente los mantenimientos aprobados en el rango de fechas seleccionado. Las fotos se incluirán como hipervínculos "Ver foto".</Text></View>
      <Button title={loading ? 'Exportando...' : 'Exportar a Excel'} onPress={handleExport} loading={loading} icon={<Download size={20} color="#fff" />} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  sectionTitle: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm },
  rangeOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8, backgroundColor: theme.colors.surface },
  rangeOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  rangeInfo: { flex: 1 },
  rangeLabel: { fontSize: theme.fontSize.md, color: theme.colors.text, fontWeight: '500' },
  rangeDesc: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  rangeCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.primary },
  customDates: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.sm },
  dateInput: { flex: 1 },
  dateLabel: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#ECFDF5', borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  infoText: { flex: 1, fontSize: theme.fontSize.sm, color: '#065F46' },
});
