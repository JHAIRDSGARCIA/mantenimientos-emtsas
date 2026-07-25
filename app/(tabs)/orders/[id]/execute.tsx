import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { dbEnqueueMaintenance, dbGetFormFields, fullSync, isOnline } from '@/lib/offline';
import { theme } from '@/lib/theme';
import type { FormField } from '@/lib/types';
import { Card, Button, Select } from '@/components/ui';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { ArrowLeft, Camera, X, MapPin, Clock, Calendar, WifiOff, CheckCircle, ExternalLink } from 'lucide-react-native';

export default function ExecuteOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, triggerSync } = useAuth();
  const router = useRouter();
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLatitude, setPhotoLatitude] = useState<number | null>(null);
  const [photoLongitude, setPhotoLongitude] = useState<number | null>(null);
  const [photoTakenAt, setPhotoTakenAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [success, setSuccess] = useState(false);

  const loadFormFields = useCallback(async () => { const fields = await dbGetFormFields(); setFormFields(fields); }, []);
  useEffect(() => { loadFormFields(); isOnline().then(setOnline); }, [loadFormFields]);
  useFocusEffect(useCallback(() => { setFieldValues({}); setNotes(''); setPhotoUri(null); setPhotoLatitude(null); setPhotoLongitude(null); setPhotoTakenAt(null); setSuccess(false); setError(null); setSubmitting(false); }, [id]));

  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const now = new Date().toISOString();
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus === 'granted') { const loc = await Location.getCurrentPositionAsync({}); lat = loc.coords.latitude; lng = loc.coords.longitude; }
      } catch (err) { console.error('Location error:', err); }
      setPhotoUri(uri); setPhotoLatitude(lat); setPhotoLongitude(lng); setPhotoTakenAt(now);
    }
  };

  const handleSubmit = async () => {
    if (!profile) return;
    setError(null);
    for (const field of formFields) {
      if (field.field_key === 'tipo_trabajo') continue;
      if (field.required && !fieldValues[field.field_key]?.trim()) { setError(`El campo "${field.label}" es obligatorio`); return; }
    }
    if (!photoUri) { setError('Debe tomar una foto del trabajo realizado'); return; }
    setSubmitting(true);
    try {
      const connected = await isOnline();
      const tipoLampara = fieldValues['tipo_lampara'] || null;
      const potenciaVal = fieldValues['potencia'] || null;
      const tipoPoste = fieldValues['tipo_poste'] || null;
      const customFieldValues = formFields.filter((f) => !['tipo_lampara', 'potencia', 'tipo_poste', 'tipo_trabajo'].includes(f.field_key)).map((f) => ({ field_id: f.id, value: fieldValues[f.field_key] || '' }));
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      let photoData = photoUri;
      if (Platform.OS !== 'web' && photoUri && !photoUri.startsWith('data:')) {
        try { const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' }); photoData = `data:image/jpeg;base64,${base64}`; } catch (e) { console.error('Error reading photo:', e); }
      }
      await dbEnqueueMaintenance({ tempId, serviceOrderId: id, technicianId: profile.id, data: { tipo_lampara: tipoLampara, potencia: potenciaVal, tipo_poste: tipoPoste, notes }, photoUri: photoData, photoLatitude, photoLongitude, photoTakenAt, fieldValues: customFieldValues, retries: 0, createdAt: new Date().toISOString() });
      if (connected) { await fullSync(profile.role, profile.id); }
      setSuccess(true);
      setTimeout(() => { router.replace('/(tabs)/orders'); }, 1500);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al guardar el mantenimiento'); } finally { setSubmitting(false); }
  };

  if (success) {
    return <View style={styles.successContainer}><CheckCircle size={64} color={theme.colors.success} /><Text style={styles.successTitle}>Mantenimiento registrado</Text><Text style={styles.successSubtitle}>{online ? 'Los datos se han subido al servidor.' : 'Los datos se sincronizarán cuando haya conexión.'}</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.text} /></TouchableOpacity><Text style={styles.title}>Ejecutar Mantenimiento</Text></View>
      {!online && <View style={styles.offlineBanner}><WifiOff size={18} color="#92400E" /><Text style={styles.offlineText}>Sin conexión. Los datos se guardarán localmente y se sincronizarán automáticamente.</Text></View>}
      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
      <Card>
        <Text style={styles.sectionLabel}>Datos del mantenimiento</Text>
        {formFields.map((field) => {
          if (field.field_key === 'tipo_trabajo') return null;
          if (field.field_type === 'select' && field.options) {
            return <Select key={field.id} label={`${field.label} ${field.required ? '*' : ''}`} value={fieldValues[field.field_key] || ''} options={field.options} onSelect={(val) => setFieldValues({ ...fieldValues, [field.field_key]: val })} />;
          }
          return (
            <View key={field.id} style={styles.fieldContainer}><Text style={styles.fieldLabel}>{field.label} {field.required && '*'}</Text>
              <TextInput style={[styles.input, field.field_type === 'textarea' && styles.textArea]} value={fieldValues[field.field_key] || ''} onChangeText={(text) => setFieldValues({ ...fieldValues, [field.field_key]: text })} placeholder={`Ingrese ${field.label.toLowerCase()}`} placeholderTextColor={theme.colors.textMuted} multiline={field.field_type === 'textarea'} numberOfLines={field.field_type === 'textarea' ? 3 : 1} textAlignVertical={field.field_type === 'textarea' ? 'top' : 'auto'} keyboardType={field.field_type === 'number' ? 'numeric' : 'default'} />
            </View>
          );
        })}
      </Card>
      <Card>
        <Text style={styles.sectionLabel}>Evidencia del trabajo</Text>
        <Text style={styles.fieldLabel}>Foto del trabajo terminado *</Text>
        {photoUri ? (
          <View style={styles.photoContainer}><Image source={{ uri: photoUri }} style={styles.photo} /><TouchableOpacity style={styles.removePhoto} onPress={() => { setPhotoUri(null); setPhotoLatitude(null); setPhotoLongitude(null); setPhotoTakenAt(null); }}><X size={16} color="#fff" /></TouchableOpacity></View>
        ) : (
          <TouchableOpacity style={styles.photoButton} onPress={() => capturePhoto()}><Camera size={20} color={theme.colors.primary} /><Text style={styles.photoButtonText}>Tomar foto</Text></TouchableOpacity>
        )}
        {photoTakenAt && (
          <View style={styles.metaContainer}>
            <View style={styles.metaRow}><Calendar size={14} color={theme.colors.textSecondary} /><Text style={styles.metaText}>Fecha: {new Date(photoTakenAt).toLocaleDateString()}</Text></View>
            <View style={styles.metaRow}><Clock size={14} color={theme.colors.textSecondary} /><Text style={styles.metaText}>Hora: {new Date(photoTakenAt).toLocaleTimeString()}</Text></View>
            {photoLatitude !== null && (
              <View style={styles.metaRow}><MapPin size={14} color={theme.colors.textSecondary} /><Text style={styles.metaText}>GPS: {photoLatitude.toFixed(6)}, {photoLongitude?.toFixed(6)}</Text><TouchableOpacity onPress={() => Linking.openURL(Platform.OS === 'web' ? `https://www.google.com/maps?q=${photoLatitude},${photoLongitude}` : `https://maps.google.com/?q=${photoLatitude},${photoLongitude}`)} style={styles.mapLink}><ExternalLink size={14} color="#0088cc" /></TouchableOpacity></View>
            )}
            <Text style={styles.metaNote}>Estos datos se capturan automáticamente y no son editables.</Text>
          </View>
        )}
      </Card>
      <Card><Text style={styles.sectionLabel}>Notas adicionales</Text><TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholder="Observaciones adicionales (opcional)" placeholderTextColor={theme.colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" /></Card>
      <Button title={submitting ? 'Guardando...' : 'Registrar mantenimiento'} onPress={handleSubmit} loading={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  offlineText: { flex: 1, fontSize: theme.fontSize.sm, color: '#92400E' },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  errorText: { color: theme.colors.error, fontSize: theme.fontSize.sm },
  sectionLabel: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm },
  fieldContainer: { marginBottom: theme.spacing.md },
  fieldLabel: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  photoContainer: { position: 'relative', marginBottom: theme.spacing.sm },
  photo: { width: '100%', height: 200, borderRadius: theme.radius.md },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  photoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: theme.spacing.md, borderWidth: 2, borderColor: theme.colors.primary, borderStyle: 'dashed', borderRadius: theme.radius.md, backgroundColor: theme.colors.primaryLight },
  photoButtonText: { fontSize: theme.fontSize.md, color: theme.colors.primary, fontWeight: '600' },
  metaContainer: { backgroundColor: theme.colors.neutral50, borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: theme.spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  metaText: { fontSize: theme.fontSize.sm, color: theme.colors.neutral700 },
  metaNote: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  mapLink: { padding: 4, marginLeft: 4 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: theme.spacing.xl },
  successTitle: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.success, marginTop: theme.spacing.md },
  successSubtitle: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' },
});
