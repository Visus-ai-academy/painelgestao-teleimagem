import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GerarContratoRequest {
  contrato_id: string;
  cliente_id: string;
  configuracao: {
    data_inicio: string;
    data_fim: string;
    considera_plantao: boolean;
    dia_vencimento: number;
    desconto_percentual: number;
    acrescimo_percentual: number;
    servicos_inclusos: string[];
    clausulas_especiais: string;
    valor_franquia: number;
    valor_integracao: number;
    observacoes: string;
  };
  precos_cliente: any[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { contrato_id, cliente_id, configuracao, precos_cliente }: GerarContratoRequest = await req.json();

    console.log('🏢 Gerando contrato para cliente:', cliente_id);
    console.log('📄 Contrato ID:', contrato_id);

    // 1. Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    // 2. Buscar dados do contrato
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos_clientes')
      .select('*')
      .eq('id', contrato_id)
      .single();

    if (contratoError || !contrato) {
      throw new Error(`Contrato não encontrado: ${contratoError?.message}`);
    }

    // 3. Gerar HTML do contrato
    const contratoHTML = gerarHTMLContrato({
      cliente,
      contrato,
      configuracao,
      precos_cliente
    });

    console.log('📝 HTML do contrato gerado com sucesso');

    // 4. Por enquanto, retornar sucesso com URL fictícia
    // Em uma implementação real, você usaria uma biblioteca como puppeteer para gerar PDF
    const response = {
      success: true,
      message: 'Contrato gerado com sucesso',
      contrato_numero: contrato.numero_contrato,
      cliente_nome: cliente.nome,
      documento_url: `contracts/${contrato_id}_contrato.pdf`, // URL fictícia por enquanto
      html_preview: contratoHTML.substring(0, 500) + '...', // Preview do HTML
      estatisticas: {
        total_servicos: configuracao.servicos_inclusos.length,
        total_precos: precos_cliente.length,
        valor_total_estimado: precos_cliente.reduce((total, preco) => total + preco.valor_base, 0),
        valor_franquia: configuracao.valor_franquia,
        valor_integracao: configuracao.valor_integracao
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro ao gerar contrato:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido ao gerar contrato'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function gerarHTMLContrato({ cliente, contrato, configuracao, precos_cliente }: any): string {
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const valorTotalEstimado = precos_cliente.reduce((total: number, preco: any) => total + preco.valor_base, 0);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Prestação de Serviços - ${cliente.nome}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title {
            color: #2563eb;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 14px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            background-color: #f8fafc;
            color: #2563eb;
            padding: 10px;
            border-left: 4px solid #2563eb;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .info-item {
            border: 1px solid #e5e7eb;
            padding: 10px;
            border-radius: 4px;
        }
        .info-label {
            font-weight: bold;
            color: #4b5563;
            margin-bottom: 5px;
        }
        .info-value {
            color: #1f2937;
        }
        .services-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .services-table th,
        .services-table td {
            border: 1px solid #d1d5db;
            padding: 10px;
            text-align: left;
        }
        .services-table th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
        }
        .services-table tbody tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .price-summary {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .price-total {
            font-size: 18px;
            font-weight: bold;
            color: #92400e;
        }
        .clause {
            background-color: #f8fafc;
            border-left: 4px solid #6b7280;
            padding: 15px;
            margin: 15px 0;
        }
        .signature-section {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
        }
        .signature-box {
            text-align: center;
            border-top: 1px solid #000;
            padding-top: 10px;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">CONTRATO DE PRESTAÇÃO DE SERVIÇOS MÉDICOS</div>
        <div class="subtitle">Contrato Nº: ${contrato.numero_contrato}</div>
        <div class="subtitle">Data de Geração: ${dataAtual}</div>
    </div>

    <div class="section">
        <div class="section-title">1. DADOS DAS PARTES</div>
        
        <h4>CONTRATANTE:</h4>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Razão Social:</div>
                <div class="info-value">${cliente.razao_social || cliente.nome}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Nome Fantasia:</div>
                <div class="info-value">${cliente.nome_fantasia || cliente.nome}</div>
            </div>
            <div class="info-item">
                <div class="info-label">CNPJ:</div>
                <div class="info-value">${cliente.cnpj || 'Não informado'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Endereço:</div>
                <div class="info-value">${cliente.endereco || 'Não informado'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Telefone:</div>
                <div class="info-value">${cliente.telefone || 'Não informado'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">E-mail:</div>
                <div class="info-value">${cliente.email}</div>
            </div>
        </div>

        <h4>CONTRATADA:</h4>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Razão Social:</div>
                <div class="info-value">TELEIMAGEM SERVIÇOS MÉDICOS LTDA</div>
            </div>
            <div class="info-item">
                <div class="info-label">CNPJ:</div>
                <div class="info-value">XX.XXX.XXX/XXXX-XX</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">2. OBJETO DO CONTRATO</div>
        <p>O presente contrato tem por objeto a prestação de serviços de telemedicina, especificamente:</p>
        
        <ul>
            ${configuracao.servicos_inclusos.map(servico => `<li>${servico}</li>`).join('')}
        </ul>
    </div>

    <div class="section">
        <div class="section-title">3. VIGÊNCIA E PRAZOS</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Data de Início:</div>
                <div class="info-value">${new Date(configuracao.data_inicio).toLocaleDateString('pt-BR')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Data de Término:</div>
                <div class="info-value">${new Date(configuracao.data_fim).toLocaleDateString('pt-BR')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Dia de Vencimento:</div>
                <div class="info-value">${configuracao.dia_vencimento}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Considera Plantão:</div>
                <div class="info-value">${configuracao.considera_plantao ? 'Sim' : 'Não'}</div>
            </div>
        </div>
    </div>

    ${precos_cliente.length > 0 ? `
    <div class="section">
        <div class="section-title">4. TABELA DE PREÇOS DOS SERVIÇOS</div>
        <table class="services-table">
            <thead>
                <tr>
                    <th>Modalidade</th>
                    <th>Especialidade</th>
                    <th>Categoria</th>
                    <th>Prioridade</th>
                    <th>Valor Base (R$)</th>
                    <th>Valor Urgência (R$)</th>
                </tr>
            </thead>
            <tbody>
                ${precos_cliente.map(preco => `
                <tr>
                    <td>${preco.modalidade}</td>
                    <td>${preco.especialidade}</td>
                    <td>${preco.categoria}</td>
                    <td>${preco.prioridade}</td>
                    <td>R$ ${preco.valor_base.toFixed(2)}</td>
                    <td>R$ ${(preco.valor_urgencia || preco.valor_base).toFixed(2)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="price-summary">
            <div class="price-total">Valor Total Estimado: R$ ${valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            ${configuracao.valor_franquia > 0 ? `<div>Valor da Franquia: R$ ${configuracao.valor_franquia.toFixed(2)}</div>` : ''}
            ${configuracao.valor_integracao > 0 ? `<div>Valor da Integração: R$ ${configuracao.valor_integracao.toFixed(2)}</div>` : ''}
            ${configuracao.desconto_percentual > 0 ? `<div>Desconto Aplicado: ${configuracao.desconto_percentual}%</div>` : ''}
            ${configuracao.acrescimo_percentual > 0 ? `<div>Acréscimo Aplicado: ${configuracao.acrescimo_percentual}%</div>` : ''}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">5. CONDIÇÕES COMERCIAIS</div>
        <div class="clause">
            <p><strong>5.1.</strong> O faturamento será realizado mensalmente, com vencimento no dia ${configuracao.dia_vencimento} de cada mês.</p>
            <p><strong>5.2.</strong> Os valores serão reajustados anualmente conforme índice IPCA.</p>
            ${configuracao.desconto_percentual > 0 ? `<p><strong>5.3.</strong> Desconto de ${configuracao.desconto_percentual}% aplicado sobre os valores da tabela.</p>` : ''}
            ${configuracao.acrescimo_percentual > 0 ? `<p><strong>5.4.</strong> Acréscimo de ${configuracao.acrescimo_percentual}% aplicado sobre os valores da tabela.</p>` : ''}
        </div>
    </div>

    ${configuracao.clausulas_especiais ? `
    <div class="section">
        <div class="section-title">6. CLÁUSULAS ESPECIAIS</div>
        <div class="clause">
            ${configuracao.clausulas_especiais.split('\n').map(linha => `<p>${linha}</p>`).join('')}
        </div>
    </div>
    ` : ''}

    ${configuracao.observacoes ? `
    <div class="section">
        <div class="section-title">7. OBSERVAÇÕES</div>
        <div class="clause">
            ${configuracao.observacoes.split('\n').map(linha => `<p>${linha}</p>`).join('')}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">8. DISPOSIÇÕES FINAIS</div>
        <div class="clause">
            <p><strong>8.1.</strong> Este contrato entra em vigor na data de sua assinatura e permanece válido até ${new Date(configuracao.data_fim).toLocaleDateString('pt-BR')}.</p>
            <p><strong>8.2.</strong> Qualquer alteração deste contrato deverá ser feita por escrito e assinada por ambas as partes.</p>
            <p><strong>8.3.</strong> O presente contrato é regido pelas leis brasileiras.</p>
        </div>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <strong>CONTRATANTE</strong><br>
            ${cliente.razao_social || cliente.nome}<br>
            Data: ___/___/______
        </div>
        <div class="signature-box">
            <strong>CONTRATADA</strong><br>
            TELEIMAGEM SERVIÇOS MÉDICOS LTDA<br>
            Data: ___/___/______
        </div>
    </div>

    <div class="footer">
        <p>Contrato gerado automaticamente pelo sistema em ${dataAtual}</p>
        <p>Contrato Nº: ${contrato.numero_contrato}</p>
    </div>
</body>
</html>
  `;
}