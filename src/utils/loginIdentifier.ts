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
  asstgsec: 'daisi@gmail.com',
  asstsec: 'daisi@gmail.com',
  asstgeneralsecretary: 'daisi@gmail.com',
  assistantgeneralsecretary: 'daisi@gmail.com',
  assistantsecretary: 'daisi@gmail.com',
  daisi: 'daisi@gmail.com',
  recordofficer: 'nike@gmail.com',
  record: 'nike@gmail.com',
  records: 'nike@gmail.com',
  nike: 'nike@gmail.com',
  enrollmentofficer: 'favour@gmail.com',
  enrollment: 'favour@gmail.com',
  favour: 'favour@gmail.com',
  treasurer: 'oriola@gmail.com',
  treasury: 'oriola@gmail.com',
  finance: 'oriola@gmail.com',
  oriola: 'oriola@gmail.com',
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
