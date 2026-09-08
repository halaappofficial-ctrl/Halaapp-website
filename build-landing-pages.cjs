// One-shot builder: reads bakkie-hire-durban.html and emits two new landing pages.
// Replaces content only. Keeps CSS, nav, footer, JS identical to the template.
//
// ══ RETIRED 2026-09-08 - IT RAN ONCE, IN APRIL, AND ITS OUTPUT HAS MOVED ON WITHOUT IT ═══════
//
// This script is a LOADED GUN and the safety is below. It is kept, not deleted, because it is the
// record of how these two pages were made - but running it today would overwrite five months of
// corrections with April's content. Its own header says "one-shot"; it fired.
//
// [SRC read 2026-09-08] It was last touched 2026-04-14. business-transport-durban.html was last
// corrected 2026-09-04. Nothing in this repo invokes it - no npm script (there is no package.json),
// no CI, no other file references it. So it has no job left to do, and everything it would do now
// is damage:
//
//   28 dead-domain URLs. It still emits canonical / og:url / JSON-LD @id on halaapp.co.za, the
//   domain dropped 2026-04-20. Both pages are correct today (0 hits) and this would revert them.
//
//   AND IT WOULD RESURRECT CLAIMS WE RETRACTED FOR BEING FALSE - which is far worse than a wrong
//   URL. Commit 858ba97 (2026-08-17, "align the business page with what the code actually does")
//   removed eight promises after checking each against source. This file still carries them:
//     "8-tonne" x6            - there is no 8-ton; five vehicle types topping out at truck_4ton
//     "JSE" x7                - we produce CO2 data. We certify nothing
//     "consolidated monthly" x9 - no billing path exists
//     "insurance on file" x1  - not in the verification stack
//   Running this would put those back on a live, indexed page selling at R5,000/month.
//
// THE EXPIRY CONDITION, written next to the workaround so nobody has to guess: if these landing
// pages ever need regenerating from the template again, this file must FIRST be brought level with
// the current pages - domain, claims and all - and then the override below removed in the same
// commit. Until then it fails closed. `node verify-landing-pages.cjs` is what actually grades the
// pages now, and it is kept current.
if (process.env.HALA_ALLOW_STALE_LANDING_BUILD !== '1') {
  console.error([
    '',
    'REFUSING TO RUN - this builder is stale and would damage the live pages.',
    '',
    '  It last changed 2026-04-14; the pages it writes were corrected as recently as 2026-09-04.',
    '  Running it would emit 28 halaapp.co.za URLs (domain dropped 2026-04-20) AND restore the',
    '  false claims removed in 858ba97: 8-tonne trucks, JSE-ready reporting, consolidated monthly',
    '  invoicing, insurance on file. None of those are things this platform has.',
    '',
    '  If you genuinely need to regenerate, update THIS file to match the current pages first,',
    '  then re-run with HALA_ALLOW_STALE_LANDING_BUILD=1 and diff the output before committing.',
    '',
  ].join('\n'));
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'bakkie-hire-durban.html');
const src = fs.readFileSync(TEMPLATE, 'utf8');

// ── Region markers (must be unique in the template) ─────────
const HEAD_SCHEMA_START = '<!-- Schema.org — Service + FAQPage + BreadcrumbList + WebPage -->';
const HEAD_SCHEMA_END   = '</script>';
const CONTENT_START     = '<div class="page-hero">';
const CONTENT_END       = '<!-- FOOTER -->';

function sliceOnce(s, start, end) {
  const i = s.indexOf(start);
  const j = s.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error('marker missing: ' + start + ' / ' + end);
  return { before: s.slice(0, i), after: s.slice(j), startMarker: start, endMarker: end, i, j };
}

// Simple multi-pass string replace with logging
function buildPage(cfg) {
  let out = src;
  const log = [];

  function rep(label, oldStr, newStr) {
    if (out.includes(oldStr)) {
      out = out.replace(oldStr, newStr);
      log.push('OK:' + label);
    } else {
      log.push('MISS:' + label);
    }
  }

  // ── 1. <title> and meta ────────────────────────────────────
  rep('title',
    '<title>Bakkie Hire Durban | Verified Drivers, Same-Day | HALA MOVE</title>',
    '<title>' + cfg.title + '</title>'
  );
  rep('meta-desc',
    '<meta name="description" content="Bakkie hire in Durban from R150. Verified drivers, live GPS tracking, PayFast escrow, same-day delivery. Post a job in 60 seconds — real-time bidding.">',
    '<meta name="description" content="' + cfg.metaDesc + '">'
  );
  rep('meta-keywords',
    '<meta name="keywords" content="bakkie hire Durban, bakkie for hire Durban, bakkie rental Durban, 1 ton bakkie hire, same day bakkie Durban, furniture bakkie Durban, HALA MOVE">',
    '<meta name="keywords" content="' + cfg.keywords + '">'
  );
  rep('canonical',
    '<link rel="canonical" href="https://www.halaapp.co.za/bakkie-hire-durban">',
    '<link rel="canonical" href="https://www.halaapp.co.za/' + cfg.slug + '">'
  );

  // OG tags
  rep('og-url',
    '<meta property="og:url" content="https://www.halaapp.co.za/bakkie-hire-durban">',
    '<meta property="og:url" content="https://www.halaapp.co.za/' + cfg.slug + '">'
  );
  rep('og-title',
    '<meta property="og:title" content="Bakkie Hire Durban — Verified Drivers, Same-Day | HALA MOVE">',
    '<meta property="og:title" content="' + cfg.ogTitle + '">'
  );
  rep('og-desc',
    '<meta property="og:description" content="Bakkie hire in Durban from R150. Verified drivers, live GPS tracking, PayFast escrow. Real-time bidding. Post a job in 60 seconds.">',
    '<meta property="og:description" content="' + cfg.ogDesc + '">'
  );
  rep('og-image-alt',
    '<meta property="og:image:alt" content="HALA MOVE — Bakkie Hire Durban">',
    '<meta property="og:image:alt" content="' + cfg.ogImageAlt + '">'
  );

  // Twitter
  rep('twitter-title',
    '<meta name="twitter:title" content="Bakkie Hire Durban — Verified Drivers, Same-Day">',
    '<meta name="twitter:title" content="' + cfg.twitterTitle + '">'
  );
  rep('twitter-desc',
    '<meta name="twitter:description" content="Bakkie hire in Durban from R150. Verified drivers, live GPS, PayFast escrow. Real-time bidding.">',
    '<meta name="twitter:description" content="' + cfg.twitterDesc + '">'
  );
  rep('twitter-image-alt',
    '<meta name="twitter:image:alt" content="HALA MOVE — Bakkie Hire Durban">',
    '<meta name="twitter:image:alt" content="' + cfg.ogImageAlt + '">'
  );

  // ── 2. Replace entire schema JSON block ────────────────────
  const schemaStart = HEAD_SCHEMA_START;
  const schemaEnd   = HEAD_SCHEMA_END;
  const si = out.indexOf(schemaStart);
  const ei = out.indexOf(schemaEnd, si);
  if (si < 0 || ei < 0) {
    log.push('MISS:schema-region');
  } else {
    const newSchema =
      schemaStart + '\n' +
      '<script type="application/ld+json">\n' +
      JSON.stringify(cfg.schema, null, 2) + '\n' +
      schemaEnd;
    out = out.slice(0, si) + newSchema + out.slice(ei + schemaEnd.length);
    log.push('OK:schema-region');
  }

  // ── 3. Replace entire page-hero + page-body content block ──
  const ci = out.indexOf(CONTENT_START);
  const ej = out.indexOf(CONTENT_END, ci);
  if (ci < 0 || ej < 0) {
    log.push('MISS:content-region');
  } else {
    out = out.slice(0, ci) + cfg.contentBlock + '\n\n' + out.slice(ej);
    log.push('OK:content-region');
  }

  // ── 4. Write ───────────────────────────────────────────────
  const outPath = path.join(ROOT, cfg.slug + '.html');
  fs.writeFileSync(outPath, out, 'utf8');
  return { outPath, log, lines: out.split('\n').length };
}

// ═══════════════════════════════════════════════════════════
// PAGE 1: student-moving-durban
// ═══════════════════════════════════════════════════════════
const studentSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.halaapp.co.za/student-moving-durban#webpage",
      "url": "https://www.halaapp.co.za/student-moving-durban",
      "name": "Student Moving Durban — HALA MOVE",
      "description": "Student moving in Durban from R150. Verified drivers, live GPS, PayFast escrow. UKZN, DUT, MUT, Mancosa and Varsity College. Book in 60 seconds.",
      "inLanguage": "en-ZA",
      "isPartOf": { "@id": "https://www.halaapp.co.za/#website" },
      "about": { "@id": "https://www.halaapp.co.za/#organization" },
      "primaryImageOfPage": "https://www.halaapp.co.za/og-image.svg",
      "dateModified": "2026-04-14"
    },
    {
      "@type": "Service",
      "@id": "https://www.halaapp.co.za/student-moving-durban#service",
      "serviceType": "Student Moving",
      "name": "Student Moving Durban",
      "description": "On-demand student moving with verified drivers across Durban and KwaZulu-Natal. UKZN, DUT, MUT, Mancosa, Varsity College. Same-day booking, live GPS tracking, PayFast escrow.",
      "provider": {
        "@type": "Organization",
        "name": "HALA MOVE (Pty) Ltd",
        "url": "https://www.halaapp.co.za/"
      },
      "areaServed": [
        { "@type": "City", "name": "Durban" },
        { "@type": "AdministrativeArea", "name": "KwaZulu-Natal" }
      ],
      "offers": {
        "@type": "Offer",
        "priceCurrency": "ZAR",
        "price": "150",
        "priceSpecification": {
          "@type": "PriceSpecification",
          "priceCurrency": "ZAR",
          "minPrice": "150",
          "description": "Platform base price from R150. Final price set by live driver bids."
        }
      },
      "availableChannel": {
        "@type": "ServiceChannel",
        "serviceUrl": "https://www.halaapp.co.za/",
        "serviceLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Durban",
            "addressRegion": "KwaZulu-Natal",
            "addressCountry": "ZA"
          }
        }
      }
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.halaapp.co.za/student-moving-durban#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How much does student moving in Durban cost with HALA MOVE?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "HALA MOVE student moving in Durban starts at a R150 platform base price. Final price is set by live driver bidding. Most single-room res moves settle between R150 and R350, and a two-bedroom flat move typically lands between R450 and R900 depending on distance, helpers, and time of day."
          }
        },
        {
          "@type": "Question",
          "name": "Can I book a bakkie during UKZN or DUT registration week?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Registration week is the busiest period for student moves in Durban. Post your job on HALA MOVE and nearby verified drivers will bid in real time. Booking a day or two ahead during peak weeks is smart, but same-day jobs are dispatched every day during registration."
          }
        },
        {
          "@type": "Question",
          "name": "Do HALA MOVE drivers help carry boxes up to the residence room?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Some drivers offer load-and-unload help and factor helpers into their bid. Mention in your job description that you need help carrying boxes, beds, or fridges up flights of stairs, and drivers who can assist will bid accordingly. For heavier moves you can request a driver bringing a helper."
          }
        },
        {
          "@type": "Question",
          "name": "Can my parents track the driver while I am moving?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Once you accept a bid, HALA MOVE shows the driver's live GPS position on a map inside the app. You can share the live route with a parent or guardian so they can follow the trip from pickup to drop-off. Every driver is SA ID-verified before they see a single job."
          }
        },
        {
          "@type": "Question",
          "name": "Can I book a move from King Shaka Airport to my campus?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. HALA MOVE handles luggage runs from King Shaka International Airport to UKZN Westville, UKZN Howard College, UKZN Pietermaritzburg, DUT Steve Biko and ML Sultan, MUT, Mancosa, and Varsity College. Post the job the moment you land — verified drivers nearby bid within minutes."
          }
        },
        {
          "@type": "Question",
          "name": "What size vehicle do I need for a single res room vs a two-bedroom flat?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "A single res room or digs room typically fits in a one-ton bakkie. A two-bedroom flat or shared house-move usually needs a panel van or H100 for the extra cargo space. HALA MOVE Smart Quote recommends the right vehicle type for your load and shows a fair price range before drivers bid."
          }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.halaapp.co.za/" },
        { "@type": "ListItem", "position": 2, "name": "Student Moving Durban", "item": "https://www.halaapp.co.za/student-moving-durban" }
      ]
    }
  ]
};

const studentContent = `<div class="page-hero">
 <div class="container">
  <div class="page-hero-eyebrow">Services &middot; Durban</div>
  <h1 class="page-title">Student Moving in Durban</h1>
  <p style="font-size:1rem;color:var(--t2);max-width:640px;line-height:1.75">Moving into res, out of res, into a new flat, or home for the holidays? Post your job in 60 seconds &mdash; verified drivers bid in real time, and parents can follow the trip on a live GPS map. UKZN, DUT, MUT, Mancosa, Varsity College &mdash; every Durban campus, every residence, from R150.</p>
  <div class="page-meta">
   <span><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#666" stroke-width="1.2"/><path d="M6.5 3.5v3l2 1.5" stroke="#666" stroke-width="1.2" stroke-linecap="round"/></svg> Durban, KwaZulu-Natal &middot; Launching 2026</span>
   <span><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1L8 5h4l-3.5 2.5 1.5 4L6.5 9 3 11.5l1.5-4L1 5h4z" stroke="#666" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg> Verified drivers &middot; Live GPS &middot; PayFast escrow</span>
  </div>
 </div>
</div>
<section class="page-body">
 <div class="container">
  <div class="content-grid">
   <div class="toc"><h4>On this page</h4>
   <a href="#how-it-works">How student moving works</a>
   <a href="#why-hala">Why HALA MOVE for students</a>
   <a href="#pricing">Pricing</a>
   <a href="#campuses">Campuses &amp; residences</a>
   <a href="#loads">What we move</a>
   <a href="#faq">FAQ</a>
   <a href="#download">Get the app</a>
  </div>
   <div class="prose">
<h2 class="section-anchor" id="how-it-works">How student moving works on HALA MOVE</h2>
<p>HALA MOVE is Durban&rsquo;s real-time moving marketplace for students. Instead of phoning five bakkie guys, asking a mate with a Hilux, or trusting a stranger on Facebook Marketplace, you post your job once and verified drivers in Durban bid on it live. You pick the bid you like, the driver is dispatched, and you &mdash; or your parents &mdash; track the whole trip on a live GPS map.</p>

<div class="info-box">
 <p><strong>Post a job in 60 seconds.</strong> Pickup address. Drop-off address. A short description of what you&rsquo;re moving. That&rsquo;s it.</p>
</div>

<h3>1. Post your job</h3>
<p>Tell us where to collect (your res, your flat, your parents&rsquo; house) and where to drop off (your new res, your new digs, home for the holidays). Add a photo of the room if you want a smarter quote &mdash; the HALA MOVE AI Smart Quote reads the photo and recommends a fair price range based on load size, distance, and whether you&rsquo;ll need helpers.</p>

<h3>2. Receive live bids from verified drivers</h3>
<p>Nearby verified drivers in Durban see your job instantly and submit bids in real time. Each bid shows the driver&rsquo;s name, star rating, vehicle photo, and estimated arrival time. Every driver on HALA MOVE is manually ID-verified against the South African government database before they can accept a single job &mdash; the same drivers who move furniture for families move students every day.</p>

<h3>3. Accept the bid that fits your budget</h3>
<p>Choose the bid that works for you &mdash; cheapest, closest, highest rated, or the one with the right vehicle for your load. A bakkie is usually enough for a single res room. A panel van or H100 is better for a shared flat or a two-bedroom digs. Your payment is charged and held safely in PayFast escrow until you confirm delivery.</p>

<h3>4. Track the driver live &mdash; parents too</h3>
<p>Watch your driver on a live GPS map from the moment they accept until they reach your drop-off. Share the live route with a parent or guardian so they can follow the trip from Umhlanga to Howard College, from Ballito to Westville, from King Shaka Airport to your res. No more &ldquo;text me when you get there&rdquo; &mdash; the app does it for you.</p>

<h3>5. Confirm delivery, payment releases</h3>
<p>Once the driver drops off and takes a timestamped proof-of-delivery photo, the escrow releases the payment. The driver receives 80% of the final price; HALA MOVE takes a 20% platform fee. Rate the driver and you&rsquo;re done. The full record &mdash; photos, GPS trail, chat &mdash; stays in the app in case you ever need it.</p>

<h2 class="section-anchor" id="why-hala">Why students (and parents) choose HALA MOVE</h2>

<h3>Verified drivers &mdash; ID checked against the SA government database</h3>
<p>Every driver on HALA MOVE is manually verified. We check the driver&rsquo;s South African ID against the government database, confirm the driver&rsquo;s licence, vehicle registration, roadworthy certificate, and bank account before they see a single job. You and your parents see the driver&rsquo;s name, photo, rating, and completed-job count before you accept a bid. No random Facebook Marketplace strangers. No &ldquo;my uncle&rsquo;s cousin has a bakkie.&rdquo;</p>

<h3>Parents can watch the trip on a live map</h3>
<p>Moving to university is the first time many students move on their own. HALA MOVE lets parents see the driver&rsquo;s exact position on a live GPS map, so they know when you&rsquo;ve been picked up and when you&rsquo;ve arrived. The map updates every 8 seconds &mdash; exactly like tracking an Uber. First move, no anxiety.</p>

<h3>Budget-friendly &mdash; from R150</h3>
<p>The HALA MOVE platform base price is R150. For a single res room move across the Durban metro, you&rsquo;ll usually land between R150 and R350. Drivers can bid up to 35% above your budget ceiling, so you will never be blindsided by a runaway price. Post your job with a budget cap if you&rsquo;re on a student wallet &mdash; drivers who can do the run for that price will bid, and you choose.</p>

<h3>The right vehicle for the move &mdash; bakkie, van, or truck</h3>
<p>A single res room fits comfortably in a one-ton bakkie. A house-share or two-bedroom digs usually needs a panel van or H100 for the extra cargo. A full family move from your parents&rsquo; home to a new flat can use a 4-tonne truck. HALA MOVE drivers span every vehicle size, so you never pay for more than you need &mdash; or end up with a bakkie trying to fit a full bedroom suite.</p>

<h3>Helpers for boxes, beds, and fridges</h3>
<p>Some drivers offer load-and-unload help, some don&rsquo;t. Mention in your job description if you need a helper to carry boxes up to the third floor of your res, and drivers who can assist will factor that into their bid. For heavier moves with fridges, washing machines, or tightly packed dorm rooms, you can pick a driver who brings a helper.</p>

<h3>PayFast escrow &mdash; no cash, no trust required</h3>
<p>You pay through PayFast, the leading South African payment processor. The money is held in escrow and only released to the driver after delivery is confirmed with a proof-of-delivery photo. No cash on delivery. No EFT to a stranger&rsquo;s account. If something goes wrong, HALA MOVE support can hold the payment and investigate.</p>

<h2 class="section-anchor" id="pricing">Student moving Durban &mdash; how much does it cost?</h2>
<p>HALA MOVE prices are set by live driver bidding, not a fixed rate card. Here is what you can typically expect for student moves in Durban:</p>
<table class="data-table">
 <thead><tr><th>Move type</th><th>Typical price range</th><th>Vehicle</th></tr></thead>
 <tbody>
  <tr><td>Single res room (short hop within campus)</td><td>R150 &ndash; R250</td><td>Bakkie</td></tr>
  <tr><td>Res to res-across-city (Howard College &harr; Westville)</td><td>R250 &ndash; R450</td><td>Bakkie / Panel van</td></tr>
  <tr><td>Res to new flat (digs setup)</td><td>R350 &ndash; R650</td><td>Panel van / H100</td></tr>
  <tr><td>Shared house / two-bedroom flat move</td><td>R550 &ndash; R1,100</td><td>Panel van / 4-tonne</td></tr>
  <tr><td>King Shaka Airport luggage to campus</td><td>R200 &ndash; R400</td><td>Bakkie</td></tr>
  <tr><td>Durban &harr; Pietermaritzburg (UKZN PMB)</td><td>R650 &ndash; R1,400</td><td>Panel van / Bakkie</td></tr>
 </tbody>
</table>
<p>The <strong>platform base price is R150</strong> &mdash; the floor below which no job can settle. Drivers can bid up to 35% above your budget ceiling, which protects both sides: drivers get a fair minimum and students on a budget never get surprised by a runaway price.</p>

<div class="info-box">
 <p><strong>Pro tip:</strong> Book a day or two before registration week if you can. Registration and end-of-semester weeks are the busiest for student moves in Durban, and booking early gives you the widest pick of bids.</p>
</div>

<h2 class="section-anchor" id="campuses">Durban campuses and residences we cover</h2>
<p>HALA MOVE has verified drivers ready to bid on student jobs at every major tertiary institution in Durban and KwaZulu-Natal:</p>
<ul>
 <li><strong>UKZN (University of KwaZulu-Natal):</strong> Howard College (Durban), Westville, Medical School (Umbilo), Edgewood (Pinetown), Pietermaritzburg.</li>
 <li><strong>DUT (Durban University of Technology):</strong> Steve Biko Campus, ML Sultan Campus, City Campus, Ritson Campus, Riverside Campus, Indumiso Campus.</li>
 <li><strong>MUT (Mangosuthu University of Technology):</strong> Umlazi main campus.</li>
 <li><strong>Mancosa:</strong> Durban CBD campus and all KZN satellite sites.</li>
 <li><strong>Varsity College Durban:</strong> Durban North and Westville.</li>
 <li><strong>Regent Business School:</strong> Durban CBD.</li>
 <li><strong>Private residences:</strong> Digs, house-shares, garden flats, and new-flat moves across Glenwood, Musgrave, Berea, Morningside, Durban North, Umhlanga, Pinetown, Westville, Umbilo, and the CBD.</li>
</ul>
<p>Moving from Durban to another KZN city or home for the holidays? HALA MOVE also runs inter-city KZN trips &mdash; Pietermaritzburg, Richards Bay, Empangeni, Margate, Port Shepstone, Howick, Newcastle.</p>

<h2 class="section-anchor" id="loads">What students typically move with HALA MOVE</h2>
<ul>
 <li><strong>Single res room:</strong> Clothes, bedding, a trunk, books, a mini-fridge, a kettle, a fan. Fits in a bakkie.</li>
 <li><strong>Digs setup:</strong> A bed, a desk, a chair, a fridge, a kettle, boxes of clothes and kitchen gear. Panel van is usually right-sized.</li>
 <li><strong>House-share move:</strong> A full room&rsquo;s worth of furniture from your parents&rsquo; home to a shared house. Panel van or H100.</li>
 <li><strong>End-of-semester packup:</strong> Everything you own back home for the holidays. Usually a bakkie.</li>
 <li><strong>Airport luggage run:</strong> Suitcases and boxes from King Shaka International to your res or new flat. Bakkie.</li>
 <li><strong>Fridge, washing machine, or bed delivery:</strong> Buying a second-hand fridge or a new mattress? Post the pickup and drop-off. Driver delivers, helper lifts, done.</li>
</ul>
<p>Moving the whole family house? That is a job for our <a href="./furniture-removal-durban.html">furniture removal service</a> &mdash; we have drivers with 4-tonne and 8-tonne trucks and professional moving kit for full-house relocations.</p>

<h2 class="section-anchor" id="faq">Student moving Durban &mdash; Frequently Asked Questions</h2>

<h3>How much does student moving in Durban cost with HALA MOVE?</h3>
<p>HALA MOVE student moving in Durban starts at a R150 platform base price. Final price is set by live driver bidding. Most single-room res moves settle between R150 and R350, and a two-bedroom flat move typically lands between R450 and R900 depending on distance, helpers, and time of day.</p>

<h3>Can I book a bakkie during UKZN or DUT registration week?</h3>
<p>Yes. Registration week is the busiest period for student moves in Durban. Post your job on HALA MOVE and nearby verified drivers will bid in real time. Booking a day or two ahead during peak weeks is smart, but same-day jobs are dispatched every day during registration.</p>

<h3>Do HALA MOVE drivers help carry boxes up to the residence room?</h3>
<p>Some drivers offer load-and-unload help and factor helpers into their bid. Mention in your job description that you need help carrying boxes, beds, or fridges up flights of stairs, and drivers who can assist will bid accordingly. For heavier moves you can request a driver bringing a helper.</p>

<h3>Can my parents track the driver while I am moving?</h3>
<p>Yes. Once you accept a bid, HALA MOVE shows the driver&rsquo;s live GPS position on a map inside the app. You can share the live route with a parent or guardian so they can follow the trip from pickup to drop-off. Every driver is SA ID-verified before they see a single job.</p>

<h3>Can I book a move from King Shaka Airport to my campus?</h3>
<p>Yes. HALA MOVE handles luggage runs from King Shaka International Airport to UKZN Westville, UKZN Howard College, UKZN Pietermaritzburg, DUT Steve Biko and ML Sultan, MUT, Mancosa, and Varsity College. Post the job the moment you land &mdash; verified drivers nearby bid within minutes.</p>

<h3>What size vehicle do I need for a single res room vs a two-bedroom flat?</h3>
<p>A single res room or digs room typically fits in a one-ton bakkie. A two-bedroom flat or shared house-move usually needs a panel van or H100 for the extra cargo space. HALA MOVE Smart Quote recommends the right vehicle type for your load and shows a fair price range before drivers bid.</p>

<h3>Is my payment safe?</h3>
<p>Yes. Payments are processed via PayFast and held in escrow until the driver confirms delivery with a timestamped photo. The driver is only paid out after you have received your things. HALA MOVE takes a 20% platform fee; the driver receives 80%.</p>

<h3>What if something goes wrong during the move?</h3>
<p>HALA MOVE holds your payment in escrow until you confirm delivery. If there is a problem, contact support through the app. Because every job has GPS trails, timestamps, in-app chat logs, and proof-of-delivery photos, disputes are rare and easy to resolve.</p>

<h2 class="section-anchor" id="download">Download the HALA MOVE app &mdash; book a student move in Durban now</h2>
<p>The fastest way to book a verified driver for a Durban student move is through the HALA MOVE app. Available on Android and iOS, free to download, free to post a job &mdash; you only pay when you accept a bid.</p>
<p><a href="/#download" class="btn btn-green">Download the app</a> &nbsp; <a href="./bakkie-hire-durban.html" class="btn btn-ghost">Bakkie hire Durban</a> &nbsp; <a href="./furniture-removal-durban.html" class="btn btn-ghost">Furniture removal</a></p>
<p style="font-size:0.95rem;color:var(--t2);margin-top:24px;">Questions? See our full <a href="./faq.html">FAQ</a>, read about <a href="./about.html">our story</a>, or WhatsApp us using the green button on the bottom-right of this page. HALA MOVE (Pty) Ltd is registered in South Africa and operates from Durban, KwaZulu-Natal.</p>
</div>
  </div>
 </div>
</section>

`;

const studentCfg = {
  slug: 'student-moving-durban',
  title: 'Student Moving Durban | UKZN, DUT, MUT | HALA MOVE',
  metaDesc: 'Student moving in Durban from R150. Verified drivers, live GPS, PayFast escrow. UKZN, DUT, MUT, Mancosa and Varsity College moves. Book in 60 seconds.',
  keywords: 'student moving Durban, student movers Durban, UKZN moving, DUT moving, res moving Durban, student bakkie Durban, end of semester move Durban, student delivery Durban, HALA MOVE',
  ogTitle: 'Student Moving Durban — UKZN, DUT, MUT | HALA MOVE',
  ogDesc: 'Student moving in Durban from R150. Verified drivers, live GPS, PayFast escrow. UKZN, DUT, MUT, Mancosa and Varsity College.',
  ogImageAlt: 'HALA MOVE — Student Moving Durban',
  twitterTitle: 'Student Moving Durban — UKZN, DUT, MUT',
  twitterDesc: 'Student moving in Durban from R150. Verified drivers, live GPS, PayFast escrow. Book in 60 seconds.',
  schema: studentSchema,
  contentBlock: studentContent
};

// ═══════════════════════════════════════════════════════════
// PAGE 2: business-transport-durban
// ═══════════════════════════════════════════════════════════
const businessSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.halaapp.co.za/business-transport-durban#webpage",
      "url": "https://www.halaapp.co.za/business-transport-durban",
      "name": "Business Transport Durban — HALA MOVE",
      "description": "B2B transport contracts in Durban from R5,000/month. Live fleet visibility, SLA terms, ESG reports, verified drivers. Construction, medical, e-commerce, retail.",
      "inLanguage": "en-ZA",
      "isPartOf": { "@id": "https://www.halaapp.co.za/#website" },
      "about": { "@id": "https://www.halaapp.co.za/#organization" },
      "primaryImageOfPage": "https://www.halaapp.co.za/og-image.svg",
      "dateModified": "2026-04-14"
    },
    {
      "@type": "Service",
      "@id": "https://www.halaapp.co.za/business-transport-durban#service",
      "serviceType": "Business Transport Contracts",
      "name": "Business Transport Durban",
      "description": "Formal B2B transport contracts across Durban and KwaZulu-Natal. SLA terms, live fleet visibility, consolidated monthly billing, JSE-ready ESG reports. Construction, medical, e-commerce, retail, manufacturing, universities.",
      "provider": {
        "@type": "Organization",
        "name": "HALA MOVE (Pty) Ltd",
        "url": "https://www.halaapp.co.za/"
      },
      "areaServed": [
        { "@type": "City", "name": "Durban" },
        { "@type": "AdministrativeArea", "name": "KwaZulu-Natal" }
      ],
      "offers": {
        "@type": "Offer",
        "priceCurrency": "ZAR",
        "price": "5000",
        "priceSpecification": {
          "@type": "PriceSpecification",
          "priceCurrency": "ZAR",
          "minPrice": "5000",
          "description": "Business transport contracts from R5,000/month. SLA terms, consolidated monthly billing, live fleet visibility."
        }
      },
      "availableChannel": {
        "@type": "ServiceChannel",
        "serviceUrl": "https://www.halaapp.co.za/",
        "serviceLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Durban",
            "addressRegion": "KwaZulu-Natal",
            "addressCountry": "ZA"
          }
        }
      }
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.halaapp.co.za/business-transport-durban#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do HALA MOVE business contracts work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "HALA MOVE business contracts are formal B2B agreements with agreed SLA terms, consolidated monthly billing, and live fleet visibility. Your ops team uses one dashboard to see every vehicle, every job, every ETA and every proof of delivery. Contracts start from R5,000 per month and scale with your route and volume needs."
          }
        },
        {
          "@type": "Question",
          "name": "What does the R5,000 per month contract include?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The R5,000/month entry tier includes dedicated account management, access to HALA MOVE's verified driver network across bakkies, H100s, panel vans, 4-tonne and 8-tonne trucks, a live fleet dashboard, SLA-backed dispatch, consolidated monthly billing, and standard ESG reporting. Custom tiers are available for larger fleets, medical cold-chain, and government contracts."
          }
        },
        {
          "@type": "Question",
          "name": "Can I book daily recurring routes for my construction site or warehouse?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. HALA MOVE business contracts support daily recurring routes, scheduled pickups, and multi-stop delivery runs. Construction sites, warehouses, and distribution centres can lock in regular dispatch windows so the same verified driver or vehicle is available at the same time each day or week."
          }
        },
        {
          "@type": "Question",
          "name": "Does HALA MOVE handle medical cold-chain and pharmacy delivery?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. HALA MOVE operates cold-chain capable vehicles for medical facilities, pharmacies, and pathology labs in Durban and KwaZulu-Natal. Every driver is ID-verified against the SA government database, every job is GPS tracked, and every delivery ends with a timestamped photo &mdash; a compliance record your clinical ops team can audit."
          }
        },
        {
          "@type": "Question",
          "name": "What compliance and ESG reporting is included?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "HALA MOVE provides monthly CO2 footprint data per vehicle, per route, and per delivery, formatted for JSE and international ESG disclosure. Every job includes a GPS trail, timestamped pickup and delivery photos, and a driver ID audit record. Construction, medical, and government contracts get compliance-ready digital proof of delivery on every job."
          }
        },
        {
          "@type": "Question",
          "name": "How is billing and invoicing handled for businesses?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "HALA MOVE consolidates all your company's jobs into a single monthly invoice with 30-day payment terms. The invoice itemises every job, vehicle, route, driver, and proof-of-delivery link so your accounts and ops teams have full reconciliation. No per-job cash payments, no scattered receipts."
          }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.halaapp.co.za/" },
        { "@type": "ListItem", "position": 2, "name": "Business Transport Durban", "item": "https://www.halaapp.co.za/business-transport-durban" }
      ]
    }
  ]
};

const businessContent = `<div class="page-hero">
 <div class="container">
  <div class="page-hero-eyebrow">B2B Contracts &middot; Durban &amp; KZN</div>
  <h1 class="page-title">Business Transport in Durban</h1>
  <p style="font-size:1rem;color:var(--t2);max-width:680px;line-height:1.75">Construction, medical, e-commerce, retail, manufacturing, universities &mdash; if your KwaZulu-Natal business needs dependable transport, HALA MOVE runs formal B2B contracts from <strong>R5,000/month</strong> with live fleet visibility, SLA terms, consolidated monthly billing, and JSE-ready ESG reports. One platform, every vehicle, every route.</p>
  <div class="page-meta">
   <span><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#666" stroke-width="1.2"/><path d="M6.5 3.5v3l2 1.5" stroke="#666" stroke-width="1.2" stroke-linecap="round"/></svg> Durban, KwaZulu-Natal &middot; Launching 2026</span>
   <span><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1L8 5h4l-3.5 2.5 1.5 4L6.5 9 3 11.5l1.5-4L1 5h4z" stroke="#666" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg> SLA terms &middot; ESG reporting &middot; Verified fleet</span>
  </div>
 </div>
</div>
<section class="page-body">
 <div class="container">
  <div class="content-grid">
   <div class="toc"><h4>On this page</h4>
   <a href="#how-it-works">How business contracts work</a>
   <a href="#segments">Who we serve</a>
   <a href="#fleet">Fleet &amp; coverage</a>
   <a href="#compliance">Compliance &amp; ESG</a>
   <a href="#pricing">Contract tiers</a>
   <a href="#faq">FAQ</a>
   <a href="#download">Get in touch</a>
  </div>
   <div class="prose">
<h2 class="section-anchor" id="how-it-works">How HALA MOVE business contracts work</h2>
<p>HALA MOVE business transport is a formal B2B agreement layered on top of the same verified driver network that powers our on-demand marketplace. Your ops team gets a single dashboard to see every vehicle, every job, every ETA, and every proof-of-delivery photo. Your finance team gets one consolidated monthly invoice with 30-day terms. Your compliance team gets JSE-ready ESG reports per vehicle, per route, and per delivery.</p>

<div class="info-box">
 <p><strong>Contracts from R5,000/month.</strong> SLA-backed dispatch. Live fleet visibility. Consolidated monthly billing. Verified drivers. GPS trail on every job.</p>
</div>

<h3>1. Scoping &amp; onboarding</h3>
<p>Tell us the routes, the vehicles, the volume, and the SLAs you need. Daily site supply runs? Weekly inter-branch transfers? Cold-chain medical delivery on a fixed schedule? Last-mile e-commerce from a Durban warehouse? We scope the contract around your actual operations &mdash; no generic packages.</p>

<h3>2. Dedicated driver pool</h3>
<p>Your contract is served by a curated pool of verified drivers and vehicles matched to your SLA. Every driver is ID-verified against the South African government database. Every vehicle has a roadworthy certificate, registration, and insurance on file. Recurring routes are locked to the same drivers where possible, so your site managers see the same faces every day.</p>

<h3>3. Live fleet dashboard</h3>
<p>Your ops team logs into a live dashboard showing every active vehicle on a map, every job in progress, every ETA, and every completed proof of delivery. No phone calls asking &ldquo;where is the driver?&rdquo; &mdash; the dashboard answers before anyone asks. GPS updates every 8 seconds.</p>

<h3>4. Consolidated monthly billing</h3>
<p>Every job on your contract rolls into a single monthly invoice with 30-day payment terms. The invoice itemises every job, vehicle, route, driver, and proof-of-delivery link, so your accounts and ops teams have full reconciliation without chasing receipts. No per-job cash, no scattered EFTs.</p>

<h3>5. Compliance &amp; ESG reports</h3>
<p>HALA MOVE generates monthly CO2 footprint reports per vehicle, per route, and per delivery, formatted for JSE and international ESG disclosure. Every job includes a GPS trail, timestamped pickup and delivery photos, and a driver ID audit record &mdash; essential for construction, medical, and government contracts.</p>

<h2 class="section-anchor" id="segments">Who HALA MOVE business transport serves</h2>

<h3>Construction companies</h3>
<p>Daily site supply runs, cement and rebar delivery, tool transport between sites, sub-contractor logistics. HALA MOVE 4-tonne and 8-tonne trucks, bakkies, and panel vans cover every part of a construction supply chain from Builders and Buco to the site gate. Every delivery ends with a timestamped photo &mdash; essential for site-manager sign-off and progress audits.</p>

<h3>Medical facilities and pharmacies</h3>
<p>Cold-chain delivery between clinics, hospitals, pathology labs, and pharmacies across Durban and KZN. Verified drivers, GPS trail on every job, timestamped proof of delivery, and driver ID audit for compliance. Whether you are moving a scheduled drug run or a one-off lab specimen, every job is logged and auditable.</p>

<h3>E-commerce sellers and warehouses</h3>
<p>Last-mile delivery from Durban warehouses to customers across the metro and wider KZN. Panel vans, H100s, and bakkies for small parcels and bulky goods. Real-time fleet visibility so your customer service team can answer &ldquo;where is my order?&rdquo; before the customer has to ask.</p>

<h3>Retailers and manufacturers</h3>
<p>Inter-branch stock transfer, warehouse-to-store replenishment, return logistics. 4-tonne and 8-tonne trucks for bulk runs, panel vans for urgent same-day restocks. Consolidated monthly billing so finance has one invoice per month instead of a pile of waybills.</p>

<h3>Universities and schools</h3>
<p>Campus logistics for UKZN, DUT, MUT, Mancosa, and Varsity College &mdash; event equipment, inter-campus document delivery, lab equipment transfer, and back-office supplies. Verified drivers, live tracking, and institutional billing with purchase-order reconciliation.</p>

<h3>Government and municipal departments</h3>
<p>HALA MOVE provides the compliance trail government and municipal contracts demand: ID-verified drivers, GPS trails, timestamped photo POD, and digital audit logs on every job. Contracts align with SCM requirements, SLA terms, and reporting cadence.</p>

<h2 class="section-anchor" id="fleet">Fleet &amp; coverage</h2>
<p>HALA MOVE business contracts draw from the full verified fleet:</p>
<ul>
 <li><strong>Bakkies (1-ton):</strong> Small runs, urgent dispatch, single-item delivery, tool transport.</li>
 <li><strong>Hyundai H100 &amp; panel vans:</strong> Enclosed cargo, fragile goods, medical delivery, e-commerce last-mile.</li>
 <li><strong>4-tonne trucks:</strong> Warehouse-to-store replenishment, mid-size construction runs, bulk deliveries.</li>
 <li><strong>8-tonne trucks:</strong> Full-load construction, manufacturing, bulk retail and industrial logistics.</li>
</ul>
<p><strong>Coverage:</strong> Durban metro and the full KwaZulu-Natal province. Standard contract coverage includes Durban Central, Umhlanga, Ballito, Umlazi, Chatsworth, Pinetown, Westville, Phoenix, Verulam, Hillcrest, Amanzimtoti, Pietermaritzburg, Richards Bay, Empangeni, Port Shepstone, and Howick. Inter-provincial contracts available on request.</p>

<h2 class="section-anchor" id="compliance">Compliance, accountability &amp; ESG</h2>

<h3>Driver ID verification against SA government database</h3>
<p>Every driver on a HALA MOVE business contract has had their South African ID verified against the government database, driver&rsquo;s licence confirmed, vehicle registration and roadworthy certificate checked, and bank account verified before they see a single job on your account. No unverified driver ever works on HALA MOVE &mdash; ever.</p>

<h3>Timestamped photo proof of delivery on every job</h3>
<p>Every pickup and every drop-off on your contract ends with a timestamped photo captured by the driver, stored in the cloud, and linked to your billing record. Essential for construction site sign-off, medical compliance, and any contract requiring an audit trail.</p>

<h3>GPS trail on every job</h3>
<p>Every vehicle on your contract is tracked on a live GPS map. The trail is logged from pickup to drop-off and attached to the job record. Your ops team sees live positions, your compliance team can pull historical trails for audits, and your customer service team can answer &ldquo;where is it?&rdquo; before the customer calls.</p>

<h3>Monthly CO2 ESG reports</h3>
<p>HALA MOVE is South Africa&rsquo;s first carbon-aware logistics platform. Every job&rsquo;s CO2 footprint is calculated automatically. Business contracts receive monthly reports per vehicle, per route, and per delivery, formatted for JSE and international ESG disclosure. The only logistics platform in South Africa that generates ESG-ready reports as standard on every contract.</p>

<h2 class="section-anchor" id="pricing">Contract tiers &mdash; from R5,000/month</h2>
<p>HALA MOVE business contracts are scoped to your routes, volume, and SLA needs. Entry-tier contracts start at R5,000/month. Custom tiers are built for larger fleets, medical cold-chain, manufacturing, and government contracts.</p>
<table class="data-table">
 <thead><tr><th>Tier</th><th>From</th><th>Ideal for</th></tr></thead>
 <tbody>
  <tr><td>Starter</td><td>R5,000/month</td><td>Small businesses &mdash; 10-30 jobs/month, Durban metro, shared driver pool</td></tr>
  <tr><td>Growth</td><td>R12,000/month</td><td>Retailers, e-commerce, clinics &mdash; 30-120 jobs/month, dedicated drivers, daily SLAs</td></tr>
  <tr><td>Enterprise</td><td>R25,000/month+</td><td>Construction, manufacturing, medical cold-chain &mdash; 120+ jobs/month, locked fleet, full ESG reporting</td></tr>
  <tr><td>Government / SCM</td><td>Scoped</td><td>Municipal and provincial contracts &mdash; full compliance trail, SCM-aligned reporting</td></tr>
 </tbody>
</table>
<p>Every tier includes verified drivers, live fleet visibility, timestamped POD, consolidated monthly billing, and ESG reporting as standard. Contact HALA MOVE sales to scope a contract for your operation.</p>

<div class="info-box">
 <p><strong>Not sure which tier fits?</strong> Send us your routes, volume, and SLA needs and we will scope a contract around your real operations &mdash; no generic packages, no unused capacity.</p>
</div>

<h2 class="section-anchor" id="faq">Business transport Durban &mdash; Frequently Asked Questions</h2>

<h3>How do HALA MOVE business contracts work?</h3>
<p>HALA MOVE business contracts are formal B2B agreements with agreed SLA terms, consolidated monthly billing, and live fleet visibility. Your ops team uses one dashboard to see every vehicle, every job, every ETA and every proof of delivery. Contracts start from R5,000 per month and scale with your route and volume needs.</p>

<h3>What does the R5,000 per month contract include?</h3>
<p>The R5,000/month entry tier includes dedicated account management, access to HALA MOVE&rsquo;s verified driver network across bakkies, H100s, panel vans, 4-tonne and 8-tonne trucks, a live fleet dashboard, SLA-backed dispatch, consolidated monthly billing, and standard ESG reporting. Custom tiers are available for larger fleets, medical cold-chain, and government contracts.</p>

<h3>Can I book daily recurring routes for my construction site or warehouse?</h3>
<p>Yes. HALA MOVE business contracts support daily recurring routes, scheduled pickups, and multi-stop delivery runs. Construction sites, warehouses, and distribution centres can lock in regular dispatch windows so the same verified driver or vehicle is available at the same time each day or week.</p>

<h3>Does HALA MOVE handle medical cold-chain and pharmacy delivery?</h3>
<p>Yes. HALA MOVE operates cold-chain capable vehicles for medical facilities, pharmacies, and pathology labs in Durban and KwaZulu-Natal. Every driver is ID-verified against the SA government database, every job is GPS tracked, and every delivery ends with a timestamped photo &mdash; a compliance record your clinical ops team can audit.</p>

<h3>What compliance and ESG reporting is included?</h3>
<p>HALA MOVE provides monthly CO2 footprint data per vehicle, per route, and per delivery, formatted for JSE and international ESG disclosure. Every job includes a GPS trail, timestamped pickup and delivery photos, and a driver ID audit record. Construction, medical, and government contracts get compliance-ready digital proof of delivery on every job.</p>

<h3>How is billing and invoicing handled for businesses?</h3>
<p>HALA MOVE consolidates all your company&rsquo;s jobs into a single monthly invoice with 30-day payment terms. The invoice itemises every job, vehicle, route, driver, and proof-of-delivery link so your accounts and ops teams have full reconciliation. No per-job cash payments, no scattered receipts.</p>

<h3>Can I start with a trial contract?</h3>
<p>Yes. HALA MOVE offers one-month pilot contracts so your ops, finance, and compliance teams can evaluate the platform against your actual workflows before committing to a longer agreement. Pilot contracts include everything in the starter tier and can be scaled up or down at the end of the month.</p>

<h3>Which KwaZulu-Natal areas do business contracts cover?</h3>
<p>HALA MOVE business contracts cover Durban metro and the full KZN province including Umhlanga, Ballito, Umlazi, Chatsworth, Pinetown, Westville, Phoenix, Verulam, Hillcrest, Amanzimtoti, Pietermaritzburg, Richards Bay, Empangeni, Port Shepstone, and Howick. Inter-provincial contracts are available on request.</p>

<h2 class="section-anchor" id="download">Talk to HALA MOVE business</h2>
<p>Ready to scope a contract? Email <a href="mailto:business@halaapp.co.za">business@halaapp.co.za</a> with your routes, volume, and SLA needs and we will come back with a scoped proposal within two business days. Or download the HALA MOVE app on Android or iOS to see the platform your drivers and ops team will use every day.</p>
<p><a href="mailto:business@halaapp.co.za" class="btn btn-green">Contact HALA MOVE business</a> &nbsp; <a href="/#download" class="btn btn-ghost">Download the app</a></p>
<p style="font-size:0.95rem;color:var(--t2);margin-top:24px;">Questions? See our full <a href="./faq.html">FAQ</a>, read about <a href="./about.html">our story</a>, or WhatsApp us using the green button on the bottom-right of this page. HALA MOVE (Pty) Ltd is registered in South Africa and operates from Durban, KwaZulu-Natal.</p>
</div>
  </div>
 </div>
</section>

`;

const businessCfg = {
  slug: 'business-transport-durban',
  title: 'Business Transport Durban | Contracts from R5,000/month | HALA MOVE',
  metaDesc: 'B2B transport contracts in Durban from R5,000/month. Live fleet visibility, SLA terms, ESG reports, verified drivers. Construction, medical, e-commerce, retail.',
  keywords: 'business transport Durban, B2B logistics Durban, corporate transport KwaZulu-Natal, construction logistics Durban, medical courier Durban, e-commerce fulfilment Durban, fleet contract Durban, HALA MOVE',
  ogTitle: 'Business Transport Durban — Contracts from R5,000/month | HALA MOVE',
  ogDesc: 'B2B transport contracts in Durban from R5,000/month. Live fleet visibility, SLA terms, ESG reports, verified drivers.',
  ogImageAlt: 'HALA MOVE — Business Transport Durban',
  twitterTitle: 'Business Transport Durban — Contracts from R5,000/month',
  twitterDesc: 'B2B transport contracts in Durban from R5,000/month. Live fleet visibility, SLA, ESG reports.',
  schema: businessSchema,
  contentBlock: businessContent
};

// ═══════════════════════════════════════════════════════════
// BUILD BOTH
// ═══════════════════════════════════════════════════════════
const results = [studentCfg, businessCfg].map(cfg => {
  const r = buildPage(cfg);
  console.log('\n=== ' + cfg.slug + ' ===');
  r.log.forEach(l => console.log(l));
  console.log('-> ' + r.outPath + ' (' + r.lines + ' lines)');
  return r;
});

console.log('\nDone. Wrote:');
results.forEach(r => console.log('  ' + r.outPath + ' (' + r.lines + ' lines)'));
