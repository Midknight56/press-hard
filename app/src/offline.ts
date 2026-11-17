/**
 * Registers the service worker of the built site, so that the app works offline after the first
 * load. A browser that blocks service workers, or has none, leaves the app working as it is.
 * `path` and `scope` are relative to the page: the worker is at the root of the site.
 */
export function registerWorker(path = '../sw.js', scope = '../'): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () => {
    try {
      navigator.serviceWorker.register(path, { scope }).catch(() => undefined);
    } catch {
      // A blocked worker is not an error for the app.
    }
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}