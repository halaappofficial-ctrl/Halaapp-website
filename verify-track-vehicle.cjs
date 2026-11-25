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

// THE PICTURE OF THE VEHICLE (2026-11-25). The server sends vehicle.image_url, the same picture the app's tracking card
// and the booking page show, in the vehicle's colour. A driver with no face photo showed only his initial and nothing
// of the vehicle (job 189d0aae). The page loads it only from our own backend's /assets/vehicles/, the host it already
// reads the trip from, so a URL in a driver row can never make the page call out anywhere else.
const apiM = src.match(/var API = '([^']+)'/);
check('track.html names its API', !!apiM);
const pm = src.match(/function vehiclePic\([\s\S]*?\r?\n  \}\r?\n/);
check('track.html defines vehiclePic()', !!pm);
let vehiclePic = null;
if (pm) {
  try { vehiclePic = new Function(pm[0] + '\nreturn vehiclePic;')(); } catch (e) { check('vehiclePic() parses', false, e.message); }
}
if (vehiclePic && apiM) {
  const api = apiM[1];
  const host = new URL(api).host;
  const ours = 'https://' + host + '/assets/vehicles/one_ton.blue.v2.jpg';
  const pics = [
    ['our own vehicle picture is shown', ours, ours],
    ['the plain picture, no colour, is shown', 'https://' + host + '/assets/vehicles/one_ton.v2.jpg', 'https://' + host + '/assets/vehicles/one_ton.v2.jpg'],
    ['another host is refused', 'https://evil.example/assets/vehicles/one_ton.v2.jpg', null],
    ['a look-alike host is refused', 'https://' + host + '.evil.example/assets/vehicles/one_ton.v2.jpg', null],
    ['plain http is refused', 'http://' + host + '/assets/vehicles/one_ton.v2.jpg', null],
    ['a path outside the vehicle pictures is refused', 'https://' + host + '/api/track/abc', null],
    ['a climb out of the folder is refused', 'https://' + host + '/assets/vehicles/../../api/x.jpg', null],
    ['a URL carrying a quote is refused', 'https://' + host + "/assets/vehicles/x'onerror=alert(1).jpg", null],
    ['nothing sent shows nothing', undefined, null],
    ['an empty string shows nothing', '', null],
  ];
  for (const [name, url, want] of pics) {
    let got;
    try { got = vehiclePic(url, api); } catch (e) { got = 'threw ' + e.message; }
    check(name, got === want, 'got "' + got + '", want "' + want + '"');
  }
}
check('the card has a picture slot', /<img[^>]*id="vpic"/.test(src));
check('the card draws vehiclePic(veh.image_url, API)', /vehiclePic\(veh\.image_url,\s*API\)/.test(src));
check('a covered vehicle says so on the card', /veh\.cover\s*[!=]==\s*'covered'/.test(src));

const total = pass + fail;
console.log((fail ? 'TRACK VEHICLE: FAIL ' : 'TRACK VEHICLE: PASS ') + pass + '/' + total);
process.exit(fail || total === 0 ? 1 : 0);
