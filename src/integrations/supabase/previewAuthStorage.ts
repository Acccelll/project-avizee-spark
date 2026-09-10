import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Bridge de storage do Supabase Auth para previews embutidos no Lovable.
 *
 * Fora de iframe usa o localStorage normal. Dentro do preview, sincroniza
 * tokens com o shell do editor via postMessage para que refreshes/reloads do
 * iframe não percam a sessão autenticada.
 */
export function createPreviewAuthStorage(projectId: string): SupportedStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }

  const local = window.localStorage;
  if (window.parent === window) return local;

  const ancestor = window.location.ancestorOrigins?.[0] || '';
  const dev = import.meta.env.DEV;
  const allowedAncestor = ancestor === 'https://lovable.dev' || (dev && ancestor === 'http://localhost:3000');
  if (!allowedAncestor) return local;

  const editorOrigins = ancestor
    ? [ancestor]
    : (dev ? ['https://lovable.dev', 'http://localhost:3000'] : ['https://lovable.dev']);
  const RESULT = 'lovable-preview-auth:result';
  const TIMEOUT = 2000;
  const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const request = (type: string, key: string, value?: string): Promise<{ ok: boolean; value?: string | null } | null> =>
    new Promise((resolve) => {
      const requestId = newId();
      let done = false;
      const finish = (r: { ok: boolean; value?: string | null } | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(r);
      };
      const onMessage = (e: MessageEvent) => {
        if (editorOrigins.indexOf(e.origin) < 0) return;
        const d = e.data;
        if (d && d.type === RESULT && d.requestId === requestId) finish(d);
      };
      window.addEventListener('message', onMessage);
      const msg: Record<string, unknown> = { type, requestId, projectId, key };
      if (value !== undefined) msg['value'] = value;
      // targetOrigin per trusted editor origin, so a session token never reaches an arbitrary embedder.
      for (const origin of editorOrigins) window.parent.postMessage(msg, origin);
      const timer = setTimeout(() => finish(null), TIMEOUT);
    });

  // The editor may not be listening yet at the first getItem, so retry once.
  let firstGet = true;
  const RETRY_DELAY = 250;

  return {
    getItem: async (key: string) => {
      let res = await request('lovable-preview-auth:get', key);
      if (!res && firstGet) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        res = await request('lovable-preview-auth:get', key);
      }
      firstGet = false;
      // '' is the logout tombstone: clear the local copy too so it can't resurrect if
      // the broker later goes silent. A null reply means never-synced -> keep local.
      if (res && res.ok && typeof res.value === 'string') {
        if (res.value === '') { localStorage.removeItem(key); return null; }
        return res.value;
      }
      return localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      void request('lovable-preview-auth:set', key, value);
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      void request('lovable-preview-auth:remove', key);
    },
  };
}
