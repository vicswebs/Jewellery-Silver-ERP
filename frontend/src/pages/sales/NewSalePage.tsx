import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, ArrowLeft, Scale, Coins, FileText } from 'lucide-react';
import api from '../../services/api';

interface Customer {
  id: number;
  name: string;
  code: string;
  fineBalance?: number;
  currentBalance?: number;
}

interface Item {
  id: number;
  name: string;
  code: string;
  purity?: string;
  currentQty?: string;
  currentNet?: string;
}

interface Line {
  itemId: number;
  itemName: string;
  grossWeight: number;
  tunch: number;
  wastage: number;
  totalPercent: number;
  fineWeight: number;
  outOfStock?: boolean;
}

interface OldSale {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  grandTotal?: string | number;
  paidAmount?: string | number;
  dueAmount?: string | number;
  totalFine?: string | number;
  status?: string;
}

/** 3 clear ways to make bill */
type BillMode = 'demand' | 'silver_palta' | 'cash_fine';

function n(v: unknown) {
  const x = parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
}

function stockG(item: Item) {
  return n(item.currentNet ?? item.currentQty);
}

function formatINR(v: number) {
  return '₹ ' + n(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const MODES: {
  key: BillMode;
  title: string;
  subtitle: string;
  icon: typeof Scale;
  color: string;
}[] = [
  {
    key: 'demand',
    title: '1. Fine demand only',
    subtitle: 'Maal + Tunch + Wastage → Fine payable. No settlement now.',
    icon: FileText,
    color: 'border-blue-400 bg-blue-50',
  },
  {
    key: 'silver_palta',
    title: '2. Settle with Silver + Palta',
    subtitle: 'Party gives silver. Palta (g/kg) is added. Fine balance updates.',
    icon: Scale,
    color: 'border-emerald-400 bg-emerald-50',
  },
  {
    key: 'cash_fine',
    title: '3. Settle with Cash → Fine',
    subtitle: 'Party pays ₹. Converted to fine by market rate (₹/kg).',
    icon: Coins,
    color: 'border-amber-400 bg-amber-50',
  },
];

export default function NewSalePage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const [billMode, setBillMode] = useState<BillMode>('demand');

  // Line entry (no Qty)
  const [selItem, setSelItem] = useState<number | ''>('');
  const [gross, setGross] = useState(0);
  const [tunch, setTunch] = useState(62);
  const [wastage, setWastage] = useState(8);
  const [stockInfo, setStockInfo] = useState('');

  // Method A
  const [recvWeight, setRecvWeight] = useState(0);
  const [recvPurity, setRecvPurity] = useState(100);
  const [paltaRateGPerKg, setPaltaRateGPerKg] = useState(12);

  // Method B
  const [cashDeposited, setCashDeposited] = useState(0);
  const [marketRatePerKg, setMarketRatePerKg] = useState(200000);

  // Old bills of same party
  const [oldBills, setOldBills] = useState<OldSale[]>([]);
  const [showOldBanner, setShowOldBanner] = useState(false);
  const [continueDespiteOld, setContinueDespiteOld] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, iRes] = await Promise.all([
          api.get('/customers', { params: { limit: 300 } }),
          api.get('/items', { params: { limit: 500 } }),
        ]);
        setCustomers(cRes.data.data || []);
        setItems(iRes.data.data || []);
      } catch {
        toast.error('Failed to load masters');
      }
    })();
  }, []);

  const loadOldBills = async (cid: number) => {
    try {
      const { data } = await api.get('/sales', { params: { limit: 100 } });
      const list: OldSale[] = Array.isArray(data?.data) ? data.data : [];
      const mine = list.filter(
        (s) =>
          Number((s as any).customerId) === cid &&
          (n(s.dueAmount) > 0.01 || n(s.dueAmount) < 0)
      );
      setOldBills(mine);
      if (mine.length > 0) {
        setShowOldBanner(true);
        setContinueDespiteOld(false);
      } else {
        setShowOldBanner(false);
        setContinueDespiteOld(true);
      }
    } catch {
      setOldBills([]);
      setContinueDespiteOld(true);
    }
  };

  const onCustomerChange = async (id: number | '') => {
    setCustomerId(id);
    setContinueDespiteOld(false);
    setOldBills([]);
    setShowOldBanner(false);
    if (!id) {
      setSelectedCustomer(null);
      return;
    }
    try {
      const res = await api.get(`/customers/${id}`);
      setSelectedCustomer(res.data.data);
    } catch {
      setSelectedCustomer(customers.find((c) => c.id === id) || null);
    }
    await loadOldBills(id);
  };

  const onItemSelect = (id: number) => {
    setSelItem(id);
    const item = items.find((i) => i.id === id);
    if (item) {
      const p = n(item.purity);
      if (p > 0) setTunch(p);
      const g = stockG(item);
      setStockInfo(g <= 0 ? 'Out of stock (0 g)' : `Stock: ${g.toFixed(3)} g`);
    } else setStockInfo('');
  };

  const calcFine = (grossG: number, t: number, w: number) =>
    +((grossG * (t + w)) / 100).toFixed(4);

  const liveFine = calcFine(gross, tunch, wastage);

  const addLine = () => {
    if (!selItem) return toast.error('Select silver type');
    if (gross <= 0) return toast.error('Enter Maal / Gross weight in grams');

    const item = items.find((i) => i.id === selItem)!;
    const totalPercent = tunch + wastage;
    const fineWeight = calcFine(gross, tunch, wastage);
    const outOfStock = stockG(item) <= 0;
    if (outOfStock) toast('Out of stock — added anyway', { icon: '⚠️' });

    setLines([
      ...lines,
      {
        itemId: item.id,
        itemName: item.name,
        grossWeight: gross,
        tunch,
        wastage,
        totalPercent,
        fineWeight,
        outOfStock,
      },
    ]);
    setSelItem('');
    setGross(0);
    setWastage(8);
    setStockInfo('');
  };

  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

  const totalGross = lines.reduce((s, l) => s + l.grossWeight, 0);
  const finePayable = lines.reduce((s, l) => s + l.fineWeight, 0);

  const fineDepositedG = +((recvWeight * recvPurity) / 100).toFixed(4);
  const paltaGrams = +((fineDepositedG / 1000) * paltaRateGPerKg).toFixed(4);
  const creditedA = +(fineDepositedG + paltaGrams).toFixed(4);

  const creditedB =
    marketRatePerKg > 0
      ? +((cashDeposited / marketRatePerKg) * 1000).toFixed(4)
      : 0;

  const totalCredited =
    billMode === 'demand'
      ? 0
      : billMode === 'silver_palta'
        ? creditedA
        : creditedB;

  const fineBalanceDue = +(finePayable - totalCredited).toFixed(4);

  const handleSave = async () => {
    if (!customerId) return toast.error('Select party');
    if (lines.length === 0) return toast.error('Add at least one Maal line');
    if (showOldBanner && !continueDespiteOld) {
      return toast.error('Confirm old bills below — or open Sales to clear dues first');
    }
    if (billMode === 'silver_palta' && recvWeight <= 0) {
      return toast.error('Enter silver weight deposited (Method A)');
    }
    if (billMode === 'cash_fine' && cashDeposited <= 0) {
      return toast.error('Enter cash amount (Method B)');
    }

    setSaving(true);
    try {
      await api.post('/sales', {
        invoiceDate,
        customerId,
        items: lines.map((l) => ({
          itemId: l.itemId,
          quantity: 1,
          grossWeight: l.grossWeight,
          bagWeight: 0,
          netWeight: l.grossWeight,
          purity: l.tunch,
          wastage: l.wastage,
          fineWeight: l.fineWeight,
          rate: 0,
          makingCharge: 0,
          amount: l.fineWeight,
        })),
        receivedSilver:
          billMode === 'silver_palta'
            ? {
                weight: recvWeight,
                purity: recvPurity,
                fine: fineDepositedG,
                paltaRateGPerKg,
                paltaGrams,
                totalFineCredited: creditedA,
              }
            : { weight: 0, purity: 0, fine: 0 },
        rateCut:
          billMode === 'silver_palta'
            ? {
                fine: fineDepositedG / 1000,
                rate: paltaRateGPerKg,
                amount: 0,
              }
            : undefined,
        paidAmount: billMode === 'cash_fine' ? cashDeposited : 0,
        paymentMode: billMode === 'cash_fine' ? 'cash' : undefined,
        discount: 0,
        parcelCharge: 0,
        kasar: 0,
        notes: JSON.stringify({
          billMode,
          settlement: {
            finePayableG: finePayable,
            totalFineCreditedG: totalCredited,
            fineBalanceDueG: fineBalanceDue,
            methodA:
              billMode === 'silver_palta'
                ? { fineDepositedG, paltaGrams, creditedA, paltaRateGPerKg }
                : null,
            methodB:
              billMode === 'cash_fine'
                ? { cashDeposited, marketRatePerKg, creditedB }
                : null,
          },
        }),
      });

      toast.success(
        billMode === 'demand'
          ? `Saved · Fine demand ${finePayable.toFixed(4)} g`
          : `Saved · Fine due ${fineBalanceDue.toFixed(4)} g`
      );
      navigate('/sales');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 rounded-lg border bg-white sm:hidden"
            onClick={() => navigate('/sales')}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              New Silver Bill
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Choose how to bill → add Maal → settle if needed — Ritik Chains
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate('/sales')}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving}
            onClick={handleSave}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save bill'}
          </button>
        </div>
      </div>

      {/* Party */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">Party</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Customer *</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) =>
                onCustomerChange(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Select party...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bill date</label>
            <input
              type="date"
              className="input"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
        </div>
        {selectedCustomer && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <div className="text-xs text-red-600">Fine udhaar (ledger)</div>
              <div className="font-bold text-red-700">
                {(selectedCustomer.fineBalance ?? 0).toFixed(3)} g
              </div>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-center">
              <div className="text-xs text-orange-600">Money udhaar</div>
              <div className="font-bold text-orange-700">
                {formatINR(selectedCustomer.currentBalance ?? 0)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Old bills warning */}
      {showOldBanner && oldBills.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900 mb-1">
            This party has open bill(s)
          </h3>
          <p className="text-sm text-amber-800 mb-3">
            Clear or note old dues before a new bill. You can still continue after
            confirming.
          </p>
          <div className="overflow-x-auto border border-amber-200 rounded-lg bg-white mb-3">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th className="text-right">Due ₹</th>
                  <th className="text-right">Fine</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {oldBills.map((b) => (
                  <tr key={b.id}>
                    <td>{String(b.invoiceDate).slice(0, 10)}</td>
                    <td className="font-mono text-xs">{b.invoiceNo}</td>
                    <td
                      className={
                        'text-right font-medium ' +
                        (n(b.dueAmount) !== 0 ? 'text-red-600' : '')
                      }
                    >
                      {formatINR(n(b.dueAmount))}
                    </td>
                    <td className="text-right">{n(b.totalFine).toFixed(3)} g</td>
                    <td>{b.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/sales')}
            >
              Go to Sales (update old bill)
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setContinueDespiteOld(true);
                setShowOldBanner(false);
                toast.success('OK — you can create a new bill');
              }}
            >
              Continue new bill anyway
            </button>
          </div>
        </div>
      )}

      {/* 3 bill modes */}
      <div className="mb-4">
        <h2 className="font-semibold text-sm mb-2">How do you want to make this bill?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = billMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setBillMode(m.key)}
                className={
                  'text-left rounded-xl border-2 p-4 transition ' +
                  (active
                    ? m.color + ' ring-2 ring-offset-1 ring-primary-500'
                    : 'border-gray-200 bg-white hover:bg-gray-50')
                }
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={20} />
                  <span className="font-semibold text-sm">{m.title}</span>
                </div>
                <p className="text-xs text-gray-600 leading-snug">{m.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-gray-500">Maal total</div>
          <div className="font-bold">{totalGross.toFixed(3)} g</div>
        </div>
        <div className="rounded-xl border bg-emerald-50 p-3">
          <div className="text-xs text-emerald-700">Fine payable</div>
          <div className="font-bold text-emerald-800">{finePayable.toFixed(4)} g</div>
        </div>
        <div className="rounded-xl border bg-cyan-50 p-3">
          <div className="text-xs text-cyan-700">Fine credited</div>
          <div className="font-bold text-cyan-800">{totalCredited.toFixed(4)} g</div>
        </div>
        <div className="rounded-xl border bg-violet-50 p-3">
          <div className="text-xs text-violet-700">Fine still due</div>
          <div
            className={
              'font-bold ' + (fineBalanceDue > 0 ? 'text-red-700' : 'text-emerald-700')
            }
          >
            {fineBalanceDue.toFixed(4)} g
          </div>
        </div>
      </div>

      {/* Add Maal — no Qty */}
      <div className="card p-4 mb-4 space-y-3">
        <h2 className="font-semibold text-sm">Add Maal (Gross weight)</h2>
        <div>
          <label className="label">Silver type</label>
          <select
            className="input"
            value={selItem}
            onChange={(e) => onItemSelect(Number(e.target.value))}
          >
            <option value="">Select...</option>
            {items.map((i) => {
              const g = stockG(i);
              return (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.name} ({g.toFixed(1)} g)
                  {g <= 0 ? ' (Out)' : ''}
                </option>
              );
            })}
          </select>
          {stockInfo && <p className="text-xs mt-1 text-gray-500">{stockInfo}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Maal / Gross (grams)</label>
            <input
              type="number"
              className="input"
              value={gross || ''}
              onChange={(e) => setGross(Number(e.target.value))}
              step="any"
              placeholder="e.g. 10000 = 10 kg"
            />
          </div>
          <div>
            <label className="label">Tunch %</label>
            <input
              type="number"
              className="input"
              value={tunch}
              onChange={(e) => setTunch(Number(e.target.value))}
              step="any"
            />
          </div>
          <div>
            <label className="label">Wastage %</label>
            <input
              type="number"
              className="input"
              value={wastage}
              onChange={(e) => setWastage(Number(e.target.value))}
              step="any"
            />
          </div>
        </div>
        {gross > 0 && (
          <div className="p-3 rounded-lg bg-emerald-50 text-sm text-emerald-900">
            Fine = {gross} × ({tunch} + {wastage}) / 100 ={' '}
            <b>{liveFine.toFixed(4)} g</b>
            <span className="text-gray-600 text-xs">
              {' '}
              ({(liveFine / 1000).toFixed(4)} kg)
            </span>
          </div>
        )}
        <button type="button" className="btn-primary w-full" onClick={addLine}>
          <Plus size={18} /> Add line
        </button>
      </div>

      {/* Lines table */}
      <div className="card mb-4 overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Item</th>
              <th>Gross (g)</th>
              <th>Tunch</th>
              <th>Wast</th>
              <th>Fine (g)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-400">
                  No Maal lines yet
                </td>
              </tr>
            ) : (
              lines.map((l, idx) => (
                <tr key={idx} className={l.outOfStock ? 'bg-red-50' : ''}>
                  <td className="font-medium">{l.itemName}</td>
                  <td>{l.grossWeight.toFixed(3)}</td>
                  <td>{l.tunch}%</td>
                  <td>{l.wastage}%</td>
                  <td className="font-semibold text-emerald-700">
                    {l.fineWeight.toFixed(4)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-red-500 p-1"
                      onClick={() => removeLine(idx)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Settlement panel by mode */}
      {billMode === 'silver_palta' && (
        <div className="card p-4 mb-4 border-emerald-200 space-y-3">
          <h2 className="font-semibold text-sm text-emerald-900">
            Settlement — Silver + Palta
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Weight deposited (g)</label>
              <input
                type="number"
                className="input"
                value={recvWeight || ''}
                onChange={(e) => setRecvWeight(Number(e.target.value))}
                step="any"
              />
            </div>
            <div>
              <label className="label">Purity %</label>
              <input
                type="number"
                className="input"
                value={recvPurity}
                onChange={(e) => setRecvPurity(Number(e.target.value))}
                step="any"
              />
            </div>
            <div>
              <label className="label">Palta rate (g per kg)</label>
              <input
                type="number"
                className="input"
                value={paltaRateGPerKg || ''}
                onChange={(e) => setPaltaRateGPerKg(Number(e.target.value))}
                step="any"
              />
            </div>
            <div className="input bg-emerald-50 font-medium self-end">
              Fine deposited: {fineDepositedG.toFixed(4)} g
            </div>
            <div className="input bg-amber-50 font-medium">
              Palta: {paltaGrams.toFixed(4)} g
            </div>
            <div className="input bg-cyan-50 font-medium">
              Total credited: {creditedA.toFixed(4)} g
            </div>
          </div>
        </div>
      )}

      {billMode === 'cash_fine' && (
        <div className="card p-4 mb-4 border-amber-200 space-y-3">
          <h2 className="font-semibold text-sm text-amber-900">
            Settlement — Cash → Fine
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Cash deposited (₹)</label>
              <input
                type="number"
                className="input"
                value={cashDeposited || ''}
                onChange={(e) => setCashDeposited(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Market rate (₹ per kg)</label>
              <input
                type="number"
                className="input"
                value={marketRatePerKg || ''}
                onChange={(e) => setMarketRatePerKg(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2 input bg-cyan-50 font-medium">
              Equivalent fine: {creditedB.toFixed(4)} g (
              {(creditedB / 1000).toFixed(4)} kg)
            </div>
          </div>
        </div>
      )}

      {billMode === 'demand' && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50/50 text-sm text-blue-900">
          <b>Fine demand only.</b> No silver or cash settlement on this bill.
          Fine payable <b>{finePayable.toFixed(4)} g</b> will stay as demand.
          You can settle later from Sales.
        </div>
      )}

      <div className="card p-4 bg-violet-50 border border-violet-200">
        <div className="text-sm font-medium text-violet-900">Closing fine balance</div>
        <div className="text-xs text-violet-700 mb-1">
          Fine payable − credited (by selected mode)
        </div>
        <div
          className={
            'text-2xl font-bold ' +
            (fineBalanceDue > 0 ? 'text-red-700' : 'text-emerald-700')
          }
        >
          {fineBalanceDue.toFixed(4)} g
        </div>
      </div>
    </div>
  );
}