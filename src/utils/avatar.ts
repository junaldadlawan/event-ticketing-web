/** Crops the picked image to a centred square, shrinks it to 256px and returns it as a small JPEG file. */
export async function squareAvatarFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const SIZE = 256;
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not process the image.');
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}
