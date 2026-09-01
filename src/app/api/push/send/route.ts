import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
    let subject = (process.env.VAPID_SUBJECT || 'mailto:kontakt@formamarzen.pl').trim();

    if (!publicKey || !privateKey) {
      console.error('[PUSH ERROR] Brak kluczy VAPID w zmiennych środowiskowych.');
      return NextResponse.json(
        { success: false, error: 'Brak konfiguracji VAPID na serwerze' },
        { status: 500 }
      );
    }

    if (!subject.startsWith('mailto:') && !subject.startsWith('http://') && !subject.startsWith('https://')) {
      subject = `mailto:${subject}`;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const bodyData = await request.json();
    const {
      clientIds,
      participantIds,
      userIds,
      subscriptions,
      payload,
      targetEmail,
      email,
      targetName,
      title,
      body,
      message,
      url,
      type,
      typ,
      sendToAdmins,
      sendToAll,
      targetRole
    } = bodyData;

    const tytulPowiadomienia = payload?.title || title || 'FORMA MARZEŃ';
    const trescPowiadomienia = payload?.body || body || message || payload?.message || '';
    const typPowiadomienia = payload?.typ || payload?.type || typ || type || 'PUSH';
    const docelowyUrl = payload?.url || url || '/';

    const targetsToSend: Array<{
      subObj: any;
      recipientName: string;
      recipientId: number | null;
      clientRowId?: number;
      endpoint: string;
    }> = [];

    const logEntries: Array<{
      odbiorca: string;
      odbiorca_id: number | null;
      tytul: string;
      tresc: string;
      typ: string;
      status: string;
      created_at: string;
    }> = [];

    const seenEndpoints = new Set<string>();

    // Funkcja pomocnicza dodająca urządzenie do kolejki
    const addTargetDevice = (sub: any, name: string, id: number | null, rowId?: number) => {
      const cleanSub = sub?.subscription ? (typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription) : sub;
      if (!cleanSub?.endpoint || !cleanSub?.keys?.p256dh || !cleanSub?.keys?.auth) return;

      if (!seenEndpoints.has(cleanSub.endpoint)) {
        seenEndpoints.add(cleanSub.endpoint);
        targetsToSend.push({
          subObj: cleanSub,
          recipientName: name,
          recipientId: id,
          clientRowId: rowId,
          endpoint: cleanSub.endpoint,
        });
      }
    };

    // 1. Wysyłka do Administratorów (np. nowe opłacone zamówienie odzieży)
    if (sendToAdmins || targetRole === 'admin') {
      const { data: adminSubs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('role', 'admin');

      if (adminSubs && adminSubs.length > 0) {
        for (const row of adminSubs) {
          addTargetDevice(row.subscription || row, 'Administrator', null);
        }
      }

      const { data: adminClients } = await supabase
        .from('klienci')
        .select('id, push_subscription, "Imię", "Nazwisko", "E-mail", rola')
        .or('rola.eq.admin,"E-mail".ilike.%admin%,"Imię".eq.Maciej');

      if (adminClients && adminClients.length > 0) {
        for (const c of adminClients) {
          if (c.push_subscription) {
            try {
              const parsed = typeof c.push_subscription === 'string' ? JSON.parse(c.push_subscription) : c.push_subscription;
              addTargetDevice(parsed, `${c.Imię || 'Admin'} ${c.Nazwisko || ''}`.trim(), c.id, c.id);
            } catch (e) {}
          }
        }
      }
    }

    // 2. Wysyłka do Wszystkich Klubowiczów (np. powiadomienie o nowym dropie koszulek)
    if (sendToAll || targetRole === 'all') {
      const { data: allClients } = await supabase
        .from('klienci')
        .select('id, push_subscription, "Imię", "Nazwisko", "E-mail"')
        .not('push_subscription', 'is', null);

      if (allClients && allClients.length > 0) {
        for (const c of allClients) {
          if (c.push_subscription) {
            try {
              const parsed = typeof c.push_subscription === 'string' ? JSON.parse(c.push_subscription) : c.push_subscription;
              addTargetDevice(parsed, `${c.Imię || 'Klubowicz'} ${c.Nazwisko || ''}`.trim(), c.id, c.id);
            } catch (e) {}
          }
        }
      }

      const { data: allSubs } = await supabase.from('push_subscriptions').select('*');
      if (allSubs && allSubs.length > 0) {
        for (const s of allSubs) {
          addTargetDevice(s.subscription || s, 'Klubowicz', null);
        }
      }
    }

    // 3. Wyszukiwanie subskrypcji po identyfikatorach ID w tabeli klienci
    const rawIds = clientIds || participantIds || userIds;
    if (rawIds && (Array.isArray(rawIds) ? rawIds.length > 0 : true)) {
      const idList = Array.isArray(rawIds) ? rawIds : [rawIds];
      const validNumericIds = idList
        .map((id: any) => Number(id))
        .filter((id: number) => !isNaN(id) && id > 0 && id !== 5000 && id !== 999999999);

      if (validNumericIds.length > 0) {
        const { data: clientsData, error: clientsErr } = await supabase
          .from('klienci')
          .select('id, push_subscription, "Imię", "Nazwisko", "E-mail"')
          .in('id', validNumericIds);

        if (!clientsErr && clientsData && clientsData.length > 0) {
          for (const c of clientsData) {
            const imie = c.Imię || '';
            const nazwisko = c.Nazwisko || '';
            const mail = (c['E-mail'] || '').toLowerCase().trim();
            const pelnaNazwa = `${imie} ${nazwisko}`.trim();
            const odbiorcaTekst = pelnaNazwa ? (mail ? `${pelnaNazwa} (${mail})` : pelnaNazwa) : (mail || `Klubowicz #${c.id}`);

            let userSubs: any[] = [];

            if (c.push_subscription) {
              try {
                const parsed = typeof c.push_subscription === 'string' ? JSON.parse(c.push_subscription) : c.push_subscription;
                if (parsed) userSubs.push(parsed);
              } catch (e) {}
            }

            try {
              let query = supabase.from('push_subscriptions').select('*');
              if (mail) {
                query = query.or(`user_id.eq.${c.id},user_id.eq."${mail}"`);
              } else {
                query = query.eq('user_id', String(c.id));
              }
              const { data: dbSubs } = await query;

              if (dbSubs && dbSubs.length > 0) {
                for (const subRow of dbSubs) {
                  const sObj = subRow.subscription
                    ? (typeof subRow.subscription === 'string' ? JSON.parse(subRow.subscription) : subRow.subscription)
                    : subRow;
                  if (sObj) userSubs.push(sObj);
                }
              }
            } catch (e) {}

            let addedAnyDevice = false;

            for (const subItem of userSubs) {
              const beforeCount = targetsToSend.length;
              addTargetDevice(subItem, odbiorcaTekst, c.id, c.id);
              if (targetsToSend.length > beforeCount) {
                addedAnyDevice = true;
              }
            }

            if (!addedAnyDevice) {
              logEntries.push({
                odbiorca: odbiorcaTekst,
                odbiorca_id: c.id,
                tytul: tytulPowiadomienia,
                tresc: trescPowiadomienia,
                typ: typPowiadomienia,
                status: 'Brak aktywnej subskrypcji lub brak kluczy P256DH/Auth',
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // 4. Bezpośrednie subskrypcje przekazane w parametrze
    if (subscriptions && Array.isArray(subscriptions) && subscriptions.length > 0) {
      for (const rawSub of subscriptions) {
        let subObj = rawSub;
        if (typeof subObj === 'string') {
          try { subObj = JSON.parse(subObj); } catch (e) { continue; }
        }
        if (subObj?.subscription) {
          subObj = typeof subObj.subscription === 'string' ? JSON.parse(subObj.subscription) : subObj.subscription;
        }

        const recName = rawSub?.odbiorca || targetName || 'Klubowicz';
        const recId = rawSub?.odbiorca_id || rawSub?.klient_id || null;
        addTargetDevice(subObj, recName, recId ? Number(recId) : null);
      }
    }

    // 5. Fallback po adresie E-mail
    const recipientEmail = (targetEmail || email || '').toLowerCase().trim();
    if (targetsToSend.length === 0 && recipientEmail) {
      const { data: clientFound } = await supabase
        .from('klienci')
        .select('*')
        .ilike('"E-mail"', `%${recipientEmail}%`)
        .limit(1)
        .maybeSingle();

      if (clientFound) {
        const imie = clientFound.Imię || '';
        const nazwisko = clientFound.Nazwisko || '';
        const pelnaNazwa = `${imie} ${nazwisko}`.trim();
        const odbiorcaTekst = pelnaNazwa ? `${pelnaNazwa} (${recipientEmail})` : recipientEmail;

        if (clientFound.push_subscription) {
          try {
            const parsedSub = typeof clientFound.push_subscription === 'string' ? JSON.parse(clientFound.push_subscription) : clientFound.push_subscription;
            addTargetDevice(parsedSub, odbiorcaTekst, clientFound.id, clientFound.id);
          } catch (e) {}
        }
      }
    }

    if (targetsToSend.length === 0) {
      if (logEntries.length > 0) {
        await supabase.from('historia_powiadomien').insert(logEntries);
      }
      return NextResponse.json({
        success: false,
        warning: 'Brak zarejestrowanych urządzeń odbiorców z poprawnymi kluczami.',
        logged: logEntries.length,
      });
    }

    const notificationPayload = JSON.stringify({
      title: tytulPowiadomienia,
      body: trescPowiadomienia,
      url: docelowyUrl,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        url: docelowyUrl,
        dateOfArrival: Date.now(),
      },
    });

    const pushOptions = {
      TTL: 86400,
      urgency: 'high' as const,
    };

    const results = await Promise.allSettled(
      targetsToSend.map(async (target) => {
        try {
          const response = await webpush.sendNotification(target.subObj, notificationPayload, pushOptions);

          logEntries.push({
            odbiorca: target.recipientName,
            odbiorca_id: target.recipientId,
            tytul: tytulPowiadomienia,
            tresc: trescPowiadomienia,
            typ: typPowiadomienia,
            status: 'Wysłano',
            created_at: new Date().toISOString(),
          });

          return {
            success: true,
            statusCode: response.statusCode,
            recipient: target.recipientName,
          };
        } catch (err: any) {
          const isExpired = err.statusCode === 404 || err.statusCode === 410;
          const statusDesc = isExpired ? 'Brak aktywnej subskrypcji (Wygasła)' : `Błąd wysyłki: ${err.statusCode || err.message}`;

          if (isExpired && target.clientRowId) {
            await supabase.from('klienci').update({ push_subscription: null }).eq('id', target.clientRowId);
            await supabase.from('push_subscriptions').delete().eq('endpoint', target.endpoint);
          }

          logEntries.push({
            odbiorca: target.recipientName,
            odbiorca_id: target.recipientId,
            tytul: tytulPowiadomienia,
            tresc: trescPowiadomienia,
            typ: typPowiadomienia,
            status: statusDesc,
            created_at: new Date().toISOString(),
          });

          return Promise.reject({
            success: false,
            statusCode: err.statusCode,
            isExpired,
            message: err.message,
          });
        }
      })
    );

    if (logEntries.length > 0) {
      await supabase.from('historia_powiadomien').insert(logEntries);
    }

    const delivered = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      delivered,
      failed,
      total: targetsToSend.length,
    });
  } catch (error: any) {
    console.error('[PUSH CRITICAL ERROR]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Błąd serwera' },
      { status: 500 }
    );
  }
}
