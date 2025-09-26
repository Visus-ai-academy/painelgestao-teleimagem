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

    // Calcular valores
    const valorExames = demonstrativoData ? (demonstrativoData.valor_bruto || 0) : valorBrutoTotal;
    const valorFranquia = demonstrativoData ? (demonstrativoData.valor_franquia || 0) : 0;
    const valorPortal = demonstrativoData ? (demonstrativoData.valor_portal_laudos || 0) : 0;
    const valorIntegracao = demonstrativoData ? (demonstrativoData.valor_integracao || 0) : 0;
    
    // Base de cálculo para impostos
    const baseCalculo = valorExames + valorFranquia + valorPortal + valorIntegracao;
    
    // Impostos conforme o modelo original
    const pis = baseCalculo * 0.0065;      // 0.65%
    const cofins = baseCalculo * 0.03;     // 3%
    const csll = baseCalculo * 0.01;       // 1%
    const irrf = baseCalculo * 0.015;      // 1.5%
    
    const valorLiquido = baseCalculo - pis - cofins - csll - irrf;

    // ============= GERAÇÃO DO PDF - TEMPLATE PADRÃO (pré 24/09/2025) =============
    // Este template replica o layout usado no frontend (src/lib/pdfUtils.ts)
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    let currentY = margin;

    const addText = (text: string, x: number, y: number, options: any = {}) => {
      const fontSize = options.fontSize || 10;
      const maxWidth = options.maxWidth || contentWidth;
      const align = options.align || 'left';
      const isBold = options.bold || false;

      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');

      const lines = pdf.splitTextToSize(text, maxWidth);
      for (let i = 0; i < lines.length; i++) {
        let textX = x;
        if (align === 'center') textX = x + (maxWidth / 2) - (pdf.getTextWidth(lines[i]) / 2);
        if (align === 'right') textX = x + maxWidth - pdf.getTextWidth(lines[i]);
        pdf.text(lines[i], textX, y + (i * (fontSize * 0.4)));
      }
      return y + (lines.length * (fontSize * 0.4));
    };

    const checkNewPage = (requiredSpace: number) => {
      if (currentY + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }
    };

    // Cabeçalho
    currentY = addText('RELATÓRIO DE FATURAMENTO', margin, currentY + 15, {
      fontSize: 20,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY = addText(`Período: ${periodo}`, margin, currentY + 10, {
      fontSize: 12,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 20;

    // Box de informações do cliente + resumo financeiro
    checkNewPage(80);
    pdf.setDrawColor(200, 200, 200);
    pdf.setFillColor(248, 249, 250);
    pdf.rect(margin, currentY, contentWidth, 60, 'FD');

    const clienteNome = cliente.nome_fantasia || cliente.nome;
    currentY = addText(`Cliente: ${clienteNome}`, margin + 5, currentY + 12, {
      fontSize: 16,
      bold: true,
      align: 'center',
      maxWidth: contentWidth - 10
    });

    currentY += 15;

    const leftColumnX = margin + 10;
    const rightColumnX = margin + (contentWidth / 2) + 10;
    let leftY = currentY;

    leftY = addText(`Período: ${periodo}`, leftColumnX, leftY, { fontSize: 11 });
    leftY = addText(`Total de Exames: ${totalLaudos}`, leftColumnX, leftY + 6, { fontSize: 11 });
    leftY = addText(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, leftColumnX, leftY + 6, { fontSize: 11 });

    // Impostos detalhados conforme template original do frontend
    const irpj = baseCalculo * 0.015; // 1,5%
    const impostosDetalhados = {
      irpj,
      pis,
      cofins,
      csll
    };

    const formatarValor = (valor: number) => `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const resumoData = [
      ['Valor Bruto', formatarValor(valorExames)],
      ['(-) Franquia', formatarValor(valorFranquia)],
      ['(-) Integração', formatarValor(valorIntegracao)],
      ['(-) Portal Laudos', formatarValor(valorPortal)],
      ['(-) IRPJ (1,5%)', formatarValor(impostosDetalhados.irpj)],
      ['(-) PIS (0,65%)', formatarValor(impostosDetalhados.pis)],
      ['(-) COFINS (3%)', formatarValor(impostosDetalhados.cofins)],
      ['(-) CSLL (1%)', formatarValor(impostosDetalhados.csll)],
      ['VALOR LÍQUIDO', formatarValor(valorLiquido)]
    ];

    let rightY = currentY;
    const colWidth = (contentWidth / 2) - 20;

    resumoData.forEach((row, index) => {
      const isTotal = index === resumoData.length - 1;
      if (isTotal) {
        pdf.setDrawColor(33, 150, 243);
        pdf.setFillColor(227, 242, 253);
        pdf.rect(rightColumnX, rightY - 2, colWidth, 8, 'FD');
      }
      rightY = addText(row[0], rightColumnX + 2, rightY, { fontSize: isTotal ? 12 : 10, bold: isTotal });
      addText(row[1], rightColumnX + 2, rightY - (isTotal ? 4.8 : 4), { fontSize: isTotal ? 12 : 10, bold: isTotal, align: 'right', maxWidth: colWidth - 4 });
      rightY += isTotal ? 10 : 6;
    });

    currentY = Math.max(leftY, rightY) + 10;

    // Tabela de exames
    if (finalData && finalData.length > 0) {
      checkNewPage(50);
      currentY = addText('Detalhamento dos Exames', margin, currentY + 10, { fontSize: 14, bold: true });
      currentY += 15;

      const headers = ['Unidade', 'Paciente', 'Accession', 'Exame', 'Médico', 'Prior.', 'Modal.', 'Espec.', 'Categ.', 'Qtd', 'Valor'];
      const colWidths = [20, 30, 18, 35, 25, 15, 15, 20, 15, 12, 20]; // total 225mm
      let tableX = margin + ((contentWidth - 225) / 2);

      // Cabeçalho azul
      pdf.setFillColor(37, 99, 235);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(tableX, currentY, 225, 8, 'F');

      let headerX = tableX;
      headers.forEach((header, index) => {
        addText(header, headerX + 1, currentY + 6, { fontSize: 8, bold: true, maxWidth: colWidths[index] - 2 });
        headerX += colWidths[index];
      });

      currentY += 8;
      pdf.setTextColor(0, 0, 0);

      // Linhas
      finalData.forEach((item: any, index: number) => {
        checkNewPage(6);
        if (index % 2 === 0) { pdf.setFillColor(248, 249, 250); pdf.rect(tableX, currentY, 225, 6, 'F'); }

        const unidade = (item.unidade_origem || item.cliente || item.cliente_nome_original || clienteNome || '').toString().substring(0,12);
        const paciente = (item.paciente || item.NOME_PACIENTE || '').toString().substring(0,18);
        const accession = (item.accession_number || item.ACCESSION_NUMBER || '-').toString().substring(0,12);
        const exame = (item.nome_exame || item.ESTUDO_DESCRICAO || '').toString().substring(0,22);
        const medico = (item.laudado_por || item.medico || item.MEDICO || '').toString().substring(0,15);
        const prioridade = (item.prioridade || item.PRIORIDADE || 'ROTINA').toString().substring(0,8);
        const modalidade = (item.modalidade || item.MODALIDADE || 'N/A').toString().substring(0,8);
        const especialidade = (item.especialidade || item.ESPECIALIDADE || 'N/A').toString().substring(0,12);
        const categoria = (item.categoria || item.CATEGORIA || 'SC').toString().substring(0,8);
        const qtd = (demonstrativoData ? (item.quantidade || 0) : (item.VALORES || item.quantidade || 0));
        const valorTot = (demonstrativoData ? (item.valor_total || 0) : (item.valor || 0));

        const cells = [
          unidade,
          paciente,
          accession,
          exame,
          medico,
          prioridade,
          modalidade,
          especialidade,
          categoria,
          qtd.toString(),
          formatarValor(valorTot)
        ];

        let cellX = tableX;
        cells.forEach((cell, cellIndex) => {
          const align = cellIndex === 9 ? 'center' : (cellIndex === 10 ? 'right' : 'left');
          addText(cell, cellX + 1, currentY + 4, { fontSize: 7, maxWidth: colWidths[cellIndex] - 2, align });
          cellX += colWidths[cellIndex];
        });
        currentY += 6;
      });

      // Bordas
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      const startTableY = currentY - (finalData.length * 6) - 8;
      pdf.rect(tableX, startTableY, 225, currentY - startTableY);
      let lineX = tableX;
      colWidths.forEach(width => { lineX += width; if (lineX < tableX + 225) { pdf.line(lineX, startTableY, lineX, currentY); } });
    }

    // Rodapé
    currentY += 20;
    checkNewPage(20);
    currentY = addText(`Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`, margin, currentY, { fontSize: 10, align: 'center', maxWidth: contentWidth });

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
        valor_a_pagar: valorLiquido,
        total_impostos: pis + cofins + csll + irrf
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