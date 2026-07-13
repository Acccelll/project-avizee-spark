/**
 * DTOs stub (Etapa 4). Serão detalhados nas etapas 5+.
 */
export interface ResolveEndpointDTO {
  documento: string;
  uf: string;
  ambiente: 1 | 2;
  servico: string;
  versao?: string;
}

export interface RegistrarCertificadoDTO {
  empresaId: string;
  cnpj: string;
  storagePath: string;
  vaultSecretName: string;
  validadeInicio: string;
  validadeFim: string;
  subjectCn?: string;
  serial?: string;
}
