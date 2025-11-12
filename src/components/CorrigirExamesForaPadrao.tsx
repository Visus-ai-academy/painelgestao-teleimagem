import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVolumetria } from "@/contexts/VolumetriaContext";

export const CorrigirExamesForaPadrao = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();
  const { refreshData } = useVolumetria();

  const handleCorrigir = async () => {
    setIsProcessing(true);
    setResultado(null);

    try {
      console.log('🔧 Iniciando correção de exames fora do padrão...');

      const body = { arquivo_fonte: 'volumetria_fora_padrao' };

      // Etapa 1: Corrigir categorias, especialidades e modalidades
      const { data: dataCorrecao, error: errorCorrecao } = await supabase.functions.invoke(
        'corrigir-volumetria-fora-padrao',
        { body }
      );

      if (errorCorrecao) throw errorCorrecao;

      if (!dataCorrecao.sucesso) {
        toast({
          title: "⚠️ Erro na correção",
          description: dataCorrecao.erro || "Erro desconhecido",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Etapa 1 concluída: Categorias, especialidades e modalidades corrigidas');

      // Etapa 2: Aplicar valores do De-Para
      console.log('🔧 Aplicando valores do De-Para...');
      const { data: dataAplicacao, error: errorAplicacao } = await supabase.functions.invoke(
        'aplicar-de-para-automatico',
        { body }
      );

      if (errorAplicacao) {
        console.error('⚠️ Erro ao aplicar De-Para:', errorAplicacao);
      }

      // Combinar resultados
      const resultadoFinal = {
        ...dataCorrecao,
        valores_aplicados: dataAplicacao?.registros_atualizados || 0,
        aplicacao_erro: errorAplicacao ? true : false
      };

      setResultado(resultadoFinal);
      
      const mensagemSucesso = errorAplicacao 
        ? `${dataCorrecao.registros_corrigidos} registros corrigidos (categorias/especialidades)`
        : `${dataCorrecao.registros_corrigidos} registros corrigidos, ${dataAplicacao?.registros_atualizados || 0} valores aplicados`;

      toast({
        title: "✅ Correção concluída",
        description: mensagemSucesso,
      });
      
      // Atualizar dados em todos os componentes
      console.log('🔄 Atualizando dados...');
      await refreshData();

    } catch (error: any) {
      console.error('Erro ao executar correção:', error);
      toast({
        title: "Erro ao executar correção",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Corrigir Exames Fora do Padrão
        </CardTitle>
        <CardDescription>
          Corrige automaticamente os registros de exames fora do padrão aplicando categoria, especialidade, modalidade e valores do cadastro de exames e tabela De-Para
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Etapa 1:</strong> Busca no cadastro de exames os valores de categoria, especialidade e modalidade.<br/>
            <strong>Etapa 2:</strong> Aplica os valores da tabela De-Para aos exames que ainda estão com valores zerados.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleCorrigir} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Executar Correção
            </>
          )}
        </Button>

        {resultado && resultado.sucesso && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="space-y-1">
                <p className="font-semibold">Correção concluída com sucesso!</p>
                <p className="text-sm">Arquivo: {resultado.arquivo_fonte}</p>
                <p className="text-sm">Registros encontrados: {resultado.registros_encontrados}</p>
                <p className="text-sm">Registros corrigidos (cat/esp/mod): {resultado.registros_corrigidos}</p>
                {resultado.valores_aplicados > 0 && (
                  <p className="text-sm">Valores aplicados: {resultado.valores_aplicados}</p>
                )}
                {resultado.aplicacao_erro && (
                  <p className="text-sm text-orange-600">⚠️ Houve erro ao aplicar alguns valores</p>
                )}
                <p className="text-sm">Mapeamentos utilizados: {resultado.mapeamentos_utilizados}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {resultado.detalhes?.observacao}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
