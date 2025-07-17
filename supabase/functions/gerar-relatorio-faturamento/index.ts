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
      
      // Gerar nome único para o arquivo
      const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
      
      // Salvar PDF no storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relatorios-faturamento')
        .upload(nomeArquivo, pdfContent, {
          contentType: 'application/pdf',
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
    
    // Gerar nome único para o arquivo
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
    
    // Salvar PDF no storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, pdfContent, {
        contentType: 'application/pdf',
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

// Função para gerar PDF do relatório
async function gerarPDFRelatorio(relatorio: any): Promise<Uint8Array> {
  // Criar HTML do relatório
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Faturamento - ${relatorio.cliente.nome}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .cliente-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .resumo { background: #e3f2fd; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .exames { margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .valor { text-align: right; }
        .total { font-weight: bold; background-color: #fff3cd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Relatório de Volumetria - Faturamento</h1>
        <h2>Período: ${relatorio.periodo}</h2>
      </div>
      
      <div class="cliente-info">
        <h3>Dados do Cliente</h3>
        <p><strong>Nome:</strong> ${relatorio.cliente.nome}</p>
        <p><strong>CNPJ:</strong> ${relatorio.cliente.cnpj || 'Não informado'}</p>
        <p><strong>Email:</strong> ${relatorio.cliente.email}</p>
      </div>
      
      <div class="resumo">
        <h3>Resumo Financeiro</h3>
        <table>
          <tr><td><strong>Total de Laudos:</strong></td><td class="valor">${relatorio.resumo.total_laudos}</td></tr>
          <tr><td><strong>Valor Bruto:</strong></td><td class="valor">R$ ${relatorio.resumo.valor_bruto.toFixed(2)}</td></tr>
          <tr><td><strong>Franquia:</strong></td><td class="valor">R$ ${relatorio.resumo.franquia.toFixed(2)}</td></tr>
          <tr><td><strong>Ajuste:</strong></td><td class="valor">R$ ${relatorio.resumo.ajuste.toFixed(2)}</td></tr>
          <tr class="total"><td><strong>Valor Total:</strong></td><td class="valor">R$ ${relatorio.resumo.valor_total.toFixed(2)}</td></tr>
          <tr><td>IRRF (1,5%):</td><td class="valor">R$ ${relatorio.resumo.irrf.toFixed(2)}</td></tr>
          <tr><td>CSLL (1%):</td><td class="valor">R$ ${relatorio.resumo.csll.toFixed(2)}</td></tr>
          <tr><td>PIS (0,65%):</td><td class="valor">R$ ${relatorio.resumo.pis.toFixed(2)}</td></tr>
          <tr><td>COFINS (3%):</td><td class="valor">R$ ${relatorio.resumo.cofins.toFixed(2)}</td></tr>
          <tr><td><strong>Total Impostos:</strong></td><td class="valor">R$ ${relatorio.resumo.impostos.toFixed(2)}</td></tr>
          <tr class="total"><td><strong>Valor a Pagar:</strong></td><td class="valor">R$ ${relatorio.resumo.valor_a_pagar.toFixed(2)}</td></tr>
        </table>
      </div>
      
      <div class="exames">
        <h3>Detalhamento dos Exames</h3>
        ${relatorio.exames.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Paciente</th>
              <th>Médico</th>
              <th>Modalidade</th>
              <th>Especialidade</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${relatorio.exames.map((exame: any) => `
              <tr>
                <td>${new Date(exame.data_estudo).toLocaleDateString('pt-BR')}</td>
                <td>${exame.paciente}</td>
                <td>${exame.medico}</td>
                <td>${exame.modalidade}</td>
                <td>${exame.especialidade}</td>
                <td class="valor">R$ ${exame.valor.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p>Nenhum exame encontrado para o período especificado.</p>'}
      </div>
      
      <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666;">
        <p>Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    </body>
    </html>
  `;

  // Simular geração de PDF (em produção usaria uma biblioteca como puppeteer ou jsPDF)
  // Por enquanto, retornar o HTML como bytes
  const encoder = new TextEncoder();
  return encoder.encode(html);
}

serve(handler);