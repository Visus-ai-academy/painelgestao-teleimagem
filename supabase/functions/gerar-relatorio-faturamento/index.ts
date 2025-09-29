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
      .select('nome, nome_fantasia, cnpj')
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

    // Usar dados do demonstrativo se fornecido, senão usar dados calculados
    const dadosFinais = demonstrativo_data || demo || {};

    // Valores padrão para o relatório
    const totalLaudos = dadosFinais.total_exames || 0;
    const valorBruto = dadosFinais.valor_bruto_total || dadosFinais.valor_exames || 0;
    const valorFranquia = dadosFinais.valor_franquia || 0;
    const valorPortal = dadosFinais.valor_portal_laudos || 0;
    const valorIntegracao = dadosFinais.valor_integracao || 0;
    const valorLiquido = dadosFinais.valor_liquido || (valorBruto - valorFranquia - valorPortal - valorIntegracao);

    // ============= GERAÇÃO DO PDF - MODELO TELEiMAGEM =============
    const pdf = new jsPDF('p', 'mm', 'a4'); // Formato retrato
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let currentY = margin + 10;

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

    const formatarValor = (valor: number) => {
      if (isNaN(valor) || valor === null || valor === undefined) return 'R$ 0,00';
      return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };

    // ================ CABEÇALHO ================
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
    currentY = addText(`Cliente: ${clienteNome}`, margin, currentY, { fontSize: 11, bold: true });
    currentY = addText(`CNPJ: ${cliente.cnpj || 'N/A'}`, margin, currentY + 6, { fontSize: 10 });
    currentY = addText(`Período: ${periodo}`, margin, currentY + 6, { fontSize: 10 });
    currentY = addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, currentY + 6, { fontSize: 10 });

    currentY += 15;

    // ================ RESUMO FINANCEIRO ================
    
    // Linha separadora
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    currentY = addText('RESUMO FINANCEIRO', margin, currentY, {
      fontSize: 12,
      bold: true
    });

    currentY += 10;

    // Layout simples e limpo
    currentY = addText(`Total de Laudos: ${totalLaudos}`, margin, currentY, { fontSize: 11, bold: true });
    currentY += 8;

    currentY = addText(`Valor Bruto: ${formatarValor(valorBruto)}`, margin, currentY, { fontSize: 10 });
    
    if (valorFranquia > 0) {
      currentY = addText(`(-) Franquia: ${formatarValor(valorFranquia)}`, margin, currentY + 6, { fontSize: 10 });
    }
    
    if (valorPortal > 0) {
      currentY = addText(`(-) Portal de Laudos: ${formatarValor(valorPortal)}`, margin, currentY + 6, { fontSize: 10 });
    }
    
    if (valorIntegracao > 0) {
      currentY = addText(`(-) Integração: ${formatarValor(valorIntegracao)}`, margin, currentY + 6, { fontSize: 10 });
    }

    // Linha separadora
    currentY += 10;
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    // VALOR TOTAL - Destacado
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, currentY - 2, contentWidth, 12, 'F');
    
    currentY = addText(`VALOR TOTAL A PAGAR: ${formatarValor(valorLiquido)}`, margin, currentY + 6, {
      fontSize: 12,
      bold: true,
      align: 'center',
      maxWidth: contentWidth
    });

    currentY += 20;

    // ================ OBSERVAÇÕES ================
    currentY = addText('Observações:', margin, currentY, { fontSize: 10, bold: true });
    currentY = addText('• Este relatório foi gerado automaticamente pelo sistema TELEiMAGEM', margin, currentY + 6, { fontSize: 9 });
    currentY = addText('• Valores calculados com base nos dados de faturamento processados', margin, currentY + 5, { fontSize: 9 });
    currentY = addText(`• Período de referência: ${periodo}`, margin, currentY + 5, { fontSize: 9 });

    // ================ RODAPÉ ================
    const rodapeY = pageHeight - 20;
    addText(`Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 
      margin, rodapeY, { fontSize: 8, align: 'center', maxWidth: contentWidth });
    
    addText('© 2025 TELEiMAGEM - Todos os direitos reservados', 
      margin, rodapeY + 8, { fontSize: 8, align: 'center', maxWidth: contentWidth });

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
      message: "Relatório gerado com sucesso no formato tradicional TELEiMAGEM",
      cliente: clienteNome,
      periodo: periodo,
      totalRegistros: 1,
      dadosEncontrados: true,
      arquivos: pdfUrl ? [{ tipo: 'pdf', url: pdfUrl, nome: fileName }] : [],
      resumo: {
        total_laudos: totalLaudos,
        valor_bruto: valorBruto,
        valor_liquido: valorLiquido,
        franquia: valorFranquia,
        portal: valorPortal,
        integracao: valorIntegracao
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