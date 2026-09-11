import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function isContractPass(k: any): boolean {
  if (!k) return false;
  if (k.isContract12M === true || k.isContract12M === 'true') return true;
  const lower = (k.nazwa || k.pass || '').toLowerCase();
  const typ = (k.typKarnetu || k.typ_karnetu || '').toLowerCase();
  return typ.includes('umowa') || lower.includes('umowa') || lower.includes('12m') || typ.includes('12m');
}

// OBLICZANIE OSTATNIEGO DNIA MIESIĄCA KALENDARZOWEGO (RÓWNIEŻ PRZY PŁATNOŚCIACH Z WYPRZEDZENIEM)
function calculateEndOfMonthDate(currentPaidUntil?: string | null): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const firstDayOfCurrentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  let baseYear = currentYear;
  let baseMonth = currentMonth;

  if (currentPaidUntil && currentPaidUntil !== '-') {
    const parts = String(currentPaidUntil).split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const pYear = parts[0];
      const pMonth = parts[1];
      if (String(currentPaidUntil) >= firstDayOfCurrentMonthStr) {
        const nextMonthDate = new Date(pYear, pMonth, 1);
        baseYear = nextMonthDate.getFullYear();
        baseMonth = nextMonthDate.getMonth() + 1;
      }
    }
  }

  const lastDay = new Date(baseYear, baseMonth, 0).getDate();
  return `${baseYear}-${String(baseMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

async function sendPushToAdmins(title: string, body: string, url: string = '/raporty/klienci') {
  try {
    const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
    const privateKey = (process.env.VAPID_KEY_PRIVATE || process.env.VAPID_PRIVATE_KEY || '').trim();
    let subject = (process.env.VAPID_SUBJECT || 'mailto:kontakt@formamarzen.pl').trim();

    if (!publicKey || !privateKey) {
      console.error('[WebPush Error - Autopay Webhook] Brak kluczy VAPID w środowisku.');
      return;
    }

    if (!subject.startsWith('mailto:') && !subject.startsWith('http://') && !subject.startsWith('https://')) {
      subject = `mailto:${subject}`;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const targetsToSend: Array<{ subObj: any; name: string; id: number | null }> = [];
    const seenEndpoints = new Set<string>();

    const addSub = (rawSub: any, name: string, id: number | null) => {
      if (!rawSub) return;
      let cleanSub = rawSub;
      if (typeof cleanSub === 'string') {
        try { cleanSub = JSON.parse(cleanSub); } catch (e) { return; }
      }
      if (cleanSub?.subscription) {
        cleanSub = typeof cleanSub.subscription === 'string' ? JSON.parse(cleanSub.subscription) : cleanSub.subscription;
      }
      if (!cleanSub?.endpoint || !cleanSub?.keys?.p256dh || !cleanSub?.keys?.auth) return;

      if (!seenEndpoints.has(cleanSub.endpoint)) {
        seenEndpoints.add(cleanSub.endpoint);
        targetsToSend.push({ subObj: cleanSub, name, id });
      }
    };

    // 1. Sprawdzenie dedykowanej tabeli push_subscriptions (rola admin lub Twój e-mail)
    const { data: adminSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .or('role.eq.admin,user_id.eq.maciejklaput@gmail.com');

    if (adminSubs && adminSubs.length > 0) {
      for (const row of adminSubs) {
        addSub((row as any).subscription || row, 'Administrator', null);
      }
    }

    // 2. Sprawdzenie tabeli klienci dla administratora
    const { data: adminClients } = await supabase
      .from('klienci')
      .select('id, push_subscription, "Imię", "Nazwisko", "E-mail", rola')
      .or('rola.eq.admin,"E-mail".ilike.%admin%,"Imię".eq.Maciej,"E-mail".ilike.%maciejklaput%');

    if (adminClients && adminClients.length > 0) {
      for (const rawClient of adminClients) {
        const c = rawClient as any;
        const adminName = `${c['Imię'] || c.imie || 'Admin'} ${c['Nazwisko'] || c.nazwisko || ''}`.trim();
        if (c.push_subscription) {
          addSub(c.push_subscription, adminName, c.id);
        }

        const { data: extraSubs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', String(c.id));

        if (extraSubs && extraSubs.length > 0) {
          for (const s of extraSubs) {
            addSub((s as any).subscription || s, adminName, c.id);
          }
        }
      }
    }

    if (targetsToSend.length === 0) {
      console.warn('[WebPush Autopay] Nie odnaleziono zarejestrowanych urządzeń administratora.');
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: { url, dateOfArrival: Date.now() }
    });

    const pushOptions = {
      TTL: 86400,
      urgency: 'high' as const,
    };

    const logEntries: any[] = [];

    await Promise.allSettled(
      targetsToSend.map(async (target) => {
        try {
          await webpush.sendNotification(target.subObj, payload, pushOptions);
          logEntries.push({
            odbiorca: target.name,
            odbiorca_id: target.id,
            tytul: title,
            tresc: body,
            typ: 'PUSH_AUTOPAY_ADMIN',
            status: 'Wysłano',
            created_at: new Date().toISOString()
          });
        } catch (err: any) {
          console.error(`[WebPush Error for ${target.name}]:`, err?.message || err);
          logEntries.push({
            odbiorca: target.name,
            odbiorca_id: target.id,
            tytul: title,
            tresc: body,
            typ: 'PUSH_AUTOPAY_ADMIN',
            status: `Błąd wysyłki: ${err?.statusCode || err?.message}`,
            created_at: new Date().toISOString()
          });
        }
      })
    );

    if (logEntries.length > 0) {
      await supabase.from('historia_powiadomien').insert(logEntries);
    }
  } catch (err) {
    console.error('[WebPush Fatal Error - Autopay Webhook]:', err);
  }
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

    // 1. Pobranie rekordu transakcji Autopay
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

    // Zabezpieczenie przed powtórnym przetworzeniem tego samego orderID
    if (transakcja.status === 'success') {
      const xmlAlreadySuccess = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
      return new NextResponse(xmlAlreadySuccess, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }

    // Zabezpieczenie przed dublowaniem w tabeli transakcje
    const { data: existingTransakcja } = await supabase
      .from('transakcje')
      .select('id')
      .eq('klient_id', transakcja.user_id)
      .ilike('opis', `%${orderID}%`)
      .maybeSingle();

    if (existingTransakcja) {
      await supabase
        .from('autopay_transakcje')
        .update({ status: 'success' })
        .eq('order_id', orderID);

      const xmlAlreadyProcessed = `<?xml version="1.0" encoding="UTF-8"?><confirmation><status>CONFIRMED</status></confirmation>`;
      return new NextResponse(xmlAlreadyProcessed, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    }

    const isSuccess = paymentStatus.toUpperCase() === 'SUCCESS' || paymentStatus.toUpperCase() === 'SUCCESSFUL';
    const isFailure = paymentStatus.toUpperCase() === 'FAILURE' || paymentStatus.toUpperCase() === 'FAILED';

    if (isSuccess) {
      const rawNum = Number(transakcja.amount) || Number(amount) || 0;
      const transactionAmount = Math.abs(rawNum);
      const metadata = transakcja.gateway_response?.metadata || {};
      const gatewayResponse = transakcja.gateway_response || {};

      // 2. Pobranie danych klienta
      const { data: rawKlient } = await supabase
        .from('klienci')
        .select('*')
        .eq('id', transakcja.user_id)
        .single();

      const klient = rawKlient as any;
      const clientName = klient
        ? `${klient['Imię'] || klient.imie || ''} ${klient['Nazwisko'] || klient.nazwisko || ''}`.trim()
        : 'Klubowicz';

      // A. OBSŁUGA ZAKUPU ODZIEŻY KLUBOWEJ
      if (transakcja.type === 'tshirt_purchase' || transakcja.type === 'odziez_zakup') {
        const kampaniaId = gatewayResponse.kampania_id || metadata.kampania_id;
        const zamowienieId = gatewayResponse.zamowienie_id || metadata.zamowienie_id;
        const wariant = gatewayResponse.wariant || metadata.wariant || '';
        const rozmiar = gatewayResponse.rozmiar || metadata.rozmiar || '';

        let targetOrder: any = null;

        if (zamowienieId) {
          const { data: ord } = await supabase
            .from('odziez_zamowienia')
            .update({
              status_platnosci: 'oplacone',
              oplacone_at: new Date().toISOString(),
              admin_odczytane: false
            })
            .eq('id', zamowienieId)
            .select()
            .maybeSingle();
          targetOrder = ord;
        } else {
          const { data: ord } = await supabase
            .from('odziez_zamowienia')
            .update({
              status_platnosci: 'oplacone',
              oplacone_at: new Date().toISOString(),
              admin_odczytane: false
            })
            .eq('autopay_order_id', orderID)
            .select()
            .maybeSingle();
          targetOrder = ord;
        }

        const effectiveCampId = kampaniaId || targetOrder?.kampania_id;

        if (effectiveCampId) {
          const { data: camp } = await supabase
            .from('odziez_kampanie')
            .select('*')
            .eq('id', effectiveCampId)
            .single();

          if (camp) {
            const { count } = await supabase
              .from('odziez_zamowienia')
              .select('*', { count: 'exact', head: true })
              .eq('kampania_id', effectiveCampId)
              .eq('status_platnosci', 'oplacone');

            const paidCount = count || 0;
            const minOsob = camp.min_osob || 10;

            if (paidCount >= minOsob && !camp.min_osiagniete_at && camp.status === 'aktywny') {
              const now = new Date();
              const minOsiagniete = now.toISOString();
              const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

              await supabase
                .from('odziez_kampanie')
                .update({
                  min_osiagniete_at: minOsiagniete,
                  koniec_zamowien_at: deadline
                })
                .eq('id', camp.id);
            }
          }
        }

        await supabase.from('transakcje').insert([{
          klient_id: transakcja.user_id,
          typ_operacji: 'odziez_autopay',
          kwota: transactionAmount,
          opis: `Zamówienie odzieży klubowej: ${wariant} ${rozmiar ? `(${rozmiar})` : ''} (Autopay online, Zamówienie: ${orderID})`
        }]);

        await sendPushToAdmins(
          'Opłacono koszulkę klubową! 👕',
          `${clientName} opłacił(a) koszulkę: ${wariant} ${rozmiar ? `(${rozmiar})` : ''} (${transactionAmount.toFixed(2)} PLN)`,
          '/odziez'
        );

      // B. OBSŁUGA OPŁACENIA KOSZULKI NA WYDARZENIE
      } else if (transakcja.type === 'koszulka_fee') {
        const wydarzenieId = gatewayResponse.wydarzenie_id || metadata.wydarzenie_id;

        if (wydarzenieId) {
          const { data: eventData } = await supabase
            .from('wydarzenia')
            .select('id, tytul, koszulki_zamowienia')
            .eq('id', wydarzenieId)
            .single();

          if (eventData) {
            const currentOrders: any[] = eventData.koszulki_zamowienia || [];
            const userEmail = (klient?.['E-mail'] || klient?.email || transakcja.email || '').toLowerCase().trim();

            const updatedOrders = currentOrders.map((order: any) => {
              const orderEmail = (order.email || '').toLowerCase().trim();
              const orderId = String(order.id || '');
              const matchesUser = (userEmail && orderEmail === userEmail) || (transakcja.user_id && orderId === String(transakcja.user_id));

              if (matchesUser) {
                return {
                  ...order,
                  status_platnosci: 'calosc'
                };
              }
              return order;
            });

            await supabase
              .from('wydarzenia')
              .update({ koszulki_zamowienia: updatedOrders })
              .eq('id', eventData.id);

            await supabase.from('transakcje').insert([{
              klient_id: transakcja.user_id,
              typ_operacji: 'koszulka_autopay',
              kwota: transactionAmount,
              opis: `Opłata za koszulkę treningową: ${eventData.tytul} (Autopay online, Zamówienie: ${orderID})`
            }]);

            await sendPushToAdmins(
              'Opłacono koszulkę treningową! 👕',
              `${clientName} opłacił(a) koszulkę na wydarzenie "${eventData.tytul}" (${transactionAmount.toFixed(2)} PLN)`,
              '/wydarzenia'
            );
          }
        }

      // C. OBSŁUGA WPISOWEGO NA WYZWANIE REDUKCJI
      } else if (transakcja.type === 'redukcja_fee') {
        const edycjaId = gatewayResponse.edycja_id || metadata.edycja_id;

        if (edycjaId && transakcja.user_id) {
          await supabase
            .from('klub_redukcja_uczestnicy')
            .update({ oplacone: true, metoda_platnosci: 'autopay' })
            .eq('edycja_id', edycjaId)
            .eq('klient_id', transakcja.user_id);

          await supabase.from('transakcje').insert([{
            klient_id: transakcja.user_id,
            typ_operacji: 'redukcja_fee_autopay',
            kwota: transactionAmount,
            opis: `Wpisowe na wyzwanie redukcji (Opłacono online Autopay, Zamówienie: ${orderID})`
          }]);

          await sendPushToAdmins(
            'Wpisowe na redukcję opłacone! 🔥',
            `${clientName} opłacił(a) wpisowe na wyzwanie redukcji (${transactionAmount.toFixed(2)} PLN)`,
            '/analiza-formy'
          );
        }

      // D. DEDYKOWANA OBSŁUGA OPŁATY RATY UMOWY 12M
      } else if (transakcja.type === 'contract_installment') {
        if (klient) {
          const targetPaidUntil = metadata.targetPaidUntil || calculateEndOfMonthDate(klient.umowa_oplacona_do);

          let parsedKarnety: any[] = [];
          if (Array.isArray(klient.karnetyKlubowicza)) {
            parsedKarnety = klient.karnetyKlubowicza;
          } else if (typeof klient.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(klient.karnetyKlubowicza); } catch(e) {}
          }

          let passName = metadata.contractPassName || 'OPEN - umowa 12 miesięcy';
          let updatedRataDisplay = '1 / 12';

          const updatedKarnety = parsedKarnety.map((k: any) => {
            if (isContractPass(k) || (metadata.contractPassId && String(k.id) === String(metadata.contractPassId))) {
              passName = k.nazwa || passName;
              let currentRataNum = 1;
              let maxRata = 12;

              if (typeof k.rata === 'string' && k.rata.includes('/')) {
                const parts = k.rata.split('/');
                currentRataNum = parseInt(parts[0].trim(), 10) || 1;
                maxRata = parseInt(parts[1].trim(), 10) || 12;
              }

              const nextRata = Math.min(maxRata, currentRataNum + 1);
              updatedRataDisplay = `${nextRata} / ${maxRata}`;

              return {
                ...k,
                waznyDo: targetPaidUntil,
                rata: updatedRataDisplay,
                blokadaDo: null,
                powodBlokady: null,
                statusTekst: `Umowa 12M (Rata ${updatedRataDisplay} • Ważny do: ${targetPaidUntil})`
              };
            }
            return k;
          });

          const clientUpdatePayload: Record<string, any> = {
            umowa_oplacona_do: targetPaidUntil,
            karnetyKlubowicza: updatedKarnety
          };

          const isBlockedForContract = klient.powodBlokady?.toLowerCase().includes('umow') || klient.powodBlokady?.toLowerCase().includes('wpłat') || klient.powodBlokady?.toLowerCase().includes('wplat');
          if (isBlockedForContract || klient.blokadaDo) {
            clientUpdatePayload.blokadaDo = null;
            clientUpdatePayload.powodBlokady = null;
          }

          await supabase
            .from('klienci')
            .update(clientUpdatePayload)
            .eq('id', klient.id);

          await supabase.from('transakcje').insert([{
            klient_id: klient.id,
            typ_operacji: 'oplata_raty_12m_autopay',
            kwota: transactionAmount,
            opis: `Opłata raty umowy 12M: ${passName} (Rata ${updatedRataDisplay}, opłacono online Autopay do ${targetPaidUntil}, Zamówienie: ${orderID})`
          }]);

          await supabase.from('booking_logs').insert([{
            action_type: 'CONTRACT_PAID_AUTOPAY',
            status: 'SUCCESS',
            reason: `Klubowicz ID:${klient.id} opłacił ratę umowy online Autopay do ${targetPaidUntil}. Zdjęto blokadę ratalną.`,
            rule_applied: 'contract_autopay_settlement',
            payload: { klient_id: klient.id, amount: transactionAmount, paid_until: targetPaidUntil, order_id: orderID }
          }]);

          await sendPushToAdmins(
            'Opłacono ratę umowy 12M! 💳',
            `${clientName} opłacił(a) ratę umowy online Autopay (${transactionAmount.toFixed(2)} PLN, ważność do ${targetPaidUntil})`,
            '/raporty/klienci'
          );
        }

      // E. OBSŁUGA ZAKUPU / PRZEDŁUŻENIA KARNETU PRZEZ AUTOPAY
      } else if (transakcja.type === 'pass_purchase' || transakcja.type === 'pass_extend') {
        if (klient) {
          const clientUpdatePayload: Record<string, any> = {};

          // WYKLUCZENIE Z CIĄGŁOŚCI KARNETÓW <= 150 ZŁ
          const isLowCostPass = transactionAmount <= 150;

          if (metadata.updatedKarnetyList && Array.isArray(metadata.updatedKarnetyList)) {
            clientUpdatePayload.karnetyKlubowicza = metadata.updatedKarnetyList.map((k: any) => {
              const passPrice = parseFloat(String(k.cena || '0').replace(/[^0-9.-]/g, '')) || 0;
              if (passPrice <= 150 || isLowCostPass) {
                if (k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && k.pozostaloWejsc <= 0) {
                  const labelWejsc = (k.poczatkoweWejsc === 1 || (k.nazwa || '').toLowerCase().includes('1 wejście') || (k.nazwa || '').toLowerCase().includes('pojedyncz'))
                    ? 'Wykorzystano wejście'
                    : 'Wykorzystano wejścia';
                  return {
                    ...k,
                    zeroEntriesGraceUntil: null,
                    statusTekst: labelWejsc
                  };
                }
                return {
                  ...k,
                  zeroEntriesGraceUntil: null
                };
              }
              return k;
            });
          }

          if (metadata.urodziny_rabat_rok) {
            clientUpdatePayload.urodziny_rabat_rok = metadata.urodziny_rabat_rok;
          }

          // Rabat i cykl ciągłości aktualizujemy tylko dla karnetów powyżej 150 zł
          if (!isLowCostPass) {
            if (metadata.finalRabatInt !== undefined) {
              clientUpdatePayload.rabat = metadata.finalRabatInt;
            }
            if (metadata.finalCyklInt !== undefined) {
              clientUpdatePayload.cyklCiaglosci = metadata.finalCyklInt;
            }
            if (metadata.hasLostContinuity !== undefined) {
              clientUpdatePayload.hasLostContinuity = metadata.hasLostContinuity;
            }
          }

          if (metadata.cenaStr) {
            clientUpdatePayload.Cena = metadata.cenaStr;
          }

          let isContractOperation = false;
          if (metadata.umowa_oplacona_do) {
            clientUpdatePayload.umowa_oplacona_do = metadata.umowa_oplacona_do;
            isContractOperation = true;
          } else if (clientUpdatePayload.karnetyKlubowicza && Array.isArray(clientUpdatePayload.karnetyKlubowicza)) {
            const contractItem = clientUpdatePayload.karnetyKlubowicza.find((k: any) => isContractPass(k));
            if (contractItem) {
              isContractOperation = true;
              clientUpdatePayload.umowa_oplacona_do = contractItem.waznyDo || calculateEndOfMonthDate(klient.umowa_oplacona_do);
            }
          }

          if (isContractOperation) {
            const isBlockedForContract = klient.powodBlokady?.toLowerCase().includes('umow') || klient.powodBlokady?.toLowerCase().includes('wpłat') || klient.powodBlokady?.toLowerCase().includes('wplat');
            if (isBlockedForContract || klient.blokadaDo) {
              clientUpdatePayload.blokadaDo = null;
              clientUpdatePayload.powodBlokady = null;
            }
          }

          if (metadata.walletDeduction && metadata.newWalletBalance) {
            clientUpdatePayload.Portfel = metadata.newWalletBalance;
          }

          if (Object.keys(clientUpdatePayload).length > 0) {
            await supabase
              .from('klienci')
              .update(clientUpdatePayload)
              .eq('id', klient.id);
          }

          const passTitle = metadata.passName || metadata.nazwaKarnetu || metadata.karnetNazwa || '';
          let opDescription = transakcja.gateway_response?.opis || (transakcja.type === 'pass_extend' ? 'Przedłużenie karnetu' : 'Zakup karnetu');
          
          if (passTitle && !opDescription.includes(passTitle)) {
            opDescription = `${transakcja.type === 'pass_extend' ? 'Przedłużenie karnetu' : 'Zakup karnetu'}: ${passTitle}`;
          }

          if (metadata.transferredEntries && metadata.transferredEntries > 0) {
            opDescription += ` (Przeniesiono +${metadata.transferredEntries} niewykorzystanych wejść)`;
          }

          const typOp = isContractOperation
            ? (transakcja.type === 'pass_extend' ? 'oplata_raty_12m_autopay' : 'zakup_umowy_autopay')
            : (transakcja.type === 'pass_extend' ? 'przedluzenie_karnetu_autopay' : 'zakup_karnetu_autopay');

          const { data: insertedTrans } = await supabase
            .from('transakcje')
            .insert([{
              klient_id: klient.id,
              typ_operacji: typOp,
              kwota: transactionAmount,
              opis: `${opDescription} (Opłacono online Autopay, Zamówienie: ${orderID})`,
              kod_rabatowy: metadata.kod_rabatowy || null
            }])
            .select('id')
            .maybeSingle();

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

          await sendPushToAdmins(
            transakcja.type === 'pass_extend' ? 'Przedłużono karnet! 💳' : 'Kupiono nowy karnet! 💳',
            `${clientName} opłacił(a) karnet: ${opDescription} (${transactionAmount.toFixed(2)} PLN)`,
            '/raporty/klienci'
          );
        }

      // F. OBSŁUGA DOŁADOWANIA PORTFELA LUB SPŁATY ZADŁUŻENIA
      } else {
        if (klient) {
          const rawWalletStr = klient.Portfel || klient.portfel || '0.00 PLN';
          const isNegative = String(rawWalletStr).includes('-');
          let currentWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, '')) || 0;
          if (isNegative) currentWalletNum = -Math.abs(currentWalletNum);

          const newWalletNum = currentWalletNum + transactionAmount;
          const formattedNewWallet = `${newWalletNum.toFixed(2)} PLN`;

          const clientWalletUpdate: Record<string, any> = { Portfel: formattedNewWallet };

          if (newWalletNum >= 0 && (klient.powodBlokady?.toLowerCase().includes('portfel') || klient.powodBlokady?.toLowerCase().includes('zadłużen') || klient.powodBlokady?.toLowerCase().includes('zadluzen'))) {
            clientWalletUpdate.blokadaDo = null;
            clientWalletUpdate.powodBlokady = null;
          }

          await supabase
            .from('klienci')
            .update(clientWalletUpdate)
            .eq('id', klient.id);

          await supabase.from('transakcje').insert([{
            klient_id: klient.id,
            typ_operacji: transakcja.type === 'wallet_settlement' ? 'splata_zadluzenia_autopay' : 'doladowanie_portfela_autopay',
            kwota: transactionAmount,
            opis: transakcja.type === 'wallet_settlement'
              ? `Spłata zadłużenia portfela (Opłacono online Autopay: ${transactionAmount.toFixed(2)} PLN, Zamówienie: ${orderID})`
              : `Doładowanie portfela klubowicza (Opłacono online Autopay: ${transactionAmount.toFixed(2)} PLN, Zamówienie: ${orderID})`
          }]);

          await sendPushToAdmins(
            transakcja.type === 'wallet_settlement' ? 'Spłata zadłużenia portfela 💰' : 'Doładowanie portfela 💰',
            `${clientName} dokonał(a) wpłaty na portfel w kwocie ${transactionAmount.toFixed(2)} PLN (Nowy stan: ${formattedNewWallet})`,
            '/raporty/klienci'
          );
        }
      }

      // 3. Aktualizacja statusu w tabeli autopay_transakcje
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
