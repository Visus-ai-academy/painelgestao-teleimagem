import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, FileX } from 'lucide-react';

interface ExameNaoIdentificado {
  estudo_descricao: string;
  modalidade: string;
  quantidade: number;
  empresa: string;
}

export function VolumetriaExamesNaoIdentificados() {
  const [examesNaoIdentificados, setExamesNaoIdentificados] = useState<ExameNaoIdentificado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExamesNaoIdentificados();
  }, []);

  const loadExamesNaoIdentificados = async () => {
    try {
      // Buscar TODOS os exames zerados (sem limitação)
      const { data: volumetriaData, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select('ESTUDO_DESCRICAO, MODALIDADE, EMPRESA, arquivo_fonte')
        .or('VALORES.eq.0,VALORES.is.null');

      if (volumetriaError) throw volumetriaError;

      // 2. Buscar estudos existentes no De Para (sem limitação)
      const { data: deParaData, error: deParaError } = await supabase
        .from('valores_referencia_de_para')
        .select('estudo_descricao')
        .eq('ativo', true);

      if (deParaError) throw deParaError;

      const estudosNoDePara = new Set(deParaData?.map(item => 
        item.estudo_descricao?.toUpperCase().trim()
      ).filter(Boolean) || []);

      console.log('📋 Estudos no De Para:', estudosNoDePara.size);
      console.log('📋 Lista De Para:', Array.from(estudosNoDePara));
      console.log('📊 Total registros volumetria zerados:', volumetriaData?.length || 0);

      // Debug: listar os registros zerados
      console.log('📊 Registros zerados:', volumetriaData?.map(item => ({
        estudo: item.ESTUDO_DESCRICAO,
        arquivo: item.arquivo_fonte
      })));

      // 3. Filtrar registros zerados que não estão no De Para
      const estudosNaoEncontrados = volumetriaData?.filter(item => {
        // Se ESTUDO_DESCRICAO é NULL ou vazio, incluir sempre
        if (!item.ESTUDO_DESCRICAO?.trim()) {
          console.log(`🚨 ESTUDO_DESCRICAO vazio/nulo no arquivo: ${item.arquivo_fonte}`);
          return true;
        }
        
        // Normalizar para comparação (uppercase e trim)
        const estudoNormalizado = item.ESTUDO_DESCRICAO.toUpperCase().trim();
        
        // Se tem ESTUDO_DESCRICAO mas não está no De Para, incluir
        const naoEncontrado = !estudosNoDePara.has(estudoNormalizado);
        
        console.log(`🔍 Verificando "${estudoNormalizado}": ${naoEncontrado ? 'NÃO ENCONTRADO' : 'ENCONTRADO'} no De Para`);
        
        return naoEncontrado;
      }) || [];

      console.log('🔍 Total de exames zerados:', volumetriaData?.length);
      console.log('🔍 Exames não encontrados no De Para:', estudosNaoEncontrados.length);

      // 4. Agrupar por nome do estudo, MODALIDADE e EMPRESA
      const agrupados: Record<string, ExameNaoIdentificado> = {};
      
      estudosNaoEncontrados.forEach((item) => {
        // Usar apenas ESTUDO_DESCRICAO - se for NULL, indica problema no processamento
        const nomeEstudo = item.ESTUDO_DESCRICAO || `[ERRO PROCESSAMENTO] - ${item.arquivo_fonte}`;
        const key = `${nomeEstudo}_${item.MODALIDADE}_${item.EMPRESA}`;
        
        if (agrupados[key]) {
          agrupados[key].quantidade += 1;
        } else {
          agrupados[key] = {
            estudo_descricao: nomeEstudo,
            modalidade: item.MODALIDADE || '',
            empresa: item.EMPRESA || '',
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
            Exames Não Identificados no "De Para"
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
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-5 w-5" />
          Exames Não Identificados no "De Para"
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Total de {totalExamesNaoIdentificados} exames zerados não encontrados na tabela "De Para"
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
                <div className="text-xs text-muted-foreground">
                  {exame.modalidade} • {exame.empresa}
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