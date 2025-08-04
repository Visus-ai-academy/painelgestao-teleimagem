import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, FileX, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExameNaoIdentificado {
  estudo_descricao: string;
  quantidade: number;
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

      // 4. Agrupar apenas por nome do estudo (sem cliente)
      const agrupados: Record<string, ExameNaoIdentificado> = {};
      
      estudosNaoEncontrados.forEach((item) => {
        // Usar apenas ESTUDO_DESCRICAO - se for NULL, indica problema no processamento
        const nomeEstudo = item.ESTUDO_DESCRICAO || `[ERRO PROCESSAMENTO] - ${item.arquivo_fonte}`;
        
        if (agrupados[nomeEstudo]) {
          agrupados[nomeEstudo].quantidade += 1;
        } else {
          agrupados[nomeEstudo] = {
            estudo_descricao: nomeEstudo,
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Exames Não Identificados no "De Para"
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