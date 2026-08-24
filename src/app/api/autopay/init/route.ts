import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, orderId, userId, description, email, firstName, lastName } = body;

    if (!amount || !orderId || !userId) {
      return NextResponse.json({ error: 'Brak wymaganych danych transakcji' }, { status: 400 });
    }

    const posId = process.env.NEXT_PUBLIC_AUTOPAY_POS_ID || '220522';
    const crcKey = process.env.AUTOPAY_CRC_KEY || ''; 
    const gatewayUrl = 'https://pay.autopay.eu/payment';

    const amountStr = Number(amount).toFixed(2);
    const currency = 'PLN';

    // Algorytm haszowania Autopay
    const hashData = `${posId}${orderId}${amountStr}${crcKey}`;
    const hash = crypto.createHash('sha256').update(hashData).digest('hex');

    const paymentPayload = {
      pos_id: posId,
      session_id: orderId,
      order_id: orderId,
      amount: amountStr,
      currency: currency,
      description: description || 'Doładowanie portfela Forma Marzeń',
      client_email: email || 'klient@formamarzen.pl',
      client_first_name: firstName || 'Klubowicz',
      client_last_name: lastName || 'FormaMarzen',
      url_return: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://forma-marzen.vercel.app'}/portfel?status=success`,
      url_status: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://forma-marzen.vercel.app'}/api/autopay/webhook`,
      crc: crcKey,
      hash: hash,
    };

    return NextResponse.json({
      success: true,
      gatewayUrl: gatewayUrl,
      payload: paymentPayload
    });

  } catch (err: any) {
    console.error('Błąd w endpoint /api/autopay/init:', err);
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}
