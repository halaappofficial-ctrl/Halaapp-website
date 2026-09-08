const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const pages = [
  {
    file: 'student-moving-durban.html',
    checks: [
      ['title tag', '<title>Student Moving Durban | UKZN, DUT, MUT | HALA MOVE</title>'],
      // The bare URL was a substring of the schema "@id" below, so this check passed on the SCHEMA
      // block even with the real tag pointing at the dead domain - proven by mutation 2026-09-08.
      // Matching the whole tag is the difference between checking the canonical and checking that
      // the string exists somewhere on the page.
      ['canonical', '<link rel="canonical" href="https://www.halamove.co.za/student-moving-durban">'],
      ['schema webpage id', '"@id": "https://www.halamove.co.za/student-moving-durban#webpage"'],
      ['schema service type', '"serviceType": "Student Moving"'],
      ['schema faq id', 'student-moving-durban#faq'],
      ['schema breadcrumb name', '"name": "Student Moving Durban"'],
      ['h1', '<h1 class="page-title">Student Moving in Durban</h1>'],
      ['launching 2026', 'Launching 2026'],
      ['UKZN mention', 'UKZN'],
      ['DUT mention', 'DUT'],
      ['MUT mention', 'MUT'],
      ['Mancosa mention', 'Mancosa'],
      ['Varsity College', 'Varsity College'],
      ['King Shaka airport', 'King Shaka'],
      ['parents tracking', 'parents'],
      ['PayFast escrow', 'PayFast'],
      ['R150 anchor', 'R150'],
      ['registration week', 'registration week'],
      ['SA ID verified', 'South African ID'],
      ['FAQ how much', 'How much does student moving in Durban cost'],
      ['toc present', 'On this page'],
      ['bakkie link', 'href="/bakkie-hire-durban"'],
      ['furniture removal link', 'href="/furniture-removal-durban"'],
      ['CSS intact', '.hero-h1{'],
      ['nav intact', 'nav-inner'],
      ['footer intact', 'footer-grid'],
      ['JS intact', 'IntersectionObserver'],
      ['no representative disclaimer', null, 'Representative experiences from our early'],
      ['no dead domain', null, 'halaapp.co.za'],
    ]
  },
  {
    file: 'business-transport-durban.html',
    checks: [
      ['title tag', '<title>Business Transport Durban | Contracts from R5,000/month | HALA MOVE</title>'],
      ['canonical', '<link rel="canonical" href="https://www.halamove.co.za/business-transport-durban">'],
      ['schema webpage id', '"@id": "https://www.halamove.co.za/business-transport-durban#webpage"'],
      ['schema service type', '"serviceType": "Business Transport Contracts"'],
      ['schema faq id', 'business-transport-durban#faq'],
      ['schema breadcrumb name', '"name": "Business Transport Durban"'],
      ['schema offer price', '"price": "5000"'],
      ['h1', '<h1 class="page-title">Business Transport in Durban</h1>'],
      ['launching 2026', 'Launching 2026'],
      ['R5,000 anchor', 'R5,000/month'],
      ['construction', 'Construction companies'],
      ['medical', 'Medical facilities'],
      ['e-commerce', 'E-commerce sellers'],
      ['retailers', 'Retailers and manufacturers'],
      ['universities', 'Universities and schools'],
      ['government', 'Government and municipal'],
      ['SLA terms', 'SLA terms'],
      ['ESG reports', 'ESG report'],
      // ⚠️ INVERTED 2026-09-08. These three were mustContain, and that made this file DEMAND
      // THE RETURN OF CLAIMS THE FOUNDER RETRACTED. Commit 858ba97 (2026-08-17, "align the
      // business page with what the code actually does") removed eight promises after checking
      // each against source: "consolidated invoicing - no billing path exists"; "JSE-ready - we
      // produce CO2 data, we certify nothing, and readiness is an auditor's verdict, not ours";
      // "8-tonne trucks - there is no 8-ton, five vehicle types topping out at truck_4ton".
      // Anyone who "fixed" the page to make this suite green would have put three false claims
      // back on a live indexed page selling at R5,000/month. A sensor that fails is a nuisance;
      // a sensor that demands a lie is a hazard. They are now mustNotContain, so this file
      // PROTECTS that cleanup instead of arguing with it. '8-ton' catches '8-tonne' too.
      ['no JSE claim (858ba97)', null, 'JSE'],
      ['no consolidated billing claim (858ba97)', null, 'consolidated monthly'],
      ['fleet dashboard', 'fleet dashboard'],
      ['cold chain declined, not offered', 'cold-chain consignments are not currently offered'],
      ['no 8-ton truck claim (858ba97)', null, '8-ton'],
      ['PayFast mentioned', 'verified'],
      // contact@, not business@ (2026-09-08). brand-manifest.json declares exactly ONE address
      // and business@ is not it; whether that mailbox exists is unknowable from this repo, and a
      // dead address on a B2B enquiry route loses the lead outright. Guarded site-wide by
      // verify-contact-routes.cjs.
      ['enquiry email is the declared one', 'contact@halamove.co.za'],
      ['no undeclared business@ address', null, 'business@halamove.co.za'],
      ['pricing tiers table', 'Enterprise'],
      ['toc present', 'On this page'],
      ['CSS intact', '.hero-h1{'],
      ['nav intact', 'nav-inner'],
      ['footer intact', 'footer-grid'],
      ['JS intact', 'IntersectionObserver'],
      ['no representative disclaimer', null, 'Representative experiences from our early'],
      ['no dead domain', null, 'halaapp.co.za'],
    ]
  }
];

let totalPass = 0, totalFail = 0;

pages.forEach(page => {
  console.log('\n=== ' + page.file + ' ===');
  const fp = path.join(ROOT, page.file);
  if (!fs.existsSync(fp)) {
    console.log('FAIL: file does not exist');
    totalFail++;
    return;
  }
  const src = fs.readFileSync(fp, 'utf8');
  const lines = src.split('\n').length;
  const bytes = src.length;
  console.log('lines: ' + lines + ' · bytes: ' + bytes);

  page.checks.forEach(check => {
    const [label, mustContain, mustNotContain] = check;
    let ok;
    if (mustContain) {
      ok = src.includes(mustContain);
    } else if (mustNotContain) {
      ok = !src.includes(mustNotContain);
    }
    if (ok) { totalPass++; console.log('  PASS: ' + label); }
    else {
      totalFail++;
      console.log('  FAIL: ' + label
        + (mustContain ? '\n        expected to FIND: ' + JSON.stringify(mustContain)
                       : '\n        expected NOT to find: ' + JSON.stringify(mustNotContain)));
    }
  });

  // Schema.org JSON validity check — must parse
  try {
    const schemaMatch = src.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (schemaMatch) {
      JSON.parse(schemaMatch[1]);
      totalPass++; console.log('  PASS: schema JSON parses');
    } else {
      totalFail++; console.log('  FAIL: schema JSON not found');
    }
  } catch (e) {
    totalFail++; console.log('  FAIL: schema JSON invalid: ' + e.message);
  }

  // Balanced tag sanity checks (rough)
  const divOpen = (src.match(/<div[\s>]/g) || []).length;
  const divClose = (src.match(/<\/div>/g) || []).length;
  const secOpen = (src.match(/<section[\s>]/g) || []).length;
  const secClose = (src.match(/<\/section>/g) || []).length;
  const scriptOpen = (src.match(/<script[\s>]/g) || []).length;
  const scriptClose = (src.match(/<\/script>/g) || []).length;
  console.log('  tag balance: divs=' + divOpen + '/' + divClose + '  sections=' + secOpen + '/' + secClose + '  scripts=' + scriptOpen + '/' + scriptClose);
  if (divOpen === divClose && secOpen === secClose && scriptOpen === scriptClose) {
    totalPass++; console.log('  PASS: tag balance');
  } else {
    totalFail++; console.log('  FAIL: tag balance (opens != closes)');
  }
});

// ── SELF-CHECK: this file's own expectations must not name the dead domain ───────────────────
// Its stale setpoints, not the pages, were six of the ten failures this suite reported for weeks.
const selfSrc = fs.readFileSync(__filename, 'utf8');
// A REQUIREMENT, NOT A PROHIBITION. The two ['no dead domain', null, 'halaapp.co.za'] guards NAME
// the dead domain in order to FORBID it, and the first version of this self-check flagged them -
// the same [[L-71]] shape as grading a comment ABOUT a defect as the defect. The discriminator is
// the mustNotContain slot: a prohibition carries ', null,' before its string, a requirement does
// not. Proven by mutation both ways below.
const deadInSetpoints = selfSrc.split('\n')
  .filter(l => /\[\s*'/.test(l) && l.includes('halaapp.co.za') && !l.includes(', null,'));
if (deadInSetpoints.length === 0) {
  totalPass++; console.log('\n  PASS: this suite names no dead domain in its own expectations');
} else {
  totalFail++;
  console.log('\n  FAIL: this suite still EXPECTS the dead domain halaapp.co.za on '
    + deadInSetpoints.length + ' line(s) - the pages are not what is wrong:');
  deadInSetpoints.forEach(l => console.log('        ' + l.trim()));
}

console.log('\n════════════════════════════');
console.log('TOTAL: ' + totalPass + ' pass, ' + totalFail + ' fail');
process.exit(totalFail > 0 ? 1 : 0);
