/** Helpers para D1 em transição (ex.: migration 0031 ainda não aplicada). */

export function isMissingWeddingKeyColumn(err) {
  return /no such column:\s*wedding_key/i.test(String(err?.message || err || ''));
}
