import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const STORAGE_KEY = 'rc_company_settings';
/** Local PIN for dangerous reset (change this). Backend can also check password. */
const RESET_PIN_KEY = 'rc_reset_pin';
const DEFAULT_RESET_PIN = '1234';

export type CompanySettings = {
  companyName: string;
  phone: string;
  address: string;
  gstin: string;
};

const defaults: CompanySettings = {
  companyName: 'Ritik Chains',
  phone: '',
  address: '',
  gstin: '',
};

export function loadCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveCompanySettingsLocal(s: CompanySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function getResetPin() {
  return localStorage.getItem(RESET_PIN_KEY) || DEFAULT_RESET_PIN;
}

function setResetPin(pin: string) {
  localStorage.setItem(RESET_PIN_KEY, pin);
}

function ResetTestDataPanel() {
  const [busy, setBusy] = useState(false);
  const [clearMasters, setClearMasters] = useState(false);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const doReset = async () => {
    if (!password.trim()) {
      toast.error('Enter reset password');
      return;
    }
    if (password !== getResetPin()) {
      toast.error('Wrong reset password');
      return;
    }

    const msg = clearMasters
      ? 'Delete ALL sales, ledger, silver txns AND customers/items?\nLogin users stay.\nContinue?'
      : 'Delete ALL sales, payments, ledger, silver txns?\nCustomers & items stay (stock → 0).\nContinue?';
    if (!confirm(msg)) return;
    if (!confirm('Final confirm — cannot undo.')) return;

    setBusy(true);
    try {
      const { data } = await api.post('/reset/business', {
        confirm: 'RESET',
        clearMasters,
        password, // backend can verify if you add check
      });
      toast.success(data?.message || 'Reset done');
      setPassword('');
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Reset failed. Add /api/reset route or check permission.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 space-y-3">
      <h2 className="font-semibold text-red-800">Reset test data</h2>
      <p className="text-sm text-red-700">
        Clears bills for testing. Requires reset password (default{' '}
        <code className="bg-white px-1 rounded">1234</code> — change below).
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={clearMasters}
          onChange={(e) => setClearMasters(e.target.checked)}
        />
        Also delete customers & silver items
      </label>
      <div>
        <label className="label">Reset password *</label>
        <div className="flex gap-2">
          <input
            type={showPwd ? 'text' : 'password'}
            className="input flex-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter reset password"
            autoComplete="off"
          />
          <button
            type="button"
            className="btn-secondary whitespace-nowrap"
            onClick={() => setShowPwd((v) => !v)}
          >
            {showPwd ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="btn-secondary text-red-700 border-red-300"
        disabled={busy}
        onClick={doReset}
      >
        {busy ? 'Resetting...' : 'Reset business data'}
      </button>
    </div>
  );
}

function ChangeLoginPasswordPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!current || !next) {
      toast.error('Fill current and new password');
      return;
    }
    if (next.length < 4) {
      toast.error('New password min 4 characters');
      return;
    }
    if (next !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      toast.success('Login password changed');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e: any) {
      // fallback message if API missing
      toast.error(
        e?.response?.data?.message ||
          'Change password API not available. Add /auth/change-password on backend.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-3">
      <h2 className="font-semibold text-gray-800">Change login password</h2>
      <p className="text-xs text-gray-500">
        Password you use to sign in to the app.
      </p>
      <div>
        <label className="label">Current password</label>
        <input
          type="password"
          className="input"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className="label">New password</label>
        <input
          type="password"
          className="input"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input
          type="password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <button type="button" className="btn-primary" disabled={busy} onClick={save}>
        {busy ? 'Saving...' : 'Update login password'}
      </button>
    </div>
  );
}

function ChangeResetPinPanel() {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirm, setConfirm] = useState('');

  const save = () => {
    if (oldPin !== getResetPin()) {
      toast.error('Current reset password is wrong');
      return;
    }
    if (newPin.length < 4) {
      toast.error('New reset password min 4 characters');
      return;
    }
    if (newPin !== confirm) {
      toast.error('New reset passwords do not match');
      return;
    }
    setResetPin(newPin);
    toast.success('Reset password updated');
    setOldPin('');
    setNewPin('');
    setConfirm('');
  };

  return (
    <div className="card p-5 space-y-3 border-amber-200">
      <h2 className="font-semibold text-gray-800">Change reset password</h2>
      <p className="text-xs text-gray-500">
        This password is required before wiping test data (not login password).
        Default is <code className="bg-gray-100 px-1 rounded">1234</code>.
      </p>
      <div>
        <label className="label">Current reset password</label>
        <input
          type="password"
          className="input"
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
        />
      </div>
      <div>
        <label className="label">New reset password</label>
        <input
          type="password"
          className="input"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Confirm new reset password</label>
        <input
          type="password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button type="button" className="btn-secondary" onClick={save}>
        Update reset password
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [form, setForm] = useState<CompanySettings>({ ...defaults });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(loadCompanySettings());
    (async () => {
      try {
        const { data } = await api.get('/settings');
        const s = data?.data || data;
        if (s && (s.companyName || s.company_name)) {
          setForm((prev) => ({
            ...prev,
            companyName: s.companyName || s.company_name || prev.companyName,
            phone: s.phone || s.companyPhone || prev.phone,
            address: s.address || s.companyAddress || prev.address,
            gstin: s.gstin || s.gst || prev.gstin,
          }));
        }
      } catch {
        /* local only */
      }
    })();
  }, []);

  const save = async () => {
    if (!form.companyName.trim()) {
      toast.error('Company name required');
      return;
    }
    setSaving(true);
    try {
      saveCompanySettingsLocal(form);
      try {
        await api.put('/settings', {
          companyName: form.companyName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          gstin: form.gstin.trim(),
        });
      } catch {
        /* localStorage still saved */
      }
      toast.success('Settings saved — used on PDF & WhatsApp');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-sm text-gray-500">
          Company name on invoices, PDF & WhatsApp · security
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Company</h2>
          <p className="text-xs text-gray-500 mb-3">
            Any shop can set their own name.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Company / shop name *</label>
              <input
                className="input"
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                placeholder="e.g. Ritik Chains / Your Silver House"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Company phone"
              />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input
                className="input"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                placeholder="GST number"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <textarea
                className="input"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Company address"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Invoice numbering</h2>
          <p className="text-sm text-gray-500">
            Sequences: SALE-, PUR-, SR-, PR-, PAY-, REC- (database)
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-800 mb-1">About</h2>
          <p className="text-sm text-gray-600">
            Silver billing, inventory & accounting ERP
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Developed by <strong>ToolClub.website</strong>
          </p>
          <p className="text-xs text-gray-400 mt-2">Version 1.0.0</p>
        </section>

        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>

      <ChangeLoginPasswordPanel />
      <ChangeResetPinPanel />
      <ResetTestDataPanel />
    </div>
  );
}