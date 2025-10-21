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
  exemplo_registro: any;
}

export function PrecosSemClienteAnalise() {
  const [analise, setAnalise] = useState<ClienteNaoAssociado[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapeandoCliente, setMapeandoCliente] = useState<string | null>(null);
  const { toast } = useToast();

  const mapearCliente = async (nomeOrigem: string, nomeDestino: string) => {
    try {
      setMapeandoCliente(nomeOrigem);
      
      console.log(`🔄 Mapeando "${nomeOrigem}" para "${nomeDestino}"`);

      const { data, error } = await supabase.functions.invoke('mapear-cliente-precos', {
        body: {
          nome_origem: nomeOrigem,
          nome_destino: nomeDestino
        }
      });

      if (error) throw error;

      if (data.sucesso) {
        toast({
          title: "Mapeamento Concluído",
          description: data.mensagem,
        });
        
        // Recarregar análise
        await analisarNomesNaoAssociados();
      } else {
        throw new Error(data.erro || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('❌ Erro ao mapear:', error);
      toast({
        title: "Erro",
        description: `Erro ao mapear cliente: ${(error as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setMapeandoCliente(null);
    }
  };

  const analisarNomesNaoAssociados = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Analisando TODOS os preços sem cliente...');

      // Buscar TODOS os preços sem cliente_id
      const { data: precosSemCliente, error } = await supabase
        .from('precos_servicos')
        .select('*')
        .is('cliente_id', null)
        .limit(1000);

      if (error) {
        throw new Error(`Erro ao buscar preços: ${error.message}`);
      }

      console.log('📊 Total de preços sem cliente encontrados:', precosSemCliente?.length || 0);

      if (!precosSemCliente || precosSemCliente.length === 0) {
        toast({
          title: "Informação",
          description: "Nenhum preço sem cliente foi encontrado.",
        });
        setAnalise([]);
        return;
      }

      // Agrupar por nome de cliente (tentar extrair de descrição ou observações)
      const grupos = new Map<string, any[]>();
      
      precosSemCliente.forEach(preco => {
        let nomeCliente = 'DESCONHECIDO';
        
        // Tentar extrair da descrição "Cliente original: NOME"
        if (preco.descricao) {
          const matchDescricao = preco.descricao.match(/Cliente original:\s*(.+)/);
          if (matchDescricao) {
            nomeCliente = matchDescricao[1].trim();
          } else {
            // Se não tem "Cliente original:", usar a descrição completa
            nomeCliente = preco.descricao.substring(0, 50); // Limitar tamanho
          }
        }
        
        // Se tem observações, adicionar ao identificador
        if (preco.observacoes && !nomeCliente.includes(preco.observacoes.substring(0, 30))) {
          nomeCliente += ` | ${preco.observacoes.substring(0, 30)}`;
        }
        
        if (!grupos.has(nomeCliente)) {
          grupos.set(nomeCliente, []);
        }
        grupos.get(nomeCliente)?.push(preco);
      });

      console.log('📋 Grupos de clientes encontrados:', grupos.size);

      // Para cada grupo, buscar possíveis correspondências
      const analisePromises = Array.from(grupos.entries()).map(async ([nomeCliente, registros]) => {
        console.log(`🔍 Analisando grupo: ${nomeCliente} (${registros.length} registros)`);
        
        // Tentar extrair nome limpo para busca
        let nomeBusca = nomeCliente;
        if (nomeCliente.includes('Cliente original:')) {
          const match = nomeCliente.match(/Cliente original:\s*(.+)/);
          if (match) nomeBusca = match[1].trim();
        }
        
        // Buscar clientes similares usando ILIKE para busca flexível
        const { data: clientesSimilares } = await supabase
          .from('clientes')
          .select('nome, nome_fantasia, nome_mobilemed')
          .or(`nome.ilike.%${nomeBusca}%,nome_fantasia.ilike.%${nomeBusca}%,nome_mobilemed.ilike.%${nomeBusca}%`)
          .limit(5);

        const possiveisMatches = clientesSimilares?.map(c => 
          `Nome: ${c.nome || 'N/A'} | Fantasia: ${c.nome_fantasia || 'N/A'} | MobileMed: ${c.nome_mobilemed || 'N/A'}`
        ) || [];

        return {
          nome_planilha: nomeCliente,
          total_registros: registros.length,
          possiveis_matches: possiveisMatches,
          exemplo_registro: registros[0]
        };
      });

      const resultadoAnalise = await Promise.all(analisePromises);
      
      // Ordenar por número de registros (maior primeiro)
      resultadoAnalise.sort((a, b) => b.total_registros - a.total_registros);
      
      setAnalise(resultadoAnalise);
      
      const totalRegistros = resultadoAnalise.reduce((sum, item) => sum + item.total_registros, 0);
      
      toast({
        title: "Análise Concluída",
        description: `Encontrados ${resultadoAnalise.length} grupos de clientes não associados em ${totalRegistros} registros de preços.`,
      });

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
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-destructive">
                        Nome na Planilha: "{item.nome_planilha}"
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.total_registros} registro{item.total_registros > 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    {item.exemplo_registro && (
                      <div className="text-xs bg-gray-50 p-2 rounded">
                        <div><strong>Exemplo:</strong> {item.exemplo_registro.modalidade} | {item.exemplo_registro.especialidade} | {item.exemplo_registro.categoria} | R$ {item.exemplo_registro.valor_base}</div>
                      </div>
                    )}
                    
                    {item.possiveis_matches.length > 0 ? (
                      <div>
                        <div className="text-sm font-medium mb-2">Possíveis correspondências no cadastro:</div>
                        <div className="space-y-2">
                          {item.possiveis_matches.map((match, idx) => {
                            // Extrair o nome do cliente da string "Nome: XXX | ..."
                            const nomeMatch = match.match(/Nome:\s*([^|]+)/);
                            const nomeCliente = nomeMatch ? nomeMatch[1].trim() : '';
                            
                            return (
                              <div key={idx} className="flex items-center gap-2 text-sm bg-blue-50 p-2 rounded">
                                <div className="flex-1">{match}</div>
                                {nomeCliente && nomeCliente !== 'N/A' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => mapearCliente(item.nome_planilha, nomeCliente)}
                                    disabled={mapeandoCliente === item.nome_planilha}
                                  >
                                    {mapeandoCliente === item.nome_planilha ? 'Mapeando...' : 'Mapear'}
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        ❌ Nenhum cliente similar encontrado no cadastro
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