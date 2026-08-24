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
    let calendarName = 'Forma Marzeń - Treningi';

    if (rawKlientId) {
      const klientId = !isNaN(Number(rawKlientId)) ? Number(rawKlientId) : rawKlientId;

      // Pobieramy całe wiersze przez gwiazdkę (*), aby brak opcjonalnej kolumny w Supabase nie powodował błędu
      const { data: clientData, error: clientErr } = await (supabase
        .from('klienci') as any)
        .select('*')
        .eq('id', klientId)
        .maybeSingle();

      if (clientErr || !clientData) {
        console.error("Kalendarz ICS - klient nie znaleziony:", rawKlientId, clientErr);
        events.push({
          title: 'Forma Marzeń - Klient nie znaleziony',
          start: '10:00',
          end: '11:00',
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          day: new Date().getDate(),
          trainer: 'Klub'
        });
      } else {
        const imie = clientData.Imię || clientData.imie || '';
        const nazwisko = clientData.Nazwisko || clientData.nazwisko || '';
        calendarName = `Forma Marzeń - ${imie} ${nazwisko}`.trim();

        let settings: any = {};
        try {
          settings = typeof clientData.ustawienia_kalendarza === 'string' 
            ? JSON.parse(clientData.ustawienia_kalendarza) 
            : (clientData.ustawienia_kalendarza || {});
        } catch (e) {
          settings = {};
        }

        if (settings.autoSync === false) {
          events.push({
            title: 'Forma Marzeń - Synchronizacja wyłączona',
            start: '10:00',
            end: '11:00',
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            day: new Date().getDate(),
            trainer: 'Klub'
          });
        } else {
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

          if (events.length === 0) {
            const now = new Date();
            events.push({
              title: 'Forma Marzeń - Brak nadchodzących zapisów',
              start: '10:00',
              end: '11:00',
              year: now.getFullYear(),
              month: now.getMonth() + 1,
              day: now.getDate(),
              trainer: 'Klub'
            });
          }
        }
      }
    } else if (isAdmin) {
      calendarName = 'Forma Marzeń - Grafik Administratora';
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
      calendarName = 'Forma Marzeń - Kalendarz';
      const now = new Date();
      events.push({
        title: 'Forma Marzeń - Kalendarz gotowy',
        start: '10:00',
        end: '11:00',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        trainer: 'Klub'
      });
    }

    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Forma Marzen//Klub Sportowy//PL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}`
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
    const now = new Date();
    const fallbackIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Forma Marzen//Klub Sportowy//PL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Forma Marzeń - Kalendarz',
      'BEGIN:VEVENT',
      `UID:error-event@formamarzen.pl`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}T100000`,
      `DTEND:${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}T110000`,
      `SUMMARY:Forma Marzeń - Aktualizacja kalendarza`,
      `DESCRIPTION:Spróbuj ponownie za chwilę.`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return new NextResponse(fallbackIcs, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="kalendarz-treningow.ics"',
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
