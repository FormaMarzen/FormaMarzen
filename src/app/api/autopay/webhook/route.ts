import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    console.log('[Autopay Webhook Received]:', rawBody);

    let orderID = '';
    let paymentStatus = '';
    let amount = '';

    // 1. Wyciągnięcie danych z formatu XML (Base64 lub czysty XML) lub JSON/Form
    if (rawBody.includes('transactions=') || rawBody.includes('<transactions>') || rawBody.startsWith('<?xml')) {
      let xmlContent = rawBody;

      if (rawBody.includes('transactions=')) {
        const params = new URLSearchParams(rawBody);
        const base64Transactions = params.get('transactions') || '';
        if (base64Transactions) {
          xmlContent = Buffer.from(base64Transactions, 'base64').toString('utf8');
        }
      }

      orderID = extractXmlTag(xmlContent, 'orderID');
      paymentStatus = extractXmlTag(xmlContent, 'paymentStatus');
      amount = extractXmlTag(xmlContent, 'amount');
    } else if (rawBody.startsWith('{')) {
      const jsonData = JSON.parse(rawBody);
      orderID = jsonData.OrderID || jsonData.orderID || jsonData.order_id || '';
      paymentStatus = jsonData.PaymentStatus || jsonData.paymentStatus || jsonData.status || '';
      amount = jsonData.Amount || jsonData.amount || '';
    } else {
      const params = new URLSearchParams(rawBody);
      orderID = params.get('OrderID') || params.get('orderID') || '';
      paymentStatus = params.get('PaymentStatus') || params.get('paymentStatus') || '';
      amount = params.get('Amount') || params.get('amount') || '';
    }

    if (!orderID) {
      console.error('[Autopay Webhook] Brak OrderID w powiadomieniu');
      return new NextResponse('Brak OrderID', { status: 400 });
    }

    // 2. Pobranie rekordu transakcji z bazy
    const { data: transakcja, error: fetchErr } = await supabase
      .from('autopay_transakcje')
      .select('*')
      .eq('order_id', orderID)
      .single();

    if (fetchErr || !transakcja) {
      console.error(`[Autopay Webhook] Transakcja nie znaleziona: ${orderID}`, fetchErr);
      const xmlNotFound = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
      return new NextResponse(xmlNotFound, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }

    const isSuccess = paymentStatus.toUpperCase() === 'SUCCESS' || paymentStatus.toUpperCase() === 'SUCCESSFUL';
    const isFailure = paymentStatus.toUpperCase() === 'FAILURE' || paymentStatus.toUpperCase() === 'FAILED';

    if (isSuccess) {
      const transactionAmount = Number(transakcja.amount) || Number(amount) || 0;

      // 3. Pobranie klienta i zaktualizowanie salda Portfela
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

        // Zapobiegamy wielokrotnemu dodaniu tej samej kwoty
        if (transakcja.status !== 'success') {
          const newWalletNum = currentWalletNum + transactionAmount;
          const formattedNewWallet = `${newWalletNum.toFixed(2)} PLN`;

          const updatePayload: Record<string, any> = {
            Portfel: formattedNewWallet
          };

          if ('walletHistory' in klient && Array.isArray(klient.walletHistory)) {
            updatePayload.walletHistory = [
              {
                id: Date.now(),
                order_id: orderID,
                typ: transakcja.type === 'wallet_settlement' ? 'Spłata zadłużenia (Autopay)' : 'Doładowanie (Autopay)',
                kwota: `+${transactionAmount.toFixed(2)} PLN`,
                saldoPo: formattedNewWallet,
                data: new Date().toISOString()
              },
              ...klient.walletHistory
            ];
          }

          const { error: updateErr } = await supabase
            .from('klienci')
            .update(updatePayload)
            .eq('id', klient.id);

          if (updateErr) {
            console.error('[Autopay Webhook] Błąd aktualizacji portfela klienta, próba fallback:', updateErr);
            await supabase
              .from('klienci')
              .update({ Portfel: formattedNewWallet })
              .eq('id', klient.id);
          }
        }
      }

      // 4. Aktualizacja rekordu na success
      await supabase
        .from('autopay_transakcje')
        .update({
          status: 'success',
          gateway_response: {
            ...(typeof transakcja.gateway_response === 'object' ? transakcja.gateway_response : {}),
            webhook_processed_at: new Date().toISOString(),
            raw_status: paymentStatus
          }
        })
        .eq('order_id', orderID);

    } else if (isFailure) {
      await supabase
        .from('autopay_transakcje')
        .update({
          status: 'failed',
          gateway_response: {
            ...(typeof transakcja.gateway_response === 'object' ? transakcja.gateway_response : {}),
            webhook_processed_at: new Date().toISOString(),
            raw_status: paymentStatus
          }
        })
        .eq('order_id', orderID);
    }

    // 5. Potwierdzenie odbioru dla Autopay
    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
    return new NextResponse(xmlResponse, { status: 200, headers: { 'Content-Type': 'application/xml' } });

  } catch (error: any) {
    console.error('[Autopay Webhook Fatal Error]:', error);
    const xmlErr = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
    return new NextResponse(xmlErr, { status: 200, headers: { 'Content-Type': 'application/xml' } });
  }
}
