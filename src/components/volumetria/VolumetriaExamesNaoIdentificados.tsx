import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, FileX, Download } from 'lucide-react';
import { useVolumetria } from '@/contexts/VolumetriaContext';
import * as XLSX from 'xlsx';

interface ExameNaoIdentificado {
  estudo_descricao: string;
  quantidade: number;
  arquivo_fonte: string;
}

export function VolumetriaExamesNaoIdentificados() {
  const [examesNaoIdentificados, setExamesNaoIdentificados] = useState<ExameNaoIdentificado[]>([]);
  const [loading, setLoading] = useState(true);
  const { data } = useVolumetria();

  useEffect(() => {
    // Só carregar quando dados estiverem disponíveis no contexto
    if (!data.loading && data.detailedData.length > 0) {
      console.log('🚀 INICIANDO loadExamesNaoIdentificados com', data.detailedData.length, 'registros');
      loadExamesNaoIdentificados();
    } else {
      console.log('⏳ Aguardando dados completos. Loading:', data.loading, 'Registros:', data.detailedData.length);
    }
  }, [data.loading, data.detailedData]);

  // Função para limpar termos X1-X9 e XE
  const limparTermosX = (estudo: string): string => {
    if (!estudo) return estudo;
    return estudo.replace(/\s*X[1-9E]\s*$/i, '').trim();
  };

  const loadExamesNaoIdentificados = async () => {
    try {
      // USAR DADOS DO CONTEXTO CENTRALIZADO EM VEZ DE QUERY DIRETA
      const volumetriaDataCompleta = data.detailedData;
      
      if (!volumetriaDataCompleta || volumetriaDataCompleta.length === 0) {
        console.log('📊 Aguardando dados do contexto centralizado...');
        setLoading(false);
        return;
      }
      
      console.log('📊 USANDO DADOS COMPLETOS DO CONTEXTO:', volumetriaDataCompleta.length, 'registros');
      
      // Filtrar apenas registros zerados usando dados completos do contexto
      const volumetriaData = volumetriaDataCompleta.filter(item => 
        item.VALORES === 0 || item.VALORES === null || item.VALORES === undefined
      );
      
      console.log('📊 REGISTROS ZERADOS FILTRADOS:', volumetriaData.length);
      console.log('📊 EXEMPLO DE REGISTROS ZERADOS:', volumetriaData.slice(0, 3));

      // 2. Buscar estudos existentes no De Para (COM LIMITE EXPLÍCITO ALTO)
      const { data: deParaData, error: deParaError } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao')
        .eq('ativo', true)
        .limit(50000);

      if (deParaError) {
        console.error('❌ Erro ao buscar De Para:', deParaError);
        throw deParaError;
      }
      
      console.log('📋 TOTAL DE REGISTROS NO DE PARA:', deParaData?.length || 0);

      // Criar Set com estudos do De Para, aplicando limpeza de termos X
      const estudosNoDePara = new Set(deParaData?.map(item => 
        limparTermosX(item.estudo_descricao?.toUpperCase().trim() || '')
      ).filter(Boolean) || []);

      console.log('📋 Estudos no De Para (após limpeza X):', estudosNoDePara.size);
      console.log('📊 Total registros volumetria zerados (do contexto completo):', volumetriaData?.length || 0);
      console.log('📊 Estudos únicos zerados:', new Set(volumetriaData?.map(item => item.ESTUDO_DESCRICAO).filter(Boolean)).size);

      // 3. Filtrar registros zerados que não estão no De Para
      const estudosNaoEncontrados = volumetriaData?.filter(item => {
        // Se ESTUDO_DESCRICAO é NULL ou vazio, incluir sempre
        if (!item.ESTUDO_DESCRICAO?.trim()) {
          console.log(`🚨 ESTUDO_DESCRICAO vazio/nulo no arquivo: ${item.arquivo_fonte || 'arquivo_fonte_indefinido'}`);
          console.log(`🚨 Dados do registro problemático:`, {
            id: item.id,
            arquivo_fonte: item.arquivo_fonte,
            EMPRESA: item.EMPRESA,
            MODALIDADE: item.MODALIDADE,
            ESPECIALIDADE: item.ESPECIALIDADE,
            VALORES: item.VALORES
          });
          return true;
        }
        
        // Normalizar e limpar termos X para comparação
        const estudoOriginal = item.ESTUDO_DESCRICAO.toUpperCase().trim();
        const estudoLimpo = limparTermosX(estudoOriginal);
        
        // Verificar se existe no De Para (após limpeza de ambos os lados)
        const naoEncontrado = !estudosNoDePara.has(estudoLimpo);
        
        return naoEncontrado;
      }) || [];

      console.log('🔍 Total de exames zerados:', volumetriaData?.length);
      console.log('🔍 Exames não encontrados no De Para:', estudosNaoEncontrados.length);
      console.log('🔍 Estudos únicos não encontrados:', new Set(estudosNaoEncontrados?.map(item => item.ESTUDO_DESCRICAO).filter(Boolean)).size);

      // 4. Verificar se algum dos estudos não encontrados existe nas regras de quebra
      const { data: regrasQuebra } = await supabase
        .from('regras_quebra_exames')
        .select('exame_original, exame_quebrado')
        .eq('ativo', true);

      // Filtrar estudos que realmente não estão identificados
      const estudosRealmenteNaoIdentificados = estudosNaoEncontrados.filter(item => {
        const nomeEstudo = item.ESTUDO_DESCRICAO;
        const nomeEstudoLimpo = limparTermosX(nomeEstudo?.toUpperCase().trim() || '');
        
        // Verificar se o exame existe nas regras de quebra (aplicando limpeza também)
        const existeNasRegras = regrasQuebra?.some(regra => {
          const originalLimpo = limparTermosX(regra.exame_original?.toUpperCase().trim() || '');
          const quebradoLimpo = limparTermosX(regra.exame_quebrado?.toUpperCase().trim() || '');
          return originalLimpo === nomeEstudoLimpo || quebradoLimpo === nomeEstudoLimpo;
        });
        
        if (existeNasRegras) {
          console.log(`⚠️ Exame "${nomeEstudo}" (limpo: "${nomeEstudoLimpo}") encontrado nas regras de quebra, mas não processado corretamente`);
        }
        
        return !existeNasRegras; // Só incluir se NÃO está nas regras
      });

      console.log('🔍 Exames realmente não identificados:', estudosRealmenteNaoIdentificados.length);
      console.log('🔍 Estudos únicos realmente não identificados:', new Set(estudosRealmenteNaoIdentificados?.map(item => item.ESTUDO_DESCRICAO).filter(Boolean)).size);

      // 5. Agrupar por nome do estudo e arquivo fonte
      const agrupados: Record<string, ExameNaoIdentificado> = {};
      
      estudosRealmenteNaoIdentificados.forEach((item) => {
        // Usar apenas ESTUDO_DESCRICAO - se for NULL, indica problema no processamento
        let nomeEstudo;
        let arquivoFonte = item.arquivo_fonte || 'Arquivo não identificado';
        
        if (!item.ESTUDO_DESCRICAO?.trim()) {
          // Para registros sem ESTUDO_DESCRICAO, criar descrição mais informativa
          nomeEstudo = `[ERRO: Estudo sem descrição] - ${item.MODALIDADE || 'Modalidade?'} / ${item.ESPECIALIDADE || 'Especialidade?'}`;
          console.log(`🚨 Registro sem ESTUDO_DESCRICAO encontrado:`, item);
        } else {
          nomeEstudo = item.ESTUDO_DESCRICAO;
        }
        
        const key = `${nomeEstudo}_${arquivoFonte}`;
        
        if (agrupados[key]) {
          agrupados[key].quantidade += 1;
        } else {
          agrupados[key] = {
            estudo_descricao: nomeEstudo,
            arquivo_fonte: arquivoFonte,
            quantidade: 1
          };
        }
      });

      const examesArray = Object.values(agrupados).sort((a, b) => b.quantidade - a.quantidade);
      setExamesNaoIdentificados(examesArray);
    } catch (error) {
      console.error('Erro ao carregar exames não identificados:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalExamesNaoIdentificados = examesNaoIdentificados.reduce((total, item) => total + item.quantidade, 0);

  const exportToExcel = () => {
    const data = examesNaoIdentificados.map((exame, index) => ({
      'Posição': index + 1,
      'Nome do Exame': exame.estudo_descricao,
      'Arquivo de Origem': exame.arquivo_fonte,
      'Quantidade Zerada': exame.quantidade
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Exames Não Identificados');
    
    const fileName = `exames-nao-identificados-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5" />
            Carregando...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (examesNaoIdentificados.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <FileX className="h-5 w-5" />
            Exames Não Identificados - Fora do Padrão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Todos os exames foram identificados na tabela "De Para". Nenhum exame zerado encontrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Exames Não Identificados - Fora do Padrão
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-1">
              Total de {totalExamesNaoIdentificados} exames zerados não encontrados na tabela "De Para"
            </div>
          </div>
          <Button 
            onClick={exportToExcel}
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {examesNaoIdentificados.map((exame, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {exame.estudo_descricao || '(Sem descrição do estudo)'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Arquivo: {exame.arquivo_fonte}
                </div>
              </div>
              <Badge variant="destructive" className="ml-2">
                {exame.quantidade} zerados
              </Badge>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Ação necessária:</strong> Adicione estes tipos de exames na tabela "De Para" 
              para que possam receber valores corretos nos próximos uploads.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}