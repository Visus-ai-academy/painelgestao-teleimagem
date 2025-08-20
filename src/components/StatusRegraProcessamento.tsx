import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface StatusRegra {
  id: string;
  nome: string;
  status: 'disponivel' | 'executando' | 'concluida' | 'erro';
  descricao: string;
  tempoExecucao?: number;
  resultados?: {
    total_processados?: number;
    total_atualizados?: number;
    mensagem?: string;
  };
  ultimaExecucao?: string;
}

export function StatusRegraProcessamento() {
  const [regras, setRegras] = useState<StatusRegra[]>([
    {
      id: 'aplicar-quebras-automatico',
      nome: 'Aplicar Quebras Automáticas',
      status: 'disponivel',
      descricao: 'Aplica regras de quebra de exames baseadas na tabela regras_quebra_exames'
    },
    {
      id: 'aplicar-regras-lote',
      nome: 'Aplicar Regras em Lote',
      status: 'disponivel',
      descricao: 'Aplica múltiplas regras de processamento em sequência otimizada'
    },
    {
      id: 'aplicar-regras-quebra-exames',
      nome: 'Aplicar Regras Quebra Exames',
      status: 'disponivel',
      descricao: 'Processa regras específicas de quebra de exames por arquivo'
    },
    {
      id: 'aplicar-regras-tratamento',
      nome: 'Aplicar Regras Tratamento',
      status: 'disponivel',
      descricao: 'Aplica regras de tratamento e normalização de dados'
    },
    {
      id: 'aplicar-tipificacao-faturamento',
      nome: 'Aplicar Tipificação Faturamento',
      status: 'disponivel',
      descricao: 'Define tipos de faturamento baseado em regras de negócio'
    },
    {
      id: 'aplicar-tipificacao-retroativa',
      nome: 'Aplicar Tipificação Retroativa',
      status: 'disponivel',
      descricao: 'Aplica tipificação em dados já processados'
    },
    {
      id: 'aplicar-validacao-cliente',
      nome: 'Aplicar Validação Cliente',
      status: 'disponivel',
      descricao: 'Valida existência e status ativo dos clientes na volumetria'
    },
    {
      id: 'aplicar-mapeamento-nome-cliente',
      nome: 'Mapeamento Nome Cliente (v035)',
      status: 'disponivel',
      descricao: 'Mapeia nome_mobilemed para nome_fantasia usando tabela clientes'
    },
    {
      id: 'aplicar-regra-colunas-musculo-neuro',
      nome: 'ColunasxMusculoxNeuro (v034)',
      status: 'disponivel',
      descricao: 'Converte especialidade "Colunas" para "Músculo Esquelético" ou "Neuro" baseado no médico'
    }
  ]);

  const executarRegra = async (regraId: string) => {
    try {
      // Atualizar status para executando
      setRegras(prev => prev.map(r => 
        r.id === regraId 
          ? { ...r, status: 'executando' as const, tempoExecucao: Date.now() }
          : r
      ));

      const inicioExecucao = Date.now();

      // Chamar a edge function correspondente
      const { data, error } = await supabase.functions.invoke(regraId, {
        body: { arquivo_fonte: 'TODOS' }
      });

      const tempoTotal = Date.now() - inicioExecucao;

      if (error) {
        throw error;
      }

      // Atualizar status para concluída
      setRegras(prev => prev.map(r => 
        r.id === regraId 
          ? { 
              ...r, 
              status: 'concluida' as const,
              tempoExecucao: tempoTotal,
              resultados: data,
              ultimaExecucao: new Date().toLocaleString()
            }
          : r
      ));

      toast({
        title: "Regra executada com sucesso",
        description: `${regras.find(r => r.id === regraId)?.nome} executada em ${Math.round(tempoTotal/1000)}s`,
        variant: "default",
      });

    } catch (error: any) {
      console.error(`Erro ao executar regra ${regraId}:`, error);
      
      // Atualizar status para erro
      setRegras(prev => prev.map(r => 
        r.id === regraId 
          ? { 
              ...r, 
              status: 'erro' as const,
              ultimaExecucao: new Date().toLocaleString()
            }
          : r
      ));

      toast({
        title: "Erro na execução",
        description: `Falha ao executar ${regras.find(r => r.id === regraId)?.nome}: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: StatusRegra['status']) => {
    switch (status) {
      case 'disponivel': return <Play className="h-4 w-4" />;
      case 'executando': return <Clock className="h-4 w-4 animate-spin" />;
      case 'concluida': return <CheckCircle className="h-4 w-4" />;
      case 'erro': return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: StatusRegra['status']) => {
    switch (status) {
      case 'disponivel': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'executando': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'concluida': return 'bg-green-100 text-green-800 border-green-200';
      case 'erro': return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const formatarTempo = (milliseconds: number) => {
    const segundos = Math.round(milliseconds / 1000);
    return segundos < 60 ? `${segundos}s` : `${Math.floor(segundos/60)}m${segundos%60}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Status de Processamento - Regras de Negócio
        </CardTitle>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Nova Regra Implementada:</strong> v035 - Mapeamento Nome Cliente (Mobilemed → Nome Fantasia)
            <br />
            <strong>Regra Removida:</strong> v015 - Normalização Nome Cliente (substituída pela v035)
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="space-y-4">
        {regras.map((regra) => (
          <Card key={regra.id} className="relative">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(regra.status)}
                  <h3 className="font-medium">{regra.nome}</h3>
                  <Badge variant="outline" className={getStatusColor(regra.status)}>
                    {regra.status}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => executarRegra(regra.id)}
                  disabled={regra.status === 'executando'}
                >
                  {regra.status === 'executando' ? 'Executando...' : 'Executar'}
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {regra.descricao}
              </p>

              {regra.ultimaExecucao && (
                <div className="text-xs text-muted-foreground">
                  <strong>Última execução:</strong> {regra.ultimaExecucao}
                  {regra.tempoExecucao && (
                    <span className="ml-2">
                      <strong>Tempo:</strong> {formatarTempo(regra.tempoExecucao)}
                    </span>
                  )}
                </div>
              )}

              {regra.resultados && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                  <strong>Resultados:</strong>
                  {regra.resultados.total_processados && (
                    <span className="ml-2">
                      Processados: {regra.resultados.total_processados}
                    </span>
                  )}
                  {regra.resultados.total_atualizados && (
                    <span className="ml-2">
                      Atualizados: {regra.resultados.total_atualizados}
                    </span>
                  )}
                  {regra.resultados.mensagem && (
                    <div className="mt-1">{regra.resultados.mensagem}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}