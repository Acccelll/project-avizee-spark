/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Hr, Img, Section, Text, Link } from 'npm:@react-email/components@0.0.22'

export const brand = {
  primary: '#690500',
  primaryDark: '#4a0300',
  secondary: '#b2592c',
  bg: '#FFF8E5',
  card: '#ffffff',
  text: '#1a1815',
  muted: '#5a5852',
  border: '#ecdfc4',
  radius: '8px',
  logoUrl: 'https://cpvdncsxzostovdduhci.supabase.co/storage/v1/object/public/email-assets/logo.png',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

export const styles = {
  main: {
    backgroundColor: brand.bg,
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
  logo: {
    margin: '0 auto',
    height: '64px',
    width: 'auto',
  },
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
    margin: '0 0 20px',
  },
  muted: {
    fontSize: '13px',
    color: brand.muted,
    lineHeight: 1.5,
    margin: '0 0 8px',
  },
  buttonWrap: { textAlign: 'center' as const, margin: '28px 0' },
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
  hr: { borderColor: brand.border, margin: '32px 0 20px' },
  footer: {
    fontSize: '12px',
    color: brand.muted,
    textAlign: 'center' as const,
    lineHeight: 1.5,
    padding: '16px 32px 24px',
  },
  code: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '28px',
    fontWeight: 700 as const,
    letterSpacing: '6px',
    color: brand.primary,
    backgroundColor: brand.bg,
    padding: '16px 20px',
    borderRadius: brand.radius,
    textAlign: 'center' as const,
    margin: '0 0 24px',
  },
}

export const Header = () => (
  <Section style={styles.header}>
    <Img src={brand.logoUrl} alt="AviZee" style={styles.logo} />
  </Section>
)

export const Footer = ({ siteName }: { siteName: string }) => (
  <>
    <Hr style={styles.hr} />
    <Text style={styles.footer}>
      © {new Date().getFullYear()} {siteName} — AviZee Equipamentos LTDA
      <br />
      Este é um e-mail automático. Em caso de dúvida, fale com seu administrador.
    </Text>
  </>
)
