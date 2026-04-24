/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Link,
} from 'npm:@react-email/components@0.0.22'
import { styles, Header, Footer } from './_brand.tsx'

interface Props { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Link de acesso ao {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>Seu link de acesso</Heading>
          <Text style={styles.text}>
            Clique no botão abaixo para entrar no {siteName}. O link expira em alguns minutos.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Entrar</Button>
          </Section>
          <Text style={styles.muted}>Se você não solicitou, ignore este e-mail.</Text>
        </Section>
        <Footer siteName={siteName} />
      </Container>
    </Body>
  </Html>
)
export default MagicLinkEmail
