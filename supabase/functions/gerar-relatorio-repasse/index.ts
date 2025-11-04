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
    
    // PÁGINA 1 EM FORMATO PAISAGEM
    let page = pdfDoc.addPage([841.89, 595.28]); // A4 Paisagem
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();
    
    let yPosition = height - 60;
    const margin = 50;
    const lineHeight = 15;

    // Função auxiliar para adicionar nova página se necessário
    const checkNewPage = () => {
      if (yPosition < 100) {
        page = pdfDoc.addPage([841.89, 595.28]); // Paisagem
        yPosition = height - 60;
      }
    };

    // Função para formatar moeda
    const formatMoeda = (valor: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // Função para adicionar rodapé
    const addFooter = (currentPage: any, pageNum: number, totalPages: number) => {
      const footerY = 30;
      currentPage.drawText('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', {
        x: 50,
        y: footerY,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
      currentPage.drawText(`Página ${pageNum} de ${totalPages}`, {
        x: width - 100,
        y: footerY,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    };

    // Cabeçalho - título centralizado
    const titulo = 'RELATÓRIO DE REPASSE MÉDICO';
    const tituloWidth = fontBold.widthOfTextAtSize(titulo, 18);
    const tituloX = (width - tituloWidth) / 2;
    page.drawText(titulo, { x: tituloX, y: yPosition, size: 18, font: fontBold });
    yPosition -= lineHeight * 4; // Espaçamento maior após título

    // Informações do médico
    page.drawText(`Médico: ${detalhes.medico_nome || 'N/A'}`, { x: margin, y: yPosition, size: 12, font });
    yPosition -= lineHeight;
    page.drawText(`CRM: ${detalhes.medico_crm || 'N/A'}  |  CPF: ${detalhes.medico_cpf || 'N/A'}`, { x: margin, y: yPosition, size: 10, font });
    yPosition -= lineHeight;
    page.drawText(`Período: ${periodo}`, { x: margin, y: yPosition, size: 10, font });
    yPosition -= lineHeight;
    page.drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { x: margin, y: yPosition, size: 9, font });
    yPosition -= lineHeight * 2;

    // Resumo financeiro com retângulo azul
    const resumoStartY = yPosition;
    page.drawText('RESUMO FINANCEIRO', { x: margin, y: yPosition, size: 14, font: fontBold });
    yPosition -= lineHeight * 1.5;

    const resumoContentStartY = yPosition;
    page.drawText(`Total de Laudos: ${detalhes.total_laudos || 0}`, { x: margin + 10, y: yPosition, size: 11, font });
    yPosition -= lineHeight;
    page.drawText(`Valor dos Exames: ${formatMoeda(detalhes.valor_exames || 0)}`, { x: margin + 10, y: yPosition, size: 11, font });
    yPosition -= lineHeight;
    page.drawText(`Valores Adicionais: ${formatMoeda(detalhes.valor_adicionais || 0)}`, { x: margin + 10, y: yPosition, size: 11, font });
    yPosition -= lineHeight * 2;

    // Desenhar retângulo azul ao redor do resumo
    const boxHeight = resumoContentStartY - yPosition + lineHeight;
    page.drawRectangle({
      x: margin,
      y: yPosition,
      width: 400,
      height: boxHeight,
      borderColor: rgb(0, 0.4, 0.8),
      borderWidth: 2,
    });

    yPosition -= lineHeight;
    
    // VALOR TOTAL em negrito azul escuro com espaçamento
    page.drawText(`VALOR TOTAL: ${formatMoeda(detalhes.valor_total || 0)}`, { 
      x: margin, 
      y: yPosition, 
      size: 12, 
      font: fontBold, 
      color: rgb(0, 0.2, 0.6) 
    });
    yPosition -= lineHeight * 2;

    checkNewPage();

    // Buscar exames individuais para o Quadro 2 usando o período de referência da volumetria
    const medicoNome = (detalhes.medico_nome || '').toString();
    
    console.log('[Repasse] Buscando exames para médico:', medicoNome, 'período:', periodo);
    
    // Limitar a 1000 exames para evitar timeout
    const { data: exames, error: examesError } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        DATA_REALIZACAO,
        NOME_PACIENTE,
        MEDICO,
        ESPECIALIDADE,
        MODALIDADE,
        CATEGORIA,
        PRIORIDADE,
        ACCESSION_NUMBER,
        EMPRESA,
        Cliente_Nome_Fantasia,
        cliente_nome_fantasia,
        VALORES
      `)
      .eq('periodo_referencia', periodo)
      .eq('MEDICO', medicoNome)
      .order('DATA_REALIZACAO', { ascending: true })
      .limit(1000);

    if (examesError) {
      console.error('[Repasse] Erro ao buscar exames (volumetria_mobilemed):', examesError);
    }
    
    console.log('[Repasse] Total de exames encontrados:', exames?.length || 0);

    // Pré-carregar repasses do médico e clientes para calcular valor por exame
    const periodoStr = periodo.toString();
    const periodStart = new Date(`${periodoStr}-01T00:00:00`);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(0);

    // ✅ Usar EXATAMENTE a mesma normalização do demonstrativo
    const norm = (s: any) => (s ?? '').toString().trim().toUpperCase();
    // ✅ Buscar valores de repasse (mesma query do demonstrativo)
    const { data: repasses, error: repasseError } = await supabase
      .from('medicos_valores_repasse')
      .select('*')
      .eq('medico_id', medico_id)
      .eq('ativo', true);
    if (repasseError) {
      console.error('[Repasse] Erro ao buscar valores de repasse:', repasseError);
    }
    console.log('[Repasse] Registros de repasse carregados:', repasses?.length || 0);

    // ✅ Mapear clientes para obter IDs (mesma lógica do demonstrativo)
    const clienteNomes = Array.from(new Set(
      exames.map(e => e.EMPRESA || e.Cliente_Nome_Fantasia || e.cliente_nome_fantasia).filter(Boolean)
    ));
    const clienteMap = new Map<string, string>();
    if (clienteNomes.length > 0) {
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .in('nome', clienteNomes);
      if (clientesError) {
        console.error('[Repasse] Erro ao buscar clientes:', clientesError);
      } else {
        for (const c of clientes || []) {
          clienteMap.set(c.nome, c.id);
        }
      }
    }

    // ✅ Função de match IDÊNTICA ao demonstrativo (4 níveis de fallback)
    const getValorRepasse = (ex: any) => {
      const clienteNome = ex.EMPRESA || ex.Cliente_Nome_Fantasia || ex.cliente_nome_fantasia || '';
      const clienteId = clienteMap.get(clienteNome);
      const modalidade = ex.MODALIDADE || '';
      const especialidade = ex.ESPECIALIDADE || '';
      const categoria = ex.CATEGORIA || '';
      const prioridade = ex.PRIORIDADE || '';

      // 1) Com cliente específico + categoria
      let valorRepasse = (repasses || []).find((r: any) =>
        norm(r.modalidade) === norm(modalidade) &&
        norm(r.especialidade) === norm(especialidade) &&
        norm(r.categoria) === norm(categoria) &&
        norm(r.prioridade) === norm(prioridade) &&
        (!!clienteId && r.cliente_id === clienteId)
      );

      // 2) Sem cliente, com categoria
      if (!valorRepasse) {
        valorRepasse = (repasses || []).find((r: any) =>
          norm(r.modalidade) === norm(modalidade) &&
          norm(r.especialidade) === norm(especialidade) &&
          norm(r.categoria) === norm(categoria) &&
          norm(r.prioridade) === norm(prioridade) &&
          (r.cliente_id == null)
        );
      }

      // 3) Sem cliente e sem categoria
      if (!valorRepasse) {
        valorRepasse = (repasses || []).find((r: any) =>
          norm(r.modalidade) === norm(modalidade) &&
          norm(r.especialidade) === norm(especialidade) &&
          norm(r.prioridade) === norm(prioridade) &&
          (!r.categoria || norm(r.categoria) === '') &&
          (r.cliente_id == null)
        );
      }

      // 4) Fallback: apenas modalidade + especialidade
      if (!valorRepasse) {
        valorRepasse = (repasses || []).find((r: any) =>
          norm(r.modalidade) === norm(modalidade) &&
          norm(r.especialidade) === norm(especialidade) &&
          (r.cliente_id == null)
        );
      }

      return Number(valorRepasse?.valor) || 0;
    };

    // QUADRO 2 - DETALHAMENTO DOS EXAMES (formato paisagem)
    if (exames && exames.length > 0) {
      console.log('[Repasse] Gerando Quadro 2 com', exames.length, 'exames');
      
      // Nova página em formato paisagem (A4 rotacionado)
      page = pdfDoc.addPage([841.89, 595.28]); // Largura x Altura invertidas
      const pageWidth = 841.89;
      const pageHeight = 595.28;
      yPosition = pageHeight - 40;
      const tableMargin = 30;

      // Título do Quadro 2
      page.drawText('QUADRO 2 - DETALHAMENTO DOS EXAMES', { x: tableMargin, y: yPosition, size: 12, font: fontBold });
      
      // Aviso se houver limite de exames
      if (exames.length === 1000) {
        yPosition -= 15;
        page.drawText('* Mostrando os primeiros 1000 exames do período', { 
          x: tableMargin, 
          y: yPosition, 
          size: 8, 
          font, 
          color: rgb(0.6, 0.6, 0.6) 
        });
      }
      
      yPosition -= 25;

      // Cabeçalho da tabela
      const colWidths = [55, 85, 85, 100, 35, 70, 40, 40, 70, 55, 30, 60]; // Larguras das colunas
      const headers = ['Data', 'Paciente', 'Médico', 'Exame', 'Modal.', 'Espec.', 'Categ.', 'Prior.', 'Accession', 'Origem', 'Qtd', 'Valor Total'];
      
      let xPos = tableMargin;
      
      // Desenhar cabeçalho
      page.drawRectangle({
        x: tableMargin,
        y: yPosition - 15,
        width: pageWidth - (tableMargin * 2),
        height: 18,
        color: rgb(0.9, 0.9, 0.9),
      });

      for (let i = 0; i < headers.length; i++) {
        page.drawText(headers[i], { 
          x: xPos + 2, 
          y: yPosition - 12, 
          size: 8, 
          font: fontBold 
        });
        xPos += colWidths[i];
      }

      yPosition -= 20;

      // Dados da tabela
      let idx = 0;
      for (const exame of exames) {
        // Verificar se precisa de nova página
        if (yPosition < 60) {
          page = pdfDoc.addPage([841.89, 595.28]);
          yPosition = pageHeight - 40;
          
          // Redesenhar cabeçalho
          page.drawRectangle({
            x: tableMargin,
            y: yPosition - 15,
            width: pageWidth - (tableMargin * 2),
            height: 18,
            color: rgb(0.9, 0.9, 0.9),
          });

          xPos = tableMargin;
          for (let i = 0; i < headers.length; i++) {
            page.drawText(headers[i], { 
              x: xPos + 2, 
              y: yPosition - 12, 
              size: 8, 
              font: fontBold 
            });
            xPos += colWidths[i];
          }
          yPosition -= 20;
        }

        // Linha zebrada
        if (exames.indexOf(exame) % 2 === 0) {
          page.drawRectangle({
            x: tableMargin,
            y: yPosition - 12,
            width: pageWidth - (tableMargin * 2),
            height: 15,
            color: rgb(0.97, 0.97, 0.97),
          });
        }

        xPos = tableMargin;
        const valorRep = getValorRepasse(exame);
        if (idx < 5) {
          try {
            console.log('[Repasse] Valor repasse debug:', JSON.stringify({
              modalidade: exame.MODALIDADE,
              especialidade: exame.ESPECIALIDADE,
              categoria: exame.CATEGORIA,
              prioridade: exame.PRIORIDADE,
              cliente: (exame.Cliente_Nome_Fantasia || exame.cliente_nome_fantasia || exame.EMPRESA),
              valor: valorRep
            }));
          } catch {}
        }
        const rowData = [
          exame.DATA_REALIZACAO ? new Date(exame.DATA_REALIZACAO).toLocaleDateString('pt-BR') : '-',
          (exame.NOME_PACIENTE || '-').substring(0, 16),
          (exame.MEDICO || '-').substring(0, 16),
          (exame.ESPECIALIDADE || '-').substring(0, 20),
          (exame.MODALIDADE || '-').substring(0, 6),
          (exame.ESPECIALIDADE || '-').substring(0, 13),
          (exame.CATEGORIA || '-').substring(0, 6),
          (exame.PRIORIDADE || '-').substring(0, 10),
          (exame.ACCESSION_NUMBER ? String(exame.ACCESSION_NUMBER) : '-').substring(0, 20),
          (exame.Cliente_Nome_Fantasia || exame.cliente_nome_fantasia || exame.EMPRESA || '-').substring(0, 10),
          '1',
          formatMoeda(valorRep)
        ];
        idx++;

        for (let i = 0; i < rowData.length; i++) {
          page.drawText(rowData[i], { 
            x: xPos + 2, 
            y: yPosition - 10, 
            size: 7, 
            font 
          });
          xPos += colWidths[i];
        }

        yPosition -= 15;
      }

      // Total geral no final da tabela
      yPosition -= 5;
      page.drawRectangle({
        x: tableMargin,
        y: yPosition - 15,
        width: pageWidth - (tableMargin * 2),
        height: 18,
        color: rgb(0.85, 0.85, 0.85),
      });

      page.drawText('TOTAL GERAL:', { 
        x: pageWidth - 200, 
        y: yPosition - 11, 
        size: 9, 
        font: fontBold 
      });
      page.drawText(formatMoeda(detalhes.valor_total || 0), { 
        x: pageWidth - 110, 
        y: yPosition - 11, 
        size: 9, 
        font: fontBold,
        color: rgb(0, 0.4, 0)
      });
    }

    // Voltar para página portrait para valores adicionais
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

    // Adicionar rodapés em todas as páginas
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    pages.forEach((pg, index) => {
      const pgWidth = pg.getWidth();
      pg.drawText('Relatório gerado automaticamente pelo sistema visus.a.i. © 2025 - Todos os direitos reservados', {
        x: 50,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
      pg.drawText(`Página ${index + 1} de ${totalPages}`, {
        x: pgWidth - 100,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    });

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
