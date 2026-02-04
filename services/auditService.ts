import { supabase } from '../supabaseClient';
import { AuditState, PropertyData, Party, AuditItem, Lien } from '../types';
import { PROPERTY_CHECKLIST_TEMPLATE } from '../data/defaults';

// --- Fetch Full State ---
export const fetchAuditState = async (): Promise<AuditState> => {
  try {
    const { data: properties, error: propError } = await supabase.from('properties').select('*').order('created_at');
    const { data: parties, error: partyError } = await supabase.from('parties').select('*').order('created_at');
    const { data: items, error: itemsError } = await supabase.from('audit_items').select('*');
    const { data: liens, error: liensError } = await supabase.from('liens').select('*').order('created_at'); // Fetch liens
    const { data: settings, error: settingsError } = await supabase.from('audit_settings').select('*').single();

    // If any major fetch fails (likely due to missing credentials or setup), 
    // return empty state so app can load in "offline/local" mode.
    if (propError || partyError || itemsError) {
      console.warn("Supabase fetch failed (likely misconfigured or empty), defaulting to local state.", propError, partyError, itemsError);
      return {
        properties: [],
        parties: [],
        liens: [],
        generalNotes: ''
      };
    }

    // Map flat items to nested structure
    const mappedProperties: PropertyData[] = (properties || []).map((p: any) => ({
      ...p,
      items: items?.filter((i: any) => i.parent_id === p.id && i.parent_type === 'property') || []
    }));

    const mappedParties: Party[] = (parties || []).map((p: any) => ({
      ...p,
      items: items?.filter((i: any) => i.parent_id === p.id && i.parent_type === 'party') || []
    }));

    const mappedLiens: Lien[] = (liens || []).map((l: any) => ({
      id: l.id,
      propertyId: l.property_id,
      registrationNumber: l.registration_number,
      relatedMatricula: l.related_matricula, // Map DB column to Type
      type: l.type,
      description: l.description,
      creditor: l.creditor,
      value: l.value,
      isActive: l.is_active
    }));

    return {
      properties: mappedProperties,
      parties: mappedParties,
      liens: mappedLiens,
      generalNotes: settings?.general_notes || ''
    };
  } catch (error: any) {
    // Handle 'signal is aborted without reason' or other fetch errors
    if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('signal')) {
       console.warn("Fetch aborted or interrupted (using fallback state):", error.message);
       return { properties: [], parties: [], liens: [], generalNotes: '' };
    }
    console.error("Critical error in fetchAuditState:", error);
    // Return empty state to prevent UI crash
    return { properties: [], parties: [], liens: [], generalNotes: '' };
  }
};

// --- Properties ---
export const createProperty = async (property: PropertyData) => {
  // 1. Create Property
  const { items, ...propData } = property;
  const { data, error } = await supabase.from('properties').insert(propData).select().single();
  if (error) throw error;

  // 2. Create Default Items for Property
  const itemsToInsert = items.map(item => ({
    ...item,
    id: undefined, // Let DB generate UUID
    parent_id: data.id,
    parent_type: 'property'
  }));

  // Need to return the property with the NEW IDs for the items
  const { data: insertedItems, error: itemsError } = await supabase.from('audit_items').insert(itemsToInsert).select();
  if (itemsError) throw itemsError;

  return { ...data, items: insertedItems };
};

export const updateProperty = async (id: string, updates: Partial<PropertyData>) => {
  const { error } = await supabase.from('properties').update(updates).eq('id', id);
  if (error) console.error(error);
};

export const deleteProperty = async (id: string) => {
  // Cascade delete items usually handled by DB, but safe to do manually or rely on FK constraints if set
  await supabase.from('audit_items').delete().eq('parent_id', id);
  await supabase.from('liens').delete().eq('property_id', id); // Delete liens manually if cascade not set
  await supabase.from('properties').delete().eq('id', id);
};

// --- Parties ---
export const createParty = async (party: Party) => {
  const { items, ...partyData } = party;
  const { data, error } = await supabase.from('parties').insert(partyData).select().single();
  if (error) throw error;

  const itemsToInsert = items.map(item => ({
    ...item,
    id: undefined,
    parent_id: data.id,
    parent_type: 'party'
  }));

  const { data: insertedItems, error: itemsError } = await supabase.from('audit_items').insert(itemsToInsert).select();
  if (itemsError) throw itemsError;

  return { ...data, items: insertedItems };
};

export const updateParty = async (id: string, updates: Partial<Party>) => {
  const { error } = await supabase.from('parties').update(updates).eq('id', id);
  if (error) console.error(error);
};

export const deleteParty = async (id: string) => {
  await supabase.from('audit_items').delete().eq('parent_id', id);
  await supabase.from('parties').delete().eq('id', id);
};

// --- Items ---
export const createAuditItem = async (item: AuditItem, parentId: string, parentType: 'property' | 'party') => {
  const itemPayload = {
    ...item,
    id: undefined, // Let DB generate UUID if it was a temp ID
    parent_id: parentId,
    parent_type: parentType
  };
  const { data, error } = await supabase.from('audit_items').insert(itemPayload).select().single();
  if (error) throw error;
  return data;
};

export const updateAuditItem = async (id: string, updates: Partial<AuditItem>) => {
  const { error } = await supabase.from('audit_items').update(updates).eq('id', id);
  if (error) console.error(error);
};

export const deleteAuditItem = async (id: string) => {
  const { error } = await supabase.from('audit_items').delete().eq('id', id);
  if (error) console.error(error);
};

// --- Liens (Ônus) ---
export const createLien = async (lien: Lien) => {
  const payload = {
    property_id: lien.propertyId,
    registration_number: lien.registrationNumber,
    related_matricula: lien.relatedMatricula, // Map field
    type: lien.type,
    description: lien.description,
    creditor: lien.creditor,
    value: lien.value,
    is_active: lien.isActive
  };
  const { data, error } = await supabase.from('liens').insert(payload).select().single();
  if (error) throw error;
  return {
    id: data.id,
    propertyId: data.property_id,
    registrationNumber: data.registration_number,
    relatedMatricula: data.related_matricula,
    type: data.type,
    description: data.description,
    creditor: data.creditor,
    value: data.value,
    isActive: data.is_active
  } as Lien;
};

export const updateLien = async (id: string, updates: Partial<Lien>) => {
  const payload: any = {};
  if (updates.registrationNumber !== undefined) payload.registration_number = updates.registrationNumber;
  if (updates.relatedMatricula !== undefined) payload.related_matricula = updates.relatedMatricula;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.creditor !== undefined) payload.creditor = updates.creditor;
  if (updates.value !== undefined) payload.value = updates.value;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { error } = await supabase.from('liens').update(payload).eq('id', id);
  if (error) console.error(error);
};

export const deleteLien = async (id: string) => {
  const { error } = await supabase.from('liens').delete().eq('id', id);
  if (error) console.error(error);
};

// --- Settings ---
export const updateGeneralNotes = async (notes: string) => {
  const { error } = await supabase.from('audit_settings').update({ general_notes: notes }).eq('id', 1);
  if (error) console.error(error);
};