/**
 * Upgrade image quality by stripping Alibaba / 1688 thumbnail suffixes.
 * (Directly adapted from Kalayab Chrome extension content.js)
 */
export function upgradeAlibabaImageQuality(raw: string): string {
  if (!raw) return '';
  let v = String(raw).trim();
  if (v.startsWith('//')) v = 'https:' + v;
  v = v.replace(/\?x-oss-process=[^&]+/gi, '');
  v = v.replace(/(\.(?:jpe?g|png|webp))_\d+x\d+(?:q\d+|s\d+)?\.(?:jpe?g|png|webp)$/i, '$1');
  v = v.replace(/(\.(?:jpe?g|png|webp))_\.(?:jpe?g|png|webp)$/i, '$1');
  v = v.replace(/(\.(?:jpe?g|png|webp))\.thumb\.(?:jpe?g|png|webp)$/i, '$1');
  v = v.replace(/_\d+x\d+(?:q\d+|s\d+)?(\.(?:jpe?g|png|webp))$/i, '$1');
  return v;
}
