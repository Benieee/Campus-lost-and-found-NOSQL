import { connectDatabase, disconnectDatabase } from '../config/database';
import { AuditLog, Claim, FoundItem, Location, LostItem, User } from '../models';
import { hashPassword } from '../utils/auth';

const DEMO_STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD || 'StaffDemo!2026';
const DEMO_STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || 'StudentDemo!2026';

export async function seedDatabase(options: { reset?: boolean } = {}) {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !options.reset) {
    console.log('Database already contains records. Run with --reset to wipe and re-seed fictional demo data.');
    return { skipped: true };
  }

  if (options.reset) {
    await Promise.all([
      AuditLog.deleteMany({}),
      Claim.deleteMany({}),
      LostItem.deleteMany({}),
      FoundItem.deleteMany({}),
      Location.deleteMany({}),
      User.deleteMany({})
    ]);
  }

  const [staffHash, studentHash] = await Promise.all([
    hashPassword(DEMO_STAFF_PASSWORD),
    hashPassword(DEMO_STUDENT_PASSWORD)
  ]);

  // 1. Fictional Campus Locations
  const locations = await Location.insertMany([
    {
      name: 'Main Gate Security Desk',
      code: 'SEC-MAIN',
      buildingArea: 'Campus Entrance',
      isHoldingDesk: true,
      description: '24-hour proposed central intake and secure storage desk for found property.'
    },
    {
      name: 'Main Library Circulation Desk',
      code: 'LIB-DESK',
      buildingArea: 'Academic Core',
      isHoldingDesk: true,
      description: 'Front desk inside the Main Library for books, electronics, and IDs.'
    },
    {
      name: 'Dean of Students Office',
      code: 'DOS-OFF',
      buildingArea: 'Administration Block',
      isHoldingDesk: true,
      description: 'Student affairs verification and release office.'
    },
    {
      name: 'ICT Lab Block B',
      code: 'ICT-B',
      buildingArea: 'Computing & Informatics Wing',
      isHoldingDesk: true,
      description: 'Computer labs and technician reception desk.'
    },
    {
      name: 'Science Complex',
      code: 'SCI-01',
      buildingArea: 'North Academic Zone',
      isHoldingDesk: false,
      description: 'Lecture halls and science laboratories.'
    },
    {
      name: 'Student Dining Hall',
      code: 'DIN-01',
      buildingArea: 'Central Campus',
      isHoldingDesk: false,
      description: 'Main cafeteria and seating courtyard.'
    },
    {
      name: 'Chapel Auditorium',
      code: 'CHP-01',
      buildingArea: 'Central Campus',
      isHoldingDesk: false,
      description: 'Main assembly hall and surrounding benches.'
    },
    {
      name: 'Residential Hostels Walkway',
      code: 'HST-WK',
      buildingArea: 'East Residential Zone',
      isHoldingDesk: false,
      description: 'Pathway connecting residence halls and study gazebos.'
    }
  ]);

  const locByCode = new Map(locations.map((loc) => [loc.code, loc]));

  // 2. Fictional Users (2 Staff + 4 Students)
  const users = await User.insertMany([
    {
      studentId: 'BU-STF-001',
      fullName: 'Grace Namutebi (Demo Staff)',
      email: 'staff.admin@example.edu',
      course: 'Student Affairs & Security Desk',
      phone: '+256-700-000101',
      passwordHash: staffHash,
      role: 'admin',
      isActive: true
    },
    {
      studentId: 'BU-STF-002',
      fullName: 'Daniel Okello (Demo Staff)',
      email: 'library.staff@example.edu',
      course: 'Main Library Services',
      phone: '+256-700-000102',
      passwordHash: staffHash,
      role: 'admin',
      isActive: true
    },
    {
      studentId: '24/BIT/BU/R/0101',
      fullName: 'Amina Nakato',
      email: 'amina.nakato@example.edu',
      course: 'BSc Information Technology',
      phone: '+256-700-000201',
      passwordHash: studentHash,
      role: 'student',
      isActive: true
    },
    {
      studentId: '23/BCS/BU/R/0204',
      fullName: 'Brian Ssemwogerere',
      email: 'brian.ssemwogerere@example.edu',
      course: 'BSc Computer Science',
      phone: '+256-700-000202',
      passwordHash: studentHash,
      role: 'student',
      isActive: true
    },
    {
      studentId: '25/BBA/BU/R/0312',
      fullName: 'Claire Uwimana',
      email: 'claire.uwimana@example.edu',
      course: 'Bachelor of Business Administration',
      phone: '+256-700-000203',
      passwordHash: studentHash,
      role: 'student',
      isActive: true
    },
    {
      studentId: '24/BED/BU/R/0419',
      fullName: 'David Ochieng',
      email: 'david.ochieng@example.edu',
      course: 'Bachelor of Education',
      phone: '+256-700-000204',
      passwordHash: studentHash,
      role: 'student',
      isActive: true
    }
  ]);

  const [staffAdmin, staffLib, amina, brian, claire, david] = users;
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 3. Fictional Lost-Item Reports (6 reports)
  const lostItems = await LostItem.insertMany([
    {
      owner: amina._id,
      itemName: 'Silver HP ProBook Laptop Charger',
      category: 'Electronics',
      description: '65W HP laptop charger with a blue-tipped barrel connector and wrapped cable tie.',
      identifyingDetails: 'Has a small green masking-tape label with initials "A.N." near the power brick.',
      lastKnownLocation: 'ICT Lab Block B',
      locationRef: locByCode.get('ICT-B')?._id,
      dateLost: daysAgo(3),
      approximateTimeLost: '16:15',
      contactPreference: 'email',
      status: 'Missing'
    },
    {
      owner: brian._id,
      itemName: 'Casio fx-991EX Scientific Calculator',
      category: 'Electronics',
      description: 'Black and silver solar scientific calculator with slide-on hard cover.',
      identifyingDetails: 'Battery compartment lid has a tiny scratch shaped like a triangle; sticker inside cover says "CS-204".',
      lastKnownLocation: 'Science Complex',
      locationRef: locByCode.get('SCI-01')?._id,
      dateLost: daysAgo(5),
      approximateTimeLost: '11:30',
      contactPreference: 'phone',
      status: 'Matched'
    },
    {
      owner: claire._id,
      itemName: 'Navy Blue Canvas Backpack',
      category: 'Bags & Wallets',
      description: 'Medium navy backpack with two side mesh pockets and a front zip compartment.',
      identifyingDetails: 'Contains an accounting spiral notebook and a yellow plastic ruler in the front pocket; zipper pull on top is knotted twine.',
      lastKnownLocation: 'Main Library Circulation Desk',
      locationRef: locByCode.get('LIB-DESK')?._id,
      dateLost: daysAgo(8),
      approximateTimeLost: '18:00',
      contactPreference: 'email',
      status: 'Claimed'
    },
    {
      owner: david._id,
      itemName: 'Brown Leather Bi-Fold Wallet',
      category: 'Bags & Wallets',
      description: 'Compact brown leather wallet without cash mentioned publicly, lost near lunch seating.',
      identifyingDetails: 'Contains a fictional student library pass ending in 0419 and a faded receipt from the campus bookshop.',
      lastKnownLocation: 'Student Dining Hall',
      locationRef: locByCode.get('DIN-01')?._id,
      dateLost: daysAgo(2),
      approximateTimeLost: '13:10',
      contactPreference: 'in_app',
      status: 'Missing'
    },
    {
      owner: amina._id,
      itemName: 'Bunch of Three Hostel Keys on Blue Lanyard',
      category: 'Keys',
      description: 'Three silver keys attached to a fabric blue neck lanyard.',
      identifyingDetails: 'Includes a small round brass padlock key stamped "302" and a plastic key fob with a smiley sticker.',
      lastKnownLocation: 'Residential Hostels Walkway',
      locationRef: locByCode.get('HST-WK')?._id,
      dateLost: daysAgo(1),
      approximateTimeLost: '07:45',
      contactPreference: 'phone',
      status: 'Missing'
    },
    {
      owner: brian._id,
      itemName: 'Hardcover Data Structures Textbook',
      category: 'Books & Stationery',
      description: 'Blue paperback/hardcover computing textbook left on a bench after morning assembly.',
      identifyingDetails: 'Owner wrote fictional margin notes on page 42 and folded the back cover corner.',
      lastKnownLocation: 'Chapel Auditorium',
      locationRef: locByCode.get('CHP-01')?._id,
      dateLost: daysAgo(12),
      approximateTimeLost: '10:00',
      contactPreference: 'email',
      status: 'Closed'
    }
  ]);

  // 4. Fictional Found Items (6 items)
  const foundItems = await FoundItem.insertMany([
    {
      reporter: staffLib._id,
      itemName: 'HP 65W Laptop Power Adapter',
      category: 'Electronics',
      description: 'Black HP laptop charger with blue pin connector found plugged under a workstation.',
      identifyingDetails: 'Green tape on brick has handwritten initials "A.N." and serial suffix 88K2.',
      locationFound: 'ICT Lab Block B',
      locationRef: locByCode.get('ICT-B')?._id,
      dateFound: daysAgo(3),
      holdingLocation: 'ICT Lab Block B',
      status: 'Stored'
    },
    {
      reporter: david._id,
      itemName: 'Casio Scientific Calculator (Black)',
      category: 'Electronics',
      description: 'Casio scientific calculator with protective plastic cover picked up in Lecture Room 4.',
      identifyingDetails: 'Inside cover has small label "CS-204" and triangular scratch on back plate.',
      locationFound: 'Science Complex',
      locationRef: locByCode.get('SCI-01')?._id,
      dateFound: daysAgo(4),
      holdingLocation: 'Main Gate Security Desk',
      status: 'Claim Pending'
    },
    {
      reporter: staffAdmin._id,
      itemName: 'Navy Blue Student Backpack',
      category: 'Bags & Wallets',
      description: 'Navy canvas backpack found beside reading carrels on the upper floor.',
      identifyingDetails: 'Top zipper pull replaced with knotted twine; contains accounting notebook and yellow ruler.',
      locationFound: 'Main Library Circulation Desk',
      locationRef: locByCode.get('LIB-DESK')?._id,
      dateFound: daysAgo(8),
      holdingLocation: 'Main Library Circulation Desk',
      status: 'Returned'
    },
    {
      reporter: claire._id,
      itemName: 'Brown Bi-Fold Wallet',
      category: 'Bags & Wallets',
      description: 'Brown leather wallet turned in after lunch period at the dining hall counter.',
      identifyingDetails: 'Holds a fictional library card ending in 0419 and a bookshop receipt.',
      locationFound: 'Student Dining Hall',
      locationRef: locByCode.get('DIN-01')?._id,
      dateFound: daysAgo(2),
      holdingLocation: 'Dean of Students Office',
      status: 'Claim Pending'
    },
    {
      reporter: staffAdmin._id,
      itemName: 'Set of Keys on Blue Fabric Lanyard',
      category: 'Keys',
      description: 'Key ring with three metallic keys on a blue lanyard turned in at security.',
      identifyingDetails: 'Brass padlock key marked "302" plus yellow smiley fob.',
      locationFound: 'Residential Hostels Walkway',
      locationRef: locByCode.get('HST-WK')?._id,
      dateFound: daysAgo(1),
      holdingLocation: 'Main Gate Security Desk',
      status: 'Stored'
    },
    {
      reporter: staffLib._id,
      itemName: 'Black Insulated Water Bottle',
      category: 'Accessories',
      description: 'Matte black stainless-steel reusable water bottle left near auditorium entrance.',
      identifyingDetails: 'Small dent near the base and blue silicone ring under the screw cap.',
      locationFound: 'Chapel Auditorium',
      locationRef: locByCode.get('CHP-01')?._id,
      dateFound: daysAgo(15),
      holdingLocation: 'Main Gate Security Desk',
      status: 'Archived'
    }
  ]);

  const [foundCharger, foundCalc, foundBackpack, foundWallet, foundKeys] = foundItems;
  const [, lostCalc, lostBackpack, lostWallet] = lostItems;

  // 5. Fictional Claims (5 claims across all statuses)
  const claims = await Claim.insertMany([
    {
      referenceCode: 'BLF-2026-1001A1',
      claimant: claire._id,
      foundItem: foundBackpack._id,
      linkedLostItem: lostBackpack._id,
      explanation: 'I accidentally left my navy backpack near the upper-floor study carrels before evening prayers.',
      identifyingProof: 'Top zipper pull is tied with brown twine, and inside the front pocket is my accounting notebook and a yellow ruler.',
      status: 'Approved',
      verificationNotes: 'Student ID verified in person; twine pull and notebook contents matched stored record. Item released.',
      reviewedBy: staffAdmin._id,
      reviewedAt: daysAgo(6)
    },
    {
      referenceCode: 'BLF-2026-1002B2',
      claimant: brian._id,
      foundItem: foundCalc._id,
      linkedLostItem: lostCalc._id,
      explanation: 'Left my Casio fx-991EX on the front desk after the Discrete Mathematics tutorial in Science Complex.',
      identifyingProof: 'Inside the slide cover is a small white label reading "CS-204" and a triangular scratch on the battery cover.',
      status: 'Under Review',
      verificationNotes: 'Details closely match stored record. Scheduled student pickup verification at Main Gate desk.',
      reviewedBy: staffAdmin._id,
      reviewedAt: daysAgo(1)
    },
    {
      referenceCode: 'BLF-2026-1003C3',
      claimant: david._id,
      foundItem: foundWallet._id,
      linkedLostItem: lostWallet._id,
      explanation: 'Dropped my brown leather wallet near the Student Dining Hall tray return area around 1:10 PM.',
      identifyingProof: 'Contains my library card ending in 0419 and a folded campus bookshop receipt.',
      status: 'Pending',
      verificationNotes: ''
    },
    {
      referenceCode: 'BLF-2026-1004D4',
      claimant: david._id,
      foundItem: foundCharger._id,
      explanation: 'I think this might be my HP charger that I misplaced last week during lab work.',
      identifyingProof: 'Black 65W charger with standard cable.',
      status: 'Rejected',
      verificationNotes: 'Claimant could not identify the unique taped initials on the power brick.',
      reviewedBy: staffLib._id,
      reviewedAt: daysAgo(2)
    },
    {
      referenceCode: 'BLF-2026-1005E5',
      claimant: amina._id,
      foundItem: foundKeys._id,
      explanation: 'My blue lanyard with hostel room keys slipped out of my coat pocket along the hostel walkway this morning.',
      identifyingProof: 'Three silver keys with a brass padlock key engraved "302" and a small smiley fob.',
      status: 'Pending',
      verificationNotes: ''
    }
  ]);

  // Update foundKeys status to Claim Pending since claim 5 is Pending
  foundKeys.status = 'Claim Pending';
  await foundKeys.save();

  // 6. Initial Audit Logs
  await AuditLog.insertMany([
    {
      actor: staffAdmin._id,
      actorRole: 'admin',
      action: 'CLAIM_APPROVED',
      entityType: 'Claim',
      entityId: claims[0]._id,
      summary: `Claim ${claims[0].referenceCode} approved and "${foundBackpack.itemName}" marked Returned.`,
      metadata: { previousStatus: 'Under Review', newStatus: 'Approved' }
    },
    {
      actor: staffAdmin._id,
      actorRole: 'admin',
      action: 'CLAIM_UNDER_REVIEW',
      entityType: 'Claim',
      entityId: claims[1]._id,
      summary: `Claim ${claims[1].referenceCode} moved to Under Review for in-person verification.`,
      metadata: { previousStatus: 'Pending', newStatus: 'Under Review' }
    },
    {
      actor: staffLib._id,
      actorRole: 'admin',
      action: 'CLAIM_REJECTED',
      entityType: 'Claim',
      entityId: claims[3]._id,
      summary: `Claim ${claims[3].referenceCode} rejected after ownership verification mismatch.`,
      metadata: { previousStatus: 'Pending', newStatus: 'Rejected' }
    }
  ]);

  console.log(
    `Seeded fictional demo data: ${users.length} users, ${locations.length} locations, ${lostItems.length} lost reports, ${foundItems.length} found items, ${claims.length} claims.`
  );
  return { skipped: false };
}

if (require.main === module) {
  const reset = process.argv.includes('--reset');
  connectDatabase()
    .then(() => seedDatabase({ reset }))
    .then(() => disconnectDatabase())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('Seed failed:', err instanceof Error ? err.message : err);
      await disconnectDatabase();
      process.exit(1);
    });
}
