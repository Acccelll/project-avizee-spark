/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Link,
} from 'npm:@react-email/components@0.0.22'
import { styles, Header, Footer } from './_brand.tsx'

interface Props { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail no {siteName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>Bem-vindo ao {siteName}</Heading>
          <Text style={styles.text}>
            Confirme seu endereço (<Link href={`mailto:${recipient}`} style={styles.link}>{recipient}</Link>)
            para ativar sua conta e acessar o sistema.
          </Text>
          <Section style={styles.buttonWrap}>
            <Button style={styles.button} href={confirmationUrl}>Confirmar e-mail</Button>
          </Section>
          <Text style={styles.muted}>Se o botão não funcionar, copie e cole este endereço:</Text>
          <Text style={styles.muted}><Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link></Text>
          <Text style={styles.muted}>Se você não criou esta conta, pode ignorar este e-mail com segurança.</Text>
        </Section>
        <Footer siteName={siteName} />
      </Container>
    </Body>
  </Html>
)
export default SignupEmail
