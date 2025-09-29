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
      const quantidade = demonstrativoData 
        ? (item.quantidade || 0) 
        : (Number(item.VALORES) || Number(item.quantidade) || 0);
      
      const valor = demonstrativoData
        ? (Number(item.valor_total) || 0)
        : (Number(item.valor) || 0);

      totalLaudos += quantidade;
      valorBrutoTotal += valor;
    }

    // Tentar buscar demonstrativo calculado (modelo anterior ao 23/09/2025)
    const { data: demo } = await supabase
      .from('demonstrativos_faturamento_calculados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .eq('periodo_referencia', periodo)
      .order('calculado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Definir valores base priorizando demonstrativo calculado
    let valorExames = demonstrativoData 
      ? (Number(demonstrativoData.valor_exames ?? demonstrativoData.valor_bruto) || 0) 
      : valorBrutoTotal;
    let valorFranquia = demonstrativoData ? (Number(demonstrativoData.valor_franquia) || 0) : 0;
    let valorPortal = demonstrativoData ? (Number(demonstrativoData.valor_portal_laudos) || 0) : 0;
    let valorIntegracao = demonstrativoData ? (Number(demonstrativoData.valor_integracao) || 0) : 0;

    if (demo) {
      totalLaudos = Number(demo.total_exames ?? totalLaudos) || totalLaudos;
      // Valor Bruto (modelo antigo usava valor_bruto_total)
      valorExames = Number(demo.valor_bruto_total ?? demo.valor_exames ?? valorExames) || 0;
      valorFranquia = Number(demo.valor_franquia || 0);
      valorPortal = Number(demo.valor_portal_laudos || 0);
      valorIntegracao = Number(demo.valor_integracao || 0);
    }
    
    const baseCalculo = valorExames + valorFranquia + valorPortal + valorIntegracao;

    // Impostos - usar exatamente os do demonstrativo, se fornecidos; caso contrário, calcular
    let pis = 0, cofins = 0, csll = 0, irrf = 0;

    if (demonstrativoData) {
      const hasBreakdown = ['pis', 'cofins', 'csll', 'irrf'].some((k) => demonstrativoData[k] != null);
      const totalImpostosFed = Number(demonstrativoData.valor_impostos_federais ?? demonstrativoData.valor_total_impostos ?? 0) || 0;

      if (hasBreakdown) {
        pis = Number(demonstrativoData.pis || 0);
        cofins = Number(demonstrativoData.cofins || 0);
        csll = Number(demonstrativoData.csll || 0);
        irrf = Number(demonstrativoData.irrf || 0);
      } else if (totalImpostosFed > 0) {
        // Alocar proporcionalmente às alíquotas para refletir exatamente o total do demonstrativo
        const rates = [0.0065, 0.03, 0.01, 0.015];
        const sumRates = rates.reduce((a,b)=>a+b,0); // 0.0615
        const alloc = rates.map(r => Number(((totalImpostosFed * r) / sumRates).toFixed(2)));
        let allocSum = alloc.reduce((a,b)=>a+b,0);
        const diff = Number((totalImpostosFed - allocSum).toFixed(2));
        // Ajustar diferença de arredondamento no último imposto (IRRF)
        alloc[3] = Number((alloc[3] + diff).toFixed(2));
        ;[pis, cofins, csll, irrf] = alloc as [number, number, number, number];
      } else {
        // Fallback: calcular pelas alíquotas padrão
        pis = baseCalculo * 0.0065;
        cofins = baseCalculo * 0.03;
        csll = baseCalculo * 0.01;
        irrf = baseCalculo * 0.015;
      }
    } else {
      // Sem demonstrativo: calcular normalmente
      pis = baseCalculo * 0.0065;      // 0.65%
      cofins = baseCalculo * 0.03;     // 3%
      csll = baseCalculo * 0.01;       // 1%
      irrf = baseCalculo * 0.015;      // 1.5%
    }

    // Valor líquido - priorizar o do demonstrativo, se houver
    const valorLiquido = demonstrativoData && (demonstrativoData.valor_liquido != null)
      ? Number(demonstrativoData.valor_liquido)
      : (baseCalculo - pis - cofins - csll - irrf);


    // ============= GERAÇÃO DO PDF - TEMPLATE ORIGINAL (pré 23/09/2025) =============
    const pdf = new jsPDF('l', 'mm', 'a4'); // Formato paisagem
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
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
        pdf.text(lines[i], textX, y + (i * (fontSize * 0.35)));
      }
      return y + (lines.length * (fontSize * 0.35));
    };

    const checkNewPage = (requiredSpace: number) => {
      if (currentY + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
        return true;
      }
      return false;
    };

    const formatarValor = (valor: number) => `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // ================ PÁGINA 1 - LOGOMARCA E RESUMO ================
    
    // Tentar carregar logomarca do storage
    let logoAdded = false;
    try {
      const extensions = ['png', 'jpg', 'jpeg'];
      for (const ext of extensions) {
        const fileName = `logomarca.${ext}`;
        const { data } = supabase.storage
          .from('logomarcas')
          .getPublicUrl(fileName);
        const publicUrl = data?.publicUrl;
        if (publicUrl) {
          const resp = await fetch(publicUrl);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const base64 = btoa(binary);
            const dataUrl = `data:image/${ext};base64,${base64}`;
            // Inserir logo centralizada no topo
            const logoWidth = 60; // mm
            const logoHeight = 20; // mm aprox.
            const logoX = (pageWidth - logoWidth) / 2;
            const logoY = margin - 5;
            pdf.addImage(dataUrl, ext.toUpperCase() === 'PNG' ? 'PNG' : 'JPEG', logoX, logoY, logoWidth, logoHeight);
            currentY = Math.max(currentY, logoY + logoHeight);
            logoAdded = true;
            break;
          }
        }
      }
    } catch (error) {
      console.log('Logomarca não encontrada, usando texto');
    }
    
    // Logomarca/título
    if (!logoAdded) {
      currentY = addText('TELEiMAGEM', margin, currentY + 15, {
        fontSize: 18,
        bold: true,
        align: 'center',
        maxWidth: contentWidth
      });
    }
    
    currentY = addText('EXCELÊNCIA EM TELERRADIOLOGIA', margin, currentY + 8, {
      fontSize: 12,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 15;

    // Título centralizado
    currentY = addText('RELATÓRIO DE FATURAMENTO', margin, currentY + 10, {
      fontSize: 16,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 15;

    // Informações do cliente e data (layout horizontal)
    const clienteNome = cliente.nome_fantasia || cliente.nome;
    const leftInfoX = margin;
    const rightInfoX = pageWidth - margin - 80;

    currentY = addText(`Cliente: ${clienteNome}`, leftInfoX, currentY, { fontSize: 12, bold: true });
    addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, rightInfoX, currentY, { fontSize: 12 });

    currentY = addText(`CNPJ: ${cliente.cnpj || 'N/A'}`, leftInfoX, currentY + 8, { fontSize: 12 });
    currentY = addText(`Período: ${periodo}`, leftInfoX, currentY + 8, { fontSize: 12 });

    currentY += 20;

    // ================ QUADRO 1 - RESUMO ================
    currentY = addText('QUADRO 1 - RESUMO', margin, currentY + 10, {
      fontSize: 14,
      bold: true,
      maxWidth: contentWidth
    });

    currentY += 15;

    // Criar tabela de resumo (modelo anterior a 23/09/2025)
    const resumoItems = [
      ['Total de Laudos:', totalLaudos.toString()],
      ['Valor Bruto:', formatarValor(valorExames)],
      ['Franquia:', formatarValor(valorFranquia)],
      ['Portal de Laudos:', formatarValor(valorPortal)]
    ];

    // Desenhar tabela de resumo
    const resumoTableWidth = 180;
    const resumoTableX = (pageWidth - resumoTableWidth) / 2;
    const rowHeight = 8;

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);

    resumoItems.forEach((item, index) => {
      const rowY = currentY + (index * rowHeight);
      
      // Bordas da linha
      pdf.rect(resumoTableX, rowY, resumoTableWidth, rowHeight);
      pdf.line(resumoTableX + 120, rowY, resumoTableX + 120, rowY + rowHeight);

      // Texto
      addText(item[0], resumoTableX + 5, rowY + 5.5, { fontSize: 11 });
      addText(item[1], resumoTableX + 125, rowY + 5.5, { fontSize: 11, bold: true });
    });

    currentY += (resumoItems.length * rowHeight) + 20;

    // VALOR A PAGAR (destacado e separado da tabela, conforme modelo esperado)
    currentY = addText(`VALOR A PAGAR: ${formatarValor(valorLiquido)}`, margin, currentY + 10, {
      fontSize: 14,
      bold: true,
      maxWidth: contentWidth
    });

    currentY += 20;

    // Rodapé da página 1 (conforme modelo esperado)
    addText('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', 
      margin, pageHeight - 30, { fontSize: 8, align: 'center', maxWidth: contentWidth });
    
    const totalPaginas = Math.ceil(finalData.length / 30) + 1; // 30 linhas por página + página 1
    addText(`Página 1 de ${totalPaginas}`, 
      margin, pageHeight - 20, { fontSize: 8, align: 'center', maxWidth: contentWidth });

    // ================ PÁGINA 2+ - QUADRO 2 - DETALHAMENTO ================
    if (finalData && finalData.length > 0) {
      pdf.addPage();
      currentY = margin;

      currentY = addText('QUADRO 2 - DETALHAMENTO', margin, currentY + 15, {
        fontSize: 14,
        bold: true,
        maxWidth: contentWidth
      });

      currentY += 20;

      // Cabeçalhos conforme o modelo original
      const headers = ['Data', 'Paciente', 'Médico', 'Exame', 'Modal.', 'Espec.', 'Categ.', 'Prior.', 'Accession', 'Origem', 'Qtd', 'Valor Total'];
      const colWidths = [18, 25, 25, 30, 15, 20, 15, 18, 20, 20, 12, 22]; // total 240mm

      let tableX = (pageWidth - 240) / 2;

      // Cabeçalho da tabela
      pdf.setFillColor(220, 220, 220);
      pdf.rect(tableX, currentY, 240, 10, 'F');
      pdf.setDrawColor(0, 0, 0);
      pdf.rect(tableX, currentY, 240, 10);

      let headerX = tableX;
      headers.forEach((header, index) => {
        if (index > 0) {
          pdf.line(headerX, currentY, headerX, currentY + 10);
        }
        addText(header, headerX + 2, currentY + 7, { fontSize: 9, bold: true, maxWidth: colWidths[index] - 4 });
        headerX += colWidths[index];
      });

      currentY += 10;

      // Linhas de dados
      let rowCount = 0;
      finalData.forEach((item: any, index: number) => {
        if (rowCount >= 35) { // Nova página a cada 35 linhas
          pdf.addPage();
          currentY = margin + 20;
          rowCount = 0;
          
          // Repetir cabeçalho
          pdf.setFillColor(220, 220, 220);
          pdf.rect(tableX, currentY, 240, 10, 'F');
          pdf.rect(tableX, currentY, 240, 10);
          
          let headerX = tableX;
          headers.forEach((header, index) => {
            if (index > 0) {
              pdf.line(headerX, currentY, headerX, currentY + 10);
            }
            addText(header, headerX + 2, currentY + 7, { fontSize: 9, bold: true, maxWidth: colWidths[index] - 4 });
            headerX += colWidths[index];
          });
          currentY += 10;
        }

        // Linha zebrada
        if (index % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(tableX, currentY, 240, 8, 'F');
        }

        pdf.rect(tableX, currentY, 240, 8);

        // Preparar dados da linha com formatação correta
        const dataExame = item.data_exame || item.DATA_EXAME || item.DATA_REALIZACAO || '';
        const dataFormatada = dataExame ? new Date(dataExame).toLocaleDateString('pt-BR') : '';
        
        // Melhorar formatação dos nomes (truncar mas manter legível)
        const paciente = (item.paciente || item.NOME_PACIENTE || '').toString().substring(0, 15);
        const medico = (item.laudado_por || item.medico || item.MEDICO || '').toString().replace(/^(DR\.?\s*|DRA\.?\s*)/i, '').substring(0, 15);
        const exame = (item.nome_exame || item.ESTUDO_DESCRICAO || '').toString().substring(0, 15);
        const modalidade = (item.modalidade || item.MODALIDADE || '').toString().substring(0, 6);
        const especialidade = (item.especialidade || item.ESPECIALIDADE || '').toString().substring(0, 10);
        const categoria = (item.categoria || item.CATEGORIA || 'SC').toString().substring(0, 6);
        const prioridade = (item.prioridade || item.PRIORIDADE || 'ROTINA').toString().substring(0, 8);
        const accession = (item.accession_number || item.ACCESSION_NUMBER || '-').toString().substring(0, 10);
        const origem = (item.unidade_origem || item.cliente || clienteNome || '').toString().substring(0, 9);
        const qtd = (demonstrativoData ? (item.quantidade || 0) : (item.VALORES || item.quantidade || 0));
        const valorTot = (demonstrativoData ? (item.valor_total || 0) : (item.valor || 0));

        const cells = [
          dataFormatada,
          paciente,
          medico,
          exame,
          modalidade,
          especialidade,
          categoria,
          prioridade,
          accession,
          origem,
          qtd.toString(),
          formatarValor(valorTot)
        ];

        // Desenhar células
        let cellX = tableX;
        cells.forEach((cell, cellIndex) => {
          if (cellIndex > 0) {
            pdf.line(cellX, currentY, cellX, currentY + 8);
          }
          const align = cellIndex === 10 ? 'center' : (cellIndex === 11 ? 'right' : 'left');
          addText(cell, cellX + 2, currentY + 5.5, { fontSize: 8, maxWidth: colWidths[cellIndex] - 4, align });
          cellX += colWidths[cellIndex];
        });

        currentY += 8;
        rowCount++;
      });
    }

    // Gerar PDF e fazer upload
    const pdfBytes = pdf.output('arraybuffer');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `relatorio_${(cliente.nome_fantasia || cliente.nome).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${periodo}_${timestamp}.pdf`;
    
    let pdfUrl = null;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
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