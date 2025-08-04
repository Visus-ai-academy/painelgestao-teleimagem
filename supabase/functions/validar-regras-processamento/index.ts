import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegraValidacao {
  campo: string;
  tipo: 'data_minima' | 'data_maxima' | 'obrigatorio' | 'valor_padrao' | 'formato' | 'buscar_de_para_quebra' | 'exclusao_periodo_faturamento';
  valor: any;
  aplicar_em: string[];
  ativo: boolean;
}

interface VolumetriaRecord {
  EMPRESA?: string;
  NOME_PACIENTE?: string;
  ESTUDO_DESCRICAO?: string;
  DATA_REALIZACAO?: Date;
  DATA_LAUDO?: Date;
  VALORES?: number;
  ESPECIALIDADE?: string;
  MODALIDADE?: string;
  PRIORIDADE?: string;
  arquivo_fonte: string;
  data_referencia?: Date;
}

interface ValidacaoResult {
  valido: boolean;
  registro?: VolumetriaRecord;
  erros: string[];
  modificacoes: string[];
}

// Função para calcular datas do período de faturamento
function calcularDatasPeriodoFaturamento(periodoReferencia: string) {
  // Formato esperado: "junho/2025", "jun/25", etc.
  const [mesStr, anoStr] = periodoReferencia.toLowerCase().split('/');
  
  const meses = {
    'janeiro': 1, 'jan': 1,
    'fevereiro': 2, 'fev': 2,
    'março': 3, 'mar': 3,
    'abril': 4, 'abr': 4,
    'maio': 5, 'mai': 5,
    'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7,
    'agosto': 8, 'ago': 8,
    'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10,
    'novembro': 11, 'nov': 11,
    'dezembro': 12, 'dez': 12
  };
  
  const mes = meses[mesStr];
  const ano = anoStr.length === 2 ? 2000 + parseInt(anoStr) : parseInt(anoStr);
  
  if (!mes || !ano) {
    throw new Error(`Período inválido: ${periodoReferencia}`);
  }
  
  // Data limite para DATA_REALIZACAO (primeiro dia do mês do período)
  const dataLimiteRealizacao = new Date(ano, mes - 1, 1);
  
  // Período de faturamento: dia 8 do mês anterior até dia 7 do mês atual
  const inicioFaturamento = new Date(ano, mes - 2, 8); // mês anterior, dia 8
  const fimFaturamento = new Date(ano, mes - 1, 7); // mês atual, dia 7
  
  return {
    dataLimiteRealizacao,
    inicioFaturamento,
    fimFaturamento
  };
}

// Regras específicas por tipo de arquivo
function gerarRegrasPorArquivo(periodoReferencia?: string): Record<string, RegraValidacao[]> {
  return {
    'volumetria_padrao': [
      {
        campo: 'VALORES',
        tipo: 'valor_padrao',
        valor: 1,
        aplicar_em: ['volumetria_padrao'],
        ativo: true
      },
      {
        campo: 'MODALIDADE',
        tipo: 'valor_padrao',
        valor: 'CR',
        aplicar_em: ['volumetria_padrao'],
        ativo: true
      }
    ],
    'volumetria_fora_padrao': [
      {
        campo: 'VALORES',
        tipo: 'obrigatorio',
        valor: null,
        aplicar_em: ['volumetria_fora_padrao'],
        ativo: true
      }
    ],
    'volumetria_padrao_retroativo': [
      {
        campo: 'DATA_REALIZACAO',
        tipo: 'exclusao_periodo_faturamento',
        valor: periodoReferencia,
        aplicar_em: ['volumetria_padrao_retroativo'],
        ativo: true
      },
      {
        campo: 'DATA_LAUDO',
        tipo: 'exclusao_periodo_faturamento',
        valor: periodoReferencia,
        aplicar_em: ['volumetria_padrao_retroativo'],
        ativo: true
      },
      {
        campo: 'ESPECIALIDADE',
        tipo: 'obrigatorio',
        valor: null,
        aplicar_em: ['volumetria_padrao_retroativo'],
        ativo: true
      }
    ],
    'volumetria_fora_padrao_retroativo': [
      {
        campo: 'DATA_REALIZACAO',
        tipo: 'exclusao_periodo_faturamento',
        valor: periodoReferencia,
        aplicar_em: ['volumetria_fora_padrao_retroativo'],
        ativo: true
      },
      {
        campo: 'DATA_LAUDO',
        tipo: 'exclusao_periodo_faturamento',
        valor: periodoReferencia,
        aplicar_em: ['volumetria_fora_padrao_retroativo'],
        ativo: true
      },
      {
        campo: 'VALORES',
        tipo: 'obrigatorio',
        valor: null,
        aplicar_em: ['volumetria_fora_padrao_retroativo'],
        ativo: true
      }
    ],
    'data_laudo': [
      {
        campo: 'DATA_LAUDO',
        tipo: 'obrigatorio',
        valor: null,
        aplicar_em: ['data_laudo'],
        ativo: true
      },
      {
        campo: 'DATA_LAUDO',
        tipo: 'data_maxima',
        valor: new Date().toISOString().split('T')[0], // Hoje
        aplicar_em: ['data_laudo'],
        ativo: true
      }
    ],
    'data_exame': [
      {
        campo: 'DATA_REALIZACAO',
        tipo: 'obrigatorio',
        valor: null,
        aplicar_em: ['data_exame'],
        ativo: true
      },
      {
        campo: 'DATA_REALIZACAO',
        tipo: 'data_maxima',
        valor: new Date().toISOString().split('T')[0], // Hoje
        aplicar_em: ['data_exame'],
        ativo: true
      }
    ],
    'volumetria_onco_padrao': [
      {
        campo: 'CATEGORIA',
        tipo: 'valor_padrao',
        valor: 'Onco',
        aplicar_em: ['volumetria_onco_padrao'],
        ativo: true
      },
      {
        campo: 'VALORES',
        tipo: 'buscar_de_para_quebra',
        valor: null,
        aplicar_em: ['volumetria_onco_padrao'],
        ativo: true
      }
    ]
  };
}

function converterParaData(valor: any): Date | null {
  if (!valor) return null;
  
  if (valor instanceof Date) return valor;
  
  if (typeof valor === 'string') {
    // Tentar formato brasileiro DD/MM/YYYY
    const brazilianFormat = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = valor.match(brazilianFormat);
    
    if (match) {
      const [, day, month, year] = match;
      const fullYear = year.length === 2 ? `20${year}` : year;
      const date = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Tentar formato ISO
    const isoDate = new Date(valor);
    return isNaN(isoDate.getTime()) ? null : isoDate;
  }
  
  return null;
}

function validarRegra(registro: VolumetriaRecord, regra: RegraValidacao): { valido: boolean; erro?: string; modificacao?: string } {
  const valorCampo = registro[regra.campo as keyof VolumetriaRecord];
  
  switch (regra.tipo) {
    case 'data_minima':
      const dataMinima = new Date(regra.valor);
      const dataCampo = converterParaData(valorCampo);
      
      if (!dataCampo) {
        return { valido: false, erro: `Campo ${regra.campo} é obrigatório para validação de data mínima` };
      }
      
      if (dataCampo < dataMinima) {
        return { 
          valido: false, 
          erro: `${regra.campo} (${dataCampo.toISOString().split('T')[0]}) é anterior à data mínima permitida (${regra.valor})` 
        };
      }
      break;
      
    case 'data_maxima':
      const dataMaxima = new Date(regra.valor);
      const dataCampoMax = converterParaData(valorCampo);
      
      if (dataCampoMax && dataCampoMax > dataMaxima) {
        return { 
          valido: false, 
          erro: `${regra.campo} (${dataCampoMax.toISOString().split('T')[0]}) é posterior à data máxima permitida (${regra.valor})` 
        };
      }
      break;
      
    case 'obrigatorio':
      if (!valorCampo || (typeof valorCampo === 'string' && valorCampo.trim() === '') || 
          (typeof valorCampo === 'number' && (valorCampo === 0 || isNaN(valorCampo)))) {
        return { valido: false, erro: `Campo ${regra.campo} é obrigatório` };
      }
      break;
      
    case 'valor_padrao':
      if (!valorCampo || (typeof valorCampo === 'string' && valorCampo.trim() === '') || 
          (typeof valorCampo === 'number' && (valorCampo === 0 || isNaN(valorCampo)))) {
        // Aplicar valor padrão
        (registro as any)[regra.campo] = regra.valor;
        return { valido: true, modificacao: `${regra.campo} preenchido com valor padrão: ${regra.valor}` };
      }
      break;
      
    case 'buscar_de_para_quebra':
      // Esta regra será processada externamente
      return { valido: true, modificacao: `Campo ${regra.campo} será processado via De-Para/Quebra` };
    
    case 'exclusao_periodo_faturamento':
      if (!regra.valor) {
        return { valido: true }; // Sem período definido, não aplica exclusão
      }
      
      try {
        const { dataLimiteRealizacao, inicioFaturamento, fimFaturamento } = calcularDatasPeriodoFaturamento(regra.valor);
        
        if (regra.campo === 'DATA_REALIZACAO') {
          const dataRealizacao = converterParaData(registro.DATA_REALIZACAO);
          if (dataRealizacao && dataRealizacao > dataLimiteRealizacao) {
            return { valido: false, erro: `DATA_REALIZACAO (${dataRealizacao.toLocaleDateString('pt-BR')}) posterior ao período de faturamento (${dataLimiteRealizacao.toLocaleDateString('pt-BR')})` };
          }
        }
        
        if (regra.campo === 'DATA_LAUDO') {
          const dataLaudo = converterParaData(registro.DATA_LAUDO);
          if (dataLaudo && (dataLaudo < inicioFaturamento || dataLaudo > fimFaturamento)) {
            return { valido: false, erro: `DATA_LAUDO (${dataLaudo.toLocaleDateString('pt-BR')}) fora do período de faturamento (${inicioFaturamento.toLocaleDateString('pt-BR')} a ${fimFaturamento.toLocaleDateString('pt-BR')})` };
          }
        }
        
        return { valido: true };
      } catch (error) {
        return { valido: false, erro: `Erro ao processar período: ${error.message}` };
      }
    
    default:
      return { valido: false, erro: `Tipo de regra não reconhecido: ${regra.tipo}` };
  }
  
  return { valido: true };
}

function aplicarValidacoes(registro: VolumetriaRecord, periodoReferencia?: string): ValidacaoResult {
  const regrasPorArquivo = gerarRegrasPorArquivo(periodoReferencia);
  const regras = regrasPorArquivo[registro.arquivo_fonte] || [];
  const erros: string[] = [];
  const modificacoes: string[] = [];
  let registroModificado = { ...registro };

  for (const regra of regras) {
    if (!regra.ativo) continue;
    
    const validacao = validarRegra(registroModificado, regra);
    
    if (!validacao.valido) {
      erros.push(validacao.erro!);
    } else if (validacao.modificacao) {
      modificacoes.push(validacao.modificacao);
    }
  }

  return {
    valido: erros.length === 0,
    registro: registroModificado,
    erros,
    modificacoes
  };
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { records, arquivo_fonte, periodo_referencia } = await req.json();
    
    console.log(`🔧 Iniciando validação de ${records.length} registros para ${arquivo_fonte}`);
    if (periodo_referencia) {
      console.log(`📅 Período de referência: ${periodo_referencia}`);
    }
    
    const resultados = {
      registros_validos: [],
      registros_rejeitados: [],
      total_processado: records.length,
      total_valido: 0,
      total_rejeitado: 0,
      modificacoes_aplicadas: 0,
      periodo_aplicado: periodo_referencia || null
    };
    
    for (let i = 0; i < records.length; i++) {
      const registro = { ...records[i], arquivo_fonte };
      
      // Tratamento especial para arquivos ONCO
      if (arquivo_fonte === 'volumetria_onco_padrao') {
        console.log(`🩺 Processando registro ONCO: "${registro.ESTUDO_DESCRICAO}"`);
        
        // 1. Aplicar categoria "Onco" automaticamente
        registro.CATEGORIA = 'Onco';
        
        // 2. Buscar valor se VALORES estiver zerado
        if (!registro.VALORES || registro.VALORES === 0) {
          try {
            console.log(`🔍 Buscando valor para exame: "${registro.ESTUDO_DESCRICAO}"`);
            
            const response = await fetch(Deno.env.get('SUPABASE_URL') + '/functions/v1/buscar-valor-onco', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({
                estudo_descricao: registro.ESTUDO_DESCRICAO
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.resultado.encontrado) {
                registro.VALORES = data.resultado.valor_encontrado;
                console.log(`✅ Valor encontrado para "${registro.ESTUDO_DESCRICAO}": ${registro.VALORES} (fonte: ${data.resultado.fonte})`);
              } else {
                console.log(`⚠️ Valor não encontrado para "${registro.ESTUDO_DESCRICAO}"`);
              }
            }
          } catch (error) {
            console.error(`❌ Erro ao buscar valor para "${registro.ESTUDO_DESCRICAO}":`, error);
          }
        }
      }
      
      // Aplicar validações
      const resultado = aplicarValidacoes(registro, periodo_referencia);
      
      if (resultado.valido) {
        resultados.registros_validos.push(resultado.registro);
        resultados.total_valido++;
        if (resultado.modificacoes.length > 0) {
          resultados.modificacoes_aplicadas++;
        }
      } else {
        resultados.registros_rejeitados.push({
          registro_original: registro,
          erros: resultado.erros,
          linha: i + 1
        });
        resultados.total_rejeitado++;
      }
    }
    
    console.log(`✅ Validação concluída: ${resultados.total_valido} válidos, ${resultados.total_rejeitado} rejeitados`);
    
    return new Response(JSON.stringify({
      success: true,
      resultados
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro na validação:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}