import { SQLiteDatabase } from 'expo-sqlite';
import * as crypto from 'expo-crypto';

export type Borrower = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};

export class BorrowerRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(name: string, phone: string): Promise<Borrower> {
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    
    await this.db.runAsync(
      `INSERT INTO borrowers (id, name, phone, created_at) VALUES (?, ?, ?, ?)`,
      [id, name, phone, created_at]
    );
    
    return { id, name, phone, created_at };
  }

  async getAll(): Promise<Borrower[]> {
    return await this.db.getAllAsync<Borrower>(`SELECT * FROM borrowers ORDER BY name ASC`);
  }

  async getById(id: string): Promise<Borrower | null> {
    return await this.db.getFirstAsync<Borrower>(`SELECT * FROM borrowers WHERE id = ?`, [id]);
  }
}
