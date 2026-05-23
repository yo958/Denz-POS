import { type NextRequest, NextResponse } from 'next/server';
import { OPENAI_DOC_PATH } from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export async function GET() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }
  const doc = await getAdminDb().doc(OPENAI_DOC_PATH).get();
  if (!doc.exists || !doc.data()?.apiKey) {
    return NextResponse.json({ hasKey: false, model: DEFAULT_OPENAI_MODEL });
  }
  const data  = doc.data()!;
  const key   = data.apiKey as string;
  const masked = key.length > 8 ? `${key.slice(0, 7)}...${key.slice(-4)}` : '****';
  return NextResponse.json({
    hasKey: true,
    masked,
    model: (data.model as string | undefined) ?? DEFAULT_OPENAI_MODEL,
  });
}

export async function POST(request: NextRequest) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }
  const body = await request.json() as { apiKey?: string; model?: string };

  // Model-only update (key already saved) — merge so we don't lose the key
  if (!body.apiKey && body.model) {
    await getAdminDb().doc(OPENAI_DOC_PATH).set(
      { model: body.model, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  }

  const apiKey = (body.apiKey ?? '').trim();
  if (!apiKey.startsWith('sk-')) {
    return NextResponse.json({ error: 'invalid_key', message: 'Key must start with sk-' }, { status: 400 });
  }

  // Use merge so we don't wipe an existing model choice
  await getAdminDb().doc(OPENAI_DOC_PATH).set(
    {
      apiKey,
      ...(body.model ? { model: body.model } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await getAdminDb().doc(OPENAI_DOC_PATH).delete();
  return NextResponse.json({ ok: true });
}
