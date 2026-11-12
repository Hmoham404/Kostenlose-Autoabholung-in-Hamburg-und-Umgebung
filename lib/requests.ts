
const allowed = ['image/jpeg', 'image/png', 'image/webp'];

/** Decode, resize and re-encode: no original photo or EXIF metadata is uploaded. */
export async function compressImage(file: File): Promise<File> {
  if (!allowed.includes(file.type) || file.size > 15 * 1024 * 1024) throw new Error('PHOTO_FORMAT');
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PHOTO_PROCESSING');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('PHOTO_PROCESSING')), 'image/webp', .78
    ));
    if (blob.size > 2 * 1024 * 1024) throw new Error('PHOTO_TOO_LARGE');
    return new File([blob], `${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type });
  } finally { bitmap.close(); }
}

export async function submitRequest(payload: Record<string, unknown>, files: File[]): Promise<string> {
  if (payload.website || payload.consent !== true || files.length > 6) throw new Error('INVALID_REQUEST');
  for (const field of ['make','model','year','wheels','condition','name','email','phone','postal','city','address']) {
    if (typeof payload[field] !== 'string' || !String(payload[field]).trim()) throw new Error('INVALID_REQUEST');
  }
  const body = new FormData();
  const { website: _website, captchaToken: _captcha, ...clean } = payload;
  body.set('payload', JSON.stringify(clean));
  for (const source of files) body.append('photos', await compressImage(source));
  const response = await fetch('/api/requests/', { method: 'POST', body });
  if (!response.ok) throw new Error('SAVE_FAILED');
  const result = await response.json();
  return result.id as string;
}
