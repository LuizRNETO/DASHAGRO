import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Trash2, DollarSign, TrendingUp, Calendar, 
  PieChart as PieChartIcon, Landmark, ArrowUpRight, 
  Search, X, Save, AlertCircle, FileText, CreditCard,
  ChevronRight, MoreVertical, LayoutGrid, List, Eye, Clock, Percent,
  History, Pencil, CalendarRange, CheckCircle2, ArrowRight, AlertTriangle, Filter
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend, CartesianGrid, AreaChart, Area,
  ComposedChart, Line
} from 'recharts';

// --- Types ---

interface Payment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

interface Contract {
  id: string;
  bank: string;
  contractNumber: string;
  indexName: 'CDI' | 'Prefixado' | 'IPCA' | 'Selic';
  annualRate: number; // e.g., 110 (% of CDI) or 12 (Fixed %)
  amount: number;
  paidAmount: number;
  payments: Payment[];
  startDate: string;
  dueDate: string;
  status: 'paid' | 'active' | 'pending';
  notes?: string;
}

// --- Utils ---

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getMonthName = (date: Date) => {
  // Capitalize first letter
  const str = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

// --- Mock Data ---

const INITIAL_CONTRACTS: Contract[] = [
    {
      id: '1',
      bank: 'Banco do Brasil',
      contractNumber: 'CR-2023-001',
      indexName: 'CDI',
      annualRate: 110,
      amount: 500000,
      paidAmount: 150000,
      payments: [
        { id: 'p1', date: '2023-07-15', amount: 50000, note: 'Amortização Parcial' },
        { id: 'p2', date: '2024-01-15', amount: 100000, note: 'Pagamento Juros + Principal' }
      ],
      startDate: '2023-01-15',
      dueDate: '2025-01-15',
      status: 'active',
      notes: 'Custeio Safra 23/24 - Soja'
    },
    {
      id: '2',
      bank: 'Sicredi',
      contractNumber: 'SIC-9928',
      indexName: 'Prefixado',
      annualRate: 14.5,
      amount: 120000,
      paidAmount: 120000,
      payments: [
        { id: 'p3', date: '2022-12-01', amount: 60000, note: 'Parcela 1/2' },
        { id: 'p4', date: '2023-06-01', amount: 60000, note: 'Parcela 2/2 - Quitação' }
      ],
      startDate: '2022-06-01',
      dueDate: '2023-06-01',
      status: 'paid',
      notes: 'Financiamento Maquinário'
    },
    {
        id: '3',
        bank: 'Santander',
        contractNumber: 'SANT-AGRO-55',
        indexName: 'CDI',
        annualRate: 105,
        amount: 750000,
        paidAmount: 0,
        payments: [],
        startDate: '2024-02-10',
        dueDate: '2026-02-10',
        status: 'active',
        notes: 'Investimento Infraestrutura'
    },
    {
        id: '4',
        bank: 'Banco do Brasil',
        contractNumber: 'CR-2022-999',
        indexName: 'IPCA',
        annualRate: 8.5,
        amount: 250000,
        paidAmount: 250000,
        payments: [{ id: 'p5', date: '2023-11-20', amount: 250000, note: 'Liquidação Total' }],
        startDate: '2022-11-20',
        dueDate: '2023-11-20',
        status: 'paid',
        notes: 'Aquisição de Trator'
    }
  ];

// --- Components ---

export default function Dashboard() {
  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contracts' | 'projection'>('dashboard');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Confirmation Modal State
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    type: 'contract' | 'payment' | null;
    id: string | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    id: null,
    title: '',
    message: ''
  });

  // Payment Form State
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ date: '', amount: '', note: '' });
  
  // Form State
  const [formData, setFormData] = useState<Partial<Contract>>({
      bank: '',
      contractNumber: '',
      indexName: 'CDI',
      annualRate: 0,
      amount: 0,
      paidAmount: 0,
      startDate: '',
      dueDate: '',
      status: 'active',
      notes: ''
  });

  // Derived State (KPIs)
  const currentCDI = 11.25; // Base CDI rate for calculation

  const stats = useMemo(() => {
    const totalDebt = contracts.reduce((acc, c) => acc + c.amount, 0);
    const totalPaid = contracts.reduce((acc, c) => acc + c.paidAmount, 0);
    const outstanding = totalDebt - totalPaid;
    
    // Weighted Average Cost of Debt
    let weightedRateSum = 0;
    let activePrincipalSum = 0;

    contracts.filter(c => c.status === 'active').forEach(c => {
        const rate = c.indexName === 'Prefixado' ? c.annualRate : (c.annualRate / 100) * currentCDI;
        const principal = c.amount - c.paidAmount;
        weightedRateSum += rate * principal;
        activePrincipalSum += principal;
    });

    const averageCost = activePrincipalSum > 0 ? weightedRateSum / activePrincipalSum : 0;

    return { totalDebt, totalPaid, outstanding, averageCost };
  }, [contracts]);

  const chartData = useMemo(() => {
      const bankData: Record<string, number> = {};
      contracts.forEach(c => {
          // Calculate outstanding balance instead of total amount for accurate exposure
          const balance = c.amount - c.paidAmount;
          if (balance > 0) {
              bankData[c.bank] = (bankData[c.bank] || 0) + balance;
          }
      });
      return Object.entries(bankData)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [contracts]);

  // Turnover / Liquidation Rate by Bank
  const turnoverData = useMemo(() => {
    const bankStats: Record<string, { total: number, paid: number }> = {};
    
    contracts.forEach(c => {
        if (!bankStats[c.bank]) bankStats[c.bank] = { total: 0, paid: 0 };
        bankStats[c.bank].total += 1;
        if (c.status === 'paid') bankStats[c.bank].paid += 1;
    });

    return Object.entries(bankStats).map(([name, data]) => ({
        name,
        rate: (data.paid / data.total) * 100,
        totalContracts: data.total,
        paidContracts: data.paid
    })).sort((a, b) => b.rate - a.rate);
  }, [contracts]);

  const projectionData = useMemo(() => {
    const groups: Record<string, { date: Date, total: number, items: Contract[] }> = {};
    
    contracts.filter(c => c.status !== 'paid').forEach(c => {
        // Parse the ISO date string (YYYY-MM-DD) to ensure correct local grouping
        const [year, month] = c.dueDate.split('-').map(Number);
        const dateKey = `${year}-${month}`;
        
        if (!groups[dateKey]) {
            groups[dateKey] = {
                date: new Date(year, month - 1, 1),
                total: 0,
                items: []
            };
        }
        
        const debt = c.amount - c.paidAmount;
        groups[dateKey].total += debt;
        groups[dateKey].items.push(c);
    });

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [contracts]);

  // Additional stats for the Projection Tab
  const projectionStats = useMemo(() => {
      const now = new Date();
      const next30Days = new Date();
      next30Days.setDate(now.getDate() + 30);

      let next30Total = 0;
      let totalFuture = 0;
      let maxMonthVal = 0;
      let maxMonthName = '';

      projectionData.forEach(p => {
          totalFuture += p.total;
          
          if (p.total > maxMonthVal) {
              maxMonthVal = p.total;
              maxMonthName = getMonthName(p.date).split(' ')[0]; // just month name
          }

          p.items.forEach(c => {
              const d = new Date(c.dueDate);
              if (d >= now && d <= next30Days) {
                  next30Total += (c.amount - c.paidAmount);
              }
          });
      });

      return { next30Total, totalFuture, maxMonthVal, maxMonthName };
  }, [projectionData]);

  const cashFlowChartData = useMemo(() => {
    let accumulated = 0;
    return projectionData.map(p => {
        accumulated += p.total;
        return {
            name: `${getMonthName(p.date).substring(0, 3)}/${p.date.getFullYear()}`,
            amount: p.total,
            accumulated: accumulated,
            fullDate: getMonthName(p.date)
        };
    });
  }, [projectionData]);

  // Filtered Contracts Logic
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
        // Text Search
        const matchesSearch = 
            c.bank.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Date Range Filter (based on dueDate)
        // Using string comparison for YYYY-MM-DD is safe and avoids timezone issues
        let matchesDate = true;
        if (filterStartDate && c.dueDate < filterStartDate) matchesDate = false;
        if (filterEndDate && c.dueDate > filterEndDate) matchesDate = false;

        return matchesSearch && matchesDate;
    });
  }, [contracts, searchTerm, filterStartDate, filterEndDate]);

  // Handle opening the form for a new contract
  const handleOpenNewContract = () => {
    setEditingId(null);
    setFormData({
        bank: '',
        contractNumber: '',
        indexName: 'CDI',
        annualRate: 0,
        amount: 0,
        paidAmount: 0,
        startDate: '',
        dueDate: '',
        status: 'active',
        notes: ''
      });
    setShowForm(true);
  };

  // Handle opening the form to edit an existing contract
  const handleEditContract = (contract: Contract) => {
    setEditingId(contract.id);
    setFormData({
        bank: contract.bank,
        contractNumber: contract.contractNumber,
        indexName: contract.indexName,
        annualRate: contract.annualRate,
        amount: contract.amount,
        paidAmount: contract.paidAmount,
        startDate: contract.startDate,
        dueDate: contract.dueDate,
        status: contract.status,
        notes: contract.notes
    });
    // Close detail modal if open
    setSelectedContract(null); 
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      if (editingId) {
        // Update existing contract
        const updatedContracts = contracts.map(c => {
            if (c.id === editingId) {
                return {
                    ...c,
                    ...formData,
                    amount: Number(formData.amount),
                    annualRate: Number(formData.annualRate),
                    // If editing, preserve the paidAmount from the existing contract logic (payments sum) 
                    // unless you want to allow manual override, but here we assume payments drive the history
                    paidAmount: c.paidAmount, 
                    startDate: formData.startDate!,
                    dueDate: formData.dueDate!,
                } as Contract;
            }
            return c;
        });
        setContracts(updatedContracts);
      } else {
        // Create new contract
        const newContract: Contract = {
            ...formData as Contract,
            id: Math.random().toString(36).substr(2, 9),
            annualRate: Number(formData.annualRate),
            amount: Number(formData.amount),
            paidAmount: Number(formData.paidAmount),
            payments: [], // Initialize empty payments
        };
        setContracts([...contracts, newContract]);
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        bank: '',
        contractNumber: '',
        indexName: 'CDI',
        annualRate: 0,
        amount: 0,
        paidAmount: 0,
        startDate: '',
        dueDate: '',
        status: 'active',
        notes: ''
      });
  };
  
  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !paymentForm.amount || !paymentForm.date) return;

    const amount = parseFloat(paymentForm.amount);
    const newPayment: Payment = {
        id: Math.random().toString(36).substr(2, 9),
        date: paymentForm.date,
        amount: amount,
        note: paymentForm.note
    };

    const updatedContracts = contracts.map(c => {
        if (c.id === selectedContract.id) {
            const updatedPaidAmount = c.paidAmount + amount;
            return {
                ...c,
                paidAmount: updatedPaidAmount,
                payments: [...c.payments, newPayment],
                status: updatedPaidAmount >= c.amount ? 'paid' : c.status
            };
        }
        return c;
    });

    setContracts(updatedContracts);
    
    // Update selected contract to reflect changes in modal immediately
    const updatedSelected = updatedContracts.find(c => c.id === selectedContract.id) || null;
    setSelectedContract(updatedSelected);

    // Reset Form
    setPaymentForm({ date: '', amount: '', note: '' });
    setShowPaymentForm(false);
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!selectedContract) return;
    
    setConfirmation({
        isOpen: true,
        type: 'payment',
        id: paymentId,
        title: 'Excluir Pagamento',
        message: 'Tem certeza que deseja remover este pagamento? O saldo devedor do contrato será atualizado.'
    });
  };

  const handleDelete = (id: string) => {
      setConfirmation({
          isOpen: true,
          type: 'contract',
          id: id,
          title: 'Excluir Contrato',
          message: 'Tem certeza que deseja excluir este contrato permanentemente? Esta ação não pode ser desfeita.'
      });
  };

  const executeDelete = () => {
    if (confirmation.type === 'contract' && confirmation.id) {
        setContracts(contracts.filter(c => c.id !== confirmation.id));
        if (selectedContract?.id === confirmation.id) setSelectedContract(null);
    } else if (confirmation.type === 'payment' && confirmation.id && selectedContract) {
        const paymentId = confirmation.id;
        const updatedContracts = contracts.map(c => {
            if (c.id === selectedContract.id) {
                const paymentToDelete = c.payments.find(p => p.id === paymentId);
                const amountToRemove = paymentToDelete ? paymentToDelete.amount : 0;
                const updatedPaidAmount = c.paidAmount - amountToRemove;
                const updatedPayments = c.payments.filter(p => p.id !== paymentId);

                return {
                    ...c,
                    paidAmount: updatedPaidAmount,
                    payments: updatedPayments,
                    status: updatedPaidAmount >= c.amount ? 'paid' : 'active' 
                } as Contract;
            }
            return c;
        });

        setContracts(updatedContracts);
        const updatedSelected = updatedContracts.find(c => c.id === selectedContract.id) || null;
        setSelectedContract(updatedSelected);
    }
    
    setConfirmation({ isOpen: false, type: null, id: null, title: '', message: '' });
  };

  const getDaysRemaining = (dueDate: string) => {
      const diff = new Date(dueDate).getTime() - new Date().getTime();
      return Math.ceil(diff / (1000 * 3600 * 24));
  };
  
  // Close modal helper to reset states
  const closeDetailsModal = () => {
      setSelectedContract(null);
      setShowPaymentForm(false);
      setPaymentForm({ date: '', amount: '', note: '' });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-200">
                    <Landmark size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">AgroFinance</h1>
                    <p className="text-xs text-slate-500 font-medium">Gestão de Passivos</p>
                </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === 'dashboard' 
                        ? 'bg-white text-emerald-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('contracts')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === 'contracts' 
                        ? 'bg-white text-emerald-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Carteira de Contratos
                </button>
                <button 
                    onClick={() => setActiveTab('projection')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === 'projection' 
                        ? 'bg-white text-emerald-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Fluxo de Caixa
                </button>
            </div>

            <div className="flex items-center space-x-4">
                <div className="text-right hidden lg:block">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Taxa CDI Hoje</p>
                    <p className="text-sm font-bold text-slate-700">{currentCDI}% a.a.</p>
                </div>
                <button 
                    onClick={handleOpenNewContract}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl flex items-center shadow-lg shadow-emerald-200 transition-all active:scale-95"
                >
                    <Plus size={18} className="mr-2" />
                    <span className="font-medium">Novo Contrato</span>
                </button>
            </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                    <DollarSign size={20} />
                                </div>
                                <span className="text-sm font-semibold text-slate-600">Total Originado</span>
                            </div>
                            <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(stats.totalDebt)}</h3>
                            <p className="text-xs text-slate-400 mt-2">Volume total contratado</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                    <ArrowUpRight size={20} />
                                </div>
                                <span className="text-sm font-semibold text-slate-600">Amortizado</span>
                            </div>
                            <h3 className="text-3xl font-bold text-emerald-700">{formatCurrency(stats.totalPaid)}</h3>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className="bg-emerald-500 h-full rounded-full" 
                                    style={{width: `${stats.totalDebt > 0 ? (stats.totalPaid / stats.totalDebt) * 100 : 0}%`}}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                    <AlertCircle size={20} />
                                </div>
                                <span className="text-sm font-semibold text-slate-600">Saldo Devedor</span>
                            </div>
                            <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(stats.outstanding)}</h3>
                            <p className="text-xs text-slate-400 mt-2">Exposição atual</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                                    <TrendingUp size={20} />
                                </div>
                                <span className="text-sm font-semibold text-slate-600">Custo Médio</span>
                            </div>
                            <h3 className="text-3xl font-bold text-purple-900">{stats.averageCost.toFixed(2)}% <span className="text-sm text-slate-400 font-normal">a.a.</span></h3>
                            <p className="text-xs text-slate-400 mt-2">Ponderado pelo saldo</p>
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Exposição por Banco (Saldo Devedor)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <Tooltip 
                                        cursor={{fill: 'transparent'}}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100">
                                                    <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
                                                    <p className="text-lg font-bold text-emerald-700">
                                                        {formatCurrency(payload[0].value as number)}
                                                    </p>
                                                </div>
                                            );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Composição da Dívida</h3>
                        <div className="h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Turnover / Liquidation Rate Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center">
                                <CheckCircle2 size={20} className="mr-2 text-emerald-600" />
                                Taxa de Liquidação
                            </h3>
                            <p className="text-sm text-slate-500">Porcentagem de contratos quitados por instituição</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {turnoverData.map((item, index) => (
                            <div key={item.name} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-slate-700">{item.name}</span>
                                    <span className="text-xs font-medium bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-500">
                                        {item.paidContracts}/{item.totalContracts} Liquidado(s)
                                    </span>
                                </div>
                                <div className="flex items-end gap-2 mb-2">
                                    <span className="text-3xl font-bold text-emerald-600">{item.rate.toFixed(0)}%</span>
                                    <span className="text-xs text-slate-400 mb-1.5">taxa de liquidação</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div 
                                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                        style={{width: `${item.rate}%`}}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'contracts' && (
            <div className="space-y-6 animate-fade-in">
                {/* Filters / Toolbar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="relative w-full xl:w-96">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por banco ou número..." 
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-1 flex-col sm:flex-row w-full xl:w-auto items-center gap-3">
                         <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                             <span className="text-xs font-medium text-slate-500 ml-1 flex items-center">
                                <Calendar size={14} className="mr-1"/> Vencimento:
                             </span>
                             <div className="flex items-center gap-2">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase">De</span>
                                    <input 
                                        type="date" 
                                        className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 outline-none text-slate-600 bg-white"
                                        value={filterStartDate}
                                        onChange={(e) => setFilterStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase">Até</span>
                                    <input 
                                        type="date" 
                                        className="pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 outline-none text-slate-600 bg-white"
                                        value={filterEndDate}
                                        onChange={(e) => setFilterEndDate(e.target.value)}
                                    />
                                </div>
                             </div>
                         </div>
                         
                         {(filterStartDate || filterEndDate || searchTerm) && (
                            <button 
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterStartDate('');
                                    setFilterEndDate('');
                                }}
                                className="text-xs text-red-500 font-medium hover:text-red-700 whitespace-nowrap px-2"
                            >
                                Limpar filtros
                            </button>
                         )}
                    </div>

                    <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg self-end xl:self-auto">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredContracts.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search size={24} className="text-slate-300" />
                                </div>
                                <p>Nenhum contrato encontrado com os filtros atuais.</p>
                            </div>
                        ) : (
                            filteredContracts.map(contract => {
                                const progress = contract.amount > 0 ? (contract.paidAmount / contract.amount) * 100 : 0;
                                const daysRemaining = getDaysRemaining(contract.dueDate);
                                const totalAnnualRatePercent = contract.indexName === 'Prefixado' ? contract.annualRate : (contract.annualRate / 100) * currentCDI;

                                return (
                                    <div key={contract.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-all duration-300 group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                    {contract.bank.substring(0, 3).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{contract.bank}</h3>
                                                    <p className="text-xs text-slate-500 font-mono">{contract.contractNumber}</p>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide 
                                                ${contract.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {contract.status === 'paid' ? 'Liquidado' : 'Ativo'}
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-6">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs text-slate-500">Saldo Devedor</span>
                                                    <span className="text-xs font-semibold text-slate-700">{progress.toFixed(0)}% Pago</span>
                                                </div>
                                                <div className="flex items-baseline space-x-1">
                                                    <span className="text-xl font-bold text-slate-800">{formatCurrency(contract.amount - contract.paidAmount)}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                                                    <div 
                                                        className={`h-full rounded-full ${contract.status === 'paid' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                        style={{width: `${progress}%`}}
                                                    ></div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Taxa Efetiva</p>
                                                    <p className="text-sm font-semibold text-slate-700 flex items-center">
                                                        <TrendingUp size={14} className="mr-1 text-slate-400"/>
                                                        {totalAnnualRatePercent.toFixed(2)}% a.a.
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {contract.indexName === 'Prefixado' ? 'Taxa Fixa' : `${contract.annualRate}% do ${contract.indexName}`}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Vencimento</p>
                                                    <p className="text-sm font-semibold text-slate-700 flex items-center">
                                                        <Calendar size={14} className="mr-1 text-slate-400"/>
                                                        {new Date(contract.dueDate).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <p className={`text-[10px] ${daysRemaining < 30 ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>
                                                        {contract.status === 'paid' ? 'Finalizado' : `${daysRemaining} dias restantes`}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {contract.notes && (
                                                <div className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">
                                                    "{contract.notes}"
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                                            <button 
                                                onClick={() => setSelectedContract(contract)}
                                                className="flex-1 bg-white border border-slate-200 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition"
                                            >
                                                Detalhes
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(contract.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Banco</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase min-w-[200px]">Valor & Progresso</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Taxa</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredContracts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">
                                            Nenhum contrato encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredContracts.map(contract => {
                                        const progress = contract.amount > 0 ? (contract.paidAmount / contract.amount) * 100 : 0;
                                        return (
                                        <tr key={contract.id} className="hover:bg-slate-50">
                                            <td className="p-4">
                                                <div className="font-medium text-slate-800">{contract.bank}</div>
                                                <div className="text-xs text-slate-500">{contract.contractNumber}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-slate-800 mb-2">{formatCurrency(contract.amount)}</div>
                                                <div className="w-full max-w-xs">
                                                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                        <span>Pago: {formatCurrency(contract.paidAmount)}</span>
                                                        <span className="font-bold">{progress.toFixed(0)}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${contract.status === 'paid' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                            style={{width: `${progress}%`}}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                {contract.indexName === 'Prefixado' ? `${contract.annualRate}%` : `${contract.annualRate}% ${contract.indexName}`}
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                {new Date(contract.dueDate).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedContract(contract)}
                                                    className="text-slate-400 hover:text-emerald-600 p-1"
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(contract.id)} className="text-slate-400 hover:text-red-500 p-1">
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
        
        {activeTab === 'projection' && (
            <div className="space-y-8 animate-fade-in">
                
                {/* Summary Cards for Projection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
                         <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Próximos 30 dias</p>
                            <h4 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(projectionStats.next30Total)}</h4>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-md">
                            <Clock size={12} className="mr-1" />
                            Vencimento Curto Prazo
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-4 -mt-4"></div>
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pico de Caixa</p>
                            <h4 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(projectionStats.maxMonthVal)}</h4>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-blue-600 font-medium bg-blue-50 w-fit px-2 py-1 rounded-md">
                            <Calendar size={12} className="mr-1" />
                            {projectionStats.maxMonthName || '-'}
                        </div>
                    </div>

                     <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 rounded-bl-full -mr-4 -mt-4"></div>
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Projetado</p>
                            <h4 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(projectionStats.totalFuture)}</h4>
                        </div>
                         <div className="mt-4 flex items-center text-xs text-purple-600 font-medium bg-purple-50 w-fit px-2 py-1 rounded-md">
                            <TrendingUp size={12} className="mr-1" />
                            Fluxo Futuro
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
                        <div className="flex items-center">
                            <CalendarRange size={20} className="mr-2 text-emerald-600" />
                            Fluxo de Caixa Projetado
                        </div>
                        <span className="text-xs font-normal text-slate-400">Mensal vs Acumulado</span>
                    </h3>

                    {/* Cash Flow Chart */}
                    {cashFlowChartData.length > 0 && (
                        <div className="mb-6 h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={cashFlowChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                                    <YAxis 
                                        yAxisId="left"
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#64748B', fontSize: 12}} 
                                        tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} 
                                    />
                                    <YAxis 
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#94A3B8', fontSize: 10}} 
                                        tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} 
                                    />
                                    <Tooltip 
                                        cursor={{fill: '#F1F5F9'}}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100">
                                                        <p className="text-xs font-semibold text-slate-500 mb-2">{data.fullDate}</p>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-xs text-slate-400">Mensal:</span>
                                                                <span className="text-sm font-bold text-emerald-600">{formatCurrency(data.amount)}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-xs text-slate-400">Acumulado:</span>
                                                                <span className="text-sm font-bold text-blue-600">{formatCurrency(data.accumulated)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar yAxisId="left" dataKey="amount" fill="url(#colorAmount)" radius={[4, 4, 0, 0]} barSize={40} />
                                    <Line yAxisId="right" type="monotone" dataKey="accumulated" stroke="#3B82F6" strokeWidth={2} dot={{r: 3, fill: '#3B82F6'}} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    
                    {projectionData.length === 0 ? (
                         <div className="text-center py-12">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <CalendarRange size={32} />
                            </div>
                            <p className="text-slate-500 font-medium">Nenhum pagamento futuro encontrado.</p>
                            <p className="text-xs text-slate-400 mt-1">Seus contratos ativos aparecerão aqui organizados por vencimento.</p>
                        </div>
                    ) : (
                        <div className="space-y-8 mt-8">
                            {projectionData.map((group, groupIndex) => (
                                <div key={groupIndex} className="relative">
                                    <div className="flex items-center mb-4 sticky top-20 bg-white/95 backdrop-blur-sm z-10 py-2 border-b border-slate-100">
                                        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-sm font-bold mr-3">
                                            {getMonthName(group.date)}
                                        </div>
                                        <div className="h-px flex-1 bg-slate-100"></div>
                                        <span className="text-xs text-slate-400 font-medium ml-3">Total do Mês: <span className="text-slate-700 font-bold">{formatCurrency(group.total)}</span></span>
                                    </div>

                                    <div className="space-y-3 pl-2">
                                        {group.items.map(contract => {
                                            const isOverdue = new Date(contract.dueDate) < new Date() && new Date(contract.dueDate).toDateString() !== new Date().toDateString();
                                            const daysDiff = Math.ceil((new Date(contract.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                            
                                            return (
                                                <div key={contract.id} className="flex items-center group relative pl-6 pb-2">
                                                    {/* Timeline connector */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isOverdue ? 'bg-red-200' : 'bg-slate-200'} group-last:bottom-auto group-last:h-full`}></div>
                                                    <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${isOverdue ? 'bg-red-500' : 'bg-emerald-500'}`}></div>

                                                    <div className={`flex-1 bg-white border ${isOverdue ? 'border-red-200' : 'border-slate-200'} rounded-xl p-4 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ml-4`}>
                                                        <div className="flex items-center gap-4">
                                                             <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                                {contract.bank.substring(0, 3).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h5 className="font-bold text-slate-800 text-sm">{contract.bank}</h5>
                                                                    {isOverdue && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Vencido</span>}
                                                                </div>
                                                                <div className="text-xs text-slate-500 flex items-center mt-0.5">
                                                                    <span>{contract.contractNumber}</span>
                                                                    <span className="mx-1.5">•</span>
                                                                    <span>{new Date(contract.dueDate).getDate()} de {getMonthName(group.date).split(' ')[0]}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-[10px] text-slate-400 uppercase font-medium">A Liquidar</p>
                                                                <p className="text-sm font-bold text-slate-800">{formatCurrency(contract.amount - contract.paidAmount)}</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => setSelectedContract(contract)}
                                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                                title="Ver Detalhes"
                                                            >
                                                                <ArrowRight size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>

      {/* Add/Edit Modal Overlay */}
      {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
                  <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg">
                            <CreditCard size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">
                            {editingId ? 'Editar Contrato' : 'Novo Contrato Financeiro'}
                        </h3>
                      </div>
                      <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Instituição Financeira</label>
                            <input 
                                required
                                type="text"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                placeholder="Ex: Banco do Brasil"
                                value={formData.bank}
                                onChange={e => setFormData({...formData, bank: e.target.value})}
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nº Contrato</label>
                            <input 
                                required
                                type="text"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                placeholder="Ex: CR-12345"
                                value={formData.contractNumber}
                                onChange={e => setFormData({...formData, contractNumber: e.target.value})}
                            />
                        </div>
                        
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Original (R$)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                                <input 
                                    required
                                    type="number"
                                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    placeholder="0,00"
                                    value={formData.amount || ''}
                                    onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                        
                        {!editingId && (
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Já Pago (R$)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                                <input 
                                    type="number"
                                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    placeholder="0,00"
                                    value={formData.paidAmount || ''}
                                    onChange={e => setFormData({...formData, paidAmount: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                        )}

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Indexador</label>
                            <select 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white transition"
                                value={formData.indexName}
                                onChange={e => setFormData({...formData, indexName: e.target.value as any})}
                            >
                                <option value="CDI">CDI</option>
                                <option value="Prefixado">Prefixado</option>
                                <option value="IPCA">IPCA</option>
                                <option value="Selic">Selic</option>
                            </select>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {formData.indexName === 'Prefixado' ? 'Taxa Anual (%)' : `% do ${formData.indexName}`}
                            </label>
                            <input 
                                required
                                type="number"
                                step="0.01"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                placeholder={formData.indexName === 'Prefixado' ? '12.5' : '100'}
                                value={formData.annualRate || ''}
                                onChange={e => setFormData({...formData, annualRate: parseFloat(e.target.value)})}
                            />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
                            <input 
                                required
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                value={formData.startDate}
                                onChange={e => setFormData({...formData, startDate: e.target.value})}
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento Final</label>
                            <input 
                                required
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                value={formData.dueDate}
                                onChange={e => setFormData({...formData, dueDate: e.target.value})}
                            />
                        </div>
                        
                        <div className="col-span-2">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Observações / Destinação</label>
                             <textarea 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none"
                                rows={2}
                                placeholder="Ex: Custeio da safra de soja 23/24..."
                                value={formData.notes || ''}
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                             />
                        </div>

                        <div className="col-span-2 mt-4 pt-4 border-t border-slate-100 flex justify-end space-x-3">
                            <button 
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition flex items-center"
                            >
                                <Save size={18} className="mr-2" />
                                Salvar Contrato
                            </button>
                        </div>
                  </form>
              </div>
          </div>
      )}

      {/* Contract Details Modal */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg shadow-sm">
                                {selectedContract.bank.substring(0, 3).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{selectedContract.bank}</h2>
                                <p className="text-sm text-slate-500 font-mono flex items-center">
                                    <FileText size={14} className="mr-1" />
                                    {selectedContract.contractNumber}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => handleEditContract(selectedContract)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 p-2 rounded-lg transition flex items-center gap-1 text-xs font-medium"
                            title="Editar Contrato"
                        >
                            <Pencil size={16} />
                            Editar
                        </button>
                         <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border
                            ${selectedContract.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                            {selectedContract.status === 'paid' ? 'Liquidado' : 'Ativo'}
                        </div>
                        <button onClick={closeDetailsModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-8 overflow-y-auto">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                         <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-xs text-slate-500 font-medium uppercase mb-1">Valor Original</p>
                            <p className="text-xl font-bold text-slate-800">{formatCurrency(selectedContract.amount)}</p>
                         </div>
                         <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                            <p className="text-xs text-emerald-600 font-medium uppercase mb-1">Valor Amortizado</p>
                            <p className="text-xl font-bold text-emerald-700">{formatCurrency(selectedContract.paidAmount)}</p>
                         </div>
                         <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100/50">
                            <p className="text-xs text-blue-600 font-medium uppercase mb-1">Saldo Devedor</p>
                            <p className="text-xl font-bold text-blue-700">{formatCurrency(selectedContract.amount - selectedContract.paidAmount)}</p>
                         </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-slate-600">Progresso do Pagamento</span>
                            <span className="text-sm font-bold text-slate-800">
                                {((selectedContract.paidAmount / Math.max(selectedContract.amount, 1)) * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                    selectedContract.status === 'paid' ? 'bg-emerald-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${(selectedContract.paidAmount / Math.max(selectedContract.amount, 1)) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Detailed Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center">
                                <Percent size={16} className="mr-2 text-slate-400" />
                                Condições Financeiras
                            </h4>
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Indexador</span>
                                    <span className="text-sm font-medium text-slate-800">{selectedContract.indexName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Taxa Contratada</span>
                                    <span className="text-sm font-medium text-slate-800">
                                        {selectedContract.indexName === 'Prefixado' ? `${selectedContract.annualRate}% a.a.` : `${selectedContract.annualRate}% do CDI`}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Taxa Efetiva Atual (Est.)</span>
                                    <span className="text-sm font-bold text-emerald-600">
                                         {selectedContract.indexName === 'Prefixado' 
                                            ? selectedContract.annualRate.toFixed(2) 
                                            : ((selectedContract.annualRate / 100) * currentCDI).toFixed(2)}% a.a.
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center">
                                <Clock size={16} className="mr-2 text-slate-400" />
                                Prazos e Vencimentos
                            </h4>
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Data de Emissão</span>
                                    <span className="text-sm font-medium text-slate-800">{new Date(selectedContract.startDate).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Vencimento Final</span>
                                    <span className="text-sm font-medium text-slate-800">{new Date(selectedContract.dueDate).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Tempo Restante</span>
                                    <span className={`text-sm font-bold ${getDaysRemaining(selectedContract.dueDate) < 30 ? 'text-orange-500' : 'text-slate-600'}`}>
                                        {selectedContract.status === 'paid' ? '-' : `${getDaysRemaining(selectedContract.dueDate)} dias`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Payment History */}
                    <div className="mt-8">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center">
                                <History size={16} className="mr-2 text-slate-400" />
                                Histórico de Pagamentos
                            </h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        setPaymentForm({ date: new Date().toISOString().split('T')[0], amount: '', note: 'Amortização Parcial' });
                                        setShowPaymentForm(true);
                                    }}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center bg-blue-50 px-3 py-1.5 rounded-lg transition"
                                >
                                    <PieChartIcon size={14} className="mr-1" />
                                    Pagamento Parcial
                                </button>
                                <button 
                                    onClick={() => {
                                        setPaymentForm({ date: new Date().toISOString().split('T')[0], amount: '', note: '' });
                                        setShowPaymentForm(true);
                                    }}
                                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center bg-emerald-50 px-3 py-1.5 rounded-lg transition"
                                >
                                    <Plus size={14} className="mr-1" />
                                    Novo Pagamento
                                </button>
                            </div>
                        </div>
                        
                        {showPaymentForm && (
                            <form onSubmit={handleAddPayment} className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 animate-fade-in">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                                    <h5 className="text-xs font-bold uppercase text-slate-500">
                                        {paymentForm.note === 'Amortização Parcial' ? 'Amortização Parcial' : 'Novo Pagamento'}
                                    </h5>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPaymentForm(false)}
                                        className="text-slate-400 hover:text-slate-600 transition"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
                                        <input 
                                            type="date" 
                                            required 
                                            className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={paymentForm.date}
                                            onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Valor (R$)</label>
                                        <input 
                                            type="number" 
                                            required 
                                            step="0.01"
                                            className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={paymentForm.amount}
                                            onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Ex: Parcela 1"
                                            value={paymentForm.note}
                                            onChange={e => setPaymentForm({...paymentForm, note: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPaymentForm(false)}
                                        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 rounded-lg transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition shadow-sm"
                                    >
                                        Confirmar Pagamento
                                    </button>
                                </div>
                            </form>
                        )}
                        
                        {selectedContract.payments && selectedContract.payments.length > 0 ? (
                            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-100 border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Valor Pago</th>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedContract.payments.map((payment) => (
                                            <tr key={payment.id} className="hover:bg-slate-100/50 transition group">
                                                <td className="p-3 text-sm text-slate-700">
                                                    {new Date(payment.date).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="p-3 text-sm text-slate-600">
                                                    {payment.note || '-'}
                                                </td>
                                                <td className="p-3 text-sm font-medium text-emerald-600 text-right">
                                                    {formatCurrency(payment.amount)}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button 
                                                        onClick={() => handleDeletePayment(payment.id)}
                                                        className="text-slate-300 hover:text-red-500 p-1 rounded-md transition opacity-0 group-hover:opacity-100"
                                                        title="Remover Pagamento"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-6 text-center">
                                <p className="text-slate-400 text-sm">Nenhum pagamento registrado para este contrato.</p>
                            </div>
                        )}
                    </div>

                    {selectedContract.notes && (
                        <div className="mt-8 bg-amber-50 rounded-xl p-4 border border-amber-100">
                            <h4 className="text-sm font-bold text-amber-800 mb-2">Observações</h4>
                            <p className="text-sm text-amber-700 italic">{selectedContract.notes}</p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button 
                        onClick={closeDetailsModal}
                        className="px-6 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmation.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmation.title}</h3>
                    <p className="text-sm text-slate-500 mb-6">{confirmation.message}</p>
                    
                    <div className="flex space-x-3">
                        <button 
                            onClick={() => setConfirmation({ isOpen: false, type: null, id: null, title: '', message: '' })}
                            className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={executeDelete}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm transition"
                        >
                            Excluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Dashboard />);