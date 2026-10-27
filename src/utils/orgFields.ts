/** The organization details a change request can carry, in the order they are shown. */
export const ORG_FIELDS: { key: 'name' | 'contactEmail' | 'contactPhone' | 'address' | 'description'; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'contactEmail', label: 'Contact email' },
  { key: 'contactPhone', label: 'Contact phone' },
  { key: 'address', label: 'Address' },
  { key: 'description', label: 'Description' },
];

export const orgFieldLabel = (key: string) =>
  key === 'documents' ? 'Documents' : key === 'country' ? 'Country' : (ORG_FIELDS.find((f) => f.key === key)?.label ?? key);

export const DOCUMENT_TYPES = ['Business permit', 'Government ID', 'Tax registration', 'Other'];
