import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditoriaResultado {
  cliente_id?: string;
  cliente_nome?: string;
  nome_fantasia?: string;
  periodo: string;
  volumes: { total_exames: number };
  parametros?: any;
  demonstrativo?: any;
  franquia_calculada_preview: {
    valor_esperado: number;
    regra: string;
  };
  conformidade: {
    ok: boolean;
    motivo?: string;
  };
}

export function AuditoriaFranquias() {
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<AuditoriaResultado[]>([]);
  const { toast } = useToast();

  const executarAuditoria = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auditar-franquias-periodo", {
        body: { periodo: "2025-09" },
      });

      if (error) throw error;

      setResultados(data.resultados || []);
      
      const divergencias = (data.resultados || []).filter((r: AuditoriaResultado) => !r.conformidade.ok);
      
      toast({
        title: "Auditoria concluída",
        description: `${data.total_clientes} clientes analisados. ${divergencias.length} divergências encontradas.`,
      });
    } catch (error: any) {
      console.error("Erro auditoria:", error);
      toast({
        title: "Erro na auditoria",
        description: error.message || "Erro ao executar auditoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const divergentes = resultados.filter(r => !r.conformidade.ok);
  const conformes = resultados.filter(r => r.conformidade.ok);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Auditoria de Franquias - Período 2025-09</CardTitle>
        <CardDescription>
          Compara parâmetros cadastrados vs. demonstrativos gerados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={executarAuditoria} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Executar Auditoria 2025-09
        </Button>

        {resultados.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Analisados</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{resultados.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-600">Divergências</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{divergentes.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-600">Conformes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{conformes.length}</p>
                </CardContent>
              </Card>
            </div>

            {divergentes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Divergências Encontradas
                </h3>
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  <div className="space-y-3">
                    {divergentes.map((r, idx) => (
                      <Card key={idx} className="border-red-200">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{r.nome_fantasia || r.cliente_nome}</CardTitle>
                              <CardDescription className="text-xs">
                                ID: {r.cliente_id?.substring(0, 8)}...
                              </CardDescription>
                            </div>
                            <Badge variant="destructive">Divergente</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Volume Real:</p>
                              <p className="font-medium">{r.volumes.total_exames} exames</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Regra Aplicada:</p>
                              <p className="font-mono text-xs">{r.franquia_calculada_preview.regra}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Valor Esperado:</p>
                              <p className="font-medium text-green-600">
                                R$ {r.franquia_calculada_preview.valor_esperado.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Valor Demonstrativo:</p>
                              <p className="font-medium text-red-600">
                                R$ {Number(r.demonstrativo?.valor_franquia || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          {r.conformidade.motivo && (
                            <div className="pt-2 border-t">
                              <p className="text-xs text-muted-foreground">{r.conformidade.motivo}</p>
                            </div>
                          )}
                          {r.parametros && (
                            <div className="pt-2 border-t text-xs">
                              <p className="font-medium">Parâmetros:</p>
                              <p className="font-mono text-xs">
                                freq_continua={String(r.parametros.frequencia_continua)} | 
                                freq_volume={String(r.parametros.frequencia_por_volume)} | 
                                vol_franquia={r.parametros.volume_franquia} | 
                                val_franquia={r.parametros.valor_franquia}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {conformes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Clientes Conformes ({conformes.length})
                </h3>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  <div className="space-y-2">
                    {conformes.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <span className="font-medium">{r.nome_fantasia || r.cliente_nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{r.volumes.total_exames} exames</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">OK</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
