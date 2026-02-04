import { AuditItem } from "../types";

const generateId = () => Math.random().toString(36).substr(2, 9);

const createItem = (category: string, name: string, description: string): AuditItem => ({
  id: generateId(),
  category,
  name,
  description,
  status: 'pending',
  notes: '',
  updatedAt: new Date().toISOString()
});

export const PROPERTY_CHECKLIST_TEMPLATE = [
  // --- Registral (Cartório de Imóveis) ---
  createItem('Registral', 'Matrícula Atualizada (Vintenária)', 'Certidão de inteiro teor com cadeia dominial de 20 anos.'),
  createItem('Registral', 'Certidão de Ônus Reais', 'Verificação de hipotecas, penhoras, alienações fiduciárias ou usufruto.'),
  createItem('Registral', 'Certidão de Ações Reais e Pessoais', 'Ações Reipersecutórias que possam atingir o imóvel.'),
  
  // --- Cadastral (INCRA/Receita) ---
  createItem('Cadastral', 'CCIR (INCRA) Atualizado', 'Certificado de Cadastro de Imóvel Rural quitado e válido.'),
  createItem('Cadastral', 'CNIR (Vinculação Receita/INCRA)', 'Comprovante de sincronização cadastral (CAFIR).'),
  
  // --- Fiscal (Impostos) ---
  createItem('Fiscal', 'ITR (Últimos 5 anos)', 'Comprovantes de entrega (DIAT/DIAC) e pagamento ou CND de ITR.'),
  createItem('Fiscal', 'CND de Obras (Receita Federal)', 'Certidão para averbação de benfeitorias/construções na matrícula.'),
  
  // --- Ambiental (Ouro da Auditoria Rural) ---
  createItem('Ambiental', 'CAR (Cadastro Ambiental Rural)', 'Recibo de inscrição e análise da situação (Ativo/Pendente/Cancelado).'),
  createItem('Ambiental', 'Georreferenciamento (SIGEF)', 'Certificação de limites no INCRA (obrigatório p/ transferência dependendo da área).'),
  createItem('Ambiental', 'ADA (IBAMA)', 'Ato Declaratório Ambiental (anual), necessário para isenção de ITR em áreas de preservação.'),
  createItem('Ambiental', 'Certidão Negativa de Embargos (IBAMA)', 'Verifica multas e embargos ambientais federais.'),
  createItem('Ambiental', 'Certidão Negativa de Embargos (ICMBio)', 'Verifica infrações em Unidades de Conservação Federais.'),
  createItem('Ambiental', 'Certidão Ambiental Estadual', 'Negativa de débitos e infrações no órgão ambiental do estado (ex: SEMAD, CETESB).'),
  createItem('Ambiental', 'Outorga de Água / Dispensa', 'Direito de uso de recursos hídricos (poços, captação em rio, represas).'),
  
  // --- Outros ---
  createItem('Outros', 'Certidão de Uso e Ocupação do Solo', 'Emitida pela Prefeitura (zoneamento, perímetro urbano/rural).'),
  createItem('Outros', 'Contratos Agrários', 'Existência de Arrendamento ou Parceria (Direito de Preferência do arrendatário).'),
  createItem('Outros', 'Certidão de Aforamento/Laudêmio', 'Necessário apenas se for terreno de marinha ou da União (SPU).')
];

export const PARTY_PF_CHECKLIST_TEMPLATE = [
  // --- Pessoal/Civil ---
  createItem('Pessoal', 'RG e CPF (Cópia Autenticada)', 'Conferência de dados e validade.'),
  createItem('Pessoal', 'Certidão de Nascimento/Casamento', 'Atualizada (90 dias) para verificar regime de bens e óbito de cônjuge.'),
  createItem('Pessoal', 'Pacto Antenupcial', 'Se houver, verificar o registro.'),
  createItem('Pessoal', 'Certidão de Interdição, Tutela e Curatela', 'Cartório de Registro Civil (Verifica capacidade civil da parte).'),
  
  // --- Fiscal ---
  createItem('Fiscal', 'CND Federal (Tributos e Dívida Ativa)', 'Abrange Receita Federal e PGFN (União).'),
  createItem('Fiscal', 'CND Estadual', 'Tributos Estaduais (ICMS, ITCMD) no domicílio e local do imóvel.'),
  createItem('Fiscal', 'CND Municipal', 'Tributos municipais (ISS, taxas) no domicílio.'),
  
  // --- Jurídico/Processual ---
  createItem('Jurídico', 'CND Trabalhista (CNDT)', 'Débitos inadimplidos na Justiça do Trabalho (Banco Nacional).'),
  createItem('Jurídico', 'Distribuição de Feitos Trabalhistas', 'Ações trabalhistas em andamento (Risco de penhora).'),
  createItem('Jurídico', 'Distribuição Cível (Estadual)', 'Ações de execução, cobrança, indenização na comarca de domicílio e imóvel.'),
  createItem('Jurídico', 'Distribuição Cível (Federal)', 'Processos na Justiça Federal (Execuções fiscais federais, MPF).'),
  createItem('Jurídico', 'Distribuição Criminal', 'Estadual e Federal (Crimes ambientais, lavagem de dinheiro).'),
  createItem('Jurídico', 'Certidão de Protestos (5 ou 10 anos)', 'Cartórios de protesto do domicílio e local do imóvel.'),
  createItem('Jurídico', 'Certidão de Indisponibilidade (CNIB)', 'Consulta à Central Nacional de Indisponibilidade de Bens.')
];

export const PARTY_PJ_CHECKLIST_TEMPLATE = [
  // --- Societário ---
  createItem('Societário', 'Contrato Social / Estatuto', 'Última alteração consolidada.'),
  createItem('Societário', 'Certidão Simplificada (Junta Comercial)', 'Atualizada (30 dias) - Verifica validade e administradores.'),
  createItem('Societário', 'Ata de Eleição de Diretoria', 'Se S/A ou Associação, para verificar quem assina.'),
  
  // --- Fiscal ---
  createItem('Fiscal', 'Cartão CNPJ', 'Situação cadastral ativa.'),
  createItem('Fiscal', 'CND Federal (Tributos e Contribuições)', 'União, PGFN e Previdenciária (INSS).'),
  createItem('Fiscal', 'CND Estadual', 'ICMS e Dívida Ativa Estadual.'),
  createItem('Fiscal', 'CND Municipal', 'ISS e Taxas (Mobiliário).'),
  createItem('Fiscal', 'CRF - Regularidade FGTS', 'Caixa Econômica Federal.'),
  
  // --- Jurídico ---
  createItem('Jurídico', 'CNDT Trabalhista', 'Banco Nacional de Devedores Trabalhistas.'),
  createItem('Jurídico', 'Distribuição Cível e Execuções Fiscais', 'Estadual e Federal (sede e filiais).'),
  createItem('Jurídico', 'Certidão de Falência e Recuperação Judicial', 'Cartório Distribuidor da sede da empresa.'),
  createItem('Jurídico', 'Certidão de Protestos', 'Cartórios da sede.')
];