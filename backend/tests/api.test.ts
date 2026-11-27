import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { createApp } from '../src/app';
import { AuditLog, Claim, FoundItem, Location, LostItem, User } from '../src/models';
import { hashPassword } from '../src/utils/auth';

process.env.NODE_ENV = 'test';

let mongoServer: MongoMemoryServer;
const app = createApp({ authRateLimitMax: 200, claimRateLimitMax: 200 });

async function createAccount(overrides: Partial<{
  studentId: string;
  fullName: string;
  email: string;
  course: string;
  phone: string;
  password: string;
  role: 'student' | 'admin';
}> = {}) {
  const password = overrides.password || 'SecurePass!2026';
  const passwordHash = await hashPassword(password);
  const user = await User.create({
    studentId: overrides.studentId || '24/BIT/BU/R/9001',
    fullName: overrides.fullName || 'Test Student',
    email: (overrides.email || 'student1@example.edu').toLowerCase(),
    course: overrides.course || 'BSc Information Technology',
    phone: overrides.phone || '+256-700-111222',
    passwordHash,
    role: overrides.role || 'student',
    isActive: true
  });
  return { user, password };
}

async function loginAgent(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());
});

afterAll(async () => {
  await disconnectDatabase();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Promise.all([
    AuditLog.deleteMany({}),
    Claim.deleteMany({}),
    LostItem.deleteMany({}),
    FoundItem.deleteMany({}),
    Location.deleteMany({}),
    User.deleteMany({})
  ]);
});

describe('Bugema Campus Lost & Found API', () => {
  describe('Authentication & Input Validation', () => {
    it('registers a student with hashed password, ignores role escalation, and supports login/me/logout', async () => {
      const agent = request.agent(app);
      const regRes = await agent.post('/api/auth/register').send({
        studentId: '25/BCS/BU/R/1100',
        fullName: 'Grace Mutoni',
        email: 'grace.mutoni@example.edu',
        course: 'BSc Computer Science',
        phone: '+256-700-333444',
        password: 'StrongPassword123!',
        role: 'admin' // Attempted privilege escalation should be ignored
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.user.role).toBe('student');
      expect(regRes.body.user.passwordHash).toBeUndefined();
      expect(regRes.body.user.password).toBeUndefined();

      const stored = await User.findOne({ email: 'grace.mutoni@example.edu' }).select('+passwordHash');
      expect(stored).toBeTruthy();
      expect(stored!.passwordHash).not.toBe('StrongPassword123!');
      expect(stored!.passwordHash.startsWith('$2')).toBe(true);

      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('grace.mutoni@example.edu');

      const logoutRes = await agent.post('/api/auth/logout');
      expect(logoutRes.status).toBe(204);

      const afterLogout = await agent.get('/api/auth/me');
      expect(afterLogout.body.user).toBeNull();
    });

    it('rejects duplicate registrations and invalid credentials cleanly', async () => {
      await createAccount({ email: 'dup@example.edu', studentId: '24/BIT/BU/R/5555' });

      const dupRes = await request(app).post('/api/auth/register').send({
        studentId: '24/BIT/BU/R/5555',
        fullName: 'Another User',
        email: 'other@example.edu',
        course: 'BBA',
        phone: '+256-700-999888',
        password: 'ValidPassword123'
      });
      expect(dupRes.status).toBe(409);

      const badLogin = await request(app).post('/api/auth/login').send({
        email: 'dup@example.edu',
        password: 'WrongPassword!'
      });
      expect(badLogin.status).toBe(401);
      expect(badLogin.body.error).toBe('Invalid email or password.');
    });

    it('rejects malformed registration fields', async () => {
      const res = await request(app).post('/api/auth/register').send({
        studentId: '1',
        fullName: 'A',
        email: 'not-an-email',
        course: '',
        phone: 'abc',
        password: 'short'
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Lost & Found Reports, Privacy & Permission Boundaries', () => {
    it('hides sensitive identifyingDetails and private owner info from unauthenticated visitors and other students', async () => {
      const { user: studentA, password: passA } = await createAccount({
        email: 'studentA@example.edu',
        studentId: '24/BIT/BU/R/1001'
      });
      const { password: passB } = await createAccount({
        email: 'studentB@example.edu',
        studentId: '24/BIT/BU/R/1002'
      });
      const { password: adminPass } = await createAccount({
        email: 'staff@example.edu',
        studentId: 'BU-STF-100',
        role: 'admin'
      });

      const agentA = await loginAgent(studentA.email, passA);
      const agentB = await loginAgent('studentB@example.edu', passB);
      const adminAgent = await loginAgent('staff@example.edu', adminPass);

      const lostRes = await agentA.post('/api/lost-items').send({
        itemName: 'Silver Dell Laptop',
        category: 'Electronics',
        description: '14-inch laptop in a grey sleeve lost near the ICT wing.',
        identifyingDetails: 'Serial number DL-998811 and blue sticker inside lid',
        lastKnownLocation: 'ICT Lab Block B',
        dateLost: '2026-11-20',
        approximateTimeLost: '15:00',
        contactPreference: 'email'
      });
      expect(lostRes.status).toBe(201);
      const lostId = lostRes.body.item.id;
      expect(lostRes.body.item.identifyingDetails).toContain('DL-998811');

      const foundRes = await adminAgent.post('/api/found-items').send({
        itemName: 'Dell Laptop in Grey Sleeve',
        category: 'Electronics',
        description: 'Silver 14-inch laptop turned in by a lab attendant.',
        identifyingDetails: 'Serial number DL-998811 and blue sticker inside lid',
        locationFound: 'ICT Lab Block B',
        dateFound: '2026-11-20',
        holdingLocation: 'Main Gate Security Desk'
      });
      expect(foundRes.status).toBe(201);
      const foundId = foundRes.body.item.id;

      // Public visitor cannot see private identifying details or owner info
      const publicLost = await request(app).get(`/api/lost-items/${lostId}`);
      expect(publicLost.status).toBe(200);
      expect(publicLost.body.item.identifyingDetails).toBeUndefined();
      expect(publicLost.body.item.owner).toBeUndefined();

      const publicFound = await request(app).get(`/api/found-items/${foundId}`);
      expect(publicFound.status).toBe(200);
      expect(publicFound.body.item.identifyingDetails).toBeUndefined();

      // Another student cannot see private identifying details or modify Student A's report
      const otherStudentFound = await agentB.get(`/api/found-items/${foundId}`);
      expect(otherStudentFound.body.item.identifyingDetails).toBeUndefined();

      const unauthorizedEdit = await agentB.patch(`/api/lost-items/${lostId}`).send({
        description: 'Tampered description by another student'
      });
      expect(unauthorizedEdit.status).toBe(403);

      // Owner can edit and withdraw their own report, but cannot mark it Claimed
      const forbiddenStatus = await agentA.patch(`/api/lost-items/${lostId}`).send({ status: 'Claimed' });
      expect(forbiddenStatus.status).toBe(403);

      const withdrawRes = await agentA.patch(`/api/lost-items/${lostId}`).send({ status: 'Closed' });
      expect(withdrawRes.status).toBe(200);
      expect(withdrawRes.body.item.status).toBe('Closed');

      // Admin CAN view identifyingDetails for verification
      const adminFound = await adminAgent.get(`/api/found-items/${foundId}`);
      expect(adminFound.body.item.identifyingDetails).toContain('DL-998811');
    });

    it('supports database-backed search, category/location/date/status filters, pagination, and suggested matches', async () => {
      const { user: student, password } = await createAccount({
        email: 'searcher@example.edu',
        studentId: '24/BIT/BU/R/2001'
      });
      const { password: adminPass } = await createAccount({
        email: 'admin.search@example.edu',
        studentId: 'BU-STF-200',
        role: 'admin'
      });

      const studentAgent = await loginAgent(student.email, password);
      const adminAgent = await loginAgent('admin.search@example.edu', adminPass);

      const lostCreate = await studentAgent.post('/api/lost-items').send({
        itemName: 'Casio Scientific Calculator',
        category: 'Electronics',
        description: 'Black solar scientific calculator left in lecture hall.',
        identifyingDetails: 'Initials BS etched on back',
        lastKnownLocation: 'Science Complex',
        dateLost: '2026-11-18',
        contactPreference: 'phone'
      });
      expect(lostCreate.status).toBe(201);

      await adminAgent.post('/api/found-items').send({
        itemName: 'Black Casio Calculator',
        category: 'Electronics',
        description: 'Solar scientific calculator found on front desk.',
        identifyingDetails: 'Initials BS etched on back',
        locationFound: 'Science Complex',
        dateFound: '2026-11-19',
        holdingLocation: 'Main Gate Security Desk'
      });

      await adminAgent.post('/api/found-items').send({
        itemName: 'Blue Umbrella',
        category: 'Accessories',
        description: 'Compact folding umbrella left at dining hall.',
        identifyingDetails: 'Wooden handle',
        locationFound: 'Student Dining Hall',
        dateFound: '2026-11-10',
        holdingLocation: 'Main Gate Security Desk'
      });

      // Filter by category and keyword with pagination
      const filtered = await request(app).get('/api/found-items?category=Electronics&q=Casio&page=1&limit=1');
      expect(filtered.status).toBe(200);
      expect(filtered.body.items).toHaveLength(1);
      expect(filtered.body.pagination.total).toBe(1);
      expect(filtered.body.items[0].itemName).toContain('Casio');

      // Suggested matches for the lost item
      const matchRes = await studentAgent.get(`/api/matches/lost/${lostCreate.body.item.id}`);
      expect(matchRes.status).toBe(200);
      expect(matchRes.body.disclaimer).toContain('verification');
      expect(matchRes.body.matches.length).toBeGreaterThanOrEqual(1);
      expect(matchRes.body.matches[0].item.itemName).toContain('Casio');
      expect(matchRes.body.matches[0].item.identifyingDetails).toBeUndefined();
    });

    it('validates uploaded image magic bytes and rejects spoofed files', async () => {
      const { user, password } = await createAccount({
        email: 'uploader@example.edu',
        studentId: '24/BIT/BU/R/3001'
      });
      const agent = await loginAgent(user.email, password);

      // Spoofed .jpg containing HTML script text
      const fakeJpg = Buffer.from('<script>alert("xss")</script> not a real jpeg image', 'utf8');
      const rejectRes = await agent
        .post('/api/uploads/image')
        .attach('image', fakeJpg, { filename: 'evil.jpg', contentType: 'image/jpeg' });
      expect(rejectRes.status).toBe(400);
      expect(rejectRes.body.code).toBe('INVALID_IMAGE_TYPE');

      // Valid minimal 1x1 PNG magic bytes
      const validPng = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
        'hex'
      );
      const acceptRes = await agent
        .post('/api/uploads/image')
        .attach('image', validPng, { filename: '../../original.png', contentType: 'application/octet-stream' });
      expect(acceptRes.status).toBe(201);
      expect(acceptRes.body.imageUrl).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);
    });
  });

  describe('Claims, Verification Workflow, RBAC & Audit Trail', () => {
    it('enforces claim privacy, prevents self-approval, updates found & lost statuses on approval, and writes audit logs', async () => {
      const { user: student1, password: pass1 } = await createAccount({
        email: 'claimant1@example.edu',
        studentId: '24/BIT/BU/R/4001'
      });
      const { user: student2, password: pass2 } = await createAccount({
        email: 'claimant2@example.edu',
        studentId: '24/BIT/BU/R/4002'
      });
      const { user: staff, password: staffPass } = await createAccount({
        email: 'reviewer@example.edu',
        studentId: 'BU-STF-400',
        role: 'admin'
      });

      const agent1 = await loginAgent(student1.email, pass1);
      const agent2 = await loginAgent(student2.email, pass2);
      const staffAgent = await loginAgent(staff.email, staffPass);

      const lostRes = await agent1.post('/api/lost-items').send({
        itemName: 'Navy Canvas Backpack',
        category: 'Bags & Wallets',
        description: 'Medium navy backpack lost in Main Library.',
        identifyingDetails: 'Yellow ruler and accounting notebook inside',
        lastKnownLocation: 'Main Library Circulation Desk',
        dateLost: '2026-11-21',
        contactPreference: 'email'
      });
      const lostId = lostRes.body.item.id;

      const foundRes = await staffAgent.post('/api/found-items').send({
        itemName: 'Navy Canvas Backpack',
        category: 'Bags & Wallets',
        description: 'Navy backpack handed in at circulation desk.',
        identifyingDetails: 'Yellow ruler and accounting notebook inside',
        locationFound: 'Main Library Circulation Desk',
        dateFound: '2026-11-21',
        holdingLocation: 'Main Library Circulation Desk'
      });
      const foundId = foundRes.body.item.id;

      // Student 1 submits claim linked to their lost report
      const claim1Res = await agent1.post('/api/claims').send({
        foundItemId: foundId,
        linkedLostItemId: lostId,
        explanation: 'I left my navy backpack next to the second-floor study tables after evening reading.',
        identifyingProof: 'Contains a yellow plastic ruler and my Business Accounting notebook.'
      });
      expect(claim1Res.status).toBe(201);
      const claim1Id = claim1Res.body.claim.id;

      // Found item automatically moved to Claim Pending
      const updatedFound = await FoundItem.findById(foundId).lean();
      expect(updatedFound?.status).toBe('Claim Pending');

      // Duplicate active claim by same student rejected
      const dupClaim = await agent1.post('/api/claims').send({
        foundItemId: foundId,
        explanation: 'Submitting a second claim for the exact same found item.',
        identifyingProof: 'Yellow ruler inside'
      });
      expect(dupClaim.status).toBe(409);

      // Student 2 submits a competing claim
      const claim2Res = await agent2.post('/api/claims').send({
        foundItemId: foundId,
        explanation: 'I believe this navy backpack belongs to me from earlier this week.',
        identifyingProof: 'Blue zipper with textbooks'
      });
      expect(claim2Res.status).toBe(201);
      const claim2Id = claim2Res.body.claim.id;

      // Student 2 cannot inspect Student 1's claim
      const snoopRes = await agent2.get(`/api/claims/${claim1Id}`);
      expect(snoopRes.status).toBe(403);

      // Student 1 cannot approve their own claim
      const studentApproveAttempt = await agent1.patch(`/api/claims/${claim1Id}/review`).send({
        status: 'Approved',
        verificationNotes: 'Self approval attempt'
      });
      expect(studentApproveAttempt.status).toBe(403);

      // Student cannot access admin dashboard or create locations
      const studentAdminAttempt = await agent1.get('/api/admin/dashboard');
      expect(studentAdminAttempt.status).toBe(403);

      // Staff reviews and approves Claim 1
      const reviewRes = await staffAgent.patch(`/api/claims/${claim1Id}/review`).send({
        status: 'Approved',
        verificationNotes: 'Checked student ID and confirmed yellow ruler and notebook inside.'
      });
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.claim.status).toBe('Approved');
      expect(reviewRes.body.claim.reviewedBy.id).toBe(String(staff._id));
      expect(reviewRes.body.claim.reviewedAt).toBeTruthy();

      // Related FoundItem is now Returned, linked LostItem is Claimed, competing Claim 2 is auto-Rejected
      const [finalFound, finalLost, finalClaim2] = await Promise.all([
        FoundItem.findById(foundId).lean(),
        LostItem.findById(lostId).lean(),
        Claim.findById(claim2Id).lean()
      ]);
      expect(finalFound?.status).toBe('Returned');
      expect(finalLost?.status).toBe('Claimed');
      expect(finalClaim2?.status).toBe('Rejected');

      // Audit logs captured the workflow without storing sensitive claim proof
      const auditRes = await staffAgent.get('/api/admin/audit-logs');
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.logs.some((log: any) => log.action === 'CLAIM_APPROVED')).toBe(true);
      const serializedLogs = JSON.stringify(auditRes.body.logs);
      expect(serializedLogs).not.toContain('yellow plastic ruler');
    });

    it('restores found item to Stored when its sole claim is rejected and supports admin dashboard counts & location CRUD', async () => {
      const { user: student, password: studentPass } = await createAccount({
        email: 'reject.student@example.edu',
        studentId: '24/BIT/BU/R/5001'
      });
      const { user: staff, password: staffPass } = await createAccount({
        email: 'reject.staff@example.edu',
        studentId: 'BU-STF-500',
        role: 'admin'
      });

      const studentAgent = await loginAgent(student.email, studentPass);
      const staffAgent = await loginAgent(staff.email, staffPass);

      const locRes = await staffAgent.post('/api/locations').send({
        name: 'Main Gate Security Desk',
        code: 'SEC-01',
        buildingArea: 'Main Entrance',
        isHoldingDesk: true,
        description: 'Central holding point'
      });
      expect(locRes.status).toBe(201);

      const foundRes = await staffAgent.post('/api/found-items').send({
        itemName: 'Silver Wristwatch',
        category: 'Accessories',
        description: 'Metal strap watch found near chapel steps.',
        identifyingDetails: 'Engraving on back case reads "2024"',
        locationFound: 'Chapel Auditorium',
        dateFound: '2026-11-22',
        holdingLocation: 'Main Gate Security Desk',
        locationRef: locRes.body.location.id
      });
      const foundId = foundRes.body.item.id;

      const claimRes = await studentAgent.post('/api/claims').send({
        foundItemId: foundId,
        explanation: 'I lost a silver watch near the chapel yesterday afternoon.',
        identifyingProof: 'Plain back with no engravings'
      });
      expect(claimRes.status).toBe(201);

      const rejectRes = await staffAgent.patch(`/api/claims/${claimRes.body.claim.id}/review`).send({
        status: 'Rejected',
        verificationNotes: 'Description did not match the engraved back case.'
      });
      expect(rejectRes.status).toBe(200);

      const restoredFound = await FoundItem.findById(foundId).lean();
      expect(restoredFound?.status).toBe('Stored');

      const dashRes = await staffAgent.get('/api/admin/dashboard');
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.counts.foundItemsInStorage).toBe(1);
      expect(dashRes.body.counts.claimsAwaitingReview).toBe(0);
      expect(dashRes.body.counts.activeLocations).toBe(1);
    });
  });

  describe('Rate Limiting', () => {
    it('enforces rate limit on authentication endpoints', async () => {
      const strictApp = createApp({ authRateLimitMax: 2, claimRateLimitMax: 2 });

      await request(strictApp).post('/api/auth/login').send({ email: 'a@example.edu', password: 'wrongpassword' });
      await request(strictApp).post('/api/auth/login').send({ email: 'a@example.edu', password: 'wrongpassword' });
      const thirdAttempt = await request(strictApp)
        .post('/api/auth/login')
        .send({ email: 'a@example.edu', password: 'wrongpassword' });

      expect(thirdAttempt.status).toBe(429);
      expect(thirdAttempt.body.code).toBe('RATE_LIMITED');
    });
  });
});
