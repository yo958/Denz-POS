'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, Plus, Trash2, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import { toast } from '@/components/ui/toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FaqItem { q: string; a: string }

interface HomeContent {
  hero?: {
    headline?: string;
    subtext?: string;
    cta1?: string;
    cta2?: string;
    locationPill?: string;
    pills?: string[];
  };
  about?: {
    title?: string;
    body1?: string;
    body2?: string;
  };
  faq?: {
    items?: FaqItem[];
  };
}

interface SimplePageContent {
  hero?: {
    badge?: string;
    title?: string;
    subtitle?: string;
  };
}

interface RoomsContent extends SimplePageContent {
  features?: string[];
}

interface GuideContent {
  hero?: {
    badge?: string;
    title?: string;
    body?: string;
  };
}

interface ContactContent {
  hero?: {
    title?: string;
    subtitle?: string;
  };
}

type PageSlug = 'home' | 'menu' | 'coworking' | 'rooms' | 'guide' | 'contact';

const TABS: { slug: PageSlug; label: string }[] = [
  { slug: 'home',       label: 'Home'       },
  { slug: 'menu',       label: 'Menu'       },
  { slug: 'coworking',  label: 'Coworking'  },
  { slug: 'rooms',      label: 'Rooms'      },
  { slug: 'guide',      label: 'Guide'      },
  { slug: 'contact',    label: 'Contact'    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 items-start py-3 border-b border-border last:border-0">
      <label className="text-sm font-medium text-foreground pt-2">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
    />
  );
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border p-5 mb-4">
      <SectionHeader title={title} note={note} />
      {children}
    </div>
  );
}

// ── Tab editors ───────────────────────────────────────────────────────────────

function HomeEditor({ content, onChange }: { content: HomeContent; onChange: (c: HomeContent) => void }) {
  const hero  = content.hero  ?? {};
  const about = content.about ?? {};
  const faqs  = content.faq?.items ?? [];

  function setHero(patch: Partial<typeof hero>) {
    onChange({ ...content, hero: { ...hero, ...patch } });
  }
  function setAbout(patch: Partial<typeof about>) {
    onChange({ ...content, about: { ...about, ...patch } });
  }
  function setPills(pills: string[]) {
    onChange({ ...content, hero: { ...hero, pills } });
  }
  function setFaqs(items: FaqItem[]) {
    onChange({ ...content, faq: { items } });
  }

  const pills = hero.pills ?? ['1 Gbps WiFi', 'Specialty Coffee', 'Mountain Views'];

  return (
    <div>
      <Section title="Hero section">
        <FieldRow label="Headline">
          <Input value={hero.headline ?? ''} onChange={v => setHero({ headline: v })} placeholder="Work, Eat & Explore." />
        </FieldRow>
        <FieldRow label="Subtitle">
          <Textarea value={hero.subtext ?? ''} onChange={v => setHero({ subtext: v })} placeholder="Phuket's favourite coworking café…" rows={2} />
        </FieldRow>
        <FieldRow label="Location pill">
          <Input value={hero.locationPill ?? ''} onChange={v => setHero({ locationPill: v })} placeholder="Kathu · Pa Tong · Phuket" />
        </FieldRow>
        <FieldRow label="CTA 1 label">
          <Input value={hero.cta1 ?? ''} onChange={v => setHero({ cta1: v })} placeholder="Coworking Prices" />
        </FieldRow>
        <FieldRow label="CTA 2 label">
          <Input value={hero.cta2 ?? ''} onChange={v => setHero({ cta2: v })} placeholder="View Menu" />
        </FieldRow>
        <FieldRow label="Feature pills">
          <div className="space-y-2">
            {pills.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={p}
                  onChange={e => { const next = [...pills]; next[i] = e.target.value; setPills(next); }}
                  className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => setPills(pills.filter((_, j) => j !== i))}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-rose-500 hover:border-rose-300 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setPills([...pills, ''])}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={12} /> Add pill
            </button>
          </div>
        </FieldRow>
      </Section>

      <Section title="About section">
        <FieldRow label="Section title">
          <Input value={about.title ?? ''} onChange={v => setAbout({ title: v })} placeholder="A workspace that feels like home" />
        </FieldRow>
        <FieldRow label="Body paragraph 1">
          <Textarea value={about.body1 ?? ''} onChange={v => setAbout({ body1: v })} placeholder="Nestled between the mountains…" rows={3} />
        </FieldRow>
        <FieldRow label="Body paragraph 2">
          <Textarea value={about.body2 ?? ''} onChange={v => setAbout({ body2: v })} placeholder="We built Denz because…" rows={3} />
        </FieldRow>
      </Section>

      <Section title="FAQ section" note="Questions shown on the home page">
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FaqItemEditor
              key={i}
              faq={faq}
              index={i}
              onUpdate={(updated) => { const next = [...faqs]; next[i] = updated; setFaqs(next); }}
              onRemove={() => setFaqs(faqs.filter((_, j) => j !== i))}
            />
          ))}
          <button
            onClick={() => setFaqs([...faqs, { q: '', a: '' }])}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-2"
          >
            <Plus size={12} /> Add FAQ
          </button>
        </div>
      </Section>
    </div>
  );
}

function FaqItemEditor({ faq, index, onUpdate, onRemove }: { faq: FaqItem; index: number; onUpdate: (f: FaqItem) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground w-5">#{index + 1}</span>
        <input
          type="text"
          value={faq.q}
          onChange={e => onUpdate({ ...faq, q: e.target.value })}
          placeholder="Question…"
          className="flex-1 text-sm bg-transparent focus:outline-none"
        />
        <button onClick={() => setExpanded(!expanded)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-rose-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-3 border-t border-border">
          <Textarea value={faq.a} onChange={v => onUpdate({ ...faq, a: v })} placeholder="Answer…" rows={3} />
        </div>
      )}
    </div>
  );
}

function SimplePageEditor({
  content,
  onChange,
  defaults,
}: {
  content: SimplePageContent;
  onChange: (c: SimplePageContent) => void;
  defaults: { badge?: string; title?: string; subtitle?: string };
}) {
  const hero = content.hero ?? {};
  function setHero(patch: Partial<typeof hero>) {
    onChange({ ...content, hero: { ...hero, ...patch } });
  }
  return (
    <Section title="Hero section">
      <FieldRow label="Badge label">
        <Input value={hero.badge ?? ''} onChange={v => setHero({ badge: v })} placeholder={defaults.badge ?? ''} />
      </FieldRow>
      <FieldRow label="Page title">
        <Input value={hero.title ?? ''} onChange={v => setHero({ title: v })} placeholder={defaults.title ?? ''} />
      </FieldRow>
      <FieldRow label="Subtitle">
        <Textarea value={hero.subtitle ?? ''} onChange={v => setHero({ subtitle: v })} placeholder={defaults.subtitle ?? ''} rows={2} />
      </FieldRow>
    </Section>
  );
}

function RoomsEditor({ content, onChange }: { content: RoomsContent; onChange: (c: RoomsContent) => void }) {
  const features = content.features ?? ['1000/1000 Mbps WiFi + backup line', 'Hot desk at Denz Café included', 'Air conditioning', 'Standing desk, ergonomic chair, 50" TV'];
  return (
    <div>
      <SimplePageEditor
        content={content}
        onChange={patch => onChange({ ...content, ...(patch as RoomsContent) })}
        defaults={{ badge: 'Rooms', title: 'Stay, Work & Relax', subtitle: 'Hotel rooms designed for remote workers…' }}
      />
      <Section title="Room features list" note="Icons are fixed; only the labels are editable">
        <div className="space-y-2">
          {features.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={f}
                onChange={e => { const next = [...features]; next[i] = e.target.value; onChange({ ...content, features: next }); }}
                className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => onChange({ ...content, features: features.filter((_, j) => j !== i) })}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-rose-500 hover:border-rose-300 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ ...content, features: [...features, ''] })}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={12} /> Add feature
          </button>
        </div>
      </Section>
    </div>
  );
}

function GuideEditor({ content, onChange }: { content: GuideContent; onChange: (c: GuideContent) => void }) {
  const hero = content.hero ?? {};
  function setHero(patch: Partial<typeof hero>) {
    onChange({ ...content, hero: { ...hero, ...patch } });
  }
  return (
    <Section title="Hero section">
      <FieldRow label="Badge label">
        <Input value={hero.badge ?? ''} onChange={v => setHero({ badge: v })} placeholder="Denz Phuket Guide" />
      </FieldRow>
      <FieldRow label="Page title">
        <Input value={hero.title ?? ''} onChange={v => setHero({ title: v })} placeholder="Your local guide to life in Phuket" />
      </FieldRow>
      <FieldRow label="Body text">
        <Textarea value={hero.body ?? ''} onChange={v => setHero({ body: v })} placeholder="From the best spots to eat and work…" rows={3} />
      </FieldRow>
    </Section>
  );
}

function ContactEditor({ content, onChange }: { content: ContactContent; onChange: (c: ContactContent) => void }) {
  const hero = content.hero ?? {};
  function setHero(patch: Partial<typeof hero>) {
    onChange({ ...content, hero: { ...hero, ...patch } });
  }
  return (
    <Section title="Hero section" note="Opening hours, address and social links are managed in Settings → Venue">
      <FieldRow label="Page title">
        <Input value={hero.title ?? ''} onChange={v => setHero({ title: v })} placeholder="Get in touch" />
      </FieldRow>
      <FieldRow label="Subtitle">
        <Textarea value={hero.subtitle ?? ''} onChange={v => setHero({ subtitle: v })} placeholder="Have a question? Slide into our DMs…" rows={2} />
      </FieldRow>
    </Section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PagesPage() {
  const me = useCurrentStaff();
  const [activeTab, setActiveTab] = useState<PageSlug>('home');
  const [contents, setContents] = useState<Record<PageSlug, Record<string, unknown>>>({
    home: {}, menu: {}, coworking: {}, rooms: {}, guide: {}, contact: {},
  });
  const [loadingTab, setLoadingTab] = useState<PageSlug | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState<Set<PageSlug>>(new Set());

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  const loadTab = useCallback(async (slug: PageSlug) => {
    if (loaded.has(slug)) return;
    setLoadingTab(slug);
    try {
      const res = await fetch(`/api/pages/${slug}`);
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        setContents(prev => ({ ...prev, [slug]: data }));
        setLoaded(prev => new Set([...prev, slug]));
      }
    } catch {
      // silently fail — defaults show
    } finally {
      setLoadingTab(null);
    }
  }, [loaded]);

  useEffect(() => { void loadTab(activeTab); }, [activeTab, loadTab]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contents[activeTab]),
      });
      if (!res.ok) throw new Error('save failed');
      toast.success('Page content saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function setContent(slug: PageSlug, data: Record<string, unknown>) {
    setContents(prev => ({ ...prev, [slug]: data }));
  }

  const isLoading = loadingTab === activeTab;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-primary" strokeWidth={1.8} />
          <h1 className="text-base font-semibold">Page Content</h1>
        </div>
        <button
          onClick={save}
          disabled={saving || isLoading}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 border-b border-border shrink-0 overflow-x-auto">
        {TABS.map(({ slug, label }) => (
          <button
            key={slug}
            onClick={() => setActiveTab(slug)}
            className={`px-4 py-2 rounded-t-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === slug
                ? 'bg-background border border-b-background border-border text-foreground -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeEditor
                content={contents.home as HomeContent}
                onChange={d => setContent('home', d as Record<string, unknown>)}
              />
            )}
            {activeTab === 'menu' && (
              <SimplePageEditor
                content={contents.menu as SimplePageContent}
                onChange={d => setContent('menu', d as Record<string, unknown>)}
                defaults={{ badge: 'Menu', title: 'Food, Drinks & More', subtitle: 'Fresh Thai & Western food, specialty coffee…' }}
              />
            )}
            {activeTab === 'coworking' && (
              <SimplePageEditor
                content={contents.coworking as SimplePageContent}
                onChange={d => setContent('coworking', d as Record<string, unknown>)}
                defaults={{ badge: 'CoWorking', title: 'Work from paradise', subtitle: 'Desks, offices, and the best mountain views…' }}
              />
            )}
            {activeTab === 'rooms' && (
              <RoomsEditor
                content={contents.rooms as RoomsContent}
                onChange={d => setContent('rooms', d as Record<string, unknown>)}
              />
            )}
            {activeTab === 'guide' && (
              <GuideEditor
                content={contents.guide as GuideContent}
                onChange={d => setContent('guide', d as Record<string, unknown>)}
              />
            )}
            {activeTab === 'contact' && (
              <ContactEditor
                content={contents.contact as ContactContent}
                onChange={d => setContent('contact', d as Record<string, unknown>)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
