import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// Removendo jsPDF temporariamente para testar se o erro está na biblioteca
// import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RelatorioRequest {
  cliente_id: string;
  periodo: string; // formato: "2025-07"
}

interface ExameDetalhado {
  data_estudo: string;
  paciente: string;
  nome_exame: string;
  laudado_por: string;
  prioridade: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  laudos: number;
  valor: number;
}

interface ResumoFinanceiro {
  total_laudos: number;
  franquia: number;
  ajuste: number;
  valor_bruto: number;
  valor_total: number;
  irrf: number;
  csll: number;
  pis: number;
  cofins: number;
  impostos: number;
  valor_a_pagar: number;
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

    const { cliente_id, periodo }: RelatorioRequest = await req.json();
    console.log(`🔥 INICIANDO GERAÇÃO DE RELATÓRIO - Cliente: ${cliente_id}, Período: ${periodo}`);

    // Extrair ano e mês do período (formato: "2025-07")
    const [ano, mes] = periodo.split('-');
    const data_inicio = `${ano}-${mes}-01`;
    const data_fim = `${ano}-${mes}-31`;
    
    console.log(`📅 Período: ${data_inicio} até ${data_fim}`);

    // 1. BUSCAR DADOS DO CLIENTE
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      console.error('❌ Cliente não encontrado:', clienteError);
      throw new Error(`Cliente não encontrado: ${clienteError?.message}`);
    }

    console.log(`👤 Cliente encontrado: ${cliente.nome}`);

    // 2. BUSCAR DADOS DE FATURAMENTO (CORREÇÃO: paciente = código do cliente)
    const { data: dadosFaturamento, error: faturamentoError } = await supabase
      .from('faturamento')
      .select('*')
      .eq('paciente', cliente.nome) // CORRETO: paciente contém o código do cliente
      .gte('data_emissao', data_inicio)
      .lte('data_emissao', data_fim)
      .order('data_emissao', { ascending: true });

    if (faturamentoError) {
      console.error('❌ Erro ao buscar faturamento:', faturamentoError);
      throw new Error(`Erro ao buscar dados de faturamento: ${faturamentoError.message}`);
    }

    console.log(`💰 Dados de faturamento encontrados: ${dadosFaturamento?.length || 0} registros`);
    console.log(`🔍 Filtro usado: paciente = '${cliente.nome}' (código do cliente)`);

    // Verificar se temos dados suficientes para gerar o relatório
    if (!dadosFaturamento || dadosFaturamento.length === 0) {
      console.log('❌ Nenhum dado de faturamento encontrado para o período');
      console.log(`Cliente: ${cliente.nome}, Período: ${periodo}`);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum dado de faturamento encontrado',
          details: `Não foram encontrados dados de faturamento para cliente ${cliente.nome} no período ${periodo}. Verifique se o arquivo de faturamento foi processado corretamente.`,
          cliente: cliente.nome,
          periodo,
          debug: {
            filtro_usado: `paciente = '${cliente.nome}'`,
            data_inicio,
            data_fim
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. PROCESSAR DADOS DE FATURAMENTO
    console.log('📊 Usando dados da tabela FATURAMENTO');
    let examesDetalhados: ExameDetalhado[] = [];
    let fonteDados = 'faturamento';
      
    examesDetalhados = dadosFaturamento.map(item => ({
      data_estudo: item.data_exame || item.data_emissao || data_inicio,
      paciente: item.cliente || 'NÃO INFORMADO', // CORRETO: cliente contém o nome do paciente
      nome_exame: item.nome_exame || `${item.modalidade || ''} ${item.especialidade || ''}`.trim() || 'EXAME NÃO ESPECIFICADO',
      laudado_por: item.medico || 'NÃO INFORMADO',
      prioridade: item.prioridade || 'NORMAL',
      modalidade: item.modalidade || 'NÃO INFORMADO',
      especialidade: item.especialidade || 'NÃO INFORMADO', 
      categoria: item.categoria || 'NORMAL',
      laudos: item.quantidade || 1,
      valor: Number(item.valor_bruto) || Number(item.valor) || 0
    }));

    console.log(`📈 Fonte de dados: ${fonteDados}`);
    console.log(`📝 Total de exames processados: ${examesDetalhados.length}`);

    // 5. CALCULAR RESUMO FINANCEIRO (IGUAL AO SCRIPT PYTHON)
    const total_laudos = examesDetalhados.reduce((sum, exame) => sum + exame.laudos, 0);
    const valor_bruto = examesDetalhados.reduce((sum, exame) => sum + exame.valor, 0);
    const franquia = 0.0;
    const ajuste = 0.0;
    const valor_total = valor_bruto + franquia + ajuste;
    
    // Impostos exatamente como no Python
    const irrf = valor_total * 0.015;
    const csll = valor_total * 0.01;
    const pis = valor_total * 0.0065;
    const cofins = valor_total * 0.03;
    const impostos = irrf + csll + pis + cofins;
    const valor_a_pagar = valor_total - impostos;

    const resumo: ResumoFinanceiro = {
      total_laudos,
      franquia,
      ajuste,
      valor_bruto,
      valor_total,
      irrf,
      csll,
      pis,
      cofins,
      impostos,
      valor_a_pagar
    };

    console.log(`💵 Resumo calculado:`, resumo);

    // 6. RETORNAR DADOS SEM PDF (TESTE)
    console.log(`✅ Dados processados com sucesso - ${examesDetalhados.length} exames`);
    
    // Temporariamente desabilitando geração de PDF para testar
    const nomeArquivo = `relatorio_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.json`;
    const publicUrl = `https://exemplo.com/${nomeArquivo}`;

    // 8. RESPOSTA FINAL
    return new Response(
      JSON.stringify({ 
        success: true,
        cliente: cliente.nome,
        periodo,
        resumo,
        total_exames: examesDetalhados.length,
        fonte_dados: fonteDados,
        arquivos: [{
          tipo: 'pdf',
          url: publicUrl,
          nome: nomeArquivo
        }],
        message: `Relatório gerado com sucesso - ${total_laudos} laudos, valor total: R$ ${valor_total.toFixed(2)}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
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

// FUNÇÃO PARA GERAR PDF COMPLETO (REMOVIDA TEMPORARIAMENTE)
/*
async function gerarPDFCompleto(dados: {
  cliente: any;
  periodo: string;
  resumo: ResumoFinanceiro;
  exames: ExameDetalhado[];
}): Promise<Uint8Array> {
  
  const { cliente, periodo, resumo, exames } = dados;
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  let y = 20;

  // CABEÇALHO - LOGOMARCA E TÍTULO
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 204);
  doc.text('TELEIMAGEM', pageWidth - 60, 15);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');  
  doc.text('Diagnóstico por Imagem', pageWidth - 60, 22);

  // TÍTULO PRINCIPAL
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('DEMONSTRATIVO DE FATURAMENTO', margin, y);
  
  y += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${cliente.nome}`, margin, y);
  
  y += 6;
  const [ano, mes] = periodo.split('-');
  const nomesMeses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                     'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesNome = nomesMeses[parseInt(mes)] || mes;
  doc.text(`Mês de Faturamento: ${mesNome}/${ano}`, margin, y);

  y += 10;
  doc.line(margin, y, pageWidth - margin, y);
  
  // RESUMO FINANCEIRO (TABELA)
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO', margin, y);
  
  y += 8;
  const larguraLabel = 65;
  const larguraValor = 40;
  
  // Função para adicionar linha na tabela
  const adicionarLinha = (label: string, valor: string | number, isBold = false) => {
    if (isBold) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');
    
    doc.rect(margin, y, larguraLabel, 6);
    doc.rect(margin + larguraLabel, y, larguraValor, 6);
    
    doc.text(label, margin + 2, y + 4);
    
    const valorFormatado = typeof valor === 'number' 
      ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : valor;
    
    doc.text(valorFormatado, margin + larguraLabel + larguraValor - 2, y + 4, { align: 'right' });
    y += 6;
  };

  // Linhas do resumo (exatamente como no Python)
  adicionarLinha('Total de laudos:', resumo.total_laudos.toLocaleString('pt-BR'));
  adicionarLinha('Valor total faturado:', `R$ ${resumo.valor_total.toFixed(2)}`);
  adicionarLinha('Franquia:', `R$ ${resumo.franquia.toFixed(2)}`);
  adicionarLinha('Desconto / Acréscimo:', `R$ ${resumo.ajuste.toFixed(2)}`);
  adicionarLinha('IRRF (1,5%):', `R$ ${resumo.irrf.toFixed(2)}`);
  adicionarLinha('CSLL (1,0%):', `R$ ${resumo.csll.toFixed(2)}`);
  adicionarLinha('PIS (0,65%):', `R$ ${resumo.pis.toFixed(2)}`);
  adicionarLinha('Cofins (3,0%):', `R$ ${resumo.cofins.toFixed(2)}`);
  adicionarLinha('Valor a pagar:', `R$ ${resumo.valor_a_pagar.toFixed(2)}`, true);

  // DETALHAMENTO DOS EXAMES
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DETALHAMENTO DOS EXAMES', margin, y);
  
  y += 8;
  
  // Cabeçalho da tabela de exames (como no Python)
  const titulos = [
    'Data Estudo', 'Paciente', 'Nome Exame', 'Laudado por',
    'Prior', 'Mod', 'Especialidade', 'Categoria', 'Laudos', 'Valor'
  ];
  const larguras = [20, 50, 38, 40, 10, 10, 35, 18, 12, 22]; // Larguras exatas do Python
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  let x = margin;
  for (let i = 0; i < titulos.length; i++) {
    doc.rect(x, y, larguras[i], 7);
    doc.text(titulos[i], x + larguras[i]/2, y + 4.5, { align: 'center' });
    x += larguras[i];
  }
  y += 7;

  // Dados dos exames
  doc.setFont('helvetica', 'normal');
  for (const exame of exames) {
    // Verificar se cabe na página
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    
    const dados = [
      new Date(exame.data_estudo).toLocaleDateString('pt-BR'),
      exame.paciente,
      exame.nome_exame,
      exame.laudado_por,
      exame.prioridade,
      exame.modalidade,
      exame.especialidade,
      exame.categoria,
      exame.laudos.toString(),
      `R$ ${exame.valor.toFixed(2)}`
    ];
    
    x = margin;
    for (let i = 0; i < dados.length; i++) {
      doc.rect(x, y, larguras[i], 6);
      
      // Truncar texto se muito longo
      let texto = dados[i];
      if (texto.length > 20 && [1, 2, 3, 6].includes(i)) { // Campos longos
        texto = texto.substring(0, 17) + '...';
      }
      
      doc.text(texto, x + 2, y + 4);
      x += larguras[i];
    }
    y += 6;
  }

  // Converter para Uint8Array
  const pdfArrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(pdfArrayBuffer);
}
*/

serve(handler);