import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Play, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RegrasStatus {
  arquivo: string;
  needsRules: boolean;
  totalRegistros: number;
  estimativaAposRegras: number;
}

export function AutoAplicarRegrasRetroativas() {
  const [regrasStatus, setRegrasStatus] = useState<RegrasStatus[]>([]);
  const [executing, setExecuting] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { toast } = useToast();

  const verificarNecessidadeRegras = async () => {
    try {
      console.log('🔍 Verificando necessidade de aplicar regras v002/v003...');
      
      // Verificar arquivos retroativos
      const arquivosRetroativos = ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'];
      const status: RegrasStatus[] = [];

      for (const arquivo of arquivosRetroativos) {
        // Contar registros totais no arquivo
        const { count: totalRegistros } = await supabase
          .from('volumetria_mobilemed')
          .select('*', { count: 'exact', head: true })
          .eq('arquivo_fonte', arquivo);

        // Para arquivo retroativo padrão, esperamos ~230 após regras
        // Para fora padrão retroativo, esperamos ~0 após regras
        const estimativaEsperada = arquivo === 'volumetria_padrao_retroativo' ? 230 : 0;
        const needsRules = (totalRegistros || 0) > estimativaEsperada * 10; // Margem de tolerância

        status.push({
          arquivo: arquivo === 'volumetria_padrao_retroativo' ? 'Padrão Retroativo' : 'Fora Padrão Retroativo',
          needsRules,
          totalRegistros: totalRegistros || 0,
          estimativaAposRegras: estimativaEsperada
        });
      }

      setRegrasStatus(status);
      setLastCheck(new Date());
      
      console.log('📊 Status das regras:', status);
      
    } catch (error) {
      console.error('❌ Erro ao verificar regras:', error);
      toast({
        title: "Erro na verificação",
        description: "Falha ao verificar necessidade das regras v002/v003",
        variant: "destructive"
      });
    }
  };

  const aplicarRegrasAutomaticamente = async () => {
    if (executing) return;
    
    setExecuting(true);
    try {
      console.log('🚀 Aplicando regras v002 e v003 automaticamente...');
      
      // Determinar período atual (junho/25)
      const periodoReferencia = "jun/25";
      
      toast({
        title: "Aplicando regras v002/v003",
        description: `Executando exclusões automáticas para período ${periodoReferencia}...`
      });

      // Executar a edge function que aplica as regras
      const { data, error } = await supabase.functions.invoke('aplicar-exclusoes-periodo', {
        body: {
          periodo_referencia: periodoReferencia
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Regras aplicadas com sucesso:', data);
      
      toast({
        title: "Regras aplicadas com sucesso!",
        description: `${data.total_excluidos || 0} registros excluídos conforme regras v002/v003`
      });

      // Verificar novamente após aplicação
      setTimeout(() => {
        verificarNecessidadeRegras();
      }, 2000);

    } catch (error) {
      console.error('❌ Erro ao aplicar regras:', error);
      toast({
        title: "Erro na aplicação das regras",
        description: "Falha ao executar regras v002/v003 automaticamente",
        variant: "destructive"
      });
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    verificarNecessidadeRegras();
  }, []);

  const temRegrasParaAplicar = regrasStatus.some(status => status.needsRules);

  if (regrasStatus.length === 0) {
    return null;
  }

  return (
    <Card className={temRegrasParaAplicar ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {temRegrasParaAplicar ? (
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          Status das Regras v002/v003 (Arquivos Retroativos)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {regrasStatus.map((status, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div>
                <div className="font-medium">{status.arquivo}</div>
                <div className="text-sm text-muted-foreground">
                  {status.totalRegistros.toLocaleString()} registros | Esperado após regras: ~{status.estimativaAposRegras}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.needsRules ? (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  Regras Pendentes
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Processado
                </Badge>
              )}
            </div>
          </div>
        ))}

        {temRegrasParaAplicar && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              ⚠️ Regras v002/v003 precisam ser aplicadas para reduzir a quantidade de registros
            </div>
            <Button 
              onClick={aplicarRegrasAutomaticamente}
              disabled={executing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {executing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Aplicar Regras Agora
                </>
              )}
            </Button>
          </div>
        )}

        {lastCheck && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}