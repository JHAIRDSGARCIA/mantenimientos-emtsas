export type UserRole = 'admin' | 'supervisor' | 'technician';

export type MaintenanceStatus =
  | 'pendiente'
  | 'con_observacion'
  | 'aprobado'
  | 'reemplazo_pendiente';

export type ServiceOrderStatus =
  | 'pendiente'
  | 'en_progreso'
  | 'completada'
  | 'cancelada';

export type Priority = 'alta' | 'media' | 'baja';

export type OrderType = 'Modernización' | 'Expansión' | 'Mantenimiento';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  'Modernización': 'Modernización',
  'Expansión': 'Expansión',
  'Mantenimiento': 'Mantenimiento',
};

export const ORDER_TYPE_COLORS: Record<OrderType, string> = {
  'Modernización': '#8B5CF6',
  'Expansión': '#10B981',
  'Mantenimiento': '#3B82F6',
};

export type WorkType = 'mantenimiento' | 'reemplazo';

export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'date';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface ServiceOrder {
  id: string;
  address: string;
  description: string;
  priority: Priority;
  order_type: OrderType;
  latitude: number | null;
  longitude: number | null;
  photo_path: string | null;
  created_by: string;
  assigned_to: string | null;
  status: ServiceOrderStatus;
  created_at: string;
  updated_at: string;
  assigned_to_profile?: Profile | null;
  created_by_profile?: Profile | null;
}

export interface Maintenance {
  id: string;
  service_order_id: string;
  technician_id: string;
  tipo_lampara: string | null;
  potencia: string | null;
  tipo_poste: string | null;
  tipo_trabajo: WorkType;
  replacement_reason: string | null;
  replacement_evidence_path: string | null;
  replacement_approved: boolean;
  replacement_approved_by: string | null;
  replacement_approved_at: string | null;
  photo_path: string | null;
  photo_latitude: number | null;
  photo_longitude: number | null;
  photo_taken_at: string | null;
  status: MaintenanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  service_order?: ServiceOrder;
  technician_profile?: Profile;
  observations?: Observation[];
  field_values?: MaintenanceFieldValue[];
}

export interface Observation {
  id: string;
  maintenance_id: string;
  author_id: string;
  comment: string;
  created_at: string;
  author_profile?: Profile;
}

export interface FormField {
  id: string;
  label: string;
  field_key: string;
  field_type: FieldType;
  options: string[] | null;
  required: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface MaintenanceFieldValue {
  id: string;
  maintenance_id: string;
  field_id: string;
  value: string | null;
  field?: FormField;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  alta: '#DC2626',
  media: '#F59E0B',
  baja: '#10B981',
};

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  pendiente: 'Pendiente',
  con_observacion: 'Con observación',
  aprobado: 'Aprobado',
  reemplazo_pendiente: 'Reemplazo pendiente',
};

export const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  pendiente: '#F59E0B',
  con_observacion: '#DC2626',
  aprobado: '#10B981',
  reemplazo_pendiente: '#8B5CF6',
};

export const ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export const ORDER_STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  pendiente: '#F59E0B',
  en_progreso: '#3B82F6',
  completada: '#10B981',
  cancelada: '#6B7280',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  technician: 'Técnico',
};
