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

/**
 * Template transacional: NF-e autorizada — envia o link do DANFE/XML para
 * o destinatário. Usado pelo botão "Enviar por e-mail" no painel SEFAZ.
 */

const SITE_NAME = 'AviZee'

const brand = {
  primary: '#690500',
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

interface NfeAutorizadaProps {
  numero?: string
  serie?: string
  clienteNome?: string
  chaveAcesso?: string
  protocolo?: string
  valorTotal?: string
  dataEmissao?: string
  linkDanfe?: string
  linkXml?: string
  mensagem?: string
}

function formatarChave(chave: string): string {
  return chave.replace(/\D/g, '').match(/.{1,4}/g)?.join(' ') ?? chave
}

const NfeAutorizadaEmail = ({
  numero = '0000',
  serie = '1',
  clienteNome,
  chaveAcesso,
  protocolo,
  valorTotal,
  dataEmissao,
  linkDanfe = '#',
  linkXml,
  mensagem,
}: NfeAutorizadaProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>NF-e {numero} autorizada — DANFE disponível</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Img src={brand.logoUrl} alt={SITE_NAME} style={styles.logo} />
        </Section>

        <Section style={styles.body}>
          <Heading style={styles.h1}>
            NF-e Nº {numero} / Série {serie}
          </Heading>

          <Text style={styles.text}>
            {clienteNome ? `Olá, ${clienteNome}.` : 'Olá,'}
          </Text>

          <Text style={styles.text}>
            {mensagem ||
              'Sua nota fiscal eletrônica foi autorizada pela SEFAZ. Você pode baixar o DANFE em PDF e o XML pelos links abaixo.'}
          </Text>

          <Section style={styles.infoBox}>
            {dataEmissao && (
              <Text style={styles.infoLine}>
                <strong>Emissão:</strong> {dataEmissao}
              </Text>
            )}
            {valorTotal && (
              <Text style={styles.infoLine}>
                <strong>Valor total:</strong> {valorTotal}
              </Text>
            )}
            {protocolo && (
              <Text style={styles.infoLine}>
                <strong>Protocolo:</strong> {protocolo}
              </Text>
            )}
            {chaveAcesso && (
              <Text style={{ ...styles.infoLine, fontFamily: 'monospace', fontSize: '12px' }}>
                <strong>Chave:</strong> {formatarChave(chaveAcesso)}
              </Text>
            )}
          </Section>

          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={linkDanfe}>
              Baixar DANFE (PDF)
            </Button>
          </Section>

          {linkXml && (
            <Text style={{ ...styles.text, textAlign: 'center' }}>
              Ou{' '}
              <Link href={linkXml} style={styles.link}>
                baixe o XML autorizado
              </Link>
              .
            </Text>
          )}

          <Hr style={styles.hr} />
          <Text style={styles.muted}>
            Em caso de dúvidas, basta responder este e-mail.
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
  component: NfeAutorizadaEmail,
  subject: (data: Record<string, any>) =>
    `NF-e ${data?.numero ?? ''} autorizada — ${SITE_NAME}`.trim(),
  displayName: 'NF-e autorizada',
  previewData: {
    numero: '310',
    serie: '100',
    clienteNome: 'Avivar Alimentos SA',
    chaveAcesso: '35260353078538000185551000000003101300002135',
    protocolo: '135261058121382',
    valorTotal: 'R$ 999,50',
    dataEmissao: '19/03/2026',
    linkDanfe: 'https://exemplo.com/danfe.pdf',
    linkXml: 'https://exemplo.com/nfe.xml',
  },
} satisfies TemplateEntry

const styles = {
  main: { backgroundColor: '#ffffff', fontFamily: brand.fontFamily, margin: 0, padding: '40px 0' },
  container: {
    backgroundColor: brand.card,
    borderRadius: brand.radius,
    border: `1px solid ${brand.border}`,
    maxWidth: '560px',
    margin: '0 auto',
    overflow: 'hidden' as const,
  },
  header: { backgroundColor: brand.primary, padding: '24px 32px', textAlign: 'center' as const },
  logo: { margin: '0 auto', height: '96px', width: 'auto' },
  body: { padding: '32px' },
  h1: { fontSize: '22px', fontWeight: 700 as const, color: brand.text, margin: '0 0 16px', lineHeight: 1.3 },
  text: { fontSize: '15px', color: brand.text, lineHeight: 1.6, margin: '0 0 16px' },
  muted: { fontSize: '13px', color: brand.muted, lineHeight: 1.5, margin: '0 0 8px' },
  infoBox: {
    backgroundColor: brand.bg,
    borderRadius: brand.radius,
    padding: '16px 20px',
    margin: '16px 0 24px',
  },
  infoLine: { fontSize: '14px', color: brand.text, margin: '4px 0', lineHeight: 1.5 },
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
  link: { color: brand.primary, textDecoration: 'underline', wordBreak: 'break-all' as const },
  hr: { borderColor: brand.border, margin: '24px 0 16px' },
  footer: {
    fontSize: '12px',
    color: brand.muted,
    textAlign: 'center' as const,
    lineHeight: 1.5,
    padding: '16px 32px 24px',
  },
}