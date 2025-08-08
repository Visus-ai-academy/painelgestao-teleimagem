import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VolumetriaClientesComparison } from "@/components/volumetria/VolumetriaClientesComparison";

export default function Comparativo() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Comparativo de Clientes</h1>
        <p className="text-muted-foreground mt-1">Analise comparativa de volumetria por cliente.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo</CardTitle>
          <CardDescription>Compare clientes por período, modalidade e outros filtros.</CardDescription>
        </CardHeader>
        <CardContent>
          <VolumetriaClientesComparison />
        </CardContent>
      </Card>
    </div>
  );
}
