/**
 * Run: node --test tests/gallery-service.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetMemoryGalleryForTests,
  upsertGalleryPhoto,
  listGalleryPhotos,
  getGalleryPhoto,
  getGalleryImage,
  deleteGalleryPhoto,
  galleryImagePath,
} from '../functions/_lib/gallery-service.mjs';

const PREVIEW = 'data:image/jpeg;base64,/9j/4AAQ';

beforeEach(() => resetMemoryGalleryForTests());

test('upsert gallery photo is listed with an image URL, not the bytes', async () => {
  const saved = await upsertGalleryPhoto(null, {
    guestName: 'Ana',
    missionId: 'foto-noiva',
    title: 'Tire uma foto com a noiva',
    preview: PREVIEW,
  });
  assert.equal(saved.guestName, 'Ana');
  assert.equal(saved.preview, galleryImagePath(saved.id));
  const list = await listGalleryPhotos(null);
  assert.equal(list.length, 1);
  assert.equal(list[0].preview, galleryImagePath(saved.id));
  const full = await getGalleryPhoto(null, saved.id);
  assert.equal(full.preview, galleryImagePath(saved.id));
  const image = await getGalleryImage(null, saved.id, null);
  assert.equal(image.contentType, 'image/jpeg');
  assert.ok(image.bytes.length > 0);
});

test('replacing a mission photo creates a new id', async () => {
  const first = await upsertGalleryPhoto(null, {
    guestName: 'Ana',
    missionId: 'foto-noiva',
    title: 'Tire uma foto com a noiva',
    preview: PREVIEW,
  });
  const second = await upsertGalleryPhoto(null, {
    guestName: 'Ana',
    missionId: 'foto-noiva',
    title: 'Tire uma foto com a noiva',
    preview: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  });
  assert.notEqual(second.id, first.id);
  const list = await listGalleryPhotos(null);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, second.id);
  await assert.rejects(() => getGalleryImage(null, first.id, null), /NOT_FOUND/);
});

test('delete by photo id', async () => {
  const saved = await upsertGalleryPhoto(null, {
    guestName: 'Ana',
    missionId: 'foto-noiva',
    title: 'Foto',
    preview: PREVIEW,
  });
  await deleteGalleryPhoto(null, { id: saved.id });
  assert.equal((await listGalleryPhotos(null)).length, 0);
  await assert.rejects(() => getGalleryImage(null, saved.id, null), /NOT_FOUND/);
});

test('delete by guest and mission', async () => {
  const saved = await upsertGalleryPhoto(null, {
    guestName: 'Ana',
    missionId: 'foto-noiva',
    title: 'Foto',
    preview: PREVIEW,
  });
  await deleteGalleryPhoto(null, { guestName: 'Ana', missionId: 'foto-noiva' });
  assert.equal((await listGalleryPhotos(null)).length, 0);
  await assert.rejects(() => getGalleryImage(null, saved.id, null), /NOT_FOUND/);
});
