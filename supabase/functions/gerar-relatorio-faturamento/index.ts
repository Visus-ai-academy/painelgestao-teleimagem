
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Função iniciada');
    
    const body = await req.json();
    console.log('Body recebido:', JSON.stringify(body));
    
    const { cliente_id, periodo } = body;
    console.log('Parâmetros extraídos - cliente_id:', cliente_id, 'periodo:', periodo);
    
    if (!cliente_id || !periodo) {
      return new Response(JSON.stringify({
        success: false,
        error: "Parâmetros obrigatórios: cliente_id e periodo"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome')
      .eq('id', cliente_id)
      .maybeSingle();

    if (clienteError) {
      console.error('Erro ao buscar cliente:', clienteError);
      return new Response(JSON.stringify({
        success: false,
        error: "Erro ao buscar dados do cliente: " + clienteError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!cliente) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cliente não encontrado"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Cliente encontrado:', cliente.nome);

    // Calcular datas do período
    const [ano, mes] = periodo.split('-');
    const dataInicio = `${ano}-${mes.padStart(2, '0')}-01`;
    const proximoMes = parseInt(mes) === 12 ? 1 : parseInt(mes) + 1;
    const proximoAno = parseInt(mes) === 12 ? parseInt(ano) + 1 : parseInt(ano);
    const dataFim = `${proximoAno}-${proximoMes.toString().padStart(2, '0')}-01`;

    console.log(`Buscando dados para cliente: ${cliente.nome}, período: ${dataInicio} a ${dataFim}`);

    // Buscar dados de faturamento com múltiplas estratégias
    const queries = [
      // 1. Por cliente_id
      supabase
        .from('faturamento')
        .select('*')
        .eq('cliente_id', cliente_id)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim),
      
      // 2. Por nome do cliente (exato)
      supabase
        .from('faturamento')
        .select('*')
        .eq('cliente_nome', cliente.nome)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim),
      
      // 3. Por campo cliente (se existir)
      supabase
        .from('faturamento')
        .select('*')
        .eq('cliente', cliente.nome)
        .gte('data_emissao', dataInicio)
        .lt('data_emissao', dataFim)
    ];

    const results = await Promise.all(queries);
    
    console.log('Resultados das consultas:');
    results.forEach((result, index) => {
      console.log(`Query ${index + 1}:`, result.data?.length || 0, 'registros, erro:', result.error?.message || 'nenhum');
    });

    // Combinar todos os resultados únicos
    const allData = [];
    const seenIds = new Set();

    for (const result of results) {
      if (result.data) {
        for (const item of result.data) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allData.push(item);
          }
        }
      }
    }

    console.log('Total de dados únicos encontrados:', allData.length);

    // Calcular resumo
    const valorTotal = allData.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);
    const totalExames = allData.reduce((sum, item) => sum + (parseInt(item.quantidade) || 1), 0);

    // Gerar arquivo PDF e salvar no storage
    let pdfUrl = null;
    if (allData.length > 0) {
      try {
        console.log('Gerando PDF do relatório...');
        
        // Criar conteúdo básico do PDF como HTML
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Relatório de Faturamento - ${cliente.nome}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .info { margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { background-color: #f9f9f9; padding: 15px; margin-top: 20px; border-left: 4px solid #007cba; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório de Faturamento</h1>
            <div class="info"><strong>Cliente:</strong> ${cliente.nome}</div>
            <div class="info"><strong>Período:</strong> ${periodo}</div>
            <div class="info"><strong>Data do Relatório:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          
          <div class="summary">
            <h3>Resumo</h3>
            <p><strong>Total de Exames:</strong> ${totalExames}</p>
            <p><strong>Valor Total:</strong> R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Médico</th>
                <th>Modalidade</th>
                <th>Especialidade</th>
                <th>Quantidade</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${allData.map(item => `
                <tr>
                  <td>${item.data_exame || item.data_emissao || '-'}</td>
                  <td>${item.paciente || '-'}</td>
                  <td>${item.medico || '-'}</td>
                  <td>${item.modalidade || '-'}</td>
                  <td>${item.especialidade || '-'}</td>
                  <td>${item.quantidade || 1}</td>
                  <td>R$ ${parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
        `;

        // Salvar HTML no storage
        const fileName = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.html`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('relatorios-faturamento')
          .upload(fileName, new Blob([htmlContent], { type: 'text/html' }), {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('Erro no upload do HTML:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('relatorios-faturamento')
            .getPublicUrl(fileName);
          
          pdfUrl = publicUrl;
          console.log('Relatório HTML gerado com sucesso:', pdfUrl);
        }
      } catch (pdfError) {
        console.error('Erro na geração do relatório:', pdfError);
      }
    }

    // Sempre retornar sucesso, mesmo sem dados
    const response = {
      success: true,
      message: "Relatório gerado com sucesso",
      cliente: cliente.nome,
      periodo: periodo,
      totalRegistros: allData.length,
      dadosEncontrados: allData.length > 0,
      dados: allData,
      arquivos: pdfUrl ? [{ tipo: 'html', url: pdfUrl, nome: `relatorio_${cliente.nome}_${periodo}.html` }] : [],
      resumo: {
        total_laudos: totalExames,
        valor_total: valorTotal,
        total_exames: totalExames
      },
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro capturado:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno do servidor',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
