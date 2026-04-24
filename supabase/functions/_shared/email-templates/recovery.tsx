/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Link,
} from 'npm:@react-email/components@0.0.22'
import { styles, Header, Footer } from './_brand.tsx'

interface Props { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefina sua senha do {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>Redefinição de senha</Heading>
          <Text style={styles.text}>
            Recebemos um pedido para redefinir a senha da sua conta no {siteName}.
            Clique no botão abaixo para criar uma nova senha. O link expira em 15 minutos.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Redefinir senha</Button>
          </Section>
          <Text style={styles.muted}>Se o botão não funcionar, copie e cole este endereço no navegador:</Text>
          <Text style={styles.muted}><Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link></Text>
          <Text style={styles.muted}>Se você não solicitou, ignore este e-mail — sua senha permanece inalterada.</Text>
        </Section>
        <Footer siteName={siteName} />
      </Container>
    </Body>
  </Html>
)
export default RecoveryEmail
