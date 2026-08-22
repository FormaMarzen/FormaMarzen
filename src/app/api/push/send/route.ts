import { NextResponse } from 'next/server';
import webpush from 'web-push';

export async function POST(request: Request) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';
    const subject = process.env.VAPID_SUBJECT || 'mailto:kontakt@formamarzen.pl';

    if (!publicKey || !privateKey) {
      console.error('Brak skonfigurowanych kluczy VAPID w zmiennych środowiskowych Vercel.');
      return NextResponse.json({ success: false, error: 'Brak konfiguracji VAPID na serwerze' }, { status: 500 });
    }

    // Inicjalizacja kluczy VAPID bezpośrednio w żądaniu
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { subscriptions, payload } = await request.json();

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json({ success: false, error: 'Brak aktywnych subskrypcji' }, { status: 400 });
    }

    const notificationPayload = JSON.stringify({
      title: payload.title || 'FORMA MARZEŃ',
      body: payload.body || '',
      url: payload.url || '/'
    });

    // Wysyłamy powiadomienia i zbieramy pełne statusy odpowiedzi
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          const response = await webpush.sendNotification(sub, notificationPayload);
          return { success: true, statusCode: response.statusCode };
        } catch (err: any) {
          console.error('Szczegóły błędu Google/Apple Push:', {
            message: err.message,
            statusCode: err.statusCode,
            body: err.body,
            headers: err.headers
          });
          throw err;
        }
      })
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      const errorDetails = failed.map((f: any) => f.reason?.message || 'Nieznany błąd web-push');
      return NextResponse.json({ success: false, error: errorDetails[0] }, { status: 500 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Błąd krytyczny endpointu /api/push/send:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
