import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, orderId, userId, description, email, firstName, lastName, type } = body;

    if (!amount || !orderId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Brak wymaganych danych transakcji (amount, orderId, userId)' },
        { status: 400 }
      );
    }

    const serviceId = (process.env.AUTOPAY_SERVICE_ID || '220522').trim();
    const hashKey = (process.env.AUTOPAY_HASH_KEY || '').trim();
    const separator = (process.env.AUTOPAY_HASH_SEPARATOR || '|').trim();
    const gatewayUrl = (process.env.AUTOPAY_URL || 'https://pay.autopay.eu/payment').trim();

    if (!serviceId || !hashKey) {
      return NextResponse.json(
        { success: false, error: 'Brak klucza AUTOPAY_SERVICE_ID lub AUTOPAY_HASH_KEY w konfiguracji Vercel' },
        { status: 500 }
      );
    }

    const formattedAmount = Number(amount).toFixed(2);
    const currency = 'PLN';
    const gatewayId = '0';
    const customerEmail = (email || '').trim();
    const customerName = `${firstName || ''} ${lastName || ''}`.trim() || 'Klubowicz';
    const cleanDescription = (description || `Doladowanie portfela ${formattedAmount} PLN`).replace(/[|;]/g, ' ').trim();

    // 1. Zapis transakcji w tabeli autopay_transakcje ze statusem pending
    const { error: dbError } = await supabase
      .from('autopay_transakcje')
      .insert([{
        user_id: userId,
        amount: parseFloat(formattedAmount),
        status: 'pending',
        order_id: orderId,
        type: type || 'wallet_topup',
        gateway_response: {
          opis: cleanDescription,
          email: customerEmail,
          created_at: new Date().toISOString()
        }
      }]);

    if (dbError) {
      console.error('Błąd zapisu w Supabase:', dbError);
      return NextResponse.json(
        { success: false, error: `Błąd bazy danych: ${dbError.message}` },
        { status: 500 }
      );
    }

    // 2. Wyliczenie sumy kontrolnej Hash SHA-256 z separatorem pipe (|)
    const hashDataArray = [
      serviceId,
      orderId,
      formattedAmount,
      cleanDescription,
      gatewayId,
      currency,
      customerEmail,
      customerName,
      hashKey
    ];

    const hashString = hashDataArray.join(separator);
    const hash = crypto.createHash('sha256').update(hashString, 'utf8').digest('hex');

    // 3. Przygotowanie parametrów formularza POST dla bramki Autopay
    const payload: Record<string, string> = {
      ServiceID: serviceId,
      OrderID: orderId,
      Amount: formattedAmount,
      Description: cleanDescription,
      GatewayID: gatewayId,
      Currency: currency,
      CustomerEmail: customerEmail,
      CustomerName: customerName,
      Hash: hash
    };

    return NextResponse.json({
      success: true,
      gatewayUrl,
      payload
    });

  } catch (error: any) {
    console.error('Błąd inicjalizacji Autopay:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Wewnętrzny błąd serwera' },
      { status: 500 }
    );
  }
}
