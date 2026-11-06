/**
 * Seed — papelaria digital (save the date / convite WhatsApp).
 * Placeholders: {{names}} {{date}} {{place}} {{url}}
 */

export const STATIONERY_DEFAULTS = {
  names: 'Dani & Carine',
  date: '21 de novembro de 2026, às 8h',
  place: 'Indaiá Eventos · Canto da Lagoa, Florianópolis',
  urlPath: '/dani-carine/',
};

export const STATIONERY_TEMPLATES = [
  {
    id: 'save-the-date',
    title: 'Save the date',
    body:
      'Save the date! {{names}} se casam em {{date}}. Local: {{place}}. Confirme e veja detalhes: {{url}}',
    kind: 'whatsapp',
  },
  {
    id: 'convite',
    title: 'Convite WhatsApp',
    body:
      'Você está convidado(a) para o casamento de {{names}}! {{date}} em {{place}}. RSVP e presentes: {{url}}',
    kind: 'whatsapp',
  },
  {
    id: 'lembrete-rsvp',
    title: 'Lembrete RSVP',
    body:
      'Oi! Só lembrando de confirmar presença no casamento de {{names}} ({{date}}). Leva 1 minutinho: {{url}}#confirmar-presenca',
    kind: 'whatsapp',
  },
  {
    id: 'agradecimento',
    title: 'Agradecimento',
    body:
      'Obrigado por celebrar com a gente! Com carinho, {{names}}. Se quiser deixar um recado: {{url}}#mural-recados',
    kind: 'whatsapp',
  },
];

/**
 * @param {string} body
 * @param {Record<string, string>} vars
 */
export function fillStationeryPlaceholders(body, vars) {
  return String(body || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (vars[key] == null) return `{{${key}}}`;
    return String(vars[key]);
  });
}

/**
 * @param {string} text
 * @returns {string} wa.me URL without phone (share sheet)
 */
export function whatsappShareUrl(text) {
  const encoded = encodeURIComponent(String(text || '').trim());
  return `https://wa.me/?text=${encoded}`;
}
