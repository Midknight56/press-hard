import '../fonts.css';
import '../form/theme.css';
import '../app.css';
import '../look.css';
import { appConfig } from '../../app.config.js';
import { buildBeacon } from '../beacon.js';
import { createNav } from '../nav.js';
import { registerWorker } from '../offline.js';
import { browserHintStorage, createHints } from '../hints.js';
import { createVerifyPage } from './page.js';

registerWorker();
const root = document.getElementById('root');
if (root !== null) {
  document.title = `Check a copy, ${appConfig.title}`;
  const nav = createNav({ page: 'verify', verifyHref: '../verify/', appHref: '../app/' });
  const beacon = buildBeacon();
  const page = createVerifyPage({ onChecked: (templateId) => beacon.send('verify', templateId) });
  const hints = createHints(browserHintStorage());
  for (const line of page.element.querySelectorAll<HTMLElement>('[data-role="instruction"]')) {
    if (!hints.take('verify')) line.hidden = true;
  }
  root.append(nav.element, page.element);
}
