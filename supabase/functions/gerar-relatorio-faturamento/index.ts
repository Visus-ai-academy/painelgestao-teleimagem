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

    // Helpers de parsing de valores monetários (antes do uso)
    const parseValorBR = (str: string) => {
      if (!str) return 0;
      const cleaned = String(str)
        .replace(/R\$|\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const readNumber = (v: any) => {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      return parseValorBR(v);
    };

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
    
    // Detecta presença de valores do demonstrativo (banco ou payload)
    const hasDemoValores = dadosFinais && (dadosFinais.valor_bruto != null || dadosFinais.valor_bruto_total != null || dadosFinais.valor_total_faturamento != null || dadosFinais.valor_exames != null);

    if (hasDemoValores) {
      // Demonstrativo disponível - usar e reconciliar valores
      const brutoInformado = readNumber(dadosFinais.valor_bruto ?? dadosFinais.valor_bruto_total ?? dadosFinais.valor_total_faturamento ?? 0);
      const liquidoInformado = readNumber(dadosFinais.valor_liquido);
      const examesInformado = readNumber(dadosFinais.valor_exames);

      valorFranquia = readNumber(dadosFinais.valor_franquia) 
        || readNumber(dadosFinais.franquia)
        || readNumber(dadosFinais.valorFranquia)
        || readNumber(dadosFinais?.custos?.franquia);

      valorPortal = readNumber(dadosFinais.valor_portal_laudos)
        || readNumber(dadosFinais.portal_laudos)
        || readNumber(dadosFinais.portal)
        || readNumber(dadosFinais.valor_portal)
        || readNumber(dadosFinais?.custos?.portal);

      valorIntegracao = readNumber(dadosFinais.valor_integracao)
        || readNumber(dadosFinais.integracao)
        || readNumber(dadosFinais.taxa_integracao)
        || readNumber(dadosFinais?.custos?.integracao);

      console.log('💰 Valores diretos (mapeados):', { valorFranquia, valorPortal, valorIntegracao });

      // Se ainda faltarem valores, tentar extrair das observações
      if (dadosFinais.observacoes) {
        const obs = String(dadosFinais.observacoes);
        console.log('📝 Buscando nas observações:', obs);
        
        if (valorFranquia === 0) {
          const patterns = [
            /Franquia[:\s]*R?\$?\s*([\d.,]+)/i,
            /valor[_\s]+franquia[:\s]*R?\$?\s*([\d.,]+)/i,
            /franc[:\s]*R?\$?\s*([\d.,]+)/i
          ];
          for (const pattern of patterns) {
            const match = obs.match(pattern);
            if (match) {
              valorFranquia = parseValorBR(match[1]);
              console.log('✅ Franquia encontrada:', valorFranquia, 'usando padrão:', pattern);
              break;
            }
          }
        }
        
        if (valorPortal === 0) {
          const patterns = [
            /Portal[^:]*[:\s]*R?\$?\s*([\d.,]+)/i,
            /valor[_\s]+portal[:\s]*R?\$?\s*([\d.,]+)/i,
            /portal[_\s]+laudos[:\s]*R?\$?\s*([\d.,]+)/i
          ];
          for (const pattern of patterns) {
            const match = obs.match(pattern);
            if (match) {
              valorPortal = parseValorBR(match[1]);
              console.log('✅ Portal encontrado:', valorPortal, 'usando padrão:', pattern);
              break;
            }
          }
        }
        
        if (valorIntegracao === 0) {
          const patterns = [
            /Integra[çc][ãa]o[:\s]*R?\$?\s*([\d.,]+)/i,
            /valor[_\s]+integra[çc][ãa]o[:\s]*R?\$?\s*([\d.,]+)/i,
            /integr[:\s]*R?\$?\s*([\d.,]+)/i
          ];
          for (const pattern of patterns) {
            const match = obs.match(pattern);
            if (match) {
              valorIntegracao = parseValorBR(match[1]);
              console.log('✅ Integração encontrada:', valorIntegracao, 'usando padrão:', pattern);
              break;
            }
          }
        }
      }
      
      // Complementar adicionais via RPC quando ausentes
      if (valorFranquia === 0 || valorPortal === 0 || valorIntegracao === 0) {
        try {
          const { data: calcData2, error: calcErr2 } = await supabase
            .rpc('calcular_faturamento_completo', {
              p_cliente_id: cliente_id,
              p_periodo: periodo,
              p_volume_total: totalLaudos
            });
          if (!calcErr2 && calcData2 && Array.isArray(calcData2) && calcData2.length > 0) {
            const c2 = calcData2[0];
            if (valorFranquia === 0) valorFranquia = Number(c2.valor_franquia) || 0;
            if (valorPortal === 0) valorPortal = Number(c2.valor_portal_laudos) || 0;
            if (valorIntegracao === 0) valorIntegracao = Number(c2.valor_integracao) || 0;
            console.log('🧩 Adicionais complementados via RPC', { valorFranquia, valorPortal, valorIntegracao });
          } else {
            console.warn('⚠️ RPC complementar sem dados', calcErr2);
          }
        } catch (e) {
          console.warn('RPC calcular_faturamento_completo (reconciliar) falhou:', e?.message || e);
        }
      }
      
      // Reconciliar bruto com exames + adicionais
      if (examesInformado > 0) {
        valorExames = examesInformado;
        valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
      } else {
        valorBruto = brutoInformado;
        valorExames = Math.max(0, valorBruto - valorFranquia - valorPortal - valorIntegracao);
        if (!isFinite(valorBruto) || valorBruto <= 0) {
          valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
        }
      }

      console.log('📊 Cálculo final:', { 
        valorBruto, 
        valorFranquia, 
        valorPortal, 
        valorIntegracao, 
        valorExames,
        soma_componentes: valorExames + valorFranquia + valorPortal + valorIntegracao
      });

      // Se o valor líquido não foi fornecido, calcular com as alíquotas padrão
      if (liquidoInformado == null || isNaN(liquidoInformado) || liquidoInformado === 0) {
        const pisLocal = valorBruto * 0.0065;
        const cofinsLocal = valorBruto * 0.03;
        const csllLocal = valorBruto * 0.01;
        const irrfLocal = valorBruto * 0.015;
        totalImpostos = pisLocal + cofinsLocal + csllLocal + irrfLocal;
        valorLiquido = valorBruto - totalImpostos;
      } else {
        valorLiquido = liquidoInformado;
        totalImpostos = valorBruto - valorLiquido;
      }
    } else {
      // Calcular do zero baseado na volumetria + parâmetros oficiais (RPC)
      // 1) Sempre calcular o valor dos exames pela volumetria/preços
      valorExames = examesDetalhados.reduce((sum, e) => sum + e.valor_total, 0);

      // 2) Tentar usar RPC calcular_faturamento_completo para obter APENAS os adicionais (franquia/portal/integração)
      try {
        const { data: calcData, error: calcErr } = await supabase
          .rpc('calcular_faturamento_completo', {
            p_cliente_id: cliente_id,
            p_periodo: periodo,
            p_volume_total: totalLaudos
          });

        if (!calcErr && calcData && Array.isArray(calcData) && calcData.length > 0) {
          const c = calcData[0];
          // Ignorar c.valor_exames e c.valor_total do RPC, pois a função não retorna o valor dos exames
          valorFranquia = Number(c.valor_franquia) || 0;
          valorPortal = Number(c.valor_portal_laudos) || 0;
          valorIntegracao = Number(c.valor_integracao) || 0;
          console.log('✅ Adicionais via RPC calcular_faturamento_completo', { valorFranquia, valorPortal, valorIntegracao });
        } else {
          console.warn('⚠️ RPC indisponível ou sem dados, mantendo adicionais atuais', calcErr);
        }
      } catch (e) {
        console.warn('Erro RPC calcular_faturamento_completo:', e?.message || e);
      }

      // 3) Valor bruto = exames + adicionais
      valorBruto = valorExames + valorFranquia + valorPortal + valorIntegracao;
      
      // Calcular impostos (padrão 6.15% para não-simples)
      const pisLocal = valorBruto * 0.0065;
      const cofinsLocal = valorBruto * 0.03;
      const csllLocal = valorBruto * 0.01;
      const irrfLocal = valorBruto * 0.015;
      totalImpostos = pisLocal + cofinsLocal + csllLocal + irrfLocal;
      
      valorLiquido = valorBruto - totalImpostos;

      // Último recurso: reconciliar com faturamento agregado se ainda estiver zerado/indefinido
      if (!isFinite(valorBruto) || valorBruto <= 0) {
        try {
          const { data: fatAgg, error: fatErr } = await supabase
            .from('faturamento')
            .select('total_bruto:sum(valor_bruto)')
            .eq('cliente_id', cliente_id)
            .eq('periodo_referencia', periodo)
            .single();

          if (!fatErr && fatAgg?.total_bruto != null && Number(fatAgg.total_bruto) > 0) {
            const totalBrutoAgg = Number(fatAgg.total_bruto);
            console.log('🔄 Usando valor_bruto agregado de faturamento:', totalBrutoAgg);
            valorBruto = totalBrutoAgg;
            // Ajustar valor dos exames para manter consistência com extras
            valorExames = Math.max(0, valorBruto - valorFranquia - valorPortal - valorIntegracao);
            const pis2 = valorBruto * 0.0065;
            const cofins2 = valorBruto * 0.03;
            const csll2 = valorBruto * 0.01;
            const irrf2 = valorBruto * 0.015;
            totalImpostos = pis2 + cofins2 + csll2 + irrf2;
            valorLiquido = valorBruto - totalImpostos;
          }
        } catch (e2) {
          console.warn('Não foi possível obter agregado de faturamento:', e2?.message || e2);
        }
      }
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
      ['+ Franquia:', formatarValor(valorFranquia)],
      ['+ Portal de Laudos:', formatarValor(valorPortal)],
      ['+ Integração:', formatarValor(valorIntegracao)],
      ['= Valor Bruto Total:', formatarValor(valorBruto)],
    ];
    
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

    // Verificar quebra de página antes do destaque
    if (currentY + 12 > pageHeight - margin) {
      addFooter();
      addNewPage();
    }

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
      const colWidths = [16, 36, 34, 24, 12, 32, 12, 14, 24, 28, 8, 14];
      
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
          (exame.paciente || '').substring(0, 21),
          (exame.medico || '').substring(0, 20),
          (exame.exame || '').substring(0, 18),
          (exame.modalidade || '').substring(0, 6),
          (exame.especialidade || '').substring(0, 24),
          (exame.categoria || '').substring(0, 6),
          (exame.prioridade || '').substring(0, 10),
          (exame.accession_number || '').substring(0, 22),
          (exame.origem || '').substring(0, 22),
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