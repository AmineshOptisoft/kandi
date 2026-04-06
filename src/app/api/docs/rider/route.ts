import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger';

export async function GET() {
  const spec = getApiDocs('rider');
  return NextResponse.json(spec);
}
