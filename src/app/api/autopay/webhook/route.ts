import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const serviceId = process.env.AUTOPAY_SERVICE_ID || '';
    const hashKey = process.env.AUTOPAY_HASH_KEY || '';
    const separator = process.env.AUTOPAY_HASH_SEPARATOR || ';';

    const rawText = await req.text();
    let orderID = '';
    let paymentStatus = '';
    let amount = '';
    let receivedHash = '';

    if (rawText.startsWith('{')) {
      const jsonData = JSON.parse(rawText);
      orderID = jsonData.OrderID || jsonData.orderID || jsonData.order_id || '';
      paymentStatus = jsonData.PaymentStatus || jsonData.paymentStatus || jsonData.status || '';
      amount = jsonData.Amount || jsonData.amount || '';
      receivedHash = jsonData.Hash || jsonData.hash || '';
    } else {
      const params = new URLSearchParams(rawText);
      orderID = params.get('OrderID') || params.get('orderID') || '';
      paymentStatus = params.get('PaymentStatus') || params.get('paymentStatus') || '';
      amount = params.get('Amount') || params.get('amount') || '';
      receivedHash = params.get('Hash') || params.get('hash') || '';
    }

    if (!orderID) {
      return new NextResponse('Brak OrderID', { status: 400 });
    }

    // Weryfikacja sumy kontrolnej HASH
    if (receivedHash && hashKey) {
      const calculatedHash = crypto
        .createHash('sha256')
        .update(`${serviceId}${separator}${orderID}${separator}${paymentStatus}${separator}${hashKey}`, 'utf8')
        .digest('hex');

      if (receivedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
        console.warn(`[Autopay Webhook] Ostrzeżenie: Niezgodny hash dla OrderID: ${orderID}`);
      }
    }

    // 1. Pobranie rekordu transakcji
    const { data: transakcja, error: fetchErr } = await supabase
      .from('autopay_transakcje')
      .select('*')
      .eq('order_id', orderID)
      .single();

    if (fetchErr || !transakcja) {
      console.error(`[Autopay Webhook] Nie znaleziono transakcji ${orderID}:`, fetchErr);
      return new NextResponse('Transakcja nie istnieje', { status: 404 });
    }

    // Zabezpieczenie przed wielokrotnym księgowaniem tej samej transakcji
    if (transakcja.status === 'success') {
      return new NextResponse('OK - Transakcja została już przetworzona', { status: 200 });
    }

    const isSuccess = paymentStatus.toUpperCase() === 'SUCCESS' || paymentStatus.toUpperCase() === 'SUCCESSFUL';
    const isFailure = paymentStatus.toUpperCase() === 'FAILURE' || paymentStatus.toUpperCase() === 'FAILED';

    if (isSuccess) {
      const transactionAmount = Number(transakcja.amount) || Number(amount) || 0;

      // Aktualizacja statusu transakcji w autopay_transakcje
      await supabase
        .from('autopay_transakcje')
        .update({
          status: 'success',
          gateway_response: {
            ...transakcja.gateway_response,
            webhook_received_at: new Date().toISOString(),
            raw_status: paymentStatus
          }
        })
        .eq('order_id', orderID);

      // Pobranie danych klienta i aktualizacja salda
      const { data: klient, error: klientErr } = await supabase
        .from('klienci')
        .select('*')
        .eq('id', transakcja.user_id)
        .single();

      if (!klientErr && klient) {
        const rawWalletStr = klient.Portfel || klient.portfel || '0.00 PLN';
        const isNegative = String(rawWalletStr).includes('-');
        let currentWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, '')) || 0;
        if (isNegative) currentWalletNum = -Math.abs(currentWalletNum);

        const newWalletNum = currentWalletNum + transactionAmount;
        const formattedNewWallet = `${newWalletNum.toFixed(2)} PLN`;

        const currentHistory = Array.isArray(klient.walletHistory) ? klient.walletHistory : [];
        const historyEntry = {
          id: Date.now(),
          order_id: orderID,
          typ: transakcja.type === 'wallet_settlement' ? 'Spłata zadłużenia (Autopay)' : 'Doładowanie (Autopay)',
          kwota: `+${transactionAmount.toFixed(2)} PLN`,
          saldoPo: formattedNewWallet,
          data: new Date().toISOString()
        };

        await supabase
          .from('klienci')
          .update({
            Portfel: formattedNewWallet,
            walletHistory: [historyEntry, ...currentHistory]
          })
          .eq('id', klient.id);
      }

    } else if (isFailure) {
      await supabase
        .from('autopay_transakcje')
        .update({
          status: 'failed',
          gateway_response: {
            ...transakcja.gateway_response,
            webhook_received_at: new Date().toISOString(),
            raw_status: paymentStatus
          }
        })
        .eq('order_id', orderID);
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error: any) {
    console.error('[Autopay Webhook Error]:', error);
    return new NextResponse(`Błąd serwera: ${error.message}`, { status: 500 });
  }
}
