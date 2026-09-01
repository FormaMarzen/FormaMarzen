import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      amount, 
      orderId, 
      userId, 
      description, 
      email, 
      type, 
      metadata, 
      wydarzenie_id, 
      edycja_id,
      kampania_id,
      zamowienie_id,
      rozmiar,
      wariant
    } = body;

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

    // 1. Bezpieczny identyfikator OrderID (maksymalnie 32 znaki)
    const rawOrderId = String(orderId).replace(/[^a-zA-Z0-9-]/g, '');
    const safeOrderId = rawOrderId.length > 32 ? rawOrderId.substring(0, 32) : rawOrderId;

    // 2. Format kwoty i podstawowe parametry
    const formattedAmount = Number(amount).toFixed(2);
    const currency = 'PLN';
    const gatewayId = '0';
    const customerEmail = (email || '').trim().toLowerCase();

    // 3. Czyszczenie opisu ze znaków specjalnych
    const cleanDescription = (description || `Platnosc Forma Marzen ${formattedAmount} PLN`)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ._-]/g, '')
      .trim()
      .substring(0, 100);

    // 4. Budowa połączonych metadanych transakcji
    const combinedMetadata = {
      ...(metadata || {}),
      ...(wydarzenie_id ? { wydarzenie_id: Number(wydarzenie_id) } : {}),
      ...(edycja_id ? { edycja_id: Number(edycja_id) } : {}),
      ...(kampania_id ? { kampania_id: String(kampania_id) } : {}),
      ...(zamowienie_id ? { zamowienie_id: String(zamowienie_id) } : {}),
      ...(rozmiar ? { rozmiar: String(rozmiar) } : {}),
      ...(wariant ? { wariant: String(wariant) } : {})
    };

    // 5. Zapis transakcji w tabeli autopay_transakcje
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
          wydarzenie_id: wydarzenie_id ? Number(wydarzenie_id) : null,
          edycja_id: edycja_id ? Number(edycja_id) : null,
          kampania_id: kampania_id || null,
          zamowienie_id: zamowienie_id || null,
          metadata: combinedMetadata,
          created_at: new Date().toISOString()
        }
      }]);

    if (dbError) {
      console.error('[Autopay Init DB Error]:', dbError);
      return NextResponse.json(
        { success: false, error: `Błąd bazy danych: ${dbError.message}` },
        { status: 500 }
      );
    }

    // 6. Wyliczenie sumy kontrolnej Hash SHA-256
    const hashDataArray: string[] = [
      serviceId,
      safeOrderId,
      formattedAmount,
      cleanDescription,
      gatewayId,
      currency
    ];

    if (customerEmail) {
      hashDataArray.push(customerEmail);
    }

    hashDataArray.push(hashKey);

    const hashString = hashDataArray.join(separator);
    const hash = crypto.createHash('sha256').update(hashString, 'utf8').digest('hex');

    // 7. Pola formularza bramki Autopay
    const payload: Record<string, string> = {
      ServiceID: serviceId,
      OrderID: safeOrderId,
      Amount: formattedAmount,
      Description: cleanDescription,
      GatewayID: gatewayId,
      Currency: currency,
      Hash: hash
    };

    if (customerEmail) {
      payload.CustomerEmail = customerEmail;
    }

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
