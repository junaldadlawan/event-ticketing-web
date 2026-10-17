/** The accounts in the API's demo seed (db/seed/demo-data.sql), each with its own password. Dev builds only. */
export type TestTone = 'super' | 'admin' | 'owner' | 'organizer' | 'staff' | 'customer';

/** One section of the panel per kind of account, in this order. */
export const TEST_GROUPS: { tone: TestTone; title: string }[] = [
  { tone: 'super', title: 'Super admin' },
  { tone: 'admin', title: 'Platform admins' },
  { tone: 'owner', title: 'Organization owners' },
  { tone: 'organizer', title: 'Organizer' },
  { tone: 'staff', title: 'Check-in staff' },
  { tone: 'customer', title: 'Customers' },
];

export const TEST_USERS: { name: string; email: string; password: string; tone: TestTone }[] = [
  { name: 'Sasha Valdez', email: 'superadmin@demo.test', password: 'SuperAdmin@Demo1', tone: 'super' },
  { name: 'Avery Santos', email: 'admin1@demo.test', password: 'Admin1@Demo', tone: 'admin' },
  { name: 'Morgan Reyes', email: 'admin2@demo.test', password: 'Admin2@Demo', tone: 'admin' },
  { name: 'Owen Dela Mercado', email: 'owner@demo.test', password: 'Owner@Demo1', tone: 'owner' },
  { name: 'Rowan Castillo', email: 'owner2@demo.test', password: 'Owner@Demo2', tone: 'owner' },
  { name: 'Paula Ramos', email: 'organizer@demo.test', password: 'Organizer@Demo1', tone: 'organizer' },
  { name: 'Sam Villanueva', email: 'scanner@demo.test', password: 'Scanner@Demo1', tone: 'staff' },
  { name: 'Jamie Cruz', email: 'customer1@demo.test', password: 'Customer1@Demo', tone: 'customer' },
  { name: 'Taylor Lim', email: 'customer2@demo.test', password: 'Customer2@Demo', tone: 'customer' },
  { name: 'Riley Park', email: 'customer3@demo.test', password: 'Customer3@Demo', tone: 'customer' },
  { name: 'Casey Tan', email: 'customer4@demo.test', password: 'Customer4@Demo', tone: 'customer' },
  { name: 'Jordan Dela Cruz', email: 'customer5@demo.test', password: 'Customer5@Demo', tone: 'customer' },
];
