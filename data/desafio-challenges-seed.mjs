/**
 * Conteúdo inicial — Missão Impossível (Dani & Carine)
 * correctLetter: 'a'|'b'|'c'|'d' (provisório: todas 'a' até a noiva ajustar)
 */

export const QUIZ_POINTS = 10;
export const PHOTO_POINTS = 15;

/** @type {{ id: string, prompt: string, options: string[], correctLetter: string | null, points?: number }[]} */
export const DESAFIO_QUESTIONS = [
  {
    id: 'q-referencia-caderno-votos',
    prompt: 'Qual era a referência no caderno de votos dos noivos?',
    options: ['Star Wars', 'Grinch', 'Rocky Balboa', 'Up — Altas Aventuras'],
    correctLetter: 'a',
  },
  {
    id: 'q-entrada-padrinhos-inspiracao',
    prompt: 'A entrada dos padrinhos foi inspirada em',
    options: ['The Office', 'High School Musical', 'Rei Leão', 'Piratas do Caribe'],
    correctLetter: 'a',
  },
  {
    id: 'q-entrada-padrinhos-desenho',
    prompt: 'A entrada dos padrinhos na cerimônia é referente a qual desenho?',
    options: ['Pokémon', 'Naruto', 'Cavaleiros do Zodíaco', 'Digimon'],
    correctLetter: 'a',
  },
  {
    id: 'q-kovu-filme',
    prompt: 'O nome do cachorrinho dos noivos "Kovu" é baseado em qual filme?',
    options: ['Avatar', 'Pokémon', 'Interestelar', 'Rei Leão'],
    correctLetter: 'a',
  },
  {
    id: 'q-personagem-lista-presenca',
    prompt: 'Qual personagem a noiva escolheu ser na lista de presença?',
    options: ['Padmé', 'Aurora', 'Princesa Leia', 'Malévola'],
    correctLetter: 'a',
  },
  {
    id: 'q-musica-entrada-noiva',
    prompt: 'Você percebeu a música que a noiva escolheu para a entrada?',
    options: [
      'Is This Love — Whitesnake',
      "I'll Be There — Jackson 5",
      "November Rain — Guns N' Roses",
      'A Sky Full of Stars — Coldplay',
    ],
    correctLetter: 'a',
  },
  {
    id: 'q-musica-entrada-noivo',
    prompt: 'Qual a música o noivo escolheu para entrada?',
    options: [
      'Trilha sonora de Velozes e Furiosos',
      'O Tempo Traz Você para Mim — dorama',
      'Hino da Champions League',
      "Don't Cry — Guns N' Roses",
    ],
    correctLetter: 'a',
  },
  {
    id: 'q-musica-festa-noiva',
    prompt: 'Qual música não pode faltar numa festa organizada pela noiva?',
    options: [
      'Ragatanga — Rouge',
      'Love Generation — Bob Sinclar',
      'Party Rock Anthem — LMFAO',
      'Todas as anteriores',
    ],
    correctLetter: 'a',
  },
  {
    id: 'q-padrinhos-mais-animados',
    prompt: 'Quem são os padrinhos mais animados da festa?',
    options: ['Bruno', 'Brayan', 'Phillip', 'Todos os anteriores'],
    correctLetter: 'a',
  },
  {
    id: 'q-padrinhos-mais-emocionados',
    prompt: 'Quem são os padrinhos mais emocionados da festa?',
    options: ['Luiz', 'Jair', 'Lucas', 'Todos os anteriores'],
    correctLetter: 'a',
  },
  {
    id: 'q-madrinha-mais-ansiosa',
    prompt: 'Qual madrinha estava mais ansiosa para o casamento?',
    options: ['Gabi', 'Cris', 'Ana', 'Todas as madrinhas'],
    correctLetter: 'a',
  },
  {
    id: 'q-filme-preferido-noiva',
    prompt: 'Qual o filme preferido da noiva?',
    options: ['Grinch', 'Mulan', 'A Bela e a Fera', 'Star Wars — A Vingança dos Sith'],
    correctLetter: 'a',
  },
  {
    id: 'q-filme-preferido-noivo',
    prompt: 'Qual o filme preferido do noivo?',
    options: ['Rocky Balboa', 'À Procura da Felicidade', 'Interestelar', 'Velozes e Furiosos'],
    correctLetter: 'a',
  },
  {
    id: 'q-padrinho-danca',
    prompt: 'Qual é o padrinho que mais queria fazer dança dos padrinhos?',
    options: ['Lucas', 'Phillip', 'Luiz', 'Bruno'],
    correctLetter: 'a',
  },
  {
    id: 'q-padrinhos-mesma-profissao',
    prompt: 'Quais padrinhos têm a mesma profissão?',
    options: ['Luiz e Phillip', 'Lucas e Bruno', 'Jair e Brayan'],
    correctLetter: 'a',
  },
  {
    id: 'q-madrinha-matematica',
    prompt: 'Qual madrinha arrasa na matemática?',
    options: ['Gabi', 'Cris', 'Jéssica', 'Ana'],
    correctLetter: 'a',
  },
  {
    id: 'q-ideia-missao-impossivel',
    prompt: 'A ideia da "missão impossível" foi:',
    options: ['Do noivo', 'Da noiva', 'Do Bruno', 'Do Lucas'],
    correctLetter: 'a',
  },
  {
    id: 'q-doutorado-festa',
    prompt: 'Qual pessoa tem doutorado na festa?',
    options: ['O noivo', 'A noiva', 'Camila Barreto', 'A mãe da noiva'],
    correctLetter: 'a',
  },
  {
    id: 'q-quem-casa-semana-que-vem',
    prompt: 'Quem vai casar semana que vem?',
    options: ['Cristine', 'Artur', 'Eliandra', 'Samuel'],
    correctLetter: 'a',
  },
];

/** @type {{ id: string, title: string, awardsStamp?: boolean, points?: number }[]} */
export const DESAFIO_PHOTO_MISSIONS = [
  { id: 'foto-noiva', title: 'Tire uma foto com a noiva' },
  { id: 'foto-noivo', title: 'Tire uma foto com o noivo' },
  { id: 'foto-cerimonialista', title: 'Tire uma foto com a cerimonialista' },
  { id: 'foto-padrinhos-magicos', title: 'Tire uma foto com os padrinhos mágicos' },
  { id: 'foto-mae-noivo', title: 'Tire uma foto com a mãe do noivo' },
  { id: 'foto-mae-noiva', title: 'Tire uma foto com a mãe da noiva' },
  { id: 'foto-amigo-noiva-desconhecido', title: 'Tire uma foto com um amigo da noiva que você não conhece' },
  { id: 'foto-pessoa-desconhecida', title: 'Tire uma foto com qualquer pessoa que você não conhece' },
  { id: 'foto-toalha-mesa', title: 'Tire uma foto com a toalha de mesa' },
  { id: 'foto-flores-mesa', title: 'Tire uma foto com as flores da mesa' },
  { id: 'foto-utensilios-banheiro', title: 'Tire uma foto com os utensílios do banheiro' },
  { id: 'foto-fotografo', title: 'Tire uma foto com o fotógrafo' },
  { id: 'foto-camera-men', title: 'Tire uma foto com o câmera man' },
  { id: 'foto-barista', title: 'Tire uma foto com o barista do café' },
  { id: 'foto-lagoa', title: 'Tire uma foto com a lagoa' },
  { id: 'foto-dancando-noiva', title: 'Tire uma foto dançando com a noiva' },
  { id: 'foto-dj', title: 'Tire uma foto com o DJ' },
  { id: 'foto-mesa-doces', title: 'Tire uma foto com a mesa de doces' },
  { id: 'foto-lista-presenca', title: 'Tire uma foto mostrando você na lista de presença' },
  { id: 'foto-alguem-ver-mais', title: 'Tire foto com alguém que você gostaria de ver mais vezes' },
  { id: 'foto-alguem-tempo', title: 'Tire foto com alguém que você não vê há algum tempo' },
  { id: 'foto-sofa', title: 'Tire uma foto no sofá' },
].map((m) => ({ ...m, awardsStamp: true, points: PHOTO_POINTS }));

export const DESAFIO_STAMP_CARDS = [
  {
    id: 'drink-fora-cardapio',
    name: 'Drink fora do cardápio',
    stampsRequired: 3,
    fillMode: 'stamp',
    pointsPerSlot: 10,
    rewardText: 'Acesso a um drink que não está no cardápio',
    cardBg: '#fdfbf8',
    cardAccent: '#d66d81',
    cardAccentSoft: '#f9e4e8',
    cardText: '#7d6e6a',
    cardBorder: '#e8b4bc',
    barHint: 'Mostre este cartão no bar',
    footerTemplate: 'Faltam {n} pontos para o próximo drink 🍸',
  },
];

const LETTER_TO_INDEX = { a: 0, b: 1, c: 2, d: 3 };

/**
 * @param {typeof DESAFIO_QUESTIONS} questions
 * @param {Record<string, string>} [letterById] map id → letter
 */
export function applyQuizGabarito(questions, letterById = {}) {
  return questions.map((q) => {
    const letter = (letterById[q.id] || q.correctLetter || '').toLowerCase();
    const correctIndex = LETTER_TO_INDEX[letter];
    return {
      ...q,
      correctLetter: letter || null,
      correctIndex: Number.isInteger(correctIndex) ? correctIndex : null,
      points: q.points ?? QUIZ_POINTS,
    };
  });
}
