import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegraValidacao {
  campo: string;
  tipo: 'data_minima' | 'data_maxima' | 'obrigatorio' | 'valor_padrao' | 'formato';
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

// Regras específicas por tipo de arquivo
const REGRAS_POR_ARQUIVO: Record<string, RegraValidacao[]> = {
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
      tipo: 'data_minima',
      valor: '2023-01-01',
      aplicar_em: ['volumetria_padrao_retroativo'],
      ativo: true
    },
    {
      campo: 'DATA_LAUDO',
      tipo: 'data_minima',
      valor: '2023-01-01',
      aplicar_em: ['volumetria_padrao_retroativo'],
      ativo: true
    },
    {
      campo: 'data_referencia',
      tipo: 'data_minima',
      valor: '2023-01-01',
      aplicar_em: ['volumetria_padrao_retroativo'],
      ativo: true
    },
    {
      campo: 'data_referencia',
      tipo: 'data_maxima',
      valor: new Date().toISOString().split('T')[0], // Hoje
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
      tipo: 'data_minima',
      valor: '2023-01-01',
      aplicar_em: ['volumetria_fora_padrao_retroativo'],
      ativo: true
    },
    {
      campo: 'DATA_LAUDO',
      tipo: 'data_minima',
      valor: '2023-01-01',
      aplicar_em: ['volumetria_fora_padrao_retroativo'],
      ativo: true
    },
    {
      campo: 'data_referencia',
      tipo: 'data_minima',
      valor: '2023-01-01',
      aplicar_em: ['volumetria_fora_padrao_retroativo'],
      ativo: true
    },
    {
      campo: 'data_referencia',
      tipo: 'data_maxima',
      valor: new Date().toISOString().split('T')[0], // Hoje
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
  ]
};

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
  }
  
  return { valido: true };
}

function aplicarValidacoes(registro: VolumetriaRecord): ValidacaoResult {
  const resultado: ValidacaoResult = {
    valido: true,
    registro: { ...registro },
    erros: [],
    modificacoes: []
  };
  
  // Buscar regras aplicáveis para este tipo de arquivo
  const regrasAplicaveis = REGRAS_POR_ARQUIVO[registro.arquivo_fonte] || [];
  
  console.log(`🔍 Aplicando ${regrasAplicaveis.length} regras para arquivo ${registro.arquivo_fonte}`);
  
  for (const regra of regrasAplicaveis) {
    if (!regra.ativo) continue;
    
    const validacao = validarRegra(resultado.registro!, regra);
    
    if (!validacao.valido) {
      resultado.valido = false;
      resultado.erros.push(validacao.erro!);
      console.log(`❌ Regra falhou: ${validacao.erro}`);
    } else if (validacao.modificacao) {
      resultado.modificacoes.push(validacao.modificacao);
      console.log(`✏️ Modificação aplicada: ${validacao.modificacao}`);
    }
  }
  
  return resultado;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { registros, arquivo_fonte } = await req.json();
    
    console.log(`🔧 Iniciando validação de ${registros.length} registros para ${arquivo_fonte}`);
    
    const resultados = {
      registros_validos: [],
      registros_rejeitados: [],
      total_processado: registros.length,
      total_valido: 0,
      total_rejeitado: 0,
      modificacoes_aplicadas: 0,
      regras_aplicadas: REGRAS_POR_ARQUIVO[arquivo_fonte]?.length || 0
    };
    
    for (let i = 0; i < registros.length; i++) {
      const registro = { ...registros[i], arquivo_fonte };
      const validacao = aplicarValidacoes(registro);
      
      if (validacao.valido) {
        resultados.registros_validos.push(validacao.registro);
        resultados.total_valido++;
        if (validacao.modificacoes.length > 0) {
          resultados.modificacoes_aplicadas++;
        }
      } else {
        resultados.registros_rejeitados.push({
          registro_original: registro,
          erros: validacao.erros,
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