'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {
  Newspaper, Plus, Pencil, Trash2, Eye, EyeOff, Tag, FolderOpen,
  X, Search, ChevronDown, ImageIcon, Globe, FileText, Upload,
  CheckCircle, AlertCircle, Loader2,
} from 'lucide-react';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import { toast } from '@/components/ui/toast';
import { confirm } from '@/components/ui/confirm-dialog';
import type { BlogPost, BlogTaxonomy } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function readingTime(html: string): string {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ── Blank form ────────────────────────────────────────────────────────────────

function blankPost(): Partial<BlogPost> {
  return {
    title: '', slug: '', content: '', excerpt: '',
    featureImage: '', metaTitle: '', metaDescription: '', focusKeyword: '',
    categories: [], tags: [], status: 'draft', author: '',
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  return status === 'published'
    ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><Globe size={10} />Published</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><FileText size={10} />Draft</span>;
}

function MetaCounter({ value, max, label }: { value: string; max: number; label: string }) {
  const len = value.length;
  const ok = len >= 1 && len <= max;
  return (
    <p className={`text-xs mt-0.5 ${ok ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'}`}>
      {label}: {len}/{max} chars
    </p>
  );
}

// ── RichTextEditor ────────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [StarterKit, Image.configure({ inline: false, allowBase64: true })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. when opening a different post)
  const prevValue = useRef(value);
  useEffect(() => {
    if (editor && value !== prevValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
    prevValue.current = value;
  }, [editor, value]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 h-7 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-white/50 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
    }`;

  function handleImgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-white/30 dark:bg-black/20 flex-wrap">
        <button type="button" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" className={`${btn(editor.isActive('bold'))} font-bold`} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button type="button" className={`${btn(editor.isActive('italic'))} italic`} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" className={btn(false)} onClick={() => imgInputRef.current?.click()} title="Insert image">
          <ImageIcon size={13} className="inline -mt-0.5" /> Image
        </button>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImgFile} />
      </div>
      <EditorContent
        editor={editor}
        className={[
          'min-h-[220px] px-3 py-2.5 text-sm bg-black/3 dark:bg-white/3',
          '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]',
          '[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-1',
          '[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:mb-0.5',
          '[&_.ProseMirror_p]:my-1',
          '[&_.ProseMirror_strong]:font-bold',
          '[&_.ProseMirror_em]:italic',
          '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5',
          '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5',
          '[&_.ProseMirror_li]:my-0.5',
          '[&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:my-3',
        ].join(' ')}
      />
    </div>
  );
}

// ── TaxonomyPicker ────────────────────────────────────────────────────────────

function TaxonomyPicker({
  label, items, selected, onToggle, onCreate,
}: {
  label: string;
  items: BlogTaxonomy[];
  selected: string[];
  onToggle: (slug: string) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
    } catch {
      // error already toasted by the caller
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 text-sm"
      >
        <span className="flex flex-wrap gap-1 min-h-[20px]">
          {selected.length === 0
            ? <span className="text-muted-foreground">Select {label}…</span>
            : selected.map(s => (
              <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{s}</span>
            ))}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto p-1">
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.slug)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selected.includes(item.slug)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {item.name}
              </button>
            ))}
            {items.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No {label} yet</p>}
          </div>
          <div className="border-t border-border p-2 flex gap-1.5">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder={`New ${label.toLowerCase()}…`}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-2 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PostDialog ────────────────────────────────────────────────────────────────

function PostDialog({
  post, categories, tags, onSave, onClose, onCategoriesChange, onTagsChange,
}: {
  post: Partial<BlogPost> | null;
  categories: BlogTaxonomy[];
  tags: BlogTaxonomy[];
  onSave: (data: Partial<BlogPost>) => Promise<void>;
  onClose: () => void;
  onCategoriesChange: (cats: BlogTaxonomy[]) => void;
  onTagsChange: (tags: BlogTaxonomy[]) => void;
}) {
  const [form, setForm] = useState<Partial<BlogPost>>(post ?? blankPost());
  const [saving, setSaving] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-slug from title (only when creating new)
  const isNew = !post?.id;
  useEffect(() => {
    if (isNew && form.title) {
      setForm(f => ({ ...f, slug: slugify(f.title ?? '') }));
    }
  }, [form.title, isNew]);

  function set<K extends keyof BlogPost>(key: K, value: BlogPost[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('featureImage', ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim()) return toast.error('Title is required');
    if (!form.slug?.trim()) return toast.error('Slug is required');
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  async function handleNewCategory(name: string) {
    const slug = slugify(name);
    const res = await apiFetch<{ category: BlogTaxonomy }>('/api/blog/categories', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    onCategoriesChange([...categories, res.category]);
    set('categories', [...(form.categories ?? []), slug]);
  }

  async function handleNewTag(name: string) {
    const slug = slugify(name);
    const res = await apiFetch<{ tag: BlogTaxonomy }>('/api/blog/tags', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    onTagsChange([...tags, res.tag]);
    set('tags', [...(form.tags ?? []), slug]);
  }

  function toggleCat(slug: string) {
    const cats = form.categories ?? [];
    set('categories', cats.includes(slug) ? cats.filter(c => c !== slug) : [...cats, slug]);
  }

  function toggleTag(slug: string) {
    const t = form.tags ?? [];
    set('tags', t.includes(slug) ? t.filter(x => x !== slug) : [...t, slug]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{isNew ? 'New Article' : 'Edit Article'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input
              value={form.title ?? ''}
              onChange={e => set('title', e.target.value)}
              placeholder="Article title…"
              className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Slug (URL)</label>
            <input
              value={form.slug ?? ''}
              onChange={e => set('slug', slugify(e.target.value))}
              placeholder="article-url-slug"
              className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-0.5">denzphuket.com/blog/{form.slug || '…'}</p>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Excerpt (optional)</label>
            <textarea
              value={form.excerpt ?? ''}
              onChange={e => set('excerpt', e.target.value)}
              rows={2}
              placeholder="Short summary shown on listing page…"
              className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Feature Image */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Feature Image</label>
            {form.featureImage
              ? (
                <div className="relative rounded-xl overflow-hidden border border-border h-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.featureImage} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => set('featureImage', '')}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-lg p-1 hover:bg-black/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
              : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImageIcon size={20} />
                  <span className="text-xs">Upload feature image</span>
                </button>
              )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Content *</label>
            <RichTextEditor value={form.content ?? ''} onChange={v => set('content', v)} />
          </div>

          {/* Categories + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <FolderOpen size={12} />Categories
              </label>
              <TaxonomyPicker
                label="Categories"
                items={categories}
                selected={form.categories ?? []}
                onToggle={toggleCat}
                onCreate={handleNewCategory}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Tag size={12} />Tags
              </label>
              <TaxonomyPicker
                label="Tags"
                items={tags}
                selected={form.tags ?? []}
                onToggle={toggleTag}
                onCreate={handleNewTag}
              />
            </div>
          </div>

          {/* SEO Panel */}
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setSeoOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 dark:bg-violet-900/10 text-sm font-medium text-violet-700 dark:text-violet-400"
            >
              <span className="flex items-center gap-2">
                <Search size={14} />SEO Settings
              </span>
              <ChevronDown size={14} className={`transition-transform ${seoOpen ? 'rotate-180' : ''}`} />
            </button>
            {seoOpen && (
              <div className="p-4 space-y-3 bg-violet-50/30 dark:bg-violet-900/5">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Focus Keyword</label>
                  <input
                    value={form.focusKeyword ?? ''}
                    onChange={e => set('focusKeyword', e.target.value)}
                    placeholder="e.g. coworking phuket"
                    className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Used to guide your writing — include it in title, intro, and headings</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Meta Title</label>
                  <input
                    value={form.metaTitle ?? ''}
                    onChange={e => set('metaTitle', e.target.value)}
                    placeholder={form.title ? `${form.title} | Denz Phuket` : 'Custom page title for search engines…'}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <MetaCounter value={form.metaTitle ?? ''} max={60} label="Meta title" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Meta Description</label>
                  <textarea
                    value={form.metaDescription ?? ''}
                    onChange={e => set('metaDescription', e.target.value)}
                    rows={3}
                    placeholder="Summary shown in Google search results…"
                    className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <MetaCounter value={form.metaDescription ?? ''} max={160} label="Meta description" />
                </div>
              </div>
            )}
          </div>

          {/* Author + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Author</label>
              <input
                value={form.author ?? ''}
                onChange={e => set('author', e.target.value)}
                placeholder="Author name…"
                className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <div className="flex gap-2">
                {(['draft', 'published'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      set('status', s);
                      if (s === 'published' && !form.publishedAt) {
                        set('publishedAt', new Date().toISOString());
                      }
                    }}
                    className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors capitalize ${
                      form.status === s
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : isNew ? 'Create Article' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── TaxonomyManager ───────────────────────────────────────────────────────────

function TaxonomyManager({
  type, items, onAdd, onDelete,
}: {
  type: 'categories' | 'tags';
  items: BlogTaxonomy[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd(name.trim());
      setName('');
    } catch {
      // error already toasted by the caller
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`New ${type === 'categories' ? 'category' : 'tag'} name…`}
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !name.trim()}
          className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-border bg-white/30 dark:bg-white/3">
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{item.slug}</p>
            </div>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-lg hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/20 text-muted-foreground transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No {type} yet</p>}
      </div>
    </div>
  );
}

// ── CSV Import helpers ────────────────────────────────────────────────────────

function stripWpBlocks(html: string): string {
  // Remove WordPress Gutenberg block comments
  let out = html.replace(/<!-- wp:[^>]*?-->/g, '').replace(/<!-- \/wp:[^>]*?-->/g, '');
  // Unwrap <figure class="wp-block-image..."> but keep inner <img>
  out = out.replace(/<figure[^>]*class="[^"]*wp-block-image[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi, (_, inner) => {
    const imgMatch = inner.match(/<img[^>]+>/i);
    return imgMatch ? imgMatch[0] : '';
  });
  // Clean up extra blank lines
  out = out.replace(/(\n\s*){3,}/g, '\n\n').trim();
  return out;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch('/api/blog/fetch-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const { dataUrl } = await res.json();
    return dataUrl ?? null;
  } catch {
    return null;
  }
}

async function replaceContentImageUrls(html: string): Promise<string> {
  const urlRegex = /<img([^>]*?)src="(https?:\/\/[^"]+)"([^>]*?)>/gi;
  const matches = [...html.matchAll(urlRegex)];
  let out = html;
  for (const m of matches) {
    const [full, pre, url, post] = m;
    const base64 = await fetchImageAsBase64(url);
    if (base64) {
      out = out.replace(full, `<img${pre}src="${base64}"${post}>`);
    }
  }
  return out;
}

interface ImportRow {
  title: string;
  content: string;
  excerpt: string;
  date: string;
  imageUrl: string;
  categories: string[];
  tags: string[];
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^﻿/, '').trim());

  const rows: ImportRow[] = [];
  let i = 1;
  while (i < lines.length) {
    // Handle multi-line fields (quoted with embedded newlines)
    let line = lines[i];
    let quoteCount = (line.match(/"/g) || []).length;
    while (quoteCount % 2 !== 0 && i + 1 < lines.length) {
      i++;
      line += '\n' + lines[i];
      quoteCount = (line.match(/"/g) || []).length;
    }
    i++;
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    const get = (name: string) => cols[headers.indexOf(name)]?.trim() ?? '';
    const postType = get('Post Type');
    if (postType && postType !== 'post') continue; // skip pages etc
    rows.push({
      title: get('Title'),
      content: get('Content'),
      excerpt: get('Excerpt'),
      date: get('Date'),
      imageUrl: get('Image URL'),
      categories: get('Categories').split('|').map(s => s.trim()).filter(Boolean),
      tags: get('Tags').split('|').map(s => s.trim()).filter(Boolean),
    });
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cols.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

interface ImportProgress {
  total: number;
  done: number;
  current: string;
  errors: string[];
  finished: boolean;
}

function ImportDialog({
  existingCategories, existingTags, onDone, onClose,
}: {
  existingCategories: BlogTaxonomy[];
  existingTags: BlogTaxonomy[];
  onDone: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  async function ensureTaxonomy(
    name: string,
    existing: BlogTaxonomy[],
    endpoint: string,
  ): Promise<{ updated: BlogTaxonomy[], slug: string }> {
    const slug = slugify(name);
    if (existing.find(t => t.slug === slug)) return { updated: existing, slug };
    const res = await apiFetch<{ category?: BlogTaxonomy; tag?: BlogTaxonomy }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    const created = res.category ?? res.tag!;
    return { updated: [...existing, created], slug };
  }

  async function runImport(file: File) {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { toast.error('No posts found in CSV'); return; }

    let cats = existingCategories;
    let tgs = existingTags;

    setProgress({ total: rows.length, done: 0, current: '', errors: [], finished: false });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errors: string[] = [];
      setProgress(p => ({ ...p!, done: i, current: row.title }));

      try {
        // Ensure categories exist
        const catSlugs: string[] = [];
        for (const catName of row.categories) {
          const r = await ensureTaxonomy(catName, cats, '/api/blog/categories');
          cats = r.updated;
          catSlugs.push(r.slug);
        }

        // Ensure tags exist
        const tagSlugs: string[] = [];
        for (const tagName of row.tags) {
          const r = await ensureTaxonomy(tagName, tgs, '/api/blog/tags');
          tgs = r.updated;
          tagSlugs.push(r.slug);
        }

        // Clean content
        const cleanedContent = stripWpBlocks(row.content);

        // Fetch inline images
        setProgress(p => ({ ...p!, current: `${row.title} (fetching images…)` }));
        const contentWithImages = await replaceContentImageUrls(cleanedContent);

        // Fetch feature image
        let featureImage = '';
        if (row.imageUrl) {
          const b64 = await fetchImageAsBase64(row.imageUrl);
          featureImage = b64 ?? row.imageUrl; // fall back to original URL
        }

        // Create post as draft
        const postData: Partial<BlogPost> = {
          title: row.title,
          slug: slugify(row.title),
          content: contentWithImages,
          excerpt: row.excerpt,
          featureImage,
          categories: catSlugs,
          tags: tagSlugs,
          status: 'draft',
          publishedAt: row.date ? new Date(row.date).toISOString() : undefined,
        };
        await apiFetch('/api/blog/posts', {
          method: 'POST',
          body: JSON.stringify(postData),
        });
      } catch (e) {
        errors.push(row.title);
        setProgress(p => ({ ...p!, errors: [...(p?.errors ?? []), row.title] }));
        console.error('Import error for', row.title, e);
      }
    }

    setProgress(p => ({ ...p!, done: rows.length, current: '', finished: true }));
    onDone();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) runImport(file);
    e.target.value = '';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-2xl border border-border w-full max-w-md shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Import from CSV</h2>
          {(!progress || progress.finished) && (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X size={16} /></button>
          )}
        </div>

        {!progress ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a WordPress posts CSV export. All posts will be imported as <strong>drafts</strong> — feature images and inline images will be downloaded automatically.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>WordPress block comments are stripped</li>
              <li>Categories and tags are created automatically</li>
              <li>Images are fetched and stored as base64</li>
            </ul>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-sm font-medium"
            >
              <Upload size={16} /> Choose CSV file
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>

            {progress.current && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin shrink-0" />
                <span className="truncate">{progress.current}</span>
              </div>
            )}

            {progress.errors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle size={12} /> {progress.errors.length} failed to import
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
                  {progress.errors.map((t, i) => <li key={i} className="truncate">{t}</li>)}
                </ul>
              </div>
            )}

            {progress.finished && (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle size={16} />
                Import complete — {progress.done - progress.errors.length} posts imported
              </div>
            )}

            {progress.finished && (
              <button
                onClick={onClose}
                className="w-full px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const me = useCurrentStaff();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogTaxonomy[]>([]);
  const [tags, setTags] = useState<BlogTaxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'posts' | 'categories' | 'tags'>('posts');
  const [editing, setEditing] = useState<BlogPost | null | 'new'>(null);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, catsRes, tagsRes] = await Promise.all([
        apiFetch<{ posts: BlogPost[] }>('/api/blog/posts'),
        apiFetch<{ categories: BlogTaxonomy[] }>('/api/blog/categories'),
        apiFetch<{ tags: BlogTaxonomy[] }>('/api/blog/tags'),
      ]);
      setPosts(postsRes.posts);
      setCategories(catsRes.categories);
      setTags(tagsRes.tags);
    } catch {
      toast.error('Failed to load blog data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<BlogPost>) {
    try {
      if (editing === 'new') {
        const res = await apiFetch<{ post: BlogPost }>('/api/blog/posts', {
          method: 'POST',
          body: JSON.stringify({ ...data, author: data.author || me?.name || '' }),
        });
        setPosts(prev => [res.post, ...prev]);
        toast.success('Article created');
      } else if (editing) {
        const res = await apiFetch<{ post: BlogPost }>(`/api/blog/posts/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        setPosts(prev => prev.map(p => p.id === res.post.id ? res.post : p));
        toast.success('Article saved');
      }
      setEditing(null);
    } catch {
      toast.error('Failed to save article');
    }
  }

  async function handleDelete(post: BlogPost) {
    if (!await confirm({ title: 'Delete article?', message: `"${post.title}" will be permanently deleted.`, danger: true })) return;
    try {
      await apiFetch(`/api/blog/posts/${post.id}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p.id !== post.id));
      toast.success('Article deleted');
    } catch {
      toast.error('Failed to delete article');
    }
  }

  async function handleTogglePublish(post: BlogPost) {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const res = await apiFetch<{ post: BlogPost }>(`/api/blog/posts/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus,
          publishedAt: newStatus === 'published' ? new Date().toISOString() : post.publishedAt,
        }),
      });
      setPosts(prev => prev.map(p => p.id === res.post.id ? res.post : p));
      toast.success(newStatus === 'published' ? 'Article published' : 'Article unpublished');
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleAddCategory(name: string) {
    const slug = slugify(name);
    const res = await apiFetch<{ category: BlogTaxonomy }>('/api/blog/categories', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    setCategories(prev => [...prev, res.category].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDeleteCategory(id: string) {
    await apiFetch(`/api/blog/categories/${id}`, { method: 'DELETE' }).catch(() => null);
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  async function handleAddTag(name: string) {
    const slug = slugify(name);
    const res = await apiFetch<{ tag: BlogTaxonomy }>('/api/blog/tags', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    setTags(prev => [...prev, res.tag].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDeleteTag(id: string) {
    await apiFetch(`/api/blog/tags/${id}`, { method: 'DELETE' }).catch(() => null);
    setTags(prev => prev.filter(t => t.id !== id));
  }

  const filtered = posts.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()),
  );

  const editPost = editing === 'new' ? null : editing;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/20 shrink-0">
            <Newspaper size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Blog</h1>
            <p className="text-xs text-muted-foreground">{posts.filter(p => p.status === 'published').length} published · {posts.filter(p => p.status === 'draft').length} drafts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white/50 dark:bg-white/5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Import from CSV"
          >
            <Upload size={15} />Import
          </button>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            <Plus size={16} />New Article
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { key: 'posts', label: 'Articles', icon: Newspaper },
          { key: 'categories', label: 'Categories', icon: FolderOpen },
          { key: 'tags', label: 'Tags', icon: Tag },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {tab === 'posts' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-white/50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {loading
            ? <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
            : filtered.length === 0
              ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Newspaper size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No articles yet</p>
                  <button onClick={() => setEditing('new')} className="mt-2 text-sm text-primary hover:underline">Write your first article</button>
                </div>
              )
              : filtered.map(post => (
                <div key={post.id} className="flex gap-4 p-4 rounded-2xl border border-border bg-white/50 dark:bg-white/3 hover:border-primary/30 transition-colors group">
                  {post.featureImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.featureImage} alt="" className="w-20 h-16 object-cover rounded-xl shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">/blog/{post.slug}</p>
                      </div>
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{post.excerpt || post.content.replace(/<[^>]+>/g, ' ').slice(0, 100)}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {post.categories.length > 0 && (
                        <span className="text-xs text-muted-foreground">{post.categories.join(', ')}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{post.publishedAt ? fmtDate(post.publishedAt) : fmtDate(post.createdAt)}</span>
                      <span className="text-xs text-muted-foreground">{readingTime(post.content)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePublish(post)}
                      title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                      className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {post.status === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      onClick={() => setEditing(post)}
                      className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(post)}
                      className="p-2 rounded-lg hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/20 text-muted-foreground transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {/* Categories tab */}
      {tab === 'categories' && (
        <TaxonomyManager
          type="categories"
          items={categories}
          onAdd={handleAddCategory}
          onDelete={handleDeleteCategory}
        />
      )}

      {/* Tags tab */}
      {tab === 'tags' && (
        <TaxonomyManager
          type="tags"
          items={tags}
          onAdd={handleAddTag}
          onDelete={handleDeleteTag}
        />
      )}

      {/* Import dialog */}
      {importing && (
        <ImportDialog
          existingCategories={categories}
          existingTags={tags}
          onDone={load}
          onClose={() => setImporting(false)}
        />
      )}

      {/* Post dialog */}
      {editing !== null && (
        <PostDialog
          post={editPost}
          categories={categories}
          tags={tags}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onCategoriesChange={setCategories}
          onTagsChange={setTags}
        />
      )}
    </div>
  );
}
