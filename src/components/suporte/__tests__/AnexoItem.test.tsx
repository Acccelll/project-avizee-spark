import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/suporte/anexos.service', () => ({
  getAnexoUrl: vi.fn(async (p: string) => `https://signed.example/${p}`),
}));

import { AnexoItem } from '../AnexoItem';
import type { SuporteAnexo } from '@/services/suporte/types';

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ul>{ui}</ul></QueryClientProvider>);
}

const base = {
  id: 'a1', chamado_id: 'c1', evento_id: null, tamanho: 10, is_screenshot: false,
  uploaded_by: 'u1', created_at: '2026-09-24T00:00:00Z',
} as unknown as SuporteAnexo;

describe('AnexoItem', () => {
  it('renderiza miniatura da imagem via URL assinada', async () => {
    wrap(<AnexoItem anexo={{ ...base, nome_arquivo: 'tela.png', tipo_arquivo: 'image/png', caminho_storage: 'c1/a1-tela.png' }} />);
    const img = await screen.findByAltText('tela.png');
    expect(img.getAttribute('src')).toBe('https://signed.example/c1/a1-tela.png');
  });

  it('renderiza link para arquivos não-imagem', async () => {
    wrap(<AnexoItem anexo={{ ...base, nome_arquivo: 'nota.pdf', tipo_arquivo: 'application/pdf', caminho_storage: 'c1/a1-nota.pdf' }} />);
    const link = await screen.findByRole('link', { name: 'nota.pdf' });
    expect(link.getAttribute('href')).toBe('https://signed.example/c1/a1-nota.pdf');
  });
});
