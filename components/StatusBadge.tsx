import React from 'react';
import {
  ClockIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArchiveBoxXMarkIcon,
  NoSymbolIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { Status } from '../types';

// Centralized Configuration Object
export const STATUS_CONFIG: Record<string, { label: string; classes: string; dotColor: string; icon: any }> = {
  pending: { 
    label: 'Pendente', 
    classes: 'bg-amber-50 text-amber-700 ring-amber-600/20 hover:bg-amber-100', 
    dotColor: 'bg-amber-500', 
    icon: ClockIcon 
  },
  waiting: { 
    label: 'Aguardando', 
    classes: 'bg-sky-50 text-sky-700 ring-sky-700/10 hover:bg-sky-100', 
    dotColor: 'bg-sky-500', 
    icon: ClockIcon
  },
  ok: { 
    label: 'Regular', 
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100', 
    dotColor: 'bg-emerald-500', 
    icon: CheckIcon 
  },
  issue: { 
    label: 'Irregularidade', 
    classes: 'bg-rose-50 text-rose-700 ring-rose-600/20 hover:bg-rose-100', 
    dotColor: 'bg-rose-500', 
    icon: ExclamationTriangleIcon 
  },
  expired: { 
    label: 'Vencido', 
    classes: 'bg-orange-50 text-orange-700 ring-orange-600/20 hover:bg-orange-100', 
    dotColor: 'bg-orange-500', 
    icon: ArchiveBoxXMarkIcon 
  },
  waived: { 
    label: 'Dispensado', 
    classes: 'bg-slate-50 text-slate-600 ring-slate-500/10 hover:bg-slate-100', 
    dotColor: 'bg-slate-400', 
    icon: NoSymbolIcon 
  }
};

// Component: Status Dot (Small indicator)
export const StatusDot = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${config.dotColor}`} title={config.label}></div>
    );
}

// Component: Static Badge
export const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <span className={`inline-flex items-center gap-x-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${config.classes}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
        {config.label}
      </span>
    );
};

// Component: Interactive Selector
export const StatusSelector = ({ status, onChange }: { status: string, onChange: (val: string) => void }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="relative group inline-block">
      <div className={`inline-flex items-center gap-x-2 rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-all shadow-sm cursor-pointer ${config.classes}`}>
        <Icon className="w-4 h-4" />
        {config.label}
        <ChevronDownIcon className="w-3 h-3 opacity-50 ml-1" />
      </div>
      <select 
        value={status}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      >
        {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
          <option key={key} value={key}>
             {conf.label}
          </option>
        ))}
      </select>
    </div>
  );
};