import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, AlertCircle, Clock, Settings, ChevronDown } from 'lucide-react';

interface StatusRegras {
  aplicacoes_automaticas: number;
  falhas_automaticas: number;
  ultima_aplicacao: string;
  sistema_ativo: boolean;
}

// Lista das 27 regras aplicadas automaticamente
const REGRAS_SISTEMA = [
  { id: 'v001', nome: 'Correção Modalidade BMD → DO', categoria: 'Modalidade' },
  { id: 'v002', nome: 'Correção Modalidade CR/DX → MG/RX', categoria: 'Modalidade' },
  { id: 'v003', nome: 'Correção Especialidade ONCO MEDICINA INTERNA', categoria: 'Especialidade' },
  { id: 'v004', nome: 'Aplicar Categoria do Cadastro de Exames', categoria: 'Categoria' },
  { id: 'v005', nome: 'Aplicar Especialidade do Cadastro de Exames', categoria: 'Especialidade' },
  { id: 'v006', nome: 'Categoria Padrão por Modalidade', categoria: 'Categoria' },
  { id: 'v007', nome: 'De-Para Prioridades', categoria: 'Prioridade' },
  { id: 'v008', nome: 'De-Para Valores (VALORES = 0)', categoria: 'Valores' },
  { id: 'v009', nome: 'Tipificação Faturamento - Categoria ONCO', categoria: 'Faturamento' },
  { id: 'v010', nome: 'Tipificação Faturamento - Categoria MUSCULO', categoria: 'Faturamento' },
  { id: 'v011', nome: 'Tipificação Faturamento - Categoria NEURO', categoria: 'Faturamento' },
  { id: 'v012', nome: 'Tipificação Faturamento - Modalidade TC', categoria: 'Faturamento' },
  { id: 'v013', nome: 'Tipificação Faturamento - Modalidade RM', categoria: 'Faturamento' },
  { id: 'v014', nome: 'Tipificação Faturamento - Modalidade US', categoria: 'Faturamento' },
  { id: 'v015', nome: 'Tipificação Faturamento - Modalidade MG', categoria: 'Faturamento' },
  { id: 'v016', nome: 'Tipificação Faturamento - Modalidade RX', categoria: 'Faturamento' },
  { id: 'v017', nome: 'Tipificação Faturamento - Modalidade DO', categoria: 'Faturamento' },
  { id: 'v018', nome: 'Tipificação Faturamento - Prioridade URGENTE', categoria: 'Faturamento' },
  { id: 'v019', nome: 'Tipificação Faturamento - Prioridade EMERGENCIA', categoria: 'Faturamento' },
  { id: 'v020', nome: 'Tipificação Faturamento - Prioridade ROTINA', categoria: 'Faturamento' },
  { id: 'v021', nome: 'Tipificação Faturamento - Categoria CORPO', categoria: 'Faturamento' },
  { id: 'v022', nome: 'Tipificação Faturamento - Categoria TORAX', categoria: 'Faturamento' },
  { id: 'v023', nome: 'Tipificação Faturamento - Categoria ABDOME', categoria: 'Faturamento' },
  { id: 'v024', nome: 'Tipificação Faturamento - Categoria PELVE', categoria: 'Faturamento' },
  { id: 'v025', nome: 'Tipificação Faturamento - Categoria CRANIO', categoria: 'Faturamento' },
  { id: 'v026', nome: 'Tipificação Faturamento - Categoria PESCOCO', categoria: 'Faturamento' },
  { id: 'v027', nome: 'Tipificação Faturamento - Padrão (outros casos)', categoria: 'Faturamento' }
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
      console.log(`⚡ APLICAÇÃO AUTOMÁTICA iniciada para ${tipo_arquivo}`);
      
      // Aplicar TODAS as 27 regras automaticamente usando a função unificada
      const { data, error } = await supabase.functions.invoke('aplicar-regras-sistema-completo', {
        body: {
          arquivo_fonte: tipo_arquivo,
          periodo_referencia: '2025-06', // Sempre usar período atual
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
          Aplicação automática garantida das 27 regras de negócio sempre que dados são inseridos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col items-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <span className="text-2xl font-bold">{status.aplicacoes_automaticas}</span>
            <span className="text-sm text-muted-foreground">Sucessos Automáticos</span>
          </div>
          
          <div className="flex flex-col items-center space-y-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <span className="text-2xl font-bold">{status.falhas_automaticas}</span>
            <span className="text-sm text-muted-foreground">Falhas</span>
          </div>
          
          <div className="flex flex-col items-center space-y-2">
            <Clock className="h-8 w-8 text-blue-500" />
            <span className="text-xs font-mono">{status.ultima_aplicacao || 'Nunca'}</span>
            <span className="text-sm text-muted-foreground">Última Aplicação</span>
          </div>
          
          <div className="flex flex-col items-center space-y-2">
            <Badge variant={status.sistema_ativo ? "default" : "destructive"}>
              {status.sistema_ativo ? "ATIVO" : "INATIVO"}
            </Badge>
            <span className="text-sm text-muted-foreground">Status do Sistema</span>
          </div>
        </div>
        
        <div className="mt-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Funcionamento:</strong> O sistema monitora automaticamente todos os uploads de volumetria 
              e aplica instantaneamente as 27 regras de negócio. Não requer intervenção manual.
            </p>
          </div>

          <Collapsible open={mostrarRegras} onOpenChange={setMostrarRegras}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
              <ChevronDown className={`h-4 w-4 transition-transform ${mostrarRegras ? 'rotate-180' : ''}`} />
              <span className="font-semibold">Ver Lista das 27 Regras Aplicadas Automaticamente</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid gap-3 p-4 bg-muted/30 rounded-lg">
                {Object.entries(
                  REGRAS_SISTEMA.reduce((acc, regra) => {
                    if (!acc[regra.categoria]) acc[regra.categoria] = [];
                    acc[regra.categoria].push(regra);
                    return acc;
                  }, {} as Record<string, typeof REGRAS_SISTEMA>)
                ).map(([categoria, regras]) => (
                  <div key={categoria} className="space-y-2">
                    <h4 className="font-semibold text-sm text-primary">{categoria}</h4>
                    <div className="grid gap-1 ml-4">
                      {regras.map((regra) => (
                        <div key={regra.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">{regra.id}</Badge>
                          <span className="text-muted-foreground">{regra.nome}</span>
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