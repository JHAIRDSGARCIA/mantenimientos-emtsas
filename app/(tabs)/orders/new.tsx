import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { uploadPhoto } from '@/lib/storage';
import { theme } from '@/lib/theme';
import type { Priority, Profile, UserRole, OrderType } from '@/lib/types';
import { PRIORITY_LABELS, PRIORITY_COLORS, ROLE_LABELS, ORDER_TYPE_LABELS, ORDER_TYPE_COLORS } from '@/lib/types';
import { Card, Button, Badge, Select } from '@/components/ui';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ArrowLeft, Camera, MapPin, X, ExternalLink } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';

export default function NewOrderScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [orderType, setOrderType] = useState<OrderType>('Mantenimiento');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [loadingTech, setLoadingTech] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTechnicians = useCallback(async () => {
    setLoadingTech(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'technician')
      .eq('active', true)
      .order('full_name');
    if (!err && data) setTechnicians(data as Profile[]);
    setLoadingTech(false);
  }, []);

  useEffect(() => {
    loadTechnicians();
  }, []);

  useFocusEffect(useCallback(() => {
    setAddress('');
    setDescription('');
    setPriority('media');
    setOrderType('Mantenimiento');
    setPhotoUri(null);
    setLatitude(null);
    setLongitude(null);
    setAssignedTo('');
    setError(null);
  }, []));

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setLatitude(loc.coords.latitude);
          setLongitude(loc.coords.longitude);
        }
      } catch (err) {
        console.error('Location error:', err);
      }
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!address.trim()) {
      setError('La dirección es obligatoria');
      return;
    }
    if (!profile) return;
    setError(null);
    setSubmitting(true);
    try {
      let photoPath: string | null = null;
      if (photoUri) {
        photoPath = await uploadPhoto(photoUri, 'orders');
      }
      const { error: insertError } = await supabase.from('service_orders').insert({
        address: address.trim(),
        description: description.trim(),
        priority,
        order_type: orderType,
        latitude,
        longitude,
        photo_path: photoPath,
        created_by: profile.id,
        assigned_to: assignedTo || null,
        status: 'pendiente',
      });
      if (insertError) throw insertError;
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la orden');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nueva Orden de Servicio</Text>
      </View>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Card>
        <Text style={styles.label}>Dirección *</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Ingrese la dirección" placeholderTextColor={theme.colors.textMuted} />
        <Text style={styles.label}>Descripción</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Descripción del trabajo a realizar" placeholderTextColor={theme.colors.textMuted} multiline numberOfLines={4} textAlignVertical="top" />
        <Text style={styles.label}>Prioridad</Text>
        <View style={styles.priorityRow}>
          {(['alta', 'media', 'baja'] as Priority[]).map((p) => (
            <TouchableOpacity key={p} style={[styles.priorityChip, priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]} onPress={() => setPriority(p)}>
              <Text style={[styles.priorityText, priority === p && { color: '#fff' }]}>{PRIORITY_LABELS[p]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.priorityRow}>
          {(['Modernización', 'Expansión', 'Mantenimiento'] as OrderType[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.priorityChip, orderType === t && { backgroundColor: ORDER_TYPE_COLORS[t], borderColor: ORDER_TYPE_COLORS[t] }]} onPress={() => setOrderType(t)}>
              <Text style={[styles.priorityText, orderType === t && { color: '#fff' }]}>{ORDER_TYPE_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Asignar a técnico (opcional)</Text>
        {loadingTech ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Select value={assignedTo ? technicians.find((t) => t.id === assignedTo)?.full_name || '' : ''} options={technicians.map((t) => t.full_name)} onSelect={(name) => { const tech = technicians.find((t) => t.full_name === name); setAssignedTo(tech?.id || ''); }} placeholder="Sin asignar" />
        )}
      </Card>
      <Card>
        <Text style={styles.label}>Fotografía (opcional)</Text>
        {photoUri ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotoUri(null)}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Camera size={20} color={theme.colors.primary} />
              <Text style={styles.photoButtonText}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
              <MapPin size={20} color={theme.colors.primary} />
              <Text style={styles.photoButtonText}>Galería</Text>
            </TouchableOpacity>
          </View>
        )}
        {latitude !== null && (
          <Text style={styles.geoText}>📍 {latitude.toFixed(6)}, {longitude?.toFixed(6)}</Text>
        )}
      </Card>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>La fecha y hora de creación se registrarán automáticamente.</Text>
      </View>
      <Button title="Crear orden" onPress={handleSubmit} loading={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  errorText: { color: theme.colors.error, fontSize: theme.fontSize.sm },
  label: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700, marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.fontSize.md, color: theme.colors.text, marginBottom: theme.spacing.sm },
  textArea: { minHeight: 100 },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.sm },
  priorityChip: { flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', backgroundColor: theme.colors.surface },
  priorityText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.neutral700 },
  photoContainer: { position: 'relative', marginBottom: theme.spacing.sm },
  photo: { width: '100%', height: 200, borderRadius: theme.radius.md },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  photoButtons: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.sm },
  photoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  photoButtonText: { fontSize: theme.fontSize.sm, color: theme.colors.primary, fontWeight: '500' },
  geoText: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 4 },
  infoBox: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  infoText: { fontSize: theme.fontSize.sm, color: theme.colors.primaryDark },
});
