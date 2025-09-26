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
    // Função para formatar CNPJ
    const formatarCNPJ = (cnpj: string): string => {
      if (!cnpj) return '';
      
      // Remove caracteres não numéricos
      const somenteNumeros = cnpj.replace(/\D/g, '');
      
      // Se não tem 14 dígitos, retorna como está
      if (somenteNumeros.length !== 14) return cnpj;
      
      // Aplica a formatação: 00.000.000/0000-00
      return somenteNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

    console.log('Função iniciada');
    
    const body = await req.json();
    const demonstrativoData = body?.demonstrativo_data || null;
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
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, nome_fantasia, cnpj')
      .eq('id', cliente_id)
      .maybeSingle();

    if (clienteError || !cliente) {
      console.log('❗ Cliente não encontrado pelo ID');
      
      // Buscar cliente com preços ativos como fallback
      const { data: clienteComPrecos } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj')
        .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
        .limit(10);
      
      if (clienteComPrecos && clienteComPrecos.length > 0) {
        cliente = clienteComPrecos[0];
        console.log(`✅ Substituído para cliente com preços: ${cliente.nome} (ID: ${clienteComPrecos[0].id})`);
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

    console.log('Cliente encontrado:', cliente.nome);

    // Calcular datas do período
    const [ano, mes] = periodo.split('-');
    const dataInicio = `${ano}-${mes.padStart(2, '0')}-01`;
    const proximoMes = parseInt(mes) === 12 ? 1 : parseInt(mes) + 1;
    const proximoAno = parseInt(mes) === 12 ? parseInt(ano) + 1 : parseInt(ano);
    const dataFim = `${proximoAno}-${proximoMes.toString().padStart(2, '0')}-01`;

    console.log(`🔍 Buscando dados para: Cliente=${cliente.nome} | NomeFantasia=${cliente.nome_fantasia} | Período=${dataInicio} a ${dataFim}`);
    
    // Buscar dados de faturamento
    console.log('📊 Buscando dados de faturamento pelo nome fantasia...');
    
    let { data: dataFaturamento, error: errorFaturamento } = await supabase
      .from('faturamento')
      .select('*, accession_number, cliente_nome_original')
      .eq('cliente_nome', cliente.nome_fantasia || cliente.nome)
      .eq('periodo_referencia', periodo)
      .gt('valor', 0);

    console.log(`📊 Faturamento encontrado: ${dataFaturamento?.length || 0} registros`);
    
    if (!dataFaturamento || dataFaturamento.length === 0) {
      // Buscar dados de volumetria como fallback
      console.log('⚠️ Nenhum dado de faturamento encontrado, tentando volumetria...');
      
      let dataVolumetria = null;
      
      // Busca por Cliente_Nome_Fantasia
      const { data: dataVolumetriaFantasia } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodo)
        .eq('"Cliente_Nome_Fantasia"', cliente.nome_fantasia || cliente.nome)
        .neq('tipo_faturamento', 'NC-NF');
      
      console.log(`📊 Volumetria (Cliente_Nome_Fantasia) encontrada: ${dataVolumetriaFantasia?.length || 0} registros`);
      
      if (dataVolumetriaFantasia && dataVolumetriaFantasia.length > 0) {
        dataVolumetria = dataVolumetriaFantasia;
      } else {
        // Busca por EMPRESA
        const candidatos = [cliente.nome_fantasia, cliente.nome].filter(Boolean);
        const { data: dataVolumetriaEmpresa } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .eq('periodo_referencia', periodo)
          .in('"EMPRESA"', candidatos as string[])
          .neq('tipo_faturamento', 'NC-NF');
        console.log(`📊 Volumetria (EMPRESA) encontrada: ${dataVolumetriaEmpresa?.length || 0} registros`);
        
        if (dataVolumetriaEmpresa && dataVolumetriaEmpresa.length > 0) {
          dataVolumetria = dataVolumetriaEmpresa;
        }
      }
      
      if (dataVolumetria && dataVolumetria.length > 0) {
        dataFaturamento = dataVolumetria;
        
        // REGRA ESPECÍFICA CEDIDIAG: apenas Medicina Interna
        const nomeFantasia = cliente.nome_fantasia || cliente.nome;
        if (nomeFantasia === 'CEDIDIAG') {
          console.log(`📊 Aplicando filtro específico CEDIDIAG: apenas Medicina Interna`);
          dataFaturamento = dataFaturamento.filter((vol: any) => {
            const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
            const medico = (vol.MEDICO || '').toString();
            
            const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA') || especialidade.includes('MEDICINA_INTERNA');
            const isExcludedDoctor = medico.includes('Rodrigo Vaz') || medico.includes('Rodrigo Lima') || 
                                    medico.includes('RODRIGO VAZ') || medico.includes('RODRIGO LIMA');
            
            return isMedicinaInterna && !isExcludedDoctor;
          });
          console.log(`📊 CEDIDIAG: Após filtro específico: ${dataFaturamento.length} registros`);
        }
      }
    }

    let finalData = dataFaturamento || [];
    
    // DADOS PARA PDF: Se demonstrativoData foi fornecido, usar seus detalhes
    if (demonstrativoData && demonstrativoData.detalhes_exames) {
      // Usar dados do demonstrativo já processado
      console.log('📋 Usando dados do demonstrativo pré-processado');
      
      // Converter detalhes_exames para formato esperado pelo PDF
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

    // Calcular impostos (exemplo: ISS 5%)
    const percentualImpostos = 0.05;
    const totalImpostos = valorBrutoTotal * percentualImpostos;
    const valorAPagar = valorBrutoTotal - totalImpostos;

    console.log(`💰 Totais calculados - Laudos: ${totalLaudos} | Bruto: ${valorBrutoTotal} | Líquido: ${valorAPagar}`);

    // Dados do relatório PDF usando demonstrativoData se disponível
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

    // Gerar PDF usando template original
    let pdfUrl = null;

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
          console.log(`Logomarca ${logomarcaData.nome_arquivo} carregada com sucesso no PDF`);
        }
      } catch (logoError) {
        console.error('Erro ao carregar logomarca:', logoError);
      }
    }

    // ============= GERAÇÃO DO PDF NO FORMATO ORIGINAL (RESTAURADO) =============
    const pdf = new jsPDF('l', 'mm', 'a4'); // Paisagem (landscape) 
    const pageWidth = pdf.internal.pageSize.getWidth(); // ~297mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // ~210mm
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);
    
    let currentY = margin;
    
    // Função para adicionar texto com quebra de linha automática
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      const fontSize = options.fontSize || 10;
      const maxWidth = options.maxWidth || contentWidth;
      const align = options.align || 'left';
      
      pdf.setFontSize(fontSize);
      if (options.bold) pdf.setFont('helvetica', 'bold');
      else pdf.setFont('helvetica', 'normal');
      
      const lines = pdf.splitTextToSize(text, maxWidth);
      
      for (let i = 0; i < lines.length; i++) {
        let textX = x;
        if (align === 'center') {
          textX = x + (maxWidth / 2) - (pdf.getTextWidth(lines[i]) / 2);
        } else if (align === 'right') {
          textX = x + maxWidth - pdf.getTextWidth(lines[i]);
        }
        
        pdf.text(lines[i], textX, y + (i * (fontSize * 0.4)));
      }
      
      return y + (lines.length * (fontSize * 0.4));
    };
    
    // Função para adicionar nova página se necessário
    const checkNewPage = (requiredSpace: number) => {
      if (currentY + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }
    };

    // Função para formatar valor
    const formatarValor = (valor: number | undefined | null): string => {
      if (valor === undefined || valor === null || isNaN(valor)) {
        return 'R$ 0,00';
      }
      return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };

    // Calcular impostos detalhados conforme template original
    const calcularImpostosDetalhados = (valorBruto: number) => {
      const irpj = valorBruto * 0.015; // 1.5%
      const pis = valorBruto * 0.0065; // 0.65%
      const cofins = valorBruto * 0.03; // 3%
      const csll = valorBruto * 0.01; // 1%
      
      return {
        irpj,
        pis,
        cofins,
        csll,
        total: irpj + pis + cofins + csll
      };
    };

    // CABEÇALHO
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
    
    // INFORMAÇÕES DO CLIENTE
    checkNewPage(80);
    
    // Retângulo para informações do cliente
    pdf.setDrawColor(200, 200, 200);
    pdf.setFillColor(248, 249, 250);
    pdf.rect(margin, currentY, contentWidth, 60, 'FD');
    
    currentY = addText(`Cliente: ${dadosRelatorio.cliente_nome || cliente.nome}`, margin + 5, currentY + 12, {
      fontSize: 16,
      bold: true,
      align: 'center',
      maxWidth: contentWidth - 10
    });
    
    currentY += 15;
    
    // Informações básicas (lado esquerdo)
    const leftColumnX = margin + 10;
    const rightColumnX = margin + (contentWidth / 2) + 10;
    let leftY = currentY;
    
    leftY = addText(`Período: ${periodo}`, leftColumnX, leftY, { fontSize: 11 });
    leftY = addText(`Total de Exames: ${demonstrativoData ? (demonstrativoData.total_exames || 0) : totalLaudos}`, leftColumnX, leftY + 6, { fontSize: 11 });
    leftY = addText(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, leftColumnX, leftY + 6, { fontSize: 11 });
    
    // Resumo financeiro (lado direito) - Formato original com impostos detalhados
    const valorBruto = demonstrativoData ? (demonstrativoData.valor_bruto || 0) : valorBrutoTotal;
    const valorExames = demonstrativoData ? (demonstrativoData.valor_exames || 0) : valorBrutoTotal;
    const valorFranquia = demonstrativoData ? (demonstrativoData.valor_franquia || 0) : 0;
    const valorIntegracao = demonstrativoData ? (demonstrativoData.valor_integracao || 0) : 0;
    const valorPortal = demonstrativoData ? (demonstrativoData.valor_portal_laudos || 0) : 0;
    const valorLiquido = demonstrativoData ? (demonstrativoData.valor_total || 0) : valorAPagar;
    
    const impostosDetalhados = calcularImpostosDetalhados(valorBruto);
    
    const resumoData = [
      ['Valor Exames', formatarValor(valorExames)],
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
      
      rightY = addText(row[0], rightColumnX + 2, rightY, { 
        fontSize: isTotal ? 12 : 10, 
        bold: isTotal 
      });
      
      addText(row[1], rightColumnX + 2, rightY - (isTotal ? 4.8 : 4), { 
        fontSize: isTotal ? 12 : 10, 
        bold: isTotal,
        align: 'right',
        maxWidth: colWidth - 4
      });
      
      rightY += isTotal ? 10 : 6;
    });
    
    currentY = Math.max(leftY, rightY) + 10;
    
    // TABELA DE EXAMES DETALHADA (FORMATO ORIGINAL)
    checkNewPage(50);
    
    currentY = addText('Detalhamento dos Exames', margin, currentY + 10, {
      fontSize: 14,
      bold: true
    });
    
    currentY += 15;
    
    // Cabeçalho da tabela
    const headers = ['Modalidade', 'Especialidade', 'Categoria', 'Prioridade', 'Qtd', 'Valor Total'];
    const colWidths = [35, 50, 30, 30, 20, 30]; // Total: 195mm
    
    let tableX = margin + ((contentWidth - 195) / 2); // Centralizar tabela
    
    // Desenhar cabeçalho
    pdf.setFillColor(37, 99, 235);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(tableX, currentY, 195, 8, 'F');
    
    let headerX = tableX;
    headers.forEach((header, index) => {
      addText(header, headerX + 1, currentY + 6, {
        fontSize: 9,
        bold: true,
        maxWidth: colWidths[index] - 2
      });
      headerX += colWidths[index];
    });
    
    currentY += 8;
    pdf.setTextColor(0, 0, 0);
    
    // Desenhar linhas da tabela
    if (finalData && finalData.length > 0) {
      finalData.forEach((exame: any, index: number) => {
        checkNewPage(6);
        
        // Alternar cor de fundo
        if (index % 2 === 0) {
          pdf.setFillColor(248, 249, 250);
          pdf.rect(tableX, currentY, 195, 6, 'F');
        }
        
        const quantidade = demonstrativoData ? (exame.quantidade ?? 1) : (exame.VALORES ?? 1);
        const valorTotal = demonstrativoData ? (exame.valor_total ?? 0) : (exame.valor ?? 0);
        
        const cells = [
          (exame.modalidade || exame.MODALIDADE || 'N/A').toString().substring(0, 12),
          (exame.especialidade || exame.ESPECIALIDADE || 'N/A').toString().substring(0, 20),
          (exame.categoria || exame.CATEGORIA || 'N/A').toString().substring(0, 12),
          (exame.prioridade || exame.PRIORIDADE || 'N/A').toString().substring(0, 12),
          quantidade.toString(),
          formatarValor(valorTotal)
        ];
        
        let cellX = tableX;
        cells.forEach((cell, cellIndex) => {
          const align = cellIndex === 4 ? 'center' : cellIndex === 5 ? 'right' : 'left';
          addText(cell, cellX + 1, currentY + 4, {
            fontSize: 8,
            maxWidth: colWidths[cellIndex] - 2,
            align: align
          });
          cellX += colWidths[cellIndex];
        });
        
        currentY += 6;
      });
    }
    
    // Desenhar bordas da tabela
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    
    // Bordas externas 
    const tableStartY = margin + 85;
    pdf.rect(tableX, tableStartY, 195, currentY - tableStartY);
    
    // Linhas verticais
    let lineX = tableX;
    colWidths.forEach(width => {
      lineX += width;
      if (lineX < tableX + 195) {
        pdf.line(lineX, tableStartY, lineX, currentY);
      }
    });
    
    // RODAPÉ
    currentY += 20;
    checkNewPage(20);
    
    // Gerar bytes do PDF
    const pdfBytes = pdf.output('arraybuffer');

    // Upload para Supabase Storage
    const fileName = `relatorio_${(cliente.nome_fantasia || cliente.nome).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${periodo}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Erro no upload do PDF:', uploadError);
    } else {
      // Gerar URL pública
      const { data: urlData } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(fileName);
      
      pdfUrl = urlData.publicUrl;
      console.log(`Relatório PDF gerado com sucesso: ${pdfUrl}`);
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

    // Gerar bytes do PDF
    const pdfBytes = pdf.output('arraybuffer');

    // Upload para Supabase Storage
    const fileName = `relatorio_${(cliente.nome_fantasia || cliente.nome).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${periodo}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Erro no upload do PDF:', uploadError);
    } else {
      // Gerar URL pública
      const { data: urlData } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(fileName);
      
      pdfUrl = urlData.publicUrl;
      console.log(`Relatório PDF gerado com sucesso: ${pdfUrl}`);
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
