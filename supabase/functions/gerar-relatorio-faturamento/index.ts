import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FaturamentoRequest {
  cliente_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cliente_id, periodo, data_inicio, data_fim }: FaturamentoRequest = await req.json();

    console.log(`Gerando relatório para cliente ${cliente_id}, período ${periodo}`);

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    // Buscar exames do período
    console.log(`Buscando exames para cliente ${cliente_id} entre ${data_inicio} e ${data_fim}`);
    
    const { data: exames, error: examesError } = await supabase
      .from('exames_realizados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .gte('data_exame', data_inicio)
      .lte('data_exame', data_fim)
      .order('data_exame', { ascending: true });

    if (examesError) {
      console.error('Erro ao buscar exames:', examesError);
      throw new Error(`Erro ao buscar exames: ${examesError.message}`);
    }

    console.log(`Exames encontrados: ${exames?.length || 0}`);

    if (!exames || exames.length === 0) {
      console.log('Nenhum exame encontrado, gerando relatório vazio');
      // Retornar relatório vazio ao invés de erro 404
      const relatorio = {
        cliente: {
          nome: cliente.nome,
          cnpj: cliente.cnpj,
          email: cliente.email
        },
        periodo: periodo,
        resumo: {
          total_laudos: 0,
          valor_bruto: 0,
          franquia: 0,
          ajuste: 0,
          valor_total: 0,
          irrf: 0,
          csll: 0,
          pis: 0,
          cofins: 0,
          impostos: 0,
          valor_a_pagar: 0
        },
        exames: []
      };

      // Gerar PDF do relatório vazio
      const pdfContent = await gerarPDFRelatorio(relatorio);
      
      // Determinar extensão baseada no conteúdo
      const isHTML = new TextDecoder().decode(pdfContent.slice(0, 15)).includes('<!DOCTYPE');
      const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.${isHTML ? 'html' : 'pdf'}`;
      
      // Salvar PDF no storage
      const contentType = nomeArquivo.endsWith('.pdf') ? 'application/pdf' : 'text/html';
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relatorios-faturamento')
        .upload(nomeArquivo, pdfContent, {
          contentType: contentType,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Erro ao salvar PDF vazio:', uploadError);
        // Se falhar, retornar com link temporário
        const linkRelatorio = `#relatorio-${cliente_id}-${periodo}`;
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            relatorio,
            linkRelatorio,
            nomeArquivo,
            message: `Relatório gerado para ${cliente.nome} - Período sem exames` 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Gerar URL público do PDF
      const { data: { publicUrl } } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(nomeArquivo);

      return new Response(
        JSON.stringify({ 
          success: true, 
          relatorio,
          linkRelatorio: publicUrl,
          nomeArquivo,
          message: `Relatório gerado para ${cliente.nome} - Período sem exames` 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calcular totais
    const total_laudos = exames.length;
    const valor_bruto = exames.reduce((sum, exame) => sum + (exame.valor_bruto || 0), 0);
    const franquia = 0;
    const ajuste = 0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    // Gerar dados do relatório
    const relatorio = {
      cliente: {
        nome: cliente.nome,
        cnpj: cliente.cnpj,
        email: cliente.email
      },
      periodo: periodo,
      resumo: {
        total_laudos,
        valor_bruto,
        franquia,
        ajuste,
        valor_total,
        irrf,
        csll,
        pis,
        cofins,
        impostos,
        valor_a_pagar
      },
      exames: exames.map(exame => ({
        data_estudo: exame.data_exame,
        paciente: exame.paciente,
        medico: exame.medico,
        modalidade: exame.modalidade,
        especialidade: exame.especialidade,
        categoria: exame.categoria || '',
        prioridade: exame.prioridade || '',
        valor: exame.valor_bruto || 0
      }))
    };

    console.log(`Relatório gerado com ${exames.length} exames, valor total: R$ ${valor_total.toFixed(2)}`);

    // Gerar PDF do relatório
    const pdfContent = await gerarPDFRelatorio(relatorio);
    
    // Determinar extensão baseada no conteúdo
    const isHTML = new TextDecoder().decode(pdfContent.slice(0, 15)).includes('<!DOCTYPE');
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.${isHTML ? 'html' : 'pdf'}`;
    
    // Salvar PDF no storage
    const contentType = nomeArquivo.endsWith('.pdf') ? 'application/pdf' : 'text/html';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, pdfContent, {
        contentType: contentType,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Erro ao salvar PDF:', uploadError);
      throw new Error(`Erro ao salvar relatório: ${uploadError.message}`);
    }

    // Gerar URL público do PDF
    const { data: { publicUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivo);

    console.log('PDF salvo com sucesso:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        relatorio,
        linkRelatorio: publicUrl,
        nomeArquivo,
        message: `Relatório gerado com sucesso para ${cliente.nome}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

// Função para gerar PDF do relatório usando HTML to PDF
async function gerarPDFRelatorio(relatorio: any): Promise<Uint8Array> {
  // Criar HTML bem formatado para conversão em PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { 
            margin: 20mm; 
            size: A4; 
        }
        body { 
            font-family: Arial, sans-serif; 
            font-size: 12px; 
            line-height: 1.4; 
            color: #333; 
            margin: 0; 
            padding: 0; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333; 
            padding-bottom: 15px; 
        }
        .header h1 { 
            font-size: 18px; 
            margin: 0 0 5px 0; 
            color: #333; 
        }
        .header h2 { 
            font-size: 14px; 
            margin: 0; 
            color: #666; 
        }
        .section { 
            margin-bottom: 20px; 
            page-break-inside: avoid; 
        }
        .section h3 { 
            font-size: 14px; 
            margin: 0 0 10px 0; 
            padding: 5px 0; 
            border-bottom: 1px solid #ddd; 
            color: #333; 
        }
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 5px; 
        }
        .info-label { 
            font-weight: bold; 
            width: 40%; 
        }
        .info-value { 
            width: 55%; 
            text-align: right; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            font-size: 10px; 
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 6px; 
            text-align: left; 
        }
        th { 
            background-color: #f5f5f5; 
            font-weight: bold; 
            font-size: 9px; 
        }
        .text-right { 
            text-align: right; 
        }
        .total-row { 
            background-color: #fff3cd; 
            font-weight: bold; 
        }
        .footer { 
            margin-top: 30px; 
            text-align: center; 
            font-size: 8px; 
            color: #666; 
            border-top: 1px solid #ddd; 
            padding-top: 10px; 
        }
        .no-exams { 
            text-align: center; 
            color: #666; 
            font-style: italic; 
            padding: 20px; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Relatório de Volumetria - Faturamento</h1>
        <h2>Período: ${relatorio.periodo}</h2>
    </div>
    
    <div class="section">
        <h3>Dados do Cliente</h3>
        <div class="info-row">
            <span class="info-label">Nome:</span>
            <span class="info-value">${relatorio.cliente.nome}</span>
        </div>
        <div class="info-row">
            <span class="info-label">CNPJ:</span>
            <span class="info-value">${relatorio.cliente.cnpj || 'Não informado'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${relatorio.cliente.email}</span>
        </div>
    </div>
    
    <div class="section">
        <h3>Resumo Financeiro</h3>
        <div class="info-row">
            <span class="info-label">Total de Laudos:</span>
            <span class="info-value">${relatorio.resumo.total_laudos}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Valor Bruto:</span>
            <span class="info-value">R$ ${relatorio.resumo.valor_bruto.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Franquia:</span>
            <span class="info-value">R$ ${relatorio.resumo.franquia.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Ajuste:</span>
            <span class="info-value">R$ ${relatorio.resumo.ajuste.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row total-row">
            <span class="info-label">Valor Total:</span>
            <span class="info-value">R$ ${relatorio.resumo.valor_total.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row">
            <span class="info-label">IRRF (1,5%):</span>
            <span class="info-value">R$ ${relatorio.resumo.irrf.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row">
            <span class="info-label">CSLL (1%):</span>
            <span class="info-value">R$ ${relatorio.resumo.csll.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row">
            <span class="info-label">PIS (0,65%):</span>
            <span class="info-value">R$ ${relatorio.resumo.pis.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row">
            <span class="info-label">COFINS (3%):</span>
            <span class="info-value">R$ ${relatorio.resumo.cofins.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Total Impostos:</span>
            <span class="info-value">R$ ${relatorio.resumo.impostos.toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="info-row total-row">
            <span class="info-label">VALOR A PAGAR:</span>
            <span class="info-value">R$ ${relatorio.resumo.valor_a_pagar.toFixed(2).replace('.', ',')}</span>
        </div>
    </div>
    
    <div class="section">
        <h3>Detalhamento dos Exames</h3>
        ${relatorio.exames.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th style="width: 12%">Data</th>
                    <th style="width: 25%">Paciente</th>
                    <th style="width: 20%">Médico</th>
                    <th style="width: 15%">Modalidade</th>
                    <th style="width: 15%">Especialidade</th>
                    <th style="width: 13%" class="text-right">Valor</th>
                </tr>
            </thead>
            <tbody>
                ${relatorio.exames.map((exame: any) => `
                <tr>
                    <td>${new Date(exame.data_estudo).toLocaleDateString('pt-BR')}</td>
                    <td>${exame.paciente.length > 30 ? exame.paciente.substring(0, 30) + '...' : exame.paciente}</td>
                    <td>${exame.medico.length > 25 ? exame.medico.substring(0, 25) + '...' : exame.medico}</td>
                    <td>${exame.modalidade.length > 15 ? exame.modalidade.substring(0, 15) + '...' : exame.modalidade}</td>
                    <td>${exame.especialidade.length > 15 ? exame.especialidade.substring(0, 15) + '...' : exame.especialidade}</td>
                    <td class="text-right">R$ ${exame.valor.toFixed(2).replace('.', ',')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<div class="no-exams">Nenhum exame encontrado para o período especificado.</div>'}
    </div>
    
    <div class="footer">
        <p>Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
</body>
</html>
  `;

  try {
    // Usar uma API externa para converter HTML em PDF
    const response = await fetch('https://api.html-pdf-node.vercel.app/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: html,
        options: {
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            bottom: '20mm', 
            left: '15mm',
            right: '15mm'
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error('Falha na conversão HTML para PDF');
    }

    const pdfBuffer = await response.arrayBuffer();
    return new Uint8Array(pdfBuffer);
    
  } catch (error) {
    console.error('Erro ao gerar PDF com API externa:', error);
    
    // Fallback: retornar HTML como arquivo
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);
    
    // Tentar salvar como HTML em vez de PDF - alterar nome do arquivo
    console.log('Salvando como HTML devido ao erro no PDF');
    return htmlBytes;
  }
}

serve(handler);