import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MedicoComparativo {
  nome_volumetria: string | null;
  nome_cadastro: string | null;
  medico_cadastro_id: string | null;
  status_cadastro: boolean | null;
  nome_repasse: string | null;
  quantidade_exames_volumetria: number;
  quantidade_registros_repasse: number;
  status: 'ok' | 'divergente_volumetria' | 'divergente_repasse' | 'divergente_ambos';
  sugestoes_cadastro: Array<{ id: string; nome: string; similaridade: number }>;
}

interface ComparativoData {
  comparacoes: MedicoComparativo[];
  estatisticas: {
    total_cadastrados: number;
    total_divergencias: number;
    total_mapeados: number;
  };
}

export const ComparativoNomesMedicos = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ComparativoData | null>(null);
  const [mapeandoId, setMapeandoId] = useState<string | null>(null);
  const { toast } = useToast();

  const executarComparativo = async () => {
    try {
      setLoading(true);
      
      const { data: resultado, error } = await supabase.functions.invoke('comparar-nomes-medicos');

      if (error) throw error;

      console.log('Resultado completo:', resultado);

      // Se o formato esperado vier correto, usar direto
      if (resultado && resultado.comparacoes && resultado.estatisticas) {
        setData(resultado);
        toast({
          title: "Comparativo concluído",
          description: `${resultado.estatisticas?.total_divergencias || 0} divergências encontradas`,
        });
        return;
      }

      // Fallback: calcular o comparativo localmente se o formato não vier como esperado
      console.warn('Formato inesperado do comparativo. Calculando localmente...');

      // Helpers
      const normalizar = (s?: string | null) => (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu, '')
        .replace(/\bdr\.?\s*/gi, '')
        .replace(/\bdra\.?\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // 1) Médicos cadastrados
      const { data: medicosCad } = await supabase
        .from('medicos')
        .select('id, nome, ativo');
      const cadastrados = (medicosCad || []).map(m => ({
        id: m.id as string,
        nome: m.nome as string,
        ativo: m.ativo as boolean,
        nome_normalizado: normalizar(m.nome as string),
      }));

      // 2) Volumetria (médicos únicos e contagem)
      const { data: volu } = await supabase
        .from('volumetria_mobilemed')
        .select('MEDICO');
      const volumetriaMap = new Map<string, number>();
      (volu || []).forEach(v => {
        if (v.MEDICO) volumetriaMap.set(v.MEDICO, (volumetriaMap.get(v.MEDICO) || 0) + 1);
      });
      const volumetria = Array.from(volumetriaMap.entries()).map(([nome, qtd]) => ({
        nome_original: nome,
        nome_normalizado: normalizar(nome),
        quantidade_exames: qtd,
      }));

      // 3) Repasse (contagem por medico_id)
      const { data: rep } = await supabase
        .from('medicos_valores_repasse')
        .select('medico_id');
      const repasseMap = new Map<string, number>();
      (rep || []).forEach(r => {
        const key = r.medico_id || 'SEM_MEDICO';
        repasseMap.set(key, (repasseMap.get(key) || 0) + 1);
      });

      // Nomes dos médicos com repasse
      const ids = Array.from(repasseMap.keys()).filter(k => k !== 'SEM_MEDICO');
      let medicosRepasseMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: medRep } = await supabase.from('medicos').select('id, nome').in('id', ids);
        medicosRepasseMap = new Map((medRep || []).map(m => [m.id as string, m.nome as string]));
      }

      // 4) Montar comparações
      const comparacoesMap = new Map<string, any>();
      // Base cadastrados
      cadastrados.forEach(c => {
        comparacoesMap.set(c.nome_normalizado, {
          nome_volumetria: null,
          nome_cadastro: c.nome,
          medico_cadastro_id: c.id,
          status_cadastro: c.ativo,
          nome_repasse: null,
          quantidade_exames_volumetria: 0,
          quantidade_registros_repasse: 0,
          status: 'ok',
          sugestoes_cadastro: [] as any[],
        });
      });

      // Volumetria
      volumetria.forEach(v => {
        const cad = cadastrados.find(c => c.nome_normalizado === v.nome_normalizado);
        if (cad) {
          const comp = comparacoesMap.get(cad.nome_normalizado);
          comp.nome_volumetria = v.nome_original;
          comp.quantidade_exames_volumetria = v.quantidade_exames;
          if (v.nome_original !== cad.nome) comp.status = comp.status === 'divergente_repasse' ? 'divergente_ambos' : 'divergente_volumetria';
        } else {
          comparacoesMap.set(v.nome_original, {
            nome_volumetria: v.nome_original,
            nome_cadastro: null,
            medico_cadastro_id: null,
            status_cadastro: null,
            nome_repasse: null,
            quantidade_exames_volumetria: v.quantidade_exames,
            quantidade_registros_repasse: 0,
            status: 'divergente_volumetria',
            sugestoes_cadastro: [],
          });
        }
      });

      // Repasse
      repasseMap.forEach((qtd, key) => {
        if (key !== 'SEM_MEDICO') {
          const nome = medicosRepasseMap.get(key) || null;
          const cad = cadastrados.find(c => c.id === key);
          if (cad) {
            const comp = comparacoesMap.get(cad.nome_normalizado);
            comp.nome_repasse = nome;
            comp.quantidade_registros_repasse = qtd;
            if (nome && nome !== cad.nome) comp.status = comp.status === 'divergente_volumetria' ? 'divergente_ambos' : 'divergente_repasse';
          }
        } else {
          const nomeRepasse = 'SEM MÉDICO';
          if (!comparacoesMap.has(nomeRepasse)) {
            comparacoesMap.set(nomeRepasse, {
              nome_volumetria: null,
              nome_cadastro: null,
              medico_cadastro_id: null,
              status_cadastro: null,
              nome_repasse: nomeRepasse,
              quantidade_exames_volumetria: 0,
              quantidade_registros_repasse: qtd,
              status: 'divergente_repasse',
              sugestoes_cadastro: [],
            });
          }
        }
      });

      const comparacoes = Array.from(comparacoesMap.values()).sort((a, b) => {
        if (a.status !== 'ok' && b.status === 'ok') return -1;
        if (a.status === 'ok' && b.status !== 'ok') return 1;
        return b.quantidade_exames_volumetria - a.quantidade_exames_volumetria;
      });

      const estatisticas = {
        total_cadastrados: cadastrados.length,
        total_divergencias: comparacoes.filter(c => c.status !== 'ok').length,
        total_mapeados: comparacoes.filter(c => c.status === 'ok' && (c.quantidade_exames_volumetria > 0 || c.quantidade_registros_repasse > 0)).length,
      };

      const resultadoLocal = { comparacoes, estatisticas };
      setData(resultadoLocal);
      toast({
        title: 'Comparativo concluído (local)',
        description: `${estatisticas.total_divergencias} divergências encontradas`,
      });
    } catch (error: any) {
      console.error('Erro ao executar comparativo:', error);
      toast({
        title: 'Erro ao executar comparativo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const mapearNome = async (nomeOrigem: string, origem: 'volumetria' | 'repasse', medicoId: string) => {
    try {
      setMapeandoId(nomeOrigem);

      const { error } = await supabase.functions.invoke('mapear-nome-medico', {
        body: {
          nome_origem: nomeOrigem,
          origem,
          medico_id: medicoId,
        },
      });

      if (error) throw error;

      toast({
        title: "Mapeamento criado",
        description: `Nome "${nomeOrigem}" mapeado com sucesso`,
      });

      // Recarregar comparativo
      await executarComparativo();
    } catch (error: any) {
      console.error('Erro ao mapear nome:', error);
      toast({
        title: "Erro ao mapear nome",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setMapeandoId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      ok: <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>,
      divergente_volumetria: <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Volumetria</Badge>,
      divergente_repasse: <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Repasse</Badge>,
      divergente_ambos: <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Ambos</Badge>,
    };
    return badges[status as keyof typeof badges] || <Badge>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Comparativo de Nomes de Médicos
        </CardTitle>
        <CardDescription>
          Compare e normalize os nomes de médicos entre Volumetria, Cadastro e Repasse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Button onClick={executarComparativo} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Executar Comparativo
          </Button>

          {data && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500">{data.estatisticas.total_mapeados}</Badge>
                <span className="text-muted-foreground">Mapeados</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{data.estatisticas.total_divergencias}</Badge>
                <span className="text-muted-foreground">Divergências</span>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {data && data.comparacoes && data.comparacoes.length > 0 && (
          <div className="border rounded-lg">
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Como funciona:</strong> O sistema identifica automaticamente divergências entre os nomes usados 
                na Volumetria/Repasse e o cadastro de médicos. Use os botões "Mapear" para normalizar os nomes divergentes. 
                Uma vez mapeados, os demonstrativos de pagamento médico utilizarão automaticamente os nomes normalizados.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Nome Volumetria</TableHead>
                  <TableHead className="bg-primary/5">Nome Cadastro (Referência)</TableHead>
                  <TableHead className="w-[120px]">Status Cadastro</TableHead>
                  <TableHead>Nome Repasse</TableHead>
                  <TableHead className="w-[100px] text-center">Vol.</TableHead>
                  <TableHead className="w-[100px] text-center">Rep.</TableHead>
                  <TableHead className="w-[200px] text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.comparacoes.map((comp, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{getStatusBadge(comp.status)}</TableCell>
                    <TableCell>
                      {comp.nome_volumetria ? (
                        <span className="font-medium">{comp.nome_volumetria}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="bg-primary/5">
                      {comp.nome_cadastro ? (
                        <span className="font-bold">{comp.nome_cadastro}</span>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-muted-foreground text-sm">Não cadastrado</span>
                          {comp.sugestoes_cadastro.length > 0 && (
                            <Select
                              onValueChange={(value) => {
                                const origem = comp.nome_volumetria ? 'volumetria' : 'repasse';
                                const nomeOrigem = comp.nome_volumetria || comp.nome_repasse || '';
                                mapearNome(nomeOrigem, origem, value);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione o médico..." />
                              </SelectTrigger>
                              <SelectContent>
                                {comp.sugestoes_cadastro.map((sug) => (
                                  <SelectItem key={sug.id} value={sug.id}>
                                    {sug.nome} ({Math.round(sug.similaridade * 100)}%)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.status_cadastro === null ? (
                        <Badge variant="outline">Não cadastrado</Badge>
                      ) : comp.status_cadastro ? (
                        <Badge variant="default" className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="destructive">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.nome_repasse ? (
                        <span className="font-medium">{comp.nome_repasse}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {comp.quantidade_exames_volumetria > 0 ? (
                        <Badge variant="outline">{comp.quantidade_exames_volumetria}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {comp.quantidade_registros_repasse > 0 ? (
                        <Badge variant="outline">{comp.quantidade_registros_repasse}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {comp.status !== 'ok' && comp.medico_cadastro_id && (
                        <div className="flex flex-col gap-2">
                          {comp.nome_volumetria && comp.nome_volumetria !== comp.nome_cadastro && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mapeandoId === comp.nome_volumetria}
                              onClick={() => mapearNome(comp.nome_volumetria!, 'volumetria', comp.medico_cadastro_id!)}
                            >
                              {mapeandoId === comp.nome_volumetria ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  Vol <ArrowRight className="h-3 w-3 mx-1" /> Cad
                                </>
                              )}
                            </Button>
                          )}
                          {comp.nome_repasse && comp.nome_repasse !== comp.nome_cadastro && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mapeandoId === comp.nome_repasse}
                              onClick={() => mapearNome(comp.nome_repasse!, 'repasse', comp.medico_cadastro_id!)}
                            >
                              {mapeandoId === comp.nome_repasse ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  Rep <ArrowRight className="h-3 w-3 mx-1" /> Cad
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
