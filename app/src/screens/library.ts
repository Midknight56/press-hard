import { sealWords } from 'core';
import type { Store } from '../store.js';

export interface LibraryOptions {
  store: Store;
  onOpen(seal: string): void;
  onTearOff(seal: string): void;
  onBack(): void;
}

function button(control: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('data-control', control);
  b.addEventListener('click', onClick);
  return b;
}

/**
 * The list of sealed records. The only actions are view, tear off again and delete with a
 * confirmation box. Nothing here changes a sealed record.
 */
export function createLibraryScreen(options: LibraryOptions): {
  element: HTMLElement;
  ready: Promise<void>;
  refresh(): Promise<void>;
} {
  const { store } = options;
  const element = document.createElement('main');
  element.className = 'screen library';
  element.setAttribute('data-screen', 'library');

  const list = document.createElement('div');
  list.className = 'library-list';
  const dialogHolder = document.createElement('div');
  element.append(button('back', 'Back', options.onBack), list, dialogHolder);

  function askDelete(seal: string, words: string): void {
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.className = 'confirm';
    const text = document.createElement('p');
    text.textContent = `Delete ${words} from this device?`;
    const close = () => {
      box.remove();
    };
    const cancel = button('cancel-delete', 'Keep it', close);
    const confirm = button('confirm-delete', 'Delete', () => {
      close();
      void store.deleteSealed(seal).then(refresh);
    });
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    box.append(text, cancel, confirm);
    dialogHolder.replaceChildren(box);
    cancel.focus();
  }

  async function refresh(): Promise<void> {
    const entries = await store.listSealed();
    list.replaceChildren();
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.setAttribute('data-role', 'empty');
      empty.textContent = 'No sealed records yet.';
      list.append(empty);
      return;
    }
    for (const entry of entries) {
      const key = entry.seal.slice(0, 8);
      const words = sealWords(entry.seal);
      const row = document.createElement('article');
      row.className = 'record';
      row.setAttribute('data-role', 'record');
      const info = document.createElement('p');
      info.textContent = `${entry.title}, ${entry.sealedAt.slice(0, 10)}, ${words}`;
      row.append(
        info,
        button(`open-${key}`, 'View', () => options.onOpen(entry.seal)),
        button(`tear-off-${key}`, 'Tear off', () => options.onTearOff(entry.seal)),
        button(`delete-${key}`, 'Delete', () => askDelete(entry.seal, words)),
      );
      list.append(row);
    }
  }

  return { element, ready: refresh(), refresh };
}