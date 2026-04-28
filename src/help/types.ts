/**
 * Tipos do sistema de ajuda. Cada rota da aplicação pode ter um `HelpEntry`
 * com manual estruturado, atalhos e — opcionalmente — um tour guiado que
 * referencia elementos da UI por `data-help-id`.
 */
export interface HelpTourStep {
  /** Selector CSS ou apenas o valor de `data-help-id`. */
  target: string;
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export interface HelpSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface HelpShortcut {
  keys: string;
  desc: string;
}

export interface HelpRelated {
  label: string;
  to: string;
}

export interface HelpEntry {
  /** Caminho canônico (sem query). Match exato ou prefixo mais longo. */
  route: string;
  title: string;
  summary: string;
  sections: HelpSection[];
  shortcuts?: HelpShortcut[];
  related?: HelpRelated[];
  tour?: HelpTourStep[];
  /** Bump quando o conteúdo muda relevantemente — reativa o first-visit toast. */
  version: number;
}