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
    const { cliente_id, periodo, demonstrativo_data } = body;
    
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
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('nome, nome_fantasia, cnpj, cpf')
      .eq('id', cliente_id)
      .maybeSingle();

    if (!cliente) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cliente não encontrado"
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar dados calculados se existirem
    const { data: demo } = await supabase
      .from('demonstrativos_faturamento_calculados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .eq('periodo_referencia', periodo)
      .order('calculado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar dados detalhados da volumetria para o QUADRO 2
    const { data: volumetria, error: volError } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        "DATA_REALIZACAO",
        "DATA_LAUDO",
        "NOME_PACIENTE",
        "MEDICO",
        "ESTUDO_DESCRICAO",
        "MODALIDADE",
        "ESPECIALIDADE",
        "CATEGORIA",
        "PRIORIDADE",
        "ACCESSION_NUMBER",
        "EMPRESA",
        "Cliente_Nome_Fantasia",
        "VALORES",
        tipo_faturamento
      `)
      .eq('periodo_referencia', periodo)
      .or(`EMPRESA.eq.${cliente.nome},Cliente_Nome_Fantasia.eq.${cliente.nome_fantasia}`)
      .order('DATA_REALIZACAO', { ascending: false });

    console.log('📊 Volumetria encontrada:', volumetria?.length || 0, 'registros');

    // Buscar preços dos serviços para calcular valores
    const { data: precos } = await supabase
      .from('precos_servicos')
      .select('*')
      .eq('cliente_id', cliente_id);

    // Usar dados do demonstrativo se fornecido, senão usar dados calculados
    const dadosFinais = demonstrativo_data || demo || {};

    console.log('📋 Dados finais recebidos:', JSON.stringify(dadosFinais, null, 2));

    // Calcular volume total do período para seleção de faixas de preço
    const volumeTotal = (volumetria || []).reduce((sum, v) => sum + (v.VALORES || 0), 0) || dadosFinais.total_exames || 0;

    // Função para buscar preço do exame com base em Modalidade + Especialidade + Categoria (+ Prioridade opcional) e faixas de volume
    const buscarPreco = (exame: any) => {
      if (!precos || precos.length === 0) return 0;

      const norm = (s: any) => (s ?? '').toString().trim().toUpperCase();

      // Base de candidatos por chave principal
      const base = (precos || []).filter((p: any) =>
        (p.ativo ?? true) === true &&
        norm(p.modalidade) === norm(exame.MODALIDADE) &&
        norm(p.especialidade) === norm(exame.ESPECIALIDADE) &&
        norm(p.categoria) === norm(exame.CATEGORIA)
      );

      // Primeiro tenta preços do cliente; se não houver, usa genéricos (cliente_id nulo)
      let candidatos = base.filter((p: any) => p.cliente_id === cliente_id);
      if (candidatos.length === 0) {
        candidatos = base.filter((p: any) => !p.cliente_id);
      }

      // Filtro por prioridade (preferencial)
      const priMatch = candidatos.filter((p: any) => norm(p.prioridade) === norm(exame.PRIORIDADE));
      const pool = priMatch.length > 0 ? priMatch : candidatos;

      // Selecionar faixa por volume
      const porFaixa = pool
        .filter((p: any) =>
          (p.volume_inicial == null || volumeTotal >= p.volume_inicial) &&
          (p.volume_final == null || volumeTotal <= p.volume_final)
        )
        .sort((a: any, b: any) => (b.volume_inicial || 0) - (a.volume_inicial || 0));

      const selecionado = porFaixa[0] || pool[0];
      if (!selecionado) return 0;

      const prioridadeUrgencia = norm(exame.PRIORIDADE).includes('URG') || norm(exame.PRIORIDADE).includes('PLANT');
      const usarUrgencia = exame.tipo_faturamento === 'urgencia' || prioridadeUrgencia || !!selecionado.considera_prioridade_plantao;

      const valor = usarUrgencia ? (selecionado.valor_urgencia ?? 0) : (selecionado.valor_base ?? 0);
      return valor > 0 ? valor : (selecionado.valor_base ?? 0) || 0;
    };

    // Estruturar exames detalhados para o PDF
    const examesDetalhados = (volumetria || []).map(v => {
      const valorUnitario = buscarPreco(v);
      const quantidade = v.VALORES || 1;
      
      return {
        data_exame: v.DATA_REALIZACAO || v.DATA_LAUDO || '',
        paciente: v.NOME_PACIENTE || '',
        medico: v.MEDICO || '',
        exame: v.ESTUDO_DESCRICAO || '',
        modalidade: v.MODALIDADE || '',
        especialidade: v.ESPECIALIDADE || '',
        categoria: v.CATEGORIA || '',
        prioridade: v.PRIORIDADE || '',
        accession_number: v.ACCESSION_NUMBER || '',
        origem: v.Cliente_Nome_Fantasia || v.EMPRESA || '',
        quantidade: quantidade,
        valor_total: valorUnitario * quantidade
      };
    });

    // Valores padrão para o relatório
    const totalLaudos = volumetria?.reduce((sum, v) => sum + (v.VALORES || 0), 0) || dadosFinais.total_exames || 0;
    
    // Usar valores do demonstrativo se disponível (já calculados corretamente)
    let valorExames = 0;
    let valorBruto = 0;
    let valorFranquia = 0;
    let valorPortal = 0;
    let valorIntegracao = 0;
    let valorLiquido = 0;
    let totalImpostos = 0;
    
    if (dadosFinais.valor_bruto) {
      // Demonstrativo disponível - usar valores já calculados
      valorBruto = dadosFinais.valor_bruto; // JÁ INCLUI exames + franquia + portal + integração
      valorLiquido = dadosFinais.valor_liquido; // JÁ TEM impostos descontados
      totalImpostos = valorBruto - valorLiquido; // Impostos já foram calculados no demonstrativo
      
      // Buscar detalhes de franquia, portal e integração
      valorFranquia = dadosFinais.valor_franquia || 0;
      valorPortal = dadosFinais.valor_portal_laudos || 0;
      valorIntegracao = dadosFinais.valor_integracao || 0;
      
      console.log('💰 Valores extraídos:', { valorFranquia, valorPortal, valorIntegracao });
      
      // Se não temos os componentes separados, tentar extrair das observações
      if (!valorFranquia && !valorPortal && !valorIntegracao && dadosFinais.observacoes) {
        const obs = dadosFinais.observacoes;
        console.log('📝 Tentando extrair das observações:', obs);
        
        // Função auxiliar para converter valor brasileiro para número
        const parseValorBR = (str: string) => {
          if (!str) return 0;
          // Remove R$, espaços, e pontos de milhar, depois troca vírgula por ponto
          return parseFloat(str.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.'));
        };
        
        const matchFranquia = obs.match(/Franquia:\s*R?\$?\s*([\d.,]+)/i);
        const matchPortal = obs.match(/Portal[^:]*:\s*R?\$?\s*([\d.,]+)/i);
        const matchIntegracao = obs.match(/Integra[çc][ãa]o:\s*R?\$?\s*([\d.,]+)/i);
        
        if (matchFranquia) {
          valorFranquia = parseValorBR(matchFranquia[1]);
          console.log('✅ Franquia extraída:', valorFranquia);
        }
        if (matchPortal) {
          valorPortal = parseValorBR(matchPortal[1]);
          console.log('✅ Portal extraído:', valorPortal);
        }
        if (matchIntegracao) {
          valorIntegracao = parseValorBR(matchIntegracao[1]);
          console.log('✅ Integração extraída:', valorIntegracao);
        }
      }
      
      valorExames = valorBruto - valorFranquia - valorPortal - valorIntegracao;
      console.log('📊 Cálculo final:', { valorExames, valorBruto, valorFranquia, valorPortal, valorIntegracao });
    } else {
      // Calcular do zero baseado na volumetria
      valorExames = examesDetalhados.reduce((sum, e) => sum + e.valor_total, 0);
      valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
      
      // Calcular impostos (padrão 6.15% para não-simples)
      const pis = valorBruto * 0.0065;
      const cofins = valorBruto * 0.03;
      const csll = valorBruto * 0.01;
      const irrf = valorBruto * 0.015;
      totalImpostos = pis + cofins + csll + irrf;
      
      valorLiquido = valorBruto - totalImpostos;
    }
    
    // Calcular componentes individuais dos impostos para exibição
    const pis = valorBruto * 0.0065;
    const cofins = valorBruto * 0.03;
    const csll = valorBruto * 0.01;
    const irrf = valorBruto * 0.015;

    // ============= GERAÇÃO DO PDF - MODELO TELEiMAGEM =============
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let currentY = margin + 10;
    let pageNumber = 1;
    const totalPages = Math.ceil(examesDetalhados.length / 25) + 1;

    const addText = (text: string, x: number, y: number, options: any = {}) => {
      pdf.setFontSize(options.fontSize || 10);
      pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
      
      if (options.align === 'center') {
        const textWidth = pdf.getTextWidth(text);
        x = x + (options.maxWidth || contentWidth) / 2 - textWidth / 2;
      } else if (options.align === 'right') {
        const textWidth = pdf.getTextWidth(text);
        x = x + (options.maxWidth || contentWidth) - textWidth;
      }
      
      pdf.text(text, x, y);
      return y + (options.fontSize || 10) * 0.35;
    };

    const formatarValor = (valor: number) => {
      if (isNaN(valor) || valor === null || valor === undefined) return 'R$ 0,00';
      return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    
    const addFooter = () => {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', 
        pageWidth / 2, pageHeight - 10, { align: 'center' });
      pdf.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    };
    
    const addNewPage = () => {
      pdf.addPage();
      pageNumber++;
      currentY = margin;
    };

    // ================ PÁGINA 1 - CABEÇALHO ================
    currentY = addText('TELEiMAGEM', margin, currentY, {
      fontSize: 18,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });
    
    currentY = addText('EXCELÊNCIA EM TELERRADIOLOGIA', margin, currentY + 5, {
      fontSize: 10,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 8;

    currentY = addText('RELATÓRIO DE FATURAMENTO', margin, currentY, {
      fontSize: 14,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 10;

    // ================ INFORMAÇÕES DO CLIENTE E PERÍODO ================
    const clienteNome = cliente.nome_fantasia || cliente.nome;
    const documentoCliente = cliente.cnpj || cliente.cpf || 'N/A';
    const tipoDocumento = cliente.cnpj ? 'CNPJ' : cliente.cpf ? 'CPF' : '';
    const dataRelatorio = new Date().toLocaleDateString('pt-BR');
    
    currentY = addText(`Cliente: ${clienteNome} - ${tipoDocumento}: ${documentoCliente}`, margin, currentY, { fontSize: 10, bold: false });
    currentY = addText(`Período de Referência: ${periodo}`, margin, currentY + 5, { fontSize: 10, bold: true });
    currentY = addText(`Data de Emissão: ${dataRelatorio}`, margin, currentY + 5, { fontSize: 10 });

    currentY += 8;

    // ================ QUADRO 1 - RESUMO ================
    currentY = addText('QUADRO 1 - RESUMO', margin, currentY + 5, {
      fontSize: 12,
      bold: true
    });

    currentY += 10;

    // Tabela de resumo - Layout melhorado para refletir cálculo correto
    const resumoItems = [
      ['Total de Laudos:', totalLaudos.toString()],
      ['Valor dos Exames:', formatarValor(valorExames)],
    ];
    
    // Adicionar adicionais se existirem
    if (valorFranquia > 0) resumoItems.push(['+ Franquia:', formatarValor(valorFranquia)]);
    if (valorPortal > 0) resumoItems.push(['+ Portal de Laudos:', formatarValor(valorPortal)]);
    if (valorIntegracao > 0) resumoItems.push(['+ Integração:', formatarValor(valorIntegracao)]);
    
    // Linha do Valor Bruto Total
    resumoItems.push(['= Valor Bruto Total:', formatarValor(valorBruto)]);
    
    // Impostos
    resumoItems.push(['- PIS (0.65%):', formatarValor(pis)]);
    resumoItems.push(['- COFINS (3%):', formatarValor(cofins)]);
    resumoItems.push(['- CSLL (1%):', formatarValor(csll)]);
    resumoItems.push(['- IRRF (1.5%):', formatarValor(irrf)]);

    pdf.setDrawColor(200);
    pdf.setLineWidth(0.1);

    resumoItems.forEach((item, index) => {
      const itemY = currentY + (index * 6);
      
      if (index % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, itemY - 3, contentWidth, 6, 'F');
      }
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(item[0], margin + 2, itemY);
      pdf.text(item[1], pageWidth - margin - 2, itemY, { align: 'right' });
      
      pdf.line(margin, itemY + 2, pageWidth - margin, itemY + 2);
    });

    currentY += (resumoItems.length * 6) + 8;

    // VALOR A PAGAR - Destaque
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, currentY, contentWidth, 10, 'F');
    pdf.setDrawColor(100);
    pdf.rect(margin, currentY, contentWidth, 10, 'D');
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('VALOR A PAGAR:', margin + 2, currentY + 7);
    pdf.text(formatarValor(valorLiquido), pageWidth - margin - 2, currentY + 7, { align: 'right' });

    // Rodapé página 1
    addFooter();

    // ================ PÁGINA 2+ - QUADRO 2 (DETALHAMENTO) ================
    if (examesDetalhados.length > 0) {
      addNewPage();
      
      currentY = addText('QUADRO 2 - DETALHAMENTO', margin, currentY + 10, {
        fontSize: 12,
        bold: true
      });
      
      currentY += 10;
      
      const headers = ['Data', 'Paciente', 'Médico', 'Exame', 'Modal.', 'Espec.', 'Categ.', 'Prior.', 'Accession', 'Origem', 'Qtd', 'Valor Total'];
      const colWidths = [16, 42, 40, 41, 12, 21, 12, 14, 16, 18, 8, 20];
      
      // Cabeçalho
      pdf.setFillColor(220, 220, 220);
      pdf.setDrawColor(100);
      pdf.rect(margin, currentY, contentWidth, 7, 'FD');
      
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      
      let headerX = margin;
      headers.forEach((header, i) => {
        pdf.text(header, headerX + 1, currentY + 5);
        headerX += colWidths[i];
      });
      
      currentY += 7;
      
      // Linhas de dados
      examesDetalhados.forEach((exame, index) => {
        if (currentY > pageHeight - 25) {
          addFooter();
          addNewPage();
          currentY = margin + 10;
          
          // Repetir cabeçalho
          pdf.setFillColor(220, 220, 220);
          pdf.rect(margin, currentY, contentWidth, 7, 'FD');
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          
          let hX = margin;
          headers.forEach((h, i) => {
            pdf.text(h, hX + 1, currentY + 5);
            hX += colWidths[i];
          });
          currentY += 7;
        }
        
        if (index % 2 === 1) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(margin, currentY, contentWidth, 6, 'F');
        }
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        
        const dataFormatada = exame.data_exame ? 
          new Date(exame.data_exame + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        
        const cells = [
          dataFormatada,
          (exame.paciente || '').substring(0, 25),
          (exame.medico || '').substring(0, 24),
          (exame.exame || '').substring(0, 24),
          (exame.modalidade || '').substring(0, 6),
          (exame.especialidade || '').substring(0, 15),
          (exame.categoria || '').substring(0, 6),
          (exame.prioridade || '').substring(0, 10),
          (exame.accession_number || '').substring(0, 12),
          (exame.origem || '').substring(0, 13),
          (exame.quantidade || 1).toString(),
          formatarValor(exame.valor_total)
        ];
        
        let cellX = margin;
        cells.forEach((cell, cellIndex) => {
          const align = cellIndex === 10 ? 'center' : cellIndex === 11 ? 'right' : 'left';
          
          if (align === 'right') {
            pdf.text(cell, cellX + colWidths[cellIndex] - 2, currentY + 4.5, { align: 'right' });
          } else if (align === 'center') {
            pdf.text(cell, cellX + colWidths[cellIndex] / 2, currentY + 4.5, { align: 'center' });
          } else {
            pdf.text(cell, cellX + 1, currentY + 4.5);
          }
          
          cellX += colWidths[cellIndex];
        });
        
        pdf.setDrawColor(200);
        pdf.line(margin, currentY + 6, pageWidth - margin, currentY + 6);
        
        currentY += 6;
      });
    }

    // Rodapé última página
    addFooter();

    // ================ GERAR E FAZER UPLOAD ================
    const pdfBytes = pdf.output('arraybuffer');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `relatorio_${clienteNome.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${periodo}_${timestamp}.pdf`;
    
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
      message: "Relatório gerado com sucesso no padrão TELEiMAGEM (Quadro 1 + Quadro 2)",
      cliente: clienteNome,
      periodo: periodo,
      totalRegistros: examesDetalhados.length,
      dadosEncontrados: true,
      arquivos: pdfUrl ? [{ tipo: 'pdf', url: pdfUrl, nome: fileName }] : [],
      resumo: {
        total_laudos: totalLaudos,
        valor_bruto: valorBruto,
        valor_liquido: valorLiquido,
        franquia: valorFranquia,
        portal: valorPortal,
        integracao: valorIntegracao,
        impostos: {
          pis,
          cofins,
          csll,
          irrf,
          total: totalImpostos
        }
      },
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na geração do relatório:', error);
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