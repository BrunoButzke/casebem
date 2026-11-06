/**
 * Catálogo de presentes (fonte única imutável)
 * Preços em centavos para evitar arredondamento
 */

export const GIFTS_CATALOG = [
  {
    id: 'mensagem',
    name: 'Uma mensagem de carinho',
    description: 'Mande um carinho no valor que quiser',
    priceInCents: 99,
    imageUrl: '/images/gifts/mensagem.jpg',
    mode: 'custom',
  },
  {
    id: 'danca',
    name: 'Aula de dança',
    description: 'Uma noite só nossa',
    priceInCents: 15000,
    imageUrl: '/images/gifts/danca.jpg',
    mode: 'fixed',
  },
  {
    id: 'churrasco',
    name: 'Churrasco do casal',
    description: 'Carne, vinho e boa conversa',
    priceInCents: 18000,
    imageUrl: '/images/gifts/churrasco.jpg',
    mode: 'fixed',
  },
  {
    id: 'brunch',
    name: 'Brunch na Lagoa',
    description: 'Manhã preguiçosa com vista',
    priceInCents: 20000,
    imageUrl: '/images/gifts/brunch.jpg',
    mode: 'fixed',
  },
  {
    id: 'adega',
    name: 'Adega para dois',
    description: 'Garrafas para brindar',
    priceInCents: 22000,
    imageUrl: '/images/gifts/adega.jpg',
    mode: 'fixed',
  },
  {
    id: 'jantar',
    name: 'Jantar romântico',
    description: 'Mesa reservada, só nós',
    priceInCents: 25000,
    imageUrl: '/images/gifts/jantar.jpg',
    mode: 'fixed',
  },
  {
    id: 'spa',
    name: 'Experiência spa',
    description: 'Massagem a quatro mãos',
    priceInCents: 30000,
    imageUrl: '/images/gifts/spa.jpg',
    mode: 'fixed',
  },
  {
    id: 'hotel',
    name: 'Noite de hotel',
    description: 'Check-in e café da manhã',
    priceInCents: 40000,
    imageUrl: '/images/gifts/hotel.jpg',
    mode: 'fixed',
  },
  {
    id: 'lua',
    name: 'Lua de mel',
    description: 'Um pedacinho da viagem',
    priceInCents: 50000,
    imageUrl: '/images/gifts/lua.jpg',
    mode: 'fixed',
  },
];

/**
 * Busca presente por ID
 * @param {string} giftId - ID do presente
 * @returns {object|null} Presente ou null se não encontrado
 */
export function getGiftById(giftId) {
  return GIFTS_CATALOG.find(g => g.id === giftId) || null;
}

/**
 * Calcula total do carrinho em centavos
 * @param {Array<{giftId: string, quantity: number}>} items - Itens do carrinho
 * @returns {number} Total em centavos
 */
export function calculateTotal(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  let total = 0;

  for (const item of items) {
    // Validar item
    if (!item || typeof item !== 'object') continue;
    
    const { giftId, quantity } = item;
    
    // Validar quantidade
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      continue;
    }
    
    // Buscar presente
    const gift = getGiftById(giftId);
    if (!gift) {
      continue;
    }
    
    // Adicionar ao total
    total += gift.priceInCents * quantity;
  }

  return total;
}

/**
 * Formata preço em centavos para BRL
 * @param {number} cents - Preço em centavos
 * @returns {string} Preço formatado (ex: "R$ 150,00")
 */
export function formatPrice(cents) {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
