-- Migration 0014: seed Missão Impossível (fotos + cartão drink)
-- Quiz: ver migration 0016 (gabarito provisório A)

INSERT OR IGNORE INTO challenge_photo_missions
  (id, wedding_key, title, points, awards_stamp, active, sort_order, updated_at)
VALUES
  ('foto-noiva', 'dani-carine', 'Tire uma foto com a noiva', 15, 1, 1, 0, datetime('now')),
  ('foto-noivo', 'dani-carine', 'Tire uma foto com o noivo', 15, 1, 1, 1, datetime('now')),
  ('foto-cerimonialista', 'dani-carine', 'Tire uma foto com a cerimonialista', 15, 1, 1, 2, datetime('now')),
  ('foto-padrinhos-magicos', 'dani-carine', 'Tire uma foto com os padrinhos mágicos', 15, 1, 1, 3, datetime('now')),
  ('foto-mae-noivo', 'dani-carine', 'Tire uma foto com a mãe do noivo', 15, 1, 1, 4, datetime('now')),
  ('foto-mae-noiva', 'dani-carine', 'Tire uma foto com a mãe da noiva', 15, 1, 1, 5, datetime('now')),
  ('foto-amigo-noiva-desconhecido', 'dani-carine', 'Tire uma foto com um amigo da noiva que você não conhece', 15, 1, 1, 6, datetime('now')),
  ('foto-pessoa-desconhecida', 'dani-carine', 'Tire uma foto com qualquer pessoa que você não conhece', 15, 1, 1, 7, datetime('now')),
  ('foto-toalha-mesa', 'dani-carine', 'Tire uma foto com a toalha de mesa', 15, 1, 1, 8, datetime('now')),
  ('foto-flores-mesa', 'dani-carine', 'Tire uma foto com as flores da mesa', 15, 1, 1, 9, datetime('now')),
  ('foto-utensilios-banheiro', 'dani-carine', 'Tire uma foto com os utensílios do banheiro', 15, 1, 1, 10, datetime('now')),
  ('foto-fotografo', 'dani-carine', 'Tire uma foto com o fotógrafo', 15, 1, 1, 11, datetime('now')),
  ('foto-camera-men', 'dani-carine', 'Tire uma foto com o câmera man', 15, 1, 1, 12, datetime('now')),
  ('foto-barista', 'dani-carine', 'Tire uma foto com o barista do café', 15, 1, 1, 13, datetime('now')),
  ('foto-lagoa', 'dani-carine', 'Tire uma foto com a lagoa', 15, 1, 1, 14, datetime('now')),
  ('foto-dancando-noiva', 'dani-carine', 'Tire uma foto dançando com a noiva', 15, 1, 1, 15, datetime('now')),
  ('foto-dj', 'dani-carine', 'Tire uma foto com o DJ', 15, 1, 1, 16, datetime('now')),
  ('foto-mesa-doces', 'dani-carine', 'Tire uma foto com a mesa de doces', 15, 1, 1, 17, datetime('now')),
  ('foto-lista-presenca', 'dani-carine', 'Tire uma foto mostrando você na lista de presença', 15, 1, 1, 18, datetime('now')),
  ('foto-alguem-ver-mais', 'dani-carine', 'Tire foto com alguém que você gostaria de ver mais vezes', 15, 1, 1, 19, datetime('now')),
  ('foto-alguem-tempo', 'dani-carine', 'Tire foto com alguém que você não vê há algum tempo', 15, 1, 1, 20, datetime('now')),
  ('foto-sofa', 'dani-carine', 'Tire uma foto no sofá', 15, 1, 1, 21, datetime('now'));

INSERT OR IGNORE INTO challenge_stamp_cards
  (id, wedding_key, name, stamps_required, reward_text, active, sort_order, updated_at)
VALUES
  ('drink-fora-cardapio', 'dani-carine', 'Drink fora do cardápio', 3, 'Acesso a um drink que não está no cardápio', 1, 0, datetime('now'));

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0014', datetime('now'))
ON CONFLICT(version) DO NOTHING;
