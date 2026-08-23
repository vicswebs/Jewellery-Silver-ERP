import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus,
  RefreshCw,
  Search,
  Eye,
  X,
  FileText,
  Scale,
  Coins,
  Printer,
  MessageCircle,
} from 'lucide-react';
import api from '../../services/api';

interface SaleRow {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  customerId?: number;
  customerName?: string | null;
  customerMobile?: string | null;
  grandTotal?: string | number;
  paidAmount?: string | number;
  dueAmount?: string | number;
  status?: string;
  totalFine?: string | number;
  receivedFine?: string | number;
  fineBalance?: string | number;
  notes?: string | null;
  items?: Array<{
    id?: number;
    itemName?: string;
    name?: string;
    grossWeight?: string | number;
    netWeight?: string | number;
    purity?: string | number;
    wastage?: string | number;
    fineWeight?: string | number;
    amount?: string | number;
  }>;
}

type SettleMode = 'money' | 'silver_palta' | 'cash_fine';
type BillFilter =
  | 'all'
  | 'demand'
  | 'silver_palta'
  | 'cash_fine'
  | 'has_due'
  | 'paid_money';
type Period = 'today' | 'month' | 'year' | 'lifetime' | 'custom';

function n(v: unknown) {
  const x = parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
}

function formatINR(v: number) {
  return '₹ ' + n(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function yearStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function loadCompanySettings() {
  try {
    const raw = localStorage.getItem('rc_company_settings');
    if (raw) {
      const s = JSON.parse(raw);
      return {
        companyName: String(s.companyName || 'Ritik Chains'),
        phone: String(s.phone || ''),
        address: String(s.address || ''),
        gstin: String(s.gstin || ''),
      };
    }
  } catch {
    /* ignore */
  }
  return { companyName: 'Ritik Chains', phone: '', address: '', gstin: '' };
}

function paymentBadge(r: SaleRow) {
  if (r.status === 'cancelled') return 'cancelled';
  if (r.status === 'draft') return 'draft';
  const due = n(r.dueAmount);
  if (due < 0) return 'error';
  if (due <= 0.01) return 'paid';
  if (n(r.paidAmount) > 0) return 'partial';
  return r.status || 'confirmed';
}

function parseNotes(notes?: string | null) {
  try {
    if (!notes) return null;
    return JSON.parse(notes);
  } catch {
    return null;
  }
}

function detectBillMode(r: SaleRow): BillFilter {
  try {
    const j = parseNotes(r.notes);
    if (j) {
      const mode = j.billMode || j?.settlement?.billMode;
      if (mode === 'demand') return 'demand';
      if (mode === 'silver_palta') return 'silver_palta';
      if (mode === 'cash_fine') return 'cash_fine';
      const hist = j.history;
      if (Array.isArray(hist) && hist.length) {
        if (hist.some((h: any) => h?.type === 'silver_palta')) return 'silver_palta';
        if (hist.some((h: any) => h?.type === 'cash_fine')) return 'cash_fine';
      }
      if (j?.settlement?.lastSilverPalta || j?.settlement?.methodA) return 'silver_palta';
      if (j?.settlement?.lastCashFine || j?.settlement?.methodB) return 'cash_fine';
    }
  } catch {
    /* ignore */
  }
  if (n(r.receivedFine) > 0.0001) return 'silver_palta';
  if (n(r.paidAmount) > 0.01 && n(r.totalFine) > 0) return 'cash_fine';
  if (n(r.paidAmount) > 0.01) return 'paid_money';
  return 'demand';
}

function modeLabel(f: BillFilter) {
  if (f === 'silver_palta') return 'Silver+Palta';
  if (f === 'cash_fine') return 'Cash→Fine';
  if (f === 'paid_money') return 'Money';
  if (f === 'has_due') return 'Due';
  return 'Demand';
}

function buildWhatsAppText(r: SaleRow) {
  const company = loadCompanySettings().companyName || 'Shop';
  const due = n(r.dueAmount);
  return [
    `*${company}*`,
    `Invoice: ${r.invoiceNo}`,
    `Date: ${String(r.invoiceDate).slice(0, 10)}`,
    `Party: ${r.customerName || '-'}`,
    n(r.totalFine) > 0 ? `Fine: ${n(r.totalFine).toFixed(4)} g` : '',
    `Amount: ${formatINR(n(r.grandTotal))}`,
    `Paid: ${formatINR(n(r.paidAmount))}`,
    `Due: ${formatINR(due)}`,
    ``,
    `Thank you.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function openPdf(saleId: number, invoiceNo?: string) {
  try {
    const c = loadCompanySettings();
    const res = await api.get(`/sales/${saleId}/pdf`, {
      responseType: 'blob',
      params: {
        companyName: c.companyName || undefined,
        phone: c.phone || undefined,
        address: c.address || undefined,
        gstin: c.gstin || undefined,
      },
    });
    const url = window.URL.createObjectURL(
      new Blob([res.data], { type: 'application/pdf' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${invoiceNo || saleId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success('PDF downloaded');
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'PDF failed');
  }
}

function openWhatsApp(r: SaleRow, mobile?: string | null) {
  const text = encodeURIComponent(buildWhatsAppText(r));
  let phone = String(mobile || '').replace(/\D/g, '');
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.length === 10) phone = '91' + phone;
  const url = phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, '_blank');
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'lifetime', label: 'All' },
  { key: 'custom', label: 'Custom' },
];

const BILL_FILTERS: { key: BillFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'demand', label: '1. Demand' },
  { key: 'silver_palta', label: '2. Silver+Palta' },
  { key: 'cash_fine', label: '3. Cash→Fine' },
  { key: 'has_due', label: '₹ Due' },
  { key: 'paid_money', label: '₹ Paid' },
];

const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'draft', label: 'Draft' },
];

const SETTLE_MODES: {
  key: SettleMode;
  title: string;
  sub: string;
  icon: typeof Scale;
}[] = [
  { key: 'money', title: '1. Money ₹', sub: 'Cash / bank / UPI', icon: Coins },
  { key: 'silver_palta', title: '2. Silver+Palta', sub: 'Weight + palta g/kg', icon: Scale },
  { key: 'cash_fine', title: '3. Cash→Fine', sub: '₹ by rate/kg', icon: FileText },
];

export default function SalesPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [partySearch, setPartySearch] = useState('');
  const [billFilter, setBillFilter] = useState<BillFilter>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [detail, setDetail] = useState<SaleRow | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('confirmed');

  const [settleMode, setSettleMode] = useState<SettleMode>('money');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [recvWeight, setRecvWeight] = useState('');
  const [recvPurity, setRecvPurity] = useState('100');
  const [paltaRate, setPaltaRate] = useState('12');
  const [cashFineAmt, setCashFineAmt] = useState('');
  const [marketRate, setMarketRate] = useState('200000');
  const [previewLog, setPreviewLog] = useState<string[]>([]);

  const resolveRange = (p: Period) => {
    if (p === 'today') return { from: todayStr(), to: todayStr() };
    if (p === 'month') return { from: monthStartStr(), to: todayStr() };
    if (p === 'year') return { from: yearStartStr(), to: todayStr() };
    if (p === 'lifetime') return { from: '', to: '' };
    return { from: fromDate, to: toDate };
  };

  const load = async () => {
    setLoading(true);
    try {
      const { from, to } = resolveRange(period);
      const params: Record<string, string | number> = { limit: 500, page: 1 };
      if (from) params.fromDate = from;
      if (to) params.toDate = to;
      if (partySearch.trim()) params.customer = partySearch.trim();

      const { data } = await api.get('/sales', { params });
      let list: SaleRow[] = Array.isArray(data?.data) ? data.data : [];

      if (from) list = list.filter((r) => String(r.invoiceDate).slice(0, 10) >= from);
      if (to) list = list.filter((r) => String(r.invoiceDate).slice(0, 10) <= to);
      if (partySearch.trim()) {
        const q = partySearch.trim().toLowerCase();
        list = list.filter((r) =>
          String(r.customerName || '').toLowerCase().includes(q)
        );
      }

      if (billFilter === 'has_due') {
        list = list.filter((r) => n(r.dueAmount) > 0.01);
      } else if (billFilter === 'paid_money') {
        list = list.filter((r) => n(r.paidAmount) > 0.01);
      } else if (billFilter !== 'all') {
        list = list.filter((r) => detectBillMode(r) === billFilter);
      }

      setRows(list);
    } catch {
      toast.error('Failed to load sales');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, billFilter]);

  const onPeriodClick = (p: Period) => {
    setPeriod(p);
    if (p === 'today') {
      setFromDate(todayStr());
      setToDate(todayStr());
    } else if (p === 'month') {
      setFromDate(monthStartStr());
      setToDate(todayStr());
    } else if (p === 'year') {
      setFromDate(yearStartStr());
      setToDate(todayStr());
    }
  };

  const resetSettleForm = () => {
    setSettleMode('money');
    setPayAmount('');
    setPayMode('cash');
    setRecvWeight('');
    setRecvPurity('100');
    setPaltaRate('12');
    setCashFineAmt('');
    setMarketRate('200000');
    setPreviewLog([]);
  };

  const openView = async (row: SaleRow) => {
    setDialogOpen(true);
    setDialogLoading(true);
    setDetail(row);
    setNewStatus(
      row.status === 'partial' || row.status === 'paid'
        ? 'confirmed'
        : row.status || 'confirmed'
    );
    resetSettleForm();
    try {
      const { data } = await api.get(`/sales/${row.id}`);
      if (data?.data) {
        const full = {
          ...row,
          ...data.data,
          customerMobile: data.data.customerMobile || row.customerMobile,
          customerName: data.data.customerName || row.customerName,
        };
        setDetail(full);
        const s = full.status || 'confirmed';
        setNewStatus(s === 'partial' || s === 'paid' ? 'confirmed' : s);
      }
    } catch {
      toast.error('Could not load full detail');
    } finally {
      setDialogLoading(false);
    }
  };

  const closeView = () => {
    setDialogOpen(false);
    setDetail(null);
    resetSettleForm();
  };

  const updateStatus = async () => {
    if (!detail) return;
    if (!['confirmed', 'cancelled', 'draft'].includes(newStatus)) {
      toast.error('Invalid status');
      return;
    }
    setUpdating(true);
    try {
      await api.patch(`/sales/${detail.id}`, { status: newStatus });
      toast.success('Status updated');
      setDetail({ ...detail, status: newStatus });
      setPreviewLog((p) => [`Status → ${newStatus}`, ...p]);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Status failed');
    } finally {
      setUpdating(false);
    }
  };

  const applyMoney = async () => {
    if (!detail) return;
    const amount = n(payAmount);
    if (amount <= 0) return toast.error('Enter amount');
    const due = Math.max(0, n(detail.dueAmount));
    if (due <= 0) return toast.error('Already fully paid (₹)');
    if (amount > due + 0.01) return toast.error(`Max due ${formatINR(due)}`);

    const newPaid = +(n(detail.paidAmount) + amount).toFixed(2);
    const newDue = Math.max(0, +(n(detail.grandTotal) - newPaid).toFixed(2));

    setUpdating(true);
    try {
      await api.patch(`/sales/${detail.id}`, {
        paidAmount: newPaid,
        dueAmount: newDue,
        status: 'confirmed',
      });
      const msg = `Money +${formatINR(amount)} (${payMode}) · Paid ${formatINR(newPaid)} · Due ${formatINR(newDue)}`;
      toast.success(msg);
      setDetail({ ...detail, paidAmount: newPaid, dueAmount: newDue });
      setPreviewLog((p) => [msg, ...p]);
      setPayAmount('');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Payment failed');
    } finally {
      setUpdating(false);
    }
  };

  const applySilverPalta = async () => {
    if (!detail) return;
    const wt = n(recvWeight);
    if (wt <= 0) return toast.error('Enter silver weight (g)');
    const purity = n(recvPurity) || 100;
    const rate = n(paltaRate);
    const fineDep = +((wt * purity) / 100).toFixed(4);
    const palta = +((fineDep / 1000) * rate).toFixed(4);
    const credited = +(fineDep + palta).toFixed(4);
    const prevFineBal = n(detail.fineBalance ?? detail.totalFine);
    const newFineBal = Math.max(0, +(prevFineBal - credited).toFixed(4));
    const prevRecv = n(detail.receivedFine);

    setUpdating(true);
    try {
      const prev = parseNotes(detail.notes) || {};
      const history = Array.isArray(prev.history) ? prev.history : [];
      history.unshift({
        at: new Date().toISOString(),
        type: 'silver_palta',
        weightG: wt,
        purity,
        fineDepositedG: fineDep,
        paltaG: palta,
        creditedG: credited,
      });
      const notes = JSON.stringify({
        ...prev,
        billMode: 'silver_palta',
        settlement: {
          ...(prev.settlement || {}),
          lastSilverPalta: { fineDep, palta, credited },
        },
        history,
      });
      await api.patch(`/sales/${detail.id}`, {
        status: 'confirmed',
        receivedFine: String(prevRecv + fineDep),
        fineBalance: String(newFineBal),
        notes,
      });
      const msg = `Silver+Palta · +${credited} g · Fine bal ${newFineBal} g`;
      toast.success('Silver + Palta saved');
      setDetail({
        ...detail,
        receivedFine: prevRecv + fineDep,
        fineBalance: newFineBal,
        notes,
      });
      setPreviewLog((p) => [msg, ...p]);
      setRecvWeight('');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Silver settlement failed');
    } finally {
      setUpdating(false);
    }
  };

  const applyCashFine = async () => {
    if (!detail) return;
    const cash = n(cashFineAmt);
    const rateKg = n(marketRate);
    if (cash <= 0) return toast.error('Enter cash ₹');
    if (rateKg <= 0) return toast.error('Enter rate ₹/kg');
    const fineG = +((cash / rateKg) * 1000).toFixed(4);
    const prevFineBal = n(detail.fineBalance ?? detail.totalFine);
    const newFineBal = Math.max(0, +(prevFineBal - fineG).toFixed(4));
    const due = Math.max(0, n(detail.dueAmount));
    const pay = due > 0 ? Math.min(cash, due) : 0;
    const newPaid = +(n(detail.paidAmount) + pay).toFixed(2);
    const newDue =
      due > 0 ? Math.max(0, +(n(detail.grandTotal) - newPaid).toFixed(2)) : n(detail.dueAmount);

    setUpdating(true);
    try {
      const prev = parseNotes(detail.notes) || {};
      const history = Array.isArray(prev.history) ? prev.history : [];
      history.unshift({
        at: new Date().toISOString(),
        type: 'cash_fine',
        cash,
        rateKg,
        fineG,
      });
      const notes = JSON.stringify({
        ...prev,
        billMode: 'cash_fine',
        settlement: {
          ...(prev.settlement || {}),
          lastCashFine: { cash, rateKg, fineG },
        },
        history,
      });
      await api.patch(`/sales/${detail.id}`, {
        status: 'confirmed',
        paidAmount: newPaid,
        dueAmount: Math.max(0, newDue),
        receivedFine: String(n(detail.receivedFine) + fineG),
        fineBalance: String(newFineBal),
        notes,
      });
      const msg = `Cash→Fine · ₹${cash} = ${fineG} g · Fine bal ${newFineBal} g`;
      toast.success('Cash → Fine saved');
      setDetail({
        ...detail,
        paidAmount: newPaid,
        dueAmount: Math.max(0, newDue),
        receivedFine: n(detail.receivedFine) + fineG,
        fineBalance: newFineBal,
        notes,
      });
      setPreviewLog((p) => [msg, ...p]);
      setCashFineAmt('');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Cash→Fine failed');
    } finally {
      setUpdating(false);
    }
  };

  const fixNegativeDue = async () => {
    if (!detail || n(detail.dueAmount) >= 0) return;
    setUpdating(true);
    try {
      const grand = n(detail.grandTotal);
      const paid = Math.max(n(detail.paidAmount), grand);
      await api.patch(`/sales/${detail.id}`, {
        paidAmount: paid,
        dueAmount: 0,
        status: 'confirmed',
      });
      toast.success('Due fixed to 0');
      setDetail({ ...detail, paidAmount: paid, dueAmount: 0 });
      setPreviewLog((p) => ['Fixed negative due → 0', ...p]);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Fix failed');
    } finally {
      setUpdating(false);
    }
  };

  const totalMoney = rows.reduce((s, r) => s + n(r.grandTotal), 0);
  const totalDue = rows.reduce((s, r) => s + Math.max(0, n(r.dueAmount)), 0);
  const totalFineSum = rows.reduce((s, r) => s + n(r.totalFine), 0);
  const lineItems = detail?.items || [];
  const savedNotes = parseNotes(detail?.notes);

  const liveFineDep = +(((n(recvWeight) * n(recvPurity)) / 100) || 0).toFixed(4);
  const livePalta = +(((liveFineDep / 1000) * n(paltaRate)) || 0).toFixed(4);
  const liveCashFine =
    n(marketRate) > 0 ? +(((n(cashFineAmt) / n(marketRate)) * 1000) || 0).toFixed(4) : 0;

  const shopName = loadCompanySettings().companyName;

  const chip = (active: boolean, activeCls: string) =>
    'px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border whitespace-nowrap ' +
    (active ? activeCls : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50');

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Sales</h1>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            Fine · settle · PDF · WA — {shopName}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={load}>
            <RefreshCw size={16} />
            <span className="hidden xs:inline">Refresh</span>
          </button>
          <Link
            to="/sales/new"
            className="btn-primary inline-flex items-center justify-center gap-2 flex-1 sm:flex-none"
          >
            <Plus size={16} />
            New Sale
          </Link>
        </div>
      </div>

      {/* Period chips — scroll on mobile */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPeriodClick(p.key)}
            className={chip(
              period === p.key,
              'bg-primary-600 text-white border-primary-600'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Bill type filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {BILL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setBillFilter(f.key)}
            className={chip(
              billFilter === f.key,
              'bg-indigo-600 text-white border-indigo-600'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Date + search */}
      <div className="card p-3 sm:p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={fromDate}
            disabled={period === 'lifetime'}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPeriod('custom');
            }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input"
            value={toDate}
            disabled={period === 'lifetime'}
            onChange={(e) => {
              setToDate(e.target.value);
              setPeriod('custom');
            }}
          />
        </div>
        <div>
          <label className="label">Party</label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="input pl-9"
              placeholder="Customer name..."
              value={partySearch}
              onChange={(e) => setPartySearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
        </div>
        <button type="button" className="btn-primary w-full" onClick={load}>
          Apply
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="rounded-lg border bg-white p-2.5 sm:p-3">
          <div className="text-[10px] sm:text-xs text-gray-500">Bills</div>
          <div className="text-base sm:text-lg font-bold">{rows.length}</div>
        </div>
        <div className="rounded-lg border bg-emerald-50 p-2.5 sm:p-3">
          <div className="text-[10px] sm:text-xs text-emerald-700">Total fine</div>
          <div className="text-base sm:text-lg font-bold text-emerald-800">
            {totalFineSum.toFixed(3)} g
          </div>
        </div>
        <div className="rounded-lg border bg-blue-50 p-2.5 sm:p-3">
          <div className="text-[10px] sm:text-xs text-blue-700">Money</div>
          <div className="text-sm sm:text-lg font-bold text-blue-800 truncate">
            {formatINR(totalMoney)}
          </div>
        </div>
        <div className="rounded-lg border bg-red-50 p-2.5 sm:p-3">
          <div className="text-[10px] sm:text-xs text-red-700">Due ₹</div>
          <div className="text-sm sm:text-lg font-bold text-red-800 truncate">
            {formatINR(totalDue)}
          </div>
        </div>
      </div>

      {/* ===== Mobile cards ===== */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-10 text-gray-400">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-gray-400">No sales for this filter</p>
        ) : (
          rows.map((r) => {
            const due = n(r.dueAmount);
            const badge = paymentBadge(r);
            const mode = detectBillMode(r);
            return (
              <div key={r.id} className="card p-3 border shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.customerName || '—'}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {r.invoiceNo} · {String(r.invoiceDate).slice(0, 10)}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
                    {modeLabel(mode)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="rounded bg-emerald-50 p-2">
                    <div className="text-[10px] text-emerald-700">Fine</div>
                    <div className="font-bold text-emerald-800">
                      {n(r.totalFine).toFixed(4)} g
                    </div>
                  </div>
                  <div className="rounded bg-gray-50 p-2">
                    <div className="text-[10px] text-gray-500">Amount</div>
                    <div className="font-medium">{formatINR(n(r.grandTotal))}</div>
                  </div>
                  <div className="rounded bg-gray-50 p-2">
                    <div className="text-[10px] text-gray-500">Paid</div>
                    <div>{formatINR(n(r.paidAmount))}</div>
                  </div>
                  <div className="rounded bg-red-50 p-2">
                    <div className="text-[10px] text-red-600">Due</div>
                    <div
                      className={
                        'font-medium ' +
                        (due > 0 ? 'text-red-700' : due < 0 ? 'text-red-800' : 'text-emerald-700')
                      }
                    >
                      {formatINR(due)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={
                      'text-xs px-2 py-0.5 rounded-full font-medium ' +
                      (badge === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : badge === 'partial'
                          ? 'bg-amber-100 text-amber-700'
                          : badge === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600')
                    }
                  >
                    {badge}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="p-2 text-blue-600 bg-blue-50 rounded-lg"
                      onClick={() => openView(r)}
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-gray-700 bg-gray-100 rounded-lg"
                      onClick={() => openPdf(r.id, r.invoiceNo)}
                    >
                      <Printer size={18} />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-emerald-600 bg-emerald-50 rounded-lg"
                      onClick={() => openWhatsApp(r, r.customerMobile)}
                    >
                      <MessageCircle size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ===== Desktop table ===== */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Party</th>
                <th>Type</th>
                <th className="text-right">Fine (g)</th>
                <th className="text-right">Amount ₹</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-400">
                    No sales for this filter
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const due = n(r.dueAmount);
                  const badge = paymentBadge(r);
                  const mode = detectBillMode(r);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        {String(r.invoiceDate).slice(0, 10)}
                      </td>
                      <td className="font-mono text-xs">{r.invoiceNo}</td>
                      <td className="font-medium max-w-[140px] truncate">
                        {r.customerName || '—'}
                      </td>
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {modeLabel(mode)}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-emerald-700">
                        {n(r.totalFine).toFixed(4)}
                      </td>
                      <td className="text-right">{formatINR(n(r.grandTotal))}</td>
                      <td className="text-right">{formatINR(n(r.paidAmount))}</td>
                      <td
                        className={
                          'text-right font-medium ' +
                          (due > 0
                            ? 'text-red-600'
                            : due < 0
                              ? 'text-red-700 bg-red-50'
                              : 'text-emerald-600')
                        }
                      >
                        {formatINR(due)}
                      </td>
                      <td>
                        <span
                          className={
                            'text-xs px-2 py-0.5 rounded-full font-medium ' +
                            (badge === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : badge === 'partial'
                                ? 'bg-amber-100 text-amber-700'
                                : badge === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : badge === 'error'
                                    ? 'bg-red-200 text-red-800'
                                    : 'bg-gray-100 text-gray-600')
                          }
                        >
                          {badge}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            onClick={() => openView(r)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded"
                            onClick={() => openPdf(r.id, r.invoiceNo)}
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            onClick={() => openWhatsApp(r, r.customerMobile)}
                          >
                            <MessageCircle size={16} />
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

      {/* Dialog — full width on mobile */}
      {dialogOpen && detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-3">
          <div className="absolute inset-0 bg-black/40" onClick={closeView} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b">
              <div className="min-w-0 pr-2">
                <h2 className="font-semibold text-base sm:text-lg">Settlement board</h2>
                <p className="text-[11px] sm:text-xs text-gray-500 truncate">
                  {detail.invoiceNo} · {String(detail.invoiceDate).slice(0, 10)} ·{' '}
                  {detail.customerName || '—'} · {modeLabel(detectBillMode(detail))}
                </p>
              </div>
              <button
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg shrink-0"
                onClick={closeView}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 sm:p-5 space-y-4">
              {dialogLoading && <p className="text-sm text-gray-400">Loading...</p>}

              <div className="rounded-xl border-2 border-primary-200 bg-primary-50/40 p-3 sm:p-4">
                <h3 className="font-semibold text-sm mb-2">Record preview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="rounded-lg bg-emerald-50 border p-2 col-span-2 sm:col-span-1">
                    <div className="text-[10px] text-emerald-700">Fine bill</div>
                    <div className="font-bold text-emerald-800">
                      {n(detail.totalFine).toFixed(4)} g
                    </div>
                  </div>
                  <div className="rounded-lg bg-cyan-50 border p-2">
                    <div className="text-[10px] text-cyan-700">Fine received</div>
                    <div className="font-bold">{n(detail.receivedFine).toFixed(4)} g</div>
                  </div>
                  <div className="rounded-lg bg-violet-50 border p-2">
                    <div className="text-[10px] text-violet-700">Fine balance</div>
                    <div className="font-bold">
                      {n(detail.fineBalance ?? detail.totalFine).toFixed(4)} g
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border p-2">
                    <div className="text-[10px] text-gray-500">Status</div>
                    <div className="font-bold capitalize text-sm">
                      {detail.status || 'confirmed'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border p-2">
                    <div className="text-[10px] text-gray-500">Bill ₹</div>
                    <div className="font-bold text-sm">{formatINR(n(detail.grandTotal))}</div>
                  </div>
                  <div className="rounded-lg bg-white border p-2">
                    <div className="text-[10px] text-emerald-700">Paid ₹</div>
                    <div className="font-bold text-emerald-800 text-sm">
                      {formatINR(n(detail.paidAmount))}
                    </div>
                  </div>
                  <div
                    className={
                      'rounded-lg border p-2 col-span-2 sm:col-span-1 ' +
                      (n(detail.dueAmount) < 0 ? 'bg-red-100' : 'bg-white')
                    }
                  >
                    <div className="text-[10px] text-red-700">Due ₹</div>
                    <div className="font-bold text-red-800 text-sm">
                      {formatINR(n(detail.dueAmount))}
                    </div>
                  </div>
                </div>

                {previewLog.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs font-medium text-gray-600">This session</div>
                    {previewLog.map((line, i) => (
                      <div
                        key={i}
                        className="text-xs bg-white border border-emerald-200 rounded px-2 py-1.5 text-emerald-900"
                      >
                        ✓ {line}
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(savedNotes?.history) && savedNotes.history.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs font-medium text-gray-600">Saved history</div>
                    {savedNotes.history.slice(0, 6).map((h: any, i: number) => (
                      <div
                        key={i}
                        className="text-xs bg-white border rounded px-2 py-1 text-gray-700"
                      >
                        {h.type === 'silver_palta'
                          ? `Silver+Palta · ${h.creditedG} g`
                          : h.type === 'cash_fine'
                            ? `Cash→Fine · ₹${h.cash} = ${h.fineG} g`
                            : JSON.stringify(h)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {n(detail.dueAmount) < 0 && (
                <button
                  type="button"
                  className="btn-secondary text-red-700 w-full"
                  disabled={updating}
                  onClick={fixNegativeDue}
                >
                  Fix negative due → 0
                </button>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end">
                <div className="flex-1 min-w-0">
                  <label className="label">DB Status</label>
                  <select
                    className="input"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={updating}
                  onClick={updateStatus}
                >
                  Update status
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Settlement</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  {SETTLE_MODES.map((m) => {
                    const Icon = m.icon;
                    const on = settleMode === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSettleMode(m.key)}
                        className={
                          'text-left rounded-xl border-2 p-3 ' +
                          (on
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 bg-white')
                        }
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          <Icon size={16} />
                          {m.title}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
                      </button>
                    );
                  })}
                </div>

                {settleMode === 'money' && (
                  <div className="rounded-lg border p-3 space-y-2 bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="number"
                        className="input"
                        placeholder="Amount ₹"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        step="any"
                      />
                      <select
                        className="input"
                        value={payMode}
                        onChange={(e) => setPayMode(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                        <option value="rtgs">RTGS</option>
                        <option value="upi">UPI</option>
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={updating}
                        onClick={applyMoney}
                      >
                        Add money
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-primary-700 underline"
                      onClick={() =>
                        setPayAmount(String(Math.max(0, n(detail.dueAmount))))
                      }
                    >
                      Fill full due ₹
                    </button>
                  </div>
                )}

                {settleMode === 'silver_palta' && (
                  <div className="rounded-lg border border-emerald-200 p-3 space-y-2 bg-emerald-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="number"
                        className="input"
                        placeholder="Weight g"
                        value={recvWeight}
                        onChange={(e) => setRecvWeight(e.target.value)}
                        step="any"
                      />
                      <input
                        type="number"
                        className="input"
                        placeholder="Purity %"
                        value={recvPurity}
                        onChange={(e) => setRecvPurity(e.target.value)}
                        step="any"
                      />
                      <input
                        type="number"
                        className="input"
                        placeholder="Palta g/kg"
                        value={paltaRate}
                        onChange={(e) => setPaltaRate(e.target.value)}
                        step="any"
                      />
                    </div>
                    <p className="text-xs text-emerald-900">
                      Fine {liveFineDep.toFixed(4)} + Palta {livePalta.toFixed(4)} ={' '}
                      <b>{(liveFineDep + livePalta).toFixed(4)} g</b>
                    </p>
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={updating}
                      onClick={applySilverPalta}
                    >
                      Add silver + palta
                    </button>
                  </div>
                )}

                {settleMode === 'cash_fine' && (
                  <div className="rounded-lg border border-amber-200 p-3 space-y-2 bg-amber-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        className="input"
                        placeholder="Cash ₹"
                        value={cashFineAmt}
                        onChange={(e) => setCashFineAmt(e.target.value)}
                      />
                      <input
                        type="number"
                        className="input"
                        placeholder="Rate ₹/kg"
                        value={marketRate}
                        onChange={(e) => setMarketRate(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-amber-900">
                      Equivalent fine: <b>{liveCashFine.toFixed(4)} g</b>
                    </p>
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={updating}
                      onClick={applyCashFine}
                    >
                      Add cash → fine
                    </button>
                  </div>
                )}
              </div>

              {lineItems.length > 0 && (
                <div className="overflow-x-auto border rounded-lg -mx-1">
                  <table className="data-table w-full text-sm min-w-[320px]">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-right">Gross</th>
                        <th className="text-right">Tunch</th>
                        <th className="text-right">Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((it, i) => (
                        <tr key={it.id ?? i}>
                          <td>{it.itemName || it.name || '—'}</td>
                          <td className="text-right">
                            {n(it.grossWeight ?? it.netWeight).toFixed(3)}
                          </td>
                          <td className="text-right">{n(it.purity)}%</td>
                          <td className="text-right text-emerald-700 font-medium">
                            {n(it.fineWeight).toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white px-3 sm:px-5 py-3 border-t flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2 flex-1 sm:flex-none justify-center"
                onClick={() => openPdf(detail.id, detail.invoiceNo)}
              >
                <Printer size={16} /> PDF
              </button>
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2 text-emerald-700 flex-1 sm:flex-none justify-center"
                onClick={() => openWhatsApp(detail, detail.customerMobile)}
              >
                <MessageCircle size={16} /> WhatsApp
              </button>
              <button
                type="button"
                className="btn-secondary flex-1 sm:flex-none"
                onClick={closeView}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}