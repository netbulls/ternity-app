import { db } from './index.js';
import {
  users,
  clients,
  projects,
  projectMembers,
  labels,
  leaveTypes,
  leaveAllowances,
} from './schema.js';

async function seed() {
  console.log('Seeding database...');

  // Users
  const [user1, user2] = await db
    .insert(users)
    .values([
      {
        displayName: 'Przemyslaw Rudzki',
        email: 'przemek@ternity.xyz',
        phone: '+48123456789',
        globalRole: 'admin',
      },
      {
        displayName: 'John Smith',
        email: 'john@ternity.xyz',
        phone: '+48987654321',
        globalRole: 'user',
      },
    ])
    .returning();

  console.log(`  Created ${2} users`);

  // Clients
  const [client1, client2] = await db
    .insert(clients)
    .values([{ name: 'Netbulls' }, { name: 'External Corp' }])
    .returning();

  console.log(`  Created ${2} clients`);

  // Projects
  const [proj1, proj2, proj3] = await db
    .insert(projects)
    .values([
      { clientId: client1!.id, name: 'Ternity App', color: '#00D4AA' },
      { clientId: client1!.id, name: 'Exegy', color: '#8B93FF' },
      { clientId: client2!.id, name: 'Legal500', color: '#FFB347' },
    ])
    .returning();

  console.log(`  Created ${3} projects`);

  // Project members
  await db.insert(projectMembers).values([
    { userId: user1!.id, projectId: proj1!.id, role: 'manager' },
    { userId: user1!.id, projectId: proj2!.id, role: 'user' },
    { userId: user1!.id, projectId: proj3!.id, role: 'manager' },
    { userId: user2!.id, projectId: proj1!.id, role: 'user' },
    { userId: user2!.id, projectId: proj2!.id, role: 'user' },
  ]);

  console.log(`  Created project memberships`);

  // Labels
  await db.insert(labels).values([
    { name: 'jira', color: '#00D4AA' },
    { name: 'meeting', color: '#8B93FF' },
    { name: 'backend', color: '#FFB347' },
    { name: 'frontend', color: '#FF6B6B' },
    { name: 'devops', color: '#4ECDC4' },
  ]);

  console.log(`  Created ${5} labels`);

  // Leave types
  const [holiday, sick] = await db
    .insert(leaveTypes)
    .values([
      { name: 'Holiday', daysPerYear: 26 },
      { name: 'Sick Leave', daysPerYear: 14 },
    ])
    .returning();

  console.log(`  Created ${2} leave types`);

  // Leave allowances (current year)
  const year = new Date().getFullYear();
  await db.insert(leaveAllowances).values([
    { userId: user1!.id, leaveTypeId: holiday!.id, year, totalDays: 26, usedDays: 8 },
    { userId: user1!.id, leaveTypeId: sick!.id, year, totalDays: 14, usedDays: 2 },
    { userId: user2!.id, leaveTypeId: holiday!.id, year, totalDays: 26, usedDays: 4 },
    { userId: user2!.id, leaveTypeId: sick!.id, year, totalDays: 14, usedDays: 0 },
  ]);

  console.log(`  Created leave allowances`);
  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
