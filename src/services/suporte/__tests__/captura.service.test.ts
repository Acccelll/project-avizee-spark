import { describe, it, expect, vi, beforeEach } from 'vitest';

const domToBlob = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
vi.mock('modern-screenshot', () => ({ domToBlob }));

import { capturarTelaVisivel } from '../captura.service';

describe('capturarTelaVisivel', () => {
  beforeEach(() => {
    domToBlob.mockClear();
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 290, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
  });

  it('captura só a viewport, deslocada para o trecho rolado', async () => {
    const blob = await capturarTelaVisivel();
    expect(blob?.type).toBe('image/png');

    const [alvo, opts] = domToBlob.mock.calls[0] as unknown as [
      Element,
      { width: number; height: number; onCloneNode: (n: Node) => void },
    ];
    expect(alvo).toBe(document.documentElement);
    expect(opts.width).toBe(1280);
    expect(opts.height).toBe(720);

    const clone = document.createElement('html');
    clone.appendChild(document.createElement('body'));
    opts.onCloneNode(clone);
    expect(clone.style.height).toBe('720px');
    expect(clone.style.overflow).toBe('hidden');
    expect(clone.querySelector('body')!.style.marginTop).toBe('-290px');
  });
});
