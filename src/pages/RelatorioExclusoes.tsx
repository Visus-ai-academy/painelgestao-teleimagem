import React from 'react';
import { RelatorioExclusoes as RelatorioExclusoesComponent } from '@/components/RelatorioExclusoes';
import { Header } from '@/components/Header';

export default function RelatorioExclusoes() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 p-6 bg-gradient-to-br from-slate-50 to-cyan-50 dark:from-slate-900 dark:to-cyan-950">
        <RelatorioExclusoesComponent />
      </div>
    </div>
  );
}