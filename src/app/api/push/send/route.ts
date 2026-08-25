import { NextResponse } from 'next/server';
import webpush from 'web-push';

export async function POST(request: Request) {
  try {
    const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
    const subject = (process.env.VAPID_SUBJECT || 'mailto:kontakt@formamarzen.pl').trim();

    if (!publicKey || !privateKey) {
      console.error('Brak skonfigurowanych kluczy VAPID w zmiennych środowiskowych Vercel.');
      return NextResponse.json({ success: false, error: 'Brak konfiguracji VAPID na serwerze' }, { status: 500 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const bodyData = await request.json();
    const { subscriptions, payload } = bodyData;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json({ success: false, error: 'Brak aktywnych subskrypcji' }, { status: 400 });
    }

    const notificationPayload = JSON.stringify({
      title: payload?.title || 'FORMA MARZEŃ',
      body: payload?.body || '',
      url: payload?.url || '/',
      icon: '/logo.png',
      badge: '/logo.png',
      data: {
        url: payload?.url || '/'
      }
    });

    const pushOptions = {
      TTL: 86400, // 24 godziny ważności w kolejce APNs / FCM
      urgency: 'high' as const,
      headers: {
        'Urgency': 'high'
      }
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (rawSub: any) => {
        let subObj = rawSub;

        // Bezpieczne odpakowanie subskrypcji
        if (typeof subObj === 'string') {
          try {
            subObj = JSON.parse(subObj);
          } catch (e) {
            console.error('Nieprawidłowy ciąg subskrypcji JSON:', subObj);
            throw new Error('Niepoprawny format subskrypcji');
          }
        }

        if (subObj?.subscription) {
          subObj = typeof subObj.subscription === 'string' ? JSON.parse(subObj.subscription) : subObj.subscription;
        }

        if (!subObj?.endpoint || !subObj?.keys?.p256dh || !subObj?.keys?.auth) {
          console.error('Niekompletny obiekt subskrypcji push:', subObj);
          throw new Error('Brak wymaganych kluczy subskrypcji (endpoint/p256dh/auth)');
        }

        try {
          const response = await webpush.sendNotification(subObj, notificationPayload, pushOptions);
          return { success: true, statusCode: response.statusCode };
        } catch (err: any) {
          console.error('Błąd bramki push (FCM/APNs):', {
            message: err.message,
            statusCode: err.statusCode,
            body: err.body
          });
          throw err;
        }
      })
    );

    const successfulCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      delivered: successfulCount,
      failed: failedCount,
      total: subscriptions.length
    });
  } catch (error: any) {
    console.error('Błąd krytyczny endpointu /api/push/send:', error);
    return NextResponse.json({ success: false, error: error.message || 'Błąd serwera' }, { status: 500 });
  }
}
