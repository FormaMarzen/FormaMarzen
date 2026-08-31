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
      console.error('Brak kluczy VAPID w zmiennych środowiskowych Vercel.');
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
      typ
    } = bodyData;

    // Uniwersalna ekstrakcja treści powiadomienia
    const tytulPowiadomienia = payload?.title || title || 'FORMA MARZEŃ';
    const trescPowiadomienia = payload?.body || body || message || payload?.message || '';
    const typPowiadomienia = payload?.typ || payload?.type || typ || type || 'PUSH';
    const docelowyUrl = payload?.url || url || '/';

    const rawIds = clientIds || participantIds || userIds;
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

    // 1. Pobieranie subskrypcji po ID odbiorców
    if (rawIds && (Array.isArray(rawIds) ? rawIds.length > 0 : true)) {
      const idList = Array.isArray(rawIds) ? rawIds : [rawIds];
      const validNumericIds = idList
        .map((id: any) => Number(id))
        .filter((id: number) => !isNaN(id) && id > 0 && id !== 5000 && id !== 999999999);

      if (validNumericIds.length > 0) {
        const { data: clientsData, error: clientsErr } = await supabase
          .from('klienci')
          .select('id, push_subscription, "Imię", "Nazwisko", firstName, lastName, "E-mail", email')
          .in('id', validNumericIds);

        if (!clientsErr && clientsData && clientsData.length > 0) {
          for (const c of clientsData) {
            const imie = c.Imię || c.firstName || '';
            const nazwisko = c.Nazwisko || c.lastName || '';
            const mail = (c['E-mail'] || c.email || '').toLowerCase().trim();
            const pelnaNazwa = `${imie} ${nazwisko}`.trim();
            const odbiorcaTekst = pelnaNazwa ? (mail ? `${pelnaNazwa} (${mail})` : pelnaNazwa) : (mail || `Klubowicz #${c.id}`);

            let userSubs: any[] = [];

            // Sprawdzenie kolumny push_subscription w tabeli klienci
            if (c.push_subscription) {
              try {
                const parsed = typeof c.push_subscription === 'string' ? JSON.parse(c.push_subscription) : c.push_subscription;
                if (parsed) userSubs.push(parsed);
              } catch (e) {}
            }

            // Sprawdzenie powiązanych rekordów w tabeli push_subscriptions (wiele urządzeń)
            try {
              let query = supabase.from('push_subscriptions').select('*');
              if (mail) {
                query = query.or(`user_id.eq.${c.id},user_id.eq."${mail}",klient_id.eq.${c.id}`);
              } else {
                query = query.or(`user_id.eq.${c.id},klient_id.eq.${c.id}`);
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
              const cleanSub = subItem?.subscription ? (typeof subItem.subscription === 'string' ? JSON.parse(subItem.subscription) : subItem.subscription) : subItem;
              if (cleanSub?.endpoint && cleanSub?.keys?.p256dh && cleanSub?.keys?.auth) {
                if (!seenEndpoints.has(cleanSub.endpoint)) {
                  seenEndpoints.add(cleanSub.endpoint);
                  targetsToSend.push({
                    subObj: cleanSub,
                    recipientName: odbiorcaTekst,
                    recipientId: c.id,
                    clientRowId: c.id,
                    endpoint: cleanSub.endpoint,
                  });
                  addedAnyDevice = true;
                }
              }
            }

            if (!addedAnyDevice) {
              logEntries.push({
                odbiorca: odbiorcaTekst,
                odbiorca_id: c.id,
                tytul: tytulPowiadomienia,
                tresc: trescPowiadomienia,
                typ: typPowiadomienia,
                status: 'Brak aktywnej subskrypcji (Klubowicz nie aktywował Push)',
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // 2. Pobieranie z bezpośrednio przekazanej tablicy subscriptions
    if (subscriptions && Array.isArray(subscriptions) && subscriptions.length > 0) {
      for (const rawSub of subscriptions) {
        let subObj = rawSub;
        if (typeof subObj === 'string') {
          try {
            subObj = JSON.parse(subObj);
          } catch (e) {
            continue;
          }
        }
        if (subObj?.subscription) {
          subObj = typeof subObj.subscription === 'string' ? JSON.parse(subObj.subscription) : subObj.subscription;
        }

        if (subObj?.endpoint && subObj?.keys?.p256dh && subObj?.keys?.auth) {
          if (!seenEndpoints.has(subObj.endpoint)) {
            seenEndpoints.add(subObj.endpoint);
            const recName = rawSub?.odbiorca || targetName || 'Klubowicz';
            const recId = rawSub?.odbiorca_id || rawSub?.klient_id || null;
            targetsToSend.push({
              subObj,
              recipientName: recName,
              recipientId: recId ? Number(recId) : null,
              endpoint: subObj.endpoint,
            });
          }
        }
      }
    }

    // 3. Fallback po adresie E-mail
    const recipientEmail = (targetEmail || email || '').toLowerCase().trim();
    if (targetsToSend.length === 0 && recipientEmail) {
      const { data: clientFound } = await supabase
        .from('klienci')
        .select('*')
        .or(`"E-mail".ilike.%${recipientEmail}%,email.ilike.%${recipientEmail}%`)
        .limit(1)
        .maybeSingle();

      if (clientFound) {
        const imie = clientFound.Imię || clientFound.firstName || '';
        const nazwisko = clientFound.Nazwisko || clientFound.lastName || '';
        const pelnaNazwa = `${imie} ${nazwisko}`.trim();
        const odbiorcaTekst = pelnaNazwa ? `${pelnaNazwa} (${recipientEmail})` : recipientEmail;

        let parsedSub: any = null;
        if (clientFound.push_subscription) {
          try {
            parsedSub = typeof clientFound.push_subscription === 'string' ? JSON.parse(clientFound.push_subscription) : clientFound.push_subscription;
          } catch (e) {}
        }

        if (!parsedSub) {
          const { data: dbSub } = await supabase
            .from('push_subscriptions')
            .select('*')
            .or(`user_id.eq.${clientFound.id},user_id.eq."${recipientEmail}"`)
            .limit(1)
            .maybeSingle();
          if (dbSub) {
            parsedSub = dbSub.subscription ? (typeof dbSub.subscription === 'string' ? JSON.parse(dbSub.subscription) : dbSub.subscription) : dbSub;
          }
        }

        if (parsedSub?.endpoint && parsedSub?.keys?.p256dh && parsedSub?.keys?.auth) {
          if (!seenEndpoints.has(parsedSub.endpoint)) {
            seenEndpoints.add(parsedSub.endpoint);
            targetsToSend.push({
              subObj: parsedSub,
              recipientName: odbiorcaTekst,
              recipientId: clientFound.id,
              clientRowId: clientFound.id,
              endpoint: parsedSub.endpoint,
            });
          }
        } else {
          logEntries.push({
            odbiorca: odbiorcaTekst,
            odbiorca_id: clientFound.id,
            tytul: tytulPowiadomienia,
            tresc: trescPowiadomienia,
            typ: typPowiadomienia,
            status: 'Brak aktywnej subskrypcji (Klubowicz nie aktywował Push)',
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    if (targetsToSend.length === 0) {
      if (logEntries.length > 0) {
        await supabase.from('historia_powiadomien').insert(logEntries);
      }
      return NextResponse.json({
        success: false,
        warning: 'Brak zarejestrowanych urządzeń odbiorców.',
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
          console.error(`Błąd wysyłki push dla ${target.recipientName}:`, err);

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
    console.error('Błąd krytyczny /api/push/send:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Błąd serwera' },
      { status: 500 }
    );
  }
}
