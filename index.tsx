import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Plus, Trash2, Edit2, CheckCircle, AlertCircle, TrendingUp, DollarSign, 
  PieChart as PieIcon, FileText, BrainCircuit, X, Save, Calendar, Landmark,
  Search, Filter, RefreshCw, ArrowUpRight, Info, ChevronDown, ChevronUp, Clock, Calculator, Wallet, Bell, FilePenLine, CalendarDays, Loader2, FileUp, CheckCheck, AlertTriangle, Percent, Download
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://ndpgfoxycavzhqlwdrvw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dPcP59CFidQ5Ha5hTwwXHA_nLvc5b8p';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Constants & Market Data Simulation ---
const MARKET_RATES = {
    'CDI': 10.40,  // Estimativa anual
    'SELIC': 10.50,
    'IPCA': 4.50,
    'IGPM': 4.00,
    'TR': 0.00,
    'PREFIXADO': 0.00
};

// --- Types ---

type ContractStatus = 'pending' | 'paid' | 'partial';
type CapitalizationPeriod = 'daily' | 'monthly' | 'semiannual' | 'annual';
type InterestMethod = 'compound' | 'simple';

interface Payment {
  id: string;
  date: string;
  amount: number;
  notes?: string;
  contract_id?: string;
}

interface Contract {
  id: string;
  bank: string;
  contractNumber: string;
  description: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  payments?: Payment[];
  indexName: string; 
  annualRate: number; // Spread ou Taxa Fixa
  capitalizationPeriod: CapitalizationPeriod;
  status: ContractStatus;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
};

const getIndexRate = (indexName: string): number => {
    if (indexName.includes('CDI')) return MARKET_RATES.CDI;
    if (indexName.includes('Selic')) return MARKET_RATES.SELIC;
    if (indexName.includes('IPCA')) return MARKET_RATES.IPCA;
    if (indexName.includes('IGPM')) return MARKET_RATES.IGPM;
    return 0;
};

// Helper para categorizar operação baseado na descrição
const getOperationCategory = (description: string): string => {
    const lower = description.toLowerCase();
    if (lower.includes('custeio')) return 'Custeio';
    if (lower.includes('maquinário') || lower.includes('maquinario') || lower.includes('trator') || lower.includes('colheitadeira') || lower.includes('veículo')) return 'Maquinário';
    if (lower.includes('solo') || lower.includes('recuperação') || lower.includes('correção')) return 'Recuperação de Solo';
    if (lower.includes('giro')) return 'Capital de Giro';
    if (lower.includes('galpão') || lower.includes('silo') || lower.includes('armazém') || lower.includes('construção') || lower.includes('expansão') || lower.includes('benfeitoria')) return 'Infraestrutura';
    if (lower.includes('investimento')) return 'Investimento';
    return 'Outros';
};

// --- Helper: Date Normalization to avoid Timezone/Time of Day floating point errors ---
const toMidnightUTC = (dateInput: string | Date | number): number => {
    const d = new Date(dateInput);
    // Cria uma data UTC zerada (meio-dia UTC para evitar problemas de DST)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0);
};

// --- Financial Core Logic ---
const calculateProjection = (contract: Contract, interestMethod: InterestMethod = 'compound') => {
    const estimatedIndexRate = getIndexRate(contract.indexName);
    const totalAnnualRatePercent = estimatedIndexRate + contract.annualRate;
    const totalAnnualRateDecimal = totalAnnualRatePercent / 100;

    // Normalize issue date to Midnight UTC
    const issueDateStr = contract.issueDate;
    if (!issueDateStr) {
        return { 
            projectedTotal: contract.amount, 
            currentDebt: contract.amount, 
            interestAccrued: 0,
            daysElapsed: 0,
            totalAnnualRatePercent,
            estimatedIndexRate
        };
    }
    
    const issueDateUTC = toMidnightUTC(issueDateStr);
    const todayUTC = toMidnightUTC(new Date());

    // Taxa Diária (Daily Rate) - Base 365
    // Composto: (1 + i_ano)^(1/365) - 1
    // Simples: i_ano / 365
    const dailyRateCompound = Math.pow(1 + totalAnnualRateDecimal, 1 / 365) - 1;
    const dailyRateSimple = totalAnnualRateDecimal / 365;
    
    // Sort payments chronologically
    const sortedPayments = [...(contract.payments || [])].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let currentBalance = contract.amount;
    let lastDateUTC = issueDateUTC;
    let totalPaidNominal = 0;

    // Process payments (Amortization timeline)
    for (const payment of sortedPayments) {
        const payDateUTC = toMidnightUTC(payment.date);
        
        // Skip invalid dates or payments before issue (sanity check)
        if (payDateUTC < issueDateUTC) continue;
        
        // Calculate INTEGER days between events
        const msPerDay = 1000 * 3600 * 24;
        const daysBetween = Math.max(0, Math.floor((payDateUTC - lastDateUTC) / msPerDay));
        
        // Apply Interest for the period
        if (currentBalance > 0 && daysBetween > 0) {
            if (interestMethod === 'compound') {
                const factor = Math.pow(1 + dailyRateCompound, daysBetween);
                currentBalance = currentBalance * factor;
            } else {
                currentBalance = currentBalance * (1 + (dailyRateSimple * daysBetween));
            }
        }

        // Subtract Payment
        currentBalance -= payment.amount;
        if (currentBalance < 0) currentBalance = 0; // Prevent negative debt (overpaid)

        totalPaidNominal += payment.amount;
        lastDateUTC = payDateUTC;
    }

    // Apply Interest from Last Event (Payment or Issue) to Today
    const msPerDay = 1000 * 3600 * 24;
    const daysToNow = Math.max(0, Math.floor((todayUTC - lastDateUTC) / msPerDay));
    
    // Only apply interest if debt remains
    if (currentBalance > 0 && daysToNow > 0) {
         if (interestMethod === 'compound') {
            const factor = Math.pow(1 + dailyRateCompound, daysToNow);
            currentBalance = currentBalance * factor;
        } else {
            currentBalance = currentBalance * (1 + (dailyRateSimple * daysToNow));
        }
    }

    // Theoretical Projected Total (If no payments were made)
    const totalDays = Math.max(0, Math.floor((todayUTC - issueDateUTC) / msPerDay));
    let projectedTotalNoPayments = contract.amount;
    if (interestMethod === 'compound') {
         projectedTotalNoPayments = contract.amount * Math.pow(1 + dailyRateCompound, totalDays);
    } else {
         projectedTotalNoPayments = contract.amount * (1 + (dailyRateSimple * totalDays));
    }

    return {
        projectedTotal: projectedTotalNoPayments,
        currentDebt: currentBalance,
        interestAccrued: Math.max(0, currentBalance - (contract.amount - totalPaidNominal)), // Approximation of interest component
        daysElapsed: totalDays,
        totalAnnualRatePercent,
        estimatedIndexRate,
        dailyRateUsed: interestMethod === 'compound' ? dailyRateCompound : dailyRateSimple
    };
};

// --- Components ---

const StatCard = ({ title, value, icon: Icon, colorClass, subtext, highlight = false }: any) => (
  <div className={`p-6 rounded-xl shadow-sm border transition-all ${highlight ? 'bg-gradient-to-br from-white to-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
    <div className="flex justify-between items-start">
      <div>
        <p className={`text-sm font-medium ${highlight ? 'text-emerald-700' : 'text-slate-500'}`}>{title}</p>
        <h3 className={`text-2xl font-bold mt-2 ${highlight ? 'text-emerald-900' : 'text-slate-800'}`}>{value}</h3>
        {subtext && <p className={`text-xs mt-1 ${highlight ? 'text-emerald-600' : 'text-slate-400'}`}>{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const FilterBar = ({ 
    filters, 
    setFilters, 
    banks,
    operationTypes,
    interestMethod,
    setInterestMethod
}: { 
    filters: any, 
    setFilters: any, 
    banks: string[],
    operationTypes: string[],
    interestMethod: InterestMethod,
    setInterestMethod: (m: InterestMethod) => void
}) => {
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col xl:flex-row gap-4 items-start xl:items-center">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 w-full items-center">
                 {/* Interest Toggle */}
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 col-span-1 md:col-span-2 lg:col-span-1 justify-center">
                    <button
                        onClick={() => setInterestMethod('compound')}
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${interestMethod === 'compound' ? 'bg-white text-emerald-700 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Juros Compostos (Padrão de Mercado)"
                    >
                        <TrendingUp size={14} /> Comp.
                    </button>
                    <button
                        onClick={() => setInterestMethod('simple')}
                        className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${interestMethod === 'simple' ? 'bg-white text-blue-700 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                         title="Juros Simples (Linear)"
                    >
                        <Percent size={14} /> Simp.
                    </button>
                </div>

                <div className="relative w-full lg:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar contrato..." 
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        value={filters.search}
                        onChange={(e) => setFilters({...filters, search: e.target.value})}
                    />
                </div>

                <select 
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700"
                    value={filters.operationType}
                    onChange={(e) => setFilters({...filters, operationType: e.target.value})}
                >
                    <option value="all">Tipos (Todos)</option>
                    {operationTypes.map(op => <option key={op} value={op}>{op}</option>)}
                </select>

                <select 
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700"
                    value={filters.bank}
                    onChange={(e) => setFilters({...filters, bank: e.target.value})}
                >
                    <option value="all">Bancos (Todos)</option>
                    {banks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>

                <div className="flex gap-2">
                    <select 
                        className="w-full py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700"
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                    >
                        <option value="all">Status</option>
                        <option value="pending">Pendente</option>
                        <option value="partial">Parcial</option>
                        <option value="paid">Pago</option>
                        <option value="overdue">Vencido</option>
                    </select>

                    <button 
                        onClick={() => setFilters({ search: '', bank: 'all', status: 'all', operationType: 'all', dateStart: '', dateEnd: '' })}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex-shrink-0"
                        title="Limpar Filtros"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>
        </div>
    )
}

const ContractModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData,
  isSaving 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (c: Partial<Contract>) => void; 
  initialData?: Contract | null;
  isSaving: boolean;
}) => {
  const [formData, setFormData] = useState<Partial<Contract>>({
    bank: '', contractNumber: '', description: '', issueDate: '', dueDate: '', 
    amount: 0, paidAmount: 0, payments: [], indexName: 'Prefixado', annualRate: 0, status: 'pending', capitalizationPeriod: 'monthly'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
          ...initialData,
          issueDate: initialData.issueDate ? initialData.issueDate.split('T')[0] : '',
          dueDate: initialData.dueDate ? initialData.dueDate.split('T')[0] : '',
          capitalizationPeriod: 'monthly' // Default internal, not displayed
      });
    } else {
      setFormData({
        bank: '', contractNumber: '', description: '', issueDate: '', dueDate: '', 
        amount: 0, paidAmount: 0, payments: [], indexName: 'Prefixado', annualRate: 0, status: 'pending', capitalizationPeriod: 'monthly'
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const estimatedIndex = getIndexRate(formData.indexName || 'Prefixado');
  const totalEstimatedRate = estimatedIndex + (formData.annualRate || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-slate-800">
            {initialData ? 'Editar Contrato' : 'Novo Contrato'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Instituição Bancária</label>
            <input 
              required
              type="text" 
              className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={formData.bank}
              onChange={e => setFormData({...formData, bank: e.target.value})}
              placeholder="Ex: Banco do Brasil"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nº Contrato</label>
            <input 
              required
              type="text" 
              className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={formData.contractNumber}
              onChange={e => setFormData({...formData, contractNumber: e.target.value})}
              placeholder="Ex: 12345-X"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição / Finalidade</label>
            <input 
              required
              type="text" 
              className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Ex: Custeio Pecuária"
            />
          </div>
          
          <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h3 className="col-span-2 text-sm font-semibold text-slate-800 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-600"/> Valores e Datas
            </h3>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Original (Principal)</label>
                <input 
                required
                type="number" 
                step="0.01"
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Valor Já Pago (Automático)</label>
                <input 
                type="number" 
                disabled
                className="w-full rounded-lg border-slate-200 border p-2 bg-slate-100 text-slate-500"
                value={formData.paidAmount}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Emissão (Contratação)</label>
                <input 
                required
                type="date" 
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                value={formData.issueDate}
                onChange={e => setFormData({...formData, issueDate: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Vencimento</label>
                <input 
                required
                type="date" 
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
                />
            </div>
          </div>

          <div className="col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
             <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-emerald-600"/> Taxas e Indexadores
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Índice Base</label>
                    <select 
                        required
                        className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        value={formData.indexName}
                        onChange={e => setFormData({...formData, indexName: e.target.value})}
                    >
                        <option value="Prefixado">Prefixado (Sem Índice)</option>
                        <option value="CDI +">CDI +</option>
                        <option value="IPCA +">IPCA +</option>
                        <option value="IGPM +">IGPM +</option>
                        <option value="Selic +">Selic +</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {formData.indexName === 'Prefixado' ? 'Taxa Anual Fixa (%)' : 'Spread / Sobretaxa (%)'}
                    </label>
                    <div className="relative">
                        <input 
                        type="number" 
                        step="0.01"
                        className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-8"
                        value={formData.annualRate}
                        onChange={e => setFormData({...formData, annualRate: Number(e.target.value)})}
                        placeholder={formData.indexName === 'Prefixado' ? "Ex: 12.0" : "Ex: 3.5"}
                        />
                        <span className="absolute right-3 top-2 text-slate-400 text-sm">%</span>
                    </div>
                </div>
                
                <div className="col-span-2 mt-2 bg-blue-50 p-3 rounded border border-blue-100 text-xs text-blue-800">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">Simulação de Taxa Efetiva:</span>
                        <span className="font-bold text-sm">{totalEstimatedRate.toFixed(2)}% a.a.</span>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-blue-600/80">
                        <span>Capitalização para cálculos:</span>
                        <span>Diária (Padrão Bancário)</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select 
              required
              className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as ContractStatus})}
            >
              <option value="pending">Pendente</option>
              <option value="partial">Parcial</option>
              <option value="paid">Pago</option>
            </select>
          </div>

          <div className="col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar Contrato
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PaymentModal = ({ isOpen, onClose, onConfirm, contract, isProcessing, initialAmount, interestMethod }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: (amount: number, date: string, notes: string) => void;
    contract: Contract | null;
    isProcessing: boolean;
    initialAmount?: number;
    interestMethod: InterestMethod;
}) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            setAmount(initialAmount !== undefined ? initialAmount.toFixed(2) : '');
            setDate(new Date().toISOString().split('T')[0]); 
            setNotes('');
        }
    }, [isOpen, initialAmount]);
    
    if (!isOpen || !contract) return null;

    const { currentDebt } = calculateProjection(contract, interestMethod);
    const payValue = Number(amount);
    const remainingAfterPay = Math.max(0, currentDebt - payValue);
    
    const handleFullPayment = () => {
        setAmount(currentDebt.toFixed(2));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (payValue <= 0) return;
        onConfirm(payValue, date, notes);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
                    <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                        <Wallet size={20} /> Lançar Pagamento
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <p className="text-sm text-slate-500 mb-1">Contrato</p>
                        <p className="font-medium text-slate-800">{contract.bank} - {contract.contractNumber}</p>
                        <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-sm text-slate-500">Saldo Devedor Atual ({interestMethod === 'compound' ? 'Composto' : 'Simples'}):</span>
                            <span className="font-bold text-red-600">{formatCurrency(currentDebt)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Data do Pagamento</label>
                            <input 
                                type="date"
                                required
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                            <input 
                                autoFocus
                                type="number" 
                                step="0.01"
                                min="0.01"
                                max={currentDebt + 1}
                                required
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-800"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <button 
                            type="button" 
                            onClick={handleFullPayment}
                            className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1"
                        >
                            <CheckCircle size={12}/> Preencher com saldo total ({formatCurrency(currentDebt)})
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Observações (Opcional)</label>
                        <div className="relative">
                            <div className="absolute top-3 left-3 text-slate-400">
                                <FilePenLine size={16}/>
                            </div>
                            <textarea
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                                rows={2}
                                placeholder="Ex: Amortização parcial safra soja..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {payValue > 0 && (
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg text-sm">
                            <span className="text-blue-700">Novo Saldo Estimado:</span>
                            <span className="font-bold text-blue-800">{formatCurrency(remainingAfterPay)}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} disabled={isProcessing} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2">
                           {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />} Confirmar Lançamento
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AIAdvisor = ({ contracts, interestMethod }: { contracts: Contract[], interestMethod: InterestMethod }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAnalysis = async () => {
    if (!process.env.API_KEY) {
      setError('Chave de API não configurada.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const dataSummary = contracts.map(c => {
          const { currentDebt } = calculateProjection(c, interestMethod);
          return {
            bank: c.bank,
            desc: c.description,
            original: c.amount,
            projectedDebt: currentDebt.toFixed(2),
            due: c.dueDate,
            status: c.status,
            index: `${c.indexName} ${c.annualRate}%`
          };
      });

      const prompt = `
        Você é um consultor financeiro especializado em agronegócio para a Fazenda Bom Sossego.
        Analise a seguinte lista de Cédulas Rurais e dívidas bancárias, considerando os valores projetados utilizando o método de juros ${interestMethod === 'compound' ? 'Compostos' : 'Simples'}.
        
        Dados: ${JSON.stringify(dataSummary)}

        Forneça um relatório conciso em formato Markdown:
        1. **Resumo da Situação**: Exposição total (Valor Projetado) e saúde financeira imediata.
        2. **Alerta de Riscos**: Identifique vencimentos próximos (próximos 3 meses) ou concentrações perigosas.
        3. **Análise de Juros**: Comente se há contratos com taxas muito elevadas que deveriam ser priorizados.
        4. **Estratégia Sugerida**: Plano de ação.
        
        Seja direto, profissional e encorajador.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAnalysis(response.text || 'Não foi possível gerar a análise.');
    } catch (err) {
      setError('Erro ao conectar com a IA. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="text-indigo-600" /> Consultor IA
          </h2>
          <p className="text-sm text-slate-500 mt-1">Análise inteligente do seu endividamento com Gemini</p>
        </div>
        <button 
          onClick={runAnalysis} 
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Analisando...' : 'Gerar Análise'}
        </button>
      </div>
      
      <div className="p-6">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle size={20} /> {error}
          </div>
        )}
        
        {!analysis && !loading && !error && (
          <div className="text-center py-12 text-slate-400">
            <BrainCircuit size={48} className="mx-auto mb-4 opacity-20" />
            <p>Clique em "Gerar Análise" para receber insights sobre suas dívidas atualizadas.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
            <div className="h-4 bg-slate-100 rounded w-1/2"></div>
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-32 bg-slate-100 rounded w-full"></div>
          </div>
        )}

        {analysis && (
          <div className="prose prose-slate max-w-none">
            <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [importing, setImporting] = useState(false);
  
  // Interest Calculation Method State
  const [interestMethod, setInterestMethod] = useState<InterestMethod>('compound');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    search: '',
    bank: 'all',
    status: 'all',
    operationType: 'all',
    dateStart: '',
    dateEnd: ''
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'contracts' | 'ai'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentContract, setPaymentContract] = useState<Contract | null>(null);
  const [paymentInitialAmount, setPaymentInitialAmount] = useState<number | undefined>(undefined);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'warning' | 'info' | 'error' | 'success'} | null>(null);

  // --- Fetch Data from Supabase ---
  const fetchContracts = async () => {
      try {
          setLoadingData(true);
          const { data, error } = await supabase
            .from('contracts')
            .select('*, payments(*)')
            .order('created_at', { ascending: false });
          
          if (error) throw error;

          if (data) {
              // Mapeia snake_case do banco para camelCase da aplicação
              const formattedContracts: Contract[] = data.map((c: any) => {
                  const payments = c.payments ? c.payments.map((p: any) => ({
                      id: p.id,
                      date: p.date,
                      amount: Number(p.amount),
                      notes: p.notes,
                      contract_id: p.contract_id
                  })) : [];

                  // Calcula o total pago baseado na tabela de pagamentos
                  const totalPaid = payments.reduce((acc: number, p: Payment) => acc + p.amount, 0);
                  
                  // Atualiza o status dinamicamente
                  let derivedStatus = c.status;
                  if (c.status !== 'paid' && totalPaid > 0) derivedStatus = 'partial';
                  if (c.status === 'pending' && totalPaid > 0) derivedStatus = 'partial';

                  return {
                      id: c.id,
                      bank: c.bank,
                      contractNumber: c.contract_number,
                      description: c.description,
                      issueDate: c.issue_date,
                      dueDate: c.due_date,
                      amount: Number(c.amount),
                      paidAmount: totalPaid,
                      payments: payments,
                      indexName: c.index_name,
                      annualRate: Number(c.annual_rate),
                      capitalizationPeriod: c.capitalization_period || 'monthly',
                      status: derivedStatus as ContractStatus
                  };
              });
              setContracts(formattedContracts);
          }
      } catch (err: any) {
          console.error("Error fetching data:", err);
          setNotification({ message: `Erro ao carregar dados: ${err.message || 'Falha de conexão'}`, type: 'error' });
      } finally {
          setLoadingData(false);
      }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  // Check for upcoming dues based on newly fetched data
  useEffect(() => {
    if (contracts.length === 0) return;
    
    const urgentContracts = contracts.filter(c => {
        if (c.status === 'paid') return false;
        const today = new Date();
        const due = new Date(c.dueDate);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
    });

    if (urgentContracts.length > 0) {
        setNotification({
            message: `Atenção: Você tem ${urgentContracts.length} contrato(s) vencendo nos próximos 30 dias.`,
            type: 'warning'
        });
        const timer = setTimeout(() => setNotification(null), 8000);
        return () => clearTimeout(timer);
    }
  }, [contracts]);

  // Derived Data with Filters & Projection
  const filteredContracts = useMemo(() => {
      return contracts.filter(c => {
          // Status Logic (including Overdue)
          const isOverdue = c.status !== 'paid' && new Date(c.dueDate) < new Date();
          let statusMatch = true;
          if (filters.status === 'overdue') statusMatch = isOverdue;
          else if (filters.status !== 'all') statusMatch = c.status === filters.status;

          // Bank Logic
          const bankMatch = filters.bank === 'all' || c.bank === filters.bank;

          // Search Logic
          const searchLower = filters.search.toLowerCase();
          const searchMatch = c.bank.toLowerCase().includes(searchLower) || 
                              c.description.toLowerCase().includes(searchLower) ||
                              c.contractNumber.toLowerCase().includes(searchLower);

          // Date Filter Logic (Checks Due Date)
          let dateMatch = true;
          const dueDate = new Date(c.dueDate);
          if (filters.dateStart) {
              dateMatch = dateMatch && dueDate >= new Date(filters.dateStart);
          }
          if (filters.dateEnd) {
              dateMatch = dateMatch && dueDate <= new Date(filters.dateEnd);
          }
          
          // Operation Type Logic
          const category = getOperationCategory(c.description);
          const opTypeMatch = filters.operationType === 'all' || category === filters.operationType;
          
          return statusMatch && bankMatch && searchMatch && dateMatch && opTypeMatch;
      });
  }, [contracts, filters]);

  const uniqueBanks = useMemo(() => [...new Set(contracts.map(c => c.bank))], [contracts]);
  
  const uniqueOperationTypes = useMemo(() => {
      const types = new Set(contracts.map(c => getOperationCategory(c.description)));
      return Array.from(types).sort();
  }, [contracts]);

  const metrics = useMemo(() => {
    const totalOriginalDebt = filteredContracts.reduce((acc, c) => acc + c.amount, 0);
    const totalPaid = filteredContracts.reduce((acc, c) => acc + c.paidAmount, 0);
    
    // Calculate Projected Totals
    let totalProjectedPending = 0;
    
    filteredContracts.forEach(c => {
        const { currentDebt } = calculateProjection(c, interestMethod);
        totalProjectedPending += currentDebt;
    });
    
    // Sort by due date to find next
    const pendingContracts = filteredContracts
      .filter(c => c.status !== 'paid' && new Date(c.dueDate) >= new Date())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    const nextDue = pendingContracts.length > 0 ? pendingContracts[0] : null;

    return { totalOriginalDebt, totalPaid, totalProjectedPending, nextDue };
  }, [filteredContracts, interestMethod]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const months: Record<string, number> = {};
    filteredContracts.forEach(c => {
      if (c.status === 'paid') return;
      const { currentDebt } = calculateProjection(c, interestMethod);
      const date = new Date(c.dueDate);
      const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
      months[key] = (months[key] || 0) + currentDebt;
    });
    
    const projectionData = Object.entries(months)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => {
            const [mA, yA] = a.name.split('/').map(Number);
            const [mB, yB] = b.name.split('/').map(Number);
            return new Date(yA, mA).getTime() - new Date(yB, mB).getTime();
        });

    const bankDist: Record<string, number> = {};
    filteredContracts.forEach(c => {
      const { currentDebt } = calculateProjection(c, interestMethod);
      if (currentDebt > 0) {
        bankDist[c.bank] = (bankDist[c.bank] || 0) + currentDebt;
      }
    });
    const pieData = Object.entries(bankDist).map(([name, value]) => ({ name, value }));

    return { projectionData, pieData };
  }, [filteredContracts, interestMethod]);

  // --- Handlers (CRUD) ---

  const handleDownloadTemplate = () => {
    const headers = "Banco;Numero do Contrato;Descricao;Data Emissao;Data Vencimento;Valor Original;Taxa Anual;Indice;Status";
    const example = "Banco do Brasil;123456;Custeio Soja;01/01/2023;01/01/2024;100000,00;12,5;Prefixado;Pendente";
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_importacao_contratos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) {
             setImporting(false);
             return;
        }

        const lines = text.split('\n');
        let successCount = 0;
        let errors = [];

        // Ignora cabeçalho
        const dataRows = lines.slice(1);

        for (const row of dataRows) {
            if (!row.trim()) continue;
            
            // Tenta detectar separador (; ou ,)
            const separator = row.includes(';') ? ';' : ',';
            const cols = row.split(separator).map(c => c.trim().replace(/"/g, ''));
            
            // Validação simples de colunas
            if (cols.length < 5) continue; 

            try {
                // Parse Data (Assumindo formato CSV comum em PT-BR: DD/MM/YYYY e 1.000,00)
                const bank = cols[0] || 'Desconhecido';
                const contractNum = cols[1] || 'S/N';
                const desc = cols[2] || 'Importado';
                
                // Parse Dates
                let issueDate = '';
                if (cols[3] && cols[3].includes('/')) {
                   const [d, m, y] = cols[3].split('/');
                   issueDate = `${y}-${m}-${d}`;
                } else {
                   issueDate = new Date().toISOString().split('T')[0];
                }

                let dueDate = '';
                if (cols[4] && cols[4].includes('/')) {
                   const [d, m, y] = cols[4].split('/');
                   dueDate = `${y}-${m}-${d}`;
                } else {
                   dueDate = new Date().toISOString().split('T')[0];
                }

                // Parse Value (remove . e troca , por .)
                const valStr = cols[5] ? cols[5].replace(/\./g, '').replace(',', '.') : '0';
                const amount = parseFloat(valStr);
                
                // Parse Rate
                const rateStr = cols[6] ? cols[6].replace(',', '.') : '0';
                const annualRate = parseFloat(rateStr);

                const indexName = cols[7] || 'Prefixado';
                const statusStr = cols[8]?.toLowerCase() || 'pending';
                let status = 'pending';
                if (statusStr.includes('pago') || statusStr.includes('quitado')) status = 'paid';
                else if (statusStr.includes('parcial')) status = 'partial';

                // Insert Contract
                const contractPayload = {
                    bank: bank,
                    contract_number: contractNum,
                    description: desc,
                    issue_date: issueDate,
                    due_date: dueDate,
                    amount: amount,
                    index_name: indexName,
                    annual_rate: annualRate,
                    status: status
                };

                const { data: contractData, error: insertError } = await supabase
                    .from('contracts')
                    .insert([contractPayload])
                    .select();

                if (insertError) throw insertError;

                 // Se status for PAGO, cria um pagamento dummy para zerar a conta
                if (status === 'paid' && contractData && contractData[0]) {
                     await supabase.from('payments').insert([{
                        contract_id: contractData[0].id,
                        amount: amount,
                        date: dueDate,
                        notes: 'Importado como QUITADO via planilha'
                    }]);
                }

                successCount++;

            } catch (err: any) {
                console.error("Row import error:", row, err);
                errors.push(`Linha ${row.substring(0, 15)}...: ${err.message}`);
            }
        }

        if (successCount > 0) {
            setNotification({ message: `${successCount} contratos importados com sucesso!`, type: 'success' });
            await fetchContracts();
        } else {
            setNotification({ message: `Nenhum contrato importado. Verifique o formato do CSV.`, type: 'error' });
        }
        
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    };

    reader.onerror = () => {
        setNotification({ message: 'Erro ao ler arquivo.', type: 'error' });
        setImporting(false);
    };

    reader.readAsText(file);
  };

  const handleSaveContract = async (contractData: Partial<Contract>) => {
    setIsSaving(true);
    try {
        const payload = {
            bank: contractData.bank,
            contract_number: contractData.contractNumber,
            description: contractData.description,
            issue_date: contractData.issueDate,
            due_date: contractData.dueDate,
            amount: contractData.amount,
            index_name: contractData.indexName,
            annual_rate: contractData.annualRate,
            status: contractData.status,
            // capitalization_period removed to fix schema error
        };

        let error;
        if (editingContract && editingContract.id) {
             const { error: updateError } = await supabase
                .from('contracts')
                .update(payload)
                .eq('id', editingContract.id);
             error = updateError;
        } else {
             const { error: insertError } = await supabase
                .from('contracts')
                .insert([payload]);
             error = insertError;
        }

        if (error) throw error;

        await fetchContracts();
        setIsModalOpen(false);
        setEditingContract(null);
        setNotification({ message: 'Contrato salvo com sucesso!', type: 'success' });
    } catch (err: any) {
        console.error("Error saving contract", err);
        setNotification({ message: `Erro ao salvar contrato: ${err.message || 'Erro desconhecido'}`, type: 'error' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este contrato?')) {
        try {
            const { error } = await supabase.from('contracts').delete().eq('id', id);
            if (error) throw error;
            await fetchContracts();
            setNotification({ message: 'Contrato excluído.', type: 'info' });
        } catch (err: any) {
            console.error(err);
            setNotification({ message: `Erro ao excluir: ${err.message}`, type: 'error' });
        }
    }
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    setIsModalOpen(true);
  };

  const toggleRow = (id: string) => {
    if (expandedRowId === id) setExpandedRowId(null);
    else setExpandedRowId(id);
  };

  const handleOpenPayment = (contract: Contract, fullPayment: boolean = false) => {
    setPaymentContract(contract);
    if (fullPayment) {
        const { currentDebt } = calculateProjection(contract, interestMethod);
        setPaymentInitialAmount(currentDebt);
    } else {
        setPaymentInitialAmount(undefined);
    }
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (amount: number, date: string, notes: string) => {
    if (!paymentContract) return;
    setIsProcessingPayment(true);
    try {
        const { error } = await supabase
            .from('payments')
            .insert([{
                contract_id: paymentContract.id,
                amount: amount,
                date: date,
                notes: notes
            }]);
        
        if (error) throw error;

        // Check for full payment to update status
        const { currentDebt } = calculateProjection(paymentContract, interestMethod);
        if (amount >= (currentDebt - 0.05)) { // 5 cents tolerance
             const { error: statusError } = await supabase
                .from('contracts')
                .update({ status: 'paid' })
                .eq('id', paymentContract.id);
             if (statusError) console.error("Error updating status:", statusError);
        }
        
        await fetchContracts();
        setIsPaymentModalOpen(false);
        setPaymentContract(null);
        setPaymentInitialAmount(undefined);
        setNotification({ message: 'Pagamento registrado com sucesso!', type: 'success' });
    } catch (err: any) {
        console.error("Error adding payment", err);
        setNotification({ message: `Erro ao registrar pagamento: ${err.message}`, type: 'error' });
    } finally {
        setIsProcessingPayment(false);
    }
  };

  const handleDeletePayment = async (contractId: string, paymentId: string) => {
    if(!confirm("Tem certeza que deseja remover este pagamento? O saldo devedor e o status do contrato serão recalculados.")) return;
    
    try {
        // 1. Remove o pagamento
        const { error } = await supabase.from('payments').delete().eq('id', paymentId);
        if (error) throw error;

        // 2. Recalcula o total pago para verificar se o status deve mudar
        const { data: currentPayments } = await supabase
            .from('payments')
            .select('amount')
            .eq('contract_id', contractId);
        
        const newTotalPaid = currentPayments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

        // 3. Busca dados do contrato para comparar
        const { data: contractData } = await supabase
            .from('contracts')
            .select('amount, status')
            .eq('id', contractId)
            .single();
        
        if (contractData) {
            let newStatus = contractData.status;
            
            // Se o total pago for menor que o valor original (com margem de erro), não pode ser 'paid'
            if (newTotalPaid < (contractData.amount - 0.05)) { 
                if (newTotalPaid > 0) newStatus = 'partial';
                else newStatus = 'pending';
            }

            // Atualiza no banco se o status mudou
            if (newStatus !== contractData.status) {
                    await supabase
                    .from('contracts')
                    .update({ status: newStatus })
                    .eq('id', contractId);
            }
        }

        await fetchContracts();
        setNotification({ message: 'Pagamento removido e contrato atualizado.', type: 'success' });
    } catch (err: any) {
        console.error(err);
        setNotification({ message: `Erro ao excluir pagamento: ${err.message}`, type: 'error' });
    }
  };

  const COLORS = ['#059669', '#0284c7', '#d97706', '#dc2626', '#7c3aed'];

  return (
    <div className="min-h-screen pb-20 relative">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 border-l-4 shadow-xl rounded-lg p-4 max-w-sm animate-in slide-in-from-right z-50 flex gap-3 items-start ${
            notification.type === 'error' ? 'bg-white border-red-500' : 
            notification.type === 'success' ? 'bg-white border-green-500' : 'bg-white border-amber-500'
        }`}>
            <div className={
                notification.type === 'error' ? 'text-red-500' : 
                notification.type === 'success' ? 'text-green-500' : 'text-amber-500'
            }>
                {notification.type === 'error' ? <AlertCircle size={20}/> : 
                 notification.type === 'success' ? <CheckCircle size={20} /> : <Bell size={20} />}
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-slate-800 text-sm">
                    {notification.type === 'error' ? 'Erro' : 
                     notification.type === 'success' ? 'Sucesso' : 'Atenção Necessária'}
                </h4>
                <p className="text-slate-600 text-sm mt-1">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
        </div>
      )}

      {/* Header */}
      <header className="bg-emerald-900 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Landmark /> Fazenda Bom Sossego
              </h1>
              <p className="text-emerald-200 text-sm mt-1">Gestão de Passivos e Cédulas Rurais</p>
            </div>
            <div className="flex gap-2">
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".csv" 
                  className="hidden" 
               />
               <button 
                 onClick={handleDownloadTemplate}
                 className="bg-emerald-800 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-emerald-700"
                 title="Baixar modelo de planilha CSV para preenchimento"
               >
                 <Download size={18} /> Modelo
               </button>
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 disabled={importing}
                 className="bg-emerald-800 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-emerald-700"
               >
                 {importing ? <Loader2 className="animate-spin" size={18} /> : <FileUp size={18} />} Importar Planilha
               </button>
               <button 
                onClick={() => { setEditingContract(null); setIsModalOpen(true); }}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
              >
                <Plus size={20} /> Novo Contrato
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="container mx-auto px-4 -mt-4">
        <div className="bg-white rounded-xl shadow-md p-1 flex gap-1 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Visão Geral', icon: PieIcon },
            { id: 'contracts', label: 'Meus Contratos', icon: FileText },
            { id: 'ai', label: 'Consultor IA', icon: BrainCircuit },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        
        {loadingData ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 size={48} className="animate-spin mb-4 text-emerald-600" />
                <p>Carregando dados da nuvem...</p>
             </div>
        ) : (
        <>
            {/* KPI Cards */}
            {activeTab !== 'ai' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                title="Saldo Devedor Atualizado" 
                value={formatCurrency(metrics.totalProjectedPending)} 
                icon={TrendingUp} 
                colorClass="bg-emerald-600"
                subtext={`Juros ${interestMethod === 'compound' ? 'Compostos' : 'Simples'} (Conta Gráfica)`}
                highlight={true}
                />
                <StatCard 
                title="Valor Já Quitado" 
                value={formatCurrency(metrics.totalPaid)} 
                icon={CheckCircle} 
                colorClass="bg-blue-600"
                />
                <StatCard 
                title="Principal Contratado" 
                value={formatCurrency(metrics.totalOriginalDebt)} 
                icon={DollarSign} 
                colorClass="bg-slate-500"
                subtext="Valor original sem juros"
                />
                <StatCard 
                title="Próximo Vencimento" 
                value={metrics.nextDue ? formatDate(metrics.nextDue.dueDate) : 'Nenhum'} 
                icon={Calendar} 
                colorClass={metrics.nextDue ? "bg-amber-600" : "bg-slate-400"}
                subtext={metrics.nextDue ? metrics.nextDue.description : 'Sem pendências futuras'}
                />
            </div>
            )}

            {/* Filters */}
            {activeTab === 'contracts' && (
                <FilterBar 
                    filters={filters} 
                    setFilters={setFilters} 
                    banks={uniqueBanks} 
                    operationTypes={uniqueOperationTypes} 
                    interestMethod={interestMethod}
                    setInterestMethod={setInterestMethod}
                />
            )}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Calendar size={20} className="text-emerald-600"/>
                        Fluxo de Pagamentos
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-500 border border-slate-200">
                        Regime: {interestMethod === 'compound' ? 'Juros Compostos' : 'Juros Simples'}
                    </span>
                </div>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.projectionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(val) => `R$${val/1000}k`} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <RechartsTooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="value" name="Valor a Vencer" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                    <PieIcon size={20} className="text-emerald-600"/>
                    Exposição por Banco
                </h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={chartData.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        >
                        {chartData.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                    </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                    {chartData.pieData.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
                                {d.name}
                            </span>
                            <span className="font-medium text-slate-600">{((d.value / Math.max(metrics.totalProjectedPending, 1)) * 100).toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
                </div>
            </div>
            )}

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                        <th className="p-4 w-10"></th>
                        <th className="p-4">Banco / Contrato</th>
                        <th className="p-4">Datas (Emissão / Venc.)</th>
                        <th className="p-4">Índice / Taxa</th>
                        <th className="p-4">Valor Original</th>
                        <th className="p-4 bg-emerald-50 text-emerald-700">Valor Atualizado ({interestMethod === 'compound' ? 'Comp.' : 'Simp.'})</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Ações</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {filteredContracts.map(contract => {
                        const { currentDebt, projectedTotal, interestAccrued, daysElapsed, totalAnnualRatePercent, dailyRateUsed } = calculateProjection(contract, interestMethod);
                        
                        const today = new Date();
                        const dDate = new Date(contract.dueDate);
                        const isOverdue = contract.status !== 'paid' && dDate < today;
                        
                        // Logic for urgent contracts (next 30 days)
                        const timeDiff = dDate.getTime() - today.getTime();
                        const daysToDue = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        const isUrgent = contract.status !== 'paid' && daysToDue >= 0 && daysToDue <= 30;

                        const isExpanded = expandedRowId === contract.id;
                        
                        // Calculation for timeline progress
                        const issueTime = new Date(contract.issueDate).getTime();
                        const dueTime = new Date(contract.dueDate).getTime();
                        const totalDuration = Math.max(1, dueTime - issueTime);
                        const elapsedDuration = Math.max(0, new Date().getTime() - issueTime);
                        const progressPercent = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));

                        return (
                        <React.Fragment key={contract.id}>
                            <tr 
                                onClick={() => toggleRow(contract.id)} 
                                className={`transition-colors cursor-pointer ${isExpanded ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                            >
                                <td className="p-4 text-slate-400">
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </td>
                                <td className="p-4">
                                <div className="font-medium text-slate-800">{contract.bank}</div>
                                <div className="text-xs text-slate-500">{contract.contractNumber}</div>
                                <div className="text-xs text-slate-400 mt-1 md:hidden">{contract.description}</div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-xs text-slate-400 flex items-center gap-1" title="Data de Contratação">
                                            <CalendarDays size={10} /> {formatDate(contract.issueDate)}
                                        </div>
                                        <div className={`text-sm ${
                                            isOverdue ? 'text-red-600 font-medium' : 
                                            isUrgent ? 'text-orange-600 font-medium' : 
                                            'text-slate-600'
                                        }`}>
                                            {formatDate(contract.dueDate)}
                                            {isOverdue && <span className="block text-xs font-bold uppercase mt-1 flex items-center gap-1"><AlertCircle size={10}/> Vencido</span>}
                                            {isUrgent && <span className="block text-xs font-bold uppercase mt-1 flex items-center gap-1 text-orange-600"><AlertTriangle size={10} className="animate-pulse"/> {daysToDue} dias</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-1">
                                        <span className="font-medium text-slate-800">{totalAnnualRatePercent.toFixed(2)}%</span> a.a.
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {contract.indexName === 'Prefixado' ? 'Taxa Fixa' : `${contract.indexName} ${contract.annualRate}%`}
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-slate-600">
                                    <div>{formatCurrency(contract.amount)}</div>
                                    {contract.paidAmount > 0 && <div className="text-xs text-emerald-600">Pago: {formatCurrency(contract.paidAmount)}</div>}
                                </td>
                                <td className="p-4 text-sm font-bold text-emerald-800 bg-emerald-50/50">
                                    {formatCurrency(currentDebt)}
                                    {currentDebt > 0 && (
                                        <div className="text-xs font-normal text-emerald-600 flex items-center gap-1 mt-1" title="Juros acumulados sobre o saldo devedor">
                                            <ArrowUpRight size={12} />
                                            {formatCurrency(interestAccrued)} juros
                                        </div>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border 
                                        ${contract.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                            isOverdue ? 'bg-red-50 text-red-700 border-red-200' :
                                            isUrgent ? 'bg-orange-100 text-orange-800 border-orange-300 shadow-sm ring-1 ring-orange-200' :
                                            contract.status === 'partial' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                            'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            
                                            {contract.status === 'paid' && <CheckCircle size={12} strokeWidth={2.5} />}
                                            {isOverdue && contract.status !== 'paid' && <AlertCircle size={12} strokeWidth={2.5} />}
                                            {isUrgent && !isOverdue && contract.status !== 'paid' && <AlertTriangle size={12} strokeWidth={2.5} className="text-orange-600" />}
                                            {!isUrgent && !isOverdue && contract.status === 'partial' && <Info size={12} strokeWidth={2.5} />}
                                            {!isUrgent && !isOverdue && contract.status === 'pending' && <Clock size={12} strokeWidth={2.5} />}
                                            
                                            {contract.status === 'paid' ? 'Pago' : 
                                            isOverdue ? 'Vencido' : 
                                            isUrgent ? `Vence em ${daysToDue} dias` :
                                            contract.status === 'partial' ? 'Parcial' : 'Pendente'}
                                        </span>

                                        {/* Alerta Visual Reforçado */}
                                        {isUrgent && !isOverdue && contract.status !== 'paid' && (
                                            <div title="Atenção: Vencimento Próximo" className="bg-orange-100 text-orange-600 p-1.5 rounded-full animate-pulse border border-orange-200 shadow-sm">
                                                <AlertTriangle size={16} strokeWidth={2.5} />
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        {contract.status !== 'paid' && (
                                            <>
                                            <button 
                                                onClick={() => handleOpenPayment(contract, false)}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                                title="Pagar Parcial"
                                            >
                                                <Wallet size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleOpenPayment(contract, true)}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                                title="Quitar Contrato (Total)"
                                            >
                                                <CheckCheck size={16} />
                                            </button>
                                            </>
                                        )}
                                        <button 
                                            onClick={() => handleEdit(contract)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(contract.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {isExpanded && (
                                <tr className="bg-slate-50 border-b border-slate-200 animate-in fade-in duration-200">
                                    <td colSpan={8} className="p-0 cursor-default">
                                        <div className="p-6 border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white shadow-inner">
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            
                                            {/* Column 1: General Info */}
                                            <div className="space-y-4">
                                                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                                <FileText size={16} className="text-emerald-600"/> Detalhes do Contrato
                                                </h4>
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-full">
                                                <p className="text-sm text-slate-600 mb-1 font-medium">Descrição / Finalidade:</p>
                                                <p className="text-slate-800 text-sm mb-4 leading-relaxed">{contract.description}</p>
                                                
                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                                    <div>
                                                        <span className="text-xs text-slate-400 block mb-1">Número do Contrato</span>
                                                        <span className="text-sm font-medium text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block">
                                                            {contract.contractNumber}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-slate-400 block mb-1">Instituição Bancária</span>
                                                        <span className="text-sm font-medium text-slate-700">{contract.bank}</span>
                                                    </div>
                                                </div>
                                                </div>
                                            </div>

                                            {/* Column 2: Timeline & Rate */}
                                            <div className="space-y-4">
                                                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                                <Clock size={16} className="text-blue-600"/> Prazo & Taxas
                                                </h4>
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-5 h-full">
                                                    {/* Timeline Visual */}
                                                    <div>
                                                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                                                        <div className="text-left">
                                                            <span className="block text-[10px] uppercase text-slate-400">Emissão</span>
                                                            <span className="font-medium">{formatDate(contract.issueDate)}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-[10px] uppercase text-slate-400">Vencimento</span>
                                                            <span className="font-medium">{formatDate(contract.dueDate)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden w-full">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                            style={{width: `${progressPercent}%`}}
                                                        ></div>
                                                    </div>
                                                    <div className="mt-2 text-xs font-medium text-slate-600 text-center flex justify-center gap-2">
                                                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{daysElapsed.toFixed(0)} dias decorridos</span>
                                                    </div>
                                                    </div>

                                                    {/* Rate Info */}
                                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                        <div className="flex justify-between items-center mb-1 pb-1 border-b border-blue-200/50">
                                                            <span className="text-xs text-blue-700 font-medium">Taxa Efetiva Anual (Est.)</span>
                                                            <span className="text-sm font-bold text-blue-800">{totalAnnualRatePercent.toFixed(2)}%</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-1">
                                                            <span className="text-xs text-blue-600">Taxa Diária Aplicada</span>
                                                            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded text-blue-700 border border-blue-200 shadow-sm font-medium">
                                                                {(dailyRateUsed * 100).toFixed(6)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 3: Financial Calculation */}
                                            <div className="space-y-4">
                                                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                                <Calculator size={16} className="text-emerald-600"/> Memória de Cálculo (Conta Gráfica)
                                                </h4>
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                                                    <div className="p-5 space-y-3 bg-slate-50/50 flex-1">
                                                        <div className="flex justify-between text-sm items-center">
                                                            <span className="text-slate-500">Valor Principal Original</span>
                                                            <span className="font-medium text-slate-700">{formatCurrency(contract.amount)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm items-start">
                                                            <div className="flex flex-col">
                                                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                                                    (+) Juros Acumulados
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 mt-0.5">
                                                                    Calculado sobre saldo diário
                                                                </span>
                                                            </div>
                                                            <span className="font-medium text-emerald-600">+{formatCurrency(interestAccrued)}</span>
                                                        </div>
                                                        {contract.paidAmount > 0 && (
                                                            <div className="flex justify-between text-sm items-center pt-2 border-t border-slate-100 border-dashed">
                                                                <span className="text-slate-500">(-) Amortizações Totais</span>
                                                                <span className="font-medium text-slate-600">-{formatCurrency(contract.paidAmount)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                                                        <span className="text-sm font-bold text-emerald-900 uppercase tracking-wide">Saldo Devedor Hoje</span>
                                                        <span className="text-xl font-bold text-emerald-700">{formatCurrency(currentDebt)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            </div>

                                            {/* Payment History Dedicated Section */}
                                            <div className="mt-8 pt-6 border-t border-slate-200">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                                        <Wallet size={16} className="text-emerald-600"/> 
                                                        Histórico de Pagamentos
                                                        <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs font-normal normal-case">
                                                            {contract.payments?.length || 0} lançamentos
                                                        </span>
                                                    </h4>
                                                </div>
                                                
                                                {(contract.payments && contract.payments.length > 0) ? (
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ring-1 ring-slate-100">
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-semibold">
                                                                <tr>
                                                                    <th className="px-4 py-3 w-32">Data</th>
                                                                    <th className="px-4 py-3">Observação / Referência</th>
                                                                    <th className="px-4 py-3 text-right">Valor Pago</th>
                                                                    <th className="px-4 py-3 w-16 text-center">Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {[...contract.payments]
                                                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date descending
                                                                    .map(p => (
                                                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                                                        <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                                                                            <div className="flex items-center gap-2">
                                                                                <CalendarDays size={14} className="text-slate-400"/>
                                                                                {formatDate(p.date)}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-slate-600">
                                                                            {p.notes ? (
                                                                                <span className="text-slate-700">{p.notes}</span>
                                                                            ) : (
                                                                                <span className="text-slate-300 italic flex items-center gap-1">
                                                                                    <FilePenLine size={12}/> Sem observações
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono">
                                                                            {formatCurrency(p.amount)}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                             <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleDeletePayment(contract.id, p.id); }}
                                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                                                title="Excluir pagamento"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                            <tfoot className="bg-slate-50/50 border-t border-slate-200">
                                                                <tr>
                                                                    <td colSpan={2} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Total Amortizado:</td>
                                                                    <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">{formatCurrency(contract.paidAmount)}</td>
                                                                    <td></td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-8 text-center text-slate-400">
                                                        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <Wallet size={24} className="text-slate-300" />
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-600">Nenhum pagamento registrado</p>
                                                        <p className="text-xs text-slate-400 mt-1">Utilize o botão de "Lançar Pagamento" acima para registrar baixas.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                        );
                    })}
                    {filteredContracts.length === 0 && (
                        <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-3">
                                <FileText size={48} className="text-slate-200" />
                                <p>Nenhum contrato encontrado com os filtros atuais.</p>
                                <button onClick={() => setFilters({search: '', bank: 'all', status: 'all', operationType: 'all', dateStart: '', dateEnd: '' })} className="text-emerald-600 text-sm hover:underline">Limpar filtros</button>
                            </div>
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
            )}

            {/* AI Tab */}
            {activeTab === 'ai' && (
            <AIAdvisor contracts={contracts} interestMethod={interestMethod} />
            )}
        </>
        )}

      </main>

      {/* Modals */}
      <ContractModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingContract(null); }} 
        onSave={handleSaveContract}
        initialData={editingContract}
        isSaving={isSaving}
      />
      
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => { setIsPaymentModalOpen(false); setPaymentContract(null); }}
        onConfirm={handleConfirmPayment}
        contract={paymentContract}
        isProcessing={isProcessingPayment}
        initialAmount={paymentInitialAmount}
        interestMethod={interestMethod}
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);