import { supabaseAdmin } from './admin';
import type { VendorInsert, VendorUpdate } from './vendors';

function buildVendorPayload(vendor: VendorInsert | VendorUpdate): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (vendor.name !== undefined) payload.name = vendor.name.trim();
  if (vendor.contact_person !== undefined) {
    payload.contact_person = vendor.contact_person?.trim() || null;
  }
  if (vendor.address !== undefined) {
    payload.address = vendor.address?.trim() || null;
  }

  if (vendor.email !== undefined) {
    const email = vendor.email?.trim() || null;
    payload.email = email;
    payload.contact_email = email;
  }
  if (vendor.phone !== undefined) {
    const phone = vendor.phone?.trim() || null;
    payload.phone = phone;
    payload.contact_phone = phone;
  }

  return payload;
}

export async function insertVendorRow(vendor: VendorInsert) {
  if (!vendor.name?.trim()) {
    return { data: null, error: { message: 'Vendor name is required.' } };
  }

  const payload = buildVendorPayload(vendor);
  return supabaseAdmin.from('vendors').insert([payload]).select('*').single();
}

export async function updateVendorRow(id: string, vendor: VendorUpdate) {
  const payload = buildVendorPayload(vendor);

  if (Object.keys(payload).length === 0) {
    return { data: null, error: { message: 'No updates provided.' } };
  }

  return supabaseAdmin.from('vendors').update(payload).eq('id', id).select('*').single();
}

export async function getVendorSafe(id: string) {
  return supabaseAdmin.from('vendors').select('*').eq('id', id).single();
}
