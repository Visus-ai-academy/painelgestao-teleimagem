import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calculator, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResultadoCenario {
  cenario: string;
  quantidade: number;
  preco_encontrado: boolean;
  preco_unitario: number;
  preco_total: number;
  volume_calculado?: number;
  condicao_volume?: string;
  faixa_volume?: string;
  valor_base?: number;
  valor_urgencia?: number;
  detalhes: string;
}

interface TesteResponse {
  sucesso: boolean;
  resumo: {
    cliente: {
      nome: string;
      nome_fantasia: string;
      nome_mobilemed: string;
    };
    total_precos_configurados: number;
    periodo_teste: string;
    cenarios_testados: number;
    valor_total_geral: number;
  };
  resultados: ResultadoCenario[];
  precos_configurados: any[];
}

export const TesteCenarioCBittencourt = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<TesteResponse | null>(null);

  const executarTeste = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('testar-cenario-cbittencourt');
      
      if (error) {
        console.error('Erro na função:', error);
        toast.error('Erro ao executar teste: ' + error.message);
        return;
      }

      if (!data.sucesso) {
        toast.error('Teste falhou: ' + data.erro);
        return;
      }

      setResultado(data);
      toast.success('Teste executado com sucesso!');
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro inesperado ao executar teste');
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Teste de Cenário - C.BITTENCOURT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este teste simula o cálculo de preços para o cliente C.BITTENCOURT com os seguintes exames:
            </p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• 75 exames RX/Medicina Interna/SC/Urgente</li>
              <li>• 150 exames RX/Medicina Interna/SC/Rotina</li>
              <li>• 25 exames RX/Medicina Interna/OIT/Rotina</li>
              <li>• 125 exames RX/Medicina Interna/OIT/Urgente</li>
            </ul>
            
            <Button 
              onClick={executarTeste} 
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Executar Teste de Preços
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <div className="space-y-4">
          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Teste</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium">Cliente</p>
                  <p className="text-sm text-muted-foreground">{resultado.resumo.cliente.nome}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Preços Configurados</p>
                  <p className="text-sm text-muted-foreground">{resultado.resumo.total_precos_configurados}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Período</p>
                  <p className="text-sm text-muted-foreground">{resultado.resumo.periodo_teste}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Valor Total</p>
                  <p className="text-sm font-semibold text-green-600">
                    {formatarValor(resultado.resumo.valor_total_geral)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultados por Cenário */}
          <div className="space-y-3">
            {resultado.resultados.map((cenario, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cenario.cenario}</CardTitle>
                    {cenario.preco_encontrado ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Preço Encontrado
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Sem Preço
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Quantidade</p>
                      <p className="text-muted-foreground">{cenario.quantidade} exames</p>
                    </div>
                    <div>
                      <p className="font-medium">Preço Unitário</p>
                      <p className="text-muted-foreground">{formatarValor(cenario.preco_unitario)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Preço Total</p>
                      <p className="font-semibold text-green-600">{formatarValor(cenario.preco_total)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Condição Volume</p>
                      <p className="text-muted-foreground">{cenario.condicao_volume || 'N/A'}</p>
                    </div>
                  </div>
                  
                  {cenario.preco_encontrado && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="font-medium">Volume Calculado</p>
                          <p>{cenario.volume_calculado} exames</p>
                        </div>
                        <div>
                          <p className="font-medium">Faixa de Volume</p>
                          <p>{cenario.faixa_volume}</p>
                        </div>
                        <div>
                          <p className="font-medium">Valores Configurados</p>
                          <p>Base: {formatarValor(cenario.valor_base || 0)}</p>
                          {cenario.valor_urgencia && (
                            <p>Urgência: {formatarValor(cenario.valor_urgencia)}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{cenario.detalhes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};