import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Upload, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClientStats {
  totalClientes: number;
  totalPrecos: number;
  precosComCliente: number;
  precosSemCliente: number;
  ultimoUploadClientes: any;
}

export function ClientValidationStatus() {
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadStats = async () => {
    try {
      setLoading(true);

      // Buscar estatísticas de clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id')
        .eq('ativo', true);

      if (clientesError) throw clientesError;

      // Buscar estatísticas de preços - FORÇAR BUSCA COMPLETA
      const { count: totalPrecos, error: precosCountError } = await supabase
        .from('precos_servicos')
        .select('*', { count: 'exact', head: true });

      if (precosCountError) throw precosCountError;

      // Contar preços com cliente
      const { count: precosComCliente, error: precosComClienteError } = await supabase
        .from('precos_servicos')
        .select('*', { count: 'exact', head: true })
        .not('cliente_id', 'is', null);

      if (precosComClienteError) throw precosComClienteError;

      // Contar preços sem cliente  
      const { count: precosSemCliente, error: precosSemClienteError } = await supabase
        .from('precos_servicos')
        .select('*', { count: 'exact', head: true })
        .is('cliente_id', null);

      if (precosSemClienteError) throw precosSemClienteError;

      // Buscar último upload de clientes - corrigir ordenação
      const { data: uploadData, error: uploadError } = await supabase
        .from('upload_logs')
        .select('*')
        .or('file_type.eq.clientes,file_type.eq.clientes_simples')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (uploadError) throw uploadError;

      setStats({
        totalClientes: clientesData?.length || 0,
        totalPrecos: totalPrecos || 0,
        precosComCliente: precosComCliente || 0,
        precosSemCliente: precosSemCliente || 0,
        ultimoUploadClientes: uploadData
      });

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar estatísticas de validação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const reprocessarPrecos = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Iniciando reprocessamento usando nome_fantasia exclusivamente...');
      
      // Chamar função de validação que usa exclusivamente nome_fantasia
      const { data, error } = await supabase.rpc('aplicar_validacao_cliente_volumetria', {
        lote_upload_param: null
      });

      if (error) throw error;

      console.log('✅ Reprocessamento concluído:', data);

      toast({
        title: "Sucesso",
        description: `${(data as any)?.registros_atualizados || 0} preços foram associados usando nome_fantasia. ${(data as any)?.registros_sem_cliente || 0} registros sem correlação.`,
      });

      // Recarregar estatísticas
      await loadStats();

    } catch (error) {
      console.error('Erro ao reprocessar preços:', error);
      toast({
        title: "Erro",
        description: "Erro ao reprocessar preços. Verifique os logs.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading && !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validação de Clientes</CardTitle>
          <CardDescription>Carregando estatísticas...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const hasProblems = stats.totalClientes === 0 || stats.precosSemCliente > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasProblems ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle className="h-5 w-5 text-success" />
            )}
            Status de Validação de Clientes
          </CardTitle>
          <CardDescription>
            Verificação da associação entre clientes e preços cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estatísticas Gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {stats.totalClientes}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Ativos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {stats.totalPrecos}
              </div>
              <div className="text-sm text-muted-foreground">Total Preços</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {stats.precosComCliente}
              </div>
              <div className="text-sm text-muted-foreground">Com Cliente</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">
                {stats.precosSemCliente}
              </div>
              <div className="text-sm text-muted-foreground">Sem Cliente</div>
            </div>
          </div>

          {/* Alertas e Recomendações */}
          {stats.totalClientes === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Nenhum Cliente Cadastrado</AlertTitle>
              <AlertDescription>
                Não há clientes ativos no sistema. Todos os preços importados ficaram sem associação de cliente.
                <br />
                <strong>Ação necessária:</strong> Fazer upload da planilha de clientes primeiro.
              </AlertDescription>
            </Alert>
          )}

          {stats.precosSemCliente > 0 && stats.totalClientes > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Preços Sem Cliente Identificado</AlertTitle>
              <AlertDescription>
                {stats.precosSemCliente} preços não foram associados a nenhum cliente cadastrado.
                <br />
                <strong>Possíveis causas:</strong> Nomes diferentes entre planilhas, clientes não cadastrados, ou problemas de mapeamento.
              </AlertDescription>
            </Alert>
          )}

          {/* Seção do último upload removida - dados inconsistentes */}

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              onClick={loadStats}
              variant="outline"
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Status
            </Button>

            {stats.totalClientes > 0 && stats.precosSemCliente > 0 && (
              <Button
                onClick={reprocessarPrecos}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Reprocessar Preços
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}