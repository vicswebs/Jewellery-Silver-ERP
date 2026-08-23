import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Printer, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../../services/api';

interface LookupCustomer {
  id: number;
  code: string;
  name: string;
  mobile: string | null;
}

interface LedgerRow {
  id: number;
  entryDate: string;
  ledgerType: string;
  referenceNo: string | null;
  debit: number;
  credit: number;
  fineDebit: number;
  fineCredit: number;
  narration: string | null;
  type: 'jama' | 'issue' | 'other';
  runningBalance: number;
  runningFine: number;
}

interface AccountData {
  customer: {
    id: number;
    code: string;
    name: string;
    mobile: string | null;
    city: string | null;
    openingBalance: number;
    openingFine: number;
  };
  summary: {
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingFine: number;
  };
  entries: LedgerRow[];
}

function formatINR(n: number) {
  return '₹ ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function CustomerAccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lookup, setLookup] = useState<LookupCustomer[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get('id') ? Number(searchParams.get('id')) : null
  );
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/customers/lookup/list');
        setLookup(data.data || []);
      } catch {
        toast.error('Failed to load customers');
      }
    })();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = lookup.filter((c) => {
    const q = searchText.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.mobile || '').includes(q) ||
      String(c.id).includes(q)
    );
  });

  const loadAccount = async (id: number) => {
    setLoading(true);
    try {
      const params: any = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const { data } = await api.get(`/customers/${id}/account`, { params });
      if (data.success) {
        setAccount(data.data);
        setSelectedId(id);
        setSearchParams({ id: String(id) });
        const c = data.data.customer;
        setSearchText(`${c.code} — ${c.name}`);
      }
    } catch {
      toast.error('Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) loadAccount(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectCustomer = (c: LookupCustomer) => {
    setSearchText(`${c.code} — ${c.name}`);
    setShowDrop(false);
    loadAccount(c.id);
  };

  const issueRows = account?.entries.filter((e) => e.debit > 0) || [];
  const jamaRows = account?.entries.filter((e) => e.credit > 0) || [];

  const loadCompanySettings = () => {
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
  };

  const handlePrint = () => {
    if (!account) return toast.error('Select a customer first');
    const w = window.open('', '_blank');
    if (!w) return toast.error('Allow popups to print');

    const company = loadCompanySettings();

    const leftRows = issueRows
      .map(
        (e) =>
          `<tr>
            <td>${e.entryDate}</td>
            <td>${e.referenceNo || e.ledgerType}</td>
            <td>${e.narration || ''}</td>
            <td style="text-align:right">${e.debit.toFixed(2)}</td>
          </tr>`
      )
      .join('');

    const rightRows = jamaRows
      .map(
        (e) =>
          `<tr>
            <td>${e.entryDate}</td>
            <td>${e.referenceNo || e.ledgerType}</td>
            <td>${e.narration || ''}</td>
            <td style="text-align:right">${e.credit.toFixed(2)}</td>
          </tr>`
      )
      .join('');

    const subLine = [
      company.address,
      company.phone ? `Ph: ${company.phone}` : '',
      company.gstin ? `GSTIN: ${company.gstin}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    w.document.write(`
      <html><head><title>Account - ${account.customer.name}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:16px;font-size:12px}
        h1{margin:0 0 4px;text-align:center}
        .sub{text-align:center;color:#555;margin:0 0 12px;font-size:11px}
        h2{margin:0 0 12px;font-weight:normal;color:#555}
        .split{display:flex;gap:12px}
        .col{flex:1;border:1px solid #ccc}
        .col h3{margin:0;padding:8px;text-align:center}
        .issue h3{background:#fecaca;color:#991b1b}
        .jama h3{background:#bbf7d0;color:#166534}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ddd;padding:5px 6px}
        th{background:#f9fafb;text-align:left}
        .sum{margin-top:14px}
        .sum span{margin-right:20px}
        @media print{.split{display:flex}}
      </style></head><body>
      <h1>${company.companyName}</h1>
      ${subLine ? `<p class="sub">${subLine}</p>` : ''}
      <h2>Customer Account — ${account.customer.code} / ${account.customer.name}</h2>
      <p>Mobile: ${account.customer.mobile || '—'} |
         Period: ${fromDate || 'Start'} to ${toDate || 'Today'}</p>
      <div class="split">
        <div class="col issue">
          <h3>ISSUE (Debit) — बाईं तरफ</h3>
          <table>
            <thead><tr><th>Date</th><th>Ref</th><th>Narration</th><th>Amount</th></tr></thead>
            <tbody>${leftRows || '<tr><td colspan="4" style="text-align:center">No entries</td></tr>'}</tbody>
          </table>
        </div>
        <div class="col jama">
          <h3>JAMA (Credit) — दाईं तरफ</h3>
          <table>
            <thead><tr><th>Date</th><th>Ref</th><th>Narration</th><th>Amount</th></tr></thead>
            <tbody>${rightRows || '<tr><td colspan="4" style="text-align:center">No entries</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="sum">
        <span><b>Total Issue:</b> ${formatINR(account.summary.totalDebit)}</span>
        <span><b>Total Jama:</b> ${formatINR(account.summary.totalCredit)}</span>
        <span><b>Opening:</b> ${formatINR(account.summary.openingBalance)}</span>
        <span><b>Closing:</b> ${formatINR(account.summary.closingBalance)}</span>
      </div>
      <p style="margin-top:20px;color:#888">Developed by ToolClub.website</p>
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn-secondary p-2">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Account</h1>
            <p className="text-sm text-gray-500">
              Left = Issue (red) &nbsp;|&nbsp; Right = Jama (green)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => selectedId && loadAccount(selectedId)}
            disabled={!selectedId || loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button type="button" className="btn-primary" onClick={handlePrint} disabled={!account}>
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 relative" ref={dropRef}>
            <label className="label">Customer (Name / Code / ID)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                className="input pl-10"
                placeholder="Type name, code or ID..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setShowDrop(true);
                }}
                onFocus={() => setShowDrop(true)}
              />
            </div>
            {showDrop && (
              <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                {filtered.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">No customer found</div>
                ) : (
                  filtered.slice(0, 50).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 border-b border-gray-50"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-mono text-xs text-gray-500 mr-2">#{c.id}</span>
                      <span className="font-medium">{c.code}</span>
                      <span className="mx-1 text-gray-400">—</span>
                      <span>{c.name}</span>
                      {c.mobile && (
                        <span className="ml-2 text-xs text-gray-400">{c.mobile}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!selectedId}
            onClick={() => selectedId && loadAccount(selectedId)}
          >
            View Details
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFromDate('');
              setToDate('');
              if (selectedId) loadAccount(selectedId);
            }}
          >
            Clear Dates
          </button>
        </div>
      </div>

      {account && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="card p-4">
              <div className="text-xs text-gray-500">Customer</div>
              <div className="font-semibold mt-0.5">
                {account.customer.code} — {account.customer.name}
              </div>
              <div className="text-xs text-gray-400">ID: {account.customer.id}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500">Opening Balance</div>
              <div className="text-lg font-bold mt-0.5">
                {formatINR(account.summary.openingBalance)}
              </div>
            </div>
            <div className="card p-4 border-l-4 border-red-400">
              <div className="text-xs text-gray-500">Total Issue (Dr)</div>
              <div className="text-lg font-bold text-red-600 mt-0.5">
                {formatINR(account.summary.totalDebit)}
              </div>
            </div>
            <div className="card p-4 border-l-4 border-green-400">
              <div className="text-xs text-gray-500">Closing / Jama</div>
              <div className="text-lg font-bold text-primary-700 mt-0.5">
                {formatINR(account.summary.closingBalance)}
              </div>
              <div className="text-xs text-green-600">
                Jama: {formatINR(account.summary.totalCredit)}
              </div>
            </div>
          </div>

          {/* LEFT = Issue | RIGHT = Jama */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT — ISSUE */}
            <div className="card overflow-hidden border-t-4 border-red-500">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <h2 className="font-semibold text-red-800">Issue (Debit) — Left</h2>
                <span className="text-sm font-bold text-red-700">
                  {formatINR(account.summary.totalDebit)}
                </span>
              </div>
              <div className="table-container max-h-[480px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref</th>
                      <th>Narration</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-400">
                          Loading...
                        </td>
                      </tr>
                    ) : issueRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-400">
                          No issue entries
                        </td>
                      </tr>
                    ) : (
                      issueRows.map((e) => (
                        <tr key={e.id} className="bg-red-50/50">
                          <td className="whitespace-nowrap">{e.entryDate}</td>
                          <td className="font-mono text-xs">{e.referenceNo || e.ledgerType}</td>
                          <td className="max-w-[140px] truncate text-sm">
                            {e.narration || '—'}
                          </td>
                          <td className="text-right font-medium text-red-700">
                            {formatINR(e.debit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT — JAMA */}
            <div className="card overflow-hidden border-t-4 border-green-500">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                <h2 className="font-semibold text-green-800">Jama (Credit) — Right</h2>
                <span className="text-sm font-bold text-green-700">
                  {formatINR(account.summary.totalCredit)}
                </span>
              </div>
              <div className="table-container max-h-[480px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref</th>
                      <th>Narration</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-400">
                          Loading...
                        </td>
                      </tr>
                    ) : jamaRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-400">
                          No jama entries
                        </td>
                      </tr>
                    ) : (
                      jamaRows.map((e) => (
                        <tr key={e.id} className="bg-green-50/50">
                          <td className="whitespace-nowrap">{e.entryDate}</td>
                          <td className="font-mono text-xs">{e.referenceNo || e.ledgerType}</td>
                          <td className="max-w-[140px] truncate text-sm">
                            {e.narration || '—'}
                          </td>
                          <td className="text-right font-medium text-green-700">
                            {formatINR(e.credit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Closing bar */}
          <div className="card mt-4 p-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50">
            <div className="text-sm text-gray-600">
              Opening: <b>{formatINR(account.summary.openingBalance)}</b>
              <span className="mx-2">|</span>
              Issue: <b className="text-red-600">{formatINR(account.summary.totalDebit)}</b>
              <span className="mx-2">|</span>
              Jama: <b className="text-green-600">{formatINR(account.summary.totalCredit)}</b>
            </div>
            <div className="text-lg font-bold text-primary-800">
              Closing Balance: {formatINR(account.summary.closingBalance)}
            </div>
          </div>
        </>
      )}

      {!account && !loading && (
        <div className="card p-12 text-center text-gray-400">
          Search and select a customer to view account (Left = Issue, Right = Jama)
        </div>
      )}
    </div>
  );
}