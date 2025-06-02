import { Pool, PoolConfig } from 'pg';
import config from '@/config';

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    const poolConfig: PoolConfig = {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  return pool;
};

export const query = async (text: string, params?: any[]): Promise<any> => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export const db = {
  getPool,
  query,
  closePool
};

export default db;