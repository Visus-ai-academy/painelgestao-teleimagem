import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import * as XLSX from "xlsx";

export type Divergencia = {
  tipo: 'missing_in_system' | 'missing_in_file' | 'total_mismatch';
  cliente: string;
  totalSistema?: number;
  totalArquivo?: number;
};

export type UploadedRow = {
  cliente: string;
  totalExames?: number;
  modalidade?: string;
  especialidade?: string;
  prioridade?: string;
  categoria?: string;
  exame?: string;
};

type Breakdown = Record<string, number>;

type ClienteAggregated = {
  cliente: string;
  total_exames: number;
  modalidades: Breakdown;
  especialidades: Breakdown;
  prioridades: Breakdown;
  categorias: Breakdown;
  exames: Breakdown;
};

function formatBreakdown(map: Breakdown, maxItems = 4) {
  const entries = Object.entries(map)
    .filter(([k]) => !!k)
    .sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, maxItems);
  const rest = entries.slice(maxItems).reduce((s, [, v]) => s + v, 0);
  const parts = top.map(([k, v]) => `${k}: ${v.toLocaleString()}`);
  if (rest > 0) parts.push(`+${rest.toLocaleString()} outros`);
  return parts.join(" • ");
}

export function VolumetriaClientesComparison({
  uploaded,
  onDivergencesComputed,
}: {
  uploaded?: UploadedRow[];
  onDivergencesComputed?: (divs: Divergencia[]) => void;
}) {
  const { data: context } = useVolumetria();
  const { toast } = useToast();
  const [filtro, setFiltro] = useState<'todos' | 'divergencias'>('todos');

  // Agregar dados do sistema (definitivos) a partir do contexto
  const sistemaClientes = useMemo<ClienteAggregated[]>(() => {
    try {
      // Priorizar estatísticas definitivas por cliente (100% do banco)
      const stats = (context as any)?.clientesStats || [];
      const map = new Map<string, ClienteAggregated>();

      // 1) Criar base com totais por cliente vindos do RPC completo
      (stats as any[]).forEach((s) => {
        const cliente = String(s.empresa || s.cliente || '').trim();
        if (!cliente) return;
        map.set(cliente.toLowerCase(), {
          cliente,
          total_exames: Number(s.total_laudos) || 0,
          modalidades: {},
          especialidades: {},
          prioridades: {},
          categorias: {},
          exames: {},
        });
      });

      // 2) Se houver dados detalhados, preencher apenas os detalhamentos
      if (context.detailedData && context.detailedData.length > 0) {
        (context.detailedData as any[]).forEach((item) => {
          const cliente = String(item.EMPRESA || '').trim();
          if (!cliente) return;
          const key = cliente.toLowerCase();
          if (!map.has(key)) {
            // Cliente não veio nas stats por algum motivo; cria com total 0
            map.set(key, {
              cliente,
              total_exames: 0,
              modalidades: {},
              especialidades: {},
              prioridades: {},
              categorias: {},
              exames: {},
            });
          }
          const ref = map.get(key)!;
          const anyItem: any = item;
          // Usar valor numérico real do registro detalhado quando disponível
          const inc = (Number(anyItem.VALORES ?? anyItem.VALOR ?? anyItem.QUANTIDADE ?? anyItem.QTD ?? anyItem.QTDE ?? 1) || 1);
          // Normalização de campos (maiúsculo/minúsculo) e sinônimos de modalidade
          let mod = String(anyItem.MODALIDADE ?? anyItem.modalidade ?? anyItem.Modalidade ?? '').trim();
          if (mod.toUpperCase() === 'CT') mod = 'TC';
          if (mod.toUpperCase() === 'MR') mod = 'RM';
          const esp = String(anyItem.ESPECIALIDADE ?? anyItem.especialidade ?? anyItem.Especialidade ?? '').trim();
          const pri = String(anyItem.PRIORIDADE ?? anyItem.prioridade ?? anyItem.Prioridade ?? '').trim();
          const cat = String(anyItem.CATEGORIA ?? anyItem.categoria ?? anyItem.Categoria ?? '').trim();
          const exame = String(anyItem.ESTUDO_DESCRICAO ?? anyItem.NOME_EXAME ?? anyItem.EXAME ?? anyItem.ESTUDO ?? anyItem.nome_exame ?? anyItem.Nome_Est ?? anyItem.nome_est ?? '').trim();
          if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + inc;
          if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + inc;
          if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + inc;
          if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + inc;
          if (exame) ref.exames[exame] = (ref.exames[exame] || 0) + inc;
        });
      }

      return Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
    } catch (e) {
      console.error('Erro ao agregar dados do sistema para comparativo:', e);
      toast({ title: 'Erro', description: 'Falha ao preparar dados do sistema.', variant: 'destructive' });
      return [];
    }
  }, [context.clientesStats, context.detailedData, toast]);

  // Agregar dados do arquivo (se houver)
  const arquivoClientes = useMemo<ClienteAggregated[] | null>(() => {
    if (!uploaded || uploaded.length === 0) return null;
    const agg = new Map<string, ClienteAggregated>();
    uploaded.forEach((row) => {
      const cliente = String(row.cliente || '').trim();
      if (!cliente) return;
      const val = Number(row.totalExames) || 0;
      if (!agg.has(cliente)) {
        agg.set(cliente, {
          cliente,
          total_exames: 0,
          modalidades: {},
          especialidades: {},
          prioridades: {},
          categorias: {},
          exames: {},
        });
      }
      const ref = agg.get(cliente)!;
      ref.total_exames += val;
      const mod = String(row.modalidade || '').trim();
      const esp = String(row.especialidade || '').trim();
      const pri = String(row.prioridade || '').trim();
      const cat = String(row.categoria || '').trim();
      const exame = String(row.exame || '').trim();
      if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + val;
      if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + val;
      if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + val;
      if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + val;
      if (exame) ref.exames[exame] = (ref.exames[exame] || 0) + val;
    });
    return Array.from(agg.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
  }, [uploaded]);

  const normalize = (s: string) => (s || '').toString().trim().toLowerCase();

  const uploadedMap = useMemo(() => {
    if (!arquivoClientes) return null;
    const map = new Map<string, ClienteAggregated>();
    arquivoClientes.forEach(u => map.set(normalize(u.cliente), u));
    return map;
  }, [arquivoClientes]);

  const sistemaMap = useMemo(() => {
    const map = new Map<string, ClienteAggregated>();
    sistemaClientes.forEach(c => map.set(normalize(c.cliente), c));
    return map;
  }, [sistemaClientes]);

  const divergencias = useMemo(() => {
    const list: Divergencia[] = [];
    if (!uploadedMap) return list;

    // faltando no arquivo e total mismatch
    sistemaClientes.forEach(c => {
      const key = normalize(c.cliente);
      const u = uploadedMap.get(key);
      if (!u) {
        list.push({ tipo: 'missing_in_file', cliente: c.cliente });
      } else if (typeof u.total_exames === 'number' && u.total_exames !== c.total_exames) {
        list.push({ tipo: 'total_mismatch', cliente: c.cliente, totalSistema: c.total_exames, totalArquivo: u.total_exames });
      }
    });

    // faltando no sistema
    if (uploadedMap) {
      uploadedMap.forEach((u, key) => {
        if (!sistemaMap.has(key)) {
          list.push({ tipo: 'missing_in_system', cliente: u.cliente, totalArquivo: u.total_exames });
        }
      });
    }

    return list;
  }, [uploadedMap, sistemaMap, sistemaClientes]);

  useEffect(() => {
    onDivergencesComputed?.(divergencias);
  }, [divergencias, onDivergencesComputed]);

  const divCounts = useMemo(() => {
    return {
      missingInFile: divergencias.filter(d => d.tipo === 'missing_in_file').length,
      missingInSystem: divergencias.filter(d => d.tipo === 'missing_in_system').length,
      totalMismatch: divergencias.filter(d => d.tipo === 'total_mismatch').length,
    };
  }, [divergencias]);

  const clientesExibidos = useMemo(() => {
    // Unir clientes do sistema e do arquivo (para exibir também os que existem só no upload)
    const map = new Map<string, ClienteAggregated>();
    sistemaClientes.forEach((c) => map.set(normalize(c.cliente), c));

    if (arquivoClientes) {
      arquivoClientes.forEach((u) => {
        const key = normalize(u.cliente);
        if (!map.has(key)) {
          map.set(key, {
            cliente: u.cliente,
            total_exames: 0,
            modalidades: {},
            especialidades: {},
            prioridades: {},
            categorias: {},
            exames: {},
          });
        }
      });
    }

    const union = Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));

    if (filtro === 'divergencias' && divergencias.length > 0) {
      const setDiv = new Set(divergencias.map((d) => normalize(d.cliente)));
      return union.filter((c) => setDiv.has(normalize(c.cliente)));
    }

    return union;
  }, [filtro, divergencias, sistemaClientes, arquivoClientes]);

  const handleExportList = () => {
    try {
      const rows: any[] = [];
      clientesExibidos.forEach((c) => {
        const up = uploadedMap?.get(normalize(c.cliente));
        rows.push({
          section: 'Cliente',
          cliente: c.cliente,
          total_sistema: c.total_exames,
          total_arquivo: up?.total_exames ?? 0,
        });
        const buildRows = (label: string, sys: Record<string, number>, upMap?: Record<string, number>) => {
          const keys = Array.from(new Set([
            ...Object.keys(sys || {}),
            ...(upMap ? Object.keys(upMap) : []),
          ])).sort();
          keys.forEach((k) => {
            rows.push({
              section: label,
              cliente: c.cliente,
              item: k,
              sist: (sys?.[k] || 0),
              arq: (upMap?.[k] || 0),
            });
          });
        };
        buildRows('Modalidade', c.modalidades, up?.modalidades);
        buildRows('Especialidade', c.especialidades, up?.especialidades);
        buildRows('Categoria', c.categorias, up?.categorias);
        buildRows('Prioridade', c.prioridades, up?.prioridades);
        buildRows('Exame', c.exames, up?.exames);
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'comparativo');
      XLSX.writeFile(wb, `comparativo_clientes_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      console.error('Erro ao exportar lista:', e);
      toast({ title: 'Erro', description: 'Falha ao exportar a lista.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Comparação Integral (Sistema x Arquivo)
        </CardTitle>
        {uploadedMap && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Divergências: no arquivo {divCounts.missingInFile}, no sistema {divCounts.missingInSystem}, total diferente {divCounts.totalMismatch}
            </span>
          </div>
        )}
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={handleExportList}>
            Exportar lista (Excel)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            variant={filtro === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('todos')}
          >
            Todos ({clientesExibidos.length})
          </Button>
          <Button
            variant={filtro === 'divergencias' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('divergencias')}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            Divergências ({divergencias.length})
          </Button>
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-auto">
          {clientesExibidos.map((c) => {
            const up = uploadedMap?.get(normalize(c.cliente));
            const mismatch = up && up.total_exames !== undefined && up.total_exames !== c.total_exames;
            return (
              <div key={c.cliente} className="p-3 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                  <div className="font-medium">{c.cliente}</div>
                  <div className="text-sm">
                    <Badge variant={mismatch ? 'destructive' : 'outline'}>Sistema: {c.total_exames.toLocaleString()}</Badge>
                  </div>
                  <div className="text-sm">
                    {uploadedMap ? (
                      <Badge variant={mismatch ? 'destructive' : 'secondary'}>
                        Arquivo: {up ? up.total_exames?.toLocaleString() : '—'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Arquivo: —</Badge>
                    )}
                  </div>
                </div>

                {/* Modalidades */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Modalidades</div>
                  {(() => {
                    const modKeys = Array.from(
                      new Set([
                        ...Object.keys(c.modalidades || {}),
                        ...(up?.modalidades ? Object.keys(up.modalidades) : []),
                      ])
                    ).sort();
                    return modKeys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {modKeys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.modalidades[k] || 0).toLocaleString()} • Arq: {(up?.modalidades?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Especialidades */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Especialidades</div>
                  {(() => {
                    const keys = Array.from(
                      new Set([
                        ...Object.keys(c.especialidades || {}),
                        ...(up?.especialidades ? Object.keys(up.especialidades) : []),
                      ])
                    ).sort();
                    return keys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {keys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.especialidades[k] || 0).toLocaleString()} • Arq: {(up?.especialidades?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Categorias */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Categorias</div>
                  {(() => {
                    const keys = Array.from(
                      new Set([
                        ...Object.keys(c.categorias || {}),
                        ...(up?.categorias ? Object.keys(up.categorias) : []),
                      ])
                    ).sort();
                    return keys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {keys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.categorias[k] || 0).toLocaleString()} • Arq: {(up?.categorias?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Prioridades */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Prioridades</div>
                  {(() => {
                    const keys = Array.from(
                      new Set([
                        ...Object.keys(c.prioridades || {}),
                        ...(up?.prioridades ? Object.keys(up.prioridades) : []),
                      ])
                    ).sort();
                    return keys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {keys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.prioridades[k] || 0).toLocaleString()} • Arq: {(up?.prioridades?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Exames */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Exames</div>
                  {(() => {
                    const exameKeys = Array.from(
                      new Set([
                        ...Object.keys(c.exames || {}),
                        ...(up?.exames ? Object.keys(up.exames) : []),
                      ])
                    ).sort();
                    return exameKeys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {exameKeys.map((k) => {
                          const s = c.exames[k] || 0;
                          const a = (up?.exames?.[k] || 0);
                          const delta = a - s;
                          return (
                            <li key={k} className="flex items-center justify-between text-sm">
                              <span className="text-foreground">{k}</span>
                              <span className="text-muted-foreground flex items-center gap-2">
                                <span>
                                  Sist: {s.toLocaleString()} • Arq: {a.toLocaleString()}
                                </span>
                                {delta !== 0 && (
                                  <Badge variant={delta > 0 ? 'destructive' : 'outline'}>
                                    Δ {delta > 0 ? '+' : ''}{delta}
                                  </Badge>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {clientesExibidos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cliente encontrado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
