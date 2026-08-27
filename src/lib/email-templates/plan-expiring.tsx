import React from 'react'
import {
  Body,
  Button,
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
  planName?: string
  expiresAt?: string
  days?: number
  url?: string
}

const Email = ({ name, planName, expiresAt, days, url }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Seu plano ${planName ?? ''} está próximo do vencimento`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Arena Saúde</Text>
        <Heading style={heading}>Seu plano vence em breve</Heading>
        <Text style={text}>Olá{name ? `, ${name}` : ''}!</Text>
        <Text style={text}>
          O plano <strong>{planName ?? 'ativo'}</strong> vence
          {typeof days === 'number' ? ` em até ${days} dia(s)` : ' em breve'}
          {expiresAt ? ` (${expiresAt})` : ''}. Após o vencimento, os rendimentos
          diários desse plano são encerrados.
        </Text>
        <Section style={{ margin: '28px 0' }}>
          <Button style={button} href={url ?? 'https://www.arenasuplementos.com/planos'}>
            Renovar meu plano
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Você recebeu este aviso porque possui um plano ativo na Arena Saúde.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Seu plano ${data['planName'] ?? ''} vence em breve`.replace(/\s+/g, ' ').trim(),
  displayName: 'Plano vence em breve',
  previewData: {
    name: 'Leonardo',
    planName: 'Arena Pro',
    expiresAt: '30/08/2026 10:00',
    days: 3,
    url: 'https://www.arenasuplementos.com/planos',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { color: '#FB096E', fontWeight: 700, fontSize: '14px', letterSpacing: '1px', margin: '0 0 8px' }
const heading = { fontSize: '24px', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#374151' }
const button = {
  backgroundColor: '#FB096E',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 22px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
}
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
const footer = { fontSize: '12px', color: '#6b7280' }
