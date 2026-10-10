import type { CSSProperties } from 'react';
import { desenhar } from '@/lib/apresentacao/fechamento/graficos';
import { COR, FONTE } from '@/lib/apresentacao/fechamento/tema';
import type { Deck, Slide } from '@/lib/apresentacao/fechamento/tipos';
import { DesenhoSvg } from './DesenhoSvg';

/**
 * Um slide do deck em 16:9, com a mesma geometria do .pptx (posições em % da
 * largura e da altura; fontes em `cqi`, 1pt = 0,104cqi).
 */
const LOGO_URL = '/images/logoavizee.png';
const pt = (n: number) => `${(n * 100) / 960}cqi`;
const pW = (inches: number) => `${(inches / 13.333) * 100}%`;
const pH = (inches: number) => `${(inches / 7.5) * 100}%`;
const c = (h: string) => `#${h}`;

const caixa = (x: number, y: number, w: number, h: number): CSSProperties => ({ position: 'absolute', left: pW(x), top: pH(y), width: pW(w), height: pH(h) });

function separarTitulo(t: string): [string, string] {
  const i = t.indexOf('. ');
  return i > 0 && i < 48 ? [t.slice(0, i + 1), t.slice(i + 1)] : ['', t];
}

function Corpo({ slide }: { slide: Slide }) {
  const v = slide.visual;
  const temCom = slide.comentarios.length > 0 && v.tipo !== 'lista';
  const largura = temCom ? 7.95 : 12.133;
  if (v.tipo === 'lista') {
    return (
      <ol style={{ ...caixa(0.7, 2.05, 11.9, 4.55), margin: 0, padding: 0, listStyle: 'none', fontSize: pt(20), lineHeight: 1.35, color: c(COR.tinta), display: 'flex', flexDirection: 'column', gap: pt(18) }}>
        {v.itens.map((t, i) => {
          const [tit, resto] = separarTitulo(t);
          return (
            <li key={i}>
              <b style={{ color: c(COR.terracota), marginRight: pt(12) }}>{i + 1}</b>
              {tit && <b style={{ color: c(COR.vinho) }}>{tit}</b>}
              {resto}
            </li>
          );
        })}
      </ol>
    );
  }
  if (v.tipo === 'tabela') {
    const n = v.cabecalho.length;
    const celula = (i: number): CSSProperties => ({ textAlign: i === 0 ? 'left' : 'right', padding: `${pt(5)} ${pt(6)}`, borderBottom: `1px solid ${c(COR.linha)}` });
    return (
      <div style={caixa(0.6, 2.25, largura, 4.3)}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: pt(14), color: c(COR.tinta), fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>{v.cabecalho.map((h, i) => <th key={i} style={{ ...celula(i), color: c(COR.apagado), fontSize: pt(11), fontWeight: 700 }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {v.linhas.map((l, j) => (
              <tr key={j}>{l.map((t, i) => <td key={i} style={{ ...celula(i), fontWeight: i === n - 1 && n > 4 ? 700 : 400 }}>{t}</td>)}</tr>
            ))}
            {v.total && (
              <tr>{v.total.map((t, i) => <td key={i} style={{ ...celula(i), borderTop: `1.5px solid ${c(COR.tinta)}`, borderBottom: 'none', fontWeight: 700, color: c(COR.vinho) }}>{t}</td>)}</tr>
            )}
          </tbody>
        </table>
        {v.nota && <p style={{ margin: `${pt(8)} 0 0`, fontSize: pt(11), color: c(COR.apagado) }}>{v.nota}</p>}
      </div>
    );
  }
  const d = desenhar(v);
  if (!d) return null;
  return (
    <div style={caixa(0.6, 2.05, largura, 4.55)}>
      <DesenhoSvg desenho={d} className="h-full w-full" />
    </div>
  );
}

function Capa({ slide, deck }: { slide: Slide; deck: Deck }) {
  const v = slide.visual;
  if (v.tipo !== 'capa') return null;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: c(COR.creme) }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pW(0.22), background: c(COR.terracota) }} />
      <img src={LOGO_URL} alt="AviZee" style={{ position: 'absolute', left: pW(0.95), top: pH(0.8), height: pH(0.85) }} />
      <div style={{ ...caixa(0.95, 3.0, 11, 0.4), fontSize: pt(14), fontWeight: 700, letterSpacing: '0.16em', color: c(COR.terracota) }}>{v.eyebrow.toUpperCase()}</div>
      <div style={{ ...caixa(0.95, 3.35, 11.5, 1.2), fontSize: pt(54), fontWeight: 700, color: c(COR.vinho), lineHeight: 1.05 }}>{v.titulo}</div>
      <div style={{ ...caixa(0.95, 4.55, 11, 0.5), fontSize: pt(20), color: c(COR.apagado) }}>{v.subtitulo}</div>
      <div style={{ position: 'absolute', left: pW(0.95), right: pW(0.6), top: pH(6.85), borderTop: `1px solid ${c(COR.regra)}` }} />
      <div style={{ ...caixa(0.95, 6.97, 8, 0.3), fontSize: pt(11), color: c(COR.apagado) }}>{v.rodape}</div>
      <div style={{ ...caixa(11.733, 6.97, 1, 0.3), fontSize: pt(11), color: c(COR.apagado), textAlign: 'right' }}>01</div>
      <span className="sr-only">{deck.rodape}</span>
    </>
  );
}

export function SlideView({ deck, slide, numero, className }: { deck: Deck; slide: Slide; numero: number; className?: string }) {
  const base: CSSProperties = {
    containerType: 'inline-size',
    aspectRatio: '16 / 9',
    position: 'relative',
    overflow: 'hidden',
    background: '#fff',
    fontFamily: `${FONTE}, sans-serif`,
  };
  if (slide.visual.tipo === 'capa') {
    return <div className={className} style={base}><Capa slide={slide} deck={deck} /></div>;
  }
  const comentarios = slide.visual.tipo !== 'lista' ? slide.comentarios : [];
  return (
    <div className={className} style={base}>
      <div style={{ ...caixa(0.6, 0.42, 10, 0.3), fontSize: pt(12), fontWeight: 700, letterSpacing: '0.14em', color: c(COR.terracota) }}>{slide.rotulo.toUpperCase()}</div>
      <div style={{ ...caixa(11.733, 0.42, 1, 0.3), fontSize: pt(12), color: c(COR.apagado), textAlign: 'right' }}>{String(numero).padStart(2, '0')}</div>
      <div style={{ ...caixa(0.6, 0.8, 12.133, 1.1), fontSize: pt(slide.mensagem.length > 70 ? 24 : 28), fontWeight: 700, color: c(COR.vinho), lineHeight: 1.15 }}>{slide.mensagem}</div>
      <Corpo slide={slide} />
      {comentarios.length > 0 && (
        <>
          <div style={{ position: 'absolute', left: pW(8.75), top: pH(2.2), height: pH(4.25), borderLeft: `0.25cqi solid ${c(COR.linha)}` }} />
          <ul style={{ ...caixa(9.05, 2.05, 3.683, 4.55), margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: pt(14), fontSize: pt(15), lineHeight: 1.3, color: c(COR.tinta) }}>
            {comentarios.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </>
      )}
      <div style={{ position: 'absolute', left: pW(0.6), right: pW(0.6), top: pH(6.92), borderTop: `1px solid ${c(COR.linha)}` }} />
      <img src={LOGO_URL} alt="" style={{ position: 'absolute', left: pW(0.6), top: pH(7.03), height: pH(0.24) }} />
      <div style={{ ...caixa(1.6, 7.02, 4.5, 0.26), fontSize: pt(10), color: c(COR.apagado) }}>{deck.rodape}</div>
      {slide.fonte && <div style={{ ...caixa(5.733, 7.02, 7, 0.26), fontSize: pt(10), color: c(COR.apagado), textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slide.fonte}</div>}
    </div>
  );
}
