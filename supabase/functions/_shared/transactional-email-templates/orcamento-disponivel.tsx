/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'AviZee'

const brand = {
  primary: '#690500',
  secondary: '#b2592c',
  bg: '#FFF8E5',
  card: '#ffffff',
  text: '#1a1815',
  muted: '#5a5852',
  border: '#ecdfc4',
  radius: '8px',
  logoUrl:
    'https://cpvdncsxzostovdduhci.supabase.co/storage/v1/object/public/email-assets/logo.png',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

interface OrcamentoDisponivelProps {
  numeroOrcamento?: string
  clienteNome?: string
  validade?: string
  valorTotal?: string
  mensagem?: string
  linkPublico?: string
  linkPdf?: string
  vendedorNome?: string
}

const OrcamentoDisponivelEmail = ({
  numeroOrcamento = '0000',
  clienteNome,
  validade,
  valorTotal,
  mensagem,
  linkPublico = '#',
  linkPdf,
  vendedorNome,
}: OrcamentoDisponivelProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      Orçamento {numeroOrcamento} disponível para visualização
    </Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Img src={brand.logoUrl} alt={SITE_NAME} style={styles.logo} />
        </Section>

        <Section style={styles.body}>
          <Heading style={styles.h1}>
            Orçamento Nº {numeroOrcamento}
          </Heading>

          <Text style={styles.text}>
            {clienteNome ? `Olá, ${clienteNome}.` : 'Olá,'}
          </Text>

          <Text style={styles.text}>
            {mensagem ||
              'Segue o orçamento solicitado para sua apreciação. Você pode visualizá-lo online clicando no botão abaixo ou baixar o PDF anexo ao link.'}
          </Text>

          {(valorTotal || validade) && (
            <Section style={styles.infoBox}>
              {valorTotal && (
                <Text style={styles.infoLine}>
                  <strong>Valor total:</strong> {valorTotal}
                </Text>
              )}
              {validade && (
                <Text style={styles.infoLine}>
                  <strong>Validade:</strong> {validade}
                </Text>
              )}
            </Section>
          )}

          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={linkPublico}>
              Visualizar orçamento online
            </Button>
          </Section>

          {linkPdf && (
            <Text style={{ ...styles.text, textAlign: 'center' }}>
              Ou{' '}
              <Link href={linkPdf} style={styles.link}>
                baixe o PDF do orçamento
              </Link>
              .
            </Text>
          )}

          <Hr style={styles.hr} />

          <Text style={styles.muted}>
            Em caso de dúvidas, basta responder este e-mail.
            {vendedorNome ? ` Atenciosamente, ${vendedorNome}.` : ''}
          </Text>
        </Section>

        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          © {new Date().getFullYear()} {SITE_NAME} — AviZee Equipamentos LTDA
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrcamentoDisponivelEmail,
  subject: (data: Record<string, any>) =>
    `Orçamento ${data?.numeroOrcamento ?? ''} — ${SITE_NAME}`.trim(),
  displayName: 'Orçamento disponível',
  previewData: {
    numeroOrcamento: '1042',
    clienteNome: 'João Silva',
    validade: '30/04/2026',
    valorTotal: 'R$ 12.450,00',
    mensagem:
      'Conforme conversado, segue o orçamento solicitado para sua avaliação.',
    linkPublico: 'https://sistema.avizee.com.br/orcamento-publico?token=demo',
    linkPdf: 'https://exemplo.com/orcamento.pdf',
    vendedorNome: 'Equipe Comercial AviZee',
  },
} satisfies TemplateEntry

const styles = {
  main: {
    backgroundColor: '#ffffff',
    fontFamily: brand.fontFamily,
    margin: 0,
    padding: '40px 0',
  },
  container: {
    backgroundColor: brand.card,
    borderRadius: brand.radius,
    border: `1px solid ${brand.border}`,
    maxWidth: '560px',
    margin: '0 auto',
    overflow: 'hidden' as const,
  },
  header: {
    backgroundColor: brand.primary,
    padding: '24px 32px',
    textAlign: 'center' as const,
  },
  logo: { margin: '0 auto', height: '96px', width: 'auto' },
  body: { padding: '32px' },
  h1: {
    fontSize: '22px',
    fontWeight: 700 as const,
    color: brand.text,
    margin: '0 0 16px',
    lineHeight: 1.3,
  },
  text: {
    fontSize: '15px',
    color: brand.text,
    lineHeight: 1.6,
    margin: '0 0 16px',
  },
  muted: {
    fontSize: '13px',
    color: brand.muted,
    lineHeight: 1.5,
    margin: '0 0 8px',
  },
  infoBox: {
    backgroundColor: brand.bg,
    borderRadius: brand.radius,
    padding: '16px 20px',
    margin: '16px 0 24px',
  },
  infoLine: {
    fontSize: '14px',
    color: brand.text,
    margin: '4px 0',
    lineHeight: 1.5,
  },
  buttonWrap: { textAlign: 'center' as const, margin: '24px 0' },
  button: {
    backgroundColor: brand.primary,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: brand.radius,
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block' as const,
  },
  link: {
    color: brand.primary,
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
  },
  hr: { borderColor: brand.border, margin: '24px 0 16px' },
  footer: {
    fontSize: '12px',
    color: brand.muted,
    textAlign: 'center' as const,
    lineHeight: 1.5,
    padding: '16px 32px 24px',
  },
}