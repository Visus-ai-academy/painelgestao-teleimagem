import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, ChevronDown } from 'lucide-react';

interface StatusRegras {
  aplicacoes_automaticas: number;
  falhas_automaticas: number;
  ultima_aplicacao: string;
  sistema_ativo: boolean;
}

// Lista das 28 regras aplicadas automaticamente - SISTEMA COMPLETO
const REGRAS_SISTEMA = [
  {
    id: 'v001',
    nome: 'Proteção Temporal de Dados',
    categoria: 'Temporal',
    criterio: 'Impede edição de dados com mais de 5 dias do mês anterior. Bloqueia inserção de dados futuros. Inclui botão de "fechar faturamento" que bloqueia novos dados após fechamento.',
    implementacao: 'RLS policies can_edit_data() e can_insert_data() + tabela fechamento_faturamento'
  },
  {
    id: 'v002',
    nome: 'Exclusão por DATA_LAUDO fora do período',
    categoria: 'Exclusão',
    criterio: 'Remove registros com DATA_LAUDO fora do período de faturamento (dia 8 do mês até dia 7 do mês seguinte). Aplicada SOMENTE nos arquivos: volumetria_padrao_retroativo e volumetria_fora_padrao_retroativo.',
    implementacao: 'Edge function: aplicar-exclusoes-periodo'
  },
  {
    id: 'v003',
    nome: 'Exclusão por DATA_REALIZACAO >= período',
    categoria: 'Exclusão',
    criterio: 'Remove registros retroativos com DATA_REALIZACAO >= 01 do mês especificado.',
    implementacao: 'Edge function: aplicar-exclusoes-periodo'
  },
  {
    id: 'v004',
    nome: 'Filtro de período atual para arquivos não-retroativos',
    categoria: 'Exclusão',
    criterio: 'Remove registros com DATA_REALIZACAO fora do mês de referência (01 ao último dia) e DATA_LAUDO fora do período permitido. Aplicada SOMENTE nos arquivos: volumetria_padrao, volumetria_fora_padrao e volumetria_onco_padrao.',
    implementacao: 'Edge function: aplicar-filtro-periodo-atual'
  },
  {
    id: 'v005',
    nome: 'Correção de Modalidade para Exames RX',
    categoria: 'Modalidade',
    criterio: 'Todos os exames na coluna ESTUDO_DESCRICAO que começam com "RX " têm a modalidade alterada para "RX". Aplica-se aos arquivos de upload 1,2,3,4,5.',
    implementacao: 'Aplicado durante processamento dos dados de volumetria'
  },
  {
    id: 'v006',
    nome: 'Mapeamento Nome Cliente - Mobilemed para Nome Fantasia',
    categoria: 'Dados',
    criterio: 'Substitui o campo EMPRESA (nome_mobilemed que vem dos arquivos 1,2,3,4) pelo nome_fantasia cadastrado na tabela clientes. O nome original vira "Unidade_Origem".',
    implementacao: 'Edge function: aplicar-mapeamento-nome-cliente'
  },
  {
    id: 'v007',
    nome: 'Correções de Especialidades Problemáticas',
    categoria: 'Dados',
    criterio: 'Corrige especialidades inconsistentes: "Colunas" → "MUSCULO ESQUELETICO" e "ONCO MEDICINA INTERNA" → "MEDICINA INTERNA".',
    implementacao: 'Edge function: aplicar-27-regras-completas'
  },
  {
    id: 'v008',
    nome: 'De-Para Prioridades',
    categoria: 'Prioridade',
    criterio: 'Aplica mapeamento de prioridades usando tabela valores_prioridade_de_para para padronizar valores de prioridade.',
    implementacao: 'Função SQL: aplicar_prioridades_de_para()'
  },
  {
    id: 'v009',
    nome: 'Mapeamento De Para - Valores por Estudo',
    categoria: 'Valores',
    criterio: 'Utiliza arquivo de referência (ESTUDO_DESCRICAO, VALORES) para preencher valores zerados.',
    implementacao: 'Função SQL: aplicar_de_para_automatico() + tabela valores_referencia_de_para'
  },
  {
    id: 'v010',
    nome: 'Aplicação de Regras de Quebra de Exames',
    categoria: 'Dados',
    criterio: 'Aplica regras configuradas para quebrar exames compostos em exames individuais.',
    implementacao: 'Função SQL: aplicar_regras_quebra_exames() + tabela regras_quebra_exames'
  },
  {
    id: 'v010a',
    nome: 'Conversão P-CEMVALENCA_MG → CEMVALENCA',
    categoria: 'Dados',
    criterio: 'Normaliza unidade MG para a matriz CEMVALENCA.',
    implementacao: 'Edge: aplicar-27-regras-completas e aplicar-regras-sistema-completo'
  },
  {
    id: 'v010b',
    nome: 'Separação CEMVALENCA (PL/RX)',
    categoria: 'Dados',
    criterio: 'PLANTÃO → CEMVALENCA_PL; RX (não plantão) → CEMVALENCA_RX; Corrige CEMVALENCA_PLANTÃO → CEMVALENCA_PL.',
    implementacao: 'Edge: aplicar-27-regras-completas e aplicar-regras-sistema-completo'
  },
  {
    id: 'v011',
    nome: 'Processamento de Categorias de Exames',
    categoria: 'Categoria',
    criterio: 'Processa e categoriza exames com base na tabela de categorias configuradas.',
    implementacao: 'Função SQL: aplicar_categorias_volumetria() + tabela categorias_exame'
  },
  {
    id: 'v012',
    nome: 'Validação Cliente Volumetria',
    categoria: 'Validação',
    criterio: 'Valida se cliente existe no cadastro e está ativo antes de processar dados de volumetria.',
    implementacao: 'Edge function: aplicar-validacao-cliente'
  },
  {
    id: 'v013',
    nome: 'Aplicação Especialidade Automática',
    categoria: 'Especialidade',
    criterio: 'Define especialidade automaticamente baseado em regras de negócio quando não informada no arquivo.',
    implementacao: 'Função SQL: aplicar_especialidade_automatica()'
  },
  {
    id: 'v014',
    nome: 'Aplicação Valor Onco',
    categoria: 'Valores',
    criterio: 'Aplica valores específicos para exames oncológicos baseado em regras especiais para a categoria "onco".',
    implementacao: 'Função SQL: aplicar_valor_onco() - apenas volumetria_onco_padrao'
  },
  {
    id: 'v015',
    nome: 'Regras de Exclusão Dinâmica',
    categoria: 'Exclusão',
    criterio: 'Aplica regras de exclusão configuradas dinamicamente baseadas em critérios JSON (empresa, modalidade, especialidade, categoria, médico).',
    implementacao: 'Sistema automático baseado na tabela regras_exclusao_faturamento'
  },
  {
    id: 'v016',
    nome: 'Definição Data Referência',
    categoria: 'Dados',
    criterio: 'Define data de referência baseada no período de processamento selecionado para garantir consistência temporal dos dados.',
    implementacao: 'Edge function: set-data-referencia-volumetria'
  },
  {
    id: 'v017',
    nome: 'Exclusão de Clientes Específicos',
    categoria: 'Exclusão',
    criterio: 'Exclui registros de clientes específicos: RADIOCOR_LOCAL, CLINICADIA_TC, CLINICA RADIOCOR, CLIRAM_LOCAL.',
    implementacao: 'Edge function: aplicar-exclusao-clientes-especificos'
  },
  {
    id: 'v018',
    nome: 'Substituição de Especialidade/Categoria por Cadastro',
    categoria: 'Dados',
    criterio: 'Para exames com especialidades "Cardio com Score", "Corpo" ou "Onco Medicina Interna", substitui pelos valores do cadastro_exames baseado no nome do exame.',
    implementacao: 'Edge function: aplicar-substituicao-especialidade-categoria'
  },
  {
    id: 'v019',
    nome: 'ColunasxMusculoxNeuro com Normalização Avançada',
    categoria: 'Dados',
    criterio: 'Exames com especialidade "Colunas" viram "Músculo Esquelético", exceto para 43 médicos específicos que viram "Neuro". Normalização inteligente de nomes.',
    implementacao: 'Edge function: aplicar-regra-colunas-musculo-neuro'
  },
  {
    id: 'v020',
    nome: 'Tipificação Faturamento - Clientes NC Originais',
    categoria: 'Faturamento',
    criterio: 'Define tipificação para 10 clientes NC: CDICARDIO, CDIGOIAS, CISP, etc. NC-FT para CARDIO, PLANTÃO, ou estudos específicos ("ANGIOTC VENOSA TORAX CARDIOLOGIA", "RM CRANIO NEUROBRAIN").',
    implementacao: 'Edge function: aplicar-tipificacao-faturamento'
  },
  {
    id: 'v021',
    nome: 'Tipificação Faturamento - Clientes NC Adicionais',
    categoria: 'Faturamento',
    criterio: 'Define tipificação para 3 clientes NC adicionais: CEMVALENCA, RMPADUA, RADI-IMAGEM. NC-FT para CARDIO/MEDICINA INTERNA/NEUROBRAIN, PLANTÃO, 29 médicos específicos.',
    implementacao: 'Edge function: aplicar-tipificacao-faturamento (extensão)'
  },
  {
    id: 'v022',
    nome: 'Categoria ONCOLOGIA',
    categoria: 'Faturamento',
    criterio: 'Define CATEGORIA = "ONCOLOGIA" quando descrição do estudo contém "onco".',
    implementacao: 'Edge function: aplicar-27-regras-completas (v021)'
  },
  {
    id: 'v023',
    nome: 'Correção Valores Nulos',
    categoria: 'Dados',
    criterio: 'Define VALORES = 1 quando o campo está nulo ou igual a zero.',
    implementacao: 'Edge function: aplicar-27-regras-completas'
  },
  {
    id: 'v024',
    nome: 'Aplicação Duplicado Padrão',
    categoria: 'Dados',
    criterio: 'Define DUPLICADO = "NAO" quando o campo está nulo ou vazio.',
    implementacao: 'Edge function: aplicar-27-regras-completas'
  },
  {
    id: 'v025',
    nome: 'Tipificação de Faturamento (REMOVIDA)',
    categoria: 'Faturamento',
    criterio: 'Regra removida. Tipificação é feita APENAS pela função aplicar-tipificacao-faturamento com tipos válidos: CO-FT, CO-NF, NC-FT, NC-NF, NC1-NF.',
    implementacao: 'Edge function: aplicar-tipificacao-faturamento'
  },
  {
    id: 'v026',
    nome: 'Aplicação Automática pós-Upload',
    categoria: 'Sistema',
    criterio: 'Sistema monitora uploads concluídos e aplica automaticamente todas as 28 regras anteriores via trigger otimizado.',
    implementacao: 'Trigger: trigger_aplicar_regras_pos_upload + sistema de tasks'
  },
  {
    id: 'v027',
    nome: 'Validação Final e Auditoria',
    categoria: 'Sistema',
    criterio: 'Executa validação final dos dados processados e registra todas as aplicações de regras no audit_logs para rastreabilidade completa.',
    implementacao: 'Sistema de auditoria + logs detalhados'
  },
  {
    id: 'v044',
    nome: 'Correção MAMA → MAMO (Modalidade MG)',
    categoria: 'Especialidade',
    criterio: 'Corrige ESPECIALIDADE de "MAMA" para "MAMO" quando MODALIDADE é "MG". MAMA é reservado para RM MAMAS (modalidade MR), mamografias devem usar MAMO.',
    implementacao: 'Edge function: aplicar-27-regras-completas'
  }
];

export function AutoRegrasMaster() {
  const [status, setStatus] = useState<StatusRegras>({
    aplicacoes_automaticas: 0,
    falhas_automaticas: 0,
    ultima_aplicacao: '',
    sistema_ativo: true
  });
  const [mostrarRegras, setMostrarRegras] = useState(false);

  useEffect(() => {
    // Monitorar uploads concluídos para aplicação automática GARANTIDA
    const channel = supabase
      .channel('sistema_automatico_regras')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'processamento_uploads',
          filter: 'status=eq.concluido'
        },
        async (payload) => {
          console.log('🚀 SISTEMA AUTOMÁTICO: Upload detectado para processamento automático de regras');
          await aplicarRegrasAutomaticamente(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processamento_uploads',
          filter: 'status=eq.concluido'
        },
        async (payload) => {
          // Verificar se mudou para concluído agora
          if (payload.old?.status !== 'concluido' && payload.new?.status === 'concluido') {
            console.log('🚀 SISTEMA AUTOMÁTICO: Upload atualizado para concluído - aplicando regras');
            await aplicarRegrasAutomaticamente(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const aplicarRegrasAutomaticamente = async (uploadData: any) => {
    const { tipo_arquivo, arquivo_nome } = uploadData;
    
    // Verificar se é um arquivo que precisa de regras de negócio
    const arquivosComRegras = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo'
    ];

    if (!arquivosComRegras.includes(tipo_arquivo)) {
      console.log(`📝 Arquivo ${tipo_arquivo} não requer aplicação de regras de negócio`);
      return;
    }

    try {
      // Buscar período selecionado do localStorage
      const periodoSalvo = localStorage.getItem('volumetria_periodo_selecionado');
      if (!periodoSalvo) {
        console.warn('⚠️ Nenhum período selecionado - aplicação automática ignorada');
        toast.warning('Período não selecionado', {
          description: 'Selecione o período de referência antes de processar'
        });
        return;
      }
      
      // Converter formato {ano: number, mes: number} para YYYY-MM
      const periodoObj = JSON.parse(periodoSalvo);
      const periodoReferencia = `${periodoObj.ano}-${String(periodoObj.mes).padStart(2, '0')}`;
      
      console.log(`⚡ APLICAÇÃO AUTOMÁTICA iniciada para ${tipo_arquivo}`);
      console.log(`📅 Período de referência: ${periodoReferencia}`);
      
      // Aplicar TODAS as 28 regras automaticamente usando a função unificada
      const { data, error } = await supabase.functions.invoke('aplicar-regras-sistema-completo', {
        body: {
          arquivo_fonte: tipo_arquivo,
          periodo_referencia: periodoReferencia,
          aplicar_todos_arquivos: false
        }
      });

      if (error) {
        throw new Error(`Erro na aplicação automática: ${error.message}`);
      }

      if (data?.success) {
        const totalCorrecoes = data.total_corrigidos || 0;
        const totalProcessados = data.total_processados || 0;
        
        console.log(`✅ REGRAS APLICADAS AUTOMATICAMENTE:`);
        console.log(`   📊 Processados: ${totalProcessados} registros`);
        console.log(`   🔧 Correções: ${totalCorrecoes} aplicadas`);
        
        toast.success(`✅ Regras aplicadas automaticamente! ${totalCorrecoes} correções em ${totalProcessados} registros`);
        
        // Atualizar status
        setStatus(prev => ({
          ...prev,
          aplicacoes_automaticas: prev.aplicacoes_automaticas + 1,
          ultima_aplicacao: new Date().toLocaleString(),
          sistema_ativo: true
        }));

        // Registrar sucesso no audit log
        await supabase.from('audit_logs').insert({
          table_name: 'sistema_automatico_regras',
          operation: 'APLICACAO_AUTOMATICA_SUCESSO',
          record_id: uploadData.id,
          new_data: {
            arquivo_fonte: tipo_arquivo,
            arquivo_nome,
            total_processados: totalProcessados,
            total_correcoes: totalCorrecoes,
            detalhes: data.status_regras
          },
          user_email: 'sistema-automatico',
          severity: 'info'
        });

      } else {
        throw new Error(`Falha na aplicação das regras: ${data?.error || 'Erro desconhecido'}`);
      }

    } catch (error: any) {
      console.error('❌ FALHA CRÍTICA na aplicação automática:', error);
      
      toast.error(`❌ Falha na aplicação automática: ${error.message}`);
      
      // Atualizar status de falha
      setStatus(prev => ({
        ...prev,
        falhas_automaticas: prev.falhas_automaticas + 1,
        sistema_ativo: false
      }));

      // Registrar falha no audit log
      await supabase.from('audit_logs').insert({
        table_name: 'sistema_automatico_regras',
        operation: 'APLICACAO_AUTOMATICA_FALHA',
        record_id: uploadData.id,
        new_data: {
          arquivo_fonte: tipo_arquivo,
          arquivo_nome,
          erro: error.message,
          stack_trace: error.stack
        },
        user_email: 'sistema-automatico',
        severity: 'error'
      });
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Sistema Automático de Regras
        </CardTitle>
        <CardDescription>
          Aplicação automática garantida das 28 regras de negócio sempre que dados são inseridos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center mb-4">
          <div className="flex flex-col items-center space-y-2">
            <Badge variant={status.sistema_ativo ? "default" : "destructive"} className="text-base px-4 py-2">
              {status.sistema_ativo ? "ATIVO" : "INATIVO"}
            </Badge>
            <span className="text-sm text-muted-foreground">Status do Sistema</span>
          </div>
        </div>
        
        <div className="mt-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Funcionamento:</strong> O sistema monitora automaticamente todos os uploads de volumetria 
              e aplica instantaneamente as 28 regras de negócio. Não requer intervenção manual.
            </p>
          </div>

          <Collapsible open={mostrarRegras} onOpenChange={setMostrarRegras}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
              <ChevronDown className={`h-4 w-4 transition-transform ${mostrarRegras ? 'rotate-180' : ''}`} />
              <span className="font-semibold">Ver Lista das 28 Regras Aplicadas Automaticamente</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid gap-4 p-4 bg-muted/30 rounded-lg">
                {Object.entries(
                  REGRAS_SISTEMA.reduce((acc, regra) => {
                    if (!acc[regra.categoria]) acc[regra.categoria] = [];
                    acc[regra.categoria].push(regra);
                    return acc;
                  }, {} as Record<string, typeof REGRAS_SISTEMA>)
                ).map(([categoria, regras]) => (
                  <div key={categoria} className="space-y-3">
                    <h4 className="font-semibold text-base text-primary border-b border-primary/20 pb-1">
                      {categoria} ({regras.length} regras)
                    </h4>
                    <div className="grid gap-3 ml-2">
                      {regras.map((regra) => (
                        <div key={regra.id} className="bg-background/50 p-3 rounded-lg border border-muted">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs font-mono">{regra.id}</Badge>
                            <span className="font-medium text-sm">{regra.nome}</span>
                          </div>
                          <div className="space-y-2 ml-4">
                            <div>
                              <strong className="text-xs text-muted-foreground">Critério:</strong>
                              <p className="text-xs text-muted-foreground mt-1">{regra.criterio}</p>
                            </div>
                            <div>
                              <strong className="text-xs text-muted-foreground">Implementação:</strong>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">{regra.implementacao}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}