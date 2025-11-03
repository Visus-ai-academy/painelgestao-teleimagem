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

    // Gerar um PDF simples com informações básicas do relatório
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { width, height } = page.getSize();

    const titulo = 'Relatório de Repasse Médico';
    page.drawText(titulo, { x: 50, y: height - 80, size: 18, font, color: rgb(0, 0, 0) });
    page.drawText(`Período: ${periodo}`, { x: 50, y: height - 110, size: 12, font });
    page.drawText(`Médico ID: ${medico_id}`, { x: 50, y: height - 130, size: 12, font });
    page.drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { x: 50, y: height - 150, size: 10, font });

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
