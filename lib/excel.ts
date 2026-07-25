import * as XLSX from 'xlsx';
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Maintenance, FormField } from './types';

export type DateRange = 'today' | 'week' | 'month' | 'custom';

export function getStartDate(range: DateRange, customStart: string, customEnd: string): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  switch (range) {
    case 'today': {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'week': {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'month': {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'custom': {
      const start = customStart ? new Date(customStart) : new Date(0);
      start.setHours(0, 0, 0, 0);
      if (customEnd) {
        const customEndDate = new Date(customEnd);
        customEndDate.setHours(23, 59, 59, 999);
        return { start, end: customEndDate };
      }
      return { start, end };
    }
  }
}

function getPhotoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith('http')) return photoPath;
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/maintenance-photos/${photoPath}`;
}

function buildHeaders(formFields: FormField[]): string[] {
  const base = [
    'Fecha',
    'Dirección',
    'Técnico',
    'Tipo de trabajo',
    'Notas',
    'Latitud',
    'Longitud',
    'Foto',
  ];
  formFields.forEach((f) => base.push(f.label));
  return base;
}

function buildRow(m: Maintenance, formFields: FormField[]): (string | number)[] {
  const photoUrl = getPhotoUrl(m.photo_path);
  const formatCoord = (v: number | null | undefined): string => {
    if (v === null || v === undefined) return 'N/A';
    return String(v).replace(',', '.');
  };
  const row: (string | number)[] = [
    m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/A',
    m.service_order?.address || 'N/A',
    m.technician_profile?.full_name || 'N/A',
    m.tipo_trabajo || 'N/A',
    m.notes || 'N/A',
    formatCoord(m.photo_latitude),
    formatCoord(m.photo_longitude),
    photoUrl ? 'Ver foto' : 'Sin foto',
  ];
  formFields.forEach((f) => {
    const fv = (m.field_values as any[])?.find((v) => v.field_id === f.id || v.field?.field_key === f.field_key);
    row.push(fv?.value || 'N/A');
  });
  return row;
}

export async function exportMaintenancesToExcel(
  maintenances: Maintenance[],
  fileName: string,
  formFields: FormField[] = []
): Promise<void> {
  const headers = buildHeaders(formFields);
  const rows = maintenances.map((m) => buildRow(m, formFields));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  const photoColIdx = headers.indexOf('Foto');
  if (photoColIdx >= 0) {
    maintenances.forEach((m, rIdx) => {
      const photoUrl = getPhotoUrl(m.photo_path);
      if (photoUrl) {
        const cellRef = XLSX.utils.encode_cell({ r: rIdx + 1, c: photoColIdx });
        ws[cellRef] = {
          t: 's',
          v: 'Ver foto',
          f: `HYPERLINK("${photoUrl}","Ver foto")`,
        };
      }
    });
  }

  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mantenimientos');

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  if (Platform.OS === 'web') {
    const blob = base64ToBlob(wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, `${fileName}.xlsx`);
  const bytes = base64ToUint8Array(wbout);
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar mantenimientos',
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const byteCharacters = atob(base64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return byteArray;
}
