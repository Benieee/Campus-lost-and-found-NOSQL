const CampusLostFoundMockData = {
  students: [
    {
      id: 'student-101',
      fullName: 'Nabirye Sarah',
      studentId: '2021/BCS/101',
      email: 'sarah@student.bugema.ac.ug',
      phone: '+256700111222',
      password: 'student123',
      role: 'student',
      createdAt: '2024-01-10T08:00:00.000Z'
    },
    {
      id: 'student-102',
      fullName: 'Kato Daniel',
      studentId: '2022/BAE/204',
      email: 'daniel@student.bugema.ac.ug',
      phone: '+256701234567',
      password: 'student123',
      role: 'student',
      createdAt: '2024-02-04T09:45:00.000Z'
    },
    {
      id: 'admin-001',
      fullName: 'Admin Office',
      studentId: 'ADMIN-001',
      email: 'admin@bugema.ac.ug',
      phone: '+256750000111',
      password: 'admin123',
      role: 'admin',
      createdAt: '2023-11-01T07:00:00.000Z'
    }
  ],
  lostItems: [
    {
      id: 'lost-1',
      itemName: 'Black Samsung Galaxy A54',
      category: 'Electronics',
      description: 'Black smartphone with a cracked screen protector and teal case.',
      dateLost: '2025-01-11',
      location: 'Main Library',
      features: 'Blue phone case, Samsung logo on back, cracked screen protector',
      contact: 'sarah@student.bugema.ac.ug',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
      reportBy: 'student-101',
      status: 'pending',
      createdAt: '2025-01-12T10:34:00.000Z'
    },
    {
      id: 'lost-2',
      itemName: 'Student ID Card',
      category: 'Documents and identification cards',
      description: 'A university ID with a red lanyard attached.',
      dateLost: '2025-02-03',
      location: 'Cafeteria Block',
      features: 'Red lanyard and name tag',
      contact: 'daniel@student.bugema.ac.ug',
      image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80',
      reportBy: 'student-102',
      status: 'under_review',
      createdAt: '2025-02-04T10:00:00.000Z'
    },
    {
      id: 'lost-3',
      itemName: 'Navy Backpack',
      category: 'Bags and wallets',
      description: 'Medium-sized backpack with a unique zipper pull.',
      dateLost: '2025-03-16',
      location: 'Science Block',
      features: 'Navy colour, bright green zipper pull, two side pockets',
      contact: '+256703456881',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
      reportBy: 'student-101',
      status: 'resolved',
      createdAt: '2025-03-17T09:15:00.000Z'
    }
  ],
  foundItems: [
    {
      id: 'found-1',
      itemName: 'Blue Water Bottle',
      category: 'Accessories',
      description: 'Blue insulated bottle with a sticker of the Bugema crest.',
      dateFound: '2025-01-18',
      location: 'Lecture Theatre 2',
      condition: 'Good',
      features: 'Sticker of university crest, silver cap',
      holdingLocation: 'Security Office',
      contact: 'security@bugema.ac.ug',
      image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80',
      status: 'available',
      createdAt: '2025-01-18T12:30:00.000Z'
    },
    {
      id: 'found-2',
      itemName: 'Laptop Charger',
      category: 'Electronics',
      description: 'White laptop charger with a green cable sleeve.',
      dateFound: '2025-02-15',
      location: 'Computer Lab',
      condition: 'Fair',
      features: 'Green sleeve, HP logo',
      holdingLocation: 'IT Help Desk',
      contact: 'helpdesk@bugema.ac.ug',
      image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=900&q=80',
      status: 'claim_review',
      createdAt: '2025-02-16T14:20:00.000Z'
    },
    {
      id: 'found-3',
      itemName: 'University ID Card',
      category: 'Documents and identification cards',
      description: 'Student ID card found near the nursing hall.',
      dateFound: '2025-03-20',
      location: 'Nursing Hall',
      condition: 'Good',
      features: 'ID card laminated, Student Number visible',
      holdingLocation: 'Registrar Office',
      contact: 'registrar@bugema.ac.ug',
      image: 'https://images.unsplash.com/photo-1529397938791-2aba4681454d?auto=format&fit=crop&w=900&q=80',
      status: 'available',
      createdAt: '2025-03-20T09:10:00.000Z'
    }
  ],
  claims: [
    {
      id: 'claim-1',
      reference: 'BLF-2025-1001',
      foundItemId: 'found-2',
      claimantName: 'Nabirye Sarah',
      studentId: '2021/BCS/101',
      explanation: 'This charger matches the one I lost during my operating systems lab last week.',
      distinguishingFeatures: 'Green sleeve and HP branding. My laptop is HP EliteBook.',
      additionalInfo: 'I can provide my student ID and the exact time it was lost.',
      status: 'pending',
      createdAt: '2025-02-17T07:50:00.000Z',
      adminNotes: ''
    },
    {
      id: 'claim-2',
      reference: 'BLF-2025-1002',
      foundItemId: 'found-3',
      claimantName: 'Kato Daniel',
      studentId: '2022/BAE/204',
      explanation: 'The ID card likely belongs to me because the student number matches my own.',
      distinguishingFeatures: 'The photo on the card is mine, and the holder is laminated.',
      additionalInfo: 'I am available to verify at the registrar office.',
      status: 'approved',
      createdAt: '2025-03-22T13:00:00.000Z',
      adminNotes: 'Claim verified against registrar records.'
    }
  ],
  notifications: [
    {
      id: 'note-1',
      userId: 'student-101',
      message: 'Your lost item report for Black Samsung Galaxy A54 has been submitted successfully.',
      type: 'report',
      read: false,
      createdAt: '2025-01-12T10:35:00.000Z'
    },
    {
      id: 'note-2',
      userId: 'student-101',
      message: 'Your claim for Laptop Charger is currently under review.',
      type: 'claim',
      read: true,
      createdAt: '2025-02-17T08:10:00.000Z'
    },
    {
      id: 'note-3',
      userId: 'admin-001',
      message: 'New lost item report received: Black Samsung Galaxy A54.',
      type: 'admin',
      read: false,
      createdAt: '2025-01-12T10:35:00.000Z'
    }
  ]
};

const seedMockData = () => {
  const state = {
    students: CampusLostFoundMockData.students,
    lostItems: CampusLostFoundMockData.lostItems,
    foundItems: CampusLostFoundMockData.foundItems,
    claims: CampusLostFoundMockData.claims,
    notifications: CampusLostFoundMockData.notifications,
    currentUserId: 'student-101'
  };
  localStorage.setItem('campusLostFoundAppState', JSON.stringify(state));
  return state;
};

window.seedMockData = seedMockData;
window.CampusLostFoundMockData = CampusLostFoundMockData;
