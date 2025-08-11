import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVolumetria } from "@/contexts/VolumetriaContext";

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
};

type Breakdown = Record<string, number>;

type ClienteAggregated = {
  cliente: string;
  total_exames: number;
  modalidades: Breakdown;
  especialidades: Breakdown;
  prioridades: Breakdown;
  categorias: Breakdown;
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
      const agg = new Map<string, ClienteAggregated>();
      (context.detailedData || []).forEach((item: any) => {
        const cliente = String(item.EMPRESA || '').trim();
        if (!cliente) return;
        const val = Number(item.VALORES) || 0;
        if (!agg.has(cliente)) {
          agg.set(cliente, {
            cliente,
            total_exames: 0,
            modalidades: {},
            especialidades: {},
            prioridades: {},
            categorias: {},
          });
        }
        const ref = agg.get(cliente)!;
        ref.total_exames += val;
        const mod = String(item.MODALIDADE || '').trim();
        const esp = String(item.ESPECIALIDADE || '').trim();
        const pri = String(item.PRIORIDADE || '').trim();
        const cat = String(item.CATEGORIA || '').trim();
        if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + val;
        if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + val;
        if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + val;
        if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + val;
      });
      return Array.from(agg.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
    } catch (e) {
      console.error('Erro ao agregar dados do sistema para comparativo:', e);
      toast({ title: 'Erro', description: 'Falha ao preparar dados do sistema.', variant: 'destructive' });
      return [];
    }
  }, [context.detailedData, toast]);

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
        });
      }
      const ref = agg.get(cliente)!;
      ref.total_exames += val;
      const mod = String(row.modalidade || '').trim();
      const esp = String(row.especialidade || '').trim();
      const pri = String(row.prioridade || '').trim();
      const cat = String(row.categoria || '').trim();
      if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + val;
      if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + val;
      if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + val;
      if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + val;
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
    if (filtro === 'divergencias' && divergencias.length > 0) {
      const setDiv = new Set(divergencias.map(d => normalize(d.cliente)));
      return sistemaClientes.filter(c => setDiv.has(normalize(c.cliente)));
    }
    return sistemaClientes;
  }, [filtro, divergencias, sistemaClientes]);

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
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            variant={filtro === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('todos')}
          >
            Todos ({sistemaClientes.length})
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
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {c.cliente}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant={mismatch ? 'destructive' : 'outline'}>
                      Sistema: {c.total_exames.toLocaleString()}
                    </Badge>
                    {uploadedMap && (
                      <Badge variant={mismatch ? 'destructive' : 'secondary'}>
                        Arquivo: {up ? up.total_exames.toLocaleString() : '—'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-2 text-sm text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground">Modalidades</div>
                    <div>{formatBreakdown(c.modalidades) || '—'}</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Especialidades</div>
                    <div>{formatBreakdown(c.especialidades) || '—'}</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Prioridades</div>
                    <div>{formatBreakdown(c.prioridades) || '—'}</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Categorias</div>
                    <div>{formatBreakdown(c.categorias) || '—'}</div>
                  </div>
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
