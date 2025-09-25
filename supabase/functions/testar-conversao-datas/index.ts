import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 TESTE DE CONVERSÃO DE DATAS BRASILEIRO -> ISO');
    
    // FUNÇÃO PARA CONVERTER DATA BRASILEIRA (dd/mm/yyyy) PARA Date
    const parseDataBrasileira = (dataBrasileira: string): Date | null => {
      if (!dataBrasileira || dataBrasileira.trim() === '') return null;
      
      console.log(`🔄 Processando data: "${dataBrasileira}"`);
      
      // Se já está no formato ISO (yyyy-mm-dd), usar diretamente
      if (dataBrasileira.includes('-') && dataBrasileira.length === 10) {
        const data = new Date(dataBrasileira);
        console.log(`📅 Data ISO: ${dataBrasileira} -> ${data.toISOString().split('T')[0]}`);
        return data;
      }
      
      // Converter formato brasileiro dd/mm/yyyy para yyyy-mm-dd
      const partes = dataBrasileira.trim().split('/');
      if (partes.length === 3) {
        const [dia, mes, ano] = partes;
        
        // Validar valores numéricos
        const diaNum = parseInt(dia, 10);
        const mesNum = parseInt(mes, 10);
        const anoNum = parseInt(ano, 10);
        
        if (isNaN(diaNum) || isNaN(mesNum) || isNaN(anoNum)) {
          console.log(`❌ Valores inválidos: dia=${dia}, mes=${mes}, ano=${ano}`);
          return null;
        }
        
        // Validar ranges
        if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) {
          console.log(`❌ Data fora de range: ${diaNum}/${mesNum}/${anoNum}`);
          return null;
        }
        
        // Criar no formato ISO: yyyy-mm-dd (usando Date constructor diretamente)
        const data = new Date(anoNum, mesNum - 1, diaNum); // mes-1 porque Date usa 0-11 para meses
        console.log(`📅 Data convertida: ${dataBrasileira} -> ${data.toISOString().split('T')[0]}`);
        
        // Verificar se a data criada é válida
        if (data.getFullYear() === anoNum && data.getMonth() === mesNum - 1 && data.getDate() === diaNum) {
          return data;
        } else {
          console.log(`❌ Data inválida após conversão: ${dataBrasileira}`);
          return null;
        }
      }
      
      console.log(`❌ Formato não reconhecido: "${dataBrasileira}"`);
      return null;
    };

    // Testes específicos para junho/2025
    const testeDatas = [
      '01/06/2025', // Deve ser válida para jun/25
      '15/06/2025', // Deve ser válida para jun/25
      '30/06/2025', // Deve ser válida para jun/25
      '01/05/2025', // Deve ser rejeitada para jun/25 (mês anterior)
      '01/07/2025', // Deve ser rejeitada para jun/25 (mês posterior)
      '08/06/2025', // Teste especial - início faturamento
      '07/07/2025', // Teste especial - fim faturamento
    ];

    const resultados = [];
    
    for (const dataStr of testeDatas) {
      console.log(`\n🧪 TESTANDO: ${dataStr}`);
      const dataConvertida = parseDataBrasileira(dataStr);
      
      if (dataConvertida) {
        // Simular validação para jun/25
        const ano = 2025;
        const mes = 6; // junho
        
        const primeiroDiaMes = new Date(ano, mes - 1, 1); // 2025-06-01
        const ultimoDiaMes = new Date(ano, mes, 0); // 2025-06-30
        const inicioFaturamento = new Date(ano, mes - 1, 8); // 2025-06-08
        const fimFaturamento = new Date(ano, mes, 7); // 2025-07-07
        
        console.log(`📊 Datas de referência:`);
        console.log(`   Primeiro dia mês: ${primeiroDiaMes.toISOString().split('T')[0]}`);
        console.log(`   Último dia mês: ${ultimoDiaMes.toISOString().split('T')[0]}`);
        console.log(`   Início faturamento: ${inicioFaturamento.toISOString().split('T')[0]}`);
        console.log(`   Fim faturamento: ${fimFaturamento.toISOString().split('T')[0]}`);
        
        // Teste regra v031 (não-retroativo) - DATA_REALIZACAO
        const validaV031_Realizacao = dataConvertida >= primeiroDiaMes && dataConvertida <= ultimoDiaMes;
        console.log(`✅ v031 DATA_REALIZACAO: ${validaV031_Realizacao ? 'VÁLIDA' : 'REJEITADA'}`);
        
        // Teste regra v031 (não-retroativo) - DATA_LAUDO  
        const validaV031_Laudo = dataConvertida >= primeiroDiaMes && dataConvertida <= fimFaturamento;
        console.log(`✅ v031 DATA_LAUDO: ${validaV031_Laudo ? 'VÁLIDA' : 'REJEITADA'}`);
        
        // Teste regra v003 (retroativo) - DATA_REALIZACAO
        const validaV003 = dataConvertida < primeiroDiaMes;
        console.log(`✅ v003 DATA_REALIZACAO (retroativo): ${validaV003 ? 'VÁLIDA' : 'REJEITADA'}`);
        
        // Teste regra v002 (retroativo) - DATA_LAUDO
        const validaV002 = dataConvertida >= inicioFaturamento && dataConvertida <= fimFaturamento;
        console.log(`✅ v002 DATA_LAUDO (retroativo): ${validaV002 ? 'VÁLIDA' : 'REJEITADA'}`);
        
        resultados.push({
          data_original: dataStr,
          data_convertida: dataConvertida.toISOString().split('T')[0],
          v031_realizacao: validaV031_Realizacao,
          v031_laudo: validaV031_Laudo,
          v003_realizacao: validaV003,
          v002_laudo: validaV002
        });
      } else {
        resultados.push({
          data_original: dataStr,
          data_convertida: null,
          erro: 'Conversão falhou'
        });
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        periodo_testado: 'jun/25',
        resultados: resultados,
        mensagem: 'Teste de conversão de datas concluído - verifique os logs'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ ERRO:', error);
    
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});