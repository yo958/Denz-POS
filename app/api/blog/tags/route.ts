import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { BlogTaxonomy } from '@/lib/types';

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('blog-tags').orderBy('name').get();
    const tags = snap.docs.map(d => ({ id: d.id, ...d.data() })) as BlogTaxonomy[];
    return NextResponse.json({ tags });
  } catch (e) {
    console.error('blog/tags GET', e);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name: string; slug: string; description?: string };
    const db = getAdminDb();
    const ref = db.collection('blog-tags').doc();
    const tag: BlogTaxonomy = {
      id: ref.id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      createdAt: new Date().toISOString(),
    };
    await ref.set(tag);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (e) {
    console.error('blog/tags POST', e);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}
