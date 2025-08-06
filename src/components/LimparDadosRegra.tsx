import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const LimparDadosRegra = () => {
  const [periodo, setPeriodo] = useState("jun/25");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleLimparDados = async () => {
    if (!periodo.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o período de referência",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      console.log(`🧹 Aplicando filtro de DATA_LAUDO para período: ${periodo}`);
      
      const { data, error } = await supabase.functions.invoke('aplicar-filtro-data-laudo', {
        body: { periodo_referencia: periodo }
      });

      if (error) {
        throw error;
      }

      setResult(data);
      
      toast({
        title: "✅ Sucesso",
        description: `Filtro aplicado com sucesso! ${data.total_excluidos} registros removidos`,
      });

    } catch (error: any) {
      console.error('Erro ao aplicar filtro:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao aplicar filtro de DATA_LAUDO",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Aplicar Filtro de DATA_LAUDO (Arquivos Não-Retroativos)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Atenção</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Esta função remove registros de arquivos não-retroativos (volumetria_padrao, volumetria_fora_padrao, volumetria_onco_padrao) 
                onde DATA_LAUDO é posterior ao período de faturamento permitido.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="periodo">Período de Referência</Label>
            <Input
              id="periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Ex: jun/25"
              disabled={isProcessing}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Formato: mês/ano (ex: jun/25, jul/24)
            </p>
          </div>

          <Button 
            onClick={handleLimparDados} 
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              "Processando..."
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Aplicar Filtro de DATA_LAUDO
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="w-full">
                <h4 className="font-medium text-green-800">Filtro Aplicado com Sucesso</h4>
                <div className="mt-2 space-y-2">
                  <p><strong>Período:</strong> {result.periodo_referencia}</p>
                  <p><strong>Total Excluído:</strong> {result.total_excluidos} registros</p>
                  <p><strong>Data Limite:</strong> {result.data_limite_aplicada}</p>
                  
                  {result.detalhes && result.detalhes.length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-green-800">Detalhes por Arquivo:</h5>
                      <ul className="list-disc list-inside text-sm text-green-700">
                        {result.detalhes.map((detalhe: string, index: number) => (
                          <li key={index}>{detalhe}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};