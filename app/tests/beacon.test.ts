import { describe, expect, it, vi } from 'vitest';
import { BEACON_EVENTS, beaconBody, createBeacon, FORM_IDS } from '../src/beacon.js';
import { templates } from '../src/templates/index.js';

const URL_SET = 'https://beacon.example.test/in';

function setup(url: string | undefined) {
  const fetcher = vi.fn<(input: string, init: RequestInit) => Promise<unknown>>(() => Promise.resolve({}));
  return { fetcher, beacon: createBeacon({ url, fetch: fetcher as unknown as typeof fetch }) };
}

describe('beacon list', () => {
  it('has exactly the five events of the privacy page', () => {
    expect(BEACON_EVENTS.map((e) => e.event)).toEqual(['open', 'form_start', 'sealed', 'tear_off', 'verify']);
    for (const e of BEACON_EVENTS) expect(e.when.length).toBeGreaterThan(5);
  });

  it('lists the four forms of the templates', () => {
    expect([...FORM_IDS]).toEqual(templates.map((t) => t.id));
  });
});

describe('beaconBody', () => {
  it('has only the event and the template id', () => {
    expect(beaconBody('sealed', 'rental-return')).toEqual({ event: 'sealed', template: 'rental-return' });
    expect(Object.keys(beaconBody('open', 'blank'))).toEqual(['event', 'template']);
  });

  it('sends every form of the list as it is', () => {
    for (const id of FORM_IDS) expect(beaconBody('form_start', id).template).toBe(id);
  });

  it('sends other for a template id that is not one of the four forms', () => {
    for (const id of ['my-secret-form', '', 'Rental-Return', 'rental-return ', undefined, 'constructor', '__proto__']) {
      expect(beaconBody('sealed', id).template, String(id)).toBe('other');
    }
  });
});

describe('createBeacon without VITE_BEACON_URL', () => {
  it.each([undefined, '', '   '])('sends nothing when the url is %j', (url) => {
    const { fetcher, beacon } = setup(url);
    expect(beacon.enabled).toBe(false);
    for (const e of BEACON_EVENTS) beacon.send(e.event, 'rental-return');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('createBeacon with VITE_BEACON_URL', () => {
  it('sends one POST for each event with only the event and the template in the body', () => {
    const { fetcher, beacon } = setup(URL_SET);
    expect(beacon.enabled).toBe(true);
    beacon.send('sealed', 'key-handover');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL_SET);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ event: 'sealed', template: 'key-handover' });
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(Object.keys(init).sort()).toEqual(['body', 'credentials', 'headers', 'keepalive', 'method', 'mode', 'referrerPolicy']);
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain;charset=UTF-8' });
  });

  it('sends other for an unknown template id', () => {
    const { fetcher, beacon } = setup(URL_SET);
    beacon.send('form_start', 'a-form-with-a-private-name');
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ event: 'form_start', template: 'other' });
  });

  it('sends nothing for an event that is not in the list', () => {
    const { fetcher, beacon } = setup(URL_SET);
    beacon.send('page_view' as never, 'blank');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never throws and never rejects when the server fails', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('offline')));
    const beacon = createBeacon({ url: URL_SET, fetch: failing as unknown as typeof fetch });
    expect(() => beacon.send('open')).not.toThrow();
    const throwing = vi.fn(() => {
      throw new Error('blocked');
    });
    expect(() => createBeacon({ url: URL_SET, fetch: throwing as unknown as typeof fetch }).send('open')).not.toThrow();
    await Promise.resolve();
  });
});
