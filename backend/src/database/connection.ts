import { Pool, PoolConfig } from 'pg';
import config from '../config/index';

let pool: Pool | null = null;

export class Database {
  private pool: Pool | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (!this.pool) {
      const poolConfig: PoolConfig = config.database.connectionString ? {
        connectionString: config.database.connectionString,
        ssl: config.database.ssl,
        max: config.database.max,
        idleTimeoutMillis: config.database.idleTimeoutMillis,
        connectionTimeoutMillis: config.database.connectionTimeoutMillis,
      } : {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
        max: config.database.max,
        idleTimeoutMillis: config.database.idleTimeoutMillis,
        connectionTimeoutMillis: config.database.connectionTimeoutMillis,
      };

      this.pool = new Pool(poolConfig);

      this.pool.on('error', (err) => {
        console.error('Database pool error:', err);
      });
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      this.initialize();
    }
    return this.pool!;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const pool = this.getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// Legacy exports for backward compatibility
export const getPool = (): Pool => {
  if (!pool) {
    const poolConfig: PoolConfig = config.database.connectionString ? {
      connectionString: config.database.connectionString,
      ssl: config.database.ssl,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    } : {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
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

// Main database instance
const database = new Database();

export const db = {
  getPool,
  query,
  closePool
};

export default database;