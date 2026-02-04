export type Status = 'pending' | 'waiting' | 'ok' | 'issue' | 'expired' | 'waived';

export interface AuditItem {
  id: string;
  category: string;
  name: string;
  description?: string;
  status: Status;
  notes: string;
  updatedAt: string;
}

export interface Party {
  id: string;
  type: 'PF' | 'PJ';
  name: string;
  doc: string; // CPF or CNPJ
  role: 'buyer' | 'seller';
  items: AuditItem[];
}

export interface Lien {
  id: string;
  propertyId: string;
  registrationNumber: string; // e.g., R-04/14.230
  relatedMatricula?: string; // Specific matricula number if different or explicit
  type: string; // Hipoteca, Penhora, Usufruto
  description: string;
  creditor: string;
  value: number;
  isActive: boolean; // True = Gravame Ativo, False = Baixado
}

export interface PropertyData {
  id: string;
  name: string;
  matricula: string;
  cartorio: string;
  area: string; // in Hectares
  municipio: string;
  items: AuditItem[];
}

export interface AuditState {
  properties: PropertyData[];
  parties: Party[];
  liens: Lien[]; // Global list of liens linked by propertyId
  generalNotes: string;
}

export interface AnalysisResult {
  riskLevel: 'Baixo' | 'Médio' | 'Alto';
  summary: string;
  recommendations: string[];
}