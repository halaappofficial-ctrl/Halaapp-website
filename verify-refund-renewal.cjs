#!/usr/bin/env node
// An old refund link renews itself when it is opened: the server sends the new link to the customer's
// messages in the HALA MOVE app and answers 410 { ended, renewed, message }. The page must say a new link
// was sent (not "ended"), and an old link opened again (404) must point to the newer link in the app
// before any WhatsApp line.
// Run: node verify-refund-renewal.cjs   (exit 0 = every check holds)
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'refund.html'), 'utf8');
let pass = 0, fail = 0;
function check(name, ok) { if (ok) pass++; else { fail++; console.log('FAIL ' + name); } }

// 1. A renewed link is titled as a new link sent, decided by the server's flag, not by wording.
check('a renewed 410 is titled "We have sent you a new link"',
  /r\.body\.renewed === true\s*\?\s*'We have sent you a new link'/.test(src));
check('a paid refund still reads as paid', /\/paid\/i\.test\(r\.body\.message/.test(src));

// 2. The invalid block names the newer link in the app, before the WhatsApp line.
const inv = (src.match(/<div id="invalid"[\s\S]*?<\/div>/) || [''])[0];
const newer = inv.search(/newer link[\s\S]*messages in the HALA MOVE app/);
const wa = inv.indexOf('wa.me/');
check('the invalid block points to a newer link in the app messages', newer >= 0);
check('the newer-link line comes before the WhatsApp line', newer >= 0 && wa > newer);
check('the invalid block WhatsApp line stays marked', /data-last-resort="no-self-serve-path"/.test(inv));

// 3. The WhatsApp fallback text runs only when the server sends no message, and stays marked.
check('the ended text prefers the server message', /\$\('ended-text'\)\.textContent = r\.body\.message \|\|/.test(src));
check('the fallback carries its last-resort mark',
  /last-resort: no-self-serve-path[^\n]*\r?\n\s*\$\('ended-text'\)/.test(src));

const total = pass + fail;
console.log((fail ? 'REFUND RENEWAL: FAIL ' : 'REFUND RENEWAL: PASS ') + pass + '/' + total);
process.exit(fail || total === 0 ? 1 : 0);
