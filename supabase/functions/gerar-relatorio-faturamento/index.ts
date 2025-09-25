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

    // Configurar PDF
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    // Adicionar logomarca se disponível
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'JPEG', margin, 10, 40, 20);
      } catch (e) {
        console.log('Erro ao adicionar logo ao PDF:', e);
      }
    }

    // Cabeçalho
    pdf.setFontSize(16);
    pdf.text('RELATÓRIO DE FATURAMENTO', pageWidth - margin, 20, { align: 'right' });

    // Informações do cliente
    pdf.setFontSize(12);
    pdf.text(`Cliente: ${dadosRelatorio.cliente_nome || cliente.nome}`, margin, 40);
    pdf.text(`CNPJ: ${formatarCNPJ(dadosRelatorio.cliente_cnpj || cliente.cnpj || '')}`, margin, 50);
    pdf.text(`Período: ${periodo}`, margin, 60);

    // Resumo financeiro
    pdf.setFontSize(14);
    pdf.text('RESUMO FINANCEIRO', margin, 80);
    
    pdf.setFontSize(10);
    let yPos = 90;
    
    // Usar dados do demonstrativo se disponível
    if (demonstrativoData) {
      pdf.text(`Total de Exames: ${demonstrativoData.total_exames}`, margin, yPos);
      yPos += 10;
      pdf.text(`Valor dos Exames: R$ ${demonstrativoData.valor_exames?.toFixed(2) || '0,00'}`, margin, yPos);
      yPos += 10;
      
      if (demonstrativoData.valor_franquia > 0) {
        pdf.text(`Valor da Franquia: R$ ${demonstrativoData.valor_franquia.toFixed(2)}`, margin, yPos);
        yPos += 10;
      }
      
      if (demonstrativoData.valor_portal_laudos > 0) {
        pdf.text(`Portal de Laudos: R$ ${demonstrativoData.valor_portal_laudos.toFixed(2)}`, margin, yPos);
        yPos += 10;
      }
      
      if (demonstrativoData.valor_integracao > 0) {
        pdf.text(`Integração: R$ ${demonstrativoData.valor_integracao.toFixed(2)}`, margin, yPos);
        yPos += 10;
      }
      
      pdf.text(`Valor Bruto: R$ ${demonstrativoData.valor_bruto?.toFixed(2) || '0,00'}`, margin, yPos);
      yPos += 10;
      
      if (demonstrativoData.valor_impostos > 0) {
        pdf.text(`Impostos: R$ ${demonstrativoData.valor_impostos.toFixed(2)}`, margin, yPos);
        yPos += 10;
      }
      
      pdf.setFontSize(12);
      pdf.text(`VALOR LÍQUIDO: R$ ${demonstrativoData.valor_total?.toFixed(2) || '0,00'}`, margin, yPos);
      yPos += 15;
      
      // Detalhes de tributação se disponível
      if (demonstrativoData.detalhes_tributacao) {
        pdf.setFontSize(10);
        const trib = demonstrativoData.detalhes_tributacao;
        pdf.text(`Regime: ${trib.simples_nacional ? 'Simples Nacional' : 'Regime Normal'}`, margin, yPos);
        yPos += 10;
        
        if (trib.percentual_iss) {
          pdf.text(`ISS: ${trib.percentual_iss}% - R$ ${trib.valor_iss?.toFixed(2) || '0,00'}`, margin, yPos);
          yPos += 10;
        }
        
        if (trib.valor_irrf) {
          pdf.text(`IRRF: 1,5% - R$ ${trib.valor_irrf.toFixed(2)}`, margin, yPos);
          yPos += 10;
        }
        
        yPos += 10;
      }
    } else {
      // Fallback para dados básicos
      pdf.text(`Total de Exames: ${totalLaudos}`, margin, yPos);
      yPos += 10;
      pdf.text(`Valor Bruto: R$ ${valorBrutoTotal.toFixed(2)}`, margin, yPos);
      yPos += 10;
      pdf.text(`Impostos: R$ ${totalImpostos.toFixed(2)}`, margin, yPos);
      yPos += 10;
      pdf.setFontSize(12);
      pdf.text(`VALOR A PAGAR: R$ ${valorAPagar.toFixed(2)}`, margin, yPos);
      yPos += 15;
    }

    // Tabela de detalhes (se há dados)
    if (finalData.length > 0) {
      pdf.setFontSize(10);
      pdf.text('DETALHES POR ESPECIALIDADE/MODALIDADE:', margin, yPos);
      yPos += 10;
      
      // Cabeçalho da tabela
      const headers = ['Modalidade', 'Especialidade', 'Categoria', 'Qtd', 'Valor Unit.', 'Valor Total'];
      const colWidths = [30, 40, 25, 20, 25, 30];
      let xPos = margin;
      
      headers.forEach((header, i) => {
        pdf.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      
      yPos += 5;
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      
      // Dados da tabela (primeiros 20 para não estourar página)
      const dadosTabela = finalData.slice(0, 20);
      
      dadosTabela.forEach((item) => {
        if (yPos > pageHeight - 30) return; // Evitar sair da página
        
        xPos = margin;
        const modalidade = demonstrativoData ? item.modalidade : (item.MODALIDADE || item.modalidade || '');
        const especialidade = demonstrativoData ? item.especialidade : (item.ESPECIALIDADE || item.especialidade || '');
        const categoria = demonstrativoData ? item.categoria : (item.CATEGORIA || item.categoria || 'SC');
        const quantidade = demonstrativoData ? item.quantidade : (item.VALORES || item.quantidade || 0);
        const valorUnit = demonstrativoData ? item.valor_unitario : (item.valor_unitario || 0);
        const valorTotal = demonstrativoData ? item.valor_total : (item.valor_total || item.valor || 0);
        
        pdf.text(modalidade.substring(0, 15), xPos, yPos);
        xPos += colWidths[0];
        pdf.text(especialidade.substring(0, 20), xPos, yPos);
        xPos += colWidths[1];
        pdf.text(categoria.substring(0, 12), xPos, yPos);
        xPos += colWidths[2];
        pdf.text(quantidade.toString(), xPos, yPos);
        xPos += colWidths[3];
        pdf.text(`R$ ${Number(valorUnit).toFixed(2)}`, xPos, yPos);
        xPos += colWidths[4];
        pdf.text(`R$ ${Number(valorTotal).toFixed(2)}`, xPos, yPos);
        
        yPos += 8;
      });
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
