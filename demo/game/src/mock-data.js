/** Dados 100% locais — não chama /api/desafio nem toca no /games real. */

export const DEMO_GUEST = 'Você';
export const DEMO_COUPLE = 'Ana & Leo';

export const MOCK_QUESTIONS = [
  {
    id: 'dq1',
    prompt: 'Onde o casal se conheceu?',
    options: ['Na faculdade', 'Num café', 'No trabalho', 'Numa festa de amigos'],
    correctIndex: 1,
    points: 10,
  },
  {
    id: 'dq2',
    prompt: 'Qual a cor favorita da noiva nesta demo?',
    options: ['Verde', 'Azul', 'Rosa blush', 'Amarelo'],
    correctIndex: 2,
    points: 10,
  },
  {
    id: 'dq3',
    prompt: 'O que não pode faltar na festa?',
    options: ['Fila no buffet', 'Pista lotada', 'Chuva', 'Wi-Fi lento'],
    correctIndex: 1,
    points: 15,
  },
  {
    id: 'dq4',
    prompt: 'Qual o prato preferido do noivo (demo)?',
    options: ['Risoto', 'Churrasco', 'Sushi', 'Lasanha'],
    correctIndex: 1,
    points: 10,
  },
];

export const MOCK_PHOTO_MISSIONS = [
  {
    id: 'dm1',
    title: 'Selfie com o casal (ou com a mesa)',
    points: 20,
    awardsStamp: true,
    preview: '/images/demo/grupo.jpg',
    done: true,
    guestName: 'Marina',
  },
  {
    id: 'dm2',
    title: 'Foto na pista de dança',
    points: 15,
    awardsStamp: true,
    preview: '/images/demo/pista.jpg',
    done: true,
    guestName: 'Rafa',
  },
  {
    id: 'dm3',
    title: 'Brinde com alguém novo',
    points: 15,
    awardsStamp: false,
    preview: null,
    done: false,
    guestName: '',
  },
  {
    id: 'dm4',
    title: 'Docinho da festa em close',
    points: 10,
    awardsStamp: false,
    preview: null,
    done: false,
    guestName: '',
  },
];

export const MOCK_STAMP_CARD = {
  id: 'dsc1',
  name: 'Cartão fidelidade da festa',
  stampsRequired: 8,
  fillMode: 'stamp',
  rewardText: 'Brinde surpresa do casal',
  barHint: 'Complete os selos e retire no bar',
  footerTemplate: 'Faltam {n} selos',
  cardBg: '#fff8f5',
  cardAccent: '#c45c6a',
  cardAccentSoft: '#f3d5d8',
  cardText: '#3a2a2c',
  cardBorder: '#e8c9cc',
};

/** Selos já “ganhos” na demo (cartão semi preenchido). */
export const MOCK_STAMPS = 3;
export const MOCK_BASE_POINTS = 45;

export const MOCK_RANKING = [
  { guestName: 'Marina', points: 120, stamps: 5 },
  { guestName: 'Rafa', points: 95, stamps: 4 },
  { guestName: 'Você', points: MOCK_BASE_POINTS, stamps: MOCK_STAMPS },
  { guestName: 'Bia', points: 70, stamps: 2 },
  { guestName: 'Pedro', points: 55, stamps: 2 },
  { guestName: 'Lu', points: 40, stamps: 1 },
  { guestName: 'Theo', points: 25, stamps: 1 },
];

export const MOCK_GALLERY = [
  {
    id: 'g1',
    title: 'Selfie com o casal (ou com a mesa)',
    guestName: 'Marina',
    preview: '/images/demo/grupo.jpg',
  },
  {
    id: 'g2',
    title: 'Foto na pista de dança',
    guestName: 'Rafa',
    preview: '/images/demo/pista.jpg',
  },
  {
    id: 'g3',
    title: 'Brinde com alguém novo',
    guestName: 'Bia',
    preview: '/images/demo/brinde.jpg',
  },
  {
    id: 'g4',
    title: 'Docinho da festa em close',
    guestName: 'Lu',
    preview: '/images/demo/doce.jpg',
  },
];

const SOLD = new Set([3, 7, 8, 12, 15, 19, 22, 27, 31, 34, 41, 44, 48]);
const MY_DEMO = [5, 18];

export const MOCK_RAFFLE = {
  id: 'dr1',
  name: 'Sorteio: espumante + taças',
  priceCents: 1500,
  imageUrl: '/images/demo/premio.jpg',
  maxNumber: 50,
  soldNumbers: [...SOLD],
  myNumbers: MY_DEMO,
  availableNumbers: Array.from({ length: 50 }, (_, i) => i + 1).filter(
    (n) => !SOLD.has(n) && !MY_DEMO.includes(n)
  ),
};
