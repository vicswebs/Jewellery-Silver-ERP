import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Users,
  ShoppingCart,
  RefreshCw,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Calculator,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const quickActions = [
  { to: '/sales/new', icon: PlusCircle, label: 'New Sale', color: 'bg-primary-600' },
  { to: '/customers', icon: Users, label: 'Customers', color: 'bg-blue-600' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales', color: 'bg-amber-600' },
  { to: '/accounts/customer', icon: Users, label: 'Account Summary', color: 'bg-indigo-600' },
];

type PnLPeriod = 'today' | 'month' | 'year' | 'lifetime' | 'custom' | 'custom_year';

interface DashboardData {
  today: {
    salesTotal: number;
    salesCount: number;
    salesPaid: number;
    purchaseTotal: number;
    purchaseCount: number;
  };
  outstanding: number;
  cashBalance: number;
  bankBalance: number;
  activeCustomers: number;
  recentSales: Array<{
    id: number;
    invoiceNo: string;
    invoiceDate: string;
    customerName: string | null;
    grandTotal: string;
    dueAmount: string;
    status: string;
  }>;
  pnl: {
    period: PnLPeriod;
    periodLabel?: string;
    year: number | null;
    month: number | null;
    from: string | null;
    to: string | null;
    totalSales: number;
    totalPurchases: number;
    salesCount: number;
    purchaseCount: number;
    profitLoss: number;
    isProfit: boolean;
  };
  market: {
    silver: {
      usdPerOz: number;
      inrPerOz: number;
      inrPerGram: number;
      changePercent: number | null;
      usdInr: number;
      source: string;
      updatedAt: string;
    };
    history: Array<{ label: string; buy: number; sell: number }>;
    cached?: boolean;
  } | null;
  asOf: string;
}

function formatINR(n: number) {
  return '₹ ' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function SilverChart({
  history,
}: {
  history: Array<{ label: string; buy: number; sell: number }>;
}) {
  if (!history.length) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
        No rate history yet
      </div>
    );
  }
  const values = history.map((h) => h.sell);
  const min = Math.min(...values) * 0.998;
  const max = Math.max(...values) * 1.002;
  const w = 320;
  const h = 140;
  const pad = 16;
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = pts.join(' ');
  const lastX =
    pad + ((values.length - 1) * (w - pad * 2)) / Math.max(values.length - 1, 1);
  const area = `${pad},${h - pad} ${line} ${lastX},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
      <defs>
        <linearGradient id="silverGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#silverGrad)" />
      <polyline
        points={line}
        fill="none"
        stroke="#4b5563"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
        const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill="#374151" />;
      })}
    </svg>
  );
}

const PERIODS: { key: PnLPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'lifetime', label: 'Lifetime' },
  { key: 'custom', label: 'Custom Month' },
  { key: 'custom_year', label: 'Custom Year' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Dashboard() {
  const now = new Date();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PnLPeriod>('lifetime');
  const [customYear, setCustomYear] = useState(now.getFullYear());
  const [customMonth, setCustomMonth] = useState(now.getMonth() + 1);

  // Recovery calculator inputs
  const [buyRate, setBuyRate] = useState('');
  const [sellRate, setSellRate] = useState('');

  const load = async (p: PnLPeriod = period) => {
    setLoading(true);
    try {
      const params: any = { period: p };
      if (p === 'custom') {
        params.year = customYear;
        params.month = customMonth;
      }
      if (p === 'custom_year') {
        params.year = customYear;
      }
      const { data: res } = await api.get('/dashboard', { params });
      if (res.success) {
        setData(res.data);
        // Prefill calculator with market rate when empty
        const g = res.data?.market?.silver?.inrPerGram;
        if (g && !buyRate) setBuyRate(String(Math.round(g * 0.99 * 100) / 100));
        if (g && !sellRate) setSellRate(String(Math.round(g * 100) / 100));
      }
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    const t = setInterval(() => load(period), 5 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customYear, customMonth]);

  const applyCustom = () => {
    if (period === 'custom' || period === 'custom_year') {
      load(period);
    } else {
      setPeriod('custom');
    }
  };

  const stats = data
    ? [
        {
          label: "Today's Sales",
          value: formatINR(data.today.salesTotal),
          sub: data.today.salesCount + ' invoice(s)',
        },
        {
          label: 'Outstanding',
          value: formatINR(data.outstanding),
          sub: 'Customer dues',
        },
        {
          label: 'Cash Balance',
          value: formatINR(data.cashBalance),
          sub: 'Bank: ' + formatINR(data.bankBalance),
        },
        {
          label: "Today's Purchase",
          value: formatINR(data.today.purchaseTotal),
          sub: data.today.purchaseCount + ' bill(s)',
        },
      ]
    : [];

  const silver = data?.market?.silver;
  const pnl = data?.pnl;

  // Recovery calculator
  const lossAmount =
    pnl && !pnl.isProfit ? Math.abs(pnl.profitLoss) : pnl && pnl.isProfit ? 0 : 0;
  const buy = parseFloat(buyRate) || 0;
  const sell = parseFloat(sellRate) || 0;
  const marginPerGram = sell - buy;
  const gramsNeeded =
    lossAmount > 0 && marginPerGram > 0 ? lossAmount / marginPerGram : 0;
  const investmentNeeded = gramsNeeded * buy;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Ritik Chains — Jewellery & Silver ERP</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => load(period)}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {quickActions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="card p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
          >
            <div className={a.color + ' p-3 rounded-lg text-white'}>
              <a.icon size={22} />
            </div>
            <span className="text-sm font-medium text-gray-700">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading && !data
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-32" />
              </div>
            ))
          : stats.map((s) => (
              <div key={s.label} className="card p-5">
                <div className="text-sm text-gray-500">{s.label}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
                {s.sub && <div className="text-xs text-gray-400 mt-1">{s.sub}</div>}
              </div>
            ))}
      </div>

      {/* Silver market */}
      <div className="card p-5 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-gray-600" />
              Live Silver Market
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Live spot · cache 5 min · auto-refresh 5 min
            </p>
          </div>
          {silver && (
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                ₹ {silver.inrPerGram.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                <span className="text-sm font-normal text-gray-500"> / gram</span>
              </div>
              <div className="text-sm text-gray-500">
                ${silver.usdPerOz.toFixed(2)} / oz
              </div>
              <div className="text-xs text-gray-400">
                ≈ ₹ {silver.inrPerOz.toLocaleString('en-IN')} / oz · USD/INR {silver.usdInr}
              </div>
            </div>
          )}
        </div>
        <SilverChart history={data?.market?.history || []} />
        {silver && (
          <p className="text-xs text-gray-400 mt-1">
            Source: {silver.source}
            {data?.market?.cached ? ' (cached)' : ' (fresh)'} · Updated{' '}
            {new Date(silver.updatedAt).toLocaleString('en-IN')}
          </p>
        )}
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="card p-4 flex items-center gap-3">
            <Users className="text-blue-600" size={22} />
            <div>
              <div className="text-xl font-bold">{data.activeCustomers}</div>
              <div className="text-xs text-gray-500">Active Customers</div>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <ShoppingCart className="text-amber-600" size={22} />
            <div>
              <div className="text-xl font-bold">{data.today.salesCount}</div>
              <div className="text-xs text-gray-500">Sales Today</div>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <IndianRupee className="text-primary-600" size={22} />
            <div>
              <div className="text-xl font-bold">{formatINR(data.today.salesPaid)}</div>
              <div className="text-xs text-gray-500">Collected Today</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Recent Sales</h2>
            <Link to="/sales" className="text-sm text-primary-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {!data || data.recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-400">
                      No sales yet
                    </td>
                  </tr>
                ) : (
                  data.recentSales.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{s.invoiceNo}</td>
                      <td>{s.customerName || '—'}</td>
                      <td className="text-right">
                        ₹ {parseFloat(s.grandTotal).toLocaleString('en-IN')}
                      </td>
                      <td className="text-right">
                        ₹ {parseFloat(s.dueAmount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profit / Loss + Custom + Calculator */}
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              {pnl?.isProfit !== false ? (
                <TrendingUp size={16} className="text-emerald-600" />
              ) : (
                <TrendingDown size={16} className="text-red-600" />
              )}
              <h2 className="font-semibold text-gray-800">Overall Profit / Loss</h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={
                    'px-2.5 py-1 rounded text-xs font-medium border transition-colors ' +
                    (period === p.key
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom month / year pickers */}
            {(period === 'custom' || period === 'custom_year') && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                {period === 'custom' && (
                  <div>
                    <label className="label text-xs">Month</label>
                    <select
                      className="input"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(Number(e.target.value))}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label text-xs">Year</label>
                  <input
                    type="number"
                    className="input w-28"
                    value={customYear}
                    min={2000}
                    max={2100}
                    onChange={(e) => setCustomYear(Number(e.target.value))}
                  />
                </div>
                <button type="button" className="btn-primary" onClick={applyCustom}>
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            {!pnl ? (
              <p className="text-center text-gray-400 py-6">No data</p>
            ) : (
              <>
                <p className="text-xs text-gray-400">
                  Showing:{' '}
                  <b className="text-gray-700">{pnl.periodLabel || period}</b>
                  {pnl.from && (
                    <span>
                      {' '}
                      ({pnl.from} → {pnl.to})
                    </span>
                  )}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                    <div className="text-xs text-emerald-700">Total Sales</div>
                    <div className="text-lg font-bold text-emerald-800">
                      {formatINR(pnl.totalSales)}
                    </div>
                    <div className="text-xs text-emerald-600">{pnl.salesCount} bill(s)</div>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                    <div className="text-xs text-red-700">Total Purchase</div>
                    <div className="text-lg font-bold text-red-800">
                      {formatINR(pnl.totalPurchases)}
                    </div>
                    <div className="text-xs text-red-600">{pnl.purchaseCount} bill(s)</div>
                  </div>
                </div>

                <div
                  className={`rounded-lg p-4 border ${
                    pnl.isProfit
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="text-sm text-gray-600">
                    {pnl.isProfit ? 'Net Profit' : 'Net Loss'}
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      pnl.isProfit ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {formatINR(Math.abs(pnl.profitLoss))}
                  </div>
                </div>

                {/* Recovery Calculator */}
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator size={16} className="text-primary-600" />
                    <h3 className="font-semibold text-sm text-gray-800">
                      Loss Recovery Calculator
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Based on selected period
                    {lossAmount > 0
                      ? ` loss of ${formatINR(lossAmount)}`
                      : ' (no loss in this period — still useful for planning)'}
                    . Enter buy & expected sell rate per gram.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="label text-xs">Buy rate ₹/g</label>
                      <input
                        type="number"
                        className="input"
                        step="any"
                        value={buyRate}
                        onChange={(e) => setBuyRate(e.target.value)}
                        placeholder="e.g. 95"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Expected sell ₹/g</label>
                      <input
                        type="number"
                        className="input"
                        step="any"
                        value={sellRate}
                        onChange={(e) => setSellRate(e.target.value)}
                        placeholder="e.g. 98"
                      />
                    </div>
                  </div>

                  {marginPerGram <= 0 ? (
                    <p className="text-xs text-amber-700">
                      Sell rate must be higher than buy rate to show recovery plan.
                    </p>
                  ) : lossAmount <= 0 ? (
                    <p className="text-xs text-emerald-700">
                      No loss in this period. Profit margin = ₹ {marginPerGram.toFixed(2)} / gram.
                    </p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Profit margin / gram</span>
                        <b>₹ {marginPerGram.toFixed(2)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Silver to buy</span>
                        <b className="text-primary-700">
                          {gramsNeeded.toFixed(3)} g
                        </b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Investment needed</span>
                        <b>{formatINR(investmentNeeded)}</b>
                      </div>
                      <p className="text-xs text-gray-400 pt-1">
                        Formula: Loss ÷ (Sell − Buy) = grams needed. Then grams × Buy =
                        investment. Works for the period you selected (Today / Month /
                        Year / Lifetime / Custom).
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {data && (
        <p className="text-xs text-gray-400 mt-4 text-right">
          Last updated: {new Date(data.asOf).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}