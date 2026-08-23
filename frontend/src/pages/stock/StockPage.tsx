import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface Item {
  id: number;
  code: string;
  name: string;
  categoryName?: string;
  currentQty: string;
  currentGross: string;
  currentNet: string;
  currentFine: string;
  saleRate: string;
  minStock: string;
  status: string;
}

export default function StockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/items', { params: { limit: 200 } });
        setItems(data.data || []);
      } catch {
        toast.error('Failed to load stock');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <p className="text-sm text-gray-500">Current ornament / metal stock</p>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Gross (g)</th>
                <th>Net (g)</th>
                <th>Fine (g)</th>
                <th>Rate</th>
                <th>Min Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">
                    No stock data
                  </td>
                </tr>
              ) : (
                items.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.code}</td>
                    <td className="font-medium">{i.name}</td>
                    <td>{parseFloat(i.currentQty || '0')}</td>
                    <td>{parseFloat(i.currentGross || '0').toFixed(3)}</td>
                    <td>{parseFloat(i.currentNet || '0').toFixed(3)}</td>
                    <td>{parseFloat(i.currentFine || '0').toFixed(4)}</td>
                    <td>₹ {parseFloat(i.saleRate || '0').toLocaleString()}</td>
                    <td>{parseFloat(i.minStock || '0')}</td>
                    <td>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          i.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
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
