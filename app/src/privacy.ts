import { BEACON_EVENTS } from './beacon.js';

/**
 * The list of beacon events for the privacy page, as HTML. It is built from the same list that
 * `beacon.ts` checks every send against, and it is put into `site/privacy.html` at build time.
 */
export function privacyEventsHtml(): string {
  const items = BEACON_EVENTS.map((e) => `<li><code>${e.event}</code>: ${e.when}</li>`).join('\n      ');
  return [
    '<ul>',
    `      ${items}`,
    '    </ul>',
    '    <p>The body of each message has two fields: <code>event</code> and <code>template</code>. The <code>template</code> field holds the id of one of the four forms, or <code>other</code> for any other value.</p>',
  ].join('\n');
}
