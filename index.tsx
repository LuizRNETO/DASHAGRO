import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Trash2, DollarSign, TrendingUp, Calendar, 
  PieChart as PieChartIcon, Landmark, ArrowUpRight, 
  Search, X, Save, AlertCircle, FileText, CreditCard,
  LayoutGrid, List, Eye, Clock, Percent,
  History, Pencil, CalendarRange, CheckCircle2, ArrowRight, AlertTriangle, Filter,
  Calculator, RotateCcw, CalendarDays, Layers, TrendingDown, BarChart3,
  Cloud, CloudOff, Loader2, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend, CartesianGrid, AreaChart, Area,
  ComposedChart, Line
} from 'recharts';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO SUPABASE ---
// Chaves configuradas
const SUPABASE_URL = 'https://ndpgfoxycavzhqlwdrvw.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_dPcP59CFidQ5Ha5hTwwXHA_nLvc5b8p';

// Inicialização do cliente Supabase
const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

// --- Types ---

interface Payment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

interface Installment {
    id: string;
    number: number;
    dueDate: string;
    originalAmount: number;
}

interface Contract {
  id: string;
  bank: string;
  contractNumber: string;
  indexName: 'CDI' | 'Prefixado' | 'IPCA' | 'Selic' | 'Sem Indexador';
  annualRate: number; // e.g., 110 (% of CDI) or 12 (Fixed %)
  amount: number;
  paidAmount: number;
  payments: Payment[];
  installments: Installment[];
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

const getMonthOptions = () => {
    const months = [];
    for(let i=0; i<12; i++) {
        const date = new Date(2000, i, 1);
        const name = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
        months.push({ value: i, label: name.charAt(0).toUpperCase() + name.slice(1) });
    }
    return months;
};

// Fixed: Date manipulation using UTC strings to avoid Timezone shifts (Day +1 or -1 issues)
const addMonths = (dateStr: string, months: number) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    // Create date using UTC to avoid timezone rollovers
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().split('T')[0];
};

const getContractDisplayStatus = (contract: Contract) => {
    // Floating point tolerance
    if (contract.paidAmount >= contract.amount - 0.01) {
        return 'liquidado';
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    // Safe date parsing
    const [y, m, d] = contract.dueDate.split('-').map(Number);
    const dueDate = new Date(y, m-1, d, 12, 0, 0);
    
    if (dueDate < today) {
        return 'vencido';
    }
    
    return 'ativo';
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
      installments: [
          { id: 'i1', number: 1, dueDate: '2023-07-15', originalAmount: 50000 },
          { id: 'i2', number: 2, dueDate: '2024-01-15', originalAmount: 150000 },
          { id: 'i3', number: 3, dueDate: '2024-07-15', originalAmount: 150000 },
          { id: 'i4', number: 4, dueDate: '2025-01-15', originalAmount: 150000 },
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
      installments: [
          { id: 'i5', number: 1, dueDate: '2022-12-01', originalAmount: 60000 },
          { id: 'i6', number: 2, dueDate: '2023-06-01', originalAmount: 60000 },
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
        installments: [
            { id: 'i7', number: 1, dueDate: '2025-02-10', originalAmount: 375000 },
            { id: 'i8', number: 2, dueDate: '2026-02-10', originalAmount: 375000 },
        ],
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
        installments: [
             { id: 'i9', number: 1, dueDate: '2023-11-20', originalAmount: 250000 },
        ],
        startDate: '2022-11-20',
        dueDate: '2023-11-20',
        status: 'paid',
        notes: 'Aquisição de Trator'
    }
  ];

// --- Components ---

export default function Dashboard() {
  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'local'>('local');

  // --- DATA LOADING LOGIC (Hybrid: Supabase first, then LocalStorage) ---
  useEffect(() => {
    const loadData = async () => {
        let loaded = false;

        // 1. Try Supabase
        if (supabase) {
            setSyncStatus('syncing');
            try {
                const { data, error } = await supabase
                    .from('app_state')
                    .select('contracts')
                    .order('id', { ascending: true }) // Assuming single row or grabbing first
                    .limit(1)
                    .single();

                if (error) {
                    throw error;
                }

                if (data && data.contracts) {
                    setContracts(data.contracts);
                    loaded = true;
                    setSyncStatus('synced');
                } else {
                    // No data yet, but connected
                    setSyncStatus('synced');
                }
            } catch (err) {
                console.error("Supabase load error (fallback to local):", err);
                setSyncStatus('error');
            }
        } else {
            setSyncStatus('local');
        }

        // 2. Fallback to LocalStorage if Supabase failed or not configured
        if (!loaded) {
            try {
                const saved = localStorage.getItem('agrofinance_contracts');
                if (saved) {
                    setContracts(JSON.parse(saved));
                }
            } catch (e) {
                console.error("Local load error:", e);
            }
        }
        setIsLoading(false);
    };

    loadData();
  }, []);

  // --- DATA SAVING LOGIC ---
  useEffect(() => {
    if (isLoading) return; // Don't save while initial load is happening

    const saveData = async () => {
        // 1. Save to LocalStorage (Always acts as cache/offline)
        localStorage.setItem('agrofinance_contracts', JSON.stringify(contracts));

        // 2. Save to Supabase (Sync)
        if (supabase) {
            setSyncStatus('syncing');
            try {
                // First, check if any row exists
                const { data: existing, error: fetchError } = await supabase.from('app_state').select('id').limit(1);
                
                if (fetchError) throw fetchError;

                if (existing && existing.length > 0) {
                     const { error: updateError } = await supabase
                        .from('app_state')
                        .update({ contracts: contracts, updated_at: new Date() })
                        .eq('id', existing[0].id);
                     if (updateError) throw updateError;
                } else {
                     const { error: insertError } = await supabase
                        .from('app_state')
                        .insert([{ contracts: contracts }]);
                     if (insertError) throw insertError;
                }
                setSyncStatus('synced');
            } catch (err) {
                console.error("Supabase save error:", err);
                setSyncStatus('error');
            }
        }
    };
    
    // Debounce save to avoid too many API calls
    const timeoutId = setTimeout(saveData, 2000);
    return () => clearTimeout(timeoutId);

  }, [contracts, isLoading]);

  // Sync across tabs (Local Only)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'agrofinance_contracts') {
            if (e.newValue) {
                try {
                    setContracts(JSON.parse(e.newValue));
                } catch (err) {
                    console.error("Erro na sincronização:", err);
                }
            }
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contracts' | 'projection'>('dashboard');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Projection View State
  const [projectionYear, setProjectionYear] = useState(new Date().getFullYear());
  const [projectionMonth, setProjectionMonth] = useState(new Date().getMonth());
  const [projectionViewType, setProjectionViewType] = useState<'active' | 'all'>('active');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Confirmation Modal State
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    type: 'contract' | 'payment' | 'revert_payment' | null;
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
  const [numInstallments, setNumInstallments] = useState<number>(1);
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
      notes: '',
      installments: []
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
        let rate = 0;
        if (c.indexName === 'Prefixado') rate = c.annualRate;
        else if (c.indexName === 'Sem Indexador') rate = 0;
        else rate = (c.annualRate / 100) * currentCDI;

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

  // Logic to calculate remaining balance of a specific installment
  const getInstallmentBalance = (contract: Contract, installment: Installment) => {
      const prevInstallments = (contract.installments || [])
        .filter(i => i.number < installment.number)
        .reduce((sum, i) => sum + i.originalAmount, 0);
      
      const totalPaid = contract.paidAmount;
      const amountCoveredPreviously = Math.min(totalPaid, prevInstallments);
      const remainingPaidForThis = Math.max(0, totalPaid - amountCoveredPreviously);
      
      const balance = Math.max(0, installment.originalAmount - remainingPaidForThis);
      return balance;
  };

  const detailedMonthlyData = useMemo(() => {
      const items: Array<{
          id: string;
          day: number;
          date: Date;
          bank: string;
          contractNumber: string;
          description: string;
          totalAmount: number;
          remainingAmount: number;
          status: 'paid' | 'partial' | 'pending';
          contract: Contract;
      }> = [];

      contracts.forEach(c => {
          // If view is active only, skip paid contracts
          if (projectionViewType === 'active' && c.status === 'paid') return;

          if (c.installments && c.installments.length > 0) {
              c.installments.forEach(inst => {
                  const [y, m, day] = inst.dueDate.split('-').map(Number);
                  
                  if (y === projectionYear && (m - 1) === projectionMonth) {
                      const balance = getInstallmentBalance(c, inst);
                      
                      let status: 'paid' | 'partial' | 'pending' = 'pending';
                      if (balance <= 0.01) status = 'paid';
                      else if (balance < inst.originalAmount) status = 'partial';

                      // If view is 'active', skip if fully paid. 
                      // If view is 'all', show everything (even if paid).
                      if (projectionViewType === 'active' && balance <= 0.01) return;

                      // Fix: Set time to Noon (12:00) to avoid timezone shifting days
                      items.push({
                          id: `${c.id}-${inst.id}`,
                          day: day,
                          date: new Date(y, m-1, day, 12, 0, 0), 
                          bank: c.bank,
                          contractNumber: c.contractNumber,
                          description: `Parcela ${inst.number}/${c.installments.length}`,
                          totalAmount: inst.originalAmount,
                          remainingAmount: balance,
                          status,
                          contract: c
                      });
                  }
              });
          } else {
               // Fallback for no installments
               const [y, m, day] = c.dueDate.split('-').map(Number);
               if (y === projectionYear && (m - 1) === projectionMonth) {
                   const balance = c.amount - c.paidAmount;
                   // If view is 'active', skip if paid.
                   if (projectionViewType === 'active' && balance <= 0.01) return;

                   let status: 'paid' | 'partial' | 'pending' = 'pending';
                   if (balance <= 0.01) status = 'paid';
                   else if (c.paidAmount > 0) status = 'partial';

                   items.push({
                       id: c.id,
                       day: day,
                       date: new Date(y, m-1, day, 12, 0, 0),
                       bank: c.bank,
                       contractNumber: c.contractNumber,
                       description: 'Pagamento Único / Restante',
                       totalAmount: c.amount,
                       remainingAmount: balance,
                       status,
                       contract: c
                   });
               }
          }
      });

      return items.sort((a, b) => a.day - b.day);
  }, [contracts, projectionYear, projectionMonth, projectionViewType]);

  const projectionData = useMemo(() => {
    const groups: Record<string, { date: Date, total: number, items: Contract[] }> = {};
    // Force viewType to 'active' for Cash Flow chart to show remaining debt correctly
    const isAllView = false; 
    
    contracts.filter(c => c.status !== 'paid').forEach(c => {
        if (c.installments && c.installments.length > 0) {
            let remainingPaid = c.paidAmount;
            
            c.installments.forEach(inst => {
                const instAmount = inst.originalAmount;
                if (remainingPaid >= instAmount) {
                    remainingPaid -= instAmount;
                    // Fully paid. Skip for projection.
                } else {
                    // Partially paid or unpaid
                    const amountDue = instAmount - remainingPaid;
                    remainingPaid = 0; 
                    
                    const [year, month, day] = inst.dueDate.split('-').map(Number);
                    const dateKey = `${year}-${month}`;
                    
                    if (!groups[dateKey]) {
                        groups[dateKey] = {
                            date: new Date(year, month - 1, 1, 12, 0, 0),
                            total: 0,
                            items: []
                        };
                    }
                    groups[dateKey].total += amountDue;
                    if (!groups[dateKey].items.find(item => item.id === c.id)) {
                        groups[dateKey].items.push(c);
                    }
                }
            });
        } else {
            // Fallback for no installments
            const [year, month, day] = c.dueDate.split('-').map(Number);
            const dateKey = `${year}-${month}`;
            
            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: new Date(year, month - 1, 1, 12, 0, 0),
                    total: 0,
                    items: []
                };
            }
            
            const debt = c.amount - c.paidAmount;
            if (debt > 0.01) {
                groups[dateKey].total += debt;
                groups[dateKey].items.push(c);
            }
        }
    });

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [contracts]);

  // Additional stats for the Projection Tab
  const projectionStats = useMemo(() => {
      const now = new Date();
      now.setHours(0,0,0,0);
      const next30Days = new Date(now);
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
          
          if (p.date >= now && p.date <= next30Days) {
              next30Total += p.total;
          }
      });
      
      // Sync Total Projected with Outstanding Debt for consistency
      if (Math.abs(totalFuture - stats.outstanding) > 1.0) {
          totalFuture = stats.outstanding; 
      }

      return { next30Total, totalFuture, maxMonthVal, maxMonthName };
  }, [projectionData, stats.outstanding]);

  const cashFlowChartData = useMemo(() => {
    // Logic: Start with Total Outstanding Debt and subtract as time goes on
    let currentBalance = stats.outstanding;
    
    // We need to insert a "Today" point
    const data = [{
        name: 'Hoje',
        amount: 0,
        balance: currentBalance,
        fullDate: new Date().toLocaleDateString('pt-BR')
    }];

    projectionData.forEach(p => {
        // Balance after this month's payments
        currentBalance -= p.total;
        data.push({
            name: `${getMonthName(p.date).substring(0, 3)}/${p.date.getFullYear()}`,
            amount: p.total,
            balance: Math.max(0, currentBalance), // Prevent negative due to rounding
            fullDate: getMonthName(p.date)
        });
    });

    return data;
  }, [projectionData, stats.outstanding]);

  const monthlyPaymentChartData = useMemo(() => {
    return projectionData.map(p => ({
        name: `${getMonthName(p.date).substring(0, 3)}/${p.date.getFullYear()}`,
        amount: p.total,
        fullDate: getMonthName(p.date)
    }));
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

  // --- Handlers ---

  // Handle opening the form for a new contract
  const handleOpenNewContract = () => {
    setEditingId(null);
    setNumInstallments(1);
    const today = new Date().toISOString().split('T')[0];
    const nextYear = addMonths(today, 12);

    setFormData({
        bank: '',
        contractNumber: '',
        indexName: 'CDI',
        annualRate: 0,
        amount: 0,
        paidAmount: 0,
        startDate: today,
        dueDate: nextYear,
        status: 'active',
        notes: '',
        installments: [
            { id: Math.random().toString(36).substr(2, 9), number: 1, dueDate: nextYear, originalAmount: 0 }
        ]
      });
    setShowForm(true);
  };

  // Handle opening the form to edit an existing contract
  const handleEditContract = (contract: Contract) => {
    setEditingId(contract.id);
    setNumInstallments(contract.installments.length || 1);
    
    // If legacy contract without installments, create one default
    let currentInstallments = contract.installments;
    if (!currentInstallments || currentInstallments.length === 0) {
        currentInstallments = [{ 
            id: Math.random().toString(36).substr(2, 9), 
            number: 1, 
            dueDate: contract.dueDate, 
            originalAmount: contract.amount 
        }];
    }

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
        notes: contract.notes,
        installments: currentInstallments
    });
    // Close detail modal if open
    setSelectedContract(null); 
    setShowForm(true);
  };

  const handleGenerateInstallments = () => {
      const amount = formData.amount || 0;
      if (amount <= 0) return;
      
      const valPerInst = amount / numInstallments;
      const startDate = formData.startDate || new Date().toISOString().split('T')[0];
      const newInstallments: Installment[] = [];

      for (let i = 0; i < numInstallments; i++) {
          newInstallments.push({
              id: Math.random().toString(36).substr(2, 9),
              number: i + 1,
              // Default to +6 months per installment roughly
              dueDate: addMonths(startDate, (i + 1) * 6), 
              originalAmount: parseFloat(valPerInst.toFixed(2))
          });
      }
      
      // Adjust last installment for rounding errors
      const currentSum = newInstallments.reduce((acc, curr) => acc + curr.originalAmount, 0);
      const diff = amount - currentSum;
      if (Math.abs(diff) > 0.001) {
          newInstallments[newInstallments.length - 1].originalAmount += diff;
      }

      setFormData({
          ...formData,
          installments: newInstallments,
          dueDate: newInstallments[newInstallments.length - 1].dueDate // Set final due date
      });
  };

  const updateInstallment = (index: number, field: keyof Installment, value: any) => {
      if (!formData.installments) return;
      const updated = [...formData.installments];
      updated[index] = { ...updated[index], [field]: value };
      
      // Auto-recalculate total amount based on installments sum
      const newTotal = updated.reduce((acc, curr) => acc + (Number(curr.originalAmount) || 0), 0);
      
      setFormData({
          ...formData,
          installments: updated,
          amount: newTotal,
          // Update main due date if the last installment changes
          dueDate: updated[updated.length - 1].dueDate
      });
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
                    paidAmount: c.paidAmount, 
                    startDate: formData.startDate!,
                    dueDate: formData.dueDate!,
                    installments: formData.installments
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
            paidAmount: Number(formData.paidAmount) || 0,
            payments: [], // Initialize empty payments
            installments: formData.installments || []
        };
        setContracts([...contracts, newContract]);
      }

      setShowForm(false);
      setEditingId(null);
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

  const handleRevertLastPayment = (contractId: string) => {
      setConfirmation({
          isOpen: true,
          type: 'revert_payment',
          id: contractId,
          title: 'Reverter Pagamento',
          message: 'Deseja reverter o último pagamento registrado neste contrato? O saldo devedor será atualizado.'
      });
  };

  const handleResetData = () => {
    if (confirm('Tem certeza? Isso apagará todos os dados salvos e restaurará os contratos de exemplo.')) {
        localStorage.removeItem('agrofinance_contracts');
        setContracts(INITIAL_CONTRACTS);
    }
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
    } else if (confirmation.type === 'revert_payment' && confirmation.id) {
        const updatedContracts = contracts.map(c => {
            if (c.id === confirmation.id && c.payments.length > 0) {
                // Get the last payment added (assuming latest is last in array)
                const lastPayment = c.payments[c.payments.length - 1];
                const newPaidAmount = c.paidAmount - lastPayment.amount;
                const newPayments = c.payments.slice(0, -1);
                
                return {
                    ...c,
                    paidAmount: newPaidAmount,
                    payments: newPayments,
                    status: newPaidAmount >= c.amount ? 'paid' : 'active'
                } as Contract;
            }
            return c;
        });
        setContracts(updatedContracts);
    }
    
    setConfirmation({ isOpen: false, type: null, id: null, title: '', message: '' });
  };

  const getDaysRemaining = (dueDate: string) => {
      // Create date using split to allow simple comparison without timezone shifting
      const [y, m, d] = dueDate.split('-').map(Number);
      const due = new Date(y, m-1, d);
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const diff = due.getTime() - today.getTime();
      return Math.ceil(diff / (1000 * 3600 * 24));
  };
  
  // Close modal helper to reset states
  const closeDetailsModal = () => {
      setSelectedContract(null);
      setShowPaymentForm(false);
      setPaymentForm({ date: '', amount: '', note: '' });
  };

  // Helper to calculate installment status
  const getInstallmentStatus = (inst: Installment, contract: Contract) => {
      // Logic: Waterflow. We sum all previous installments. If total paid > sum previous, we have covered some of this one.
      const prevInstallments = (contract.installments || [])
        .filter(i => i.number < inst.number)
        .reduce((sum, i) => sum + i.originalAmount, 0);
      
      const totalPaid = contract.paidAmount;
      const coverage = totalPaid - prevInstallments;

      if (coverage >= inst.originalAmount - 0.01) return 'paid';
      if (coverage > 0.01) return 'partial';
      return 'pending';
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

                {/* Cloud Sync Status Indicator */}
                <div 
                    className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-300
                    ${syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                      syncStatus === 'syncing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      syncStatus === 'error' ? 'bg-red-50 text-red-700 border-red-100' :
                      'bg-slate-100 text-slate-500 border-slate-200'}`}
                    title={
                        syncStatus === 'synced' ? 'Dados sincronizados na nuvem' :
                        syncStatus === 'syncing' ? 'Salvando alterações...' :
                        syncStatus === 'error' ? 'Erro ao salvar. Verifique a chave API.' :
                        'Modo Offline (Local)'
                    }
                >
                    {syncStatus === 'synced' && <Cloud size={14} className="mr-1.5" />}
                    {syncStatus === 'syncing' && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                    {syncStatus === 'error' && <CloudOff size={14} className="mr-1.5" />}
                    {syncStatus === 'local' && <Save size={14} className="mr-1.5" />}
                    
                    <span className="hidden sm:inline">
                        {syncStatus === 'synced' ? 'Salvo' :
                         syncStatus === 'syncing' ? 'Salvando' :
                         syncStatus === 'error' ? 'Erro Sync' :
                         'Offline'}
                    </span>
                </div>

                <button 
                    onClick={handleResetData}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Restaurar dados de exemplo (Apaga alterações locais)"
                >
                    <RotateCcw size={20} />
                </button>
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

        {/* ... existing 'contracts' tab code ... */}
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
                                const totalAnnualRatePercent = contract.indexName === 'Prefixado' 
                                    ? contract.annualRate 
                                    : contract.indexName === 'Sem Indexador'
                                        ? 0
                                        : (contract.annualRate / 100) * currentCDI;
                                const status = getContractDisplayStatus(contract);

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
                                                ${status === 'liquidado' ? 'bg-emerald-100 text-emerald-700' : 
                                                  status === 'vencido' ? 'bg-red-100 text-red-700' : 
                                                  'bg-blue-100 text-blue-700'}`}>
                                                {status === 'liquidado' ? 'Liquidado' : status === 'vencido' ? 'Vencido' : 'Ativo'}
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
                                                        className={`h-full rounded-full ${status === 'liquidado' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                        style={{width: `${progress}%`}}
                                                    ></div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Taxa Efetiva</p>
                                                    <p className="text-sm font-semibold text-slate-700 flex items-center">
                                                        <TrendingUp size={14} className="mr-1 text-slate-400"/>
                                                        {contract.indexName === 'Sem Indexador' ? 'Isento' : `${totalAnnualRatePercent.toFixed(2)}% a.a.`}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {contract.indexName === 'Prefixado' 
                                                            ? 'Taxa Fixa' 
                                                            : contract.indexName === 'Sem Indexador'
                                                                ? '-'
                                                                : `${contract.annualRate}% do ${contract.indexName}`}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Vencimento</p>
                                                    <p className="text-sm font-semibold text-slate-700 flex items-center">
                                                        <Calendar size={14} className="mr-1 text-slate-400"/>
                                                        {
                                                            // Safe date formatting
                                                            (() => {
                                                                const [y, m, d] = contract.dueDate.split('-').map(Number);
                                                                return new Date(y, m-1, d).toLocaleDateString('pt-BR');
                                                            })()
                                                        }
                                                    </p>
                                                    <p className={`text-[10px] ${daysRemaining < 30 && status !== 'liquidado' ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>
                                                        {status === 'liquidado' ? 'Finalizado' : `${daysRemaining} dias restantes`}
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
                                            {contract.payments.length > 0 && (
                                                <button 
                                                    onClick={() => handleRevertLastPayment(contract.id)}
                                                    className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                                    title="Reverter Último Pagamento"
                                                >
                                                    <RotateCcw size={18} />
                                                </button>
                                            )}
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
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase w-24">Status</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Taxa</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredContracts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                                            Nenhum contrato encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredContracts.map(contract => {
                                        const progress = contract.amount > 0 ? (contract.paidAmount / contract.amount) * 100 : 0;
                                        const status = getContractDisplayStatus(contract);
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
                                                            className={`h-full rounded-full transition-all duration-500 ${status === 'liquidado' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                            style={{width: `${progress}%`}}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                                    ${status === 'liquidado' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                                      status === 'vencido' ? 'bg-red-50 text-red-700 border-red-100' : 
                                                      'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                    {status === 'liquidado' ? 'Liquidado' : status === 'vencido' ? 'Vencido' : 'Ativo'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                {contract.indexName === 'Prefixado' 
                                                    ? `${contract.annualRate}%` 
                                                    : contract.indexName === 'Sem Indexador'
                                                        ? 'Isento'
                                                        : `${contract.annualRate}% ${contract.indexName}`}
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                {
                                                    (() => {
                                                        const [y, m, d] = contract.dueDate.split('-').map(Number);
                                                        return new Date(y, m-1, d).toLocaleDateString('pt-BR');
                                                    })()
                                                }
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setSelectedContract(contract)}
                                                    className="text-slate-400 hover:text-emerald-600 p-1"
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                {contract.payments.length > 0 && (
                                                    <button 
                                                        onClick={() => handleRevertLastPayment(contract.id)}
                                                        className="text-slate-400 hover:text-amber-500 p-1"
                                                        title="Reverter Último Pagamento"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                )}
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
        
        {/* ... existing 'projection' tab code ... */}
        {activeTab === 'projection' && (
            <div className="space-y-8 animate-fade-in">
                
                {/* Header with Filter */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Fluxo de Caixa</h2>
                        <p className="text-sm text-slate-500">Projeção e acompanhamento de pagamentos futuros.</p>
                    </div>
                    <div className="bg-white p-1 rounded-lg border border-slate-200 flex items-center shadow-sm">
                         <button 
                            onClick={() => setProjectionViewType('active')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${
                                projectionViewType === 'active' 
                                ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <Filter size={14} />
                            A Pagar
                        </button>
                        <button 
                            onClick={() => setProjectionViewType('all')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${
                                projectionViewType === 'all' 
                                ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <Layers size={14} />
                            Visão Total
                        </button>
                    </div>
                </div>

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
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dívida Total</p>
                            <h4 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(projectionStats.totalFuture)}</h4>
                        </div>
                         <div className="mt-4 flex items-center text-xs text-purple-600 font-medium bg-purple-50 w-fit px-2 py-1 rounded-md">
                            <TrendingUp size={12} className="mr-1" />
                            Saldo Devedor Atual
                        </div>
                    </div>
                </div>

                {/* Monthly Detail Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <CalendarDays size={20} className="mr-2 text-emerald-600" />
                            Detalhamento Mensal
                        </h3>
                        
                        <div className="flex items-center gap-2">
                             <select 
                                value={projectionMonth} 
                                onChange={(e) => setProjectionMonth(parseInt(e.target.value))}
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 outline-none"
                            >
                                {getMonthOptions().map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <select 
                                value={projectionYear} 
                                onChange={(e) => setProjectionYear(parseInt(e.target.value))}
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 outline-none"
                            >
                                {[...Array(10)].map((_, i) => {
                                    const y = new Date().getFullYear() - 2 + i;
                                    return <option key={y} value={y}>{y}</option>
                                })}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                         <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-3 text-xs font-semibold text-slate-500 uppercase w-16 text-center">Dia</th>
                                    <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Banco / Contrato</th>
                                    <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                                    <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">
                                        {projectionViewType === 'active' ? 'Valor a Pagar' : 'Valor Total'}
                                    </th>
                                    <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-center w-24">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {detailedMonthlyData.length > 0 ? (
                                    detailedMonthlyData.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 group transition">
                                            <td className="p-3 text-center">
                                                <div className="inline-flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                                                    <span className="text-lg leading-none">{item.day}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-700 text-sm">{item.bank}</div>
                                                <div className="text-xs text-slate-400 font-mono">{item.contractNumber}</div>
                                            </td>
                                            <td className="p-3 text-sm text-slate-600">
                                                {item.description}
                                                {item.status === 'partial' && (
                                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-100 text-yellow-700">
                                                        Parcial
                                                    </span>
                                                )}
                                                {item.status === 'paid' && projectionViewType === 'all' && (
                                                     <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                                                        Pago
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className={`font-bold ${item.status === 'paid' && projectionViewType === 'all' ? 'text-emerald-600 line-through opacity-75' : 'text-slate-800'}`}>
                                                    {formatCurrency(projectionViewType === 'active' ? item.remainingAmount : item.totalAmount)}
                                                </div>
                                                {item.status === 'partial' && projectionViewType === 'active' && (
                                                    <div className="text-[10px] text-slate-400">Total: {formatCurrency(item.totalAmount)}</div>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => setSelectedContract(item.contract)}
                                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                    title="Ver Detalhes do Contrato"
                                                >
                                                    <ArrowRight size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <CheckCircle2 size={32} className="mb-2 text-slate-200" />
                                                <p className="text-sm font-medium">Nenhum pagamento previsto para este mês.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {detailedMonthlyData.length > 0 && (
                                <tfoot className="bg-slate-50 border-t border-slate-200">
                                    <tr>
                                        <td colSpan={3} className="p-3 text-right text-xs font-bold text-slate-500 uppercase">Total do Mês:</td>
                                        <td className="p-3 text-right text-sm font-bold text-emerald-700">
                                            {formatCurrency(detailedMonthlyData.reduce((acc, curr) => acc + (projectionViewType === 'active' ? curr.remainingAmount : curr.totalAmount), 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* New Bar Chart for Monthly Payments */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
                        <div className="flex items-center">
                            <BarChart3 size={20} className="mr-2 text-emerald-600" />
                            Cronograma de Pagamentos Mensais
                        </div>
                        <span className="text-xs font-normal text-slate-400">Volume de amortização por mês</span>
                    </h3>
                    {monthlyPaymentChartData.length > 0 && (
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyPaymentChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#64748B', fontSize: 12}} 
                                        dy={10} 
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#64748B', fontSize: 12}} 
                                        tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} 
                                    />
                                    <Tooltip 
                                        cursor={{fill: '#F1F5F9'}}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100">
                                                        <p className="text-xs font-semibold text-slate-500 mb-1">{data.fullDate}</p>
                                                        <p className="text-lg font-bold text-emerald-700">
                                                            {formatCurrency(payload[0].value as number)}
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
                        <div className="flex items-center">
                            <TrendingDown size={20} className="mr-2 text-emerald-600" />
                            Saldo Devedor Projetado (Run-off)
                        </div>
                        <span className="text-xs font-normal text-slate-400">Evolução do Saldo Devedor</span>
                    </h3>

                    {/* Cash Flow Chart - Updated to be Outstanding Balance decreasing */}
                    {cashFlowChartData.length > 0 && (
                        <div className="mb-6 h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={cashFlowChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#64748B', fontSize: 12}} 
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
                                                                <span className="text-xs text-slate-400">Pagamento Mês:</span>
                                                                <span className="text-sm font-bold text-emerald-600">{formatCurrency(data.amount)}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-xs text-slate-400">Saldo Restante:</span>
                                                                <span className="text-sm font-bold text-red-600">{formatCurrency(data.balance)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="balance" 
                                        stroke="#EF4444" 
                                        fillOpacity={1} 
                                        fill="url(#colorBalance)" 
                                        strokeWidth={2}
                                        name="Saldo Devedor"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>

      {/* Add/Edit Modal Overlay */}
      {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
                  <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
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
                        {/* Basic Info */}
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">Data Início (Emissão)</label>
                            <input 
                                required
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                value={formData.startDate}
                                onChange={e => setFormData({...formData, startDate: e.target.value})}
                            />
                        </div>

                         <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Indexador / Taxa</label>
                             <div className="flex gap-2">
                                <select 
                                    className="w-1/2 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white transition text-sm"
                                    value={formData.indexName}
                                    onChange={e => {
                                        const newVal = e.target.value;
                                        setFormData({
                                            ...formData, 
                                            indexName: newVal as any,
                                            annualRate: newVal === 'Sem Indexador' ? 0 : formData.annualRate
                                        });
                                    }}
                                >
                                    <option value="CDI">CDI</option>
                                    <option value="Prefixado">Prefixado</option>
                                    <option value="IPCA">IPCA</option>
                                    <option value="Selic">Selic</option>
                                    <option value="Sem Indexador">Sem Indexador</option>
                                </select>
                                <input 
                                    required
                                    type="number"
                                    step="0.01"
                                    disabled={formData.indexName === 'Sem Indexador'}
                                    className={`w-1/2 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm ${formData.indexName === 'Sem Indexador' ? 'bg-slate-100 text-slate-400' : ''}`}
                                    placeholder={formData.indexName === 'Prefixado' ? '12.5' : '100'}
                                    value={formData.annualRate || ''}
                                    onChange={e => setFormData({...formData, annualRate: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>

                        {/* Installment Configuration Section */}
                        <div className="col-span-2 border-t border-b border-slate-100 py-4 my-2">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center">
                                    <Calculator size={16} className="mr-2 text-slate-400" />
                                    Configuração de Parcelas
                                </h4>
                                <div className="text-xs text-slate-500">
                                    Total: <span className="font-bold text-emerald-600">{formatCurrency(formData.amount || 0)}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-end gap-3 mb-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Valor Total do Contrato (R$)</label>
                                    <input 
                                        type="number"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={formData.amount || ''}
                                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Nº Parcelas</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        max="60"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={numInstallments}
                                        onChange={e => setNumInstallments(parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleGenerateInstallments}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition h-[38px] flex items-center"
                                >
                                    Gerar
                                </button>
                            </div>

                            {/* Dynamic Inputs for Installments */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-48 overflow-y-auto space-y-2">
                                {(formData.installments || []).map((inst, idx) => (
                                    <div key={inst.id} className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 w-6">#{inst.number}</span>
                                        <input 
                                            type="date"
                                            className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                            value={inst.dueDate}
                                            onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)}
                                        />
                                        <div className="relative flex-1">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">R$</span>
                                            <input 
                                                type="number"
                                                className="w-full border border-slate-200 rounded-md pl-6 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                                value={inst.originalAmount}
                                                onChange={(e) => updateInstallment(idx, 'originalAmount', parseFloat(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {(!formData.installments || formData.installments.length === 0) && (
                                    <p className="text-xs text-center text-slate-400 py-2">Clique em "Gerar" para criar as parcelas.</p>
                                )}
                            </div>
                        </div>

                        {!editingId && (
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Já Pago (Saldo Inicial)</label>
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

                        <div className="col-span-2 mt-4 pt-4 border-t border-slate-100 flex justify-end space-x-3 sticky bottom-0 bg-white py-2">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
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
                                        {selectedContract.indexName === 'Prefixado' ? `${selectedContract.annualRate}% a.a.` : selectedContract.indexName === 'Sem Indexador' ? 'Isento' : `${selectedContract.annualRate}% do CDI`}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-500">Taxa Efetiva Atual (Est.)</span>
                                    <span className="text-sm font-bold text-emerald-600">
                                         {selectedContract.indexName === 'Prefixado' 
                                            ? selectedContract.annualRate.toFixed(2) 
                                            : selectedContract.indexName === 'Sem Indexador'
                                                ? 'Isento'
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

                    {/* Installments Schedule */}
                    <div className="mb-8">
                        <h4 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <CalendarRange size={16} className="mr-2 text-slate-400" />
                                Cronograma de Parcelas
                            </div>
                        </h4>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase w-12 text-center">#</th>
                                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Valor Original</th>
                                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(selectedContract.installments || []).sort((a,b) => a.number - b.number).map((inst) => {
                                        const status = getInstallmentStatus(inst, selectedContract);
                                        return (
                                            <tr key={inst.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-sm text-slate-400 font-medium text-center">{inst.number}</td>
                                                <td className="p-3 text-sm text-slate-700">
                                                    {(() => {
                                                        const [y, m, d] = inst.dueDate.split('-').map(Number);
                                                        return new Date(y, m-1, d).toLocaleDateString('pt-BR');
                                                    })()}
                                                </td>
                                                <td className="p-3 text-sm font-medium text-slate-700 text-right">
                                                    {formatCurrency(inst.originalAmount)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {status === 'paid' && (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                            PAGO
                                                        </span>
                                                    )}
                                                    {status === 'partial' && (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-yellow-100 text-yellow-700">
                                                            PARCIAL
                                                        </span>
                                                    )}
                                                    {status === 'pending' && (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                                                            PENDENTE
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(!selectedContract.installments || selectedContract.installments.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="p-4 text-center text-xs text-slate-400">
                                                Cronograma não configurado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    {/* Payment History */}
                    <div className="mt-8">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center">
                                <History size={16} className="mr-2 text-slate-400" />
                                Histórico de Pagamentos (Realizado)
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
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Data do Pagamento</label>
                                        <input 
                                            type="date" 
                                            required 
                                            className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={paymentForm.date}
                                            onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Valor Pago (R$)</label>
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
                                            placeholder="Ex: Parcela 1 com Juros"
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
                        
                        {(selectedContract.payments || []).length > 0 ? (
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
                            Confirmar
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