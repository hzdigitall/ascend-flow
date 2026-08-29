import React from 'react'
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
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import logoAsset from '@/assets/arena-logo.png.asset.json'

const LOGO_URL = `https://www.arenasuplementos.com${logoAsset.url}`

interface Props {
  name?: string
  email?: string
  password?: string
  url?: string
  whatsappUrl?: string
  groupUrl?: string
}

const Email = ({ name, email, password, url, whatsappUrl, groupUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo(a) à Arena Suplementos — seus dados de acesso e bônus de R$ 30</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Arena Suplementos" width="72" height="72" style={logo} />
          <Text style={brand}>ARENA SUPLEMENTOS</Text>
        </Section>
        <Heading style={heading}>Bem-vindo(a) à Arena!</Heading>
        <Text style={text}>{name ? `Olá, ${name}!` : 'Olá!'}</Text>
        <Text style={text}>
          Sua conta foi criada com sucesso. A partir de agora você tem acesso a
          todos os planos, ao programa de indicações em 8 níveis e ao plano de
          carreira Arena.
        </Text>
        {(email || password) && (
          <Section style={credentialsBox}>
            <Text style={boxTitle}>Seus dados de acesso</Text>
            {email && (
              <Text style={credentialRow}>
                <strong>E-mail:</strong> {email}
              </Text>
            )}
            {password && (
              <Text style={credentialRow}>
                <strong>Senha:</strong> {password}
              </Text>
            )}
            <Text style={boxHint}>
              Guarde estas informações — você vai precisar delas para entrar na sua conta.
            </Text>
          </Section>
        )}
        <Section style={bonusBox}>
          <Text style={bonusTitle}>Bônus de cadastro</Text>
          <Text style={bonusValue}>R$ 30,00</Text>
          <Text style={bonusText}>
            Um voucher de boas-vindas já está disponível na sua conta.
          </Text>
        </Section>
        <Section style={{ margin: '28px 0' }}>
          <Button style={button} href={url ?? 'https://www.arenasuplementos.com/dashboard'}>
            Acessar minha conta
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={text}>
          Precisa de ajuda?{' '}
          <Link style={link} href={whatsappUrl ?? 'https://wa.me/message/VXPWMHULXYVYP1'}>
            Fale com nosso suporte
          </Link>{' '}
          ou entre no{' '}
          <Link style={link} href={groupUrl ?? 'https://chat.whatsapp.com/KeE54gWRRr55oFDnMkiWGK'}>
            grupo oficial
          </Link>
          .
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Você recebeu este e-mail porque criou uma conta na Arena Suplementos.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Bem-vindo(a) à Arena Suplementos — bônus de R$ 30 liberado',
  displayName: 'Boas-vindas',
  previewData: {
    name: 'Leonardo',
    email: 'leonardo@exemplo.com',
    password: '••••••••',
    url: 'https://www.arenasuplementos.com/dashboard',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px', border: '1px solid #f1f1f4', borderRadius: '18px' }
const brand = { color: '#FB096E', fontWeight: 700, fontSize: '13px', letterSpacing: '2px', margin: 0, textAlign: 'center' as const }
const heading = { fontSize: '24px', color: '#111827', margin: '0 0 16px', textAlign: 'center' as const }
const text = { fontSize: '15px', lineHeight: '24px', color: '#374151' }
const boxTitle = { fontSize: '12px', color: '#9F0B35', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 10px', fontWeight: 700 }
const credentialsBox = {
  backgroundColor: '#FAFAFA',
  border: '1px solid #f1f1f4',
  borderRadius: '12px',
  padding: '20px',
  margin: '24px 0 0',
}
const credentialRow = { fontSize: '14px', lineHeight: '22px', color: '#111827', margin: '0 0 4px' }
const boxHint = { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }
const bonusBox = {
  backgroundColor: '#FAFAFA',
  border: '1px solid #f1f1f4',
  borderRadius: '12px',
  padding: '20px',
  margin: '16px 0 0',
  textAlign: 'center' as const,
}
const bonusTitle = { fontSize: '12px', color: '#9F0B35', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 4px', fontWeight: 700 }
const bonusValue = { fontSize: '32px', fontWeight: 700, color: '#FB096E', margin: '0 0 4px' }
const bonusText = { fontSize: '13px', color: '#6b7280', margin: 0 }
const button = {
  backgroundColor: '#FB096E',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 22px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
}
const link = { color: '#FB096E', textDecoration: 'underline' }
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const footer = { fontSize: '12px', color: '#6b7280' }const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const logo = { display: 'block', margin: '0 auto 10px', borderRadius: '14px' }
