import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import jsPDF from "https://esm.sh/jspdf@2.5.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FaturamentoRequest {
  cliente_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  formato?: 'pdf' | 'excel' | 'ambos';
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

    const { cliente_id, periodo, data_inicio, data_fim, formato = 'ambos' }: FaturamentoRequest = await req.json();

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

    // Buscar exames do período
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

      // Gerar relatórios nos formatos solicitados
      const arquivos: any[] = [];
      
      if (formato === 'pdf' || formato === 'ambos') {
        const pdfContent = await gerarPDFRelatorio(relatorio);
        const nomeArquivoPDF = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
        
        const { data: uploadDataPDF, error: uploadErrorPDF } = await supabase.storage
          .from('relatorios-faturamento')
          .upload(nomeArquivoPDF, pdfContent, {
            contentType: 'application/pdf',
            cacheControl: '3600'
          });
          
        if (!uploadErrorPDF) {
          const { data: { publicUrl: pdfUrl } } = supabase.storage
            .from('relatorios-faturamento')
            .getPublicUrl(nomeArquivoPDF);
          arquivos.push({ tipo: 'pdf', url: pdfUrl, nome: nomeArquivoPDF });
        }
      }
      
      if (formato === 'excel' || formato === 'ambos') {
        const excelContent = await gerarExcelRelatorio(relatorio);
        const nomeArquivoExcel = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.xlsx`;
        
        const { data: uploadDataExcel, error: uploadErrorExcel } = await supabase.storage
          .from('relatorios-faturamento')
          .upload(nomeArquivoExcel, excelContent, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            cacheControl: '3600'
          });
          
        if (!uploadErrorExcel) {
          const { data: { publicUrl: excelUrl } } = supabase.storage
            .from('relatorios-faturamento')
            .getPublicUrl(nomeArquivoExcel);
          arquivos.push({ tipo: 'excel', url: excelUrl, nome: nomeArquivoExcel });
        }
      }
      
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
        data_estudo: exame.data_exame,
        paciente: exame.paciente,
        medico: exame.medico,
        modalidade: exame.modalidade,
        especialidade: exame.especialidade,
        categoria: exame.categoria || '',
        prioridade: exame.prioridade || '',
        valor: exame.valor_bruto || 0
      }))
    };

    console.log(`Relatório gerado com ${exames.length} exames, valor total: R$ ${valor_total.toFixed(2)}`);

    // Gerar relatórios nos formatos solicitados
    const arquivos: any[] = [];
    
    if (formato === 'pdf' || formato === 'ambos') {
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
      arquivos.push({ tipo: 'pdf', url: pdfUrl, nome: nomeArquivoPDF });
      console.log('PDF salvo com sucesso:', pdfUrl);
    }
    
    if (formato === 'excel' || formato === 'ambos') {
      const excelContent = await gerarExcelRelatorio(relatorio);
      const nomeArquivoExcel = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.xlsx`;
      
      const { data: uploadDataExcel, error: uploadErrorExcel } = await supabase.storage
        .from('relatorios-faturamento')
        .upload(nomeArquivoExcel, excelContent, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          cacheControl: '3600'
        });
        
      if (uploadErrorExcel) {
        console.error('Erro ao salvar Excel:', uploadErrorExcel);
        throw new Error(`Erro ao salvar relatório Excel: ${uploadErrorExcel.message}`);
      }
      
      const { data: { publicUrl: excelUrl } } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(nomeArquivoExcel);
      arquivos.push({ tipo: 'excel', url: excelUrl, nome: nomeArquivoExcel });
      console.log('Excel salvo com sucesso:', excelUrl);
    }

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
    const doc = new jsPDF();
    
    // Configurações
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let y = 30;

    // Cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE VOLUMETRIA - FATURAMENTO', margin, y);
    
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${relatorio.periodo}`, margin, y);
    
    y += 15;
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
      doc.addPage();
      y = 30;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALHAMENTO DOS EXAMES', margin, y);

      y += 15;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      
      // Cabeçalho da tabela
      doc.text('Data', margin, y);
      doc.text('Paciente', margin + 25, y);
      doc.text('Médico', margin + 70, y);
      doc.text('Modalidade', margin + 110, y);
      doc.text('Especialidade', margin + 140, y);
      doc.text('Valor', margin + 170, y);

      y += 8;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');

      // Dados dos exames
      relatorio.exames.forEach((exame: any, index: number) => {
        if (y > 280) { // Nova página se necessário
          doc.addPage();
          y = 30;
        }

        const dataFormatada = new Date(exame.data_estudo).toLocaleDateString('pt-BR');
        const pacienteAbrev = exame.paciente.length > 18 ? exame.paciente.substring(0, 15) + '...' : exame.paciente;
        const medicoAbrev = exame.medico.length > 18 ? exame.medico.substring(0, 15) + '...' : exame.medico;
        const modalidadeAbrev = exame.modalidade.length > 12 ? exame.modalidade.substring(0, 9) + '...' : exame.modalidade;
        const especialidadeAbrev = exame.especialidade.length > 12 ? exame.especialidade.substring(0, 9) + '...' : exame.especialidade;

        doc.text(dataFormatada, margin, y);
        doc.text(pacienteAbrev, margin + 25, y);
        doc.text(medicoAbrev, margin + 70, y);
        doc.text(modalidadeAbrev, margin + 110, y);
        doc.text(especialidadeAbrev, margin + 140, y);
        doc.text(`R$ ${exame.valor.toFixed(2).replace('.', ',')}`, margin + 170, y);

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
      doc.text(`Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')} - Página ${i}/${pageCount}`, margin, 285);
    }

    // Converter para Uint8Array
    const pdfArrayBuffer = doc.output('arraybuffer');
    return new Uint8Array(pdfArrayBuffer);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
}

// Função para gerar Excel do relatório
async function gerarExcelRelatorio(relatorio: any): Promise<Uint8Array> {
  try {
    const workbook = XLSX.utils.book_new();
    
    // Aba 1: Resumo
    const resumoData = [
      ['RELATÓRIO DE VOLUMETRIA - FATURAMENTO'],
      [`Período: ${relatorio.periodo}`],
      [''],
      ['DADOS DO CLIENTE'],
      ['Nome', relatorio.cliente.nome],
      ['CNPJ', relatorio.cliente.cnpj || 'Não informado'],
      ['Email', relatorio.cliente.email],
      [''],
      ['RESUMO FINANCEIRO'],
      ['Item', 'Valor'],
      ['Total de Laudos', relatorio.resumo.total_laudos],
      ['Valor Bruto', relatorio.resumo.valor_bruto],
      ['Franquia', relatorio.resumo.franquia],
      ['Ajuste', relatorio.resumo.ajuste],
      ['Valor Total', relatorio.resumo.valor_total],
      ['IRRF (1,5%)', relatorio.resumo.irrf],
      ['CSLL (1%)', relatorio.resumo.csll],
      ['PIS (0,65%)', relatorio.resumo.pis],
      ['COFINS (3%)', relatorio.resumo.cofins],
      ['Total Impostos', relatorio.resumo.impostos],
      ['VALOR A PAGAR', relatorio.resumo.valor_a_pagar]
    ];
    
    const resumoWS = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(workbook, resumoWS, 'Resumo');

    // Aba 2: Detalhamento dos Exames
    if (relatorio.exames.length > 0) {
      const examesData = [
        ['Data do Exame', 'Paciente', 'Médico', 'Modalidade', 'Especialidade', 'Categoria', 'Prioridade', 'Valor']
      ];
      
      relatorio.exames.forEach((exame: any) => {
        examesData.push([
          new Date(exame.data_estudo).toLocaleDateString('pt-BR'),
          exame.paciente,
          exame.medico,
          exame.modalidade,
          exame.especialidade,
          exame.categoria || '',
          exame.prioridade || '',
          exame.valor
        ]);
      });
      
      const examesWS = XLSX.utils.aoa_to_sheet(examesData);
      XLSX.utils.book_append_sheet(workbook, examesWS, 'Exames');
    }

    // Converter para Uint8Array
    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return new Uint8Array(excelBuffer);

  } catch (error) {
    console.error('Erro ao gerar Excel:', error);
    throw error;
  }
}

serve(handler);