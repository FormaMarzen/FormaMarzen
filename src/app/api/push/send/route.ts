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
      console.error('Brak skonfigurowanych kluczy VAPID w zmiennych środowiskowych Vercel.');
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
    let { subscriptions, payload, targetEmail, email, targetName } = bodyData;

    const recipientEmail = (targetEmail || email || '').toLowerCase().trim();
    let resolvedRecipientName = targetName || payload?.odbiorca || '';
    let clientDbId: number | null = null;

    // Pobranie danych klienta (Imię i Nazwisko) z tabeli klienci
    if (recipientEmail) {
      const { data: clientRows } = await supabase.from('klienci').select('*');
      if (clientRows && Array.isArray(clientRows)) {
        const found = clientRows.find((c: any) => {
          let cMail = '';
          Object.keys(c).forEach((k) => {
            const kl = k.toLowerCase().replace(/[\s\-_]/g, '');
            if (kl.includes('mail') || kl === 'email') {
              cMail = String(c[k] || '').toLowerCase().trim();
            }
          });
          return cMail === recipientEmail;
        });

        if (found) {
          clientDbId = found.id ? Number(found.id) : null;
          if (!resolvedRecipientName) {
            let imie = found['Imię'] || found['imie'] || found['Imie'] || '';
            let nazwisko = found['Nazwisko'] || found['nazwisko'] || '';
            const full = `${imie} ${nazwisko}`.trim();
            if (full) resolvedRecipientName = full;
          }
        }
      }
    }

    if (!resolvedRecipientName) {
      resolvedRecipientName = recipientEmail || 'Klubowicz';
    }

    // Pobranie subskrypcji po stronie serwera
    if ((!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) && recipientEmail) {
      const searchQueries = [`user_id.ilike.%${recipientEmail}%`, `user_id.eq.${recipientEmail}`];
      if (clientDbId !== null) {
        searchQueries.push(`user_id.eq.${clientDbId}`);
      }

      const { data: dbSubs, error: dbError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .or(searchQueries.join(','));

      if (dbError) {
        console.error('Błąd pobierania subskrypcji z push_subscriptions:', dbError);
      }

      if (dbSubs && dbSubs.length > 0) {
        subscriptions = dbSubs;
      }
    }

    const tytulPowiadomienia = payload?.title || 'FORMA MARZEŃ';
    const trescPowiadomienia = payload?.body || '';
    const typPowiadomienia = payload?.typ || payload?.type || 'PUSH';

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      // Zapis do historia_powiadomien informacji o braku zarejestrowanego urządzenia
      await supabase.from('historia_powiadomien').insert([
        {
          odbiorca: resolvedRecipientName,
          odbiorca_id: clientDbId,
          tytul: tytulPowiadomienia,
          tresc: trescPowiadomienia,
          typ: typPowiadomienia,
          status: 'Brak aktywnej subskrypcji urządzenia (Klubowicz nie aktywował Push)',
        },
      ]);

      return NextResponse.json({
        success: false,
        warning: 'Powiadomienie zapisano w bazie, ale klubowicz nie ma jeszcze zarejestrowanego urządzenia w push_subscriptions.',
        recipient: resolvedRecipientName,
      });
    }

    const notificationPayload = JSON.stringify({
      title: tytulPowiadomienia,
      body: trescPowiadomienia,
      url: payload?.url || '/baza-wiedzy',
      icon: payload?.icon || '/logo.png',
      badge: payload?.badge || '/logo.png',
      data: {
        url: payload?.url || '/baza-wiedzy',
        dateOfArrival: Date.now(),
      },
    });

    const pushOptions = {
      TTL: 86400,
      urgency: 'high' as const,
      headers: {
        Urgency: 'high',
      },
    };

    const logEntries: Array<{
      odbiorca: string;
      odbiorca_id: number | null;
      tytul: string;
      tresc: string;
      typ: string;
      status: string;
    }> = [];

    const results = await Promise.allSettled(
      subscriptions.map(async (rawSub: any) => {
        let subObj = rawSub;
        let recipientName = rawSub?.odbiorca || rawSub?.imie_nazwisko || resolvedRecipientName;
        let recipientIdRaw = rawSub?.odbiorca_id || rawSub?.klient_id || clientDbId || payload?.odbiorca_id || null;

        let recipientId: number | null = null;
        if (recipientIdRaw !== null && recipientIdRaw !== undefined && !isNaN(Number(recipientIdRaw))) {
          recipientId = Number(recipientIdRaw);
        }

        if (typeof subObj === 'string') {
          try {
            subObj = JSON.parse(subObj);
          } catch (e) {
            console.error('Nieprawidłowy ciąg subskrypcji JSON:', subObj);
            logEntries.push({
              odbiorca: recipientName,
              odbiorca_id: recipientId,
              tytul: tytulPowiadomienia,
              tresc: trescPowiadomienia,
              typ: typPowiadomienia,
              status: 'Błąd: Niepoprawny format JSON',
            });
            throw new Error('Niepoprawny format subskrypcji');
          }
        }

        if (subObj?.subscription) {
          subObj = typeof subObj.subscription === 'string' ? JSON.parse(subObj.subscription) : subObj.subscription;
        }

        if (!subObj?.endpoint || !subObj?.keys?.p256dh || !subObj?.keys?.auth) {
          console.error('Niekompletny obiekt subskrypcji push:', subObj);
          logEntries.push({
            odbiorca: recipientName,
            odbiorca_id: recipientId,
            tytul: tytulPowiadomienia,
            tresc: trescPowiadomienia,
            typ: typPowiadomienia,
            status: 'Błąd: Brak kluczy push',
          });
          throw new Error('Brak wymaganych kluczy subskrypcji');
        }

        try {
          const response = await webpush.sendNotification(subObj, notificationPayload, pushOptions);

          logEntries.push({
            odbiorca: recipientName,
            odbiorca_id: recipientId,
            tytul: tytulPowiadomienia,
            tresc: trescPowiadomienia,
            typ: typPowiadomienia,
            status: 'Wysłano',
          });

          return {
            success: true,
            statusCode: response.statusCode,
            endpoint: subObj.endpoint,
          };
        } catch (err: any) {
          console.error('Błąd bramki push (FCM/APNs):', {
            message: err.message,
            statusCode: err.statusCode,
            body: err.body,
            endpoint: subObj.endpoint,
          });

          const isExpired = err.statusCode === 404 || err.statusCode === 410;
          const statusDesc = isExpired ? 'Brak aktywnej subskrypcji (Wygasła)' : `Błąd wysyłki: ${err.statusCode || err.message}`;

          logEntries.push({
            odbiorca: recipientName,
            odbiorca_id: recipientId,
            tytul: tytulPowiadomienia,
            tresc: trescPowiadomienia,
            typ: typPowiadomienia,
            status: statusDesc,
          });

          return Promise.reject({
            success: false,
            statusCode: err.statusCode,
            isExpired,
            message: err.message,
            endpoint: subObj.endpoint,
          });
        }
      })
    );

    if (logEntries.length > 0) {
      const { error: logError } = await supabase
        .from('historia_powiadomien')
        .insert(logEntries);

      if (logError) {
        console.error('Błąd zapisu do historia_powiadomien:', logError);
      }
    }

    const delivered = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      delivered,
      failed,
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('Błąd krytyczny endpointu /api/push/send:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Błąd serwera' },
      { status: 500 }
    );
  }
}
