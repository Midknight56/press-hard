import { verifyRecord, type HandoverRecord } from 'core';
import './form/theme.css';
import './app.css';
import './print.css';
import { appConfig } from '../app.config.js';
import { createAudio } from './audio.js';
import { buildBeacon } from './beacon.js';
import { browserHintStorage, createHints } from './hints.js';
import { prefersReducedMotion } from './motion.js';
import { createNav } from './nav.js';
import { registerWorker } from './offline.js';
import { createCopyScreen } from './screens/copy.js';
import { createFillScreen } from './screens/fill.js';
import { createHelpScreen } from './screens/help.js';
import { createLibraryScreen } from './screens/library.js';
import { attachPress } from './screens/press.js';
import { createPickScreen } from './screens/pick.js';
import { createTamperScreen } from './screens/tamper.js';
import { prepareCopy, tearOff } from './share.js';
import { openStore, type Store } from './store.js';
import { getTemplate, templates, type Template } from './templates/index.js';
import { sampleRecord } from './templates/sample.js';
import { VERDICT_TEXT } from './verify/check.js';

async function start(): Promise<void> {
  const root = document.getElementById('root');
  if (root === null) return;
  document.title = appConfig.title;

  const beacon = buildBeacon();
  beacon.send('open');
  const audio = createAudio();
  audio.unlockOnFirstTap(document);
  const hints = createHints(browserHintStorage());

  let notice: (message: string) => void = () => undefined;
  let pendingNotice: string | null = null;
  const store: Store = await openStore({
    onNotice: (message) => {
      if (pendingNotice === null) pendingNotice = message;
      notice(message);
    },
  });

  let current: { destroy(): void } | null = null;
  const stage = document.createElement('div');
  stage.className = 'stage';

  const nav = createNav({
    page: 'app',
    verifyHref: '../verify/',
    appHref: '../app/',
    audio,
    onHome: () => showPick(),
    onLibrary: () => showLibrary(),
    onHelp: () => showHelp(),
  });
  notice = nav.notice;
  if (pendingNotice !== null) nav.notice(pendingNotice);
  root.append(nav.element, stage);

  function mount(element: HTMLElement, destroy?: () => void): void {
    current?.destroy();
    current = { destroy: destroy ?? (() => undefined) };
    stage.replaceChildren(element);
    const key = element.getAttribute('data-screen') ?? 'screen';
    for (const line of element.querySelectorAll<HTMLElement>('[data-role="instruction"]')) {
      if (!hints.take(key)) line.hidden = true;
    }
    window.scrollTo(0, 0);
  }

  function showPick(): void {
    const screen = createPickScreen({
      onPick: (id) => {
        const template = getTemplate(id);
        if (template !== undefined) showFill(template);
      },
      onSample: () => showFill(templates[0] as Template, structuredClone(sampleRecord), true),
    });
    mount(screen.element);
  }

  function showFill(template: Template, initialRecord?: HandoverRecord, isSample = false): void {
    beacon.send('form_start', template.id);
    const fill = createFillScreen({
      template,
      store,
      draftId: `draft-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      initialRecord,
    });
    const say = (line: string) => {
      const note = fill.element.querySelector('[data-role="note"]');
      if (note !== null) note.textContent = line;
    };
    const press = attachPress({
      source: { stampButton: fill.stampButton, getRecord: fill.getRecord, isLocked: fill.isLocked },
      store,
      now: () => new Date(),
      reducedMotion: prefersReducedMotion(),
      audio,
      onSealed: (record) => {
        beacon.send('sealed', record.form.templateId);
        showCopy(record);
      },
      onProblem: say,
    });
    if (isSample) {
      const badge = document.createElement('p');
      badge.className = 'prefilled-badge';
      badge.setAttribute('data-role', 'prefilled-badge');
      badge.textContent = 'Prefilled';
      fill.element.prepend(badge);
    }
    mount(fill.element, () => {
      press.destroy();
      fill.destroy();
    });
  }

  function showCopy(record: HandoverRecord): void {
    const screen = createCopyScreen({
      record,
      reducedMotion: prefersReducedMotion(),
      onTearOff: () => void doTearOff(record, status),
      onTamper: () => showTamper(record),
      onPrint: () => window.print(),
      onLibrary: () => showLibrary(),
      onNew: () => showPick(),
    });
    const info = document.createElement('div');
    info.className = 'copy-info';
    const size = document.createElement('p');
    size.setAttribute('data-role', 'size');
    size.textContent = `File size: ${prepareCopy(record).sizeLine}`;
    const status = document.createElement('p');
    status.setAttribute('data-role', 'tear-status');
    status.setAttribute('role', 'status');
    const stored = document.createElement('p');
    stored.setAttribute('data-role', 'stored-verdict');
    stored.textContent = `Stored copy: ${VERDICT_TEXT[verifyRecord(record)]}`;
    info.append(stored, size, status);
    screen.element.append(info);
    mount(screen.element);
  }

  async function doTearOff(record: HandoverRecord, status: HTMLElement): Promise<void> {
    try {
      const result = await tearOff(record);
      if (result !== 'cancelled') beacon.send('tear_off', record.form.templateId);
      status.textContent =
        result === 'shared' ? 'Shared.' : result === 'downloaded' ? 'Copy saved to your downloads.' : 'Share cancelled.';
    } catch {
      status.textContent = 'The copy could not be saved.';
    }
  }

  function showLibrary(): void {
    const screen = createLibraryScreen({
      store,
      onBack: () => showPick(),
      onTamper: (seal) => {
        void store.getSealed(seal).then((record) => {
          if (record !== null) showTamper(record);
        });
      },
      onOpen: (seal) => {
        void store.getSealed(seal).then((record) => {
          if (record !== null) showCopy(record);
        });
      },
      onTearOff: (seal) => {
        void store.getSealed(seal).then((record) => {
          if (record === null) return;
          const status = document.createElement('p');
          status.setAttribute('data-role', 'tear-status');
          status.setAttribute('role', 'status');
          screen.element.append(status);
          return doTearOff(record, status);
        });
      },
    });
    mount(screen.element);
  }

  function showTamper(record: HandoverRecord): void {
    mount(createTamperScreen({ record, onBack: () => showCopy(record) }).element);
  }

  function showHelp(): void {
    mount(createHelpScreen().element);
  }

  showPick();
}

registerWorker();
void start();
