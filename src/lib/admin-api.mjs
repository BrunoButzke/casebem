import { api } from './session-api.mjs';
import { hubTiles } from '../pages/admin/hub-tiles.mjs';

export function shouldFetchAdminResource(plan, tileId) {
  const tile = hubTiles(plan).find((item) => item.id === tileId);
  return Boolean(tile) && !tile.needsUpgrade;
}

export function listGuestsAdmin() {
  return api('/api/admin/guest-list');
}

export function addGuestsAdmin(names) {
  return api('/api/admin/guest-list', {
    method: 'POST',
    body: JSON.stringify({ names }),
  });
}

export function removeGuestAdmin(id) {
  return api('/api/admin/guest-list', {
    method: 'PATCH',
    body: JSON.stringify({ removeId: id }),
  });
}

export function listGiftsAdmin() {
  return api('/api/admin/gifts');
}

export function createGiftAdmin(body) {
  return api('/api/admin/gifts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteGiftAdmin(id) {
  return api(`/api/admin/gifts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listStationeryAdmin() {
  return api('/api/admin/stationery');
}

export function createStationeryAdmin(body) {
  return api('/api/admin/stationery', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteStationeryAdmin(id) {
  return api(`/api/admin/stationery?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listMessagesAdmin() {
  return api('/api/admin/messages');
}

export function hideMessageAdmin(id, hidden = true) {
  return api('/api/admin/messages', {
    method: 'PATCH',
    body: JSON.stringify({ id, hidden }),
  });
}

export function listQuestionsAdmin() {
  return api('/api/admin/challenges/questions');
}

export function createQuestionAdmin(body) {
  return api('/api/admin/challenges/questions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteQuestionAdmin(id) {
  return api(`/api/admin/challenges/questions?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function listGalleryAdmin() {
  return api('/api/admin/gallery');
}
