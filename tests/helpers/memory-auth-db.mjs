function compactSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

export class MemoryAuthDb {
  constructor() {
    this.accounts = new Map();
    this.sessions = new Map();
  }

  prepare(sql) {
    return new MemoryAuthStatement(this, compactSql(sql));
  }

  findAccountById(id) {
    for (const row of this.accounts.values()) {
      if (row.id === id) return row;
    }
    return null;
  }

  findAccountBySlug(slug) {
    for (const row of this.accounts.values()) {
      if (row.slug === slug) return row;
    }
    return null;
  }
}

class MemoryAuthStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    const { sql, params, db } = this;
    if (sql.includes('SELECT * FROM accounts WHERE email')) {
      return db.accounts.get(params[0]) ?? null;
    }
    if (sql.includes('SELECT * FROM accounts WHERE slug')) {
      return db.findAccountBySlug(params[0]);
    }
    if (sql.includes('SELECT * FROM accounts WHERE id')) {
      return db.findAccountById(params[0]);
    }
    if (sql.includes('SELECT * FROM sessions WHERE id')) {
      return db.sessions.get(params[0]) ?? null;
    }
    throw new Error(`MemoryAuthDb: unsupported first() SQL: ${sql}`);
  }

  async run() {
    const { sql, params, db } = this;
    if (sql.includes('INSERT INTO accounts')) {
      const [
        id,
        email,
        password_hash,
        password_salt,
        plan,
        plan_status,
        slugOrCreatedAt,
        maybePartner,
        maybeCreatedAt,
      ] = params;
      const partnerInsert = params.length >= 9;
      const occupant = db.accounts.get(email);
      if (occupant && occupant.id !== id) {
        throw new Error('UNIQUE constraint failed: accounts.email');
      }
      const row = {
        id,
        email,
        password_hash,
        password_salt,
        plan,
        plan_status,
        slug: partnerInsert ? slugOrCreatedAt : null,
        is_partner: partnerInsert ? maybePartner : 0,
        created_at: partnerInsert ? maybeCreatedAt : slugOrCreatedAt,
      };
      db.accounts.set(email, row);
      return { success: true };
    }
    if (sql.includes('INSERT INTO sessions')) {
      const [id, account_id, expires_at, created_at] = params;
      db.sessions.set(id, { id, account_id, expires_at, created_at });
      return { success: true };
    }
    if (sql.includes('DELETE FROM sessions WHERE id')) {
      db.sessions.delete(params[0]);
      return { success: true };
    }
    if (sql.includes('UPDATE accounts SET email')) {
      const [email, password_hash, password_salt, slug, is_partner, plan, plan_status, id] = params;
      const occupant = db.accounts.get(email);
      if (occupant && occupant.id !== id) {
        throw new Error('UNIQUE constraint failed: accounts.email');
      }
      const row = db.findAccountById(id);
      if (row) {
        const previousEmail = row.email;
        row.email = email;
        row.password_hash = password_hash;
        row.password_salt = password_salt;
        row.slug = slug;
        row.is_partner = is_partner;
        row.plan = plan;
        row.plan_status = plan_status;
        if (previousEmail !== email) {
          db.accounts.delete(previousEmail);
          db.accounts.set(email, row);
        }
      }
      return { success: true };
    }
    if (sql.includes('UPDATE accounts SET plan')) {
      const [plan, plan_status, id] = params;
      const row = db.findAccountById(id);
      if (row) {
        row.plan = plan;
        row.plan_status = plan_status;
      }
      return { success: true };
    }
    throw new Error(`MemoryAuthDb: unsupported run() SQL: ${sql}`);
  }

  async all() {
    const row = await this.first();
    return { results: row ? [row] : [] };
  }
}
