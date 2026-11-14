export const GALLERY_IMAGE_MAX_EDGE = 2560;
export const GALLERY_IMAGE_QUALITY = 0.9;
export const GALLERY_THUMB_MAX_EDGE = 720;
export const GALLERY_THUMB_QUALITY = 0.72;
export const GALLERY_IMAGE_MAX_BYTES = 4_500_000;
export const GALLERY_THUMB_MAX_CHARS = 220_000;

export function scaledSize(width, height, maxEdge) {
  const w = Number(width) || 1;
  const h = Number(height) || 1;
  const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function drawToCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não deu para compactar a imagem'))), 'image/jpeg', quality);
  });
}

function encodeDataUrl(source, maxEdge, quality, maxChars) {
  let edge = maxEdge;
  let q = quality;
  let url = '';
  for (let i = 0; i < 8; i += 1) {
    const { width, height } = scaledSize(source.width, source.height, edge);
    url = drawToCanvas(source, width, height).toDataURL('image/jpeg', q);
    if (url.length <= maxChars) return url;
    if (q > 0.64) q = Math.max(0.6, q - 0.08);
    else edge = Math.round(edge * 0.85);
  }
  return url;
}

async function encodeBlob(source, maxEdge, quality, maxBytes) {
  let edge = maxEdge;
  let q = quality;
  let blob = null;
  for (let i = 0; i < 8; i += 1) {
    const { width, height } = scaledSize(source.width, source.height, edge);
    blob = await canvasToBlob(drawToCanvas(source, width, height), q);
    if (blob.size <= maxBytes) return blob;
    if (q > 0.7) q = Math.max(0.68, q - 0.06);
    else edge = Math.round(edge * 0.85);
  }
  return blob;
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to Image() */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não deu para ler a imagem'));
    };
    img.src = url;
  });
}

export async function compressImageFile(file, maxSize = GALLERY_IMAGE_MAX_EDGE, quality = GALLERY_IMAGE_QUALITY) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Escolha uma imagem');
  }
  const bitmap = await loadBitmap(file);
  try {
    return encodeDataUrl(bitmap, maxSize, quality, GALLERY_THUMB_MAX_CHARS * 6);
  } finally {
    bitmap.close?.();
  }
}

export async function prepareGalleryImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Escolha uma imagem');
  }
  const bitmap = await loadBitmap(file);
  try {
    return {
      blob: await encodeBlob(bitmap, GALLERY_IMAGE_MAX_EDGE, GALLERY_IMAGE_QUALITY, GALLERY_IMAGE_MAX_BYTES),
      thumb: encodeDataUrl(bitmap, GALLERY_THUMB_MAX_EDGE, GALLERY_THUMB_QUALITY, GALLERY_THUMB_MAX_CHARS),
    };
  } finally {
    bitmap.close?.();
  }
}
