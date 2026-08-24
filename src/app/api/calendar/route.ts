import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawKlientId = searchParams.get('klient_id');
    const isAdmin = searchParams.get('admin') === 'true';
    const filterTrainer = searchParams.get('trainer');
    const filterType = searchParams.get('type');

    let events: any[] = [];

    // 1. Jeśli to kalendarz klubowicza
    if (rawKlientId) {
      // Bezpieczna konwersja ID z tekstu na liczbę (dopasowanie do typu int8 w Supabase)
      const klientId = !isNaN(Number(rawKlientId)) ? Number(rawKlientId) : rawKlientId;

      const { data: clientData, error: clientErr } = await (supabase
        .from('klienci') as any)
        .select('id, Imię, Nazwisko, ustawienia_kalendarza')
        .eq('id', klientId)
        .maybeSingle();

      if (clientErr || !clientData) {
        console.error("Kalendarz ICS - klient nie znaleziony:", rawKlientId, clientErr);
        return new NextResponse('Klient nie znaleziony w bazie danych', { status: 404 });
      }

      let settings: any = {};
      try {
        settings = typeof clientData.ustawienia_kalendarza === 'string' 
          ? JSON.parse(clientData.ustawienia_kalendarza) 
          : (clientData.ustawienia_kalendarza || {});
      } catch (e) {
        settings = {};
      }

      if (settings.autoSync === false) {
        return new NextResponse('Synchronizacja kalendarza jest wyłączona w profilu użytkownika.', { status: 403 });
      }

      const { data: signups } = await supabase
        .from('zapisy_zajec')
        .select('*')
        .eq('klient_id', klientId)
        .eq('status', 'zapisany');

      if (signups && signups.length > 0) {
        const { data: szablony } = await supabase.from('grafik_zajec').select('*');
        const { data: jednorazowe } = await supabase.from('zajecia_jednorazowe').select('*');
        const { data: nadpisania } = await supabase.from('nadpisania_zajec').select('*');

        const nadpisaniaMap: Record<string, any> = {};
        nadpisania?.forEach((n: any) => { nadpisaniaMap[n.class_key] = n; });

        signups.forEach((s: any) => {
          const parts = (s.class_key || '').split('_');
          const classId = parts[0];
          const dateStr = parts[1];

          if (dateStr) {
            let year = new Date().getFullYear();
            let month = 1;
            let day = 1;

            if (dateStr.includes('/')) {
              const [d, m] = dateStr.split('/').map(Number);
              day = d;
              month = m;
            } else if (dateStr.includes('-')) {
              const [y, m, d] = dateStr.split('-').map(Number);
              year = y;
              month = m;
              day = d;
            }

            const std = szablony?.find((sz: any) => String(sz.id) === classId);
            const jed = jednorazowe?.find((j: any) => String(j.id) === classId);
            const override = nadpisaniaMap[s.class_key];
            const cls = override ? { ...std, ...jed, ...override } : (std || jed);

            if (cls && !cls.is_odwolane && !cls.is_usuniete && !cls['is-usuniete']) {
              events.push({
                title: cls.title || cls.nazwa || 'Trening w klubie',
                start: cls.start || cls.start_time || '10:00',
                end: cls.end || cls.end_time || '11:00',
                year,
                month,
                day,
                trainer: cls.trainer || cls.prowadzacy || ''
              });
            }
          }
        });
      }
    } 
    // 2. Jeśli to widok administratora z filtrami
    else if (isAdmin) {
      const { data: szablony } = await supabase.from('grafik_zajec').select('*');
      const { data: jednorazowe } = await supabase.from('zajecia_jednorazowe').select('*');
      const { data: nadpisania } = await supabase.from('nadpisania_zajec').select('*');

      const nadpisaniaMap: Record<string, any> = {};
      nadpisania?.forEach((n: any) => { nadpisaniaMap[n.class_key] = n; });

      const now = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const dayIdx = d.getDay();
        const dayKeys = ['nd', 'pon', 'wt', 'sr', 'czw', 'pt', 'sob'];
        const kKey = dayKeys[dayIdx];

        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dateDisplay = `${dayStr}/${monthStr}`;
        const isoDateStr = `${d.getFullYear()}-${monthStr}-${dayStr}`;

        szablony?.forEach((item: any) => {
          if (item.days && item.days[kKey]) {
            const classKey = `${item.id}_${dayStr}/${monthStr}`;
            const override = nadpisaniaMap[classKey] || nadpisaniaMap[`${item.id}_${isoDateStr}`];
            const cls = override ? { ...item, ...override } : item;

            if (cls.is_odwolane || cls.is_usuniete || cls['is-usuniete']) return;

            if (filterTrainer && filterTrainer !== 'Wszyscy' && cls.trainer !== filterTrainer) return;
            if (filterType && filterType !== 'Wszystkie' && cls.title !== filterType) return;

            events.push({
              title: cls.title || 'Trening',
              start: cls.start || '10:00',
              end: cls.end || '11:00',
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              day: d.getDate(),
              trainer: cls.trainer || ''
            });
          }
        });

        jednorazowe?.forEach((item: any) => {
          if (item.display_date === dateDisplay || item.displayDate === dateDisplay || item.full_date_str === isoDateStr) {
            if (item.is_odwolane || item.is_usuniete || item['is-usuniete']) return;

            if (filterTrainer && filterTrainer !== 'Wszyscy' && item.trainer !== filterTrainer) return;
            if (filterType && filterType !== 'Wszystkie' && item.title !== filterType) return;

            events.push({
              title: item.title || 'Trening',
              start: item.start_time || item.start || '10:00',
              end: item.end_time || item.end || '11:00',
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              day: d.getDate(),
              trainer: item.trainer || ''
            });
          }
        });
      }
    } else {
      return new NextResponse('Brak wymaganych parametrów (klient_id lub admin=true)', { status: 400 });
    }

    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Forma Marzen//Klub Sportowy//PL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Forma Marzeń - Treningi'
    ];

    events.forEach((ev, idx) => {
      const [sh, sm] = (ev.start || '10:00').split(':').map(Number);
      const [eh, em] = (ev.end || '11:00').split(':').map(Number);

      const pad = (n: number) => String(n).padStart(2, '0');
      const dtstart = `${ev.year}${pad(ev.month)}${pad(ev.day)}T${pad(sh)}${pad(sm)}00`;
      const dtend = `${ev.year}${pad(ev.month)}${pad(ev.day)}T${pad(eh)}${pad(em)}00`;

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:event-${idx}-${dtstart}@formamarzen.pl`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${ev.title}`,
        `DESCRIPTION:Trening prowadzący: ${ev.trainer || 'Klub'}`,
        'END:VEVENT'
      );
    });

    icsLines.push('END:VCALENDAR');

    return new NextResponse(icsLines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="kalendarz-treningow.ics"',
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('Błąd generowania ICS:', err);
    return new NextResponse('Błąd serwera', { status: 500 });
  }
}
