import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { cliente_id, periodo } = body;
    
    console.log(`Gerando relatório para cliente: ${cliente_id}, período: ${periodo}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (!cliente) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular datas
    const [ano, mes] = periodo.split('-');
    const data_inicio = `${ano}-${mes}-01`;
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const data_fim = `${ano}-${mes}-${ultimoDia.toString().padStart(2, '0')}`;

    console.log(`Cliente: ${cliente.nome}, Período: ${data_inicio} até ${data_fim}`);

    // Buscar dados de faturamento CORRIGIDO
    const { data: faturamento, error } = await supabase
      .from('faturamento')
      .select('*')
      .eq('paciente', cliente.nome)
      .gte('data_emissao', data_inicio)
      .lte('data_emissao', data_fim);

    console.log(`Dados encontrados: ${faturamento?.length || 0} registros`);

    if (error) {
      console.error('Erro ao buscar faturamento:', error);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao buscar dados: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!faturamento || faturamento.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhum dado encontrado',
          debug: {
            cliente: cliente.nome,
            periodo,
            filtro: `paciente = '${cliente.nome}' AND data_emissao BETWEEN '${data_inicio}' AND '${data_fim}'`
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular totais CORRETOS
    const total_laudos = faturamento.reduce((sum, item) => sum + (item.quantidade || 1), 0);
    const valor_bruto = faturamento.reduce((sum, item) => sum + (Number(item.valor_bruto) || Number(item.valor) || 0), 0);
    
    // Impostos
    const irrf = valor_bruto * 0.015;
    const csll = valor_bruto * 0.01;
    const pis = valor_bruto * 0.0065;
    const cofins = valor_bruto * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_liquido = valor_bruto - impostos;

    console.log(`Total correto: ${total_laudos} laudos, R$ ${valor_bruto.toFixed(2)}`);

    // Gerar PDF usando Puppeteer (via service)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 18px; font-weight: bold; color: #0066cc; }
        .info { margin: 20px 0; }
        .resumo { background: #f9f9f9; padding: 15px; margin: 20px 0; border: 1px solid #ddd; }
        .valor-destaque { font-weight: bold; color: #0066cc; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background-color: #0066cc; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f8f8f8; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">DEMONSTRATIVO DE FATURAMENTO</div>
        <div>TELEIMAGEM - Diagnóstico por Imagem</div>
    </div>
    
    <div class="info">
        <strong>Cliente:</strong> ${cliente.nome}<br>
        <strong>Período:</strong> ${mes}/${ano}<br>
        <strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-BR')}
    </div>

    <div class="resumo">
        <h3>RESUMO FINANCEIRO</h3>
        <p><strong>Total de laudos:</strong> ${total_laudos}</p>
        <p><strong>Valor bruto:</strong> R$ ${valor_bruto.toFixed(2)}</p>
        <p><strong>IRRF (1,5%):</strong> R$ ${irrf.toFixed(2)}</p>
        <p><strong>CSLL (1,0%):</strong> R$ ${csll.toFixed(2)}</p>
        <p><strong>PIS (0,65%):</strong> R$ ${pis.toFixed(2)}</p>
        <p><strong>Cofins (3,0%):</strong> R$ ${cofins.toFixed(2)}</p>
        <p><strong>Total de impostos:</strong> R$ ${impostos.toFixed(2)}</p>
        <p class="valor-destaque"><strong>Valor líquido a pagar: R$ ${valor_liquido.toFixed(2)}</strong></p>
    </div>

    <h3>DETALHAMENTO DOS EXAMES</h3>
    <table>
        <thead>
            <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Exame</th>
                <th>Médico</th>
                <th>Modalidade</th>
                <th>Especialidade</th>
                <th>Qtd</th>
                <th class="text-right">Valor</th>
            </tr>
        </thead>
        <tbody>
            ${faturamento.map(item => `
                <tr>
                    <td>${new Date(item.data_emissao).toLocaleDateString('pt-BR')}</td>
                    <td>${item.cliente || 'N/A'}</td>
                    <td>${item.nome_exame || item.modalidade + ' - ' + item.especialidade || 'N/A'}</td>
                    <td>${item.medico || 'N/A'}</td>
                    <td>${item.modalidade || 'N/A'}</td>
                    <td>${item.especialidade || 'N/A'}</td>
                    <td>${item.quantidade || 1}</td>
                    <td class="text-right">R$ ${(Number(item.valor_bruto) || Number(item.valor) || 0).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

    // Converter HTML para PDF usando puppeteer-service
    const pdfResponse = await fetch('https://pdf-service.deno.dev/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent,
        format: 'A4',
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
      })
    });

    if (!pdfResponse.ok) {
      throw new Error('Erro ao gerar PDF');
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Salvar PDF no storage
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });
      
    if (uploadError) {
      console.error('Erro ao salvar PDF:', uploadError);
      throw new Error(`Erro ao salvar PDF: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivo);

    console.log(`PDF salvo: ${publicUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        cliente: cliente.nome,
        periodo,
        total_laudos,
        valor_bruto: valor_bruto.toFixed(2),
        valor_liquido: valor_liquido.toFixed(2),
        arquivos: [{
          tipo: 'pdf',
          url: publicUrl,
          nome: nomeArquivo
        }],
        message: `Relatório gerado: ${total_laudos} laudos, valor bruto R$ ${valor_bruto.toFixed(2)}, líquido R$ ${valor_liquido.toFixed(2)}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);