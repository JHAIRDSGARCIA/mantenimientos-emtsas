import { getDb } from './db';
import { supabase } from './supabase';
import { uploadPhoto } from './storage';
import type {
  ServiceOrder,
  Maintenance,
  Observation,
  FormField,
  MaintenanceFieldValue,
} from './types';

// SQLite is the SINGLE SOURCE OF TRUTH for the UI.
// Supabase is only accessed during sync operations.

export async function dbGetOrders(role: string, userId: string): Promise<ServiceOrder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    'SELECT data FROM cached_orders ORDER BY synced_at DESC'
  );
  let orders = rows.map((r) => JSON.parse(r.data) as ServiceOrder);
  if (role === 'technician') {
    orders = orders.filter((o) => o.assigned_to === userId);
  }
  return orders;
}

export async function dbGetOrderById(id: string): Promise<ServiceOrder | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM cached_orders WHERE id = ?',
    [id]
  );
  return row ? (JSON.parse(row.data) as ServiceOrder) : null;
}

export async function dbSaveOrders(orders: ServiceOrder[]): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  for (const order of orders) {
    await db.runAsync(
      'INSERT OR REPLACE INTO cached_orders (id, data, synced_at) VALUES (?, ?, ?)',
      [order.id, JSON.stringify(order), now]
    );
  }
}

export async function dbDeleteOrder(orderId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cached_orders WHERE id = ?', [orderId]);
  await db.runAsync('DELETE FROM cached_order_details WHERE order_id = ?', [orderId]);
}

export interface OrderDetail {
  order: ServiceOrder;
  maintenance: Maintenance | null;
  observations: Observation[];
}

export async function dbGetOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM cached_order_details WHERE order_id = ?',
    [orderId]
  );
  if (!row) {
    const order = await dbGetOrderById(orderId);
    if (order) return { order, maintenance: null, observations: [] };
    return null;
  }
  return JSON.parse(row.data) as OrderDetail;
}

export async function dbSaveOrderDetail(detail: OrderDetail): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT OR REPLACE INTO cached_order_details (order_id, data, synced_at) VALUES (?, ?, ?)',
    [detail.order.id, JSON.stringify(detail), now]
  );
}

export async function dbGetFormFields(): Promise<FormField[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>(
    'SELECT data FROM cached_form_fields ORDER BY sort_order ASC'
  );
  return rows.map((r) => JSON.parse(r.data) as FormField);
}

export async function dbSaveFormFields(fields: FormField[]): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  for (const field of fields) {
    await db.runAsync(
      'INSERT OR REPLACE INTO cached_form_fields (id, sort_order, data, synced_at) VALUES (?, ?, ?, ?)',
      [field.id, field.sort_order, JSON.stringify(field), now]
    );
  }
}

export async function dbGetMaintenanceById(maintenanceId: string): Promise<{ maintenance: Maintenance; order: ServiceOrder; observations: Observation[] } | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM cached_order_details');
  for (const row of rows) {
    const detail = JSON.parse(row.data) as OrderDetail;
    if (detail.maintenance?.id === maintenanceId) {
      return {
        maintenance: detail.maintenance,
        order: detail.order,
        observations: detail.observations || [],
      };
    }
  }
  return null;
}

export async function dbGetAllMaintenances(): Promise<Maintenance[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM cached_order_details');
  const maints: Maintenance[] = [];
  for (const row of rows) {
    const detail = JSON.parse(row.data) as OrderDetail;
    if (detail.maintenance) maints.push(detail.maintenance);
  }
  return maints;
}

export interface QueuedMaintenance {
  tempId: string;
  serviceOrderId: string;
  technicianId: string;
  data: {
    tipo_lampara: string | null;
    potencia: string | null;
    tipo_poste: string | null;
    notes: string | null;
  };
  photoUri: string | null;
  photoLatitude: number | null;
  photoLongitude: number | null;
  photoTakenAt: string | null;
  fieldValues: { field_id: string; value: string }[];
  retries: number;
  createdAt: string;
}

export async function dbGetQueue(): Promise<QueuedMaintenance[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    temp_id: string;
    service_order_id: string;
    technician_id: string;
    maintenance_data: string;
    photo_uri: string | null;
    photo_latitude: number | null;
    photo_longitude: number | null;
    photo_taken_at: string | null;
    field_values: string;
    retries: number;
    created_at: string;
  }>('SELECT * FROM offline_queue ORDER BY created_at ASC');

  return rows.map((r) => ({
    tempId: r.temp_id,
    serviceOrderId: r.service_order_id,
    technicianId: r.technician_id,
    data: JSON.parse(r.maintenance_data),
    photoUri: r.photo_uri,
    photoLatitude: r.photo_latitude,
    photoLongitude: r.photo_longitude,
    photoTakenAt: r.photo_taken_at,
    fieldValues: JSON.parse(r.field_values),
    retries: r.retries,
    createdAt: r.created_at,
  }));
}

export async function dbEnqueueMaintenance(item: QueuedMaintenance): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_queue
      (temp_id, service_order_id, technician_id, maintenance_data, photo_uri, photo_latitude, photo_longitude, photo_taken_at, field_values, retries, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.tempId,
      item.serviceOrderId,
      item.technicianId,
      JSON.stringify(item.data),
      item.photoUri,
      item.photoLatitude,
      item.photoLongitude,
      item.photoTakenAt,
      JSON.stringify(item.fieldValues),
      item.retries,
      item.createdAt,
    ]
  );
}

export async function dbRemoveFromQueue(tempId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM offline_queue WHERE temp_id = ?', [tempId]);
}

export async function dbIncrementRetry(tempId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE offline_queue SET retries = retries + 1 WHERE temp_id = ?',
    [tempId]
  );
}

export async function dbGetQueueCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ temp_id: string }>('SELECT temp_id FROM offline_queue');
  return rows.length;
}

let isSyncing = false;
let syncListeners: (() => void)[] = [];

export function onSyncComplete(cb: () => void): () => void {
  syncListeners.push(cb);
  return () => { syncListeners = syncListeners.filter((l) => l !== cb); };
}

function notifySyncComplete() {
  syncListeners.forEach((cb) => cb());
}

const MAX_RETRIES = 5;

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  let synced = 0;
  let failed = 0;
  let syncedOrderIds: string[] = [];

  try {
    const queue = await dbGetQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    for (const item of queue) {
      if (item.retries >= MAX_RETRIES) {
        failed++;
        continue;
      }

      try {
        let photoPath: string | null = null;
        if (item.photoUri) {
          photoPath = await uploadPhoto(item.photoUri, 'maintenances');
        }

        const { data: maint, error: maintError } = await supabase
          .from('maintenances')
          .insert({
            service_order_id: item.serviceOrderId,
            technician_id: item.technicianId,
            tipo_lampara: item.data.tipo_lampara,
            potencia: item.data.potencia,
            tipo_poste: item.data.tipo_poste,
            tipo_trabajo: 'mantenimiento',
            replacement_reason: null,
            replacement_evidence_path: null,
            photo_path: photoPath,
            photo_latitude: item.photoLatitude,
            photo_longitude: item.photoLongitude,
            photo_taken_at: item.photoTakenAt,
            notes: item.data.notes,
            status: 'pendiente',
          })
          .select()
          .single();

        if (maintError) throw maintError;

        if (item.fieldValues.length > 0 && maint) {
          const fvs = item.fieldValues.map((fv) => ({
            maintenance_id: maint.id,
            field_id: fv.field_id,
            value: fv.value,
          }));
          await supabase.from('maintenance_field_values').insert(fvs);
        }

        await supabase
          .from('service_orders')
          .update({ status: 'en_progreso' })
          .eq('id', item.serviceOrderId);

        syncedOrderIds.push(item.serviceOrderId);
        await dbRemoveFromQueue(item.tempId);
        synced++;
      } catch (err) {
        console.error('Sync error for item', item.tempId, err);
        await dbIncrementRetry(item.tempId);
        failed++;
      }
    }

    if (synced > 0) notifySyncComplete();
    return { synced, failed };
  } finally {
    isSyncing = false;
  }
}

export async function syncFromServer(role: string, userId: string): Promise<void> {
  if (isSyncing) return;

  try {
    let query = supabase
      .from('service_orders')
      .select('*, assigned_to_profile:profiles!assigned_to(*), created_by_profile:profiles!created_by(*)')
      .order('created_at', { ascending: false });

    if (role === 'technician') {
      query = query.eq('assigned_to', userId);
    }

    const { data: ordersData, error: ordersError } = await query;
    if (!ordersError && ordersData) {
      const orders = ordersData as unknown as ServiceOrder[];
      await dbSaveOrders(orders);

      for (const order of orders) {
        const { data: maintData } = await supabase
          .from('maintenances')
          .select('*, service_order:service_orders(*), technician_profile:profiles(*), field_values:maintenance_field_values(*, field:form_fields(*))')
          .eq('service_order_id', order.id)
          .maybeSingle();

        const maint = maintData as unknown as Maintenance | null;

        let observations: Observation[] = [];
        if (maint) {
          const { data: obsData } = await supabase
            .from('observations')
            .select('*, author_profile:profiles(*)')
            .eq('maintenance_id', maint.id)
            .order('created_at', { ascending: false });
          observations = (obsData as unknown as Observation[]) || [];
        }

        await dbSaveOrderDetail({ order, maintenance: maint, observations });
      }
    }

    const { data: fieldsData, error: fieldsError } = await supabase
      .from('form_fields')
      .select('*')
      .eq('active', true)
      .order('sort_order');

    if (!fieldsError && fieldsData) {
      await dbSaveFormFields(fieldsData as FormField[]);
    }

    notifySyncComplete();
  } catch (err) {
    console.error('Error syncing from server:', err);
  }
}

export async function fullSync(role: string, userId: string): Promise<void> {
  await syncOfflineQueue();
  await syncFromServer(role, userId);
}

import NetInfo from '@react-native-community/netinfo';

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
}

export function initNetworkListener(role: string, userId: string): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      fullSync(role, userId);
    }
  });
}
