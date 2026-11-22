import type { Queryable } from '../db/pool';
import type { Pagination } from '../utils/pagination';
import { containsPattern, toCount } from './sql-helpers';

interface OutletRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Outlet {
  id: number;
  code: string;
  name: string;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewOutlet {
  code: string;
  name: string;
  address: string | null;
}

export interface OutletFilter {
  search?: string | undefined;
}

const COLUMNS = 'id, code, name, address, created_at, updated_at';

const toOutlet = (row: OutletRow): Outlet => ({
  id: Number(row.id),
  code: row.code,
  name: row.name,
  address: row.address,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const insertOutlet = async (db: Queryable, outlet: NewOutlet): Promise<Outlet> => {
  const { rows } = await db.query<OutletRow>(
    `INSERT INTO outlets (code, name, address) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [outlet.code, outlet.name, outlet.address],
  );
  const [row] = rows;
  if (!row) throw new Error('INSERT outlets returned no row');
  return toOutlet(row);
};

export const outletExists = async (db: Queryable, id: number): Promise<boolean> => {
  const { rows } = await db.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM outlets WHERE id = $1) AS exists',
    [id],
  );
  return rows[0]?.exists === true;
};

// $1 = search pattern or NULL (filter disabled).
const FILTER = '($1::text IS NULL OR code ILIKE $1 OR name ILIKE $1)';

export const listOutlets = async (
  db: Queryable,
  filter: OutletFilter,
  { limit, offset }: Pagination,
): Promise<Outlet[]> => {
  const { rows } = await db.query<OutletRow>(
    `SELECT ${COLUMNS} FROM outlets WHERE ${FILTER}
     ORDER BY name, id
     LIMIT $2 OFFSET $3`,
    [containsPattern(filter.search), limit, offset],
  );
  return rows.map(toOutlet);
};

export const countOutlets = async (db: Queryable, filter: OutletFilter): Promise<number> => {
  const { rows } = await db.query<{ total: string }>(
    `SELECT count(*) AS total FROM outlets WHERE ${FILTER}`,
    [containsPattern(filter.search)],
  );
  return toCount(rows);
};
