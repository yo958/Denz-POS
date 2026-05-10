'use client';

/**
 * CsvImportDialog
 * ─────────────────────────────────────────────────────────
 * Accepts a CSV file and bulk-imports food/drink menu items.
 *
 * Required columns: name, price, category
 * Optional columns: description, stock, low_stock_at, cost,
 *                   glyph, send_to_kitchen
 *
 * Category must be "food" or "drinks".
 * send_to_kitchen accepts: true/false/yes/no/1/0 (defaults to true for food).
 */

import { useCallback, useRef, useState } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { newId } from '@/lib/domain/id';
import type { Product } from '@/lib/types';

/* ── CSV parsing ─────────────────────────────────────────── */

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(l => parseCsvLine(l));
  return { headers, rows };
}

/* ── Row validation + mapping ────────────────────────────── */

type RowResult =
  | { ok: true; product: Product }
  | { ok: false; errors: string[] };

const VALID_CATEGORIES = new Set(['food', 'drinks']);

function mapRow(headers: string[], cells: string[]): RowResult {
  const get = (key: string) => cells[headers.indexOf(key)]?.trim() ?? '';
  const errors: string[] = [];

  const name = get('name');
  if (!name) errors.push('name is required');

  const priceStr = get('price');
  const price = parseFloat(priceStr);
  if (!priceStr || isNaN(price) || price < 0) errors.push('price must be a positive number');

  const category = get('category').toLowerCase();
  if (!VALID_CATEGORIES.has(category)) errors.push('category must be "food" or "drinks"');

  if (errors.length) return { ok: false, errors };

  const description = get('description') || '';

  const stockStr = get('stock');
  const stock = stockStr === '' ? null : parseInt(stockStr, 10);

  const lowStockStr = get('low_stock_at');
  const lowStockAt = lowStockStr === '' ? null : parseInt(lowStockStr, 10);

  const costStr = get('cost');
  const cost = costStr === '' ? null : parseFloat(costStr);

  const glyphRaw = get('glyph');
  const glyph = glyphRaw || null;

  const kitchenRaw = get('send_to_kitchen').toLowerCase();
  const sendToKitchen = kitchenRaw === '' || kitchenRaw === 'true' || kitchenRaw === 'yes' || kitchenRaw === '1';

  return {
    ok: true,
    product: {
      id: newId('prod'),
      name,
      price,
      category: category as 'food' | 'drinks',
      description,
      stock: isNaN(stock as number) ? null : stock,
      lowStockAt: isNaN(lowStockAt as number) ? null : lowStockAt,
      cost: cost !== null && isNaN(cost) ? null : cost,
      glyph,
      sendToKitchen,
    },
  };
}

/* ── Template download ───────────────────────────────────── */

const TEMPLATE_HEADERS = ['name', 'price', 'category', 'description', 'stock', 'low_stock_at', 'cost', 'glyph', 'send_to_kitchen'];
const TEMPLATE_ROWS = [
  ['Avo Toast', '14', 'food', 'Sourdough, smashed avo, feta, chilli', '', '', '6', '🥑', 'true'],
  ['Flat White', '5', 'drinks', 'Double ristretto, steamed milk', '', '', '1.50', '☕', 'false'],
];

function downloadTemplate() {
  const lines = [TEMPLATE_HEADERS.join(','), ...TEMPLATE_ROWS.map(r => r.join(','))].join('\n');
  const blob = new Blob([lines], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'menu-import-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ── Component ───────────────────────────────────────────── */

interface CsvImportDialogProps {
  onClose: () => void;
  onImport: (products: Product[]) => void;
}

type Step = 'upload' | 'preview';

export function CsvImportDialog({ onClose, onImport }: CsvImportDialogProps) {
  const [step, setStep]           = useState<Step>('upload');
  const [dragging, setDragging]   = useState(false);
  const [fileName, setFileName]   = useState('');
  const [results, setResults]     = useState<RowResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please select a .csv file.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCsv(text);
      if (!headers.includes('name') || !headers.includes('price') || !headers.includes('category')) {
        alert('CSV must include columns: name, price, category');
        return;
      }
      const mapped = rows.filter(r => r.some(c => c !== '')).map(r => mapRow(headers, r));
      setResults(mapped);
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const valid   = results.filter(r => r.ok) as Extract<RowResult, { ok: true }>[];
  const invalid = results.filter(r => !r.ok) as Extract<RowResult, { ok: false }>[];

  function handleImport() {
    onImport(valid.map(r => r.product));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl glass-strong rounded-3xl shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Import menu items</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'upload' ? 'Upload a CSV file to bulk-add food and drink items' : `${results.length} rows · ${valid.length} valid · ${invalid.length} with errors`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">

          {step === 'upload' && (
            <div className="p-6 space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors select-none ${
                  dragging
                    ? 'border-primary bg-primary/8'
                    : 'border-border hover:border-primary/50 hover:bg-black/3 dark:hover:bg-white/4'
                }`}
              >
                <Upload size={28} strokeWidth={1.5} className="text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Drop your CSV here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Required columns: name, price, category</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Column reference */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Column reference</span>
                  <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity cursor-pointer">
                    <Download size={12} strokeWidth={2} /> Download template
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { col: 'name',            req: true,  desc: 'Item name' },
                    { col: 'price',           req: true,  desc: 'Selling price (number)' },
                    { col: 'category',        req: true,  desc: '"food" or "drinks"' },
                    { col: 'description',     req: false, desc: 'Short description shown on the card' },
                    { col: 'stock',           req: false, desc: 'Starting stock quantity (leave blank = not tracked)' },
                    { col: 'low_stock_at',    req: false, desc: 'Low-stock warning threshold' },
                    { col: 'cost',            req: false, desc: 'Cost price per unit (for margin reporting)' },
                    { col: 'glyph',           req: false, desc: 'Emoji shown on the card, e.g. 🥑' },
                    { col: 'send_to_kitchen', req: false, desc: 'true/false — defaults to true for food, false for drinks' },
                  ].map(({ col, req, desc }) => (
                    <div key={col} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <code className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded shrink-0">{col}</code>
                      {req && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 shrink-0">REQUIRED</span>}
                      <span className="text-muted-foreground flex-1">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="p-6 space-y-4">
              {/* Summary pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <CheckCircle2 size={12} /> {valid.length} ready to import
                </span>
                {invalid.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                    <AlertCircle size={12} /> {invalid.length} row{invalid.length !== 1 ? 's' : ''} with errors (will be skipped)
                  </span>
                )}
                <button
                  onClick={() => { setStep('upload'); setResults([]); setFileName(''); }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Choose different file
                </button>
              </div>

              {/* Preview table */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{fileName}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-6">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Category</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Price</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {results.map((row, i) => (
                        <tr key={i} className={row.ok ? '' : 'bg-rose-50/60 dark:bg-rose-900/10'}>
                          <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                          {row.ok ? (
                            <>
                              <td className="px-3 py-2 font-medium whitespace-nowrap">
                                {row.product.glyph && <span className="mr-1.5">{row.product.glyph}</span>}
                                {row.product.name}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  row.product.category === 'food'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                                }`}>
                                  {row.product.category}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{row.product.price.toFixed(2)}</td>
                              <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{row.product.description || '—'}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 size={12} /> OK
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td colSpan={4} className="px-3 py-2 text-muted-foreground italic">Invalid row</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400" title={row.errors.join('; ')}>
                                  <AlertCircle size={12} /> {row.errors[0]}{row.errors.length > 1 ? ` +${row.errors.length - 1}` : ''}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            Cancel
          </button>
          {step === 'upload' ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 flex-1 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer justify-center"
            >
              <Upload size={15} strokeWidth={2.5} /> Select CSV file
            </button>
          ) : (
            <button
              onClick={handleImport}
              disabled={valid.length === 0}
              className="flex items-center gap-2 flex-1 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} strokeWidth={2.5} />
              Import {valid.length} item{valid.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
