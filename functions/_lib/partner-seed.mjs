import { hashPassword, randomSaltB64 } from './password.mjs';
import { PARTNER_ACCOUNT_ID, resolveDb } from './auth-service.mjs';
import { isUniqueViolation } from './unique-row.mjs';

const PARTNER_SLUG = 'dani-carine';

async function insertEmptyPartnerRow(db, nowIso) {
  await db
    .prepare(
      `INSERT INTO accounts (id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(PARTNER_ACCOUNT_ID, '', '', '', 'pro', 'active', PARTNER_SLUG, 1, nowIso)
    .run();
}

export async function ensurePartnerAccount(db, { email, password } = {}, nowIso) {
  db = resolveDb(db);

  const normalized = String(email || '').trim().toLowerCase();
  const hasCreds = Boolean(normalized && password);

  try {
    const existing = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(PARTNER_ACCOUNT_ID).first();

    if (!hasCreds) {
      if (existing) return;
      await insertEmptyPartnerRow(db, nowIso);
      return;
    }

    const occupant = await db.prepare('SELECT * FROM accounts WHERE email = ?').bind(normalized).first();
    if (occupant && occupant.id !== PARTNER_ACCOUNT_ID) return;

    if (existing) {
      let salt = existing.password_salt;
      let hash = existing.password_hash;
      if (!hash) {
        salt = randomSaltB64();
        hash = await hashPassword(password, salt);
      }
      await db
        .prepare(
          `UPDATE accounts SET email = ?, password_hash = ?, password_salt = ?, slug = ?, is_partner = ?, plan = ?, plan_status = ? WHERE id = ?`
        )
        .bind(normalized, hash, salt, PARTNER_SLUG, 1, 'pro', 'active', PARTNER_ACCOUNT_ID)
        .run();
      return;
    }

    const salt = randomSaltB64();
    const hash = await hashPassword(password, salt);
    await db
      .prepare(
        `INSERT INTO accounts (id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(PARTNER_ACCOUNT_ID, normalized, hash, salt, 'pro', 'active', PARTNER_SLUG, 1, nowIso)
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) return;
    throw err;
  }
}
