/** True when the system asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}