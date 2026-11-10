/*
 * HALA MOVE - the business and fleet enquiry form. One script, two hosts.
 *
 * Spec: hala-backend docs/research/2026-11-02-lead-form-questions.md, sections B, C, D and H.
 *
 * WHY ONE FILE. /quote and /business-transport-durban each carried a hand-written copy of this form.
 * The copies drifted: one asked deliveries a WEEK in chips, the other a MONTH as a typed number and
 * nothing about goods, vehicles or routes, so its leads reached the team as "See the message below".
 * Both pages now mount this file into <div id="leadForm">, and the question set lives only here.
 *
 * WHERE IT SENDS. POST /api/interest/business on the HALA MOVE backend, which stores the lead in
 * business_leads, texts both founders and emails the quote check. The contract it fills:
 *   - contact details in their columns only (company_name, contact_name, phone, email);
 *   - every other question AS ASKED in `answers`: {key, label, value}, label = the exact question the
 *     visitor read (without "(optional)"), value = the option text as shown, an array for choose-any;
 *   - the fridge answer in has_refrigerated only, vehicle_count in its column AND as an answer;
 *   - `message` opens with the four labelled lines the quote-check email reads ("What they move",
 *     "Vehicles", "Deliveries a week", "Routes"), then the other answers as "Label: value" lines, then
 *     what the visitor typed. THE FOUR LABELS ARE A CONTRACT with backend src/services/leadMailer.js.
 *   - attribution: the seven keys assets/first-touch.js produces, nothing else.
 *
 * WHAT IT KEEPS FROM THE OLD FORMS. The honeypot `website`, the button disabled while sending, the
 * email fallback (now on both pages), the tri-state fridge answer, and no number the visitor never gave.
 *
 * ES5, no libraries, no cookies, no third-party script.
 */
(function (root) {
  'use strict';

  var API = 'https://hala-backend-production.up.railway.app/api/interest/business';
  var WA_NUMBER = '27760525398';
  var WA_SHOWN = '+27 76 052 5398';
  var PROMISE = 'within two business days';
  var CONSENT = 'HALA MOVE may contact me by phone, WhatsApp or email about this request. See how my details are handled in the privacy policy.';
  var VERSION = { demand: 'demand-2026-11-02', fleet: 'fleet-2026-11-02' };
  var CONTACT_KEYS = { company_name: 1, contact_name: 1, phone: 1, email: 1 };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var FLEET_SHARE = 'Register on the HALA MOVE Driver app: https://www.halamove.co.za/drive?s=web-fleet';

  // ---------------------------------------------------------------------------------------------
  // The question sets (spec B.1 and B.2). Options are [key, text shown, description line].
  // ---------------------------------------------------------------------------------------------

  var GOODS = [
    ['building_materials', 'Building and hardware materials'],
    ['furniture_appliances', 'Furniture and appliances'],
    ['stock_wholesale', 'Stock and wholesale goods'],
    ['online_orders', 'Online orders to customers'],
    ['event_hire', 'Event and hire equipment'],
    ['workshop_items', 'Parts and workshop items'],
    ['medical_supplies', 'Medical equipment and supplies'],
    ['office_items', 'Office equipment and documents'],
    ['other', 'Something else']
  ];
  var CONTACT_WAY = [['call', 'Phone call'], ['whatsapp', 'WhatsApp'], ['email', 'Email']];
  var HOW_HEARD = [
    ['flyer', 'Flyer or poster'],
    ['met_team', 'Met someone from HALA MOVE'],
    ['word_of_mouth', 'A friend or another business'],
    ['driver', 'A HALA MOVE driver'],
    ['google', 'Google search'],
    ['facebook_instagram', 'Facebook or Instagram'],
    ['whatsapp', 'A WhatsApp message'],
    ['linkedin', 'LinkedIn'],
    ['tiktok_youtube', 'TikTok or YouTube'],
    ['other', 'Something else']
  ];

  // Asked only when the visit carries no ?s= and no utm_* (spec D): a tagged visit already says where
  // it came from.
  function untagged(st) {
    var A = root.HMAttribution;
    return !(A && A.tagged ? A.tagged(st.attr) : (st.attr && (st.attr.s || st.attr.utm_source || st.attr.utm_medium || st.attr.utm_campaign || st.attr.utm_content)));
  }

  var COMPANY = { key: 'company_name', type: 'text', label: 'Business name', autocomplete: 'organization', max: 200, min: 2,
    req: 'Enter your business name.', short: 'Enter at least 2 letters of your business name.' };
  var CONTACT = { key: 'contact_name', type: 'text', label: 'Your name', autocomplete: 'name', max: 120,
    req: 'Enter your name, so we know who to ask for.' };
  var PHONE = { key: 'phone', type: 'tel', label: 'Mobile number', placeholder: 'e.g. 082 123 4567', max: 24,
    req: 'Enter a mobile number we can call.', bad: 'Check the number. It should look like 082 123 4567 or +27 82 123 4567.' };
  var EMAIL_BAD = 'Check the email address. It should look like name@business.co.za.';
  var PREFERRED = { key: 'preferred_contact', type: 'chips', optional: true, label: 'Best way to reach you', options: CONTACT_WAY };
  var HEARD = { key: 'how_heard', type: 'chips', optional: true, label: 'How did you hear about HALA MOVE?', options: HOW_HEARD, showIf: untagged };
  var CONSENT_Q = { key: 'consent', type: 'consent', req: 'Tick the box so we may contact you about this request.' };

  var DEMAND = [
    { title: 'Your deliveries', qs: [
      { key: 'goods_type', type: 'chips', multi: true, label: 'What do you need moved?', hint: 'Choose all that apply.', options: GOODS,
        req: 'Choose at least one thing you move.',
        notes: [{ when: ['medical_supplies'], text: 'We do not carry temperature-controlled or refrigerated goods.' }],
        other: { when: 'other', key: 'goods_other', label: 'What is it?', max: 80 } },
      { key: 'vehicle_types', type: 'chips', multi: true, wide: true, label: 'What size vehicle do your loads need?',
        hint: 'Choose all that fit. These are the sizes in the HALA MOVE app.', exclusive: 'not_sure',
        options: [
          ['bakkie_small', 'Small Bakkie', 'A few boxes, a chair, light loads.'],
          ['bakkie_large', 'Large Bakkie', 'A couple of rooms of furniture.'],
          ['panel_van', 'Panel Van', 'Enclosed, weatherproof, more secure.'],
          ['truck_1ton', '1 Ton Truck', 'A studio or one-bed move. Includes the Hyundai H100.'],
          ['truck_4ton', '4 Ton Truck', 'A full house move.'],
          ['not_sure', 'Not sure, help me choose']
        ],
        req: 'Choose a vehicle size, or Not sure.' },
      { key: 'frequency', type: 'chips', label: 'How many deliveries in a normal week?',
        options: [['now_and_then', 'Now and then (less than one a week)'], ['w1_5', '1 to 5'], ['w6_20', '6 to 20'], ['w21_50', '21 to 50'], ['w51_plus', 'More than 50']],
        req: 'Choose how many deliveries you send in a normal week.' },
      { key: 'service_type', type: 'chips', label: 'How do you want to book?',
        options: [['as_needed', 'Book each job as I need it'], ['regular_runs', 'Regular runs, planned with you'], ['not_sure', 'Not sure yet, advise me']],
        req: 'Choose how you want to book.' }
    ] },
    { title: 'Where and when', qs: [
      { key: 'dispatch_area', type: 'text', label: 'Where do your loads leave from?', placeholder: 'Suburb or town, e.g. Pinetown',
        autocomplete: 'address-level2', max: 80, req: 'Enter the suburb or town your loads leave from.' },
      { key: 'route_scope', type: 'chips', multi: true, label: 'Where do your deliveries go?',
        options: [['durban_metro', 'Around the Durban metro'], ['kzn', 'Elsewhere in KwaZulu-Natal'], ['outside_kzn', 'Outside KwaZulu-Natal']],
        notes: [{ when: ['kzn', 'outside_kzn'], text: 'Our drivers are based mainly in the Durban metro. Longer trips are possible; offers can take longer and are priced by distance.' }],
        req: 'Choose where your deliveries go.' },
      { key: 'routes_detail', type: 'text', optional: true, label: 'Your usual routes',
        placeholder: 'e.g. Pinetown to Umhlanga, Durban CBD to Pietermaritzburg', max: 160 },
      { key: 'delivered_to', type: 'chips', optional: true, label: 'Who receives the deliveries?',
        options: [['my_customers', 'My customers'], ['my_sites', 'My own branches or sites'], ['suppliers', 'Collections from suppliers'], ['mix', 'A mix']] },
      { key: 'start_when', type: 'chips', optional: true, label: 'When do you want to start?',
        options: [['this_week', 'This week'], ['this_month', 'This month'], ['next_months', 'In the next few months'], ['exploring', 'Just finding out for now']] },
      { key: 'message', type: 'textarea', optional: true, noAnswer: true, label: 'Anything else we should know?',
        placeholder: 'Loading help, stairs, delivery times, or the delivery you are least happy with right now', max: 1000 }
    ] },
    { title: 'Your details', qs: [
      COMPANY, CONTACT, PHONE,
      { key: 'email', type: 'email', label: 'Email', hint: 'We send the written plan here.', max: 254,
        req: 'Enter your email address.', bad: EMAIL_BAD },
      PREFERRED,
      { key: 'role', type: 'chips', optional: true, label: 'Your role',
        options: [['owner', 'Owner or director'], ['manager', 'Manager'], ['team', 'Someone else in the team']] },
      { key: 'company_website', type: 'text', optional: true, label: 'Website or Facebook page', placeholder: 'e.g. yourbusiness.co.za',
        inputmode: 'url', max: 200 },
      HEARD, CONSENT_Q
    ] }
  ];

  var FLEET = [
    { title: 'Your vehicles', qs: [
      { key: 'vehicle_count', type: 'number', label: 'How many vehicles do you have?', placeholder: 'e.g. 4',
        req: 'Enter how many vehicles you have.', bad: 'Enter a whole number, like 4.' },
      { key: 'vehicle_types', type: 'chips', multi: true, wide: true, label: 'What vehicles are they?',
        options: [
          ['bakkie_small', 'Small Bakkie', 'e.g. NP200, Bantam'],
          ['bakkie_large', 'Large Bakkie', 'e.g. Hilux or Ranger single cab'],
          ['panel_van', 'Panel Van', 'e.g. Quantum, Sprinter, Transit'],
          ['truck_1ton', '1 Ton Truck', 'e.g. H100, K2700'],
          ['truck_4ton', '4 Ton Truck', 'e.g. Hino 300, Isuzu N-Series'],
          ['other_vehicle', 'Something else']
        ],
        other: { when: 'other_vehicle', key: 'vehicle_other', label: 'Which vehicles?', max: 80 },
        req: 'Choose at least one type of vehicle.' },
      { key: 'drivers', type: 'chips', label: 'Who drives them?',
        options: [['me', 'I drive myself'], ['employed', 'Drivers I employ'], ['both', 'Both']],
        req: 'Choose who drives your vehicles.' },
      { key: 'drivers_on_app', type: 'chips', optional: true, label: 'Are your drivers on the HALA MOVE Driver app yet?',
        options: [['all', 'Yes, all of them'], ['some', 'Some of them'], ['none', 'Not yet'], ['not_sure', 'Not sure']],
        showIf: function (st) { var d = st.vals.drivers; return d === 'employed' || d === 'both'; } },
      // Column only (has_refrigerated): admin prints the column itself, so an answer would print twice.
      { key: 'has_refrigerated', type: 'chips', optional: true, noAnswer: true, label: 'Do any of your vehicles have a fridge unit?',
        hint: 'We do not offer refrigerated transport today. Your answer tells us whether we could.',
        options: [['yes', 'Yes'], ['no', 'No']] }
    ] },
    { title: 'Your work', qs: [
      { key: 'base_area', type: 'text', label: 'Where are your vehicles based?', placeholder: 'Suburb or town, e.g. Pinetown or Richards Bay',
        autocomplete: 'address-level2', max: 80, req: 'Enter the suburb or town where your vehicles are based.' },
      { key: 'availability', type: 'chips', label: 'How busy are your vehicles in a normal week?',
        options: [['mostly_parked', 'Mostly parked'], ['some_days', 'Free some days'], ['busy', 'Busy most days']],
        req: 'Choose how busy your vehicles are.' },
      { key: 'work_wanted', type: 'chips', multi: true, label: 'What are you looking for?',
        options: [['more_jobs', 'More jobs for my vehicles'], ['dashboard', 'A dashboard of my drivers\' jobs'], ['business_runs', 'Regular runs for business clients']],
        notes: [
          { when: ['dashboard'], text: 'See where each driver is, with the time of their last update, their jobs and their delivery photos, once they agree to share them.' },
          { when: ['business_runs'], text: 'Our team plans business clients\' regular runs by hand; they are not automatic. Tell us your capacity and we will tell you straight what is available.' }
        ],
        req: 'Choose at least one thing you are looking for.' },
      { key: 'work_now', type: 'chips', multi: true, optional: true, label: 'What do you carry now?', options: GOODS },
      { key: 'message', type: 'textarea', optional: true, noAnswer: true, label: 'Anything else we should know?',
        placeholder: 'Areas you cover, hours you work, or contract work you have done before', max: 1000 }
    ] },
    { title: 'Your details', qs: [
      { key: 'company_name', type: 'text', label: 'Business name', hint: 'Your trading name. If you are not registered, use your own name.',
        autocomplete: 'organization', max: 200, min: 2, req: COMPANY.req, short: COMPANY.short },
      CONTACT, PHONE,
      { key: 'email', type: 'email', optional: true, label: 'Email', max: 254, bad: EMAIL_BAD },
      PREFERRED, HEARD, CONSENT_Q
    ] }
  ];

  var COPY = {
    demand: { title: 'Tell us about your deliveries',
      intro: 'Three short steps, mostly taps. We read your answers before we call, so we come prepared with a plan.',
      submit: 'Send my request' },
    fleet: { title: 'Put your vehicles to work on HALA MOVE',
      intro: 'Tell us about your vehicles and drivers. We set up every fleet account with its owner, so we will call you to do it together.',
      submit: 'Request fleet access' }
  };

  var PARTNER = { key: 'partner_kind', label: 'Route taken', value: 'One vehicle: shown the Driver app, chose to continue' };

  // ---------------------------------------------------------------------------------------------
  // Pure helpers: no DOM. buildPayload is what the page sends, and what a test harness can call.
  // ---------------------------------------------------------------------------------------------

  function trim(v) { return String(v == null ? '' : v).replace(/^\s+|\s+$/g, ''); }
  function stepsOf(flow) { return flow === 'fleet' ? FLEET : DEMAND; }
  function val(st, key) { return CONTACT_KEYS[key] ? (st.contact || {})[key] : (st.vals || {})[key]; }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function has(arr, k) { if (!isArr(arr)) return arr === k; for (var i = 0; i < arr.length; i++) if (arr[i] === k) return true; return false; }
  function anyOf(v, keys) { for (var i = 0; i < keys.length; i++) if (has(v, keys[i])) return true; return false; }
  function visible(qd, st) { return !qd.showIf || !!qd.showIf(st); }
  function intOf(v) { var s = trim(v); return /^\d+$/.test(s) ? parseInt(s, 10) : NaN; }

  function optText(qd, k) {
    for (var i = 0; i < qd.options.length; i++) if (qd.options[i][0] === k) return qd.options[i][1];
    return '';
  }

  // Choose-any values are kept in option order, whatever order they were tapped in.
  function chipValue(qd, v) {
    if (qd.multi) {
      var out = [];
      for (var i = 0; i < qd.options.length; i++) if (has(v, qd.options[i][0])) out.push(qd.options[i][1]);
      return out;
    }
    return v ? optText(qd, v) : '';
  }

  function textOf(v) { return isArr(v) ? v.join(', ') : trim(v); }

  function phoneDigits(s) { return trim(s).replace(/[\s\-().]/g, ''); }
  function phoneOk(s) {
    var d = phoneDigits(s);
    return /^0\d{9}$/.test(d) || /^(\+27|27)\d{9}$/.test(d) || /^\+\d{8,15}$/.test(d);
  }
  // The route accepts 6 to 20 characters. Keep what the visitor typed unless it is too long.
  function phoneOut(s) {
    var p = trim(s).replace(/\s+/g, ' ');
    if (p.length > 20) p = p.replace(/[^\d+]/g, '');
    return p.slice(0, 20);
  }

  function errorFor(qd, st, badInput) {
    var v = qd.type === 'consent' ? st.consent : val(st, qd.key);
    var s;
    switch (qd.type) {
      case 'chips':
        if (qd.optional) return '';
        return (isArr(v) ? v.length : !!v) ? '' : qd.req;
      case 'consent':
        return v ? '' : qd.req;
      case 'number':
        if (badInput) return qd.bad;
        s = trim(v);
        if (!s) return qd.req;
        var n = intOf(s);
        return n >= 1 && n <= 10000 ? '' : qd.bad;
      case 'tel':
        s = trim(v);
        if (!s) return qd.optional ? '' : qd.req;
        return phoneOk(s) ? '' : qd.bad;
      case 'email':
        s = trim(v);
        if (!s) return qd.optional ? '' : qd.req;
        return EMAIL_RE.test(s) ? '' : qd.bad;
      default:
        s = trim(v);
        if (!s) return qd.optional ? '' : (qd.req || '');
        if (qd.min && s.length < qd.min) return qd.short;
        return '';
    }
  }

  function partnerKind(st) { return st.flow === 'fleet' && !!st.ownerContinue && intOf(val(st, 'vehicle_count')) === 1; }

  // Every answered, visible question in the order asked, as {key, label, value}.
  function collectAnswers(st) {
    var out = [];
    var steps = stepsOf(st.flow);
    for (var i = 0; i < steps.length; i++) {
      var qs = steps[i].qs;
      for (var j = 0; j < qs.length; j++) {
        var qd = qs[j];
        if (!visible(qd, st)) continue;
        if (qd.type === 'consent') {
          if (st.consent) out.push({ key: 'consent', label: CONSENT, value: 'Yes' });
          continue;
        }
        if (CONTACT_KEYS[qd.key] || qd.noAnswer) continue;
        var v = val(st, qd.key);
        var value;
        if (qd.type === 'chips') value = chipValue(qd, v);
        else if (qd.type === 'number') value = isNaN(intOf(v)) ? '' : String(intOf(v));
        else value = trim(v).slice(0, qd.max || 1000);
        if (isArr(value) ? value.length : value) out.push({ key: qd.key, label: qd.label, value: value });
        if (qd.key === 'vehicle_count' && partnerKind(st)) out.push({ key: PARTNER.key, label: PARTNER.label, value: PARTNER.value });
        if (qd.other && has(v, qd.other.when)) {
          var o = trim(val(st, qd.other.key)).slice(0, qd.other.max);
          if (o) out.push({ key: qd.other.key, label: qd.other.label, value: o });
        }
      }
    }
    return out;
  }

  function find(answers, key) {
    for (var i = 0; i < answers.length; i++) if (answers[i].key === key) return textOf(answers[i].value);
    return '';
  }

  // The four labelled lines the quote-check email reads (spec E and H.2). "Not given" is a value.
  var FOUR_KEYS = {
    demand: ['goods_type', 'goods_other', 'vehicle_types', 'frequency', 'service_type', 'dispatch_area', 'route_scope', 'routes_detail'],
    fleet: ['work_now', 'vehicle_count', 'vehicle_types', 'vehicle_other', 'base_area']
  };
  function fourLines(st, A) {
    var t = function (k) { return find(A, k); };
    if (st.flow === 'fleet') {
      var n = t('vehicle_count');
      return [
        'What they move: ' + (t('work_now') || 'Not given'),
        'Vehicles: ' + (n || 'Not given') + ' of their own (fleet owner): ' + (t('vehicle_types') || 'Not given') + (t('vehicle_other') ? ' - ' + t('vehicle_other') : ''),
        'Deliveries a week: Not asked (fleet enquiry)',
        'Routes: Based in ' + (t('base_area') || 'Not given')
      ];
    }
    return [
      'What they move: ' + (t('goods_type') || 'Not given') + (t('goods_other') ? ' - ' + t('goods_other') : ''),
      'Vehicles: ' + (t('vehicle_types') || 'Not given'),
      'Deliveries a week: ' + (t('frequency') || 'Not given') + (t('service_type') ? ' (' + t('service_type') + ')' : ''),
      'Routes: From ' + (t('dispatch_area') || 'Not given') + (t('route_scope') ? ' to ' + t('route_scope') : '') + (t('routes_detail') ? '; ' + t('routes_detail') : '')
    ];
  }

  function fridgeLine(st) {
    var f = val(st, 'has_refrigerated');
    if (st.flow !== 'fleet' || (f !== 'yes' && f !== 'no')) return '';
    return 'Do any of your vehicles have a fridge unit?: ' + (f === 'yes' ? 'Yes' : 'No');
  }

  // Four labelled lines, then the other answers as "Label: value" lines, then the visitor's own words.
  // Under the route's 2,000-character limit: the four lines and the typed text are kept whole; the
  // other lines (all of which are also in `answers`) give way first if space runs out.
  function buildMessage(st, A) {
    var head = fourLines(st, A).join('\n');
    var free = trim(val(st, 'message')).slice(0, 1000);
    var skip = {};
    var used = FOUR_KEYS[st.flow === 'fleet' ? 'fleet' : 'demand'];
    for (var i = 0; i < used.length; i++) skip[used[i]] = 1;
    skip.consent = 1;
    var others = [];
    for (var j = 0; j < A.length; j++) if (!skip[A[j].key]) others.push(A[j].label + ': ' + textOf(A[j].value));
    var fl = fridgeLine(st);
    if (fl) others.push(fl);
    var budget = 2000 - head.length - (free ? free.length + 2 : 0);
    var mid = '';
    for (var k = 0; k < others.length; k++) {
      var add = '\n' + others[k];
      if (mid.length + add.length > budget) break;
      mid += add;
    }
    return (head + mid + (free ? '\n\n' + free : '')).slice(0, 2000);
  }

  function sourceOf(st) {
    var a = st.attr || {};
    var tag = String(a.s || a.utm_campaign || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
    var prefix = st.page === 'business' ? 'business' : 'quote';
    return tag ? prefix + ':' + tag : prefix + '_page';
  }

  function buildPayload(st) {
    var fleet = st.flow === 'fleet';
    var A = collectAnswers(st);
    var p = {
      lead_type: fleet ? 'fleet' : 'corporate',
      company_name: trim(val(st, 'company_name')).replace(/\s+/g, ' ').slice(0, 200),
      contact_name: trim(val(st, 'contact_name')).slice(0, 120)
    };
    var email = trim(val(st, 'email'));
    if (email) p.email = email.slice(0, 254);
    var phone = phoneOut(val(st, 'phone'));
    if (phone) p.phone = phone;
    var industry = '';
    if (fleet) {
      var carried = find(A, 'work_now');
      if (carried) industry = 'Transport: ' + carried;
    } else {
      industry = find(A, 'goods_type');
    }
    if (industry) p.industry = industry.slice(0, 120);
    if (fleet) {
      var n = intOf(val(st, 'vehicle_count'));
      if (!isNaN(n)) p.vehicle_count = n;
      // Tri-state: sent only when answered. NULL means "not answered", never "no".
      var f = val(st, 'has_refrigerated');
      if (f === 'yes' || f === 'no') p.has_refrigerated = f === 'yes';
    }
    p.message = buildMessage(st, A);
    p.source = sourceOf(st);
    p.website = String(st.hp || '');
    p.form_version = VERSION[fleet ? 'fleet' : 'demand'];
    p.answers = A;
    p.attribution = st.attr || {};
    return p;
  }

  // The email/WhatsApp fallback text: the nine labels together, in the quote-check email's order,
  // then everything else. Subject is the one the quote check filters on.
  function mailText(p) {
    var lines = String(p.message || '').split('\n');
    var head = lines.slice(0, 4);
    var tail = lines.slice(4).join('\n').replace(/^\n+/, '');
    var body = ['Business: ' + p.company_name, 'Contact: ' + (p.contact_name || 'Not given'), 'Phone: ' + (p.phone || 'Not given'), 'Email: ' + (p.email || 'Not given')]
      .concat(head).concat(['Source: ' + p.source]).join('\n') + (tail ? '\n\n' + tail : '');
    return { subject: 'HALA MOVE quote request: ' + p.company_name, body: body };
  }

  root.HMLeadForm = { buildPayload: buildPayload, mailText: mailText, errorFor: errorFor, phoneOk: phoneOk,
    DEMAND: DEMAND, FLEET: FLEET, CONSENT: CONSENT, VERSION: VERSION };

  // ---------------------------------------------------------------------------------------------
  // The page: state, rendering, validation, sending.
  // ---------------------------------------------------------------------------------------------

  var doc = root.document;
  if (!doc || !doc.getElementById) return;
  var host = doc.getElementById('leadForm');
  if (!host) return;

  var H = host.getAttribute('data-heading') === '3' ? 3 : 2;
  var S = {
    page: host.getAttribute('data-page') === 'business' ? 'business' : 'quote',
    doors: host.getAttribute('data-doors') === '1',
    mailTo: host.getAttribute('data-mail-to') || 'contact@halamove.co.za',
    mailCc: host.getAttribute('data-mail-cc') || '',
    flow: 'demand',
    stepOf: { demand: 0, fleet: 0 },
    vals: { demand: {}, fleet: {} },
    contact: { company_name: '', contact_name: '', phone: '', email: '' },
    consent: { demand: false, fleet: false },
    flagged: { demand: {}, fleet: {} },
    ownerContinue: false,
    panel: false,
    sending: false,
    hp: '',
    attr: {}
  };

  function attrNow() {
    var A = root.HMAttribution;
    if (A && A.attribution) return A.attribution(root.location, doc.referrer);
    var p = String(root.location.pathname || '/').replace(/\.html$/, '');
    return { page: p };
  }
  S.attr = attrNow();

  function snap() {
    return { page: S.page, flow: S.flow === 'fleet' ? 'fleet' : 'demand', vals: S.vals[S.flow === 'fleet' ? 'fleet' : 'demand'],
      contact: S.contact, consent: !!S.consent[S.flow], ownerContinue: S.ownerContinue, attr: S.attr, hp: S.hp };
  }
  function getV(key) { return CONTACT_KEYS[key] ? S.contact[key] : S.vals[S.flow][key]; }
  function setV(key, v) { if (CONTACT_KEYS[key]) S.contact[key] = v; else S.vals[S.flow][key] = v; }
  function byId(x) { return doc.getElementById(x); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fid(key) { return 'lf-' + key; }
  function hide(el, on) { if (!el) return; if (on) el.setAttribute('hidden', ''); else el.removeAttribute('hidden'); }
  function waLink(text) { return 'https://wa.me/' + WA_NUMBER + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function waShown() { return '<a href="' + waLink('') + '" target="_blank" rel="noopener">' + WA_SHOWN + '</a>'; }
  function hTag(level, attrs, inner) { return '<h' + level + ' ' + attrs + '>' + inner + '</h' + level + '>'; }

  // A question that must be answered carries a red asterisk; one that may be skipped says "(optional)" (2026-11-10:
  // "Mandatory fields should have an asterisk in red", the same mark as the apps' RequiredMark). The star is hidden
  // from screen readers and "(required)" is read instead, so a chip legend and a text label say it the same way.
  // Every question without `optional` carries a `req` message, so the star never promises a check that is not made
  // (verify-required-marks.cjs holds both).
  var REQ = '<span class="lf-req" aria-hidden="true"> *</span><span class="lf-vh"> (required)</span>';
  function label(qd) { return esc(qd.label) + (qd.optional ? ' <span class="lf-opt">(optional)</span>' : REQ); }

  function qHtml(qd, st) {
    var k = qd.key;
    var hidden = visible(qd, st) ? '' : ' hidden';
    var hint = qd.hint ? '<div class="lf-hint" id="' + fid(k) + '-hint">' + esc(qd.hint) + '</div>' : '';
    var err = '<div class="lf-error" id="' + fid(k) + '-err" hidden></div>';
    var desc = (qd.hint ? fid(k) + '-hint ' : '') + fid(k) + '-err';
    var v = qd.type === 'consent' ? st.consent : val(st, k);
    var h, i;

    if (qd.type === 'chips') {
      h = '<fieldset class="lf-q" id="' + fid(k) + '-q" data-q="' + k + '"' + hidden + '>' +
        '<legend class="lf-label">' + label(qd) + '</legend>' + hint + err +
        '<div class="lf-chips' + (qd.wide ? ' lf-chips-wide' : '') + '">';
      for (i = 0; i < qd.options.length; i++) {
        var o = qd.options[i];
        var on = qd.multi ? has(v, o[0]) : v === o[0];
        h += '<label class="lf-chip"><input type="' + (qd.multi ? 'checkbox' : 'radio') + '" name="' + fid(k) + '" value="' + esc(o[0]) +
          '" data-key="' + k + '" aria-describedby="' + desc + '"' + (on ? ' checked' : '') + '>' +
          '<span class="lf-chip-box"><span class="lf-chip-t">' + esc(o[1]) + '</span>' +
          (o[2] ? '<span class="lf-chip-d">' + esc(o[2]) + '</span>' : '') + '</span></label>';
      }
      h += '</div>';
      if (qd.notes) {
        for (i = 0; i < qd.notes.length; i++) {
          h += '<div class="lf-note" id="' + fid(k) + '-note' + i + '"' + (anyOf(v, qd.notes[i].when) ? '' : ' hidden') + '>' + esc(qd.notes[i].text) + '</div>';
        }
      }
      if (qd.other) {
        var ok = qd.other.key;
        h += '<div class="lf-reveal" id="' + fid(ok) + '-wrap"' + (has(v, qd.other.when) ? '' : ' hidden') + '>' +
          '<label class="lf-label lf-sub" for="' + fid(ok) + '">' + esc(qd.other.label) + ' <span class="lf-opt">(optional)</span></label>' +
          '<input type="text" id="' + fid(ok) + '" name="' + ok + '" data-key="' + ok + '" maxlength="' + qd.other.max + '" value="' + esc(val(st, ok) || '') + '"></div>';
      }
      return h + '</fieldset>';
    }

    if (qd.type === 'consent') {
      var sentence = esc(CONSENT).replace('privacy policy', '<a href="/privacy" target="_blank" rel="noopener">privacy policy</a>');
      return '<div class="lf-q" id="' + fid(k) + '-q" data-q="' + k + '">' + err +
        '<label class="lf-consent"><input type="checkbox" id="' + fid(k) + '" name="consent" data-key="' + k + '" aria-describedby="' + fid(k) + '-err"' + (v ? ' checked' : '') + '>' +
        '<span>' + sentence + REQ + '</span></label></div>';
    }

    var attrs = ' id="' + fid(k) + '" name="' + k + '" data-key="' + k + '" aria-describedby="' + desc + '"' +
      (qd.max ? ' maxlength="' + qd.max + '"' : '') +
      (qd.placeholder ? ' placeholder="' + esc(qd.placeholder) + '"' : '') +
      (qd.autocomplete ? ' autocomplete="' + qd.autocomplete + '"' : '');
    var field;
    if (qd.type === 'textarea') {
      field = '<textarea rows="4"' + attrs + '>' + esc(v || '') + '</textarea>';
    } else {
      var type = 'text', extra = '';
      if (qd.type === 'tel') { type = 'tel'; extra = ' inputmode="tel" autocomplete="tel"'; }
      else if (qd.type === 'email') { type = 'email'; extra = ' autocomplete="email" spellcheck="false" autocapitalize="off"'; }
      else if (qd.type === 'number') { type = 'number'; extra = ' inputmode="numeric" min="1" max="10000" step="1"'; }
      else if (qd.inputmode) { extra = ' inputmode="' + qd.inputmode + '" autocapitalize="off" spellcheck="false"'; }
      field = '<input type="' + type + '"' + attrs + extra + ' value="' + esc(v || '') + '">';
    }
    return '<div class="lf-q" id="' + fid(k) + '-q" data-q="' + k + '">' +
      '<label class="lf-label" for="' + fid(k) + '">' + label(qd) + '</label>' + hint + err + field + '</div>';
  }

  function doorsHtml() {
    var doors = [
      ['demand', 'I need things moved', 'Deliveries, stock runs, site supply.'],
      ['fleet', 'I run vehicles and want work', 'Two or more vehicles.'],
      ['driver', 'I have one vehicle and want to drive', 'Get the driver app.']
    ];
    var h = '<fieldset class="lf-doors" id="lf-doors"><legend class="lf-label lf-doors-legend">What brings you here?</legend><div class="lf-door-grid">';
    for (var i = 0; i < doors.length; i++) {
      h += '<label class="lf-door"><input type="radio" name="lf-door" value="' + doors[i][0] + '"' + (S.flow === doors[i][0] ? ' checked' : '') + '>' +
        '<span class="lf-door-box"><span class="lf-door-t">' + esc(doors[i][1]) + '</span><span class="lf-door-d">' + esc(doors[i][2]) + '</span></span></label>';
    }
    return h + '</div></fieldset>';
  }

  function panelHtml() {
    return '<div class="lf-card lf-panel">' +
      hTag(H, 'class="lf-title" id="lf-focus" tabindex="-1"', 'One vehicle? Start in the HALA MOVE Driver app.') +
      '<div class="lf-text">With one vehicle, work on HALA MOVE comes to you through the HALA MOVE Driver app. Register, upload your documents and, once you are verified (typically within 24 hours), you see jobs near you and set your own price on every job.</div>' +
      '<div class="lf-actions"><a class="lf-btn" href="/drive?s=web-1veh">Get the HALA MOVE Driver app</a></div>' +
      '<div class="lf-hint">Search "HALA Move Driver" on Google Play or the App Store.</div>' +
      '<div class="lf-text lf-gap">Run a one-vehicle transport business and want regular contract work as well?</div>' +
      '<div class="lf-actions"><button type="button" class="lf-btn lf-btn-ghost" data-act="owner-continue">Continue to the form</button></div>' +
      '</div>';
  }

  function formHtml() {
    var flow = S.flow, st = snap(), steps = stepsOf(flow), n = S.stepOf[flow], step = steps[n], last = n === steps.length - 1;
    var h = '<form class="lf-card" id="lf-form" novalidate>' +
      hTag(H, 'class="lf-title"', esc(COPY[flow].title)) +
      '<div class="lf-intro">' + esc(COPY[flow].intro) + '</div>' +
      '<div class="lf-progress">Step ' + (n + 1) + ' of ' + steps.length + '</div>' +
      hTag(H + 1, 'class="lf-step-title" id="lf-focus" tabindex="-1"', esc(step.title)) +
      '<div class="lf-key" aria-hidden="true">Questions marked <span class="lf-req">*</span> need an answer.</div>' +
      '<div class="lf-summary" id="lf-summary" role="alert" tabindex="-1" hidden></div>';
    for (var i = 0; i < step.qs.length; i++) h += qHtml(step.qs[i], st);
    h += '<div class="lf-hp" aria-hidden="true"><label for="lf-website">Leave this empty</label>' +
      '<input type="text" id="lf-website" name="website" tabindex="-1" autocomplete="off" value="' + esc(S.hp) + '"></div>';
    h += '<div class="lf-actions">' +
      (n > 0 ? '<button type="button" class="lf-btn lf-btn-ghost lf-back" data-act="back">Back</button>' : '') +
      '<button type="submit" class="lf-btn" id="lf-next">' + (last ? esc(COPY[flow].submit) : 'Continue') + '</button></div>' +
      '<div class="lf-fail" id="lf-fail" hidden></div></form>';
    return h;
  }

  function renderBody(focus) {
    var body = byId('lf-body');
    if (!body) return;
    body.innerHTML = (S.flow === 'driver' || S.panel) ? panelHtml() : formHtml();
    if (focus) {
      var f = byId('lf-focus');
      if (f) {
        try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
        var r = body.getBoundingClientRect();
        if (r.top < 0 || r.top > (root.innerHeight || 800)) { try { body.scrollIntoView(true); } catch (e2) {} }
      }
    }
  }

  function currentQs() { return stepsOf(S.flow)[S.stepOf[S.flow]].qs; }
  function qByKey(key) { var qs = currentQs(); for (var i = 0; i < qs.length; i++) if (qs[i].key === key) return qs[i]; return null; }

  function refresh() {
    var st = snap(), qs = currentQs();
    for (var i = 0; i < qs.length; i++) {
      var qd = qs[i], v = val(st, qd.key);
      if (qd.showIf) hide(byId(fid(qd.key) + '-q'), !visible(qd, st));
      if (qd.notes) for (var j = 0; j < qd.notes.length; j++) hide(byId(fid(qd.key) + '-note' + j), !anyOf(v, qd.notes[j].when));
      if (qd.other) hide(byId(fid(qd.other.key) + '-wrap'), !has(v, qd.other.when));
    }
  }

  function badInputOf(qd) {
    var el = byId(fid(qd.key));
    return !!(qd.type === 'number' && el && el.validity && el.validity.badInput);
  }

  function showError(qd, msg) {
    var box = byId(fid(qd.key) + '-q'), err = byId(fid(qd.key) + '-err');
    if (!box || !err) return;
    if (msg) {
      err.innerHTML = '<span class="lf-vh">Error: </span>' + esc(msg);
      hide(err, false);
      box.className = box.className.replace(/\s*lf-invalid/g, '') + ' lf-invalid';
    } else {
      err.innerHTML = '';
      hide(err, true);
      box.className = box.className.replace(/\s*lf-invalid/g, '');
    }
    var inputs = box.querySelectorAll('input[data-key="' + qd.key + '"],textarea[data-key="' + qd.key + '"]');
    for (var i = 0; i < inputs.length; i++) {
      if (msg) inputs[i].setAttribute('aria-invalid', 'true'); else inputs[i].removeAttribute('aria-invalid');
    }
    S.flagged[S.flow][qd.key] = !!msg;
  }

  function check(qd) { var msg = errorFor(qd, snap(), badInputOf(qd)); showError(qd, msg); return msg; }

  function summaryText(n) { return n === 1 ? 'Check 1 answer on this step.' : 'Check ' + n + ' answers on this step.'; }

  function updateSummary() {
    var sum = byId('lf-summary');
    if (!sum || sum.hasAttribute('hidden') || sum.getAttribute('data-server') === '1') return;
    var qs = currentQs(), st = snap(), n = 0;
    for (var i = 0; i < qs.length; i++) if (visible(qs[i], st) && S.flagged[S.flow][qs[i].key]) n++;
    if (n) sum.textContent = summaryText(n); else hide(sum, true);
  }

  function focusQ(qd) {
    var box = byId(fid(qd.key) + '-q');
    var el = box && box.querySelector('input[data-key="' + qd.key + '"],textarea[data-key="' + qd.key + '"]');
    if (el) el.focus();
  }

  function validateStep() {
    var qs = currentQs(), st = snap(), bad = [];
    for (var i = 0; i < qs.length; i++) {
      if (!visible(qs[i], st)) { showError(qs[i], ''); continue; }
      if (check(qs[i])) bad.push(qs[i]);
    }
    var sum = byId('lf-summary');
    if (sum) {
      sum.removeAttribute('data-server');
      if (bad.length) { sum.textContent = summaryText(bad.length); hide(sum, false); } else hide(sum, true);
    }
    if (bad.length) focusQ(bad[0]);
    return bad.length === 0;
  }

  function showPanel() { S.panel = true; renderBody(true); }

  function next() {
    if (S.sending) return;
    var steps = stepsOf(S.flow), n = S.stepOf[S.flow];
    if (!validateStep()) return;
    // Spec B.2 F1: one vehicle is an owner-driver. Show him the Driver app before he types a lead.
    if (S.flow === 'fleet' && n === 0 && !S.ownerContinue && intOf(getV('vehicle_count')) === 1) { showPanel(); return; }
    if (n < steps.length - 1) { S.stepOf[S.flow] = n + 1; renderBody(true); return; }
    send();
  }

  function back() {
    if (S.sending) return;
    var n = S.stepOf[S.flow];
    if (n > 0) { S.stepOf[S.flow] = n - 1; renderBody(true); }
  }

  function firstName() { return trim(S.contact.contact_name).split(/\s+/)[0] || ''; }

  function doneHtml(p) {
    var name = firstName();
    var way = getV('preferred_contact');
    var phone = esc(trim(S.contact.phone)), email = esc(trim(S.contact.email));
    var fleet = S.flow === 'fleet';
    var purpose = fleet ? 'to set up your fleet account with you.' : 'to talk through a plan for your deliveries.';
    var reach;
    if (way === 'email' && email) reach = 'We will email you at ' + email + ' ' + PROMISE + ' ' + purpose + ' If that address is wrong, WhatsApp us on ' + waShown() + '.';
    else if (way === 'whatsapp') reach = 'We will WhatsApp you on ' + phone + ' ' + PROMISE + ' ' + purpose + ' If that number is wrong, WhatsApp us on ' + waShown() + '.';
    else reach = 'We will call you on ' + phone + ' ' + PROMISE + ' ' + purpose + ' If that number is wrong, WhatsApp us on ' + waShown() + '.';
    var h = '<div class="lf-card lf-done">' +
      hTag(H, 'class="lf-title" id="lf-focus" tabindex="-1"', 'Thank you' + (name ? ', ' + esc(name) : '') + '. ' + (fleet ? 'We have your details.' : 'We have your request.')) +
      '<div class="lf-text">' + reach + '</div>';
    if (!fleet) {
      h += '<div class="lf-text">Something to move before then? Post it in the HALA MOVE app and choose from offers by verified drivers.</div>' +
        '<div class="lf-actions"><a class="lf-btn" href="/get?s=web-done">Get the HALA MOVE app</a></div>';
    } else if (getV('drivers') === 'me' || partnerKind(snap())) {
      h += '<div class="lf-text">You need the HALA MOVE Driver app and a verified profile before you can take jobs. Drivers are typically verified within 24 hours, so you can start now.</div>' +
        '<div class="lf-actions"><a class="lf-btn" href="/drive?s=web-fleet">Get the HALA MOVE Driver app</a></div>';
    } else {
      h += '<div class="lf-text">Each of your drivers needs the HALA MOVE Driver app and a verified profile before they can take jobs. Drivers are typically verified within 24 hours, so they can start now.</div>' +
        '<div class="lf-actions"><a class="lf-btn" href="https://wa.me/?text=' + encodeURIComponent(FLEET_SHARE) + '" target="_blank" rel="noopener">Send my drivers the app link</a></div>';
    }
    return h + '</div>';
  }

  function failHtml(p) {
    var m = mailText(p);
    var mailto = 'mailto:' + S.mailTo + '?' + (S.mailCc ? 'cc=' + encodeURIComponent(S.mailCc) + '&' : '') +
      'subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body);
    return '<div class="lf-text"><strong>We could not send your request. Your answers are still here. Try again, or WhatsApp us on ' + waShown() + '.</strong></div>' +
      '<div class="lf-actions">' +
      '<a class="lf-btn lf-btn-ghost" href="' + esc(mailto) + '">Email it to us</a>' +
      '<button type="button" class="lf-btn lf-btn-ghost" data-act="copy">Copy request</button>' +
      '<a class="lf-btn lf-btn-ghost" href="' + esc(waLink(m.subject + '\n\n' + m.body)) + '" target="_blank" rel="noopener">WhatsApp it to us</a>' +
      '</div><pre class="lf-pre" id="lf-pre">' + esc(m.subject + '\n\n' + m.body) + '</pre>';
  }

  function setSending(on) {
    S.sending = on;
    var btn = byId('lf-next');
    if (btn) { btn.disabled = on; btn.textContent = on ? 'Sending...' : COPY[S.flow].submit; }
  }

  function post(payload, done) {
    var x, finished = false;
    function end(status, body) { if (finished) return; finished = true; done(status, body); }
    try { x = new root.XMLHttpRequest(); } catch (e) { end(0, null); return; }
    try {
      x.open('POST', API, true);
      x.setRequestHeader('Content-Type', 'application/json');
      x.timeout = 20000;
    } catch (e2) { end(0, null); return; }
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var j = null;
      try { j = JSON.parse(x.responseText); } catch (e3) { j = null; }
      end(x.status, j);
    };
    x.ontimeout = function () { end(0, null); };
    x.onerror = function () { end(0, null); };
    try { x.send(JSON.stringify(payload)); } catch (e4) { end(0, null); }
  }

  function send() {
    S.attr = attrNow();
    var payload = buildPayload(snap());
    var fail = byId('lf-fail');
    hide(fail, true);
    setSending(true);
    post(payload, function (status, j) {
      if (status >= 200 && status < 300) {
        var doors = byId('lf-doors');
        hide(doors, true);
        byId('lf-body').innerHTML = doneHtml(payload);
        var f = byId('lf-focus');
        if (f) { f.focus(); try { byId('lf-body').scrollIntoView(true); } catch (e) {} }
        return;
      }
      setSending(false);
      // A 400 is something the visitor can fix, and the server's own message names the field.
      if (status === 400 && j && j.error) {
        var sum = byId('lf-summary');
        if (sum) { sum.textContent = String(j.error); sum.setAttribute('data-server', '1'); hide(sum, false); sum.focus(); }
        return;
      }
      // Anything else: keep every answer, re-enable the button, and give three ways to reach us.
      if (fail) { fail.innerHTML = failHtml(payload); hide(fail, false); fail.setAttribute('role', 'alert'); }
    });
  }

  function copyRequest(btn) {
    var pre = byId('lf-pre');
    if (!pre) return;
    var text = pre.textContent;
    function select() {
      try {
        var r = doc.createRange(); r.selectNodeContents(pre);
        var g = root.getSelection(); g.removeAllRanges(); g.addRange(r);
        btn.textContent = 'Selected, now copy it';
      } catch (e) {}
    }
    try {
      if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(text).then(function () { btn.textContent = 'Copied'; }, select);
        return;
      }
    } catch (e) {}
    select();
  }

  function chooseDoor(flow) {
    if (S.sending) return;
    S.flow = flow;
    S.panel = false;
    renderBody(false);
  }

  function ownerContinue() {
    S.ownerContinue = true;
    S.panel = false;
    if (S.flow === 'driver') {
      S.flow = 'fleet';
      if (!trim(S.vals.fleet.vehicle_count)) S.vals.fleet.vehicle_count = '1';
      var r = doc.querySelector('#lf-doors input[value="fleet"]');
      if (r) r.checked = true;
    }
    renderBody(true);
  }

  // ---------------------------------------------------------------------------------------------
  // Mount and events (delegated, so a re-rendered step needs no re-binding).
  // ---------------------------------------------------------------------------------------------

  var t = (function () { var m = /[?&]t=([^&#]*)/.exec(root.location.search || ''); return m ? m[1].toLowerCase() : ''; })();
  if (S.doors && t === 'fleet') S.flow = 'fleet';

  host.innerHTML = '<div class="lf">' + (S.doors ? doorsHtml() : '') + '<div class="lf-body" id="lf-body"></div></div>';
  renderBody(false);

  host.addEventListener('change', function (e) {
    var el = e.target;
    if (el.name === 'lf-door') { chooseDoor(el.value); return; }
    var key = el.getAttribute('data-key');
    if (!key) return;
    if (key === 'consent') { S.consent[S.flow] = !!el.checked; }
    else if (el.type === 'checkbox') {
      var qd = qByKey(key);
      if (qd && qd.exclusive) {
        var all = host.querySelectorAll('input[data-key="' + key + '"]');
        for (var i = 0; i < all.length; i++) {
          if (el.checked && el.value === qd.exclusive && all[i] !== el) all[i].checked = false;
          if (el.checked && el.value !== qd.exclusive && all[i].value === qd.exclusive) all[i].checked = false;
        }
      }
      var picked = [], boxes = host.querySelectorAll('input[data-key="' + key + '"]');
      for (var j = 0; j < boxes.length; j++) if (boxes[j].checked) picked.push(boxes[j].value);
      setV(key, picked);
    } else if (el.type === 'radio') {
      setV(key, el.value);
    } else {
      return;   // text fields are handled on input
    }
    refresh();
    var q = key === 'consent' ? CONSENT_Q : qByKey(key);
    if (q && S.flagged[S.flow][key]) { check(q); updateSummary(); }
  });

  host.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'lf-website') { S.hp = el.value; return; }
    var key = el.getAttribute('data-key');
    if (!key || el.type === 'checkbox' || el.type === 'radio') return;
    setV(key, el.value);
    var qd = qByKey(key);
    // An error clears the moment the answer becomes valid; it never appears while typing.
    if (qd && S.flagged[S.flow][key] && !errorFor(qd, snap(), badInputOf(qd))) { showError(qd, ''); updateSummary(); }
  });

  // Shown when the person leaves a field (spec C.6), but not for a field left empty and never flagged:
  // tabbing past a question is not an error until Continue.
  host.addEventListener('blur', function (e) {
    var el = e.target;
    var key = el && el.getAttribute && el.getAttribute('data-key');
    if (!key || el.type === 'checkbox' || el.type === 'radio') return;
    var qd = qByKey(key);
    if (!qd) return;
    if (trim(el.value) || S.flagged[S.flow][key] || badInputOf(qd)) { check(qd); updateSummary(); }
    // F1 gate, checked on leaving the field and never while typing: "12" passes through "1".
    if (key === 'vehicle_count' && S.flow === 'fleet' && !S.ownerContinue && intOf(el.value) === 1) showPanel();
  }, true);

  host.addEventListener('submit', function (e) { e.preventDefault(); next(); });

  host.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== host && !(el.getAttribute && el.getAttribute('data-act'))) el = el.parentNode;
    if (!el || el === host) return;
    var act = el.getAttribute('data-act');
    if (act === 'back') back();
    else if (act === 'owner-continue') ownerContinue();
    else if (act === 'copy') copyRequest(el);
  });
})(typeof window !== 'undefined' ? window : this);
