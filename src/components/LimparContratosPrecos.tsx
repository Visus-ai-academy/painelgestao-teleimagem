import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LimpezaResult {
  contratos_removidos: number;
  precos_removidos: number;
  logs_criados: number;
  timestamp: string;
}

export function LimparContratosPrecos() {
  const [loading, setLoading] = useState(false);
  const [ultimaLimpeza, setUltimaLimpeza] = useState<LimpezaResult | null>(null);

  const executarLimpeza = async () => {
    setLoading(true);
    
    try {
      console.log('🚀 Iniciando chamada para edge function...');
      
      const { data, error } = await supabase.functions.invoke('limpar-contratos-e-precos', {
        body: { timestamp: new Date().toISOString() }
      });

      if (error) {
        console.error('❌ Erro na edge function:', error);
        throw new Error(error.message);
      }

      console.log('✅ Resposta da edge function:', data);

      if (data.sucesso) {
        setUltimaLimpeza(data.resultado);
        toast.success(
          `Limpeza concluída! ${data.resultado.contratos_removidos} contratos e ${data.resultado.precos_removidos} preços removidos.`,
          { duration: 5000 }
        );
      } else {
        throw new Error(data.erro || 'Erro desconhecido na limpeza');
      }

    } catch (error: any) {
      console.error('💥 Erro completo:', error);
      toast.error(`Erro na limpeza: ${error.message}`, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-600" />
          Limpeza de Contratos e Preços
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Remove todos os registros das tabelas de contratos de clientes e preços de serviços
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <strong>Atenção:</strong>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            Esta operação remove TODOS os dados das tabelas:
          </p>
          <ul className="text-yellow-700 text-sm mt-2 ml-4 list-disc">
            <li><code>contratos_clientes</code> - Todos os contratos</li>
            <li><code>precos_servicos</code> - Todos os preços configurados</li>
          </ul>
          <p className="text-yellow-700 text-sm mt-2">
            <strong>Esta ação é irreversível!</strong>
          </p>
        </div>

        {ultimaLimpeza && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 mb-2">
              <CheckCircle className="h-4 w-4" />
              <strong>Última limpeza executada com sucesso</strong>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  {ultimaLimpeza.contratos_removidos} contratos removidos
                </Badge>
              </div>
              <div>
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  {ultimaLimpeza.precos_removidos} preços removidos
                </Badge>
              </div>
            </div>
            <p className="text-green-700 text-xs mt-2">
              Executado em: {new Date(ultimaLimpeza.timestamp).toLocaleString('pt-BR')}
            </p>
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executando limpeza...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Contratos e Preços
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Confirmar Limpeza Completa
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Você está prestes a remover <strong>TODOS</strong> os dados das seguintes tabelas:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li><strong>contratos_clientes</strong> - Todos os contratos de clientes</li>
                  <li><strong>precos_servicos</strong> - Todos os preços configurados</li>
                </ul>
                <p className="text-red-600 font-medium">
                  Esta ação é irreversível e não pode ser desfeita!
                </p>
                <p>
                  Tem certeza que deseja prosseguir?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={executarLimpeza}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Sim, limpar dados
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}