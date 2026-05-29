import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { BlogPost } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('blog-posts').doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ post: { id: doc.id, ...doc.data() } });
  } catch (e) {
    console.error('blog/posts/[id] GET', e);
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as Partial<BlogPost>;
    const db = getAdminDb();
    const ref = db.collection('blog-posts').doc(id);
    const updates = { ...body, updatedAt: new Date().toISOString() };
    await ref.update(updates);
    const doc = await ref.get();
    return NextResponse.json({ post: { id: doc.id, ...doc.data() } });
  } catch (e) {
    console.error('blog/posts/[id] PUT', e);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getAdminDb();
    await db.collection('blog-posts').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('blog/posts/[id] DELETE', e);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
