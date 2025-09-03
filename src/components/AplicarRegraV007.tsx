import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResultadoV007 {
  sucesso: boolean;
  total_correcoes_colunas: number;
  total_correcoes_neuro: number;
  total_correcoes_onco_med_int: number;
  total_categorias_aplicadas: number;
  total_erros: number;
  registros_restantes: number;
  observacoes: string;
}

export function AplicarRegraV007() {
  const [aplicando, setAplicando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoV007 | null>(null);

  const aplicarRegraV007 = async () => {
    if (aplicando) return;
    
    setAplicando(true);
    try {
      toast.info('🔄 Aplicando regra v007 nos dados existentes...');
      
      const { data, error } = await supabase.functions.invoke('aplicar-v007-especialidades-existentes', {
        body: {}
      });

      if (error) {
        throw new Error(`Erro na aplicação da regra v007: ${error.message}`);
      }

      if (data?.sucesso) {
        const resultado = data as ResultadoV007;
        setUltimoResultado(resultado);
        
        const totalCorrecoes = resultado.total_correcoes_colunas + 
                              resultado.total_correcoes_neuro + 
                              resultado.total_correcoes_onco_med_int;
        
        toast.success(`✅ Regra v007 aplicada com sucesso! ${totalCorrecoes} correções realizadas`);
        
        console.log('📊 Resultado da aplicação v007:', {
          'COLUNAS → MUSCULO ESQUELETICO': resultado.total_correcoes_colunas,
          'COLUNAS → Neuro (neurologistas)': resultado.total_correcoes_neuro,
          'ONCO MEDICINA INTERNA → MEDICINA INTERNA': resultado.total_correcoes_onco_med_int,
          'Categorias aplicadas': resultado.total_categorias_aplicadas,
          'Registros problemáticos restantes': resultado.registros_restantes
        });

      } else {
        throw new Error(`Falha na aplicação da regra v007: ${data?.erro || 'Erro desconhecido'}`);
      }

    } catch (error: any) {
      console.error('❌ Erro ao aplicar regra v007:', error);
      toast.error(`❌ Erro: ${error.message}`);
      
      setUltimoResultado({
        sucesso: false,
        total_correcoes_colunas: 0,
        total_correcoes_neuro: 0,
        total_correcoes_onco_med_int: 0,
        total_categorias_aplicadas: 0,
        total_erros: 1,
        registros_restantes: 0,
        observacoes: `Erro: ${error.message}`
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
          <h4 className="font-semibold text-orange-800 mb-2">Regra v007 - O que será aplicado:</h4>
          <ul className="text-sm text-orange-700 space-y-1">
            <li>• <strong>COLUNAS</strong> → <strong>MÚSCULO ESQUELÉTICO</strong> (padrão)</li>
            <li>• <strong>COLUNAS</strong> → <strong>Neuro</strong> (para 43 médicos neurologistas específicos)</li>
            <li>• <strong>ONCO MEDICINA INTERNA</strong> → <strong>MEDICINA INTERNA</strong></li>
            <li>• Aplicação de categorias do cadastro de exames quando disponível</li>
            <li>• Normalização inteligente de nomes de médicos (maiúscula/minúscula, abreviações)</li>
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
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-700">
                  {ultimoResultado.total_correcoes_colunas}
                </div>
                <div className="text-xs text-blue-600">
                  COLUNAS → MÚSCULO ESQ.
                </div>
              </div>
              
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-700">
                  {ultimoResultado.total_correcoes_neuro}
                </div>
                <div className="text-xs text-purple-600">
                  COLUNAS → Neuro
                </div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-700">
                  {ultimoResultado.total_correcoes_onco_med_int}
                </div>
                <div className="text-xs text-green-600">
                  ONCO MED INT → MED INT
                </div>
              </div>
              
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-700">
                  {ultimoResultado.total_categorias_aplicadas}
                </div>
                <div className="text-xs text-amber-600">
                  Categorias Aplicadas
                </div>
              </div>
            </div>

            {ultimoResultado.total_erros > 0 && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <Badge variant="destructive" className="mb-2">
                  {ultimoResultado.total_erros} Erros
                </Badge>
                <p className="text-sm text-red-700">
                  Alguns registros não puderam ser processados. Verifique os logs para detalhes.
                </p>
              </div>
            )}

            {ultimoResultado.registros_restantes > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <Badge variant="outline" className="mb-2">
                  {ultimoResultado.registros_restantes} Registros Restantes
                </Badge>
                <p className="text-sm text-yellow-700">
                  Ainda existem registros com especialidades "COLUNAS" ou "ONCO MEDICINA INTERNA" que precisam ser verificados.
                </p>
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Observações:</strong> {ultimoResultado.observacoes}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}