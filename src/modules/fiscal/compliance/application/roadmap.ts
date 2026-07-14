import type { IRoadmapRepository } from './contracts';
import type { RoadmapItem } from '../domain/entities';

/**
 * Roadmap técnico de evolução do Framework Fiscal — pré-popula os próximos
 * documentos/obrigações e relaciona dependências entre eles.
 */
export const ROADMAP_PADRAO: RoadmapItem[] = [
  { chave: 'nfce',    titulo: 'NFC-e',        descricao: 'Nota Fiscal ao Consumidor Eletrônica',         dependencias: ['nfe'],                                     prioridade: 'alto',    status: 'planejado' },
  { chave: 'cte',     titulo: 'CT-e',         descricao: 'Conhecimento de Transporte Eletrônico',         dependencias: ['nfe'],                                     prioridade: 'alto',    status: 'planejado' },
  { chave: 'mdfe',    titulo: 'MDF-e',        descricao: 'Manifesto Eletrônico de Documentos Fiscais',    dependencias: ['nfe', 'cte'],                              prioridade: 'medio',   status: 'planejado' },
  { chave: 'nfse',    titulo: 'NFS-e',        descricao: 'Nota Fiscal de Serviços Eletrônica (padrão nacional)', dependencias: [],                                    prioridade: 'alto',    status: 'planejado' },
  { chave: 'bpe',     titulo: 'BP-e',         descricao: 'Bilhete de Passagem Eletrônico',                dependencias: ['nfe'],                                     prioridade: 'baixo',   status: 'planejado' },
  { chave: 'nf3e',    titulo: 'NF3-e',        descricao: 'Nota Fiscal de Energia Elétrica Eletrônica',    dependencias: ['nfe'],                                     prioridade: 'baixo',   status: 'planejado' },
  { chave: 'sped',    titulo: 'SPED completo',descricao: 'EFD ICMS/IPI, EFD Contribuições, ECF, ECD',     dependencias: ['escrituracao'],                            prioridade: 'critico', status: 'planejado' },
  { chave: 'reinf',   titulo: 'EFD-Reinf',    descricao: 'Retenções e informações fiscais',               dependencias: ['sped'],                                    prioridade: 'alto',    status: 'planejado' },
  { chave: 'esocial', titulo: 'eSocial',      descricao: 'Obrigações trabalhistas e previdenciárias',     dependencias: [],                                          prioridade: 'alto',    status: 'planejado' },
  { chave: 'reforma', titulo: 'Reforma Tributária', descricao: 'IBS, CBS e Imposto Seletivo — período de coexistência', dependencias: ['nfe', 'sped'],           prioridade: 'critico', status: 'planejado' },
];

export class RoadmapService {
  constructor(private readonly repo: IRoadmapRepository) {}

  async seedPadrao() {
    for (const item of ROADMAP_PADRAO) await this.repo.upsert(item);
  }

  atualizar(item: RoadmapItem) { return this.repo.upsert(item); }
  listar() { return this.repo.list(); }
}
