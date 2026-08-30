import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  code?: string
  minutes?: number
}

const Email = ({ name, code, minutes = 15 }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de confirmação para alterar o e-mail da conta Arena</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>ARENA SUPLEMENTOS</Text>
        <Heading style={heading}>Confirme seu novo e-mail</Heading>
        <Text style={text}>{name ? `Olá, ${name}!` : 'Olá!'}</Text>
        <Text style={text}>
          Recebemos um pedido para alterar o e-mail de acesso da sua conta. Use o código abaixo
          para confirmar a alteração:
        </Text>
        <Section style={codeBox}>
          <Text style={codeStyle}>{code}</Text>
        </Section>
        <Text style={text}>
          O código expira em {minutes} minutos. Se você não solicitou esta alteração, ignore este
          e-mail — nada será alterado.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Arena Suplementos — mensagem automática, não responda.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Código de confirmação — alteração de e-mail',
  displayName: 'Código de alteração de e-mail',
  previewData: { name: 'Leonardo', code: '123456', minutes: 15 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { color: '#FB096E', fontWeight: 700, fontSize: '14px', letterSpacing: '1px', margin: '0 0 8px' }
const heading = { fontSize: '24px', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#374151' }
const codeBox = {
  backgroundColor: '#FDF2F6',
  borderRadius: '12px',
  padding: '18px',
  textAlign: 'center' as const,
  margin: '20px 0',
}
const codeStyle = {
  fontSize: '30px',
  letterSpacing: '8px',
  fontWeight: 700,
  color: '#9F0B35',
  margin: 0,
}
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const footer = { fontSize: '12px', color: '#6b7280' }
