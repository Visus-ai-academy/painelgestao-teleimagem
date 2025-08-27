import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Info } from "lucide-react";

export function AutoAplicarRegrasRetroativas() {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-blue-600" />
          Aplicação Automática de Regras v002/v003
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-blue-600" />
            <div>
              <div className="font-medium">Sistema Configurado</div>
              <div className="text-sm text-muted-foreground">
                As regras v002/v003 são aplicadas automaticamente durante o upload de arquivos retroativos
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Automático
          </Badge>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          ✅ Não é necessário aplicar regras manualmente - o sistema faz isso automaticamente
        </div>
      </CardContent>
    </Card>
  );
}