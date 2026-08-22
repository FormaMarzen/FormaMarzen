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

    const sendPromises = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub, notificationPayload).catch((err: any) => {
        console.error('Błąd wysyłania do subskrypcji (status):', err.statusCode || err);
      })
    );

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Błąd krytyczny endpointu /api/push/send:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
