import React from 'react';

interface Contract {
  id: string;
  indexName: string;
  annualRate: number;
  amount: number;
  paidAmount: number;
  status: 'paid' | 'active' | 'pending';
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function ContractsTable() {
  // Example data to populate the table
  const contracts: Contract[] = [
    {
      id: '1',
      indexName: 'CDI',
      annualRate: 110,
      amount: 50000,
      paidAmount: 25000,
      status: 'active',
    },
    {
      id: '2',
      indexName: 'Prefixado',
      annualRate: 12.5,
      amount: 15000,
      paidAmount: 15000,
      status: 'paid',
    },
  ];

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="p-4 text-sm font-semibold text-slate-600">Taxa</th>
            <th className="p-4 text-sm font-semibold text-slate-600">Valor / Status</th>
            <th className="p-4 text-sm font-semibold text-slate-600">Total Estimado</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => {
            // Logic for totalAnnualRatePercent based on contract details
            // Assuming a base CDI of 11.25% for calculation if not fixed
            const currentCDI = 11.25;
            const totalAnnualRatePercent =
              contract.indexName === 'Prefixado'
                ? contract.annualRate
                : (contract.annualRate / 100) * currentCDI;

            return (
              <tr key={contract.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-slate-800">
                      {totalAnnualRatePercent.toFixed(2)}%
                    </span>{' '}
                    a.a.
                  </div>
                  <div className="text-xs text-slate-500">
                    {contract.indexName === 'Prefixado'
                      ? 'Taxa Fixa'
                      : `${contract.indexName} ${contract.annualRate}%`}
                  </div>
                </td>
                <td className="p-4 text-sm text-slate-600">
                  <div className="font-medium text-slate-700">
                    {formatCurrency(contract.amount)}
                  </div>

                  <div className="mt-2 min-w-[120px]">
                    <div className="flex justify-between items-center text-[10px] mb-1">
                      <span className="text-slate-400">Progresso</span>
                      <span
                        className={`font-bold ${
                          contract.status === 'paid'
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {(
                          (contract.paidAmount / Math.max(contract.amount, 1)) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          contract.status === 'paid'
                            ? 'bg-emerald-500'
                            : contract.paidAmount / contract.amount > 0.5
                            ? 'bg-emerald-400'
                            : 'bg-blue-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (contract.paidAmount / Math.max(contract.amount, 1)) *
                              100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    {contract.paidAmount > 0 && (
                      <div className="text-[10px] text-emerald-600 font-medium mt-1">
                        Pago: {formatCurrency(contract.paidAmount)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4 text-sm font-bold text-emerald-800 bg-emerald-50/50">
                   {formatCurrency(contract.amount * (1 + totalAnnualRatePercent / 100))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
