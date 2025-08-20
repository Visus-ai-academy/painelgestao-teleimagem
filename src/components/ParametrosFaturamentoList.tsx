import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ParametroFaturamento {
  id: string;
  cliente_id: string;
  tipo_cliente: string;
  valor_integracao: number | null;
  cobrar_integracao: boolean;
  percentual_urgencia: number | null;
  aplicar_adicional_urgencia: boolean;
  valor_franquia: number | null;
  volume_franquia: number | null;
  frequencia_continua: boolean;
  frequencia_por_volume: boolean;
  valor_acima_franquia: number | null;
  aplicar_franquia: boolean;
  data_aniversario_contrato: string | null;
  periodicidade_reajuste: string;
  indice_reajuste: string;
  percentual_reajuste_fixo: number | null;
  ativo: boolean;
  clientes?: {
    nome: string;
    nome_fantasia?: string;
  };
}

export function ParametrosFaturamentoList() {
  const [parametros, setParametros] = useState<ParametroFaturamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParametros = async () => {
      try {
        const { data, error } = await supabase
          .from('parametros_faturamento')
          .select(`
            *,
            clientes (
              nome,
              nome_fantasia
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setParametros(data || []);
      } catch (error) {
        console.error('Erro ao carregar parâmetros:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchParametros();
  }, []);

  if (loading) {
    return <div className="text-center py-4">Carregando parâmetros...</div>;
  }

  if (parametros.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Nenhum parâmetro de faturamento encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {parametros.map((parametro) => (
        <Card key={parametro.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{parametro.clientes?.nome_fantasia || parametro.clientes?.nome}</span>
              <div className="flex gap-2">
                <Badge variant={parametro.ativo ? "default" : "secondary"}>
                  {parametro.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <Badge variant="outline">{parametro.tipo_cliente}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {parametro.aplicar_franquia && (
                <>
                  <div>
                    <span className="font-medium">Valor Franquia:</span>
                    <p>R$ {parametro.valor_franquia?.toFixed(2) || '0,00'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Volume Franquia:</span>
                    <p>{parametro.volume_franquia || '-'}</p>
                  </div>
                </>
              )}
              {parametro.cobrar_integracao && (
                <div>
                  <span className="font-medium">Valor Integração:</span>
                  <p>R$ {parametro.valor_integracao?.toFixed(2) || '0,00'}</p>
                </div>
              )}
              {parametro.aplicar_adicional_urgencia && (
                <div>
                  <span className="font-medium">% Urgência:</span>
                  <p>{parametro.percentual_urgencia || 0}%</p>
                </div>
              )}
              <div>
                <span className="font-medium">Reajuste:</span>
                <p>{parametro.indice_reajuste} ({parametro.periodicidade_reajuste})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}