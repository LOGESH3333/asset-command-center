'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getVendor, getVendorEmail, getVendorPhone } from '@/lib/supabase/vendors';
import { updateVendorAction } from '@/app/actions/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';

export default function EditVendorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVendor() {
      try {
        const { data, error: loadError } = await getVendor(id);
        if (loadError) {
          setError(loadError.message);
        } else if (data) {
          setName(data.name);
          setContactPerson(data.contact_person || '');
          setEmail(getVendorEmail(data) || '');
          setPhone(getVendorPhone(data) || '');
          setAddress(data.address || '');
        } else {
          setError('Vendor not found');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load vendor');
      } finally {
        setLoading(false);
      }
    }
    if (id) loadVendor();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vendor name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateVendorAction(id, {
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/dashboard/vendors/${id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update vendor');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href={`/dashboard/vendors/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Vendor Details
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Edit Vendor</CardTitle>
          <CardDescription>Update vendor details.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name *</Label>
              <Input
                id="vendor-name"
                placeholder="e.g. Dell, HP, Lenovo..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-contact-person">Contact Person</Label>
              <Input
                id="vendor-contact-person"
                placeholder="Primary contact name"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                placeholder="vendor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input
                id="vendor-phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-address">Address</Label>
              <Input
                id="vendor-address"
                placeholder="123 Main St, City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Link href={`/dashboard/vendors/${id}`}>
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
