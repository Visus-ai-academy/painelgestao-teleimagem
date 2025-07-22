
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
    const body = await req.json();
    console.log('Request body:', body);
    
    const { cliente_id, periodo } = body;
    
    if (!cliente_id || !periodo) {
      console.log('Missing parameters - cliente_id:', cliente_id, 'periodo:', periodo);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Parâmetros cliente_id e periodo são obrigatórios' 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome')
      .eq('id', cliente_id)
      .single();

    console.log('Cliente encontrado:', cliente, 'Erro:', clienteError);

    if (!cliente) {
      return new Response(JSON.stringify({ success: false, error: 'Cliente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calcular período
    const [ano, mes] = periodo.split('-');
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const dataInicio = `${ano}-${mes}-01`;
    const dataFim = `${ano}-${mes}-${ultimoDia}`;

    console.log(`Buscando dados para cliente: ${cliente.nome}, período: ${dataInicio} a ${dataFim}`);
    console.log(`Cliente ID recebido: ${cliente_id}`);

    // Buscar faturamento - tentar primeiro por nome do cliente
    let { data: dados, error: errorNome } = await supabase
      .from('faturamento')
      .select('*')
      .eq('cliente_nome', cliente.nome)
      .gte('data_emissao', dataInicio)
      .lte('data_emissao', dataFim);

    console.log(`Busca por cliente_nome: ${dados?.length || 0} registros, erro: ${errorNome?.message || 'nenhum'}`);

    // Se não encontrou por cliente_nome, tentar por campo cliente
    if (!dados || dados.length === 0) {
      const result = await supabase
        .from('faturamento')
        .select('*')
        .eq('cliente', cliente.nome)
        .gte('data_emissao', dataInicio)
        .lte('data_emissao', dataFim);
      dados = result.data;
      console.log(`Busca por cliente: ${dados?.length || 0} registros, erro: ${result.error?.message || 'nenhum'}`);
    }

    // Se não encontrou, tentar buscar por cliente_id (se não for null)
    if ((!dados || dados.length === 0) && cliente_id) {
      const result = await supabase
        .from('faturamento')
        .select('*')
        .eq('cliente_id', cliente_id)
        .gte('data_emissao', dataInicio)
        .lte('data_emissao', dataFim);
      dados = result.data;
      console.log(`Busca por cliente_id: ${dados?.length || 0} registros, erro: ${result.error?.message || 'nenhum'}`);
    }

    console.log(`Total de dados encontrados: ${dados?.length || 0} registros`);

    if (!dados || dados.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Nenhum dado encontrado para ${cliente.nome} no período ${periodo}` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // QUADRO 1: Agrupar para resumo financeiro
    const agrupados = new Map();
    dados.forEach(item => {
      const chave = `${item.data_emissao}_${item.nome_exame}_${item.medico}_${item.modalidade}_${item.especialidade}_${item.prioridade}`;
      if (agrupados.has(chave)) {
        const existente = agrupados.get(chave);
        existente.quantidade += Number(item.quantidade) || 1;
        existente.valor_bruto += Number(item.valor_bruto) || 0;
      } else {
        agrupados.set(chave, {
          ...item,
          quantidade: Number(item.quantidade) || 1,
          valor_bruto: Number(item.valor_bruto) || 0
        });
      }
    });

    const registrosAgrupados = Array.from(agrupados.values());
    
    // Cálculos do resumo baseados nos dados agrupados
    const totalRegistrosUnicos = registrosAgrupados.length;
    const totalLaudos = registrosAgrupados.reduce((sum, r) => sum + r.quantidade, 0);
    const valorBruto = registrosAgrupados.reduce((sum, r) => sum + r.valor_bruto, 0);

    // QUADRO 2: Todos os registros individuais (sem agrupamento)
    const todosRegistros = dados.map(item => ({
      ...item,
      quantidade: Number(item.quantidade) || 1,
      valor_bruto: Number(item.valor_bruto) || 0
    }));

    // Impostos
    const irrf = valorBruto * 0.015;
    const csll = valorBruto * 0.01;
    const pis = valorBruto * 0.0065;
    const cofins = valorBruto * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valorLiquido = valorBruto - impostos;

    console.log(`Resumo: ${totalRegistrosUnicos} únicos, ${totalLaudos} laudos, R$ ${valorBruto.toFixed(2)}`);
    console.log(`Detalhamento: ${todosRegistros.length} registros individuais`);

    // Gerar HTML para PDF
    const nomesMeses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesNome = nomesMeses[parseInt(mes)] || mes;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 15px; font-size: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-size: 16px; font-weight: bold; color: #0066cc; margin-bottom: 5px; }
        .subtitle { font-size: 12px; color: #666; }
        .info { margin: 15px 0; font-size: 11px; }
        .resumo { background: #f8f9fa; padding: 12px; margin: 15px 0; border: 1px solid #ddd; }
        .resumo h3 { margin: 0 0 10px 0; font-size: 13px; color: #0066cc; }
        .valor-destaque { font-weight: bold; color: #0066cc; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 8px; }
        th, td { border: 1px solid #ccc; padding: 3px; text-align: left; }
        th { background-color: #0066cc; color: white; font-weight: bold; font-size: 8px; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .section-title { font-size: 12px; font-weight: bold; color: #0066cc; margin: 20px 0 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">DEMONSTRATIVO DE FATURAMENTO</div>
        <div class="subtitle">TELEIMAGEM - Diagnóstico por Imagem</div>
    </div>
    
    <div class="info">
        <strong>Cliente:</strong> ${cliente.nome}<br>
        <strong>Período:</strong> ${mesNome}/${ano}<br>
        <strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-BR')}
    </div>

    <div class="resumo">
        <h3>QUADRO 1 - RESUMO FINANCEIRO</h3>
        <p><strong>Total de registros únicos:</strong> ${totalRegistrosUnicos}</p>
        <p><strong>Total de laudos:</strong> ${totalLaudos}</p>
        <p><strong>Valor bruto:</strong> R$ ${valorBruto.toFixed(2)}</p>
        <p><strong>IRRF (1,5%):</strong> R$ ${irrf.toFixed(2)}</p>
        <p><strong>CSLL (1,0%):</strong> R$ ${csll.toFixed(2)}</p>
        <p><strong>PIS (0,65%):</strong> R$ ${pis.toFixed(2)}</p>
        <p><strong>Cofins (3,0%):</strong> R$ ${cofins.toFixed(2)}</p>
        <p><strong>Total de impostos:</strong> R$ ${impostos.toFixed(2)}</p>
        <p class="valor-destaque"><strong>Valor líquido a pagar: R$ ${valorLiquido.toFixed(2)}</strong></p>
    </div>

    <div class="section-title">QUADRO 2 - DETALHAMENTO COMPLETO (${todosRegistros.length} registros)</div>
    <table>
        <thead>
            <tr>
                <th style="width: 8%">Data</th>
                <th style="width: 15%">Paciente</th>
                <th style="width: 15%">Exame</th>
                <th style="width: 15%">Médico</th>
                <th style="width: 8%">Modal.</th>
                <th style="width: 8%">Espec.</th>
                <th style="width: 8%">Prior.</th>
                <th style="width: 5%">Qtd</th>
                <th style="width: 8%">Valor Unit.</th>
                <th style="width: 10%">Valor Total</th>
            </tr>
        </thead>
        <tbody>
            ${todosRegistros.map(item => `
                <tr>
                    <td>${new Date(item.data_emissao).toLocaleDateString('pt-BR')}</td>
                    <td>${(item.paciente || item.cliente || 'N/A').substring(0, 20)}</td>
                    <td>${(item.nome_exame || 'N/A').substring(0, 20)}</td>
                    <td>${(item.medico || 'N/A').substring(0, 20)}</td>
                    <td>${(item.modalidade || 'N/A').substring(0, 8)}</td>
                    <td>${(item.especialidade || 'N/A').substring(0, 8)}</td>
                    <td>${(item.prioridade || 'N/A').substring(0, 8)}</td>
                    <td class="text-center">${item.quantidade}</td>
                    <td class="text-right">R$ ${(item.valor_bruto / item.quantidade).toFixed(2)}</td>
                    <td class="text-right">R$ ${item.valor_bruto.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
        <tfoot>
            <tr style="background-color: #e9ecef; font-weight: bold;">
                <td colspan="7" class="text-right"><strong>TOTAIS:</strong></td>
                <td class="text-center"><strong>${todosRegistros.reduce((sum, r) => sum + r.quantidade, 0)}</strong></td>
                <td></td>
                <td class="text-right"><strong>R$ ${todosRegistros.reduce((sum, r) => sum + r.valor_bruto, 0).toFixed(2)}</strong></td>
            </tr>
        </tfoot>
    </table>
</body>
</html>`;

    // Gerar PDF usando API confiável do Puppeteer
    let pdfBytes;
    let isPdf = false;
    
    try {
      // Tentar gerar PDF usando API online
      const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer dummy-key', // Usando versão free
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: htmlContent,
          landscape: false,
          format: 'A4',
          margin: '10mm',
          print_background: true,
          prefer_css_page_size: false
        })
      });

      if (response.ok) {
        const pdfBuffer = await response.arrayBuffer();
        pdfBytes = new Uint8Array(pdfBuffer);
        isPdf = true;
        console.log('PDF gerado com sucesso via API');
      } else {
        throw new Error(`PDF API error: ${response.status}`);
      }
    } catch (pdfError) {
      console.log('Erro na API de PDF, gerando HTML:', pdfError);
      // Fallback para HTML 
      pdfBytes = new TextEncoder().encode(htmlContent);
      isPdf = false;
    }

    // Salvar arquivo
    const extensao = isPdf ? 'pdf' : 'html';
    const contentType = isPdf ? 'application/pdf' : 'text/html';
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.${extensao}`;
    
    const { error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, pdfBytes, {
        contentType,
        cacheControl: '3600'
      });
      
    if (uploadError) {
      console.error('Erro ao salvar arquivo:', uploadError);
      throw new Error(`Erro ao salvar: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivo);

    return new Response(JSON.stringify({
      success: true,
      cliente: cliente.nome,
      periodo,
      total_registros_unicos: totalRegistrosUnicos,
      total_registros_detalhados: todosRegistros.length,
      total_laudos: totalLaudos,
      valor_bruto: valorBruto.toFixed(2),
      valor_liquido: valorLiquido.toFixed(2),
      arquivos: [{
        tipo: extensao,
        url: publicUrl,
        nome: nomeArquivo
      }],
      message: `Relatório gerado: Resumo com ${totalRegistrosUnicos} registros únicos (${totalLaudos} laudos), Detalhamento com ${todosRegistros.length} registros individuais, R$ ${valorBruto.toFixed(2)}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
