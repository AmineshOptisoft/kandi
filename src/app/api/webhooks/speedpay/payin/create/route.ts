import { NextResponse } from 'next/server';
import type { SpeedpayInitPayinInput, SpeedpayInitPayinResponse } from '@/lib/integrations/speedpay/client';

export async function POST(req: Request) {
  try {
    const input: SpeedpayInitPayinInput = await req.json();
    // Simple mock: generate a fake transaction number and redirect URL
    const fakeResponse: SpeedpayInitPayinResponse = {
      success: true,
      data: {
        id: Math.floor(Math.random() * 1000000),
        reference_number: null,
        transaction_number: 'TX' + Date.now(),
        upi: 'test@upi',
        redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/pay/${Math.random().toString(36).substring(2, 12)}`,
        amount: input.amount,
        status: 'INITIATE',
      },
    };
    return NextResponse.json(fakeResponse, { status: 200 });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 400 });
  }
}
