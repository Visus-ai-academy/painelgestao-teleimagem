import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RegraStatus {
  nomeRegra: string;
  descricaoRegra: string;
  arquivos: {
    [key: string]: {
      deveAplicar: boolean;
      foiAplicada: boolean;
      ultimaAplicacao?: string;
      erros?: string[];
    };
  };
}

const TIPOS_ARQUIVO = [
  'volumetria_padrao',
  'volumetria_fora_padrao', 
  'volumetria_padrao_retroativo',
  'volumetria_fora_padrao_retroativo'
];

const REGRAS_MONITORADAS = [
  {
    nome: 'Normalização Cliente',
    descricao: 'Aplicação da limpeza de nomes de clientes',
    funcao: 'trigger_limpar_nome_cliente'
  },
  {
    nome: 'Correção Modalidades',
    descricao: 'Correção de modalidades CR/DX para RX/MG e OT para DO',
    funcao: 'aplicar_correcao_modalidades'
  },
  {
    nome: 'Aplicação Categorias',
    descricao: 'Definição de categorias baseada no cadastro de exames',
    funcao: 'aplicar_categorias_trigger'
  },
  {
    nome: 'De-Para Prioridades',
    descricao: 'Mapeamento de prioridades conforme tabela de-para',
    funcao: 'aplicar_prioridades_de_para'
  },
  {
    nome: 'Valores de Referência',
    descricao: 'Aplicação de valores de referência para exames sem valor',
    funcao: 'aplicar_de_para_trigger'
  },
  {
    nome: 'Tipificação Faturamento',
    descricao: 'Definição do tipo de faturamento baseado em regras',
    funcao: 'aplicar_tipificacao_faturamento'
  },
  {
    nome: 'Quebra de Exames',
    descricao: 'Marcação de exames para quebra posterior',
    funcao: 'trigger_marcar_para_quebra'
  },
  {
    nome: 'Regras Periodo Atual',
    descricao: 'Validação de dados do período atual',
    funcao: 'aplicar_regras_periodo_atual'
  },
  {
    nome: 'Regras Retroativas',
    descricao: 'Validação de dados retroativos',
    funcao: 'aplicar_regras_retroativas'
  }
];

export function StatusRegraProcessamento() {
  const [statusRegras, setStatusRegras] = useState<RegraStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatusRegras = async () => {
    try {
      setLoading(true);
      
      // Buscar informações dos últimos uploads por tipo de arquivo
      const { data: uploads, error } = await supabase
        .from('processamento_uploads')
        .select('tipo_arquivo, status, registros_processados, registros_erro, created_at')
        .in('tipo_arquivo', TIPOS_ARQUIVO)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar uploads:', error);
        return;
      }

      // Buscar logs de auditoria para verificar aplicação das regras
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('operation, new_data, timestamp, severity')
        .like('operation', '%REGRA_%')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (auditError) {
        console.error('Erro ao buscar logs de auditoria:', auditError);
      }

      // Processar status de cada regra
      const regrasStatus: RegraStatus[] = REGRAS_MONITORADAS.map(regra => {
        const arquivosStatus: { [key: string]: any } = {};
        
        TIPOS_ARQUIVO.forEach(tipoArquivo => {
          const uploadInfo = uploads?.find(u => u.tipo_arquivo === tipoArquivo);
          const regraLogs = auditLogs?.filter(log => 
            log.operation.includes(regra.funcao) || 
            log.operation.includes(regra.nome.toUpperCase().replace(/\s/g, '_'))
          );

          // Determinar se deve aplicar baseado no tipo de arquivo
          let deveAplicar = true;
          if (regra.nome === 'Regras Retroativas' && !tipoArquivo.includes('retroativo')) {
            deveAplicar = false;
          }
          if (regra.nome === 'Regras Periodo Atual' && tipoArquivo.includes('retroativo')) {
            deveAplicar = false;
          }

          // Verificar se foi aplicada
          const foiAplicada = uploadInfo?.status === 'concluido' && 
                             uploadInfo?.registros_erro === 0;

          arquivosStatus[tipoArquivo] = {
            deveAplicar,
            foiAplicada: foiAplicada || false,
            ultimaAplicacao: uploadInfo?.created_at,
            erros: uploadInfo?.registros_erro > 0 ? [`${uploadInfo.registros_erro} erros encontrados`] : []
          };
        });

        return {
          nomeRegra: regra.nome,
          descricaoRegra: regra.descricao,
          arquivos: arquivosStatus
        };
      });

      setStatusRegras(regrasStatus);
    } catch (error) {
      console.error('Erro ao carregar status das regras:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusRegras();
    
    // Configurar atualização em tempo real
    const channel = supabase
      .channel('regras_processamento_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processamento_uploads'
        },
        () => {
          fetchStatusRegras();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusIcon = (deveAplicar: boolean, foiAplicada: boolean, erros?: string[]) => {
    if (!deveAplicar) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (erros && erros.length > 0) return <XCircle className="h-4 w-4 text-destructive" />;
    if (foiAplicada) return <CheckCircle className="h-4 w-4 text-success" />;
    return <AlertCircle className="h-4 w-4 text-warning" />;
  };

  const getStatusBadge = (deveAplicar: boolean, foiAplicada: boolean, erros?: string[]) => {
    if (!deveAplicar) return <Badge variant="outline">N/A</Badge>;
    if (erros && erros.length > 0) return <Badge variant="destructive">Erro</Badge>;
    if (foiAplicada) return <Badge variant="default" className="bg-success">Aplicada</Badge>;
    return <Badge variant="outline">Pendente</Badge>;
  };

  const getNomeArquivoAmigavel = (tipoArquivo: string) => {
    const nomes = {
      'volumetria_padrao': 'Arquivo 1 (Padrão)',
      'volumetria_fora_padrao': 'Arquivo 2 (Fora Padrão)',
      'volumetria_padrao_retroativo': 'Arquivo 3 (Retro Padrão)',
      'volumetria_fora_padrao_retroativo': 'Arquivo 4 (Retro Fora Padrão)'
    };
    return nomes[tipoArquivo as keyof typeof nomes] || tipoArquivo;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status de Aplicação das Regras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="text-muted-foreground">Carregando status das regras...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status de Aplicação das Regras no Processamento</CardTitle>
        <p className="text-sm text-muted-foreground">
          Monitoramento em tempo real da aplicação das regras de negócio por arquivo processado
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Regra</th>
                {TIPOS_ARQUIVO.map(tipo => (
                  <th key={tipo} className="text-center p-3 font-medium min-w-[160px]">
                    {getNomeArquivoAmigavel(tipo)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statusRegras.map((regra, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="p-3">
                    <div>
                      <div className="font-medium">{regra.nomeRegra}</div>
                      <div className="text-sm text-muted-foreground">{regra.descricaoRegra}</div>
                    </div>
                  </td>
                  {TIPOS_ARQUIVO.map(tipo => {
                    const arquivo = regra.arquivos[tipo];
                    return (
                      <td key={tipo} className="p-3 text-center">
                        <div className="space-y-2">
                          <div className="flex justify-center items-center gap-2">
                            <span className="text-xs text-muted-foreground">Deve:</span>
                            {arquivo.deveAplicar ? (
                              <Badge variant="outline" className="text-xs">Sim</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Não</Badge>
                            )}
                          </div>
                          <div className="flex justify-center items-center gap-2">
                            {getStatusIcon(arquivo.deveAplicar, arquivo.foiAplicada, arquivo.erros)}
                            {getStatusBadge(arquivo.deveAplicar, arquivo.foiAplicada, arquivo.erros)}
                          </div>
                          {arquivo.erros && arquivo.erros.length > 0 && (
                            <div className="text-xs text-destructive">
                              {arquivo.erros[0]}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}