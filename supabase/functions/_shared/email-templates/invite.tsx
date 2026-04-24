/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Link,
} from 'npm:@react-email/components@0.0.22'
import { styles, Header, Footer } from './_brand.tsx'

interface Props { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Convite para acessar o {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>Você foi convidado</Heading>
          <Text style={styles.text}>
            Você recebeu um convite para acessar o <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link>.
            Clique no botão abaixo para criar sua senha e ativar o acesso.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Aceitar convite</Button>
          </Section>
          <Text style={styles.muted}>Se você não esperava este convite, pode ignorar este e-mail.</Text>
        </Section>
        <Footer siteName={siteName} />
      </Container>
    </Body>
  </Html>
)
export default InviteEmail
