import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticoResult {
  success: boolean;
  cliente_pesquisado: string;
  total_registros_encontrados: number;
  diagnostico: any[];
  teste_calculo_preco: any;
  resumo: any;
}

export const DiagnosticoClientePrecos = () => {
  const [clienteNome, setClienteNome] = useState('INTERCOR');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DiagnosticoResult | null>(null);

  const executarDiagnostico = async () => {
    if (!clienteNome.trim()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnostico-cliente-precos', {
        body: { cliente_nome: clienteNome.trim() }
      });

      if (error) {
        console.error('Erro na função:', error);
        return;
      }

      setResultado(data);
      console.log('📊 Resultado do diagnóstico:', data);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Diagnóstico de Cliente - Preços</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome do cliente (ex: INTERCOR)"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
            />
            <Button onClick={executarDiagnostico} disabled={loading}>
              {loading ? 'Diagnosticando...' : 'Diagnosticar'}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setClienteNome('INTERCOR')}
            >
              INTERCOR
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setClienteNome('MEDCENTER_PI')}
            >
              MEDCENTER_PI
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setClienteNome('VIVERCLIN')}
            >
              VIVERCLIN
            </Button>
          </div>

          {resultado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{resultado.total_registros_encontrados}</div>
                  <div className="text-sm text-muted-foreground">Registros Encontrados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{resultado.resumo?.registros_com_precos}</div>
                  <div className="text-sm text-muted-foreground">Com Preços</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{resultado.resumo?.registros_sem_precos}</div>
                  <div className="text-sm text-muted-foreground">Sem Preços</div>
                </div>
                <div className="text-center">
                  <Badge variant={resultado.teste_calculo_preco?.preco_retornado > 0 ? 'default' : 'destructive'}>
                    {resultado.teste_calculo_preco?.preco_retornado > 0 ? 'Preço OK' : 'Preço Zero'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Registros por Cliente:</h4>
                {resultado.diagnostico?.map((diag, idx) => (
                  <div key={idx} className="border rounded p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-sm text-muted-foreground">
                          ID: {diag.cliente_info.id}
                        </div>
                        <div className="font-semibold">{diag.cliente_info.nome}</div>
                        {diag.cliente_info.nome_fantasia && (
                          <div className="text-sm">Fantasia: {diag.cliente_info.nome_fantasia}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant={diag.precos_encontrados > 0 ? 'default' : 'secondary'}>
                          {diag.precos_encontrados} preços
                        </Badge>
                        <div className="text-xs mt-1">
                          {diag.seria_escolhido_antes && <div className="text-red-600">❌ Era usado antes</div>}
                          {diag.sera_escolhido_agora && <div className="text-green-600">✅ Será usado agora</div>}
                        </div>
                      </div>
                    </div>
                    
                    {diag.precos_exemplos?.length > 0 && (
                      <div className="text-sm">
                        <strong>Exemplos de preços:</strong>
                        {diag.precos_exemplos.map((preco: any, i: number) => (
                          <div key={i} className="ml-2">
                            • {preco.modalidade}/{preco.especialidade}/{preco.categoria} = R$ {preco.valor_base}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {resultado.teste_calculo_preco && (
                <div className="border rounded p-3">
                  <h4 className="font-semibold mb-2">Teste de Cálculo de Preço:</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Cliente ID:</strong> {resultado.teste_calculo_preco.parametros.cliente_id}</div>
                    <div><strong>Combinação:</strong> {resultado.teste_calculo_preco.parametros.modalidade}/{resultado.teste_calculo_preco.parametros.especialidade}/{resultado.teste_calculo_preco.parametros.categoria}</div>
                    <div><strong>Preço Retornado:</strong> R$ {resultado.teste_calculo_preco.preco_retornado || 'NULL'}</div>
                    {resultado.teste_calculo_preco.erro && (
                      <div className="text-red-600"><strong>Erro:</strong> {resultado.teste_calculo_preco.erro}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};