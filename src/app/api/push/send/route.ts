import { NextResponse } from 'next/server';
import webpush from 'web-push';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:kontakt@formamarzen.pl';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function POST(request: Request) {
  try {
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
        console.error('Błąd wysyłania do subskrypcji:', err.statusCode || err);
      })
    );

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Błąd endpointu /api/push/send:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
