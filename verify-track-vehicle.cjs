#!/usr/bin/env node
// The trip-link driver card names the vehicle the way every other HALA MOVE surface does: in its colour, with the
// cab as it is ("Blue Toyota Hilux (Double Cab)"), from the sentence the server sends as vehicle.description.
// Without one (an older server), make and model, never the make twice: the catalogue model already starts with it,
// so "TOYOTA" + "Toyota Hilux (Single Cab)" read "Toyota Toyota Hilux (Single Cab)".
// Run: node verify-track-vehicle.cjs   (exit 0 = every case holds)
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'track.html'), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; } else { fail++; console.log('FAIL ' + name + (detail ? ' - ' + detail : '')); }
}

// Our own committed page, compiled locally to run the function it ships; no outside input.
const m = src.match(/function vehicleLine\([\s\S]*?\r?\n  \}\r?\n/);
check('track.html defines vehicleLine()', !!m);
let vehicleLine = null;
if (m) {
  try { vehicleLine = new Function(m[0] + '\nreturn vehicleLine;')(); } catch (e) { check('vehicleLine() parses', false, e.message); }
}
if (vehicleLine) {
  const cases = [
    ['the server sentence wins', { description: 'Blue Toyota Hilux (Double Cab)', make: 'TOYOTA', model: 'Toyota Hilux (Single Cab)' }, 'Blue Toyota Hilux (Double Cab)'],
    ['no sentence: the make is not doubled', { make: 'TOYOTA', model: 'Toyota Hilux (Single Cab)' }, 'Toyota Hilux (Single Cab)'],
    ['no sentence: a make the model lacks is kept, capitals softened', { make: 'OPEL', model: 'Corsa Utility' }, 'Opel Corsa Utility'],
    ['the model alone', { model: 'Isuzu D-Max' }, 'Isuzu D-Max'],
    ['nothing known reads nothing', {}, ''],
    ['no vehicle block reads nothing', undefined, ''],
  ];
  for (const [name, veh, want] of cases) {
    let got;
    try { got = vehicleLine(veh); } catch (e) { got = 'threw ' + e.message; }
    check(name, got === want, 'got "' + got + '", want "' + want + '"');
  }
}
check('the card draws vehicleLine()', /\$\('vehicle'\)\.textContent\s*=\s*vehicleLine\(/.test(src));

const total = pass + fail;
console.log((fail ? 'TRACK VEHICLE: FAIL ' : 'TRACK VEHICLE: PASS ') + pass + '/' + total);
process.exit(fail || total === 0 ? 1 : 0);
