import { getGamesAdminToken, setGamesAdminToken } from './admin-auth.js';

export class AdminAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

function adminHeaders() {
  return {
    Authorization: `Bearer ${getGamesAdminToken()}`,
    'Content-Type': 'application/json',
  };
}

function throwIfAuthFailed(res, data) {
  if (res.status === 401 || res.status === 503) {
    throw new AdminAuthError(data.message || 'Sessão do painel inválida');
  }
}

export async function loginGamesAdmin(user, pass) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.token) {
    throw new Error(data.message || 'Login ou senha não conferem.');
  }
  setGamesAdminToken(data.token);
  return data.token;
}

export async function listAdminQuestions() {
  const res = await fetch('/api/admin/challenges/questions', { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  throwIfAuthFailed(res, data);
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para carregar o quiz');
  return Array.isArray(data.questions) ? data.questions : [];
}

export async function listRaffleDrawEntries() {
  const res = await fetch('/api/admin/raffles/draw', { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  throwIfAuthFailed(res, data);
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para carregar os números vendidos');
  return {
    raffle: data.raffle || null,
    entries: Array.isArray(data.entries) ? data.entries : [],
  };
}

export async function getDrawBroadcastAdmin() {
  const res = await fetch('/api/admin/raffles/draw/broadcast', { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  throwIfAuthFailed(res, data);
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para carregar o modo sorteio');
  return data.broadcast || { phase: 'gallery' };
}

export async function putDrawBroadcast(body) {
  const res = await fetch('/api/admin/raffles/draw/broadcast', {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  throwIfAuthFailed(res, data);
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Não deu para atualizar o modo sorteio');
  return data.broadcast || { phase: 'gallery' };
}

export async function setQuestionCorrectIndex(id, correctIndex) {
  const res = await fetch('/api/admin/challenges/questions', {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ id, correctIndex }),
  });
  const data = await res.json().catch(() => ({}));
  throwIfAuthFailed(res, data);
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para salvar a resposta');
  return data.question;
}
