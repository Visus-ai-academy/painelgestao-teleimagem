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

    // ============= GERAÇÃO DO PDF NO FORMATO ORIGINAL =============
    const pdf = new jsPDF('l', 'mm', 'a4'); // Paisagem (landscape)
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // === CABEÇALHO CONFORME TEMPLATE ORIGINAL ===
    // Logomarca centralizada no topo
    if (logoDataUrl) {
      try {
        const logoWidth = 40;
        const logoHeight = 25;
        const logoX = (pageWidth - logoWidth) / 2;
        pdf.addImage(logoDataUrl, 'JPEG', logoX, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 5;
      } catch (e) {
        console.log('Erro ao adicionar logo ao PDF:', e);
        yPos += 30;
      }
    } else {
      yPos += 30;
    }
    
    // Título principal: RELATÓRIO DE FATURAMENTO (azul)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(0, 124, 186); // Azul conforme template original
    const titleText = 'RELATÓRIO DE FATURAMENTO';
    const titleWidth = pdf.getTextWidth(titleText);
    pdf.text(titleText, (pageWidth - titleWidth) / 2, yPos);
    yPos += 15;
    
    // === INFORMAÇÕES DO CLIENTE (Layout Original) ===
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0); // Preto
    
    pdf.text(`Cliente: ${dadosRelatorio.cliente_nome || cliente.nome}`, margin, yPos);
    yPos += 8;
    pdf.text(`CNPJ: ${formatarCNPJ(dadosRelatorio.cliente_cnpj || cliente.cnpj || 'Não informado')}`, margin, yPos);
    yPos += 8;
    pdf.setFontSize(14);
    pdf.text(`Período de referência: ${periodo}`, margin, yPos);
    yPos += 12;

    // ================= QUADRO 1 - RESUMO =================
    // Barra de título do quadro
    pdf.setFillColor(0, 124, 186);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    const q1Title = 'QUADRO 1 - RESUMO';
    const q1TitleW = pdf.getTextWidth(q1Title);
    pdf.text(q1Title, margin + (pageWidth - margin * 2) / 2 - q1TitleW / 2, yPos + 7);
    yPos += 12;

    // Moldura do quadro
    const q1Height = 40;
    pdf.setDrawColor(0, 124, 186);
    pdf.rect(margin, yPos, pageWidth - margin * 2, q1Height, 'S');

    // Conteúdo do resumo (distribuído em duas colunas)
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    const colGap = 8;
    const colW = (pageWidth - margin * 2 - colGap) / 2;
    let q1Y = yPos + 8;

    // Coluna esquerda
    pdf.text(`Cliente: ${dadosRelatorio.cliente_nome || cliente.nome}`, margin + 6, q1Y);
    q1Y += 6;
    pdf.text(`CNPJ: ${formatarCNPJ(dadosRelatorio.cliente_cnpj || cliente.cnpj || 'Não informado')}`, margin + 6, q1Y);
    q1Y += 6;
    pdf.text(`Período: ${periodo}`, margin + 6, q1Y);

    // Coluna direita (resumo financeiro)
    let q1RightY = yPos + 8;
    const rightX = margin + colW + colGap + 6;
    const bruto = demonstrativoData ? (demonstrativoData.valor_bruto || 0) : valorBrutoTotal;
    const impostos = demonstrativoData ? (demonstrativoData.valor_impostos || 0) : totalImpostos;
    const liquido = demonstrativoData ? (demonstrativoData.valor_total || 0) : valorAPagar;
    const laudos = demonstrativoData ? (demonstrativoData.total_exames || 0) : totalLaudos;
    const valorExames = demonstrativoData ? (demonstrativoData.valor_exames || 0) : 0;
    const valorFranquia = demonstrativoData ? (demonstrativoData.valor_franquia || 0) : 0;
    const valorPortal = demonstrativoData ? (demonstrativoData.valor_portal_laudos || 0) : 0;
    const valorIntegracao = demonstrativoData ? (demonstrativoData.valor_integracao || 0) : 0;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total de Laudos: ${laudos}`, rightX, q1RightY); q1RightY += 6;

    if (demonstrativoData) {
      pdf.text(`Valor Exames: R$ ${valorExames.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, q1RightY); q1RightY += 6;
      pdf.text(`Franquia: R$ ${valorFranquia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, q1RightY); q1RightY += 6;
      if (valorPortal > 0) { pdf.text(`Portal Laudos: R$ ${valorPortal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, q1RightY); q1RightY += 6; }
      if (valorIntegracao > 0) { pdf.text(`Integração: R$ ${valorIntegracao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, q1RightY); q1RightY += 6; }
    }

    pdf.text(`Valor Bruto: R$ ${bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, q1RightY); q1RightY += 6;
    if (impostos > 0) {
      pdf.text(`Impostos: R$ ${impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, q1RightY); q1RightY += 6;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text(`TOTAL A PAGAR: R$ ${liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightX, q1RightY);
    pdf.setFont('helvetica', 'normal');

    yPos += q1Height + 10;

    // ================= QUADRO 2 - DETALHAMENTO =================
    // Barra de título do quadro
    pdf.setFillColor(0, 124, 186);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    const q2Title = 'QUADRO 2 - DETALHAMENTO';
    const q2TitleW = pdf.getTextWidth(q2Title);
    pdf.text(q2Title, margin + (pageWidth - margin * 2) / 2 - q2TitleW / 2, yPos + 7);
    yPos += 12;

    // Delimitar área do quadro 2 (iremos ajustar a altura após renderizar as linhas)
    const q2StartY = yPos;

    // Cabeçalho da tabela
    if (finalData.length > 0) {
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);

      const tableHeaders = ['Modalidade', 'Especialidade', 'Categoria', 'Prioridade', 'Qtd', 'Valor Unit.', 'Valor Total'];
      const colWidths = [30, 50, 25, 25, 15, 25, 30];
      let xPos = margin;

      pdf.setFillColor(240, 240, 240);
      for (let i = 0; i < tableHeaders.length; i++) {
        pdf.rect(xPos, yPos, colWidths[i], 8, 'FD');
        pdf.text(tableHeaders[i], xPos + 2, yPos + 5);
        xPos += colWidths[i];
      }
      yPos += 8;

      // Dados
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      for (let i = 0; i < finalData.length; i++) {
        const item = finalData[i];
        xPos = margin;

        // Nova página se necessário (reinserir barra de título do quadro 2 na nova página)
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = margin;
          pdf.setFillColor(0, 124, 186);
          pdf.setTextColor(255, 255, 255);
          pdf.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          const q2t = 'QUADRO 2 - DETALHAMENTO';
          const q2tw = pdf.getTextWidth(q2t);
          pdf.text(q2t, margin + (pageWidth - margin * 2) / 2 - q2tw / 2, yPos + 7);
          yPos += 12;

          // Cabeçalho novamente
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          let xh = margin;
          pdf.setFillColor(240, 240, 240);
          for (let j = 0; j < tableHeaders.length; j++) {
            pdf.rect(xh, yPos, colWidths[j], 8, 'FD');
            pdf.text(tableHeaders[j], xh + 2, yPos + 5);
            xh += colWidths[j];
          }
          yPos += 8;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
        }

        const quantidadeStr = (demonstrativoData ? (item.quantidade ?? 1) : (item.VALORES ?? 1)).toString();
        const valorUnitStr = (demonstrativoData
          ? (item.valor_unitario ? `R$ ${item.valor_unitario.toFixed(2)}` : '')
          : (item.valor ? `R$ ${(item.valor / (Number(item.VALORES) || 1)).toFixed(2)}` : ''));
        const valorTotalStr = (demonstrativoData
          ? (item.valor_total ? `R$ ${item.valor_total.toFixed(2)}` : '')
          : (item.valor ? `R$ ${Number(item.valor).toFixed(2)}` : ''));

        const rowData = [
          item.modalidade || item.MODALIDADE || '',
          item.especialidade || item.ESPECIALIDADE || '',
          item.categoria || item.CATEGORIA || 'SC',
          item.prioridade || item.PRIORIDADE || '',
          quantidadeStr,
          valorUnitStr,
          valorTotalStr
        ];

        for (let j = 0; j < rowData.length; j++) {
          pdf.rect(xPos, yPos, colWidths[j], 6, 'S');
          const text = rowData[j]?.toString() ?? '';
          const maxWidth = colWidths[j] - 4;
          const textWidth = pdf.getTextWidth(text);
          if (textWidth > maxWidth && text.length > 10) {
            pdf.text(text.substring(0, 8) + '...', xPos + 2, yPos + 4);
          } else {
            pdf.text(text, xPos + 2, yPos + 4);
          }
          xPos += colWidths[j];
        }
        yPos += 6;
      }
    }

    // Desenhar moldura do Quadro 2
    const q2EndY = yPos;
    pdf.setDrawColor(0, 124, 186);
    pdf.rect(margin, q2StartY - 2, pageWidth - margin * 2, Math.max(20, q2EndY - q2StartY + 4), 'S');
    
    // === RODAPÉ ===
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    const footerY = pageHeight - 10;
    pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, footerY);
    pdf.text(`Página 1`, pageWidth - margin - 20, footerY);

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
});