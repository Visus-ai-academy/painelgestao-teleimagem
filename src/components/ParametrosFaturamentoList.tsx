import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  portal_laudos: boolean;
  incluir_medico_solicitante: boolean;
  incluir_access_number: boolean;
  incluir_empresa_origem: boolean;
  tipo_desconto_acrescimo: string | null;
  desconto_acrescimo: number | null;
  impostos_ab_min: string | null;
  simples: boolean;
  percentual_iss: number | null;
  data_inicio_integracao: string | null;
  tipo_metrica_convenio: string | null;
  tipo_metrica_urgencia: string | null;
  cobrar_urgencia_como_rotina: boolean;
  cliente_consolidado: string | null;
  clientes?: {
    nome: string;
    nome_fantasia?: string;
  };
}

export function ParametrosFaturamentoList() {
  const [parametros, setParametros] = useState<any[]>([]);
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

  const formatCurrency = (value: number | null) => {
    return value ? `R$ ${value.toFixed(2)}` : '-';
  };

  const formatBoolean = (value: boolean) => {
    return value ? 'Sim' : 'Não';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === '1970-01-01') return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parâmetros de Faturamento Cadastrados ({parametros.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Franquia</TableHead>
                <TableHead>Valor Franquia</TableHead>
                <TableHead>Volume Franquia</TableHead>
                <TableHead>Valor Acima</TableHead>
                <TableHead>Integração</TableHead>
                <TableHead>Valor Integração</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>% Urgência</TableHead>
                <TableHead>Reajuste</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Portal Laudos</TableHead>
                <TableHead>Médico Solicitante</TableHead>
                <TableHead>Access Number</TableHead>
                <TableHead>Empresa Origem</TableHead>
                <TableHead>Tipo Desconto</TableHead>
                <TableHead>Desconto/Acréscimo</TableHead>
                <TableHead>Impostos AbMin</TableHead>
                <TableHead>Simples</TableHead>
                <TableHead>% ISS</TableHead>
                <TableHead>Data Início Integração</TableHead>
                <TableHead>Métrica Convênio</TableHead>
                <TableHead>Métrica Urgência</TableHead>
                <TableHead>Urgência como Rotina</TableHead>
                <TableHead>Cliente Consolidado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parametros.map((parametro) => (
                <TableRow key={parametro.id}>
                  <TableCell className="font-medium">
                    {parametro.clientes?.nome_fantasia || parametro.clientes?.nome || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{parametro.tipo_cliente}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={parametro.ativo ? "default" : "secondary"}>
                      {parametro.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatBoolean(parametro.aplicar_franquia)}</TableCell>
                  <TableCell>{formatCurrency(parametro.valor_franquia)}</TableCell>
                  <TableCell>{parametro.volume_franquia || '-'}</TableCell>
                  <TableCell>{formatCurrency(parametro.valor_acima_franquia)}</TableCell>
                  <TableCell>{formatBoolean(parametro.cobrar_integracao)}</TableCell>
                  <TableCell>{formatCurrency(parametro.valor_integracao)}</TableCell>
                  <TableCell>{formatBoolean(parametro.aplicar_adicional_urgencia)}</TableCell>
                  <TableCell>{parametro.percentual_urgencia ? `${parametro.percentual_urgencia}%` : '-'}</TableCell>
                  <TableCell>{parametro.indice_reajuste}</TableCell>
                  <TableCell>{parametro.periodicidade_reajuste}</TableCell>
                  <TableCell>{formatBoolean(parametro.portal_laudos)}</TableCell>
                  <TableCell>{formatBoolean(parametro.incluir_medico_solicitante)}</TableCell>
                  <TableCell>{formatBoolean(parametro.incluir_access_number)}</TableCell>
                  <TableCell>{formatBoolean(parametro.incluir_empresa_origem)}</TableCell>
                  <TableCell>{parametro.tipo_desconto_acrescimo || '-'}</TableCell>
                  <TableCell>{parametro.desconto_acrescimo ? `${parametro.desconto_acrescimo}%` : '-'}</TableCell>
                  <TableCell>{parametro.impostos_ab_min || '-'}</TableCell>
                  <TableCell>{formatBoolean(parametro.simples)}</TableCell>
                  <TableCell>{parametro.percentual_iss ? `${parametro.percentual_iss}%` : '-'}</TableCell>
                  <TableCell>{formatDate(parametro.data_inicio_integracao)}</TableCell>
                  <TableCell>{parametro.tipo_metrica_convenio || '-'}</TableCell>
                  <TableCell>{parametro.tipo_metrica_urgencia || '-'}</TableCell>
                  <TableCell>{formatBoolean(parametro.cobrar_urgencia_como_rotina)}</TableCell>
                  <TableCell>{parametro.cliente_consolidado || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}