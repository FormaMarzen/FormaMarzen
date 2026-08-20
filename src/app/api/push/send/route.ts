import { NextResponse } from 'next/server';
import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:kontakt@formamarzen.pl';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(req: Request) {
  try {
    const { subscriptions, payload } = await req.json();

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json({ error: 'Brak aktywnych subskrypcji do wysyłki' }, { status: 400 });
    }

    const pushPromises = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
        console.error('Błąd wysyłki pojedynczego pusha:', err);
      })
    );

    await Promise.all(pushPromises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Błąd w API Push:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}