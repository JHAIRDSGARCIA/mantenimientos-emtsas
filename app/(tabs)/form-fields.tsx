import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, Switch, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import type { FormField, FieldType } from '@/lib/types';
import { Card, Button, EmptyState, LoadingScreen, Select } from '@/components/ui';
import { Settings, Plus, Edit3, Trash2, X, GripVertical } from 'lucide-react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [label, setLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadFields = useCallback(async () => {
    try { const { data, error } = await supabase.from('form_fields').select('*').order('sort_order'); if (error) throw error; setFields((data as FormField[]) || []); } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al cargar campos'); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadFields(); }, [loadFields]));
  const onRefresh = () => { setRefreshing(true); loadFields(); };
  const openCreateModal = () => { setEditingField(null); setLabel(''); setFieldKey(''); setFieldType('text'); setOptions(''); setRequired(false); setShowModal(true); };
  const openEditModal = (field: FormField) => { setEditingField(field); setLabel(field.label); setFieldKey(field.field_key); setFieldType(field.field_type); setOptions(field.options?.join(', ') || ''); setRequired(field.required); setShowModal(true); };

  const handleSubmit = async () => {
    if (!label.trim() || !fieldKey.trim()) { Alert.alert('Error', 'Etiqueta y clave son obligatorias'); return; }
    setSubmitting(true);
    try {
      const optionsArray = options.trim() ? options.split(',').map((o) => o.trim()).filter(Boolean) : null;
      if (editingField) { const { error } = await supabase.from('form_fields').update({ label: label.trim(), field_key: fieldKey.trim(), field_type: fieldType, options: optionsArray, required }).eq('id', editingField.id); if (error) throw error; }
      else { const maxOrder = Math.max(...fields.map((f) => f.sort_order), 0); const { error } = await supabase.from('form_fields').insert({ label: label.trim(), field_key: fieldKey.trim(), field_type: fieldType, options: optionsArray, required, active: true, sort_order: maxOrder + 1 }); if (error) throw error; }
      setShowModal(false); loadFields(); Alert.alert('Éxito', editingField ? 'Campo actualizado' : 'Campo creado');
    } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar campo'); } finally { setSubmitting(false); }
  };

  const handleDelete = (field: FormField) => { Alert.alert('Eliminar campo', `¿Está seguro de eliminar el campo "${field.label}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { try { const { error } = await supabase.from('form_fields').delete().eq('id', field.id); if (error) throw error; loadFields(); Alert.alert('Éxito', 'Campo eliminado'); } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al eliminar'); } } }]); };
  const toggleActive = async (field: FormField) => { try { const { error } = await supabase.from('form_fields').update({ active: !field.active }).eq('id', field.id); if (error) throw error; loadFields(); } catch (err) { Alert.alert('Error', err instanceof Error ? err.message : 'Error al actualizar'); } };

  const fieldTypeLabels: Record<FieldType, string> = { text: 'Texto', number: 'Número', select: 'Lista desplegable', textarea: 'Texto largo', date: 'Fecha' };
  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Campos del Formulario</Text><TouchableOpacity style={styles.fab} onPress={openCreateModal}><Plus size={22} color="#fff" /></TouchableOpacity></View>
      <View style={styles.infoBox}><Text style={styles.infoText}>Configure los campos que aparecen en el formulario de mantenimiento. Estos campos se incluirán en el exportable de Excel.</Text></View>
      <FlatList data={fields} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon={<Settings size={48} color={theme.colors.neutral300} />} title="No hay campos configurados" subtitle="Agrega campos al formulario de mantenimiento" />}
        renderItem={({ item }) => (
          <Card><View style={styles.fieldRow}><View style={{ flex: 1 }}><View style={styles.fieldHeader}><Text style={styles.fieldLabel}>{item.label}</Text>{item.required && <View style={styles.requiredBadge}><Text style={styles.requiredText}>Obligatorio</Text></View>}</View><Text style={styles.fieldMeta}>Clave: {item.field_key} · Tipo: {fieldTypeLabels[item.field_type]}</Text>{item.options && item.options.length > 0 && <Text style={styles.fieldOptions}>Opciones: {item.options.join(', ')}</Text>}<View style={styles.fieldActions}><View style={styles.activeToggle}><Text style={styles.activeText}>Activo</Text><Switch value={item.active} onValueChange={() => toggleActive(item)} trackColor={{ false: theme.colors.neutral300, true: theme.colors.success }} /></View><View style={styles.actionRow}><TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}><Edit3 size={18} color={theme.colors.primary} /></TouchableOpacity><TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}><Trash2 size={18} color={theme.colors.error} /></TouchableOpacity></View></View></View></View></Card>
        )}
      />
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingField ? 'Editar campo' : 'Nuevo campo'}</Text><TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color={theme.colors.neutral700} /></TouchableOpacity></View><ScrollView style={styles.modalBody}><Text style={styles.label}>Etiqueta *</Text><TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Ej: Tipo de lámpara" placeholderTextColor={theme.colors.textMuted} /><Text style={styles.label}>Clave (sin espacios) *</Text><TextInput style={styles.input} value={fieldKey} onChangeText={setFieldKey} placeholder="Ej: tipo_lampara" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" /><Text style={styles.label}>Tipo de campo</Text><Select value={fieldTypeLabels[fieldType]} options={Object.values(fieldTypeLabels)} onSelect={(val) => { const entry = Object.entries(fieldTypeLabels).find(([, v]) => v === val); if (entry) setFieldType(entry[0] as FieldType); }} />{fieldType === 'select' && (<><Text style={styles.label}>Opciones (separadas por comas)</Text><TextInput style={[styles.input, styles.textArea]} value={options} onChangeText={setOptions} placeholder="Opción 1, Opción 2, Opción 3" placeholderTextColor={theme.colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" /></>)}<View style={styles.switchRow}><Text style={styles.label}>Campo obligatorio</Text><Switch value={required} onValueChange={setRequired} trackColor={{ false: theme.colors.neutral300, true: theme.colors.primary }} /></View></ScrollView><Button title={submitting ? 'Guardando...' : editingField ? 'Actualizar' : 'Crear campo'} onPress={handleSubmit} loading={submitting} /></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  title: { fontSize: theme.fontSize.xxl, fontWeight: '700', color: theme.colors.text },
  fab: { backgroundColor: theme.colors.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  infoBox: { backgroundColor: theme.colors.primaryLight, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm, borderRadius: theme.radius.md, padding: theme.spacing.md },
  infoText: { fontSize: theme.fontSize.sm, color: theme.colors.primaryDark },
  list: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  fieldRow: { flexDirection: 'row' },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  fieldLabel: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text },
  requiredBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full },
  requiredText: { fontSize: 10, fontWeight: '600', color: theme.colors.error },
  fieldMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginBottom: 4 },
  fieldOptions: { fontSize: theme.fontSize.sm, color: theme.colors.neutral600, marginBottom: 8 },
  fieldActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  activeToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral600 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.neutral50, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  deleteBtn: { borderColor: '#FECACA' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.lg },
  modalContent: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  modalTitle: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  modalBody: { marginBottom: theme.spacing.md },
  label: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.neutral50, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm },
  textArea: { minHeight: 80 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing.sm },
});
