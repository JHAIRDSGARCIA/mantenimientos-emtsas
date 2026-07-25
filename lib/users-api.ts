import { supabase, EDGE_FUNCTION_BASE } from './supabase';
import type { Profile, UserRole } from './types';

const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

function getHeaders(session: { access_token: string } | null, json = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session?.access_token || ''}`,
    apikey: ANON_KEY,
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export async function fetchUsers(): Promise<Profile[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');

  const response = await fetch(`${EDGE_FUNCTION_BASE}/manage-users?action=list`, {
    headers: getHeaders(session),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Error al obtener usuarios');
  }

  const { users } = await response.json();
  return users as Profile[];
}

export async function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');

  const response = await fetch(`${EDGE_FUNCTION_BASE}/manage-users`, {
    method: 'POST',
    headers: getHeaders(session, true),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Error al crear usuario');
  }
}

export async function updateUser(id: string, data: {
  full_name?: string;
  role?: UserRole;
  active?: boolean;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');

  const response = await fetch(`${EDGE_FUNCTION_BASE}/manage-users`, {
    method: 'PUT',
    headers: getHeaders(session, true),
    body: JSON.stringify({ id, ...data }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Error al actualizar usuario');
  }
}

export async function deleteUser(id: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');

  const response = await fetch(`${EDGE_FUNCTION_BASE}/manage-users?id=${id}`, {
    method: 'DELETE',
    headers: getHeaders(session),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Error al eliminar usuario');
  }
}
