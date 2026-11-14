-- Migration 0016: seed quiz Missão Impossível (gabarito provisório: alternativa A)
-- A noiva ajusta o correct_index depois no admin

INSERT OR IGNORE INTO challenge_questions
  (id, wedding_key, prompt, options_json, correct_index, points, active, sort_order, updated_at)
VALUES
  ('q-referencia-caderno-votos', 'dani-carine', 'Qual era a referência no caderno de votos dos noivos?', '["Star Wars","Grinch","Rocky Balboa","Up — Altas Aventuras"]', 0, 10, 1, 0, datetime('now')),
  ('q-entrada-padrinhos-inspiracao', 'dani-carine', 'A entrada dos padrinhos foi inspirada em', '["The Office","High School Musical","Rei Leão","Piratas do Caribe"]', 0, 10, 1, 1, datetime('now')),
  ('q-entrada-padrinhos-desenho', 'dani-carine', 'A entrada dos padrinhos na cerimônia é referente a qual desenho?', '["Pokémon","Naruto","Cavaleiros do Zodíaco","Digimon"]', 0, 10, 1, 2, datetime('now')),
  ('q-kovu-filme', 'dani-carine', 'O nome do cachorrinho dos noivos "Kovu" é baseado em qual filme?', '["Avatar","Pokémon","Interestelar","Rei Leão"]', 0, 10, 1, 3, datetime('now')),
  ('q-personagem-lista-presenca', 'dani-carine', 'Qual personagem a noiva escolheu ser na lista de presença?', '["Padmé","Aurora","Princesa Leia","Malévola"]', 0, 10, 1, 4, datetime('now')),
  ('q-musica-entrada-noiva', 'dani-carine', 'Você percebeu a música que a noiva escolheu para a entrada?', '["Is This Love — Whitesnake","I''ll Be There — Jackson 5","November Rain — Guns N'' Roses","A Sky Full of Stars — Coldplay"]', 0, 10, 1, 5, datetime('now')),
  ('q-musica-entrada-noivo', 'dani-carine', 'Qual a música o noivo escolheu para entrada?', '["Trilha sonora de Velozes e Furiosos","O Tempo Traz Você para Mim — dorama","Hino da Champions League","Don''t Cry — Guns N'' Roses"]', 0, 10, 1, 6, datetime('now')),
  ('q-musica-festa-noiva', 'dani-carine', 'Qual música não pode faltar numa festa organizada pela noiva?', '["Ragatanga — Rouge","Love Generation — Bob Sinclar","Party Rock Anthem — LMFAO","Todas as anteriores"]', 0, 10, 1, 7, datetime('now')),
  ('q-padrinhos-mais-animados', 'dani-carine', 'Quem são os padrinhos mais animados da festa?', '["Bruno","Brayan","Phillip","Todos os anteriores"]', 0, 10, 1, 8, datetime('now')),
  ('q-padrinhos-mais-emocionados', 'dani-carine', 'Quem são os padrinhos mais emocionados da festa?', '["Luiz","Jair","Lucas","Todos os anteriores"]', 0, 10, 1, 9, datetime('now')),
  ('q-madrinha-mais-ansiosa', 'dani-carine', 'Qual madrinha estava mais ansiosa para o casamento?', '["Gabi","Cris","Ana","Todas as madrinhas"]', 0, 10, 1, 10, datetime('now')),
  ('q-filme-preferido-noiva', 'dani-carine', 'Qual o filme preferido da noiva?', '["Grinch","Mulan","A Bela e a Fera","Star Wars — A Vingança dos Sith"]', 0, 10, 1, 11, datetime('now')),
  ('q-filme-preferido-noivo', 'dani-carine', 'Qual o filme preferido do noivo?', '["Rocky Balboa","À Procura da Felicidade","Interestelar","Velozes e Furiosos"]', 0, 10, 1, 12, datetime('now')),
  ('q-padrinho-danca', 'dani-carine', 'Qual é o padrinho que mais queria fazer dança dos padrinhos?', '["Lucas","Phillip","Luiz","Bruno"]', 0, 10, 1, 13, datetime('now')),
  ('q-padrinhos-mesma-profissao', 'dani-carine', 'Quais padrinhos têm a mesma profissão?', '["Luiz e Phillip","Lucas e Bruno","Jair e Brayan"]', 0, 10, 1, 14, datetime('now')),
  ('q-madrinha-matematica', 'dani-carine', 'Qual madrinha arrasa na matemática?', '["Gabi","Cris","Jéssica","Ana"]', 0, 10, 1, 15, datetime('now')),
  ('q-ideia-missao-impossivel', 'dani-carine', 'A ideia da "missão impossível" foi:', '["Do noivo","Da noiva","Do Bruno","Do Lucas"]', 0, 10, 1, 16, datetime('now')),
  ('q-doutorado-festa', 'dani-carine', 'Qual pessoa tem doutorado na festa?', '["O noivo","A noiva","Camila Barreto","A mãe da noiva"]', 0, 10, 1, 17, datetime('now')),
  ('q-quem-casa-semana-que-vem', 'dani-carine', 'Quem vai casar semana que vem?', '["Cristine","Artur","Eliandra","Samuel"]', 0, 10, 1, 18, datetime('now'));

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0016', datetime('now'))
ON CONFLICT(version) DO NOTHING;
