import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  UserCheck,
  UserX,
  Ban,
} from 'lucide-react';
import api from '../../services/api';

interface Customer {
  id: number;
  code: string;
  name: string;
  mobile: string | null;
  altMobile?: string | null;
  email?: string | null;
  address?: string | null;
  city: string | null;
  state?: string | null;
  gstin?: string | null;
  pan?: string | null;
  notes?: string | null;
  status: string;
  groupName?: string;
  openingBalance?: string;
  creditLimit?: string;
}

const emptyForm = {
  name: '',
  mobile: '',
  altMobile: '',
  email: '',
  address: '',
  city: '',
  state: '',
  gstin: '',
  pan: '',
  notes: '',
  openingBalance: '0',
  creditLimit: '0',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { search: search || undefined };
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await api.get('/customers', { params });
      setCustomers(data.data || []);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = async (id: number) => {
    try {
      const { data } = await api.get(`/customers/${id}`);
      if (!data.success || !data.data) {
        toast.error('Customer not found');
        return;
      }
      const c = data.data;
      setEditingId(id);
      setForm({
        name: c.name || '',
        mobile: c.mobile || '',
        altMobile: c.altMobile || '',
        email: c.email || '',
        address: c.address || '',
        city: c.city || '',
        state: c.state || '',
        gstin: c.gstin || '',
        pan: c.pan || '',
        notes: c.notes || '',
        openingBalance: c.openingBalance != null ? String(c.openingBalance) : '0',
        creditLimit: c.creditLimit != null ? String(c.creditLimit) : '0',
      });
      setShowForm(true);
    } catch {
      toast.error('Failed to load customer');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
        toast.success('Customer updated');
      } else {
        await api.post('/customers', form);
        toast.success('Customer created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active <-> Inactive
  const handleToggleStatus = async (c: Customer) => {
    const next = c.status === 'active' ? 'inactive' : 'active';
    const ok = window.confirm(
      next === 'inactive'
        ? `Set "${c.name}" as INACTIVE?\nThey will be hidden from normal billing lists.`
        : `Set "${c.name}" as ACTIVE?\nThey will appear in billing again.`
    );
    if (!ok) return;

    try {
      await api.patch(`/customers/${c.id}/status`, { status: next });
      toast.success(next === 'active' ? 'Customer activated' : 'Customer deactivated');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change status');
    }
  };

  // Soft delete = inactive (same as deactivate)
  const handleDeactivate = async (c: Customer) => {
    const ok = window.confirm(
      `Deactivate customer "${c.name}"?\n\nPast transactions will be kept. You can activate again later.`
    );
    if (!ok) return;

    try {
      await api.delete(`/customers/${c.id}`);
      toast.success('Customer deactivated');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate');
    }
  };

  // Hard delete = remove forever
  const handleHardDelete = async (c: Customer) => {
    const ok1 = window.confirm(
      `⚠️ PERMANENTLY DELETE "${c.name}"?\n\nThis cannot be undone.\nIf this customer has sales, delete may fail (safe for accounts).`
    );
    if (!ok1) return;

    const ok2 = window.confirm(
      `Last confirmation:\nReally remove customer "${c.name}" (Code: ${c.code}) forever?`
    );
    if (!ok2) return;

    try {
      await api.delete(`/customers/${c.id}?hard=true`);
      toast.success('Customer permanently deleted');
      load();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          'Cannot delete — customer may have sales or ledger entries'
      );
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">Manage customer accounts</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="input pl-10"
            placeholder="Search name, mobile, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All status</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>City</th>
                <th>Status</th>
                <th className="w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className={c.status === 'inactive' ? 'opacity-60' : ''}>
                    <td className="font-mono text-xs">{c.code}</td>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.mobile || '—'}</td>
                    <td>{c.city || '—'}</td>
                    <td>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          c.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 items-center">
                        {/* Edit */}
                        <button
                          type="button"
                          className="p-1.5 text-gray-500 hover:text-primary-600"
                          title="Edit"
                          onClick={() => openEdit(c.id)}
                        >
                          <Pencil size={16} />
                        </button>

                        {/* Active / Inactive toggle */}
                        <button
                          type="button"
                          className={`p-1.5 ${
                            c.status === 'active'
                              ? 'text-amber-600 hover:text-amber-800'
                              : 'text-emerald-600 hover:text-emerald-800'
                          }`}
                          title={c.status === 'active' ? 'Set Inactive' : 'Set Active'}
                          onClick={() => handleToggleStatus(c)}
                        >
                          {c.status === 'active' ? (
                            <UserX size={16} />
                          ) : (
                            <UserCheck size={16} />
                          )}
                        </button>

                        {/* Soft deactivate */}
                        {c.status === 'active' && (
                          <button
                            type="button"
                            className="p-1.5 text-gray-500 hover:text-orange-600"
                            title="Deactivate"
                            onClick={() => handleDeactivate(c)}
                          >
                            <Ban size={16} />
                          </button>
                        )}

                        {/* Permanent delete */}
                        <button
                          type="button"
                          className="p-1.5 text-gray-500 hover:text-red-600"
                          title="Delete permanently"
                          onClick={() => handleHardDelete(c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Pencil size={12} /> Edit
        </span>
        <span className="flex items-center gap-1">
          <UserX size={12} className="text-amber-600" /> / <UserCheck size={12} className="text-emerald-600" /> Active ↔ Inactive
        </span>
        <span className="flex items-center gap-1">
          <Ban size={12} /> Deactivate
        </span>
        <span className="flex items-center gap-1">
          <Trash2 size={12} className="text-red-600" /> Remove forever
        </span>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button type="button" className="p-1 text-gray-400 hover:text-gray-600" onClick={closeForm}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mobile</label>
                  <input
                    className="input"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Alt Mobile</label>
                  <input
                    className="input"
                    value={form.altMobile}
                    onChange={(e) => setForm({ ...form, altMobile: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Address</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City</label>
                  <input
                    className="input"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">State</label>
                  <input
                    className="input"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">GSTIN</label>
                  <input
                    className="input"
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">PAN</label>
                  <input
                    className="input"
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Opening Balance</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Credit Limit</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}