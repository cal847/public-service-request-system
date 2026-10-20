/**
 * Demo data: 6 citizens and 58 randomised service requests with history.
 */
const bcrypt = require('bcryptjs');
const db = require('./db');
const { CATEGORIES } = require('./utils/constants');
const { generateTrackingCode } = require('./utils/tracking');

const TOTAL_REQUESTS = 58;
const DEMO_PASSWORD = 'Citizen@123';
const MARKER_EMAIL = 'grace.wanjiku@example.com';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const CITIZENS = [
  { name: 'Grace Wanjiku', email: MARKER_EMAIL, phone: '+254711000001', idNumber: '30000001' },
  { name: 'Peter Kamau', email: 'peter.kamau@example.com', phone: '+254711000002', idNumber: '30000002' },
  { name: 'Mary Njeri', email: 'mary.njeri@example.com', phone: '+254711000003', idNumber: '30000003' },
  { name: 'John Mwangi', email: 'john.mwangi@example.com', phone: '+254711000004', idNumber: '30000004' },
  { name: 'Faith Muthoni', email: 'faith.muthoni@example.com', phone: '+254711000005', idNumber: '30000005' },
  { name: 'Samuel Karanja', email: 'samuel.karanja@example.com', phone: '+254711000006', idNumber: '30000006' },
];

// Repeated entries make the bigger towns more common.
const LOCATIONS = ["Murang'a", "Murang'a", "Murang'a", 'Kenol', 'Kenol', 'Kangari'];

const DESCRIPTIONS = {
  Streetlight: [
    'The streetlight near the bus stage has been out for over two weeks and the road is very dark at night.',
    'Several lights along the main road flicker on and off every evening.',
    'A streetlight pole was knocked down by a lorry and the wires are hanging low.',
    'The floodlight at the market has not worked since the rains, and traders close early because of it.',
    'Lights outside the primary school are not working, which makes walking home unsafe for pupils.',
    'The security light at the junction stays on all day and wastes power.',
  ],
  Water: [
    'There has been no water supply in our area since Monday.',
    'A burst pipe is flooding the access road and wasting a lot of water.',
    'The water coming from the taps is brown and smells bad.',
    'Water pressure is very low and only trickles out in the evening.',
    'The communal water kiosk has been locked for a week and residents cannot get water.',
    'A leaking pipe near the market has been dripping for days and the ground is muddy.',
  ],
  'Garbage collection': [
    'Garbage has not been collected in our estate for over a week.',
    'The bins near the market are overflowing and attracting flies and stray dogs.',
    'Rubbish has been dumped behind the shops and is blocking the drainage.',
    'The collection truck skips our street every time and waste keeps piling up.',
    'There is no skip bin at the stage, so passengers throw rubbish on the roadside.',
    'Uncollected waste is being burned in the open and the smoke is affecting residents.',
  ],
  Roads: [
    'A large pothole on the main road is damaging vehicles and boda boda motorcycles.',
    'The drainage next to the road is blocked and floods whenever it rains.',
    'The road to the health centre has become impassable and is very muddy.',
    'The speed bump near the school has worn away and cars speed through.',
    'A culvert has collapsed and the road edge is caving in.',
    'Road markings at the junction have faded, which has caused several near accidents.',
  ],
  Other: [
    'Stray dogs are roaming near the primary school and frightening children.',
    'There is illegal dumping behind the shops at the edge of town.',
    'A public toilet at the market has been closed for weeks and has no running water.',
    'Loud music from a bar continues past midnight every weekend.',
    'A tree has fallen next to the footpath and is blocking it.',
    'The public notice board at the stage has fallen and is lying on the pavement.',
  ],
};

const IN_PROGRESS_NOTES = {
  Streetlight: [
    'A technician has been assigned and will inspect the lights this week.',
    'We have ordered replacement lamps. Repairs will follow once they arrive.',
    'The electrical team has logged this fault and scheduled a site visit.',
  ],
  Water: [
    'The water department has sent a team to locate the fault.',
    'Our engineers are checking the main line. Supply should return in the next few days.',
    'A repair crew has been scheduled and will be on site shortly.',
  ],
  'Garbage collection': [
    'The waste collection team has added your area to this week\u2019s route.',
    'A collection truck has been scheduled for your estate.',
    'We have notified the contractor and are following up on the missed collections.',
  ],
  Roads: [
    'The roads team has inspected the site and scheduled the repair.',
    'A work crew has been assigned and materials are being prepared.',
    'This has been added to the current maintenance schedule.',
  ],
  Other: [
    'The relevant officer has been assigned and is looking into it.',
    'We have referred your report to the responsible department.',
    'A county officer will visit the location this week.',
  ],
};

const RESOLVED_NOTES = {
  Streetlight: [
    'The faulty lights have been replaced and are working again. Thank you for reporting.',
    'The pole has been repaired and the lights are back on.',
    'Repairs completed and the lights tested successfully.',
  ],
  Water: [
    'The pipe has been repaired and water supply has been restored.',
    'The fault has been fixed and the water is now running normally.',
    'Repairs are complete. Please report again if the problem returns.',
  ],
  'Garbage collection': [
    'The backlog has been cleared and collection is back on schedule.',
    'The bins have been emptied and your area is now on a regular route.',
    'The waste has been removed. Thank you for letting us know.',
  ],
  Roads: [
    'The road has been repaired and reopened to traffic.',
    'The drainage has been cleared and the road is passable again.',
    'Repair work is complete. Thank you for your patience.',
  ],
  Other: [
    'The matter has been resolved. Thank you for reporting it.',
    'The issue has been handled by the responsible department.',
    'Action has been taken and the case is now closed.',
  ],
};

/* ---------- helpers ---------- */
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

function pickStatus() {
  const roll = Math.random();
  if (roll < 0.26) return 'Pending';
  if (roll < 0.58) return 'In Progress';
  return 'Resolved';
}

/* ---------- seeding ---------- */
function seedDemo() {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(MARKER_EMAIL)) {
    console.log('Demo data already present. Skipping seed.');
    return { seeded: false };
  }

  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!admin) throw new Error('No admin account found. Make sure db.js has run first.');

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, phone, id_number, password_hash) VALUES (?, ?, ?, ?, ?)'
  );
  const insertRequest = db.prepare(
    `INSERT INTO requests (tracking_code, user_id, category, location, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertHistory = db.prepare(
    `INSERT INTO request_history (request_id, from_status, to_status, note, changed_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const now = Date.now();
  const counts = { Pending: 0, 'In Progress': 0, Resolved: 0 };

  db.transaction(() => {
    const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
    const userIds = CITIZENS.map((c) =>
      insertUser.run(c.name, c.email, c.phone, c.idNumber, hash).lastInsertRowid
    );

    /* 1. Build every request in memory first. */
    const records = [];
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
      const status = pickStatus();
      const category = pick(CATEGORIES);

      // Newer for open requests, older for resolved ones.
      const ageDays =
        status === 'Pending' ? rand(0.05, 20)
        : status === 'In Progress' ? rand(2, 45)
        : rand(8, 150);
      const createdAt = now - ageDays * DAY;

      const events = [];
      let updatedAt = createdAt;

      const owner = Math.random() < 0.35 ? null : pick(userIds); // ~35% guests
      events.push({ from: null, to: 'Pending', note: 'Request submitted.', by: owner, at: createdAt });

      if (status !== 'Pending') {
        const startedAt = Math.min(createdAt + rand(2 * HOUR, 3 * DAY), now - HOUR);
        events.push({ from: 'Pending', to: 'In Progress', note: pick(IN_PROGRESS_NOTES[category]), by: admin.id, at: startedAt });
        updatedAt = startedAt;

        if (status === 'Resolved') {
          const resolvedAt = Math.min(startedAt + rand(1 * DAY, 10 * DAY), now - 30 * 60 * 1000);
          events.push({ from: 'In Progress', to: 'Resolved', note: pick(RESOLVED_NOTES[category]), by: admin.id, at: resolvedAt });
          updatedAt = resolvedAt;
        }
      }

      counts[status]++;
      records.push({
        status, category, owner, createdAt, updatedAt, events,
        location: pick(LOCATIONS),
        description: pick(DESCRIPTIONS[category]),
      });
    }

    /* 2. Insert requests oldest first so ids follow the timeline. */
    records.sort((a, b) => a.createdAt - b.createdAt);
    const history = [];
    for (const r of records) {
      const id = insertRequest.run(
        generateTrackingCode(db, new Date(r.createdAt)),
        r.owner, r.category, r.location, r.description, r.status,
        sqlTime(r.createdAt), sqlTime(r.updatedAt)
      ).lastInsertRowid;
      r.events.forEach((e) => history.push({ ...e, requestId: id }));
    }

    /* 3. Insert history in time order so "Recent activity" reads correctly. */
    history.sort((a, b) => a.at - b.at);
    for (const e of history) {
      insertHistory.run(e.requestId, e.from, e.to, e.note, e.by, sqlTime(e.at));
    }
  })();

  console.log(
    `Seeded ${CITIZENS.length} demo citizens (password: ${DEMO_PASSWORD}) and ${TOTAL_REQUESTS} requests ` +
      `(${counts.Pending} pending, ${counts['In Progress']} in progress, ${counts.Resolved} resolved).`
  );
  return { seeded: true, counts };
}

module.exports = { seedDemo };

// `npm run seed` runs this file directly.
if (require.main === module) seedDemo();