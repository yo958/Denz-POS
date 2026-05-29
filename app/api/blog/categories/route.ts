import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { BlogTaxonomy } from '@/lib/types';

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('blog-categories').orderBy('name').get();
    const categories = snap.docs.map(d => ({ id: d.id, ...d.data() })) as BlogTaxonomy[];
    return NextResponse.json({ categories });
  } catch (e) {
    console.error('blog/categories GET', e);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name: string; slug: string; description?: string };
    const db = getAdminDb();
    const ref = db.collection('blog-categories').doc();
    const cat: BlogTaxonomy = {
      id: ref.id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      createdAt: new Date().toISOString(),
    };
    await ref.set(cat);
    return NextResponse.json({ category: cat }, { status: 201 });
  } catch (e) {
    console.error('blog/categories POST', e);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
