// Photos are shrunk on the phone before anything else happens: about 1280 px on the longest
// side, JPEG, 200 KB or less. Re-drawing on a canvas also drops EXIF, including location.
// The original never leaves the device.

export async function compressImage(file: Blob, maxDim = 1280, targetBytes = 200 * 1024): Promise<{ bytes: Uint8Array<ArrayBuffer>; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    let quality = 0.78;
    let blob: Blob | null = null;
    for (let i = 0; i < 6; i++) {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (!blob) throw new Error('Could not encode the photo');
      if (blob.size <= targetBytes) break;
      quality = Math.max(0.3, quality - 0.1);
    }
    return { bytes: new Uint8Array(await blob!.arrayBuffer()), w, h };
  } finally {
    bitmap.close();
  }
}
