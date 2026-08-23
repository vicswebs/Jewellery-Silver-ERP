import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Scale, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';

type Tab = 'deposit' | 'sell' | 'palta' | 'ledger';

function n(v: unknown) {
  const x = parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
}

function formatINR(v: number) {
  return '₹ ' + n(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function SilverDeskPage() {
  const [tab, setTab] = useState<Tab>('deposit');
  const [parties, setParties] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [partyId, setPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [grossWt, setGrossWt] = useState('');
  const [purity, setPurity] = useState('100');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [oldRate, setOldRate] = useState('');
  const [newRate, setNewRate] = useState('');
  const [paltaFine, setPaltaFine] = useState('');
  const [settleMode, setSettleMode] = useState('cash');
  const [balance, setBalance] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const gross = n(grossWt);
  const pur = n(purity);
  const rt = n(rate);
  const fine = Math.round(((gross * pur) / 100) * 1000) / 1000;
  const amount = Math.round(fine * rt * 100) / 100;

  const pFine = n(paltaFine);
  const oR = n(oldRate);
  const nR = n(newRate);
  const rateDiff = Math.round((nR - oR) * 100) / 100;
  const paltaAmount = Math.round(pFine * rateDiff * 100) / 100;

  const loadParties = async () => {
    const { data } = await api.get('/silver/parties/customers');
    setParties(Array.isArray(data?.data) ? data.data : []);
  };

  const loadTxns = async (id?: string) => {
    const params: any = {};
    if (id) {
      params.partyType = 'customer';
      params.partyId = id;
    }
    const { data } = await api.get('/silver/txns', { params });
    setTxns(Array.isArray(data?.data) ? data.data : []);
  };

  const loadBalance = async (id: string) => {
    if (!id) {
      setBalance(null);
      return;
    }
    try {
      const { data } = await api.get(`/silver/balance/customer/${id}`);
      if (data?.success && data.data) {
        setBalance({
          fineBalance: n(data.data.fineBalance),
          totalDepositFine: n(data.data.totalDepositFine),
          totalIssueFine: n(data.data.totalIssueFine),
        });
      } else setBalance(null);
    } catch {
      setBalance(null);
    }
  };

  const reloadAll = async (id?: string) => {
    setLoading(true);
    setError('');
    try {
      await loadParties();
      await loadTxns(id);
      if (id) await loadBalance(id);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Load failed';
      setError(String(msg));
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, []);

  useEffect(() => {
    if (partyId) {
      const p = parties.find((x) => String(x.id) === String(partyId));
      setPartyName(p?.name || '');
      loadBalance(partyId);
      loadTxns(partyId).catch(() => {});
    } else {
      setPartyName('');
      setBalance(null);
      loadTxns().catch(() => {});
    }
  }, [partyId]);

  const resetForm = () => {
    setGrossWt('');
    setPurity('100');
    setRate('');
    setNotes('');
    setOldRate('');
    setNewRate('');
    setPaltaFine('');
    setSettleMode('cash');
  };

  const saveDeposit = async () => {
    if (!partyId) return toast.error('Select party');
    if (gross <= 0) return toast.error('Enter weight');
    setSaving(true);
    try {
      await api.post('/silver/deposit', {
        partyType: 'customer',
        partyId: Number(partyId),
        partyName,
        txnDate,
        grossWt: gross,
        purity: pur,
        rate: rt,
        notes,
      });
      toast.success('Deposit saved (Fine: ' + fine + ' g)');
      resetForm();
      await loadBalance(partyId);
      await loadTxns(partyId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveSell = async () => {
    if (!partyId) return toast.error('Select party');
    if (gross <= 0) return toast.error('Enter weight');
    setSaving(true);
    try {
      await api.post('/silver/sell', {
        partyType: 'customer',
        partyId: Number(partyId),
        partyName,
        txnDate,
        grossWt: gross,
        purity: pur,
        rate: rt,
        notes,
      });
      toast.success('Sell saved (Fine: ' + fine + ' g)');
      resetForm();
      await loadBalance(partyId);
      await loadTxns(partyId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const savePalta = async () => {
    if (!partyId) return toast.error('Select party');
    if (pFine <= 0) return toast.error('Enter fine weight');
    if (oR <= 0 || nR <= 0) return toast.error('Enter old & new rate');
    setSaving(true);
    try {
      await api.post('/silver/palta', {
        partyType: 'customer',
        partyId: Number(partyId),
        partyName,
        txnDate,
        fineWt: pFine,
        oldRate: oR,
        newRate: nR,
        settleMode,
        notes,
      });
      toast.success('Palta saved: ' + formatINR(paltaAmount));
      resetForm();
      await loadBalance(partyId);
      await loadTxns(partyId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const printPdf = () => {
    if (!partyId) return toast.error('Select customer first');
    const w = window.open('', '_blank');
    if (!w) return toast.error('Allow popups');
    const rows = txns
      .map((t) => {
        const bg =
          t.txn_type === 'deposit'
            ? '#ecfdf5'
            : t.txn_type === 'sell' || t.txn_type === 'issue'
              ? '#fef2f2'
              : '#fffbeb';
        return `<tr style="background:${bg}">
          <td>${t.txn_date ?? ''}</td>
          <td>${t.txn_no ?? ''}</td>
          <td>${t.txn_type ?? ''}</td>
          <td style="text-align:right">${n(t.fine_wt).toFixed(3)}</td>
          <td style="text-align:right">${n(t.rate)}</td>
          <td style="text-align:right">${n(t.amount).toFixed(2)}</td>
        </tr>`;
      })
      .join('');
    w.document.write(`<!DOCTYPE html><html><head><title>${partyName}</title>
      <style>
        body{font-family:Arial;padding:20px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px}
        th{background:#f3f4f6;text-align:left}
      </style></head><body>
      <h2>Ritik Chains — Silver Account</h2>
      <p>${partyName} (#${partyId}) · Fine: ${
        balance ? n(balance.fineBalance).toFixed(3) : '—'
      } g<br/>ToolClub.website · ${new Date().toLocaleString('en-IN')}</p>
      <table>
        <thead><tr><th>Date</th><th>No</th><th>Type</th><th>Fine</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No data</td></tr>'}</tbody>
      </table>
      <script>onload=function(){print()}</script>
      </body></html>`);
    w.document.close();
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'deposit', label: 'Deposit (Jama)', icon: ArrowDownCircle },
    { key: 'sell', label: 'Sell / Issue', icon: ArrowUpCircle },
    { key: 'palta', label: 'Palta', icon: Scale },
    { key: 'ledger', label: 'Ledger', icon: RefreshCw },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Silver Desk</h1>
          <p className="text-sm text-gray-500">Fine · Deposit · Sell · Palta</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => reloadAll(partyId || undefined)}>
            Refresh
          </button>
          <button type="button" className="btn-secondary" onClick={printPdf}>
            PDF / Print
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-gray-400 mb-3">Loading...</p>}

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'px-3 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ' +
              (tab === t.key
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
            }
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Party (Customer)</label>
          <select className="input" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Select customer</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} #{p.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Fine Balance</div>
          <div className="text-xl font-bold">
            {balance ? n(balance.fineBalance).toFixed(3) + ' g' : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Deposit: {balance ? n(balance.totalDepositFine).toFixed(3) : '0'} g · Issue:{' '}
            {balance ? n(balance.totalIssueFine).toFixed(3) : '0'} g
          </div>
        </div>
      </div>

      {tab === 'deposit' && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold mb-4">Silver Deposit (Jama)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Gross Wt (g)</label>
              <input className="input" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} />
            </div>
            <div>
              <label className="label">Purity %</label>
              <input className="input" value={purity} onChange={(e) => setPurity(e.target.value)} />
            </div>
            <div>
              <label className="label">Fine (auto)</label>
              <input className="input bg-gray-50" readOnly value={fine || ''} />
            </div>
            <div>
              <label className="label">Rate ₹ / fine g</label>
              <input className="input" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <label className="label">Amount (auto)</label>
              <input className="input bg-gray-50" readOnly value={amount || ''} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={saveDeposit}>
              Save Deposit
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Clear
            </button>
          </div>
        </div>
      )}

      {tab === 'sell' && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold mb-4">Silver Sell / Issue</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Gross Wt (g)</label>
              <input className="input" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} />
            </div>
            <div>
              <label className="label">Purity %</label>
              <input className="input" value={purity} onChange={(e) => setPurity(e.target.value)} />
            </div>
            <div>
              <label className="label">Fine (auto)</label>
              <input className="input bg-gray-50" readOnly value={fine || ''} />
            </div>
            <div>
              <label className="label">Rate ₹ / fine g</label>
              <input className="input" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <label className="label">Amount (auto)</label>
              <input className="input bg-gray-50" readOnly value={amount || ''} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={saveSell}>
              Save Sell
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Clear
            </button>
          </div>
        </div>
      )}

      {tab === 'palta' && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold mb-4">Palta (Rate Difference)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Fine Wt (g)</label>
              <input className="input" value={paltaFine} onChange={(e) => setPaltaFine(e.target.value)} />
            </div>
            <div>
              <label className="label">Old Rate</label>
              <input className="input" value={oldRate} onChange={(e) => setOldRate(e.target.value)} />
            </div>
            <div>
              <label className="label">New Rate</label>
              <input className="input" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
            </div>
            <div>
              <label className="label">Rate Diff</label>
              <input className="input bg-gray-50" readOnly value={rateDiff || ''} />
            </div>
            <div>
              <label className="label">Palta Amount</label>
              <input className="input bg-gray-50" readOnly value={paltaAmount || ''} />
            </div>
            <div>
              <label className="label">Settle Mode</label>
              <select className="input" value={settleMode} onChange={(e) => setSettleMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="rtgs">RTGS</option>
                <option value="fine">Fine</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={savePalta}>
              Save Palta
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold">Fine / Silver Ledger</div>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>No</th>
                <th>Type</th>
                <th>Party</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Purity</th>
                <th className="text-right">Fine</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">
                    No silver transactions
                  </td>
                </tr>
              ) : (
                txns.map((t, i) => (
                  <tr
                    key={t.id ?? i}
                    className={
                      t.txn_type === 'deposit'
                        ? 'bg-emerald-50'
                        : t.txn_type === 'sell' || t.txn_type === 'issue'
                          ? 'bg-red-50'
                          : t.txn_type === 'palta'
                            ? 'bg-amber-50'
                            : ''
                    }
                  >
                    <td>{String(t.txn_date ?? '')}</td>
                    <td className="font-mono text-xs">{String(t.txn_no ?? '')}</td>
                    <td className="font-medium">{String(t.txn_type ?? '')}</td>
                    <td>{String(t.party_name ?? '')}</td>
                    <td className="text-right">{n(t.gross_wt).toFixed(3)}</td>
                    <td className="text-right">{n(t.purity)}</td>
                    <td className="text-right font-medium">{n(t.fine_wt).toFixed(3)}</td>
                    <td className="text-right">{n(t.rate)}</td>
                    <td className="text-right">{formatINR(n(t.amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}