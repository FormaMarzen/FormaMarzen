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
    console.log('[Autopay Webhook Received Body]:', rawBody);

    let orderID = '';
    let paymentStatus = '';
    let amount = '';

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
      console.error('[Autopay Webhook] Brak OrderID');
      return new NextResponse('Brak OrderID', { status: 400 });
    }

    // 1. Pobranie rekordu transakcji
    const { data: transakcja, error: fetchErr } = await supabase
      .from('autopay_transakcje')
      .select('*')
      .eq('order_id', orderID)
      .single();

    if (fetchErr || !transakcja) {
      console.error(`[Autopay Webhook] Transakcja nie znaleziona: ${orderID}`);
      const xmlNotFound = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
      return new NextResponse(xmlNotFound, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }

    // Zabezpieczenie przed podwójnym przetworzeniem
    if (transakcja.status === 'success') {
      const xmlAlreadySuccess = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
      return new NextResponse(xmlAlreadySuccess, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }

    const isSuccess = paymentStatus.toUpperCase() === 'SUCCESS' || paymentStatus.toUpperCase() === 'SUCCESSFUL';
    const isFailure = paymentStatus.toUpperCase() === 'FAILURE' || paymentStatus.toUpperCase() === 'FAILED';

    if (isSuccess) {
      const transactionAmount = Number(transakcja.amount) || Number(amount) || 0;
      const metadata = transakcja.gateway_response?.metadata || {};

      // 2. Pobranie danych klienta
      const { data: klient, error: klientErr } = await supabase
        .from('klienci')
        .select('*')
        .eq('id', transakcja.user_id)
        .single();

      if (!klientErr && klient) {
        // A. OBSŁUGA ZAKUPU / PRZEDŁUŻENIA KARNETU PRZEZ AUTOPAY
        if (transakcja.type === 'pass_purchase' || transakcja.type === 'pass_extend') {
          const clientUpdatePayload: Record<string, any> = {};

          if (metadata.updatedKarnetyList) {
            clientUpdatePayload.karnetyKlubowicza = metadata.updatedKarnetyList;
          }
          if (metadata.urodziny_rabat_rok) {
            clientUpdatePayload.urodziny_rabat_rok = metadata.urodziny_rabat_rok;
          }
          if (metadata.finalRabatInt !== undefined) {
            clientUpdatePayload.rabat = metadata.finalRabatInt;
          }
          if (metadata.finalCyklInt !== undefined) {
            clientUpdatePayload.cyklCiaglosci = metadata.finalCyklInt;
          }
          if (metadata.hasLostContinuity !== undefined) {
            clientUpdatePayload.hasLostContinuity = metadata.hasLostContinuity;
          }
          if (metadata.cenaStr) {
            clientUpdatePayload.Cena = metadata.cenaStr;
          }

          if (Object.keys(clientUpdatePayload).length > 0) {
            await supabase
              .from('klienci')
              .update(clientUpdatePayload)
              .eq('id', klient.id);
          }

          // Rejestracja transakcji w tabeli transakcje
          const { data: insertedTrans } = await supabase
            .from('transakcje')
            .insert([{
              klient_id: klient.id,
              typ_operacji: transakcja.type === 'pass_extend' ? 'przedluzenie_karnetu_autopay' : 'zakup_karnetu_autopay',
              kwota: -transactionAmount,
              opis: `${transakcja.gateway_response?.opis || 'Zakup karnetu'} (Opłacono online Autopay)`,
              kod_rabatowy: metadata.kod_rabatowy || null
            }])
            .select('id')
            .maybeSingle();

          // Naliczanie użycia kodu rabatowego
          if (metadata.appliedDiscountCodeId) {
            const { data: dCode } = await supabase
              .from('kody_rabatowe')
              .select('wykorzystano_ogolnie')
              .eq('id', metadata.appliedDiscountCodeId)
              .single();

            if (dCode) {
              await supabase
                .from('kody_rabatowe')
                .update({ wykorzystano_ogolnie: (dCode.wykorzystano_ogolnie || 0) + 1 })
                .eq('id', metadata.appliedDiscountCodeId);
            }

            await supabase
              .from('kody_rabatowe_uzycia')
              .insert([{
                kod_id: metadata.appliedDiscountCodeId,
                klient_id: klient.id,
                karnet_id: metadata.defKarnetId || null,
                transakcja_id: insertedTrans?.id || null
              }]);
          }

        } else {
          // B. OBSŁUGA STANDARDOWEGO DOŁADOWANIA PORTFELA LUB SPŁATY
          const rawWalletStr = klient.Portfel || klient.portfel || '0.00 PLN';
          const isNegative = String(rawWalletStr).includes('-');
          let currentWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, '')) || 0;
          if (isNegative) currentWalletNum = -Math.abs(currentWalletNum);

          const newWalletNum = currentWalletNum + transactionAmount;
          const formattedNewWallet = `${newWalletNum.toFixed(2)} PLN`;

          await supabase
            .from('klienci')
            .update({ Portfel: formattedNewWallet })
            .eq('id', klient.id);
        }
      }

      // 3. Aktualizacja statusu w tabeli autopay_transakcje na success
      await supabase
        .from('autopay_transakcje')
        .update({
          status: 'success',
          gateway_response: {
            ...transakcja.gateway_response,
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
            ...transakcja.gateway_response,
            webhook_processed_at: new Date().toISOString(),
            raw_status: paymentStatus
          }
        })
        .eq('order_id', orderID);
    }

    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
    return new NextResponse(xmlResponse, { status: 200, headers: { 'Content-Type': 'application/xml' } });

  } catch (error: any) {
    console.error('[Autopay Webhook Fatal Error]:', error);
    const xmlErr = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
    return new NextResponse(xmlErr, { status: 500, headers: { 'Content-Type': 'application/xml' } });
  }
}
