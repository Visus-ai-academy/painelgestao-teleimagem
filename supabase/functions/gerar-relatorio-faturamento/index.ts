import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FaturamentoRequest {
  cliente_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
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

    const { cliente_id, periodo, data_inicio, data_fim }: FaturamentoRequest = await req.json();

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

      // Gerar PDF do relatório vazio
      const pdfContent = await gerarPDFRelatorio(relatorio);
      
      // Gerar nome único para o arquivo
      const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
      
      // Salvar PDF no storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relatorios-faturamento')
        .upload(nomeArquivo, pdfContent, {
          contentType: 'application/pdf',
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Erro ao salvar PDF vazio:', uploadError);
        // Se falhar, retornar com link temporário
        const linkRelatorio = `#relatorio-${cliente_id}-${periodo}`;
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            relatorio,
            linkRelatorio,
            nomeArquivo,
            message: `Relatório gerado para ${cliente.nome} - Período sem exames` 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Gerar URL público do PDF
      const { data: { publicUrl } } = supabase.storage
        .from('relatorios-faturamento')
        .getPublicUrl(nomeArquivo);

      return new Response(
        JSON.stringify({ 
          success: true, 
          relatorio,
          linkRelatorio: publicUrl,
          nomeArquivo,
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

    // Gerar PDF do relatório
    const pdfContent = await gerarPDFRelatorio(relatorio);
    
    // Gerar nome único para o arquivo
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.pdf`;
    
    // Salvar PDF no storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('relatorios-faturamento')
      .upload(nomeArquivo, pdfContent, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Erro ao salvar PDF:', uploadError);
      throw new Error(`Erro ao salvar relatório: ${uploadError.message}`);
    }

    // Gerar URL público do PDF
    const { data: { publicUrl } } = supabase.storage
      .from('relatorios-faturamento')
      .getPublicUrl(nomeArquivo);

    console.log('PDF salvo com sucesso:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        relatorio,
        linkRelatorio: publicUrl,
        nomeArquivo,
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

// Função para gerar PDF do relatório
async function gerarPDFRelatorio(relatorio: any): Promise<Uint8Array> {
  // Importar biblioteca para gerar PDF
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
  
  const doc = new jsPDF();
  
  // Configurar fonte
  doc.setFont('helvetica');
  
  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Relatório de Volumetria - Faturamento', 20, 30);
  
  doc.setFontSize(14);
  doc.text(`Período: ${relatorio.periodo}`, 20, 40);
  
  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 45, 190, 45);
  
  // Dados do Cliente
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Dados do Cliente', 20, 60);
  
  doc.setFontSize(12);
  doc.text(`Nome: ${relatorio.cliente.nome}`, 20, 70);
  doc.text(`CNPJ: ${relatorio.cliente.cnpj || 'Não informado'}`, 20, 80);
  doc.text(`Email: ${relatorio.cliente.email}`, 20, 90);
  
  // Linha separadora
  doc.line(20, 95, 190, 95);
  
  // Resumo Financeiro
  doc.setFontSize(16);
  doc.text('Resumo Financeiro', 20, 110);
  
  doc.setFontSize(12);
  let y = 120;
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  
  // Dados financeiros
  const financialData = [
    ['Total de Laudos:', relatorio.resumo.total_laudos.toString()],
    ['Valor Bruto:', formatCurrency(relatorio.resumo.valor_bruto)],
    ['Franquia:', formatCurrency(relatorio.resumo.franquia)],
    ['Ajuste:', formatCurrency(relatorio.resumo.ajuste)],
    ['Valor Total:', formatCurrency(relatorio.resumo.valor_total)],
    ['IRRF (1,5%):', formatCurrency(relatorio.resumo.irrf)],
    ['CSLL (1%):', formatCurrency(relatorio.resumo.csll)],
    ['PIS (0,65%):', formatCurrency(relatorio.resumo.pis)],
    ['COFINS (3%):', formatCurrency(relatorio.resumo.cofins)],
    ['Total Impostos:', formatCurrency(relatorio.resumo.impostos)],
    ['Valor a Pagar:', formatCurrency(relatorio.resumo.valor_a_pagar)]
  ];
  
  financialData.forEach(([label, value]) => {
    doc.text(label, 20, y);
    doc.text(value, 120, y);
    y += 10;
  });
  
  // Nova página se necessário
  if (relatorio.exames.length > 0) {
    doc.addPage();
    
    // Título da tabela de exames
    doc.setFontSize(16);
    doc.text('Detalhamento dos Exames', 20, 30);
    
    // Cabeçalho da tabela
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    y = 45;
    
    doc.text('Data', 20, y);
    doc.text('Paciente', 45, y);
    doc.text('Médico', 85, y);
    doc.text('Modalidade', 120, y);
    doc.text('Especialidade', 150, y);
    doc.text('Valor', 180, y);
    
    // Linha do cabeçalho
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y + 2, 190, y + 2);
    
    y += 10;
    doc.setTextColor(0, 0, 0);
    
    // Dados dos exames (limitado a 20 por página)
    relatorio.exames.slice(0, 20).forEach((exame: any) => {
      const dataFormatada = new Date(exame.data_estudo).toLocaleDateString('pt-BR');
      const pacienteAbrev = exame.paciente.length > 15 ? exame.paciente.substring(0, 15) + '...' : exame.paciente;
      const medicoAbrev = exame.medico.length > 15 ? exame.medico.substring(0, 15) + '...' : exame.medico;
      const modalidadeAbrev = exame.modalidade.length > 12 ? exame.modalidade.substring(0, 12) + '...' : exame.modalidade;
      const especialidadeAbrev = exame.especialidade.length > 12 ? exame.especialidade.substring(0, 12) + '...' : exame.especialidade;
      
      doc.text(dataFormatada, 20, y);
      doc.text(pacienteAbrev, 45, y);
      doc.text(medicoAbrev, 85, y);
      doc.text(modalidadeAbrev, 120, y);
      doc.text(especialidadeAbrev, 150, y);
      doc.text(formatCurrency(exame.valor), 175, y);
      
      y += 8;
      
      // Nova página se necessário
      if (y > 280) {
        doc.addPage();
        y = 30;
      }
    });
    
    if (relatorio.exames.length > 20) {
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`... e mais ${relatorio.exames.length - 20} exames`, 20, y);
    }
  } else {
    // Sem exames
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhum exame encontrado para o período especificado.', 20, y + 20);
  }
  
  // Rodapé
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')} - Página ${i} de ${totalPages}`,
      20,
      285
    );
  }
  
  // Retornar como Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

serve(handler);