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

    // ============= GERAÇÃO DO PDF - TEMPLATE ORIGINAL RESTAURADO =============
    
    // Criar PDF em PAISAGEM
    const pdf = new jsPDF('l', 'mm', 'a4'); 
    const pageWidth = pdf.internal.pageSize.getWidth(); 
    const pageHeight = pdf.internal.pageSize.getHeight(); 
    const margin = 15;
    
    let currentY = margin;
    
    // Função para adicionar texto
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      const { fontSize = 10, align = 'left', isBold = false, maxWidth } = options;
      
      if (isBold) {
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setFont('helvetica', 'normal');  
      }
      
      pdf.setFontSize(fontSize);
      
      if (maxWidth && pdf.getTextWidth(text) > maxWidth) {
        const lines = pdf.splitTextToSize(text, maxWidth);
        pdf.text(lines, x, y, { align });
        return y + (lines.length * fontSize * 0.35);
      } else {
        pdf.text(text, x, y, { align });
        return y + (fontSize * 0.35);
      }
    };
    
    // Função para verificar quebra de página
    const checkNewPage = (currentY: number, spaceNeeded: number = 20): number => {
      if (currentY + spaceNeeded > 190) {
        pdf.addPage();
        return 20;
      }
      return currentY;
    };
    
    // Header do relatório
    addText('TELEiMAGEM', 20, currentY, { fontSize: 16, isBold: true });
    currentY += 8;
    addText('EXCELENCIA EM TELERRADIOLOGIA', 20, currentY, { fontSize: 12 });
    currentY += 15;
    
    // Título do relatório
    addText('RELATÓRIO DE FATURAMENTO', 20, currentY, { fontSize: 14, isBold: true });
    currentY += 15;
    
    // Informações do cliente
    const clienteData = {
      nome: cliente.nome_fantasia || cliente.nome,
      cnpj: cliente.cnpj || 'N/A'
    };
    
    addText(`Cliente: ${clienteData.nome}`, 20, currentY, { fontSize: 11 });
    addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 200, currentY, { fontSize: 11 });
    currentY += 8;
    
    addText(`CNPJ: ${clienteData.cnpj}`, 20, currentY, { fontSize: 11 });
    addText(`Período: ${periodo}`, 200, currentY, { fontSize: 11 });
    currentY += 15;
    
    // QUADRO 1 - RESUMO
    addText('QUADRO 1 - RESUMO', 20, currentY, { fontSize: 12, isBold: true });
    currentY += 10;
    
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
    
    // Função para formatar valores
    const formatarValor = (valor: number) => `R$ ${valor.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
    
    // Resumo em formato tabular (igual ao original)
    addText('Total de Laudos:', 25, currentY, { fontSize: 10 }); 
    addText(totalLaudos.toString(), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('Valor Bruto:', 25, currentY, { fontSize: 10 });
    addText(formatarValor(valorExames), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('Franquia:', 25, currentY, { fontSize: 10 });
    addText(formatarValor(valorFranquia), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('Portal de Laudos:', 25, currentY, { fontSize: 10 });
    addText(formatarValor(valorPortal), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('Integração:', 25, currentY, { fontSize: 10 });
    addText(formatarValor(valorIntegracao), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('PIS (0.65%):', 25, currentY, { fontSize: 10 });
    addText(formatarValor(pis), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('COFINS (3%):', 25, currentY, { fontSize: 10 });
    addText(formatarValor(cofins), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('CSLL (1%):', 25, currentY, { fontSize: 10 });
    addText(formatarValor(csll), 100, currentY, { fontSize: 10 });
    currentY += 6;
    
    addText('IRRF (1.5%):', 25, currentY, { fontSize: 10 });
    addText(formatarValor(irrf), 100, currentY, { fontSize: 10 });
    currentY += 10;
    
    addText('VALOR A PAGAR:', 25, currentY, { fontSize: 11, isBold: true });
    addText(formatarValor(valorLiquido), 100, currentY, { fontSize: 11, isBold: true });
    currentY += 20;
    
    // QUADRO 2 - DETALHAMENTO
    if (finalData && finalData.length > 0) {
      currentY = checkNewPage(currentY, 30);
      
      addText('QUADRO 2 - DETALHAMENTO', 20, currentY, { fontSize: 12, isBold: true });
      currentY += 15;
      
      // Cabeçalho da tabela (conforme o modelo original)
      const headers = ['Data', 'Paciente', 'Médico', 'Exame', 'Modal.', 'Espec.', 'Categ.', 'Prior.', 'Accession', 'Origem', 'Qtd', 'Valor Total'];
      const colWidths = [18, 25, 25, 25, 12, 18, 12, 15, 20, 15, 8, 18];
      
      // Posição inicial da tabela
      const tableStartX = 15;
      let headerX = tableStartX;
      
      // Desenhar cabeçalho
      pdf.setFillColor(240, 240, 240);
      pdf.rect(tableStartX, currentY - 2, 211, 6, 'F');
      
      headers.forEach((header, index) => {
        addText(header, headerX + 1, currentY + 2, {
          fontSize: 8,
          isBold: true,
          maxWidth: colWidths[index] - 2
        });
        headerX += colWidths[index];
      });
      
      currentY += 8;
      
      // Linhas de dados
      finalData.forEach((item: any, index: number) => {
        currentY = checkNewPage(currentY, 6);
        
        // Alternar cor de fundo
        if (index % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(tableStartX, currentY - 2, 211, 6, 'F');
        }
        
        const quantidade = demonstrativoData ? (item.quantidade || 1) : (item.VALORES || 1);
        const valorTotal = demonstrativoData ? (item.valor_total || 0) : (item.valor || 0);
        
        const cells = [
          new Date().toLocaleDateString('pt-BR').substring(0, 10), // Data (placeholder)
          (item.NOME_PACIENTE || 'Paciente').toString().substring(0, 15), // Paciente
          (item.MEDICO || 'Médico').toString().substring(0, 15), // Médico
          (item.ESTUDO_DESCRICAO || item.modalidade || 'Exame').toString().substring(0, 15), // Exame
          (item.modalidade || item.MODALIDADE || 'N/A').toString().substring(0, 6), // Modal.
          (item.especialidade || item.ESPECIALIDADE || 'N/A').toString().substring(0, 10), // Espec.
          (item.categoria || item.CATEGORIA || 'SC').toString().substring(0, 6), // Categ.
          (item.prioridade || item.PRIORIDADE || 'ROTINA').toString().substring(0, 8), // Prior.
          (item.ACCESSION_NUMBER || item.accession_number || '-').toString().substring(0, 12), // Accession
          clienteData.nome.substring(0, 8), // Origem
          quantidade.toString(), // Qtd
          formatarValor(valorTotal) // Valor Total
        ];
        
        let cellX = tableStartX;
        cells.forEach((cell, cellIndex) => {
          const align = cellIndex === 10 ? 'center' : (cellIndex === 11 ? 'right' : 'left');
          addText(cell, cellX + 1, currentY + 2, {
            fontSize: 7,
            maxWidth: colWidths[cellIndex] - 2,
            align: align
          });
          cellX += colWidths[cellIndex];
        });
        
        currentY += 6;
      });
      
      // Bordas da tabela
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      
      const startTableY = currentY - (finalData.length * 6) - 8;
      pdf.rect(tableStartX, startTableY, 211, currentY - startTableY);
      
      // Linhas verticais
      let lineX = tableStartX;
      colWidths.forEach(width => {
        lineX += width;
        if (lineX < tableStartX + 211) {
          pdf.line(lineX, startTableY, lineX, currentY);
        }
      });
    }
    
    // RODAPÉ (conforme o original)
    currentY += 15;
    currentY = checkNewPage(currentY, 15);
    
    addText('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', 20, currentY, {
      fontSize: 9,
      align: 'left'
    });
    
    addText('Página 1 de 1', pageWidth - 30, currentY, {
      fontSize: 9,
      align: 'right'
    });

    // Gerar PDF e fazer upload
    const pdfBytes = pdf.output('arraybuffer');
    const fileName = `relatorio_${(cliente.nome_fantasia || cliente.nome).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${periodo}.pdf`;
    
    let pdfUrl = null;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
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