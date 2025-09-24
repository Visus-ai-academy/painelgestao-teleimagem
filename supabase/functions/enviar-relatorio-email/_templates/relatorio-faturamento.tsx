import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Row,
  Column,
  Hr,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface RelatorioFaturamentoEmailProps {
  cliente_nome: string;
  periodo: string;
  total_laudos: number;
  valor_total: number;
  valor_a_pagar: number;
}

export const RelatorioFaturamentoEmail = ({
  cliente_nome,
  periodo,
  total_laudos,
  valor_total,
  valor_a_pagar
}: RelatorioFaturamentoEmailProps) => (
  <Html>
    <Head />
    <Preview>Relatório de volumetria - Faturamento {periodo}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Relatório de Volumetria</Heading>
        
        <Text style={text}>Prezados,</Text>
        
        <Text style={text}>
          Segue lista de exames referente à nota fiscal citada no e-mail.
        </Text>

        <Section style={summarySection}>
          <Row>
            <Column>
              <Text style={summaryLabel}>Cliente:</Text>
              <Text style={summaryValue}>{cliente_nome}</Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text style={summaryLabel}>Período:</Text>
              <Text style={summaryValue}>{periodo}</Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text style={summaryLabel}>Total de Laudos:</Text>
              <Text style={summaryValue}>{total_laudos.toLocaleString()}</Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text style={summaryLabel}>Valor Total Faturado:</Text>
              <Text style={summaryValue}>
                {valor_total.toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}
              </Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text style={summaryLabel}>Valor a Pagar:</Text>
              <Text style={summaryValueHighlight}>
                {valor_a_pagar.toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}
              </Text>
            </Column>
          </Row>
        </Section>

        <Hr style={hr} />

        <Text style={warningText}>
          <strong>⚠️ Importante:</strong> Evite pagamento de juros e multa ou a suspensão 
          dos serviços, quitando o pagamento no vencimento.
        </Text>

        <Hr style={hr} />

        <Text style={footerText}>
          Atenciosamente,<br />
          <strong>Robson D'avila</strong><br />
          Tel.: (41) 99255-1964
        </Text>
      </Container>
    </Body>
  </Html>
);

export default RelatorioFaturamentoEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '580px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const summarySection = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #e9ecef',
  borderRadius: '6px',
  padding: '20px',
  margin: '20px 0',
};

const summaryLabel = {
  color: '#666',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '8px 0 4px 0',
};

const summaryValue = {
  color: '#333',
  fontSize: '16px',
  margin: '0 0 12px 0',
};

const summaryValueHighlight = {
  color: '#28a745',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const warningText = {
  color: '#856404',
  backgroundColor: '#fff3cd',
  border: '1px solid #ffeaa7',
  borderRadius: '4px',
  padding: '12px',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '20px 0',
};

const footerText = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '20px 0',
  textAlign: 'center' as const,
};

const hr = {
  borderColor: '#e9ecef',
  margin: '20px 0',
};