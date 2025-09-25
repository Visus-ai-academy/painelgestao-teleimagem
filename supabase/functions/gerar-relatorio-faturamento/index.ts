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
    yPos += 10;
    
    pdf.text(`CNPJ: ${formatarCNPJ(dadosRelatorio.cliente_cnpj || cliente.cnpj || 'Não informado')}`, margin, yPos);
    yPos += 10;
    
    pdf.setFontSize(14);
    pdf.text(`Período: ${periodo}`, margin, yPos);
    yPos += 20;

    // === TABELA DE DETALHAMENTO CONFORME TEMPLATE ORIGINAL ===
    if (finalData.length > 0) {
      // Cabeçalho da tabela
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      
      const tableHeaders = ['Modalidade', 'Especialidade', 'Categoria', 'Prioridade', 'Qtd', 'Valor Unit.', 'Valor Total'];
      const colWidths = [30, 50, 25, 25, 15, 25, 30]; // Larguras das colunas para paisagem
      let xPos = margin;
      
      // Desenhar cabeçalho da tabela
      for (let i = 0; i < tableHeaders.length; i++) {
        pdf.setFillColor(240, 240, 240); // Fundo cinza claro
        pdf.rect(xPos, yPos, colWidths[i], 8, 'FD');
        pdf.text(tableHeaders[i], xPos + 2, yPos + 5);
        xPos += colWidths[i];
      }
      yPos += 8;
      
      // Dados da tabela
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      
      for (let i = 0; i < finalData.length; i++) {
        const item = finalData[i];
        xPos = margin;
        
        // Verificar se precisa de nova página
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = margin;
        }
        
        const rowData = [
          item.modalidade || item.MODALIDADE || '',
          item.especialidade || item.ESPECIALIDADE || '',
          item.categoria || item.CATEGORIA || 'SC',
          item.prioridade || item.PRIORIDADE || '',
          demonstrativoData ? (item.quantidade?.toString() || '1') : (item.VALORES?.toString() || '1'),
          demonstrativoData ? 
            (item.valor_unitario ? `R$ ${item.valor_unitario.toFixed(2)}` : '') :
            (item.valor ? `R$ ${(item.valor / (Number(item.VALORES) || 1)).toFixed(2)}` : ''),
          demonstrativoData ?
            (item.valor_total ? `R$ ${item.valor_total.toFixed(2)}` : '') :
            (item.valor ? `R$ ${Number(item.valor).toFixed(2)}` : '')
        ];
        
        for (let j = 0; j < rowData.length; j++) {
          pdf.rect(xPos, yPos, colWidths[j], 6, 'S');
          const text = rowData[j].toString();
          const textWidth = pdf.getTextWidth(text);
          const maxWidth = colWidths[j] - 4;
          
          if (textWidth > maxWidth && text.length > 10) {
            pdf.text(text.substring(0, 8) + '...', xPos + 2, yPos + 4);
          } else {
            pdf.text(text, xPos + 2, yPos + 4);
          }
          xPos += colWidths[j];
        }
        yPos += 6;
      }
      
      yPos += 10;
    }
    
    // === RESUMO DE TOTAIS NO CANTO DIREITO INFERIOR ===
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    
    const resumoX = pageWidth - 120;
    yPos = Math.max(yPos, pageHeight - 60); // Posicionar próximo ao final da página
    
    if (demonstrativoData) {
      pdf.text(`Total de Laudos: ${demonstrativoData.total_exames || 0}`, resumoX, yPos);
      yPos += 7;
      pdf.text(`Valor Bruto: R$ ${(demonstrativoData.valor_bruto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoX, yPos);
      yPos += 7;
      if (demonstrativoData.valor_impostos > 0) {
        pdf.text(`Impostos: R$ ${demonstrativoData.valor_impostos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoX, yPos);
        yPos += 7;
      }
      pdf.setFontSize(14);
      pdf.setTextColor(200, 0, 0); // Vermelho para destaque
      pdf.text(`TOTAL: R$ ${(demonstrativoData.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoX, yPos);
    } else {
      pdf.text(`Total de Laudos: ${totalLaudos}`, resumoX, yPos);
      yPos += 7;
      pdf.text(`Valor Bruto: R$ ${valorBrutoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoX, yPos);
      yPos += 7;
      pdf.text(`Impostos: R$ ${totalImpostos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoX, yPos);
      yPos += 7;
      pdf.setFontSize(14);
      pdf.setTextColor(200, 0, 0); // Vermelho
      pdf.text(`TOTAL: R$ ${valorAPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoX, yPos);
    }
    
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