-- Reset dados de teste do /games (dani-carine) antes do uso real.
-- Limpa: progresso (respostas/fotos), ranking (pontos/selos), galeria,
-- números vendidos da rifa, broadcast do sorteio e intents Pix de rifa.
-- NÃO apaga: catálogo de desafios, rifa ativa, tema, RSVP, presentes.

DELETE FROM desafio_guest_progress WHERE wedding_key = 'dani-carine';
DELETE FROM desafio_ranking WHERE wedding_key = 'dani-carine';
DELETE FROM desafio_gallery WHERE wedding_key = 'dani-carine';

-- Vendas da rifa (tabela sem wedding_key; rifas do casal usam ids desta festa)
DELETE FROM desafio_raffle_sales
WHERE raffle_id IN (
  SELECT id FROM desafio_raffles WHERE wedding_key = 'dani-carine'
);

-- Volta telões para modo galeria
DELETE FROM desafio_raffle_draw_broadcast WHERE wedding_key = 'dani-carine';
INSERT INTO desafio_raffle_draw_broadcast (
  wedding_key, phase, started_at, duration_ms, winner_number, winner_name,
  raffle_id, pool_json, updated_at
) VALUES (
  'dani-carine', 'gallery', NULL, 8000, NULL, NULL, NULL, NULL, datetime('now')
);

-- Intents Pix de números de sorteio (teste)
DELETE FROM checkout_intents
WHERE wedding_key = 'dani-carine'
  AND canonical_items LIKE '%"giftId":"raffle-%';

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0035', datetime('now'))
ON CONFLICT(version) DO NOTHING;
