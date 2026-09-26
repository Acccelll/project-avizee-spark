/**
 * Captura a área visível da tela como PNG, para anexar ao chamado.
 *
 * Usa modern-screenshot, que desenha pelo próprio motor do navegador
 * (SVG foreignObject). O html2canvas refaz o layout por conta própria e,
 * com a página rolada, desenhava a sidebar fixa e o header sticky
 * deslocados e desalinhava o texto dos cards.
 */
export async function capturarTelaVisivel(): Promise<Blob | null> {
  const { domToBlob } = await import('modern-screenshot');
  const largura = window.innerWidth;
  const altura = window.innerHeight;
  const { scrollX, scrollY } = window;

  return domToBlob(document.documentElement, {
    width: largura,
    height: altura,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    type: 'image/png',
    onCloneNode: (clone) => {
      // O clone não rola: recorta a viewport e desloca o conteúdo para o
      // trecho que o usuário está vendo (elementos fixos ficam no lugar).
      if (!(clone instanceof HTMLElement)) return;
      clone.style.height = `${altura}px`;
      clone.style.overflow = 'hidden';
      const body = clone.querySelector('body');
      if (body) {
        body.style.marginTop = `${-scrollY}px`;
        body.style.marginLeft = `${-scrollX}px`;
      }
    },
  });
}
