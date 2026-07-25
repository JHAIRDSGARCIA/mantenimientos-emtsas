import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

export interface DatabaseAdapter {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
  getAllAsync: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | null>;
}

class MemoryDB implements DatabaseAdapter {
  private tables: Map<string, Map<string, { data: unknown }>> = new Map();

  private getTable(name: string): Map<string, { data: unknown }> {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  private parseTableName(sql: string): string | null {
    const m = sql.match(/(?:CREATE\s+TABLE|INSERT\s+OR\s+REPLACE\s+INTO|INSERT\s+INTO|DELETE\s+FROM|UPDATE|SELECT).*?\s+(\w+)/i);
    if (/CREATE\s+TABLE/i.test(sql)) {
      const m2 = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
      return m2 ? m2[1] : m?.[1] || null;
    }
    return m?.[1] || null;
  }

  async execAsync(sql: string): Promise<void> {
    const tableName = this.parseTableName(sql);
    if (tableName && /CREATE\s+TABLE/i.test(sql)) this.getTable(tableName);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    const insertMatch = sql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s+\(([^)]+)\)\s+VALUES\s+\(([^)]+)\)/i);
    if (insertMatch) {
      const [, table, cols] = insertMatch;
      const colNames = cols.split(',').map((c) => c.trim());
      const tableMap = this.getTable(table);
      const idIdx = colNames.indexOf('id') >= 0 ? colNames.indexOf('id') : colNames.indexOf('temp_id');
      const idVal = String(params[idIdx >= 0 ? idIdx : 0]);
      const row: Record<string, unknown> = {};
      colNames.forEach((col, i) => { row[col] = params[i]; });
      tableMap.set(idVal, { data: row });
      return;
    }

    const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)(\s+WHERE\s+(\w+)\s*=\s*\?)?/i);
    if (deleteMatch) {
      const [, table, , whereCol] = deleteMatch;
      const tableMap = this.getTable(table);
      if (whereCol) {
        const val = String(params[0]);
        for (const [key, row] of tableMap) {
          if (String((row.data as Record<string, unknown>)[whereCol]) === val) tableMap.delete(key);
        }
      } else {
        tableMap.clear();
      }
      return;
    }

    const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (updateMatch) {
      const [, table, setClause, whereCol] = updateMatch;
      const tableMap = this.getTable(table);
      const val = String(params[params.length - 1]);
      const setCols = setClause.split(',').map((s) => s.trim().split('=')[0].trim());
      for (const [, row] of tableMap) {
        if (String((row.data as Record<string, unknown>)[whereCol]) === val) {
          setCols.forEach((col, i) => {
            (row.data as Record<string, unknown>)[col] = params[i];
          });
        }
      }
      return;
    }
  }

  async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const match = sql.match(/SELECT\s+.*\s+FROM\s+(\w+)(\s+WHERE\s+(\w+)\s*=\s*\?)?(?:\s+ORDER\s+BY\s+(\w+)\s+(ASC|DESC))?/i);
    if (!match) return [];
    const [, table, , whereCol, orderCol, orderDir] = match;
    const tableMap = this.getTable(table);
    let rows = Array.from(tableMap.values()).map((r) => r.data as Record<string, unknown>);

    if (whereCol) {
      const val = String(params[0]);
      rows = rows.filter((r) => String(r[whereCol]) === val);
    }

    if (orderCol) {
      rows.sort((a, b) => {
        const av = String(a[orderCol] || '');
        const bv = String(b[orderCol] || '');
        return orderDir?.toUpperCase() === 'DESC' ? bv.localeCompare(av) : av.localeCompare(bv);
      });
    }

    return rows as T[];
  }

  async getFirstAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
}

let _db: DatabaseAdapter | null = null;
let _initPromise: Promise<DatabaseAdapter> | null = null;

const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS cached_orders (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cached_order_details (
    order_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cached_form_fields (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS offline_queue (
    temp_id TEXT PRIMARY KEY,
    service_order_id TEXT NOT NULL,
    technician_id TEXT NOT NULL,
    maintenance_data TEXT NOT NULL,
    photo_uri TEXT,
    photo_latitude REAL,
    photo_longitude REAL,
    photo_taken_at TEXT,
    field_values TEXT NOT NULL,
    retries INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`;

export async function initDb(): Promise<DatabaseAdapter> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    if (Platform.OS === 'web') {
      _db = new MemoryDB();
      await _db.execAsync(`CREATE TABLE IF NOT EXISTS cached_orders (id TEXT PRIMARY KEY, data TEXT, synced_at TEXT)`);
      await _db.execAsync(`CREATE TABLE IF NOT EXISTS cached_order_details (order_id TEXT PRIMARY KEY, data TEXT, synced_at TEXT)`);
      await _db.execAsync(`CREATE TABLE IF NOT EXISTS cached_form_fields (id TEXT PRIMARY KEY, sort_order INTEGER, data TEXT, synced_at TEXT)`);
      await _db.execAsync(`CREATE TABLE IF NOT EXISTS offline_queue (temp_id TEXT PRIMARY KEY, service_order_id TEXT, technician_id TEXT, maintenance_data TEXT, photo_uri TEXT, photo_latitude REAL, photo_longitude REAL, photo_taken_at TEXT, field_values TEXT, retries INTEGER, created_at TEXT)`);
    } else {
      const db = await SQLite.openDatabaseAsync('seap_offline.db');
      await db.execAsync(SCHEMA_SQL);
      _db = db as unknown as DatabaseAdapter;
    }

    return _db;
  })();

  return _initPromise;
}

export async function getDb(): Promise<DatabaseAdapter> {
  if (_db) return _db;
  return initDb();
}
