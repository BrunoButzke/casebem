export function isUniqueViolation(err) {
  const msg = String(err?.message || '');
  return msg.includes('UNIQUE') || msg.includes('PRIMARY') || msg.includes('constraint');
}

export function withUniqueSuffix(id, maxLen = 40) {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const maxBase = Math.max(1, maxLen - 1 - suffix.length);
  const base = String(id || 'item').slice(0, maxBase).replace(/-+$/g, '') || 'item';
  return `${base}-${suffix}`;
}

export async function insertRetryOnForeignOwner({
  id,
  accountId,
  insert,
  selectOwnerAccountId,
  existsError,
}) {
  try {
    await insert(id);
    return id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const owner = await selectOwnerAccountId(id);
    if (!owner || owner === accountId) throw new Error(existsError);
    const retryId = withUniqueSuffix(id);
    try {
      await insert(retryId);
      return retryId;
    } catch (err2) {
      if (isUniqueViolation(err2)) throw new Error(existsError);
      throw err2;
    }
  }
}
