import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResultadoV007 {
  sucesso: boolean;
  total_corrigidos: number;
  especialidades_processadas: string[];
  arquivo_fonte: string;
  mensagem: string;
}

export function AplicarRegraV007() {
  const [aplicando, setAplicando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoV007 | null>(null);

  const aplicarRegraV007 = async () => {
    if (aplicando) return;
    
    setAplicando(true);
    try {
      toast.info('🔄 Aplicando regra v007 nos dados existentes...');
      
      const { data, error } = await supabase.functions.invoke('corrigir-especialidades-retroativo', {
        body: { arquivo_fonte: null } // Aplicar em todos os arquivos
      });

      if (error) {
        throw new Error(`Erro na aplicação da regra v007: ${error.message}`);
      }

      if (data?.sucesso) {
        const resultado = data as ResultadoV007;
        setUltimoResultado(resultado);
        
        toast.success(`✅ ${resultado.mensagem}`);
        
        console.log('📊 Resultado da aplicação v007:', {
          'Total corrigidos': resultado.total_corrigidos,
          'Especialidades processadas': resultado.especialidades_processadas,
          'Arquivo fonte': resultado.arquivo_fonte
        });

      } else {
        throw new Error(`Falha na aplicação da regra v007: ${data?.erro || 'Erro desconhecido'}`);
      }

    } catch (error: any) {
      console.error('❌ Erro ao aplicar regra v007:', error);
      toast.error(`❌ Erro: ${error.message}`);
      
      setUltimoResultado({
        sucesso: false,
        total_corrigidos: 0,
        especialidades_processadas: [],
        arquivo_fonte: 'TODOS',
        mensagem: `Erro: ${error.message}`
      });
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-orange-600" />
          Aplicar Regra v007 - Correções de Especialidades
        </CardTitle>
        <CardDescription>
          Aplica a regra v007 nos dados já carregados para corrigir especialidades problemáticas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
          <h4 className="font-semibold text-orange-800 mb-2">Regra v007 Expandida - Especialidades que serão corrigidas:</h4>
          <ul className="text-sm text-orange-700 space-y-1">
            <li>• <strong>ANGIOTCS</strong> → <strong>MEDICINA INTERNA</strong></li>
            <li>• <strong>CABEÇA-PESCOÇO</strong> → <strong>NEURO</strong></li>
            <li>• <strong>TÓRAX</strong> → <strong>MEDICINA INTERNA</strong></li>
            <li>• <strong>CORPO</strong> → <strong>MEDICINA INTERNA</strong></li>
            <li>• <strong>D.O</strong> → <strong>MUSCULO ESQUELETICO</strong></li>
            <li>• <strong>MAMO</strong> → <strong>MAMA</strong></li>
            <li>• <strong>TOMOGRAFIA</strong> → <strong>MEDICINA INTERNA</strong></li>
            <li>• <strong>CARDIO COM SCORE</strong> → <strong>CARDIO</strong></li>
            <li>• <strong>ONCO MEDICINA INTERNA</strong> → <strong>MEDICINA INTERNA</strong></li>
          </ul>
        </div>

        <Button 
          onClick={aplicarRegraV007}
          disabled={aplicando}
          className="w-full"
          size="lg"
        >
          {aplicando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aplicando Regra v007...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Aplicar Regra v007 nos Dados Existentes
            </>
          )}
        </Button>

        {ultimoResultado && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {ultimoResultado.sucesso ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className="font-semibold">
                {ultimoResultado.sucesso ? 'Aplicação Concluída' : 'Aplicação com Erro'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {ultimoResultado.total_corrigidos}
                </div>
                <div className="text-sm text-blue-600">
                  Total de Registros Corrigidos
                </div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">
                  {ultimoResultado.especialidades_processadas.length}
                </div>
                <div className="text-sm text-purple-600">
                  Especialidades Processadas
                </div>
              </div>
            </div>

            {ultimoResultado.especialidades_processadas.length > 0 && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 font-semibold mb-2">
                  Especialidades corrigidas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {ultimoResultado.especialidades_processadas.map((esp) => (
                    <Badge key={esp} variant="outline" className="bg-white">
                      {esp}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Mensagem:</strong> {ultimoResultado.mensagem}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Arquivo fonte:</strong> {ultimoResultado.arquivo_fonte}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}