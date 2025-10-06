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

    // Função para buscar preço do exame
    const buscarPreco = (exame: any) => {
      if (!precos || precos.length === 0) return 0;
      
      const preco = precos.find(p => 
        p.exame === exame.ESTUDO_DESCRICAO &&
        p.modalidade === exame.MODALIDADE &&
        p.especialidade === exame.ESPECIALIDADE &&
        p.categoria === exame.CATEGORIA
      );
      
      if (!preco) return 0;
      
      // Determinar qual valor usar baseado no tipo de faturamento
      if (exame.tipo_faturamento === 'urgencia' || exame.PRIORIDADE?.toLowerCase().includes('urgenc')) {
        return preco.valor_urgencia || preco.valor_base || 0;
      }
      
      return preco.valor_base || 0;
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
    const valorBruto = dadosFinais.valor_bruto_total || dadosFinais.valor_exames || 0;
    const valorFranquia = dadosFinais.valor_franquia || 0;
    const valorPortal = dadosFinais.valor_portal_laudos || 0;
    const valorIntegracao = dadosFinais.valor_integracao || 0;
    
    // Calcular impostos
    const pis = valorBruto * 0.0065;
    const cofins = valorBruto * 0.03;
    const csll = valorBruto * 0.01;
    const irrf = valorBruto * 0.015;
    const totalImpostos = pis + cofins + csll + irrf;
    
    const valorLiquido = valorBruto - valorFranquia - valorPortal - valorIntegracao - totalImpostos;

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
    
    currentY = addText('EXCELÊNCIA EM TELERRADIOLOGIA', margin, currentY + 8, {
      fontSize: 10,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 15;

    currentY = addText('RELATÓRIO DE FATURAMENTO', margin, currentY + 10, {
      fontSize: 14,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 15;

    // ================ INFORMAÇÕES DO CLIENTE ================
    const clienteNome = cliente.nome_fantasia || cliente.nome;
    const documentoCliente = cliente.cnpj || cliente.cpf || 'N/A';
    const tipoDocumento = cliente.cnpj ? 'CNPJ' : cliente.cpf ? 'CPF' : '';
    
    currentY = addText(`Cliente: ${clienteNome} - ${tipoDocumento}: ${documentoCliente}`, margin, currentY, { fontSize: 11, bold: false });
    currentY = addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, currentY + 6, { fontSize: 11 });
    
    // Período à direita
    currentY = addText(`Período: ${periodo}`, pageWidth - margin, currentY, { 
      fontSize: 11, 
      align: 'right',
      maxWidth: 80
    });

    currentY += 10;

    // ================ QUADRO 1 - RESUMO ================
    currentY = addText('QUADRO 1 - RESUMO', margin, currentY + 5, {
      fontSize: 12,
      bold: true
    });

    currentY += 10;

    // Tabela de resumo
    const resumoItems = [
      ['Total de Laudos:', totalLaudos.toString()],
      ['Valor Bruto:', formatarValor(valorBruto)],
      ['Franquia:', formatarValor(valorFranquia)],
      ['Portal de Laudos:', formatarValor(valorPortal)],
      ['Integração:', formatarValor(valorIntegracao)],
      ['PIS (0.65%):', formatarValor(pis)],
      ['COFINS (3%):', formatarValor(cofins)],
      ['CSLL (1%):', formatarValor(csll)],
      ['IRRF (1.5%):', formatarValor(irrf)]
    ];

    pdf.setDrawColor(200);
    pdf.setLineWidth(0.1);

    resumoItems.forEach((item, index) => {
      const itemY = currentY + (index * 7);
      
      if (index % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, itemY - 4, contentWidth, 7, 'F');
      }
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(item[0], margin + 2, itemY);
      pdf.text(item[1], pageWidth - margin - 2, itemY, { align: 'right' });
      
      pdf.line(margin, itemY + 2, pageWidth - margin, itemY + 2);
    });

    currentY += (resumoItems.length * 7) + 10;

    // VALOR A PAGAR - Destaque
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, currentY, contentWidth, 10, 'F');
    pdf.setFontSize(12);
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
      const colWidths = [16, 32, 32, 38, 12, 16, 12, 14, 16, 16, 8, 20];
      
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
          (exame.paciente || '').substring(0, 15),
          (exame.medico || '').substring(0, 15),
          (exame.exame || '').substring(0, 20),
          (exame.modalidade || '').substring(0, 6),
          (exame.especialidade || '').substring(0, 12),
          (exame.categoria || '').substring(0, 6),
          (exame.prioridade || '').substring(0, 10),
          (exame.accession_number || '').substring(0, 12),
          (exame.origem || '').substring(0, 12),
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