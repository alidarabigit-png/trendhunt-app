/**
 * Shared helpers for talking to the PHP host backend (public/api.php v4.4+).
 *
 * Since v4.4 the host requires the admin key in the X-Admin-Key header for
 * admin-guarded actions: get/save settings, save products, save rates,
 * image uploads, cache_catalog_images, telegram verify/broadcast and
 * competitor analysis.
 *
 * The key is entered once via the admin-mode prompt and kept in
 * sessionStorage under 'nfs_admin_key' (see App.tsx admin-mode effect).
 * Sending the header to the local Express dev server is harmless — it
 * simply ignores it.
 */

export const isPhpHost = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname.includes('nafisstore.com') ||
    window.location.pathname.includes('.php'));

export const getAdminKey = (): string | null => {
  try {
    return typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('nfs_admin_key')
      : null;
  } catch (e) {
    return null;
  }
};

/** Returns the given headers merged with X-Admin-Key when a key is available. */
export const withAdminKey = (headers: HeadersInit = {}): HeadersInit => {
  const key = getAdminKey();
  if (!key) return headers;
  const merged = new Headers(headers);
  merged.set('X-Admin-Key', key);
  return merged;
};
