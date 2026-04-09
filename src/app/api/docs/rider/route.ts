import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const spec = getApiDocs('rider');
  return NextResponse.json(spec, { headers: CORS_HEADERS });
}
