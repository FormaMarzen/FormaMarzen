import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, orderId, userId, description, email, type } = body;

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
      console.error('[Autopay Init Error]: Brak kluczy AUTOPAY_SERVICE_ID lub AUTOPAY_HASH_KEY w konfiguracji Vercel.');
      return NextResponse.json(
        { success: false, error: 'Brak klucza AUTOPAY_SERVICE_ID lub AUTOPAY_HASH_KEY w konfiguracji Vercel' },
        { status: 500 }
      );
    }

    // 1. Zapewnienie bezpiecznego formatu OrderID (maksymalnie 32 znaki alfanumeryczne)
    const rawOrderId = String(orderId).replace(/[^a-zA-Z0-9-_]/g, '');
    const safeOrderId = rawOrderId.length > 32 ? rawOrderId.substring(0, 32) : rawOrderId;

    // 2. Formatowanie kwoty (zawsze 2 miejsca po przecinku)
    const formattedAmount = Number(amount).toFixed(2);
    const currency = 'PLN';
    const customerEmail = (email || '').trim().toLowerCase();

    // 3. Bezpieczny opis transakcji bez znaków separatora
    const cleanDescription = (description || `Doladowanie portfela ${formattedAmount} PLN`)
      .replace(/[|;]/g, ' ')
      .trim()
      .substring(0, 100);

    // 4. Zapis transakcji w tabeli autopay_transakcje w Supabase ze statusem pending
    const { error: dbError } = await supabase
      .from('autopay_transakcje')
      .insert([{
        user_id: Number(userId),
        amount: parseFloat(formattedAmount),
        status: 'pending',
        order_id: safeOrderId,
        type: type || 'wallet_topup',
        gateway_response: {
          opis: cleanDescription,
          email: customerEmail,
          created_at: new Date().toISOString()
        }
      }]);

    if (dbError) {
      console.error('[Autopay Init DB Error]: Błąd zapisu do tabeli autopay_transakcje:', dbError);
      return NextResponse.json(
        { success: false, error: `Błąd bazy danych: ${dbError.message}` },
        { status: 500 }
      );
    }

    // 5. Oficjalny kanoniczny łańcuch Hash Autopay dla Paywall:
    // Format: ServiceID|OrderID|Amount|Description|Currency|CustomerEmail|HashKey
    const hashDataArray: string[] = [
      serviceId,
      safeOrderId,
      formattedAmount,
      cleanDescription,
      currency
    ];

    if (customerEmail) {
      hashDataArray.push(customerEmail);
    }

    hashDataArray.push(hashKey);

    const hashString = hashDataArray.join(separator);
    const hash = crypto.createHash('sha256').update(hashString, 'utf8').digest('hex');

    // 6. Pola formularza POST przekazywane do bramki Autopay
    const payload: Record<string, string> = {
      ServiceID: serviceId,
      OrderID: safeOrderId,
      Amount: formattedAmount,
      Description: cleanDescription,
      Currency: currency,
      Hash: hash
    };

    if (customerEmail) {
      payload.CustomerEmail = customerEmail;
    }

    console.log('[Autopay Init Success] Przygotowano transakcję:', {
      safeOrderId,
      formattedAmount,
      hashString,
      hash
    });

    return NextResponse.json({
      success: true,
      gatewayUrl,
      payload
    });

  } catch (error: any) {
    console.error('[Autopay Init Fatal Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Wewnętrzny błąd serwera' },
      { status: 500 }
    );
  }
}
