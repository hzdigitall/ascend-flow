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
  expiredAt?: string
  url?: string
}

const Email = ({ name, planName, expiredAt, url }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`Seu plano ${planName ?? ''} expirou`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Arena Suplementos</Text>
        <Heading style={heading}>Seu plano expirou</Heading>
        <Text style={text}>Olá{name ? `, ${name}` : ''}!</Text>
        <Text style={text}>
          O plano <strong>{planName ?? 'ativo'}</strong> foi encerrado
          {expiredAt ? ` em ${expiredAt}` : ''}. Os rendimentos diários desse plano
          foram interrompidos e ele não aparece mais em “Planos ativos”.
        </Text>
        <Text style={text}>
          Para voltar a receber rendimentos, adquira um novo plano usando saldo,
          comissões ou um novo depósito.
        </Text>
        <Section style={{ margin: '28px 0' }}>
          <Button style={button} href={url ?? 'https://www.arenasuplementos.com/planos'}>
            Ver planos disponíveis
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Você recebeu este aviso por ter tido um plano ativo na Arena Suplementos.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Seu plano ${data['planName'] ?? ''} expirou`.replace(/\s+/g, ' ').trim(),
  displayName: 'Plano expirado',
  previewData: {
    name: 'Leonardo',
    planName: 'Arena Pro',
    expiredAt: '27/08/2026 10:00',
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
