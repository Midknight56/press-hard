/**
 * The usage beacon. It sends nothing unless the build has `VITE_BEACON_URL`. The body holds the
 * event name and the template id and nothing else: no id, no time, no form content.
 * The privacy page is generated from `BEACON_EVENTS`, so the page and the code share one list.
 */
export const BEACON_EVENTS = [
  { event: 'open', when: 'The app page is opened. The template is other, because no form is chosen yet.' },
  { event: 'form_start', when: 'A form is chosen.' },
  { event: 'sealed', when: 'A record is sealed.' },
  { event: 'tear_off', when: 'A copy file is torn off.' },
  { event: 'verify', when: 'A copy file is checked on the verify page.' },
] as const;

export type BeaconEvent = (typeof BEACON_EVENTS)[number]['event'];

/** The four forms. Any other template id is sent as `other`. */
export const FORM_IDS = ['rental-return', 'key-handover', 'sold-as-seen', 'blank'] as const;

export interface BeaconBody {
  event: BeaconEvent;
  template: string;
}

export function beaconBody(event: BeaconEvent, templateId?: string): BeaconBody {
  const known = (FORM_IDS as readonly string[]).includes(templateId ?? '');
  return { event, template: known ? (templateId as string) : 'other' };
}

export interface BeaconOptions {
  url?: string | undefined;
  fetch?: typeof fetch;
}

export interface Beacon {
  readonly enabled: boolean;
  send(event: BeaconEvent, templateId?: string): void;
}

export function createBeacon(options: BeaconOptions = {}): Beacon {
  const url = options.url?.trim() ?? '';
  const enabled = url !== '';
  return {
    enabled,
    send(event, templateId) {
      if (!enabled) return;
      if (!BEACON_EVENTS.some((e) => e.event === event)) return;
      const send = options.fetch ?? globalThis.fetch;
      try {
        void Promise.resolve(
          send(url, {
            method: 'POST',
            mode: 'no-cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            keepalive: true,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(beaconBody(event, templateId)),
          }),
        ).catch(() => undefined);
      } catch {
        // A failed beacon is never shown and never stops the app.
      }
    },
  };
}

/** The beacon of this build: on only when `VITE_BEACON_URL` was set at build time. */
export function buildBeacon(): Beacon {
  const url = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BEACON_URL;
  return createBeacon({ url });
}
