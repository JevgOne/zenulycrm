import { createClient, type Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';

const client: Client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/lead-crm.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// DB wrapper with convenience methods
export const db = {
  async get(sql: string, ...args: any[]): Promise<any> {
    const result = await client.execute({ sql, args });
    return result.rows[0] || null;
  },

  async all(sql: string, ...args: any[]): Promise<any[]> {
    const result = await client.execute({ sql, args });
    return result.rows as any[];
  },

  async run(sql: string, ...args: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
    const result = await client.execute({ sql, args });
    return {
      lastInsertRowid: Number(result.lastInsertRowid),
      changes: result.rowsAffected,
    };
  },

  async exec(sql: string): Promise<void> {
    await client.executeMultiple(sql);
  },

  async batch(stmts: Array<{ sql: string; args?: any[] }>): Promise<void> {
    await client.batch(
      stmts.map(s => ({ sql: s.sql, args: s.args || [] })),
      'write'
    );
  },
};

// Initialize schema
export async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await db.exec(schema);
  }
  console.log('Database initialized (Turso)');
}

export default db;
