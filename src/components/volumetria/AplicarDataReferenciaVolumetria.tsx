import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, CheckCircle, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PeriodoFaturamento {
  ano: number;
  mes: number;
}

/**
 * Componente para aplicar a Regra v024 - Definição Data Referência
 * Permite corrigir data_referencia e periodo_referencia de dados já existentes
 */
export function AplicarDataReferenciaVolumetria() {
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoFaturamento | null>(null);
  const [arquivoFonte, setArquivoFonte] = useState<string>('');
  const [aplicarTodos, setAplicarTodos] = useState(false);
  const { toast } = useToast();

  // Gerar anos e meses para seleção
  const anos = Array.from({ length: 10 }, (_, i) => 2020 + i);
  const meses = [
    { valor: 1, nome: 'Janeiro' },
    { valor: 2, nome: 'Fevereiro' },
    { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' },
    { valor: 5, nome: 'Maio' },
    { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' },
    { valor: 8, nome: 'Agosto' },
    { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' },
    { valor: 11, nome: 'Novembro' },
    { valor: 12, nome: 'Dezembro' }
  ];

  const arquivosFonte = [
    'volumetria_padrao',
    'volumetria_fora_padrao', 
    'volumetria_padrao_retroativo',
    'volumetria_fora_padrao_retroativo',
    'volumetria_onco_padrao',
    'data_laudo',
    'data_exame'
  ];

  const aplicarRegra = async () => {
    if (!periodo || !periodo.ano || !periodo.mes) {
      toast({
        title: "Erro",
        description: "Selecione o ano e mês para aplicar a regra",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      let resultado;

      if (aplicarTodos) {
        // Aplicar via função SQL para todos os registros
        const { data, error } = await supabase.rpc('aplicar_data_referencia_por_periodo', {
          p_ano: periodo.ano,
          p_mes: periodo.mes
        });

        if (error) throw error;
        resultado = data;
      } else {
        // Aplicar via Edge Function com filtros específicos
        const { data, error } = await supabase.functions.invoke('set-data-referencia-volumetria', {
          body: {
            periodo_faturamento: periodo,
            arquivo_fonte: arquivoFonte || null,
            aplicar_todos: false
          }
        });

        if (error) throw error;
        resultado = data;
      }

      if (resultado.sucesso) {
        toast({
          title: "Regra v024 aplicada com sucesso!",
          description: `${resultado.registros_atualizados} registros atualizados para período ${resultado.periodo_referencia}`,
        });
      } else {
        throw new Error(resultado.erro || 'Erro desconhecido');
      }

    } catch (error) {
      console.error('Erro ao aplicar regra:', error);
      toast({
        title: "Erro",
        description: `Erro ao aplicar regra: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarPeriodo = (p: PeriodoFaturamento): string => {
    const mesNomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${mesNomes[p.mes - 1]}/${String(p.ano).slice(-2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Aplicar Regra v024 - Definição Data Referência
        </CardTitle>
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Regra v024:</p>
            <p>Define <code>data_referencia</code> e <code>periodo_referencia</code> baseados no período de processamento escolhido, independente das datas originais de realização/laudo dos exames.</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Seleção de Período */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ano de Referência</Label>
            <Select 
              value={periodo?.ano?.toString() || ''} 
              onValueChange={(value) => setPeriodo(prev => ({ ...prev, ano: parseInt(value) } as PeriodoFaturamento))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Mês de Referência</Label>
            <Select 
              value={periodo?.mes?.toString() || ''} 
              onValueChange={(value) => setPeriodo(prev => ({ ...prev, mes: parseInt(value) } as PeriodoFaturamento))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(mes => (
                  <SelectItem key={mes.valor} value={mes.valor.toString()}>{mes.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview do Período */}
        {periodo && periodo.ano && periodo.mes && (
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Período que será aplicado:</strong> {formatarPeriodo(periodo)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              data_referencia: {periodo.ano}-{String(periodo.mes).padStart(2, '0')}-01
            </p>
          </div>
        )}

        {/* Opções de Aplicação */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="aplicar-especifico"
              name="aplicacao"
              checked={!aplicarTodos}
              onChange={() => setAplicarTodos(false)}
            />
            <Label htmlFor="aplicar-especifico">Aplicar apenas a arquivo específico</Label>
          </div>
          
          {!aplicarTodos && (
            <div className="ml-6 space-y-2">
              <Label>Arquivo Fonte</Label>
              <Select value={arquivoFonte} onValueChange={setArquivoFonte}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o arquivo fonte" />
                </SelectTrigger>
                <SelectContent>
                  {arquivosFonte.map(fonte => (
                    <SelectItem key={fonte} value={fonte}>{fonte}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="aplicar-todos"
              name="aplicacao"
              checked={aplicarTodos}
              onChange={() => setAplicarTodos(true)}
            />
            <Label htmlFor="aplicar-todos">Aplicar a TODOS os registros da volumetria</Label>
            <Badge variant="destructive" className="text-xs">Cuidado</Badge>
          </div>
        </div>

        {/* Botão de Aplicação */}
        <div className="flex justify-end">
          <Button 
            onClick={aplicarRegra}
            disabled={loading || !periodo?.ano || !periodo?.mes || (!aplicarTodos && !arquivoFonte)}
            className="flex items-center gap-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {loading ? 'Aplicando...' : 'Aplicar Regra v024'}
          </Button>
        </div>

        {/* Aviso */}
        <div className="p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Importante:</p>
              <p>Esta operação irá atualizar os campos <code>data_referencia</code> e <code>periodo_referencia</code> dos registros selecionados. A operação é auditada e pode ser visualizada nos logs do sistema.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}