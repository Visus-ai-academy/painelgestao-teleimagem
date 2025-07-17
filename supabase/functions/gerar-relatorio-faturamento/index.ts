import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FaturamentoRequest {
  cliente_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  formato?: 'pdf';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cliente_id, periodo, data_inicio, data_fim, formato = 'pdf' }: FaturamentoRequest = await req.json();

    console.log(`Gerando relatório para cliente ${cliente_id}, período ${periodo}`);

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    // Buscar exames do período para o cliente específico
    console.log(`Buscando exames para cliente ${cliente_id} entre ${data_inicio} e ${data_fim}`);
    
    const { data: exames, error: examesError } = await supabase
      .from('exames_realizados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .gte('data_exame', data_inicio)
      .lte('data_exame', data_fim)
      .order('data_exame', { ascending: true });

    if (examesError) {
      console.error('Erro ao buscar exames:', examesError);
      throw new Error(`Erro ao buscar exames: ${examesError.message}`);
    }

    console.log(`Exames encontrados: ${exames?.length || 0}`);

    if (!exames || exames.length === 0) {
      console.log('Nenhum exame encontrado, gerando relatório vazio');
      // Retornar relatório vazio ao invés de erro 404
      const relatorio = {
        cliente: {
          nome: cliente.nome,
          cnpj: cliente.cnpj,
          email: cliente.email
        },
        periodo: periodo,
        resumo: {
          total_laudos: 0,
          valor_bruto: 0,
          franquia: 0,
          ajuste: 0,
          valor_total: 0,
          irrf: 0,
          csll: 0,
          pis: 0,
          cofins: 0,
          impostos: 0,
          valor_a_pagar: 0
        },
        exames: []
      };

      // Gerar relatório em PDF
      const pdfContent = await gerarPDFRelatorio(relatorio);
      const nomeArquivoPDF = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
      
      const { data: uploadDataPDF, error: uploadErrorPDF } = await supabase.storage
        .from('relatorios-faturamento')
        .upload(nomeArquivoPDF, pdfContent, {
          contentType: 'application/pdf',
          cacheControl: '3600'
        });
        
      if (uploadErrorPDF) {
        throw new Error(`Erro ao salvar relatório PDF: ${uploadErrorPDF.message}`);
      }
      
      const { data: { publicUrl: pdfUrl } } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(nomeArquivoPDF);
      
      const arquivos = [{ tipo: 'pdf', url: pdfUrl, nome: nomeArquivoPDF }];
      
      if (arquivos.length === 0) {
        throw new Error('Erro ao gerar relatórios');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          relatorio,
          arquivos,
          message: `Relatório gerado para ${cliente.nome} - Período sem exames` 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calcular totais
    const total_laudos = exames.length;
    const total_quantidade = exames.reduce((sum, exame) => sum + 1, 0); // Cada exame conta como 1 na quantidade
    const valor_bruto = exames.reduce((sum, exame) => sum + (exame.valor_bruto || 0), 0);
    const franquia = 0;
    const ajuste = 0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    // Gerar dados do relatório
    const relatorio = {
      cliente: {
        nome: cliente.nome,
        cnpj: cliente.cnpj,
        email: cliente.email
      },
      periodo: periodo,
      resumo: {
        total_laudos,
        valor_bruto,
        franquia,
        ajuste,
        valor_total,
        irrf,
        csll,
        pis,
        cofins,
        impostos,
        valor_a_pagar
      },
      exames: exames.map(exame => ({
        data_exame: exame.data_exame,
        nome_exame: exame.modalidade + ' - ' + exame.especialidade,
        paciente: exame.paciente,
        medico: exame.medico,
        modalidade: exame.modalidade,
        especialidade: exame.especialidade,
        categoria: exame.categoria || '',
        prioridade: exame.prioridade || '',
        quantidade: 1,
        valor: exame.valor_bruto || 0
      }))
    };

    console.log(`Relatório gerado com ${exames.length} exames, valor total: R$ ${valor_total.toFixed(2)}`);

    // Gerar relatório em PDF
    const pdfContent = await gerarPDFRelatorio(relatorio);
    const nomeArquivoPDF = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
    
    const { data: uploadDataPDF, error: uploadErrorPDF } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivoPDF, pdfContent, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });
      
    if (uploadErrorPDF) {
      console.error('Erro ao salvar PDF:', uploadErrorPDF);
      throw new Error(`Erro ao salvar relatório PDF: ${uploadErrorPDF.message}`);
    }
    
    const { data: { publicUrl: pdfUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivoPDF);
    
    const arquivos = [{ tipo: 'pdf', url: pdfUrl, nome: nomeArquivoPDF }];
    console.log('PDF salvo com sucesso:', pdfUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        relatorio,
        arquivos,
        message: `Relatório gerado com sucesso para ${cliente.nome}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

// Função para gerar PDF do relatório usando jsPDF
async function gerarPDFRelatorio(relatorio: any): Promise<Uint8Array> {
  try {
    const doc = new jsPDF('landscape'); // Formato paisagem
    
    // Configurações
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let y = 20;

    // Logomarca Teleimagem (texto temporário - seria melhor com imagem real)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 102, 204); // Azul corporativo
    doc.text('TELEIMAGEM', margin, y);
    
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100); // Cinza
    doc.setFont('helvetica', 'normal');
    doc.text('Diagnóstico por Imagem', margin, y);
    
    y += 15;
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0); // Preto
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE VOLUMETRIA - FATURAMENTO', margin, y);
    
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${relatorio.periodo}`, margin, y);
    
    y += 5;
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, margin, y);
    
    y += 10;
    doc.line(margin, y, pageWidth - margin, y);

    // Dados do Cliente
    y += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CLIENTE', margin, y);
    
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${relatorio.cliente.nome}`, margin, y);
    
    y += 6;
    doc.text(`CNPJ: ${relatorio.cliente.cnpj || 'Não informado'}`, margin, y);
    
    y += 6;
    doc.text(`Email: ${relatorio.cliente.email}`, margin, y);

    // Linha separadora
    y += 10;
    doc.line(margin, y, pageWidth - margin, y);

    // Resumo Financeiro
    y += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO FINANCEIRO', margin, y);

    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const financialData = [
      ['Total de Laudos:', relatorio.resumo.total_laudos.toString()],
      ['Valor Bruto:', `R$ ${relatorio.resumo.valor_bruto.toFixed(2).replace('.', ',')}`],
      ['Franquia:', `R$ ${relatorio.resumo.franquia.toFixed(2).replace('.', ',')}`],
      ['Ajuste:', `R$ ${relatorio.resumo.ajuste.toFixed(2).replace('.', ',')}`],
      ['Valor Total:', `R$ ${relatorio.resumo.valor_total.toFixed(2).replace('.', ',')}`],
      ['IRRF (1,5%):', `R$ ${relatorio.resumo.irrf.toFixed(2).replace('.', ',')}`],
      ['CSLL (1%):', `R$ ${relatorio.resumo.csll.toFixed(2).replace('.', ',')}`],
      ['PIS (0,65%):', `R$ ${relatorio.resumo.pis.toFixed(2).replace('.', ',')}`],
      ['COFINS (3%):', `R$ ${relatorio.resumo.cofins.toFixed(2).replace('.', ',')}`],
      ['Total Impostos:', `R$ ${relatorio.resumo.impostos.toFixed(2).replace('.', ',')}`],
      ['VALOR A PAGAR:', `R$ ${relatorio.resumo.valor_a_pagar.toFixed(2).replace('.', ',')}`]
    ];

    financialData.forEach(([label, value], index) => {
      if (index === 4 || index === 10) { // Valor Total e Valor a Pagar
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      
      doc.text(label, margin, y);
      doc.text(value, margin + 80, y);
      y += 6;
    });

    // Detalhamento dos Exames
    if (relatorio.exames.length > 0) {
      doc.addPage('landscape'); // Garantir que a nova página seja paisagem
      y = 30;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`DETALHAMENTO DOS EXAMES (${relatorio.exames.length} laudos)`, margin, y);

      y += 15;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      
      // Cabeçalho da tabela - layout paisagem com mais espaço
      doc.text('Data Exame', margin, y);
      doc.text('Nome do Exame', margin + 25, y);
      doc.text('Paciente', margin + 80, y);
      doc.text('Médico', margin + 120, y);
      doc.text('Categoria', margin + 160, y);
      doc.text('Prioridade', margin + 190, y);
      doc.text('Qtd', margin + 220, y);
      doc.text('Valor', margin + 235, y);

      y += 8;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');

      // Dados dos exames
      relatorio.exames.forEach((exame: any, index: number) => {
        if (y > 180) { // Ajustado para formato paisagem
          doc.addPage('landscape');
          y = 30;
          
          // Repetir cabeçalho na nova página
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('Data Exame', margin, y);
          doc.text('Nome do Exame', margin + 25, y);
          doc.text('Paciente', margin + 80, y);
          doc.text('Médico', margin + 120, y);
          doc.text('Categoria', margin + 160, y);
          doc.text('Prioridade', margin + 190, y);
          doc.text('Qtd', margin + 220, y);
          doc.text('Valor', margin + 235, y);
          y += 8;
          doc.line(margin, y, pageWidth - margin, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
        }

        const dataFormatada = new Date(exame.data_exame).toLocaleDateString('pt-BR');
        const nomeExameAbrev = exame.nome_exame.length > 25 ? exame.nome_exame.substring(0, 22) + '...' : exame.nome_exame;
        const pacienteAbrev = exame.paciente.length > 18 ? exame.paciente.substring(0, 15) + '...' : exame.paciente;
        const medicoAbrev = exame.medico.length > 18 ? exame.medico.substring(0, 15) + '...' : exame.medico;
        const categoriaAbrev = exame.categoria.length > 12 ? exame.categoria.substring(0, 9) + '...' : exame.categoria;
        const prioridadeAbrev = exame.prioridade.length > 10 ? exame.prioridade.substring(0, 7) + '...' : exame.prioridade;

        doc.text(dataFormatada, margin, y);
        doc.text(nomeExameAbrev, margin + 25, y);
        doc.text(pacienteAbrev, margin + 80, y);
        doc.text(medicoAbrev, margin + 120, y);
        doc.text(categoriaAbrev, margin + 160, y);
        doc.text(prioridadeAbrev, margin + 190, y);
        doc.text(exame.quantidade.toString(), margin + 220, y);
        doc.text(`R$ ${exame.valor.toFixed(2).replace('.', ',')}`, margin + 235, y);

        y += 5;
      });
    } else {
      y += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'italic');
      doc.text('Nenhum exame encontrado para o período especificado.', margin, y);
    }

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')} - Página ${i}/${pageCount}`, margin, pageHeight - 15);
    }

    // Converter para Uint8Array
    const pdfArrayBuffer = doc.output('arraybuffer');
    return new Uint8Array(pdfArrayBuffer);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
}


serve(handler);