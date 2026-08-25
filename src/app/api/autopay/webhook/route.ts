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
    const serviceIDEnv = (process.env.AUTOPAY_SERVICE_ID || '220522').trim();
    const hashKey = (process.env.AUTOPAY_HASH_KEY || '').trim();
    const separator = (process.env.AUTOPAY_HASH_SEPARATOR || '|').trim();

    const rawBody = await req.text();
    let orderID = '';
    let paymentStatus = '';
    let amount = '';
    let receivedHash = '';

    // 1. Parsowanie powiadomienia Autopay ITN (XML Base64 / XML / JSON / URL-encoded)
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
      receivedHash = extractXmlTag(xmlContent, 'hash');
    } else if (rawBody.startsWith('{')) {
      const jsonData = JSON.parse(rawBody);
      orderID = jsonData.OrderID || jsonData.orderID || jsonData.order_id || '';
      paymentStatus = jsonData.PaymentStatus || jsonData.paymentStatus || jsonData.status || '';
      amount = jsonData.Amount || jsonData.amount || '';
      receivedHash = jsonData.Hash || jsonData.hash || '';
    } else {
      const params = new URLSearchParams(rawBody);
      orderID = params.get('OrderID') || params.get('orderID') || '';
      paymentStatus = params.get('PaymentStatus') || params.get('paymentStatus') || '';
      amount = params.get('Amount') || params.get('amount') || '';
      receivedHash = params.get('Hash') || params.get('hash') || '';
    }

    if (!orderID) {
      return new NextResponse('Brak OrderID w powiadomieniu', { status: 400 });
    }

    // 2. Weryfikacja sumy kontrolnej powiadomienia
    if (receivedHash && hashKey) {
      const calculatedHash = crypto
        .createHash('sha256')
        .update(`${serviceIDEnv}${separator}${orderID}${separator}${paymentStatus}${separator}${hashKey}`, 'utf8')
        .digest('hex');

      if (receivedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
        console.warn(`[Autopay Webhook] Niepoprawny hash powiadomienia dla OrderID: ${orderID}`);
      }
    }

    // 3. Pobranie transakcji z bazy danych
    const { data: transakcja, error: fetchErr } = await supabase
      .from('autopay_transakcje')
      .select('*')
      .eq('order_id', orderID)
      .single();

    if (fetchErr || !transakcja) {
      console.error(`[Autopay Webhook] Transakcja nie znaleziona: ${orderID}`);
      const xmlNotFound = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>NOTCONFIRMED</status></confirmation>`;
      return new NextResponse(xmlNotFound, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }

    // 4. Zabezpieczenie przed podwójnym naliczeniem wpłaty
    if (transakcja.status === 'success') {
      const xmlAlreadySuccess = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
      return new NextResponse(xmlAlreadySuccess, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }

    const isSuccess = paymentStatus.toUpperCase() === 'SUCCESS' || paymentStatus.toUpperCase() === 'SUCCESSFUL';
    const isFailure = paymentStatus.toUpperCase() === 'FAILURE' || paymentStatus.toUpperCase() === 'FAILED';

    if (isSuccess) {
      const transactionAmount = Number(transakcja.amount) || Number(amount) || 0;

      // Zmiana statusu na success w autopay_transakcje
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

      // Aktualizacja salda portfela klienta
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

    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
    return new NextResponse(xmlResponse, { status: 200, headers: { 'Content-Type': 'application/xml' } });

  } catch (error: any) {
    console.error('[Autopay Webhook Error]:', error);
    const xmlErr = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>NOTCONFIRMED</status></confirmation>`;
    return new NextResponse(xmlErr, { status: 500, headers: { 'Content-Type': 'application/xml' } });
  }
}
