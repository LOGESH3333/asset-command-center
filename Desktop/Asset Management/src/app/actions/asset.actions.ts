"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getAssets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(`
      *,
      asset_categories(name),
      vendors(name),
      users(first_name, last_name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching assets:", error);
    return [];
  }
  return data;
}

export async function getAssetById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(`
      *,
      asset_categories(name),
      vendors(name),
      users(first_name, last_name)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching asset:", error);
    return null;
  }
  return data;
}

export async function createAsset(formData: FormData) {
  const supabase = await createClient();
  
  const rawData = {
    asset_tag: formData.get("asset_tag") as string,
    name: formData.get("name") as string,
    category_id: formData.get("category_id") as string || null,
    vendor_id: formData.get("vendor_id") as string || null,
    cost: parseFloat(formData.get("cost") as string) || 0,
    purchase_date: formData.get("purchase_date") as string || null,
    warranty_expiry: formData.get("warranty_expiry") as string || null,
    status: formData.get("status") as string || "Available",
    notes: formData.get("notes") as string,
  };

  const { error } = await supabase.from("assets").insert([rawData]);

  if (error) {
    console.error("Error creating asset:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/assets");
  return { success: true };
}

export async function updateAsset(id: string, formData: FormData) {
  const supabase = await createClient();
  
  const rawData = {
    asset_tag: formData.get("asset_tag") as string,
    name: formData.get("name") as string,
    category_id: formData.get("category_id") as string || null,
    vendor_id: formData.get("vendor_id") as string || null,
    cost: parseFloat(formData.get("cost") as string) || 0,
    purchase_date: formData.get("purchase_date") as string || null,
    warranty_expiry: formData.get("warranty_expiry") as string || null,
    status: formData.get("status") as string,
    notes: formData.get("notes") as string,
  };

  const { error } = await supabase
    .from("assets")
    .update(rawData)
    .eq("id", id);

  if (error) {
    console.error("Error updating asset:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/assets");
  revalidatePath(`/dashboard/assets/${id}`);
  return { success: true };
}

export async function deleteAsset(id: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting asset:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/assets");
  return { success: true };
}
