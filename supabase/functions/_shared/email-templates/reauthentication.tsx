/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { styles, Header, Footer } from './_brand.tsx'

interface Props { token: string; siteName?: string }

export const ReauthenticationEmail = ({ token, siteName = 'AviZee' }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>Código de verificação</Heading>
          <Text style={styles.text}>Use o código abaixo para confirmar sua identidade:</Text>
          <Text style={styles.code}>{token}</Text>
          <Text style={styles.muted}>O código expira em alguns minutos. Se você não solicitou, ignore este e-mail.</Text>
        </Section>
        <Footer siteName={siteName} />
      </Container>
    </Body>
  </Html>
)
export default ReauthenticationEmail
