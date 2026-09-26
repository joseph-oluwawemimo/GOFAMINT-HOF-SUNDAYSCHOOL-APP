import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLoginIdentifier } from '../src/utils/loginIdentifier.js';
import { buildWhatsAppDirectLink, normalizePhoneNumber } from '../src/utils/phoneUtils.js';

test('Departmental Superintendent login initials ADS, YDS, CDS resolve accurately', () => {
  // Adult Departmental Superintendent (ADS)
  assert.equal(normalizeLoginIdentifier('ADS'), 'ads@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('ads'), 'ads@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('  ads  '), 'ads@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('adultsuperintendent'), 'ads@gofamint-hof.internal');

  // Youth Departmental Superintendent (YDS)
  assert.equal(normalizeLoginIdentifier('YDS'), 'akintayoakinsunmade@gmail.com');
  assert.equal(normalizeLoginIdentifier('yds'), 'akintayoakinsunmade@gmail.com');
  assert.equal(normalizeLoginIdentifier('  yds  '), 'akintayoakinsunmade@gmail.com');
  assert.equal(normalizeLoginIdentifier('youthsuperintendent'), 'akintayoakinsunmade@gmail.com');

  // Children Departmental Superintendent (CDS)
  assert.equal(normalizeLoginIdentifier('CDS'), 'cds@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('cds'), 'cds@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('  cds  '), 'cds@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('childrensuperintendent'), 'cds@gofamint-hof.internal');
});

test('Student Profile Link WhatsApp direct-to-DM messaging picks phone digits', () => {
  const sampleUrl = 'https://sunday-school.gofamint.org/#visitor-profile/tok_test123';
  const sampleMessage = `Hello Brother John! Access your Sunday School student profile and live report card here: ${sampleUrl}`;

  // Nigerian phone number with leading 0
  const linkWithPhone = buildWhatsAppDirectLink('08031234567', sampleMessage);
  assert.match(linkWithPhone, /^https:\/\/wa\.me\/2348031234567\?text=/);
  assert.ok(linkWithPhone.includes(encodeURIComponent(sampleUrl)));

  // International format with +234
  const linkWithIntl = buildWhatsAppDirectLink('+234 803 123 4567', sampleMessage);
  assert.match(linkWithIntl, /^https:\/\/wa\.me\/2348031234567\?text=/);

  // Missing / empty phone falls back softly to general WhatsApp share without crashing
  const linkNoPhone = buildWhatsAppDirectLink('', sampleMessage);
  assert.match(linkNoPhone, /^https:\/\/wa\.me\/\?text=/);
});

test('Phone Number Intelligence correctly normalizes Nigerian numbers to E.164', () => {
  assert.equal(normalizePhoneNumber('09035123456'), '+2349035123456');
  assert.equal(normalizePhoneNumber('08023456789'), '+2348023456789');
  assert.equal(normalizePhoneNumber('+234 903 512 3456'), '+2349035123456');
});
