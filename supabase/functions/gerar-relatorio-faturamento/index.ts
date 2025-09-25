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

    // Buscar dados do cliente (prioritizar o que tem preços se houver duplicatas)
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, nome_fantasia, cnpj')
      .eq('id', cliente_id)
      .maybeSingle();

    // Se não encontrou ou se não tem preços, tentar buscar versão com preços
    if (!cliente || clienteError) {
      console.log('❗ Cliente não encontrado pelo ID, buscando versão com preços...');
      
      // Buscar cliente com mesmo nome que tenha preços ativos
      const { data: clienteComPrecos } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj')
        .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
        .limit(10);
      
      if (clienteComPrecos && clienteComPrecos.length > 0) {
        // Se há apenas um, usar esse
        if (clienteComPrecos.length === 1) {
          cliente = clienteComPrecos[0];
          console.log(`✅ Substituído para cliente com preços: ${cliente.nome} (ID: ${clienteComPrecos[0].id})`);
        } else {
          // Se há vários, usar o primeiro (pode melhorar a lógica aqui se necessário)
          cliente = clienteComPrecos[0];
          console.log(`⚠️ Múltiplos clientes com preços encontrados, usando: ${cliente.nome}`);
        }
      }
    }

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

    console.log(`🔍 Buscando dados para: Cliente=${cliente.nome} | NomeFantasia=${cliente.nome_fantasia} | Período=${dataInicio} a ${dataFim}`);
    
    // Buscar dados de faturamento usando NOME FANTASIA do cliente prioritariamente
    console.log('📊 Buscando dados de faturamento pelo nome fantasia...');
    
    let { data: dataFaturamento, error: errorFaturamento } = await supabase
      .from('faturamento')
      .select('*, accession_number, cliente_nome_original')
      .eq('cliente_nome', cliente.nome_fantasia || cliente.nome) // Usar nome_fantasia prioritariamente
      .eq('periodo_referencia', periodo)
      .gt('valor', 0); // Filtrar apenas registros com valor > 0

    console.log(`📊 Faturamento encontrado: ${dataFaturamento?.length || 0} registros`);
    
    if (!dataFaturamento || dataFaturamento.length === 0) {
      // Buscar dados de volumetria como fallback (cliente_nome_fantasia) COM AGRUPAMENTO
      console.log('⚠️ Nenhum dado de faturamento encontrado, tentando volumetria...');
      
      let dataVolumetria = null;
      
      // Estratégia 1: Busca por Cliente_Nome_Fantasia
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
        // Estratégia 2: Busca por EMPRESA com múltiplos candidatos
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
        
        // REGRA ESPECÍFICA CEDIDIAG: apenas Medicina Interna, excluindo médico específico
        const nomeFantasia = cliente.nome_fantasia || cliente.nome;
        if (nomeFantasia === 'CEDIDIAG') {
          console.log(`📊 Aplicando filtro específico CEDIDIAG: apenas Medicina Interna`);
          dataFaturamento = dataFaturamento.filter((vol: any) => {
            const especialidade = (vol.ESPECIALIDADE || '').toString().toUpperCase();
            const medico = (vol.MEDICO || '').toString();
            
            // Apenas Medicina Interna
            const isMedicinaInterna = especialidade.includes('MEDICINA INTERNA') || especialidade.includes('MEDICINA_INTERNA');
            
            // Excluir Dr. Rodrigo Vaz Lima (verificar variações do nome)
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

    // Gerar PDF usando o demonstrativoData se fornecido
    let pdfUrl = null;

    // PDF generation logic
    // Buscar logomarca da tabela logomarca
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

    // Configurar PDF com modelo profissional
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // === CABEÇALHO PRINCIPAL ===
    // Adicionar logomarca se disponível
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'JPEG', margin, yPos, 50, 20);
      } catch (e) {
        console.log('Erro ao adicionar logo ao PDF:', e);
      }
    }
    
    // Título principal (lado direito)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(44, 62, 80); // Azul escuro
    pdf.text('DEMONSTRATIVO DE FATURAMENTO', pageWidth - margin, yPos + 10, { align: 'right' });
    
    yPos += 35;
    
    // Linha separadora
    pdf.setDrawColor(52, 152, 219); // Azul
    pdf.setLineWidth(1);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // === INFORMAÇÕES DO CLIENTE ===
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(52, 73, 94); 
    pdf.text('DADOS DO CLIENTE', margin, yPos);
    yPos += 8;
    
    // Caixa de informações do cliente
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, yPos - 3, contentWidth, 25, 'F');
    pdf.setDrawColor(189, 195, 199);
    pdf.rect(margin, yPos - 3, contentWidth, 25);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(44, 62, 80);
    
    pdf.text(`CLIENTE: ${dadosRelatorio.cliente_nome || cliente.nome}`, margin + 5, yPos + 5);
    pdf.text(`CNPJ: ${formatarCNPJ(dadosRelatorio.cliente_cnpj || cliente.cnpj || 'Não informado')}`, margin + 5, yPos + 12);
    pdf.text(`PERÍODO DE REFERÊNCIA: ${periodo}`, margin + 5, yPos + 19);
    
    yPos += 35;

    // === RESUMO EXECUTIVO ===
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(52, 73, 94);
    pdf.text('RESUMO EXECUTIVO', margin, yPos);
    yPos += 8;
    
    // Caixa do resumo executivo
    pdf.setFillColor(236, 240, 241);
    const resumoHeight = 40;
    pdf.rect(margin, yPos - 3, contentWidth, resumoHeight, 'F');
    pdf.setDrawColor(189, 195, 199);
    pdf.rect(margin, yPos - 3, contentWidth, resumoHeight);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(44, 62, 80);
    
    let resumoY = yPos + 5;
    
    if (demonstrativoData) {
      // Linha 1: Exames e Valor dos Exames
      pdf.text(`Total de Exames Realizados: ${demonstrativoData.total_exames || 0}`, margin + 5, resumoY);
      pdf.text(`Valor dos Exames: R$ ${(demonstrativoData.valor_exames || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + contentWidth/2, resumoY);
      resumoY += 7;
      
      // Linha 2: Franquia e Portal (se aplicável)
      if (demonstrativoData.valor_franquia > 0 || demonstrativoData.valor_portal_laudos > 0) {
        if (demonstrativoData.valor_franquia > 0) {
          pdf.text(`Franquia: R$ ${demonstrativoData.valor_franquia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, resumoY);
        }
        if (demonstrativoData.valor_portal_laudos > 0) {
          pdf.text(`Portal de Laudos: R$ ${demonstrativoData.valor_portal_laudos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + contentWidth/2, resumoY);
        }
        resumoY += 7;
      }
      
      // Linha 3: Integração (se aplicável)
      if (demonstrativoData.valor_integracao > 0) {
        pdf.text(`Integração: R$ ${demonstrativoData.valor_integracao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, resumoY);
        resumoY += 7;
      }
      
      // Linha separadora
      pdf.setDrawColor(127, 140, 141);
      pdf.line(margin + 5, resumoY, pageWidth - margin - 5, resumoY);
      resumoY += 5;
      
      // Valores finais
      pdf.text(`Valor Bruto Total: R$ ${(demonstrativoData.valor_bruto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, resumoY);
      pdf.text(`Total de Impostos: R$ ${(demonstrativoData.valor_impostos || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + contentWidth/2, resumoY);
      resumoY += 7;
      
      // Valor líquido destacado
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(231, 76, 60); // Vermelho para destaque
      pdf.text(`VALOR LÍQUIDO A FATURAR: R$ ${(demonstrativoData.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, resumoY);
      
    } else {
      // Fallback para dados básicos
      pdf.text(`Total de Exames: ${totalLaudos}`, margin + 5, resumoY);
      resumoY += 7;
      pdf.text(`Valor Bruto: R$ ${valorBrutoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, resumoY);
      resumoY += 7;
      pdf.text(`Impostos: R$ ${totalImpostos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, resumoY);
      resumoY += 7;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`VALOR A PAGAR: R$ ${valorAPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, resumoY);
    }
    
    yPos += resumoHeight + 15;

    // === INFORMAÇÕES TRIBUTÁRIAS ===
    if (demonstrativoData?.detalhes_tributacao) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(52, 73, 94);
      pdf.text('INFORMAÇÕES TRIBUTÁRIAS', margin, yPos);
      yPos += 8;
      
      const trib = demonstrativoData.detalhes_tributacao;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(44, 62, 80);
      
      pdf.text(`• Regime Tributário: ${trib.simples_nacional ? 'Simples Nacional' : 'Regime Normal'}`, margin + 5, yPos);
      yPos += 6;
      
      if (trib.percentual_iss) {
        pdf.text(`• ISS (${trib.percentual_iss}%): R$ ${(trib.valor_iss || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, yPos);
        yPos += 6;
      }
      
      if (trib.valor_irrf && trib.valor_irrf > 0) {
        pdf.text(`• IRRF (1,5%): R$ ${trib.valor_irrf.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, yPos);
        yPos += 6;
      }
      
      if (trib.impostos_ab_min && trib.impostos_ab_min > 0) {
        pdf.text(`• Imposto Mínimo Aplicado: R$ ${trib.impostos_ab_min.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, margin + 5, yPos);
        yPos += 6;
      }
      
      yPos += 10;
    }

    // === DETALHAMENTO DOS SERVIÇOS ===
    if (finalData.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(52, 73, 94);
      pdf.text('DETALHAMENTO DOS SERVIÇOS', margin, yPos);
      yPos += 10;
      
      // Cabeçalho da tabela
      const headerHeight = 8;
      const rowHeight = 7;
      const colWidths = [25, 45, 25, 15, 25, 25]; // Modalidade, Especialidade, Categoria, Qtd, V.Unit, V.Total
      const headers = ['Modalidade', 'Especialidade', 'Categoria', 'Qtd', 'Valor Unit.', 'Valor Total'];
      
      // Fundo do cabeçalho
      pdf.setFillColor(52, 152, 219); // Azul
      pdf.rect(margin, yPos - 2, contentWidth, headerHeight, 'F');
      
      // Texto do cabeçalho
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255); // Branco
      
      let xPos = margin + 2;
      headers.forEach((header, i) => {
        pdf.text(header, xPos, yPos + 4);
        xPos += colWidths[i];
      });
      
      yPos += headerHeight + 2;
      
      // Dados da tabela
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(44, 62, 80);
      
      let alternateRow = false;
      finalData.forEach((item, index) => {
        if (yPos > pageHeight - 20) {
          // Nova página se necessário
          pdf.addPage();
          yPos = margin;
        }
        
        // Fundo alternado para linhas
        if (alternateRow) {
          pdf.setFillColor(248, 249, 250);
          pdf.rect(margin, yPos - 1, contentWidth, rowHeight, 'F');
        }
        
        xPos = margin + 2;
        const modalidade = demonstrativoData ? item.modalidade : (item.MODALIDADE || item.modalidade || '');
        const especialidade = demonstrativoData ? item.especialidade : (item.ESPECIALIDADE || item.especialidade || '');
        const categoria = demonstrativoData ? item.categoria : (item.CATEGORIA || item.categoria || 'SC');
        const quantidade = demonstrativoData ? item.quantidade : (item.VALORES || item.quantidade || 0);
        const valorUnit = demonstrativoData ? item.valor_unitario : (item.valor_unitario || 0);
        const valorTotal = demonstrativoData ? item.valor_total : (item.valor_total || item.valor || 0);
        
        // Truncar textos longos
        pdf.text(modalidade.toString().substring(0, 10), xPos, yPos + 3);
        xPos += colWidths[0];
        pdf.text(especialidade.toString().substring(0, 18), xPos, yPos + 3);
        xPos += colWidths[1];
        pdf.text(categoria.toString().substring(0, 10), xPos, yPos + 3);
        xPos += colWidths[2];
        pdf.text(quantidade.toString(), xPos, yPos + 3);
        xPos += colWidths[3];
        pdf.text(`R$ ${Number(valorUnit).toFixed(2)}`, xPos, yPos + 3);
        xPos += colWidths[4];
        pdf.text(`R$ ${Number(valorTotal).toFixed(2)}`, xPos, yPos + 3);
        
        yPos += rowHeight;
        alternateRow = !alternateRow;
      });
      
      yPos += 10;
    }

    // === RODAPÉ ===
    yPos = pageHeight - 40;
    
    // Linha separadora
    pdf.setDrawColor(52, 152, 219);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(127, 140, 141);
    pdf.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, yPos);
    pdf.text('Sistema de Gestão Teleimagem', pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;
    pdf.text('Este documento é válido apenas para o período especificado', margin, yPos);
    
    // Numeração de páginas
    const totalPages = pdf.internal.pages.length - 1;
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(127, 140, 141);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }
    }

    // Salvar PDF no storage
    const pdfBytes = pdf.output('arraybuffer');
    const fileName = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}.pdf`;
    
    // Upload para storage
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

    // Sempre retornar sucesso, mesmo sem dados
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
