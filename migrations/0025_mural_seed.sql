-- Migration 0025: seed inicial do mural de recados (dani-carine)

INSERT OR IGNORE INTO wedding_messages (
  id, wedding_key, guest_name, message,
  consent_given, created_at,
  idempotency_key, idempotency_fingerprint, hidden
) VALUES
  (
    'seed-mural-1',
    'dani-carine',
    'Família Silva',
    'Que o amor de vocês continue florindo em cada estação. Felicidades!',
    1,
    '2026-11-16T12:00:00.000Z',
    'seed-mural-1',
    'seed-mural-1',
    0
  ),
  (
    'seed-mural-2',
    'dani-carine',
    'Ana & Pedro',
    'Mal podemos esperar para celebrar com vocês. Todo o carinho do mundo!',
    1,
    '2026-11-16T18:00:00.000Z',
    'seed-mural-2',
    'seed-mural-2',
    0
  ),
  (
    'seed-mural-3',
    'dani-carine',
    'Tia Márcia',
    'Dani e Carine, que essa união seja leve, forte e cheia de risadas.',
    1,
    '2026-11-17T06:00:00.000Z',
    'seed-mural-3',
    'seed-mural-3',
    0
  ),
  (
    'seed-mural-4',
    'dani-carine',
    'Bruno Butzke',
    'Orgulho enorme de vocês duas. Que a Lagoa guarde esse dia pra sempre.',
    1,
    '2026-11-17T12:00:00.000Z',
    'seed-mural-4',
    'seed-mural-4',
    0
  ),
  (
    'seed-mural-5',
    'dani-carine',
    'Camila & João',
    'Amor que inspira! Obrigada por nos convidar a fazer parte desse momento.',
    1,
    '2026-11-17T20:00:00.000Z',
    'seed-mural-5',
    'seed-mural-5',
    0
  ),
  (
    'seed-mural-6',
    'dani-carine',
    'Grupo da faculdade',
    'Das salas de aula até o altar — que linda história. Parabéns!',
    1,
    '2026-11-18T02:00:00.000Z',
    'seed-mural-6',
    'seed-mural-6',
    0
  );

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0025', datetime('now'))
ON CONFLICT(version) DO NOTHING;
