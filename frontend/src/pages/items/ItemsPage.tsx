import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  Search,
  Power,
} from 'lucide-react';
import api from '../../services/api';

interface SilverItem {
  id: number;
  code: string;
  name: string;
  categoryId?: number | null;
  metalType?: string;
  purity?: string | number;
  purchaseRate?: string | number;
  saleRate?: string | number;
  currentQty?: string | number;
  currentNet?: string | number;
  currentFine?: string | number;
  minStock?: string | number;
  status?: string;
  notes?: string | null;
}

function n(v: unknown) {
  const x = parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
}

function formatINR(v: number) {
  return '₹ ' + n(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const emptyForm = {
  code: '',
  name: '',
  purity: '100',
  purchaseRate: '',
  currentNet: '0',
  minStock: '0',
  notes: '',
  status: 'active',
};

export default function ItemsPage() {
  const [items, setItems] = useState<SilverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<SilverItem | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/items', {
        params: { limit: 500, search: search || undefined },
      });
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch {
      toast.error('Failed to load silver stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (item: SilverItem) => {
    setEditingId(item.id);
    setForm({
      code: item.code || '',
      name: item.name || '',
      purity: String(item.purity ?? '100'),
      purchaseRate: String(item.purchaseRate ?? ''),
      currentNet: String(item.currentNet ?? item.currentQty ?? '0'),
      minStock: String(item.minStock ?? '0'),
      notes: item.notes || '',
      status: item.status || 'active',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Silver name required');
    if (!form.code.trim()) return toast.error('Code required');

    setSaving(true);
    try {
      const stockG = n(form.currentNet);
      const purity = n(form.purity) || 100;
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        metalType: 'silver',
        purity,
        purchaseRate: n(form.purchaseRate),
        saleRate: n(form.purchaseRate),
        currentQty: stockG,
        currentNet: stockG,
        currentGross: stockG,
        currentFine: (stockG * purity) / 100,
        minStock: n(form.minStock),
        notes: form.notes || null,
        status: form.status,
        makingCharge: 0,
        unit: 'g',
      };

      if (editingId) {
        const { data } = await api.put(`/items/${editingId}`, payload);
        toast.success('Silver updated');
        if (data?.data) setSelected(data.data);
      } else {
        const { data } = await api.post('/items', payload);
        toast.success('Silver added');
        if (data?.data) setSelected(data.data);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: SilverItem) => {
    const next = item.status === 'active' ? 'inactive' : 'active';
    try {
      const { data } = await api.patch(`/items/${item.id}/status`, {
        status: next,
      });
      toast.success(next === 'active' ? 'Activated' : 'Deactivated');
      if (data?.data) setSelected(data.data);
      await load();
    } catch (e: any) {
      try {
        await api.put(`/items/${item.id}`, {
          name: item.name,
          status: next,
        });
        toast.success(next === 'active' ? 'Activated' : 'Deactivated');
        await load();
      } catch (e2: any) {
        toast.error(
          e?.response?.data?.message ||
            e2?.response?.data?.message ||
            'Status change failed'
        );
      }
    }
  };

  const hardDelete = async (item: SilverItem) => {
    if (
      !confirm(
        `PERMANENTLY delete "${item.name}"?\nOnly works if not used in any sale.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/items/${item.id}`, {
        params: { hard: 'true' },
      });
      toast.success('Permanently deleted');
      if (selected?.id === item.id) setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Cannot delete — used in sales. Use Deactivate instead.'
      );
    }
  };

  const filtered = items.filter((i) => {
    if (!showInactive && i.status === 'inactive') return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.name?.toLowerCase().includes(q) ||
      i.code?.toLowerCase().includes(q) ||
      String(i.id).includes(q)
    );
  });

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Silver Stock</h1>
          <p className="text-sm text-gray-500">
            Purchase silver · stock in grams · activate / deactivate
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={load}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={16} />
            Add Silver
          </button>
        </div>
      </div>

      <div className="card p-3 mb-4 flex flex-wrap items-center gap-3">
        <Search size={18} className="text-gray-400" />
        <input
          className="input border-0 shadow-none flex-1 min-w-[160px]"
          placeholder="Search by name, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <button type="button" className="btn-secondary" onClick={load}>
          Search
        </button>
      </div>

      {showForm && (
        <div className="card p-5 mb-6 border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">
              {editingId ? 'Edit Silver' : 'Add Silver'}
            </h2>
            <button
              type="button"
              className="p-1 text-gray-500"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Code *</label>
              <input
                className="input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Silver name *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tunch / Purity %</label>
              <input
                type="number"
                className="input"
                value={form.purity}
                onChange={(e) => setForm({ ...form, purity: e.target.value })}
                step="any"
              />
            </div>
            <div>
              <label className="label">Purchase rate (₹ / g)</label>
              <input
                type="number"
                className="input"
                value={form.purchaseRate}
                onChange={(e) =>
                  setForm({ ...form, purchaseRate: e.target.value })
                }
                step="any"
              />
            </div>
            <div>
              <label className="label">Current stock (grams)</label>
              <input
                type="number"
                className="input"
                value={form.currentNet}
                onChange={(e) =>
                  setForm({ ...form, currentNet: e.target.value })
                }
                step="any"
              />
            </div>
            <div>
              <label className="label">Min stock alert (g)</label>
              <input
                type="number"
                className="input"
                value={form.minStock}
                onChange={(e) =>
                  setForm({ ...form, minStock: e.target.value })
                }
                step="any"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Saving...' : editingId ? 'Update Silver' : 'Save Silver'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="px-5 py-3 border-b border-gray-100 font-semibold">
            All Silver ({filtered.length})
          </div>
          <div className="table-container overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th className="text-right">Purity</th>
                  <th className="text-right">Stock (g)</th>
                  <th className="text-right">Fine (g)</th>
                  <th className="text-right">Buy ₹/g</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      No silver — click Add Silver
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const stockG = n(item.currentNet ?? item.currentQty);
                    const purity = n(item.purity) || 100;
                    const fineG =
                      n(item.currentFine) || (stockG * purity) / 100;
                    const inactive = item.status === 'inactive';
                    return (
                      <tr
                        key={item.id}
                        className={
                          (selected?.id === item.id ? 'bg-primary-50 ' : '') +
                          (inactive ? 'opacity-60 ' : '')
                        }
                        onClick={() => setSelected(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="font-mono text-xs">{item.code}</td>
                        <td className="font-medium">{item.name}</td>
                        <td className="text-right">{purity}</td>
                        <td className="text-right font-medium">
                          {stockG.toFixed(3)}
                        </td>
                        <td className="text-right text-emerald-700">
                          {fineG.toFixed(3)}
                        </td>
                        <td className="text-right">
                          {formatINR(n(item.purchaseRate))}
                        </td>
                        <td>
                          <span
                            className={
                              inactive
                                ? 'text-xs text-gray-500'
                                : 'text-xs text-emerald-600'
                            }
                          >
                            {item.status || 'active'}
                          </span>
                        </td>
                        <td>
                          <div
                            className="flex gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className={
                                inactive
                                  ? 'p-1 text-emerald-600 hover:bg-emerald-50 rounded'
                                  : 'p-1 text-amber-600 hover:bg-amber-50 rounded'
                              }
                              title={inactive ? 'Activate' : 'Deactivate'}
                              onClick={() => toggleStatus(item)}
                            >
                              <Power size={16} />
                            </button>
                            <button
                              type="button"
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete permanently"
                              onClick={() => hardDelete(item)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Silver details</h2>
          {!selected ? (
            <p className="text-sm text-gray-400">Click a row for details</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">Code</div>
                <div className="font-mono font-medium">{selected.code}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Name</div>
                <div className="font-medium text-lg">{selected.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 border p-3">
                  <div className="text-xs text-gray-500">Stock</div>
                  <div className="font-bold">
                    {n(selected.currentNet ?? selected.currentQty).toFixed(3)} g
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 border p-3">
                  <div className="text-xs text-emerald-700">Fine</div>
                  <div className="font-bold text-emerald-800">
                    {(
                      n(selected.currentFine) ||
                      (n(selected.currentNet ?? selected.currentQty) *
                        (n(selected.purity) || 100)) /
                        100
                    ).toFixed(3)}{' '}
                    g
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div
                  className={
                    selected.status === 'inactive'
                      ? 'text-gray-500'
                      : 'text-emerald-600 font-medium'
                  }
                >
                  {selected.status || 'active'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => openEdit(selected)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => toggleStatus(selected)}
                >
                  {selected.status === 'inactive' ? 'Activate' : 'Deactivate'}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-red-700"
                  onClick={() => hardDelete(selected)}
                >
                  Delete permanent
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}