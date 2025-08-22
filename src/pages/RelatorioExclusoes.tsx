import React from 'react';
import { RelatorioExclusoes as RelatorioExclusoesComponent } from '@/components/RelatorioExclusoes';
import { TesteLogging } from '@/components/TesteLogging';
import { TesteExclusoes } from '@/components/TesteExclusoes';
import { Header } from '@/components/Header';

export default function RelatorioExclusoes() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 p-6 bg-gradient-to-br from-slate-50 to-cyan-50 dark:from-slate-900 dark:to-cyan-950">
        <div className="space-y-6">
          <RelatorioExclusoesComponent />
          
          {/* Componente de Diagnóstico do Sistema */}
          <div className="border-t pt-6 space-y-6">
            <h2 className="text-xl font-semibold mb-4">🔧 Diagnóstico do Sistema</h2>
            
            {/* Teste do Sistema de Exclusões */}
            <TesteExclusoes />
            
            {/* Teste de Logging */}
            <TesteLogging />
          </div>
        </div>
      </div>
    </div>
  );
}