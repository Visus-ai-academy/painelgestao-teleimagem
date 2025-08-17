import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface ClienteNaoAssociado {
  nome_planilha: string;
  total_registros: number;
  possiveis_matches: string[];
}

export function PrecosSemClienteAnalise() {
  const [analise, setAnalise] = useState<ClienteNaoAssociado[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const analisarNomesNaoAssociados = async () => {
    try {
      setLoading(true);
      
      // Executar a validação para obter os nomes não encontrados
      const { data: validacao, error: validacaoError } = await supabase.functions.invoke(
        'aplicar-validacao-cliente', 
        { body: { lote_upload: null } }
      );

      if (validacaoError) {
        throw new Error(`Erro na validação: ${validacaoError.message}`);
      }

      console.log('🔍 Resultado da validação:', validacao);

      if (validacao.clientes_nao_encontrados && validacao.clientes_nao_encontrados.length > 0) {
        // Buscar clientes similares para cada nome não encontrado
        const analisePromises = validacao.clientes_nao_encontrados.map(async (nomeNaoEncontrado: string) => {
          // Buscar clientes com nomes similares
          const { data: clientesSimilares } = await supabase
            .from('clientes')
            .select('nome, nome_fantasia, nome_mobilemed')
            .or(`nome.ilike.%${nomeNaoEncontrado}%,nome_fantasia.ilike.%${nomeNaoEncontrado}%,nome_mobilemed.ilike.%${nomeNaoEncontrado}%`)
            .limit(5);

          const possiveisMatches = clientesSimilares?.map(c => 
            `${c.nome} | ${c.nome_fantasia || 'N/A'} | ${c.nome_mobilemed || 'N/A'}`
          ) || [];

          return {
            nome_planilha: nomeNaoEncontrado,
            total_registros: 1, // Por enquanto, apenas indicamos que existe
            possiveis_matches: possiveisMatches
          };
        });

        const resultadoAnalise = await Promise.all(analisePromises);
        setAnalise(resultadoAnalise);
      } else {
        setAnalise([]);
        toast({
          title: "Informação",
          description: "Nenhum cliente não associado foi encontrado na validação.",
        });
      }

    } catch (error) {
      console.error('❌ Erro na análise:', error);
      toast({
        title: "Erro",
        description: `Erro ao analisar nomes: ${(error as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de Preços Sem Cliente Associado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={analisarNomesNaoAssociados} 
          disabled={loading}
        >
          {loading ? 'Analisando...' : 'Analisar Nomes Não Associados'}
        </Button>

        {analise.length > 0 && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Foram encontrados {analise.length} nomes de clientes nos preços que não conseguiram ser associados ao cadastro de clientes.
              </AlertDescription>
            </Alert>

            {analise.map((item, index) => (
              <Card key={index} className="border-l-4 border-l-orange-500">
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="font-semibold text-destructive">
                      Nome na Planilha de Preços: "{item.nome_planilha}"
                    </div>
                    
                    {item.possiveis_matches.length > 0 ? (
                      <div>
                        <div className="text-sm font-medium mb-2">Possíveis correspondências no cadastro:</div>
                        <div className="space-y-1">
                          {item.possiveis_matches.map((match, idx) => {
                            const [nome, fantasia, mobilemed] = match.split(' | ');
                            return (
                              <div key={idx} className="text-sm bg-gray-50 p-2 rounded">
                                <div><strong>Nome:</strong> {nome}</div>
                                <div><strong>Nome Fantasia:</strong> {fantasia}</div>
                                <div><strong>Nome MobileMed:</strong> {mobilemed}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Nenhum cliente similar encontrado no cadastro
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && analise.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Clique em "Analisar" para verificar quais nomes de clientes não estão sendo associados
          </div>
        )}
      </CardContent>
    </Card>
  );
}