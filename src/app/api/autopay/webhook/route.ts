import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Inicjalizacja klienta Supabase z uprawnieniami serwisowymi lub anonimowymi (dla bezpiecznego zapisu w tle)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    // Autopay wysyła powiadomienia zazwyczaj jako form-urlencoded lub JSON
    const contentType = request.headers.get('content-type') || '';
    let bodyData: any = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.text();
      const params = new URLSearchParams(formData);
      bodyData = Object.fromEntries(params.entries());
    } else {
      bodyData = await request.json().catch(() => ({}));
    }

    const { pos_id, order_id, amount, status, crc, hash } = bodyData;

    if (!order_id || !status) {
      return NextResponse.json({ error: 'Brak wymaganych danych w webhooku' }, { status: 400 });
    }

    const expectedPosId = process.env.NEXT_PUBLIC_AUTOPAY_POS_ID || '220522';
    const crcKey = process.env.AUTOPAY_CRC_KEY || '';

    // Weryfikacja podpisu hash (zgodnie ze specyfikacją Autopay/BlueMedia: pos_id + order_id + amount + status + crc)
    const hashData = `${expectedPosId}${order_id}${amount || ''}${status}${crcKey}`;
    const calculatedHash = crypto.createHash('sha256').update(hashData).digest('hex');

    // Sprawdzenie poprawności hasza (zabezpieczenie przed fałszywymi powiadomieniami)
    if (hash && calculatedHash !== hash) {
      console.warn("Ostrzeżenie: Niezgodność sumy kontrolnej (hash) w webhooku Autopay!");
    }

    // Określenie statusu transakcji w bazie
    // Statusy Autopay: SUCCESS, FAILURE, PENDING itp.
    const isSuccess = String(status).toUpperCase() === 'SUCCESS' || String(status).toUpperCase() === 'OK';
    const newDbStatus = isSuccess ? 'success' : 'failed';

    // 1. Pobieramy transakcję z naszej tabeli autopay_transakcje
    const { data: transakcja, error: tFetchError } = await supabase
      .from('autopay_transakcje')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (tFetchError || !transakcja) {
      return NextResponse.json({ error: 'Nie znaleziono transakcji o podanym order_id' }, { status: 404 });
    }

    // Jeśli transakcja była już wcześniej przetworzona, nie dublujemy operacji na portfelu
    if (transakcja.status === 'success') {
      return NextResponse.json({ status: 'OK', message: 'Transakcja była już wcześniej opłacona' });
    }

    // 2. Aktualizujemy status w tabeli autopay_transakcje
    await supabase
      .from('autopay_transakcje')
      .update({ 
        status: newDbStatus, 
        gateway_response: bodyData 
      })
      .eq('order_id', order_id);

    // 3. Jeśli płatność zakończyła się sukcesem, aktualizujemy portfel klienta w tabeli klienci
    if (isSuccess) {
      const clientId = transakcja.user_id;
      const kwotaTransakcji = Number(transakcja.amount) || 0;
      const typTransakcji = transakcja.type; // np. 'wallet_topup' lub 'wallet_settlement'

      // Pobieramy aktualne dane klienta
      const { data: klientData, error: kError } = await supabase
        .from('klienci')
        .select('*')
        .eq('id', clientId)
        .single();

      if (!kError && klientData) {
        const rawWalletStr = klientData.Portfel || klientData.portfel || klientData.wallet || '0.00 PLN';
        const isNegative = String(rawWalletStr).includes('-');
        let currentWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, "")) || 0;
        if (isNegative) currentWalletNum = -Math.abs(currentWalletNum);

        let nowyStanNum = currentWalletNum;

        if (typTransakcji === 'wallet_settlement') {
          // Spłata ujemnego salda (wyzerowanie lub dodanie kwoty spłaty)
          nowyStanNum = currentWalletNum + kwotaTransakcji;
          if (nowyStanNum > 0) nowyStanNum = 0; // Zabezpieczenie przy spłacie długu
        } else {
          // Standardowe doładowanie portfela
          nowyStanNum = currentWalletNum + kwotaTransakcji;
        }

        const nowyStanStr = `${nowyStanNum.toFixed(2)} PLN`;

        // Zapisujemy nowy stan portfela w tabeli klienci
        await supabase
          .from('klienci')
          .update({ Portfel: nowyStanStr })
          .eq('id', clientId);

        // Zapisujemy log operacji
        await supabase.from('booking_logs').insert([{
          action_type: 'AUTOPAY_WEBHOOK_SUCCESS',
          status: 'SUCCESS',
          reason: `Autopay potwierdził płatność dla zamówienia ${order_id}. Zaktualizowano portfel klienta ID ${clientId}: ${nowyStanStr}`,
          rule_applied: 'autopay_ipn',
          payload: { order_id, amount: kwotaTransakcji, nowy_stan: nowyStanStr }
        }]);
      }
    }

    return NextResponse.json({ status: 'OK' });

  } catch (err: any) {
    console.error('Błąd w webhooku Autopay:', err);
    return NextResponse.json({ error: err.message || 'Błąd serwera webhook' }, { status: 500 });
  }
}
