import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticoResult {
  success: boolean;
  cliente: {
    id: string;
    nome: string;
    nome_fantasia: string;
    nome_mobilemed: string;
    ativo: boolean;
  };
  periodo: string;
  estatisticas: {
    total_volumetria: number;
    total_grupos_exames: number;
    total_precos_cliente: number;
    tem_parametros_faturamento: boolean;
  };
  parametros_faturamento: any;
  diagnostico_precos: Array<{
    combinacao: string;
    grupo: {
      modalidade: string;
      especialidade: string;
      categoria: string;
      prioridade: string;
      quantidade: number;
    };
    preco_exato: any;
    precos_sem_prioridade: any[];
    total_precos_modalidade_especialidade: number;
    precos_exemplo: any[];
  }>;
  resumo: {
    grupos_com_preco_exato: number;
    grupos_sem_preco: number;
    grupos_com_preco_alternativo: number;
  };
}

interface DiagnosticoPrecosFaturamentoProps {
  periodoReferencia?: string | null;
}

export const DiagnosticoPrecosFaturamento: React.FC<DiagnosticoPrecosFaturamentoProps> = ({ periodoReferencia }) => {
  const [clienteNome, setClienteNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DiagnosticoResult | null>(null);
  const { toast } = useToast();

  const executarDiagnostico = async () => {
    if (!clienteNome.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o nome do cliente",
        variant: "destructive"
      });
      return;
    }

    if (!periodoReferencia) {
      toast({
        title: "Período não selecionado",
        description: "Selecione o período de referência antes de diagnosticar",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnosticar-precos-faturamento', {
        body: { cliente_nome: clienteNome.trim(), periodo: periodoReferencia }
      });

      if (error) {
        throw error;
      }

      setResultado(data);
      toast({
        title: "Diagnóstico concluído",
        description: `Análise realizada para ${data.cliente.nome} - Período: ${periodoReferencia}`,
      });
    } catch (error: any) {
      console.error('Erro no diagnóstico:', error);
      toast({
        title: "Erro no diagnóstico",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testarClientes = (nome: string) => {
    if (!periodoReferencia) {
      toast({
        title: "Período não selecionado",
        description: "Selecione o período de referência antes de diagnosticar",
        variant: "destructive"
      });
      return;
    }
    setClienteNome(nome);
    setTimeout(() => executarDiagnostico(), 100);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Diagnóstico de Preços - Faturamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nome do cliente (ex: AKCPALMAS, SBAH, RADMED)"
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && executarDiagnostico()}
          />
          <Button onClick={executarDiagnostico} disabled={loading}>
            {loading ? 'Diagnosticando...' : 'Diagnosticar'}
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => testarClientes('AKCPALMAS')}>
            AKCPALMAS
          </Button>
          <Button variant="outline" size="sm" onClick={() => testarClientes('SBAH')}>
            SBAH
          </Button>
          <Button variant="outline" size="sm" onClick={() => testarClientes('RADMED')}>
            RADMED
          </Button>
          <Button variant="outline" size="sm" onClick={() => testarClientes('SROSALIA')}>
            SROSALIA
          </Button>
        </div>

        {resultado && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cliente: {resultado.cliente.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {resultado.estatisticas.total_volumetria}
                    </div>
                    <div className="text-sm text-gray-600">Registros Volumetria</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {resultado.estatisticas.total_grupos_exames}
                    </div>
                    <div className="text-sm text-gray-600">Grupos de Exames</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {resultado.estatisticas.total_precos_cliente}
                    </div>
                    <div className="text-sm text-gray-600">Preços Cadastrados</div>
                  </div>
                  <div className="text-center">
                    <Badge variant={resultado.estatisticas.tem_parametros_faturamento ? "default" : "destructive"}>
                      {resultado.estatisticas.tem_parametros_faturamento ? "Com Parâmetros" : "Sem Parâmetros"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-xl font-bold text-green-700">
                      {resultado.resumo.grupos_com_preco_exato}
                    </div>
                    <div className="text-sm text-green-600">Com Preço Exato</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded">
                    <div className="text-xl font-bold text-yellow-700">
                      {resultado.resumo.grupos_com_preco_alternativo}
                    </div>
                    <div className="text-sm text-yellow-600">Preço Alternativo</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <div className="text-xl font-bold text-red-700">
                      {resultado.resumo.grupos_sem_preco}
                    </div>
                    <div className="text-sm text-red-600">Sem Preço</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {resultado.diagnostico_precos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalhes por Grupo de Exames</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {resultado.diagnostico_precos.map((diag, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-sm">
                              {diag.grupo.modalidade} | {diag.grupo.especialidade} | {diag.grupo.categoria} | {diag.grupo.prioridade}
                            </div>
                            <div className="text-gray-600 text-sm">
                              Quantidade: {diag.grupo.quantidade}
                            </div>
                          </div>
                          <Badge 
                            variant={diag.preco_exato ? "default" : 
                                   diag.precos_sem_prioridade?.length > 0 ? "secondary" : "destructive"}
                          >
                            {diag.preco_exato ? "Preço OK" : 
                             diag.precos_sem_prioridade?.length > 0 ? "Alternativo" : "Sem Preço"}
                          </Badge>
                        </div>

                        {diag.preco_exato && (
                          <div className="bg-green-50 p-2 rounded text-sm">
                            <strong>Preço Exato:</strong> R$ {Number(diag.preco_exato.valor_base || 0).toFixed(2)}
                            {diag.preco_exato.valor_urgencia && (
                              <span> | Urgência: R$ {Number(diag.preco_exato.valor_urgencia).toFixed(2)}</span>
                            )}
                          </div>
                        )}

                        {!diag.preco_exato && diag.precos_sem_prioridade?.length > 0 && (
                          <div className="bg-yellow-50 p-2 rounded text-sm">
                            <strong>Preços Alternativos ({diag.precos_sem_prioridade.length}):</strong>
                            <ul className="mt-1">
                              {diag.precos_sem_prioridade.slice(0, 3).map((preco, i) => (
                                <li key={i}>
                                  {preco.prioridade}: R$ {Number(preco.valor_base || 0).toFixed(2)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {diag.total_precos_modalidade_especialidade > 0 && (
                          <div className="text-xs text-gray-500 mt-2">
                            {diag.total_precos_modalidade_especialidade} preços cadastrados para esta modalidade/especialidade
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};