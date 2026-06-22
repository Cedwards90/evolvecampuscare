// Reference list of CMF (Case Management Form) identified needs.
// Numbering matches the Evolve Foundation paper form.
export const CMF_NEEDS: { code: number; label: string }[] = [
  { code: 1, label: 'Academic Achievement' },
  { code: 2, label: 'Alcohol, Tobacco & Other Drugs' },
  { code: 3, label: 'Cultural Integration & Assimilation' },
  { code: 4, label: 'Crime' },
  { code: 5, label: 'Delinquency' },
  { code: 6, label: 'Employment' },
  { code: 7, label: 'Gang Involvement' },
  { code: 8, label: 'Housing Issues' },
  { code: 9, label: 'Juvenile Justice Issues' },
  { code: 10, label: 'Lack of Recreational Opportunities' },
  { code: 11, label: 'Poverty' },
  { code: 12, label: 'Public Health Issues' },
  { code: 13, label: 'Public Safety' },
  { code: 14, label: 'Suspension-Expulsion' },
  { code: 15, label: 'Teen Pregnancy' },
  { code: 16, label: 'Violence' },
  { code: 17, label: 'Other' },
];

export const CMF_CONTACT_TYPES = [
  'Email',
  'Phone',
  'In-Person',
  'Client Site',
  'Office',
  'Evolve App',
  'Prep/Research',
  'Other',
] as const;

export function needLabel(code: number): string {
  return CMF_NEEDS.find((n) => n.code === code)?.label || `#${code}`;
}
