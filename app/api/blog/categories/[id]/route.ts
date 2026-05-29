import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await getAdminDb().collection('blog-categories').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('blog/categories/[id] DELETE', e);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
