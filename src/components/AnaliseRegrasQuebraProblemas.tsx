import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bug, Database, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnaliseRegrasQuebra {
  registros_zerados_com_quebra: Array<{
    ESTUDO_DESCRICAO: string;
    arquivo_fonte: string;
    VALORES: number;
    regra_quebra: string;
    valor_esperado: number | null;
    problema: string;
  }>;
  registros_zerados_com_depara: Array<{
    ESTUDO_DESCRICAO: string;
    arquivo_fonte: string;
    VALORES: number;
    valor_depara: number;
    problema: string;
  }>;
  total_problemas: number;
  problemas_identificados: string[];
}

export function AnaliseRegrasQuebraProblemas() {
  const [analise, setAnalise] = useState<AnaliseRegrasQuebra | null>(null);
  const [loading, setLoading] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);

  const analisarProblemasRegras = async () => {
    setLoading(true);
    
    try {
      console.log('🔍 Analisando problemas nas regras de quebra...');

      // 1. Buscar TODOS os registros zerados
      const { data: registrosZerados, error: errorZerados } = await supabase
        .from('volumetria_mobilemed')
        .select('ESTUDO_DESCRICAO, arquivo_fonte, VALORES')
        .or('VALORES.eq.0,VALORES.is.null');

      if (errorZerados) throw errorZerados;

      console.log(`📊 Total de registros zerados: ${registrosZerados?.length || 0}`);

      // 2. Buscar regras de quebra ativas
      const { data: regrasQuebra, error: errorQuebra } = await supabase
        .from('regras_quebra_exames')
        .select('exame_original, exame_quebrado')
        .eq('ativo', true);

      if (errorQuebra) throw errorQuebra;

      // 3. Buscar valores no De-Para
      const { data: valoresDePara, error: errorDePara } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao, valores')
        .eq('ativo', true);

      if (errorDePara) throw errorDePara;

      // Criar mapeamentos para busca rápida
      const mapRegrasQuebra = new Map();
      regrasQuebra?.forEach(regra => {
        mapRegrasQuebra.set(regra.exame_quebrado, regra.exame_original);
        mapRegrasQuebra.set(regra.exame_original, regra.exame_original);
      });

      const mapDePara = new Map();
      valoresDePara?.forEach(valor => {
        mapDePara.set(valor.estudo_descricao, valor.valores);
      });

      console.log(`📋 Regras de quebra: ${regrasQuebra?.length || 0}`);
      console.log(`📋 Valores De-Para: ${valoresDePara?.length || 0}`);

      // 4. Analisar registros zerados que deveriam ter valor
      const registrosZeradosComQuebra: any[] = [];
      const registrosZeradosComDePara: any[] = [];
      const problemasIdentificados: string[] = [];

      for (const registro of registrosZerados || []) {
        const nomeExame = registro.ESTUDO_DESCRICAO?.trim();
        
        if (!nomeExame) continue;

        // Verificar se existe na quebra
        if (mapRegrasQuebra.has(nomeExame)) {
          const exameOriginal = mapRegrasQuebra.get(nomeExame);
          const valorEsperado = mapDePara.get(exameOriginal);
          
          registrosZeradosComQuebra.push({
            ESTUDO_DESCRICAO: nomeExame,
            arquivo_fonte: registro.arquivo_fonte,
            VALORES: registro.VALORES || 0,
            regra_quebra: exameOriginal,
            valor_esperado: valorEsperado,
            problema: valorEsperado ? 'Valor encontrado mas não aplicado' : 'Regra de quebra sem valor no De-Para'
          });

          if (valorEsperado && !problemasIdentificados.includes('Regras de quebra não aplicadas')) {
            problemasIdentificados.push('Regras de quebra não aplicadas');
          }
          
          if (!valorEsperado && !problemasIdentificados.includes('Regras de quebra sem valores')) {
            problemasIdentificados.push('Regras de quebra sem valores');
          }
        }

        // Verificar se existe diretamente no De-Para
        if (mapDePara.has(nomeExame)) {
          const valorDePara = mapDePara.get(nomeExame);
          
          registrosZeradosComDePara.push({
            ESTUDO_DESCRICAO: nomeExame,
            arquivo_fonte: registro.arquivo_fonte,
            VALORES: registro.VALORES || 0,
            valor_depara: valorDePara,
            problema: 'Valor no De-Para mas não aplicado'
          });

          if (!problemasIdentificados.includes('De-Para não aplicado')) {
            problemasIdentificados.push('De-Para não aplicado');
          }
        }
      }

      console.log(`🚨 Registros zerados com quebra: ${registrosZeradosComQuebra.length}`);
      console.log(`🚨 Registros zerados com De-Para: ${registrosZeradosComDePara.length}`);

      setAnalise({
        registros_zerados_com_quebra: registrosZeradosComQuebra, // Removida limitação
        registros_zerados_com_depara: registrosZeradosComDePara, // Removida limitação
        total_problemas: registrosZeradosComQuebra.length + registrosZeradosComDePara.length,
        problemas_identificados: problemasIdentificados
      });

      console.log('✅ Análise de problemas concluída');

    } catch (error) {
      console.error('❌ Erro na análise:', error);
      toast.error('Erro ao analisar problemas nas regras');
    } finally {
      setLoading(false);
    }
  };

  const corrigirProblemas = async () => {
    if (!analise || analise.total_problemas === 0) return;

    setCorrigindo(true);
    
    try {
      toast.info('🔧 Iniciando correção automática...');

      // 1. Aplicar regras de quebra
      const { data: resultQuebra, error: errorQuebra } = await supabase.functions.invoke('aplicar-regras-tratamento', {
        body: { arquivo_fonte: 'volumetria_fora_padrao' }
      });

      if (errorQuebra) {
        console.error('❌ Erro ao aplicar regras de quebra:', errorQuebra);
      } else {
        console.log('✅ Regras de quebra aplicadas:', resultQuebra);
      }

      // 2. Aplicar De-Para
      const { data: resultDePara, error: errorDePara } = await supabase.rpc('aplicar_valores_de_para');

      if (errorDePara) {
        console.error('❌ Erro ao aplicar De-Para:', errorDePara);
      } else {
        console.log('✅ De-Para aplicado:', resultDePara);
      }

      // 3. Aplicar De-Para de prioridade
      const { data: resultPrioridade, error: errorPrioridade } = await supabase.rpc('aplicar_de_para_prioridade');

      if (errorPrioridade) {
        console.error('❌ Erro ao aplicar De-Para prioridade:', errorPrioridade);
      } else {
        console.log('✅ De-Para prioridade aplicado:', resultPrioridade);
      }

      toast.success('🔧 Correção automática concluída! Reanalyzing...');
      
      // Reanalizar após correção
      await analisarProblemasRegras();

    } catch (error) {
      console.error('❌ Erro na correção:', error);
      toast.error('Erro ao corrigir problemas');
    } finally {
      setCorrigindo(false);
    }
  };

  useEffect(() => {
    analisarProblemasRegras();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Análise de Problemas - Regras de Quebra
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Analisando problemas...</div>
        </CardContent>
      </Card>
    );
  }

  if (!analise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Análise de Problemas - Regras de Quebra
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Button onClick={analisarProblemasRegras}>
              Executar Análise
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          🚨 PROBLEMA CRÍTICO IDENTIFICADO!
        </CardTitle>
        <CardDescription>
          Registros que deveriam ter valores aplicados mas ainda estão zerados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo dos Problemas */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-bold text-red-800">TOTAL DE PROBLEMAS: {analise.total_problemas}</span>
          </div>
          <div className="space-y-1">
            {analise.problemas_identificados.map((problema, index) => (
              <Badge key={index} variant="destructive" className="mr-2">
                {problema}
              </Badge>
            ))}
          </div>
        </div>

        {/* Botão de Correção */}
        <div className="text-center">
          <Button 
            onClick={corrigirProblemas} 
            disabled={corrigindo || analise.total_problemas === 0}
            variant="destructive"
            className="gap-2"
          >
            <Wrench className="h-4 w-4" />
            {corrigindo ? "Corrigindo..." : "🔧 CORRIGIR PROBLEMAS AUTOMATICAMENTE"}
          </Button>
        </div>

        {/* Registros com Regras de Quebra */}
        {analise.registros_zerados_com_quebra.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-red-700">
              🔧 Registros Zerados com Regras de Quebra ({analise.registros_zerados_com_quebra.length})
            </h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {analise.registros_zerados_com_quebra.map((registro, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                  <div className="font-medium text-red-800">{registro.ESTUDO_DESCRICAO}</div>
                  <div className="text-red-600">
                    Arquivo: {registro.arquivo_fonte} | 
                    Valor Atual: {registro.VALORES} | 
                    Deveria ser: {registro.valor_esperado || 'N/A'}
                  </div>
                  <div className="text-red-700 font-medium">{registro.problema}</div>
                </div>
              ))}
              {analise.registros_zerados_com_quebra.length > 10 && (
                <div className="text-center text-red-600">
                  ... e mais {analise.registros_zerados_com_quebra.length - 10} registros
                </div>
              )}
            </div>
          </div>
        )}

        {/* Registros com De-Para */}
        {analise.registros_zerados_com_depara.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-orange-700">
              📋 Registros Zerados com De-Para ({analise.registros_zerados_com_depara.length})
            </h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {analise.registros_zerados_com_depara.map((registro, index) => (
                <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded text-sm">
                  <div className="font-medium text-orange-800">{registro.ESTUDO_DESCRICAO}</div>
                  <div className="text-orange-600">
                    Arquivo: {registro.arquivo_fonte} | 
                    Valor Atual: {registro.VALORES} | 
                    Deveria ser: {registro.valor_depara}
                  </div>
                  <div className="text-orange-700 font-medium">{registro.problema}</div>
                </div>
              ))}
              {analise.registros_zerados_com_depara.length > 10 && (
                <div className="text-center text-orange-600">
                  ... e mais {analise.registros_zerados_com_depara.length - 10} registros
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botão de Reanálise */}
        <div className="text-center">
          <Button onClick={analisarProblemasRegras} disabled={loading} variant="outline">
            {loading ? "Analisando..." : "🔄 Reexecutar Análise"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}