import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { BlogPost } from '@/lib/types';

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('blog-posts').orderBy('createdAt', 'desc').get();
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() })) as BlogPost[];
    return NextResponse.json({ posts });
  } catch (e) {
    console.error('blog/posts GET', e);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<BlogPost, 'id'>;
    const db = getAdminDb();
    const ref = db.collection('blog-posts').doc();
    const now = new Date().toISOString();
    const post: BlogPost = {
      ...body,
      id: ref.id,
      createdAt: now,
      updatedAt: now,
      categories: body.categories ?? [],
      tags: body.tags ?? [],
    };
    await ref.set(post);
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    console.error('blog/posts POST', e);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
