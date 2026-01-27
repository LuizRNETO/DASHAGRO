import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Plus, Trash2, Edit2, CheckCircle, AlertCircle, TrendingUp, DollarSign, 
  PieChart as PieIcon, FileText, BrainCircuit, X, Save, Calendar, Landmark,
  Search, Filter, RefreshCw, ArrowUpRight, Info, ChevronDown, ChevronUp, Clock, Calculator, Wallet, Bell, FilePenLine, CalendarDays, Loader2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://ndpgfoxycavzhqlwdrvw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dPcP59CFidQ5Ha5hTwwXHA_nLvc5b8p';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Types ---

type ContractStatus = 'pending' | 'paid' | 'partial';

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
  annualRate: number; 
  status: ContractStatus;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  // Ajuste para timezone local para evitar problemas de exibição de data off-by-one
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
};

const calculateProjection = (contract: Contract) => {
    // Lógica Financeira: Juros Compostos com Capitalização Mensal
    
    // Recalcular paidAmount baseado nos pagamentos atuais para garantir consistência
    const realPaidAmount = contract.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;

    const today = new Date();
    const issue = new Date(contract.issueDate);
    
    // Se a data de emissão for inválida
    if (isNaN(issue.getTime())) {
        return { 
            projectedTotal: contract.amount, 
            currentDebt: Math.max(0, contract.amount - realPaidAmount), 
            interestAccrued: 0,
            daysElapsed: 0,
            monthsElapsed: 0,
            monthlyRate: 0
        };
    }

    // 1. Cálculo do Tempo (Dias e Meses)
    const diffTime = Math.max(0, today.getTime() - issue.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = diffDays / (365 / 12); 

    // 2. Conversão da Taxa Anual para Taxa Mensal Efetiva
    const annualRateDecimal = (contract.annualRate || 0) / 100;
    const monthlyRateDecimal = Math.pow(1 + annualRateDecimal, 1 / 12) - 1;

    // 3. Aplicação dos Juros Compostos
    const compoundFactor = Math.pow(1 + monthlyRateDecimal, diffMonths);
    const projectedTotal = contract.amount * compoundFactor;
    
    // 4. Saldo Devedor
    // Se o status for pago, forçamos zero, senão calculamos
    let currentDebt = 0;
    
    // Verifica se já está tecnicamente quitado (com margem de erro pequena para float)
    if (realPaidAmount >= (projectedTotal - 1)) {
       currentDebt = 0;
    } else {
       currentDebt = Math.max(0, projectedTotal - realPaidAmount);
    }

    return {
        projectedTotal,
        currentDebt,
        interestAccrued: projectedTotal - contract.amount,
        daysElapsed: diffDays,
        monthsElapsed: diffMonths,
        monthlyRate: monthlyRateDecimal * 100 
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
    banks 
}: { 
    filters: any, 
    setFilters: any, 
    banks: string[] 
}) => {
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col xl:flex-row gap-4 items-start xl:items-center">
            <div className="flex items-center gap-2 text-slate-500 font-medium mr-2 min-w-fit self-center xl:self-auto">
                <Filter size={20} /> Filtros:
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar contrato..." 
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        value={filters.search}
                        onChange={(e) => setFilters({...filters, search: e.target.value})}
                    />
                </div>

                <div className="flex gap-2">
                    <div className="relative w-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <CalendarDays size={16} />
                        </span>
                        <input 
                            type="date"
                            placeholder="De"
                            className="w-full pl-9 pr-2 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-slate-600"
                            value={filters.dateStart}
                            onChange={(e) => setFilters({...filters, dateStart: e.target.value})}
                            title="Vencimento a partir de"
                        />
                    </div>
                    <div className="relative w-full">
                        <input 
                            type="date"
                            placeholder="Até"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-slate-600"
                            value={filters.dateEnd}
                            onChange={(e) => setFilters({...filters, dateEnd: e.target.value})}
                            title="Vencimento até"
                        />
                    </div>
                </div>

                <select 
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700"
                    value={filters.bank}
                    onChange={(e) => setFilters({...filters, bank: e.target.value})}
                >
                    <option value="all">Todos os Bancos</option>
                    {banks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>

                <div className="flex gap-2">
                    <select 
                        className="w-full py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700"
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="pending">Pendente</option>
                        <option value="partial">Parcial</option>
                        <option value="paid">Pago</option>
                        <option value="overdue">Vencido</option>
                    </select>

                    <button 
                        onClick={() => setFilters({ search: '', bank: 'all', status: 'all', dateStart: '', dateEnd: '' })}
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
    amount: 0, paidAmount: 0, payments: [], indexName: 'Prefixado', annualRate: 0, status: 'pending'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
          ...initialData,
          // Garante formato de data correto para o input YYYY-MM-DD
          issueDate: initialData.issueDate ? initialData.issueDate.split('T')[0] : '',
          dueDate: initialData.dueDate ? initialData.dueDate.split('T')[0] : ''
      });
    } else {
      setFormData({
        bank: '', contractNumber: '', description: '', issueDate: '', dueDate: '', 
        amount: 0, paidAmount: 0, payments: [], indexName: 'Prefixado', annualRate: 0, status: 'pending'
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

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
                {/* Nota: PaidAmount agora é calculado, mas mantemos aqui para inicialização manual se necessário ou visualização */}
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

          <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
             <h3 className="col-span-2 text-sm font-semibold text-slate-800 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600"/> Indexador (Para Projeção)
            </h3>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Índice</label>
                <select 
                    className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.indexName}
                    onChange={e => setFormData({...formData, indexName: e.target.value})}
                >
                    <option value="Prefixado">Prefixado</option>
                    <option value="CDI +">CDI +</option>
                    <option value="IPCA +">IPCA +</option>
                    <option value="IGPM +">IGPM +</option>
                    <option value="Selic +">Selic +</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Taxa Anual Estimada (%)</label>
                <div className="relative">
                    <input 
                    type="number" 
                    step="0.01"
                    className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none pr-8"
                    value={formData.annualRate}
                    onChange={e => setFormData({...formData, annualRate: Number(e.target.value)})}
                    placeholder="Ex: 12.5"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-sm">%</span>
                </div>
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select 
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

const PaymentModal = ({ isOpen, onClose, onConfirm, contract, isProcessing }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: (amount: number, date: string, notes: string) => void;
    contract: Contract | null;
    isProcessing: boolean;
}) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]); 
            setNotes('');
        }
    }, [isOpen]);
    
    if (!isOpen || !contract) return null;

    const { currentDebt } = calculateProjection(contract);
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
                            <span className="text-sm text-slate-500">Saldo Devedor Atual:</span>
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

const AIAdvisor = ({ contracts }: { contracts: Contract[] }) => {
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
          const { currentDebt } = calculateProjection(c);
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
        Analise a seguinte lista de Cédulas Rurais e dívidas bancárias, considerando os valores projetados com juros compostos.
        
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
  
  const [filters, setFilters] = useState({
    search: '',
    bank: 'all',
    status: 'all',
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
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'warning' | 'info' | 'error'} | null>(null);

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
                  const payments = c.payments.map((p: any) => ({
                      id: p.id,
                      date: p.date,
                      amount: Number(p.amount),
                      notes: p.notes,
                      contract_id: p.contract_id
                  }));

                  // Calcula o total pago baseado na tabela de pagamentos
                  const totalPaid = payments.reduce((acc: number, p: Payment) => acc + p.amount, 0);
                  
                  // Atualiza o status dinamicamente (opcional, mas bom para consistência)
                  // Note: A lógica exata de 'paid' vs 'partial' pode depender da projeção, 
                  // mas aqui usamos dados brutos. A projeção cuida da exibição final.
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
                      status: derivedStatus as ContractStatus
                  };
              });
              setContracts(formattedContracts);
          }
      } catch (err: any) {
          console.error("Error fetching data:", err);
          setNotification({ message: 'Erro ao carregar dados do servidor.', type: 'error' });
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
          
          return statusMatch && bankMatch && searchMatch && dateMatch;
      });
  }, [contracts, filters]);

  const uniqueBanks = useMemo(() => [...new Set(contracts.map(c => c.bank))], [contracts]);

  const metrics = useMemo(() => {
    const totalOriginalDebt = filteredContracts.reduce((acc, c) => acc + c.amount, 0);
    const totalPaid = filteredContracts.reduce((acc, c) => acc + c.paidAmount, 0);
    
    // Calculate Projected Totals
    let totalProjectedPending = 0;
    
    filteredContracts.forEach(c => {
        const { currentDebt } = calculateProjection(c);
        totalProjectedPending += currentDebt;
    });
    
    // Sort by due date to find next
    const pendingContracts = filteredContracts
      .filter(c => c.status !== 'paid' && new Date(c.dueDate) >= new Date())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    const nextDue = pendingContracts.length > 0 ? pendingContracts[0] : null;

    return { totalOriginalDebt, totalPaid, totalProjectedPending, nextDue };
  }, [filteredContracts]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const months: Record<string, number> = {};
    filteredContracts.forEach(c => {
      if (c.status === 'paid') return;
      const { currentDebt } = calculateProjection(c);
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
      const { currentDebt } = calculateProjection(c);
      if (currentDebt > 0) {
        bankDist[c.bank] = (bankDist[c.bank] || 0) + currentDebt;
      }
    });
    const pieData = Object.entries(bankDist).map(([name, value]) => ({ name, value }));

    return { projectionData, pieData };
  }, [filteredContracts]);

  // --- Handlers (CRUD) ---

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
            status: contractData.status
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
    } catch (err) {
        console.error("Error saving contract", err);
        setNotification({ message: 'Erro ao salvar contrato.', type: 'error' });
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
        } catch (err) {
            console.error(err);
            setNotification({ message: 'Erro ao excluir contrato.', type: 'error' });
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

  const handleOpenPayment = (contract: Contract) => {
    setPaymentContract(contract);
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

        // Se o pagamento cobrir quase tudo, atualize o status do contrato para 'paid'
        // Mas a função fetchContracts já recalcula.
        // Opcional: Atualizar status do contrato no banco se for quitação total.
        // Por simplificação, deixamos o status como está ou atualizamos no fetch.
        
        // Vamos forçar uma verificação rápida para atualizar o status para 'paid' se necessário no banco
        // Para isso, precisamos saber o total pago. O ideal é deixar a lógica de negócio no backend ou 
        // no fetchContracts. Aqui apenas inserimos o pagamento.
        
        await fetchContracts();
        setIsPaymentModalOpen(false);
        setPaymentContract(null);
    } catch (err) {
        console.error("Error adding payment", err);
        setNotification({ message: 'Erro ao registrar pagamento.', type: 'error' });
    } finally {
        setIsProcessingPayment(false);
    }
  };

  const handleDeletePayment = async (contractId: string, paymentId: string) => {
    if(!confirm("Tem certeza que deseja remover este pagamento?")) return;
    
    try {
        const { error } = await supabase.from('payments').delete().eq('id', paymentId);
        if (error) throw error;
        await fetchContracts();
    } catch (err) {
        console.error(err);
        setNotification({ message: 'Erro ao excluir pagamento.', type: 'error' });
    }
  };

  const COLORS = ['#059669', '#0284c7', '#d97706', '#dc2626', '#7c3aed'];

  return (
    <div className="min-h-screen pb-20 relative">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 border-l-4 shadow-xl rounded-lg p-4 max-w-sm animate-in slide-in-from-right z-50 flex gap-3 items-start ${
            notification.type === 'error' ? 'bg-white border-red-500' : 'bg-white border-amber-500'
        }`}>
            <div className={notification.type === 'error' ? 'text-red-500' : 'text-amber-500'}>
                {notification.type === 'error' ? <AlertCircle size={20}/> : <Bell size={20} />}
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-slate-800 text-sm">
                    {notification.type === 'error' ? 'Erro' : 'Atenção Necessária'}
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
                subtext="Inclui projeção de juros (Cap. Mensal)"
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
                <FilterBar filters={filters} setFilters={setFilters} banks={uniqueBanks} />
            )}

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                    <Calendar size={20} className="text-emerald-600"/>
                    Fluxo de Pagamentos (Valores Corrigidos)
                </h3>
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
                        <th className="p-4 bg-emerald-50 text-emerald-700">Valor Atualizado (Est.)</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Ações</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {filteredContracts.map(contract => {
                        const { currentDebt, projectedTotal, interestAccrued, daysElapsed, monthlyRate, monthsElapsed } = calculateProjection(contract);
                        
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

                        // Paid Amount is now tracked via Payment table sum
                        // But let's check for visual consistency
                        const untracked = 0; // We assume all data is now consistent via DB

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
                                            isUrgent ? 'text-amber-600 font-medium' : 
                                            'text-slate-600'
                                        }`}>
                                            {formatDate(contract.dueDate)}
                                            {isOverdue && <span className="block text-xs font-bold uppercase mt-1 flex items-center gap-1"><AlertCircle size={10}/> Vencido</span>}
                                            {isUrgent && <span className="block text-xs font-bold uppercase mt-1 flex items-center gap-1"><AlertCircle size={10}/> Vence em {daysToDue} dias</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-1">
                                        <span className="font-medium text-slate-800">{contract.annualRate}%</span> a.a.
                                    </div>
                                    <div className="text-xs text-slate-500">{contract.indexName}</div>
                                </td>
                                <td className="p-4 text-sm text-slate-600">
                                    <div>{formatCurrency(contract.amount)}</div>
                                    {contract.paidAmount > 0 && <div className="text-xs text-emerald-600">Pago: {formatCurrency(contract.paidAmount)}</div>}
                                </td>
                                <td className="p-4 text-sm font-bold text-emerald-800 bg-emerald-50/50">
                                    {formatCurrency(currentDebt)}
                                    {currentDebt > (contract.amount - contract.paidAmount) && (
                                        <div className="text-xs font-normal text-emerald-600 flex items-center gap-1 mt-1">
                                            <ArrowUpRight size={12} />
                                            +{formatCurrency(currentDebt - (contract.amount - contract.paidAmount))} juros
                                        </div>
                                    )}
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border 
                                    ${contract.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                        isOverdue ? 'bg-red-50 text-red-700 border-red-200' :
                                        contract.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                        'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                        
                                        {contract.status === 'paid' && <CheckCircle size={12} strokeWidth={2.5} />}
                                        {isOverdue && contract.status !== 'paid' && <AlertCircle size={12} strokeWidth={2.5} />}
                                        {!isOverdue && contract.status === 'partial' && <Info size={12} strokeWidth={2.5} />}
                                        {!isOverdue && contract.status === 'pending' && <Clock size={12} strokeWidth={2.5} />}
                                        
                                        {contract.status === 'paid' ? 'Pago' : 
                                        isOverdue ? 'Vencido' : 
                                        contract.status === 'partial' ? 'Parcial' : 'Pendente'}
                                    </span>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        {contract.status !== 'paid' && (
                                            <button 
                                                onClick={() => handleOpenPayment(contract)}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                                title="Pagar Parcial"
                                            >
                                                <Wallet size={16} />
                                            </button>
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
                                                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{monthsElapsed.toFixed(1)} meses capitalizados</span>
                                                    </div>
                                                    </div>

                                                    {/* Rate Info */}
                                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                        <div className="flex justify-between items-center mb-1 pb-1 border-b border-blue-200/50">
                                                            <span className="text-xs text-blue-700 font-medium">Taxa Anual</span>
                                                            <span className="text-sm font-bold text-blue-800">{contract.annualRate}%</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-1">
                                                            <span className="text-xs text-blue-600">Taxa Mensal Efetiva</span>
                                                            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded text-blue-700 border border-blue-200 shadow-sm font-medium">
                                                                {monthlyRate.toFixed(4)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 3: Financial Calculation */}
                                            <div className="space-y-4">
                                                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                                                <Calculator size={16} className="text-emerald-600"/> Memória de Cálculo
                                                </h4>
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                                                    <div className="p-5 space-y-3 bg-slate-50/50 flex-1">
                                                        <div className="flex justify-between text-sm items-center">
                                                            <span className="text-slate-500">Valor Principal</span>
                                                            <span className="font-medium text-slate-700">{formatCurrency(contract.amount)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm items-start">
                                                            <div className="flex flex-col">
                                                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                                                    (+) Juros Compostos
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 mt-0.5">
                                                                    Fator: (1 + {monthlyRate.toFixed(2)}%) ^ {monthsElapsed.toFixed(1)}
                                                                </span>
                                                            </div>
                                                            <span className="font-medium text-emerald-600">+{formatCurrency(interestAccrued)}</span>
                                                        </div>
                                                        {contract.paidAmount > 0 && (
                                                            <div className="flex justify-between text-sm items-center pt-2 border-t border-slate-100 border-dashed">
                                                                <span className="text-slate-500">(-) Total Pago</span>
                                                                <span className="font-medium text-slate-600">-{formatCurrency(contract.paidAmount)}</span>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Payment History Section */}
                                                        <div className="mt-4 border-t border-slate-100 pt-3">
                                                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Histórico de Pagamentos</p>
                                                            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                                            {(contract.payments || []).map(p => (
                                                                <div key={p.id} className="flex justify-between items-center text-xs text-slate-600 py-1 border-b border-slate-50 last:border-0 group">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-slate-500">{formatDate(p.date)}</span>
                                                                        {p.notes && <span className="text-[10px] text-slate-400 italic">{p.notes}</span>}
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="font-medium text-emerald-600">{formatCurrency(p.amount)}</span>
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleDeletePayment(contract.id, p.id); }}
                                                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            title="Excluir pagamento"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {contract.paidAmount === 0 && (
                                                                <p className="text-xs text-slate-400 italic">Nenhum pagamento registrado.</p>
                                                            )}
                                                            </div>
                                                        </div>

                                                    </div>
                                                    <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                                                        <span className="text-sm font-bold text-emerald-900 uppercase tracking-wide">Saldo Atualizado</span>
                                                        <span className="text-xl font-bold text-emerald-700">{formatCurrency(currentDebt)}</span>
                                                    </div>
                                                </div>
                                            </div>

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
                                <button onClick={() => setFilters({search: '', bank: 'all', status: 'all', dateStart: '', dateEnd: '' })} className="text-emerald-600 text-sm hover:underline">Limpar filtros</button>
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
            <AIAdvisor contracts={contracts} />
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
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);