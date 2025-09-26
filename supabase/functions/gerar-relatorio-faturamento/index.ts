// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

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
    const demonstrativoData = body?.demonstrativo_data || null;
    const { cliente_id, periodo } = body;
    
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
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, nome_fantasia, cnpj')
      .eq('id', cliente_id)
      .maybeSingle();

    if (!cliente) {
      const { data: clienteComPrecos } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj')
        .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
        .limit(10);
      
      if (clienteComPrecos && clienteComPrecos.length > 0) {
        cliente = clienteComPrecos[0];
      }
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

    // Calcular datas do período
    const [ano, mes] = periodo.split('-');
    const dataInicio = `${ano}-${mes.padStart(2, '0')}-01`;
    const proximoMes = parseInt(mes) === 12 ? 1 : parseInt(mes) + 1;
    const proximoAno = parseInt(mes) === 12 ? parseInt(ano) + 1 : parseInt(ano);
    const dataFim = `${proximoAno}-${proximoMes.toString().padStart(2, '0')}-01`;
    
    // Buscar dados de faturamento
    let { data: dataFaturamento } = await supabase
      .from('faturamento')
      .select('*, accession_number, cliente_nome_original')
      .eq('cliente_nome', cliente.nome_fantasia || cliente.nome)
      .eq('periodo_referencia', periodo)
      .gt('valor', 0);
    
    if (!dataFaturamento || dataFaturamento.length === 0) {
      // Buscar dados de volumetria como fallback
      const candidatos = [cliente.nome_fantasia, cliente.nome].filter(Boolean);
      const { data: dataVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .in('"EMPRESA"', candidatos as string[])
        .neq('tipo_faturamento', 'NC-NF');
      
      if (dataVolumetria && dataVolumetria.length > 0) {
        dataFaturamento = dataVolumetria;
        
        // REGRA ESPECÍFICA CEDIDIAG: apenas Medicina Interna
        const nomeFantasia = cliente.nome_fantasia || cliente.nome;
        if (nomeFantasia === 'CEDIDIAG') {
          dataFaturamento = dataFaturamento.filter((vol: any) => {
            const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
            const medico = (vol.MEDICO || '').toString();
            
            const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA');
            const isExcludedDoctor = medico.includes('Rodrigo Vaz') || medico.includes('Rodrigo Lima');
            
            return isMedicinaInterna && !isExcludedDoctor;
          });
        }
      }
    }

    let finalData = dataFaturamento || [];
    
    // Se demonstrativoData foi fornecido, usar seus detalhes
    if (demonstrativoData && demonstrativoData.detalhes_exames) {
      finalData = demonstrativoData.detalhes_exames.map((detalhe: any) => ({
        modalidade: detalhe.modalidade,
        especialidade: detalhe.especialidade,
        categoria: detalhe.categoria,
        prioridade: detalhe.prioridade,
        quantidade: detalhe.quantidade,
        valor_unitario: detalhe.valor_unitario,
        valor_total: detalhe.valor_total,
        VALORES: detalhe.quantidade,
        valor: detalhe.valor_total
      }));
    }

    // Calcular totais
    let totalLaudos = 0;
    let valorBrutoTotal = 0;

    for (const item of finalData) {
      const quantidade = demonstrativoData ? 
        (item.quantidade || 0) : 
        (Number(item.VALORES) || Number(item.quantidade) || 0);
      
      const valor = demonstrativoData ?
        (Number(item.valor_total) || 0) :
        (Number(item.valor) || 0);

      totalLaudos += quantidade;
      valorBrutoTotal += valor;
    }

    // Calcular impostos (ISS 5%)
    const percentualImpostos = 0.05;
    const totalImpostos = valorBrutoTotal * percentualImpostos;
    const valorAPagar = valorBrutoTotal - totalImpostos;

    // Dados do relatório PDF
    const dadosRelatorio = demonstrativoData || {
      cliente_nome: cliente.nome_fantasia || cliente.nome,
      cliente_cnpj: cliente.cnpj,
      periodo: periodo,
      total_exames: totalLaudos,
      valor_bruto: valorBrutoTotal,
      valor_impostos: totalImpostos,
      valor_total: valorAPagar,
      detalhes_exames: finalData
    };

    // Buscar logomarca
    const { data: logomarcaData } = await supabase
      .from('logomarca')
      .select('nome_arquivo')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let logoDataUrl = '';
    if (logomarcaData?.nome_arquivo) {
      try {
        const { data: logoFile } = await supabase.storage
          .from('logomarca')
          .download(logomarcaData.nome_arquivo);

        if (logoFile) {
          const logoBytes = await logoFile.arrayBuffer();
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBytes)));
          logoDataUrl = `data:${logoFile.type};base64,${logoBase64}`;
        }
      } catch (logoError) {
        console.error('Erro ao carregar logomarca:', logoError);
      }
    }

    // ============= GERAÇÃO DO PDF - TEMPLATE ORIGINAL =============
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const margin = 20;
    let yPosition = margin;
    
    // Logomarca
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'JPEG', margin, yPosition, 50, 20);
      } catch (e) {
        console.log('Erro ao adicionar logo:', e);
      }
    }
    yPosition += 30;

    // Título
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RELATÓRIO DE FATURAMENTO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Cliente e Período
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Cliente: ${dadosRelatorio.cliente_nome || cliente.nome}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Período: ${periodo}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`CNPJ: ${cliente.cnpj || 'N/A'}`, margin, yPosition);
    yPosition += 15;

    // Resumo Financeiro
    pdf.setFont('helvetica', 'bold');
    pdf.text('RESUMO FINANCEIRO', margin, yPosition);
    yPosition += 10;

    const valorExames = demonstrativoData ? (demonstrativoData.valor_bruto || 0) : valorBrutoTotal;
    const valorFranquia = demonstrativoData ? (demonstrativoData.valor_franquia || 0) : 0;
    const valorIntegracao = demonstrativoData ? (demonstrativoData.valor_integracao || 0) : 0;
    const valorPortal = demonstrativoData ? (demonstrativoData.valor_portal_laudos || 0) : 0;
    const valorLiquido = demonstrativoData ? (demonstrativoData.valor_total || 0) : valorAPagar;

    // Função para formatar moeda
    const formatMoney = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Valor dos Exames: ${formatMoney(valorExames)}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Franquia: ${formatMoney(valorFranquia)}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Integração: ${formatMoney(valorIntegracao)}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Portal de Laudos: ${formatMoney(valorPortal)}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Impostos (5%): ${formatMoney(totalImpostos)}`, margin, yPosition);
    yPosition += 10;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`VALOR LÍQUIDO: ${formatMoney(valorLiquido)}`, margin, yPosition);
    yPosition += 20;

    // Detalhamento dos Exames
    if (finalData && finalData.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('DETALHAMENTO DOS EXAMES', margin, yPosition);
      yPosition += 10;

      // Cabeçalho da tabela
      const headers = ['Modalidade', 'Especialidade', 'Qtd', 'Valor Unit.', 'Valor Total'];
      const colWidths = [30, 50, 20, 25, 25];
      let xPos = margin;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      
      for (let i = 0; i < headers.length; i++) {
        pdf.text(headers[i], xPos, yPosition);
        xPos += colWidths[i];
      }
      yPosition += 8;

      // Linha dos dados
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      
      finalData.forEach((item: any) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }

        xPos = margin;
        const quantidade = demonstrativoData ? (item.quantidade || 0) : (item.VALORES || 0);
        const valorTotal = demonstrativoData ? (item.valor_total || 0) : (item.valor || 0);
        const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;

        const rowData = [
          (item.modalidade || item.MODALIDADE || 'N/A').toString().substring(0, 8),
          (item.especialidade || item.ESPECIALIDADE || 'N/A').toString().substring(0, 15),
          quantidade.toString(),
          formatMoney(valorUnitario),
          formatMoney(valorTotal)
        ];

        for (let i = 0; i < rowData.length; i++) {
          pdf.text(rowData[i], xPos, yPosition);
          xPos += colWidths[i];
        }
        yPosition += 6;
      });
    }

    // Rodapé
    yPosition = pageHeight - 30;
    pdf.setFontSize(8);
    pdf.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, yPosition);
    pdf.text(`Total de Exames: ${totalLaudos}`, margin, yPosition + 5);

    // Gerar PDF e fazer upload
    const pdfBytes = pdf.output('arraybuffer');
    const fileName = `relatorio_${(cliente.nome_fantasia || cliente.nome).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${periodo}.pdf`;
    
    let pdfUrl = null;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Erro no upload do PDF:', uploadError);
    } else {
      const { data: urlData } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(fileName);
      
      pdfUrl = urlData.publicUrl;
    }

    // Resposta final
    const response = {
      success: true,
      message: "Relatório gerado com sucesso",
      cliente: cliente.nome_fantasia || cliente.nome,
      periodo: periodo,
      totalRegistros: finalData.length,
      dadosEncontrados: finalData.length > 0,
      dados: finalData,
      arquivos: pdfUrl ? [{ tipo: 'pdf', url: pdfUrl, nome: `relatorio_${cliente.nome}_${periodo}.pdf` }] : [],
      resumo: {
        total_laudos: totalLaudos,
        valor_bruto_total: valorBrutoTotal,
        valor_a_pagar: valorAPagar,
        total_impostos: totalImpostos
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