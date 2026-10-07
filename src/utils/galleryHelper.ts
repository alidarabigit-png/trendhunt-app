/**
 * Product-Specific Image Gallery Manager
 * Strict Rule: Never inject irrelevant or filler stock photos.
 * Only return the authentic primary image and any user-specified images.
 */

export function buildRichGallery(
  mainImage: string,
  existingImages: string[] = [],
  category: string = '',
  title: string = ''
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  if (mainImage && mainImage.startsWith('http')) {
    result.push(mainImage.trim());
    seen.add(mainImage.trim());
  }

  // Only keep valid URLs that don't match known stock photo fillers
  for (const img of existingImages) {
    if (img && img.startsWith('http') && !seen.has(img.trim())) {
      result.push(img.trim());
      seen.add(img.trim());
    }
  }

  return result.length > 0 ? result : [mainImage || ''];
}
