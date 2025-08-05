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
  temNoDePara?: boolean;
  temNasRegras?: boolean;
}

export function VolumetriaExamesNaoIdentificados() {
  const [examesNaoIdentificados, setExamesNaoIdentificados] = useState<ExameNaoIdentificado[]>([]);
  const [loading, setLoading] = useState(true);
  const { data } = useVolumetria();

  useEffect(() => {
    // Carregar diretamente, independente do contexto que não está funcionando
    console.log('⏳ Iniciando carregamento direto dos dados zerados');
    loadExamesNaoIdentificados();
  }, []);

  // Função para limpar termos X1-X9 e XE
  const limparTermosX = (estudo: string): string => {
    if (!estudo) return estudo;
    return estudo.replace(/\s*X[1-9E]\s*$/i, '').trim();
  };

  const loadExamesNaoIdentificados = async () => {
    try {
      console.log('🚀 INICIANDO loadExamesNaoIdentificados');
      
      // BUSCAR DIRETAMENTE DO BANCO TODOS OS REGISTROS ZERADOS
      // O contexto não está fornecendo os dados completos
      const { data: volumetriaData, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select('ESTUDO_DESCRICAO, MODALIDADE, ESPECIALIDADE, arquivo_fonte, VALORES')
        .or('VALORES.eq.0,VALORES.is.null')
        .limit(10000);

      if (volumetriaError) {
        console.error('❌ Erro ao buscar volumetria:', volumetriaError);
        throw volumetriaError;
      }
      
      console.log('📊 REGISTROS ZERADOS ENCONTRADOS:', volumetriaData?.length || 0);
      console.log('📊 EXEMPLO DE REGISTROS ZERADOS:', volumetriaData?.slice(0, 5));
      
      
      if (!volumetriaData || volumetriaData.length === 0) {
        console.log('📊 Nenhum registro zerado encontrado');
        setLoading(false);
        return;
      }

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

      // Buscar regras de quebra para classificação
      const { data: regrasQuebra } = await supabase
        .from('regras_quebra_exames')
        .select('exame_original, exame_quebrado')
        .eq('ativo', true);

      // Agrupar TODOS os registros zerados por nome do estudo e arquivo fonte
      const agrupados: Record<string, ExameNaoIdentificado & { temNoDePara: boolean; temNasRegras: boolean }> = {};
      
      volumetriaData.forEach((item) => {
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
        
        // Verificar se está no De Para
        const estudoLimpo = limparTermosX(nomeEstudo?.toUpperCase().trim() || '');
        const temNoDePara = estudosNoDePara.has(estudoLimpo);
        
        // Verificar se está nas regras de quebra
        const temNasRegras = regrasQuebra?.some(regra => {
          const originalLimpo = limparTermosX(regra.exame_original?.toUpperCase().trim() || '');
          const quebradoLimpo = limparTermosX(regra.exame_quebrado?.toUpperCase().trim() || '');
          return originalLimpo === estudoLimpo || quebradoLimpo === estudoLimpo;
        }) || false;
        
        if (agrupados[key]) {
          agrupados[key].quantidade += 1;
        } else {
          agrupados[key] = {
            estudo_descricao: nomeEstudo,
            arquivo_fonte: arquivoFonte,
            quantidade: 1,
            temNoDePara,
            temNasRegras
          };
        }
      });

      const examesArray = Object.values(agrupados).sort((a, b) => b.quantidade - a.quantidade);
      console.log('🔍 Total de tipos únicos de exames zerados:', examesArray.length);
      console.log('🔍 Exames que ESTÃO no De Para:', examesArray.filter(e => e.temNoDePara).length);
      console.log('🔍 Exames que NÃO estão no De Para:', examesArray.filter(e => !e.temNoDePara && !e.temNasRegras).length);
      console.log('🔍 Exames que estão nas Regras de Quebra:', examesArray.filter(e => e.temNasRegras).length);
      
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
              Todos os Exames Zerados - Análise Completa
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-1">
              Total de {totalExamesNaoIdentificados} exames zerados de {examesNaoIdentificados.length} tipos únicos
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
                <div className="font-medium text-sm flex items-center gap-2">
                  {exame.estudo_descricao || '(Sem descrição do estudo)'}
                  {exame.temNoDePara && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Na tabela De Para</span>
                  )}
                  {exame.temNasRegras && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Nas Regras de Quebra</span>
                  )}
                  {!exame.temNoDePara && !exame.temNasRegras && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Não identificado</span>
                  )}
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
              <strong>Análise:</strong> Esta lista mostra TODOS os exames zerados. Os que estão "Na tabela De Para" 
              deveriam ter recebido valores, mas não receberam - isso indica problema na aplicação do De Para. 
              Os "Não identificados" precisam ser adicionados na tabela De Para.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}