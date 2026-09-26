const ROLE_ALIASES: Record<string, string> = {
  gs: 'gofaminthouseoffavour@gmail.com',
  superintendent: 'gofaminthouseoffavour@gmail.com',
  generalsuperintendent: 'gofaminthouseoffavour@gmail.com',
  pastorolayemi: 'gofaminthouseoffavour@gmail.com',
  olanegan: 'gofaminthouseoffavour@gmail.com',
  superadmin: 'gofaminthouseoffavour@gmail.com',
  admin: 'gofaminthouseoffavour@gmail.com',
  gsec: 'odedeyioluwaseun86@gmail.com',
  generalsecretary: 'odedeyioluwaseun86@gmail.com',
  secretary: 'odedeyioluwaseun86@gmail.com',
  pastorodedeyi: 'odedeyioluwaseun86@gmail.com',
  odedeyi: 'odedeyioluwaseun86@gmail.com',
  asstgsec: 'ifesunkanmisola@gmail.com',
  asstsec: 'ifesunkanmisola@gmail.com',
  asstgeneralsecretary: 'ifesunkanmisola@gmail.com',
  assistantgeneralsecretary: 'ifesunkanmisola@gmail.com',
  assistantsecretary: 'ifesunkanmisola@gmail.com',
  daisi: 'ifesunkanmisola@gmail.com',
  daisiemail: 'daisi@gmail.com',
  recordofficer: 'olaludenike@gmail.com',
  record: 'olaludenike@gmail.com',
  records: 'olaludenike@gmail.com',
  ro: 'olaludenike@gmail.com',
  nike: 'olaludenike@gmail.com',
  nikeemail: 'nike@gmail.com',
  enrollmentofficer: 'favevibes@gmail.com',
  enrollment: 'favevibes@gmail.com',
  eo: 'favevibes@gmail.com',
  favour: 'favevibes@gmail.com',
  favouremail: 'favour@gmail.com',
  treasurer: 'omotolaadaramaja@gmail.com',
  treasury: 'omotolaadaramaja@gmail.com',
  finance: 'omotolaadaramaja@gmail.com',
  oriola: 'omotolaadaramaja@gmail.com',
  oriolaemail: 'oriola@gmail.com',
  youthsuperintendent: 'akintayoakinsunmade@gmail.com',
  deptsuperintendent: 'akintayoakinsunmade@gmail.com',
  akintayo: 'akintayoakinsunmade@gmail.com',
};

const LEGACY_CLASS_ALIASES: Record<string, string> = {
  adulta: 'class_adult_a@gofamint-hof.internal',
  adultclassa: 'class_adult_a@gofamint-hof.internal',
  youtha: 'class_youth_a@gofamint-hof.internal',
  youthclassa: 'class_youth_a@gofamint-hof.internal',
  intermediatea: 'class_intermediate_a@gofamint-hof.internal',
  intermediateclassa: 'class_intermediate_a@gofamint-hof.internal',
};

/** Maps a class ID to a private Auth email without applying officer aliases. */
export function normalizeClassLoginIdentifier(rawClassId: string): string {
  const trimmed = String(rawClassId || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  const compactId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (LEGACY_CLASS_ALIASES[compactId]) return LEGACY_CLASS_ALIASES[compactId];

  const canonicalId = trimmed.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (canonicalId.startsWith('class_')) return `${canonicalId}@gofamint-hof.internal`;
  return `class_${canonicalId}@gofamint-hof.internal`;
}

/** One canonical mapping is shared by browser sign-in and server provisioning. */
export function normalizeLoginIdentifier(rawIdentifier: string): string {
  const trimmed = String(rawIdentifier || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  const cleanId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ROLE_ALIASES[cleanId]) return ROLE_ALIASES[cleanId];
  return normalizeClassLoginIdentifier(trimmed);
}
