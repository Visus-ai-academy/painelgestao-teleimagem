import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, Database, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnaliseDiscrepancia {
  total_zerados_analise: number;
  total_zerados_lista: number;
  diferenca: number;
  registros_diferentes: any[];
  detalhes_por_arquivo: Array<{
    arquivo_fonte: string;
    zerados_analise: number;
    zerados_lista: number;
    diferenca: number;
  }>;
  registros_na_quebra: number;
  registros_sem_estudo: number;
}

export function AnaliseDiscrepanciaZerados() {
  const [analise, setAnalise] = useState<AnaliseDiscrepancia | null>(null);
  const [loading, setLoading] = useState(false);

  const analisarDiscrepancia = async () => {
    setLoading(true);
    
    try {
      console.log('🔍 Iniciando análise de discrepância...');

      // 1. ANÁLISE DE UPLOADS: Buscar registros zerados (mesma lógica do VolumetriaContext)
      const { data: todosRegistros, error: errorTodos } = await supabase
        .from('volumetria_mobilemed')
        .select('VALORES, ESTUDO_DESCRICAO, arquivo_fonte');

      if (errorTodos) throw errorTodos;

      const zeradosAnalise = todosRegistros?.filter(item => !item.VALORES || item.VALORES === 0) || [];
      
      console.log(`📊 ANÁLISE DE UPLOADS: ${zeradosAnalise.length} registros zerados`);

      // 2. LISTA NÃO IDENTIFICADOS: Buscar registros zerados não encontrados no De Para
      const { data: zeradosQuery, error: errorZerados } = await supabase
        .from('volumetria_mobilemed')
        .select('ESTUDO_DESCRICAO, MODALIDADE, EMPRESA, arquivo_fonte')
        .or('VALORES.eq.0,VALORES.is.null');

      if (errorZerados) throw errorZerados;

      const { data: deParaData, error: deParaError } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao')
        .eq('ativo', true);

      if (deParaError) throw deParaError;

      const estudosNoDePara = new Set(deParaData?.map(item => 
        item.estudo_descricao?.toUpperCase().trim()
      ).filter(Boolean) || []);

      const estudosNaoEncontrados = zeradosQuery?.filter(item => {
        if (!item.ESTUDO_DESCRICAO?.trim()) return true;
        const estudoNormalizado = item.ESTUDO_DESCRICAO.toUpperCase().trim();
        return !estudosNoDePara.has(estudoNormalizado);
      }) || [];

      // 3. Verificar regras de quebra
      const { data: regrasQuebra } = await supabase
        .from('regras_quebra_exames')
        .select('exame_original, exame_quebrado')
        .eq('ativo', true);

      const estudosRealmenteNaoIdentificados = estudosNaoEncontrados.filter(item => {
        const nomeEstudo = item.ESTUDO_DESCRICAO;
        const existeNasRegras = regrasQuebra?.some(regra => 
          regra.exame_original === nomeEstudo || regra.exame_quebrado === nomeEstudo
        );
        return !existeNasRegras;
      });

      console.log(`📊 LISTA NÃO IDENTIFICADOS: ${estudosRealmenteNaoIdentificados.length} registros`);

      // 4. Análise detalhada por arquivo
      const detalhesPorArquivo: Array<{
        arquivo_fonte: string;
        zerados_analise: number;
        zerados_lista: number;
        diferenca: number;
      }> = [];

      const arquivos = [...new Set(todosRegistros?.map(r => r.arquivo_fonte) || [])];
      
      for (const arquivo of arquivos) {
        const zeradosAnaliseArquivo = zeradosAnalise.filter(r => r.arquivo_fonte === arquivo).length;
        const zeradosListaArquivo = estudosRealmenteNaoIdentificados.filter(r => r.arquivo_fonte === arquivo).length;
        
        detalhesPorArquivo.push({
          arquivo_fonte: arquivo,
          zerados_analise: zeradosAnaliseArquivo,
          zerados_lista: zeradosListaArquivo,
          diferenca: zeradosAnaliseArquivo - zeradosListaArquivo
        });
      }

      // 5. Identificar registros diferentes
      const idsZeradosAnalise = new Set(zeradosAnalise.map(r => `${r.ESTUDO_DESCRICAO}_${r.arquivo_fonte}`));
      const idsZeradosLista = new Set(estudosRealmenteNaoIdentificados.map(r => `${r.ESTUDO_DESCRICAO}_${r.arquivo_fonte}`));
      
      const registrosDiferentes = zeradosAnalise.filter(r => {
        const id = `${r.ESTUDO_DESCRICAO}_${r.arquivo_fonte}`;
        return !idsZeradosLista.has(id);
      });

      // 6. Contar registros na quebra e sem estudo
      const registrosNaQuebra = estudosNaoEncontrados.length - estudosRealmenteNaoIdentificados.length;
      const registrosSemEstudo = zeradosQuery?.filter(item => !item.ESTUDO_DESCRICAO?.trim()).length || 0;

      setAnalise({
        total_zerados_analise: zeradosAnalise.length,
        total_zerados_lista: estudosRealmenteNaoIdentificados.length,
        diferenca: zeradosAnalise.length - estudosRealmenteNaoIdentificados.length,
        registros_diferentes: registrosDiferentes.slice(0, 20), // Limitar para não sobrecarregar
        detalhes_por_arquivo: detalhesPorArquivo,
        registros_na_quebra: registrosNaQuebra,
        registros_sem_estudo: registrosSemEstudo
      });

      console.log('✅ Análise de discrepância concluída');

    } catch (error) {
      console.error('❌ Erro na análise:', error);
      toast.error('Erro ao analisar discrepância');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analisarDiscrepancia();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Análise de Discrepância - Registros Zerados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Analisando discrepância...</div>
        </CardContent>
      </Card>
    );
  }

  if (!analise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Análise de Discrepância - Registros Zerados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Button onClick={analisarDiscrepancia}>
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
          <AlertTriangle className="h-5 w-5" />
          Análise de Discrepância - Registros Zerados
        </CardTitle>
        <CardDescription>
          Comparação detalhada entre "Análise de Uploads" vs "Lista de Não Identificados"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo da Discrepância */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-900">{analise.total_zerados_analise}</div>
            <div className="text-sm text-blue-700">Análise de Uploads</div>
            <div className="text-xs text-muted-foreground">Todos com VALORES = 0</div>
          </div>
          <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-2xl font-bold text-orange-900">{analise.total_zerados_lista}</div>
            <div className="text-sm text-orange-700">Lista Não Identificados</div>
            <div className="text-xs text-muted-foreground">Zerados sem De-Para/Quebra</div>
          </div>
          <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-2xl font-bold text-red-900">{analise.diferenca}</div>
            <div className="text-sm text-red-700">Diferença</div>
            <div className="text-xs text-muted-foreground">Discrepância encontrada</div>
          </div>
        </div>

        {/* Explicação da Diferença */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">🔍 Motivos da Diferença:</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-800">Registros com Regras de Quebra</span>
              </div>
              <div className="text-2xl font-bold text-yellow-900">{analise.registros_na_quebra}</div>
              <div className="text-xs text-yellow-700">
                Zerados que estão nas regras de quebra (não aparecem na lista)
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-800">Registros sem ESTUDO_DESCRICAO</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{analise.registros_sem_estudo}</div>
              <div className="text-xs text-purple-700">
                Registros com nome do exame vazio/nulo
              </div>
            </div>
          </div>
        </div>

        {/* Detalhes por Arquivo */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">📊 Detalhes por Arquivo:</h3>
          
          <div className="space-y-2">
            {analise.detalhes_por_arquivo.map((detalhe, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <span className="font-medium">{detalhe.arquivo_fonte}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-blue-600">Análise: {detalhe.zerados_analise}</span>
                  <span className="text-orange-600">Lista: {detalhe.zerados_lista}</span>
                  <Badge variant={detalhe.diferenca > 0 ? "destructive" : "default"}>
                    Δ {detalhe.diferenca}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botão de Atualização */}
        <div className="text-center">
          <Button onClick={analisarDiscrepancia} disabled={loading}>
            {loading ? "Analisando..." : "Reexecutar Análise"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}