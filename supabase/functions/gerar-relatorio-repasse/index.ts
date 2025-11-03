import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { medico_id, periodo } = await req.json();

    if (!medico_id || !periodo) {
      throw new Error('Médico ID e período são obrigatórios');
    }

    console.log('[Repasse] Gerando relatório para médico:', medico_id, 'período:', periodo);

    // Buscar status do demonstrativo
    const { data: status, error: statusError } = await supabase
      .from('relatorios_repasse_status')
      .select('*')
      .eq('medico_id', medico_id)
      .eq('periodo', periodo)
      .single();

    if (statusError || !status) {
      throw new Error('Demonstrativo não encontrado. Gere o demonstrativo primeiro.');
    }

    const detalhes = status.detalhes_relatorio || {};

    // Gerar PDF com informações completas do demonstrativo
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();
    
    let yPosition = height - 60;
    const margin = 50;
    const lineHeight = 15;

    // Função auxiliar para adicionar nova página se necessário
    const checkNewPage = () => {
      if (yPosition < 100) {
        page = pdfDoc.addPage([595.28, 841.89]);
        yPosition = height - 60;
      }
    };

    // Função para formatar moeda
    const formatMoeda = (valor: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // Cabeçalho
    page.drawText('RELATÓRIO DE REPASSE MÉDICO', { x: margin, y: yPosition, size: 18, font: fontBold });
    yPosition -= lineHeight * 2;

    // Informações do médico
    page.drawText(`Médico: ${detalhes.medico_nome || 'N/A'}`, { x: margin, y: yPosition, size: 12, font });
    yPosition -= lineHeight;
    page.drawText(`CRM: ${detalhes.medico_crm || 'N/A'}  |  CPF: ${detalhes.medico_cpf || 'N/A'}`, { x: margin, y: yPosition, size: 10, font });
    yPosition -= lineHeight;
    page.drawText(`Período: ${periodo}`, { x: margin, y: yPosition, size: 10, font });
    yPosition -= lineHeight;
    page.drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { x: margin, y: yPosition, size: 9, font });
    yPosition -= lineHeight * 2;

    // Resumo financeiro
    page.drawText('RESUMO FINANCEIRO', { x: margin, y: yPosition, size: 14, font: fontBold });
    yPosition -= lineHeight * 1.5;

    page.drawText(`Total de Laudos: ${detalhes.total_laudos || 0}`, { x: margin, y: yPosition, size: 11, font });
    yPosition -= lineHeight;
    page.drawText(`Valor dos Exames: ${formatMoeda(detalhes.valor_exames || 0)}`, { x: margin, y: yPosition, size: 11, font });
    yPosition -= lineHeight;
    page.drawText(`Valores Adicionais: ${formatMoeda(detalhes.valor_adicionais || 0)}`, { x: margin, y: yPosition, size: 11, font });
    yPosition -= lineHeight;
    page.drawText(`VALOR TOTAL: ${formatMoeda(detalhes.valor_total || 0)}`, { x: margin, y: yPosition, size: 12, font: fontBold, color: rgb(0, 0.4, 0) });
    yPosition -= lineHeight * 2;

    checkNewPage();

    // Detalhes dos exames por arranjo
    if (detalhes.detalhes_exames && detalhes.detalhes_exames.length > 0) {
      page.drawText('DETALHES POR ARRANJO', { x: margin, y: yPosition, size: 14, font: fontBold });
      yPosition -= lineHeight * 1.5;

      for (const exame of detalhes.detalhes_exames) {
        checkNewPage();
        
        page.drawText(`• Modalidade: ${exame.modalidade || 'N/A'}`, { x: margin, y: yPosition, size: 10, font: fontBold });
        yPosition -= lineHeight;
        page.drawText(`  Especialidade: ${exame.especialidade || 'N/A'}`, { x: margin + 10, y: yPosition, size: 9, font });
        yPosition -= lineHeight;
        page.drawText(`  Categoria: ${exame.categoria || 'N/A'}  |  Prioridade: ${exame.prioridade || 'N/A'}`, { x: margin + 10, y: yPosition, size: 9, font });
        yPosition -= lineHeight;
        page.drawText(`  Cliente: ${exame.cliente || 'N/A'}`, { x: margin + 10, y: yPosition, size: 9, font });
        yPosition -= lineHeight;
        page.drawText(`  Quantidade: ${exame.quantidade || 0}  |  Valor Unit.: ${formatMoeda(exame.valor_unitario || 0)}  |  Total: ${formatMoeda(exame.valor_total || 0)}`, { x: margin + 10, y: yPosition, size: 9, font: fontBold });
        yPosition -= lineHeight * 1.5;
      }
    }

    checkNewPage();

    // Valores adicionais
    if (detalhes.adicionais && detalhes.adicionais.length > 0) {
      yPosition -= lineHeight;
      page.drawText('VALORES ADICIONAIS', { x: margin, y: yPosition, size: 14, font: fontBold });
      yPosition -= lineHeight * 1.5;

      for (const adicional of detalhes.adicionais) {
        checkNewPage();
        
        page.drawText(`• ${adicional.descricao || 'Sem descrição'}`, { x: margin, y: yPosition, size: 10, font });
        yPosition -= lineHeight;
        page.drawText(`  Data: ${adicional.data ? new Date(adicional.data).toLocaleDateString('pt-BR') : 'N/A'}  |  Valor: ${formatMoeda(adicional.valor || 0)}`, { x: margin + 10, y: yPosition, size: 9, font });
        yPosition -= lineHeight * 1.5;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const filePath = `${medico_id}_${periodo}.pdf`;

    // Upload do PDF ao Storage (bucket: relatorios-repasse)
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const { error: uploadError } = await supabase
      .storage
      .from('relatorios-repasse')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      throw new Error(`Falha ao salvar PDF no storage: ${uploadError.message}`);
    }

    // Montar link público correto usando SUPABASE_URL
    const linkRelatorio = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/relatorios-repasse/${filePath}`;

    // Atualizar status
    await supabase
      .from('relatorios_repasse_status')
      .update({
        relatorio_gerado: true,
        link_relatorio: linkRelatorio,
        data_geracao_relatorio: new Date().toISOString()
      })
      .eq('medico_id', medico_id)
      .eq('periodo', periodo);

    console.log('[Repasse] Relatório gerado com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        link_relatorio: linkRelatorio
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Repasse] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
