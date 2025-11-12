import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export interface LoteStatus {
  numero: number;
  total: number;
  clientes: string[];
  status: 'aguardando' | 'processando' | 'concluido' | 'erro' | 'retry';
  tentativasRestantes?: number;
  erro?: string;
  tempoInicio?: number;
  tempoFim?: number;
  demonstrativosGerados?: number;
}

interface MonitoramentoLotesProps {
  lotes: LoteStatus[];
  tempoInicio: number;
  isProcessing: boolean;
}

export function MonitoramentoLotes({ lotes, tempoInicio, isProcessing }: MonitoramentoLotesProps) {
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  
  useEffect(() => {
    if (!isProcessing) return;
    
    const interval = setInterval(() => {
      setTempoDecorrido(Date.now() - tempoInicio);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tempoInicio, isProcessing]);
  
  const formatarTempo = (ms: number) => {
    const segundos = Math.floor(ms / 1000);
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}m ${segs}s`;
  };
  
  const getStatusIcon = (status: LoteStatus['status']) => {
    switch (status) {
      case 'aguardando':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'processando':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'retry':
        return <Loader2 className="w-4 h-4 text-warning animate-spin" />;
      case 'concluido':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'erro':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
  };
  
  const getStatusBadge = (status: LoteStatus['status'], tentativas?: number) => {
    switch (status) {
      case 'aguardando':
        return <Badge variant="secondary">Aguardando</Badge>;
      case 'processando':
        return <Badge variant="default">Processando</Badge>;
      case 'retry':
        return <Badge variant="outline" className="border-warning text-warning">Retry {tentativas ? `(${tentativas})` : ''}</Badge>;
      case 'concluido':
        return <Badge variant="outline" className="border-success text-success">Concluído</Badge>;
      case 'erro':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };
  
  const lotesProcessados = lotes.filter(l => l.status === 'concluido').length;
  const lotesErro = lotes.filter(l => l.status === 'erro').length;
  const lotesProcessando = lotes.filter(l => l.status === 'processando' || l.status === 'retry').length;
  const progressoGeral = lotes.length > 0 ? (lotesProcessados / lotes.length) * 100 : 0;
  
  const totalClientes = lotes.reduce((acc, lote) => acc + lote.clientes.length, 0);
  const clientesProcessados = lotes
    .filter(l => l.status === 'concluido')
    .reduce((acc, lote) => acc + lote.clientes.length, 0);
  
  const totalDemonstrativos = lotes
    .filter(l => l.status === 'concluido')
    .reduce((acc, lote) => acc + (lote.demonstrativosGerados || 0), 0);
  
  if (!isProcessing && lotes.length === 0) return null;
  
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Monitoramento em Tempo Real</span>
          <span className="text-sm font-normal text-muted-foreground">
            {formatarTempo(tempoDecorrido)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo Geral */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progresso Geral</span>
            <span className="text-muted-foreground">
              {lotesProcessados}/{lotes.length} lotes
            </span>
          </div>
          <Progress value={progressoGeral} className="h-2" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold">{clientesProcessados}/{totalClientes}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Demonstrativos</p>
              <p className="text-2xl font-bold text-success">{totalDemonstrativos}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Em Processamento</p>
              <p className="text-2xl font-bold text-primary">{lotesProcessando}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Com Erro</p>
              <p className="text-2xl font-bold text-destructive">{lotesErro}</p>
            </div>
          </div>
        </div>
        
        {/* Lista de Lotes */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          <h4 className="text-sm font-semibold text-foreground">Detalhes dos Lotes</h4>
          {lotes.map((lote) => (
            <div 
              key={lote.numero}
              className="border rounded-lg p-4 space-y-2 bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(lote.status)}
                  <span className="font-semibold">
                    Lote {lote.numero}/{lote.total}
                  </span>
                  {getStatusBadge(lote.status, lote.tentativasRestantes)}
                </div>
                <span className="text-xs text-muted-foreground">
                  {lote.clientes.length} cliente{lote.clientes.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              {/* Clientes do Lote */}
              <div className="flex flex-wrap gap-1">
                {lote.clientes.map((cliente, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className={`text-xs ${
                      lote.status === 'concluido' 
                        ? 'border-success/30 text-success' 
                        : lote.status === 'erro'
                        ? 'border-destructive/30 text-destructive'
                        : lote.status === 'processando' || lote.status === 'retry'
                        ? 'border-primary/30 text-primary'
                        : 'opacity-50'
                    }`}
                  >
                    {cliente}
                  </Badge>
                ))}
              </div>
              
              {/* Tempo de Processamento */}
              {lote.tempoInicio && (
                <div className="text-xs text-muted-foreground">
                  {lote.status === 'processando' || lote.status === 'retry' ? (
                    <span>Processando há {formatarTempo(Date.now() - lote.tempoInicio)}</span>
                  ) : lote.tempoFim ? (
                    <span>Processado em {formatarTempo(lote.tempoFim - lote.tempoInicio)}</span>
                  ) : null}
                </div>
              )}
              
              {/* Demonstrativos Gerados */}
              {lote.status === 'concluido' && lote.demonstrativosGerados !== undefined && (
                <div className="text-xs text-success flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{lote.demonstrativosGerados} demonstrativo{lote.demonstrativosGerados !== 1 ? 's' : ''} gerado{lote.demonstrativosGerados !== 1 ? 's' : ''}</span>
                </div>
              )}
              
              {/* Erro */}
              {lote.erro && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                  {lote.erro}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
