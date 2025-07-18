import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExameData {
  [key: string]: any;
}

interface ClienteDB {
  id: string;
  nome: string;
  email: string;
  cnpj: string;
  telefone: string;
}

interface ClienteResumo {
  nome: string;
  email: string;
  cnpj: string;
  telefone: string;
  totalLaudos: number;
  valorTotal: number;
  exames: ExameProcessado[];
}

interface ExameProcessado {
  data: string;
  paciente: string;
  medico: string;
  modalidade: string;
  especialidade: string;
  valor: number;
}

serve(async (req) => {
  console.log('=== PROCESSAR-FATURAMENTO-PDF COMPLETO ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { file_path, periodo, enviar_emails } = body;
    
    if (!file_path || !periodo) {
      throw new Error('Parâmetros file_path e periodo são obrigatórios');
    }
    
    console.log('Processando:', file_path, 'período:', periodo);

    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // STEP 1: Buscar clientes cadastrados no banco
    console.log('STEP 1: Buscando clientes do banco...');
    const { data: clientesDB, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nome, email, cnpj, telefone')
      .eq('ativo', true);

    if (clientesError) {
      console.error('Erro ao buscar clientes:', clientesError);
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`);
    }

    console.log(`${clientesDB?.length || 0} clientes encontrados no banco`);

    // STEP 2: Download do arquivo
    console.log('STEP 2: Download do arquivo...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError?.message || 'Arquivo não encontrado'}`);
    }

    // STEP 3: Processar Excel
    console.log('STEP 3: Processando Excel...');
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Excel processado: ${data.length} linhas`);
    
    if (data.length === 0) {
      throw new Error('Arquivo Excel vazio');
    }

    // Debug: mostrar as primeiras linhas para entender a estrutura
    console.log('Primeiras 3 linhas do Excel:');
    data.slice(0, 3).forEach((row, index) => {
      console.log(`Linha ${index + 1}:`, Object.keys(row));
    });

    // STEP 4: Identificar colunas do Excel
    const primeiraLinha = data[0] as any;
    const colunas = Object.keys(primeiraLinha);
    console.log('Colunas disponíveis:', colunas);

    // Mapear colunas dinamicamente
    const mapeamentoColunas = {
      cliente: findColumn(colunas, ['cliente', 'nome_cliente', 'cliente_nome', 'empresa']),
      valor: findColumn(colunas, ['valor_pagar', 'valor a pagar', 'valor_final', 'valor', 'preco']),
      data: findColumn(colunas, ['data_exame', 'data do exame', 'data', 'dt_exame']),
      paciente: findColumn(colunas, ['paciente', 'nome_paciente', 'nome do paciente']),
      medico: findColumn(colunas, ['medico', 'nome_medico', 'medico_laudador', 'dr']),
      modalidade: findColumn(colunas, ['modalidade', 'tipo_exame', 'exame']),
      especialidade: findColumn(colunas, ['especialidade', 'especialidade_medica'])
    };

    console.log('Mapeamento de colunas:', mapeamentoColunas);

    // STEP 5: Processar dados agrupados por cliente
    console.log('STEP 5: Agrupando dados por cliente...');
    const clientesResumo = new Map<string, ClienteResumo>();

    data.forEach((linha: any, index) => {
      const nomeCliente = getString(linha, mapeamentoColunas.cliente);
      if (!nomeCliente) {
        console.log(`Linha ${index + 1}: Cliente não encontrado`);
        return;
      }

      // Normalizar nome do cliente
      const clienteNormalizado = normalizarNome(nomeCliente);
      
      // Buscar dados do cliente no banco
      const clienteDB = clientesDB?.find(c => 
        normalizarNome(c.nome) === clienteNormalizado
      );

      if (!clientesResumo.has(clienteNormalizado)) {
        clientesResumo.set(clienteNormalizado, {
          nome: clienteDB?.nome || nomeCliente,
          email: clienteDB?.email || 'email@nao-cadastrado.com',
          cnpj: clienteDB?.cnpj || 'CNPJ não cadastrado',
          telefone: clienteDB?.telefone || 'Telefone não cadastrado',
          totalLaudos: 0,
          valorTotal: 0,
          exames: []
        });
      }

      const cliente = clientesResumo.get(clienteNormalizado)!;
      cliente.totalLaudos++;

      // Extrair valor corretamente
      const valor = getNumber(linha, mapeamentoColunas.valor);
      cliente.valorTotal += valor;

      // Adicionar exame processado
      const exameProcessado: ExameProcessado = {
        data: getString(linha, mapeamentoColunas.data) || 'Data não informada',
        paciente: getString(linha, mapeamentoColunas.paciente) || 'Paciente não informado',
        medico: getString(linha, mapeamentoColunas.medico) || 'Médico não informado',
        modalidade: getString(linha, mapeamentoColunas.modalidade) || 'Modalidade não informada',
        especialidade: getString(linha, mapeamentoColunas.especialidade) || 'Especialidade não informada',
        valor: valor
      };

      cliente.exames.push(exameProcessado);
    });

    console.log(`${clientesResumo.size} clientes únicos processados`);

    // Log detalhado dos clientes
    for (const [key, cliente] of clientesResumo) {
      console.log(`Cliente: ${cliente.nome}, Laudos: ${cliente.totalLaudos}, Valor: R$ ${cliente.valorTotal.toFixed(2)}, Email: ${cliente.email}`);
    }

    // STEP 6: Gerar relatórios detalhados
    console.log('STEP 6: Gerando relatórios...');
    const relatoriosGerados = [];

    for (const [key, cliente] of clientesResumo) {
      try {
        const relatorio = gerarRelatorioCompleto(cliente, periodo);
        
        const nomeArquivo = `faturamento_${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${periodo}_${Date.now()}.txt`;
        
        // Converter para UTF-8 corretamente
        const encoder = new TextEncoder();
        const relatorioBytes = encoder.encode(relatorio);
        
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(`relatorios/${nomeArquivo}`, relatorioBytes, {
            contentType: 'text/plain; charset=utf-8',
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(`relatorios/${nomeArquivo}`);

        relatoriosGerados.push({
          cliente: cliente.nome,
          email: cliente.email,
          cnpj: cliente.cnpj,
          url: publicUrl,
          resumo: {
            total_laudos: cliente.totalLaudos,
            valor_pagar: cliente.valorTotal
          },
          email_enviado: false
        });

        console.log(`Relatório gerado para ${cliente.nome}: ${publicUrl}`);

      } catch (error) {
        console.error(`Erro ao processar ${cliente.nome}:`, error);
        relatoriosGerados.push({
          cliente: cliente.nome,
          erro: `Erro: ${error.message}`,
          email_enviado: false
        });
      }
    }

    console.log(`CONCLUÍDO: ${relatoriosGerados.length} relatórios gerados`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Processamento de faturamento concluído com sucesso',
      pdfs_gerados: relatoriosGerados,
      emails_enviados: 0,
      periodo,
      total_clientes: clientesResumo.size
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('ERRO:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders }
    });
  }
});

// Funções auxiliares
function findColumn(colunas: string[], possiveisNomes: string[]): string | null {
  for (const nome of possiveisNomes) {
    const coluna = colunas.find(c => 
      c.toLowerCase().includes(nome.toLowerCase())
    );
    if (coluna) return coluna;
  }
  return null;
}

function getString(linha: any, coluna: string | null): string {
  if (!coluna || !linha[coluna]) return '';
  return String(linha[coluna]).trim();
}

function getNumber(linha: any, coluna: string | null): number {
  if (!coluna || !linha[coluna]) return 0;
  
  const valor = linha[coluna];
  if (typeof valor === 'number') return valor;
  
  // Converter string para number, removendo formatação brasileira
  const valorString = String(valor)
    .replace(/\./g, '') // Remove pontos de milhares
    .replace(',', '.') // Substitui vírgula decimal por ponto
    .replace(/[^\d.-]/g, ''); // Remove caracteres não numéricos
  
  const numero = parseFloat(valorString);
  return isNaN(numero) ? 0 : numero;
}

function normalizarNome(nome: string): string {
  return nome
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\b(LTDA|LTD|SA|S\.A\.|EIRELI|ME|EPP)\b/g, '')
    .trim();
}

function gerarRelatorioCompleto(cliente: ClienteResumo, periodo: string): string {
  const agora = new Date();
  
  return `RELATÓRIO DE FATURAMENTO
========================

DADOS DO CLIENTE
----------------
Nome: ${cliente.nome}
Email: ${cliente.email}
CNPJ: ${cliente.cnpj}
Telefone: ${cliente.telefone}

INFORMAÇÕES DO PERÍODO
----------------------
Período: ${formatarPeriodo(periodo)}
Data de Geração: ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}

RESUMO FINANCEIRO
-----------------
Total de Laudos: ${cliente.totalLaudos}
Valor Total: R$ ${cliente.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

DETALHAMENTO DOS EXAMES
-----------------------
${cliente.exames.slice(0, 50).map((exame, index) => {
  return `${index + 1}. Data: ${exame.data}
   Paciente: ${exame.paciente}
   Médico: ${exame.medico}
   Modalidade: ${exame.modalidade}
   Especialidade: ${exame.especialidade}
   Valor: R$ ${exame.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
   ----------------------------------------`;
}).join('\n')}

${cliente.exames.length > 50 ? `\n... e mais ${cliente.exames.length - 50} exames` : ''}

OBSERVAÇÕES
-----------
- Relatório gerado automaticamente pelo sistema
- Para dúvidas, entre em contato através do email: ${cliente.email}
- Este documento serve como comprovante dos serviços realizados

========================================
Fim do Relatório
========================================`;
}

function formatarPeriodo(periodo: string): string {
  try {
    const [ano, mes] = periodo.split('-');
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[parseInt(mes) - 1]} de ${ano}`;
  } catch {
    return periodo;
  }
}