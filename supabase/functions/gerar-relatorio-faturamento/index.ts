import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RelatorioRequest {
  cliente_id: string;
  periodo: string; // formato: "2025-06"
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

    const { cliente_id, periodo }: RelatorioRequest = await req.json();
    console.log(`🔥 INICIANDO GERAÇÃO DE RELATÓRIO - Cliente: ${cliente_id}, Período: ${periodo}`);

    // Extrair ano e mês do período (formato: "2025-06")
    const [ano, mes] = periodo.split('-');
    const data_inicio = `${ano}-${mes.padStart(2, '0')}-01`;
    
    // Calcular último dia do mês
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const data_fim = `${ano}-${mes.padStart(2, '0')}-${ultimoDia.toString().padStart(2, '0')}`;
    
    console.log(`📅 Período: ${data_inicio} até ${data_fim}`);

    // 1. BUSCAR DADOS DO CLIENTE
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      console.error('❌ Cliente não encontrado:', clienteError);
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    console.log(`👤 Cliente encontrado: ${cliente.nome}`);

    // 2. BUSCAR DADOS DE FATURAMENTO
    const { data: dadosFaturamento, error: faturamentoError } = await supabase
      .from('faturamento')
      .select('*')
      .eq('paciente', cliente.nome) // paciente contém o código do cliente
      .gte('data_emissao', data_inicio)
      .lte('data_emissao', data_fim)
      .order('data_emissao', { ascending: true });

    if (faturamentoError) {
      console.error('❌ Erro ao buscar faturamento:', faturamentoError);
      throw new Error(`Erro ao buscar dados de faturamento: ${faturamentoError.message}`);
    }

    console.log(`💰 Dados de faturamento encontrados: ${dadosFaturamento?.length || 0} registros`);

    // Verificar se temos dados suficientes para gerar o relatório
    if (!dadosFaturamento || dadosFaturamento.length === 0) {
      console.log('❌ Nenhum dado de faturamento encontrado para o período');
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum dado de faturamento encontrado',
          details: `Não foram encontrados dados de faturamento para cliente ${cliente.nome} no período ${periodo}.`,
          cliente: cliente.nome,
          periodo,
          debug: {
            filtro_usado: `paciente = '${cliente.nome}'`,
            data_inicio,
            data_fim
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. CALCULAR RESUMO FINANCEIRO
    const total_laudos = dadosFaturamento.reduce((sum, item) => sum + (item.quantidade || 1), 0);
    const valor_bruto = dadosFaturamento.reduce((sum, item) => sum + (Number(item.valor_bruto) || Number(item.valor) || 0), 0);
    const franquia = 0.0;
    const ajuste = 0.0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    const resumo = {
      total_laudos,
      franquia,
      ajuste,
      valor_bruto,
      valor_total,
      irrf,
      csll,
      pis,
      cofins,
      impostos,
      valor_a_pagar
    };

    console.log(`💵 Resumo calculado:`, resumo);

    // 4. GERAR HTML DO RELATÓRIO
    const [anoNome, mesNome] = [ano, mes];
    const nomesMeses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesFormatado = nomesMeses[parseInt(mesNome)] || mesNome;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Faturamento - ${cliente.nome}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #0066cc; text-align: center; }
            h2 { color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 5px; }
            .info { margin: 10px 0; }
            .resumo { background: #f5f5f5; padding: 15px; margin: 20px 0; }
            .valor-destaque { font-weight: bold; color: #0066cc; font-size: 1.2em; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #0066cc; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>DEMONSTRATIVO DE FATURAMENTO</h1>
        
        <div class="info">
            <strong>Cliente:</strong> ${cliente.nome}<br>
            <strong>Período:</strong> ${mesFormatado}/${anoNome}<br>
            <strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-BR')}
        </div>

        <div class="resumo">
            <h2>RESUMO FINANCEIRO</h2>
            <p><strong>Total de laudos:</strong> ${total_laudos}</p>
            <p><strong>Valor bruto:</strong> R$ ${valor_bruto.toFixed(2)}</p>
            <p><strong>Valor total:</strong> R$ ${valor_total.toFixed(2)}</p>
            <p><strong>IRRF (1,5%):</strong> R$ ${irrf.toFixed(2)}</p>
            <p><strong>CSLL (1,0%):</strong> R$ ${csll.toFixed(2)}</p>
            <p><strong>PIS (0,65%):</strong> R$ ${pis.toFixed(2)}</p>
            <p><strong>Cofins (3,0%):</strong> R$ ${cofins.toFixed(2)}</p>
            <p class="valor-destaque"><strong>Valor a pagar: R$ ${valor_a_pagar.toFixed(2)}</strong></p>
        </div>

        <h2>DETALHAMENTO DOS EXAMES</h2>
        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Paciente</th>
                    <th>Exame</th>
                    <th>Médico</th>
                    <th>Modalidade</th>
                    <th>Especialidade</th>
                    <th>Valor</th>
                </tr>
            </thead>
            <tbody>
                ${dadosFaturamento.map(item => `
                    <tr>
                        <td>${new Date(item.data_emissao).toLocaleDateString('pt-BR')}</td>
                        <td>${item.cliente || 'N/A'}</td>
                        <td>${item.nome_exame || 'N/A'}</td>
                        <td>${item.medico || 'N/A'}</td>
                        <td>${item.modalidade || 'N/A'}</td>
                        <td>${item.especialidade || 'N/A'}</td>
                        <td>R$ ${(Number(item.valor_bruto) || Number(item.valor) || 0).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>`;

    // 5. SALVAR HTML NO STORAGE
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.html`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, htmlContent, {
        contentType: 'text/html',
        cacheControl: '3600'
      });
      
    if (uploadError) {
      console.error('❌ Erro ao salvar HTML:', uploadError);
      throw new Error(`Erro ao salvar HTML: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivo);

    console.log(`✅ HTML salvo com sucesso: ${publicUrl}`);

    // 6. RESPOSTA FINAL
    return new Response(
      JSON.stringify({ 
        success: true,
        cliente: cliente.nome,
        periodo,
        resumo,
        total_exames: dadosFaturamento.length,
        fonte_dados: 'faturamento',
        arquivos: [{
          tipo: 'html',
          url: publicUrl,
          nome: nomeArquivo
        }],
        message: `Relatório gerado com sucesso - ${total_laudos} laudos, valor total: R$ ${valor_total.toFixed(2)}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
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

serve(handler);