import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CorrigirExclusoesRetroativo() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const executarCorrecao = async () => {
    try {
      setLoading(true);
      setResultado(null);
      
      console.log('🔄 Iniciando correção de exclusões retroativas...');
      toast.info("Iniciando correção das regras v002 e v003...");
      
      const { data, error } = await supabase.functions.invoke('corrigir-exclusoes-retroativo');
      
      if (error) {
        console.error('❌ Erro na correção:', error);
        toast.error(`Erro na correção: ${error.message}`);
        return;
      }
      
      console.log('✅ Correção concluída:', data);
      setResultado(data);
      
      if (data?.success) {
        toast.success(`Correção concluída! ${data.total_excluidos} registros excluídos.`);
      } else {
        toast.error("Erro na correção dos dados retroativos");
      }
      
    } catch (error) {
      console.error('❌ Erro crítico na correção:', error);
      toast.error("Erro crítico na correção");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          CORREÇÃO EMERGENCIAL - Exclusões Retroativas
        </CardTitle>
        <p className="text-sm text-amber-700">
          <strong>Problema:</strong> O arquivo volumetria_padrao_retroativo com 33.239 registros tem 33.044 registros com DATA_REALIZACAO maior que 2025-06-01 que deveriam ter sido excluídos pelas regras v002 e v003.
        </p>
        <div className="text-xs text-amber-600 space-y-1">
          <div><strong>Regra v003:</strong> Excluir DATA_REALIZACAO maior que 2025-06-01</div>
          <div><strong>Regra v002:</strong> Excluir DATA_LAUDO fora do período 08/06/2025 - 07/07/2025</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={executarCorrecao}
          disabled={loading}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {loading ? (
            <>Processando...</>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Executar Correção (v002 + v003)
            </>
          )}
        </Button>
        
        {resultado && (
          <Card className={resultado.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <CardContent className="p-4">
              <h4 className={`font-medium mb-2 ${resultado.success ? "text-green-800" : "text-red-800"}`}>
                {resultado.success ? "✅ Correção Concluída" : "❌ Erro na Correção"}
              </h4>
              
              {resultado.success && (
                <div className="space-y-2 text-sm">
                  <div><strong>Total Excluído:</strong> {resultado.total_excluidos} registros</div>
                  <div><strong>Registros Restantes:</strong> {resultado.registros_restantes}</div>
                  <div><strong>Arquivo:</strong> {resultado.arquivo_processado}</div>
                  
                  {resultado.detalhes && resultado.detalhes.length > 0 && (
                    <div>
                      <strong>Detalhes:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {resultado.detalhes.map((detalhe: string, index: number) => (
                          <li key={index} className="text-xs">{detalhe}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {!resultado.success && (
                <div className="text-sm text-red-700">
                  Erro: {resultado.error || "Erro desconhecido"}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}