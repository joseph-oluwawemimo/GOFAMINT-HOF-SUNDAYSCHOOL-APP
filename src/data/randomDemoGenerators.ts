import { 
  Member, 
  WeeklyGradeRecord, 
  WeeklyOfferingRecord, 
  AbsenceLogRecord, 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord,
  AdminProfile,
  ClassProfile,
  SundaySchoolYear,
  QuarterLesson,
  LessonInfo,
  AttendanceStatus,
  SundayAttendanceStatus,
  PrepAttendanceStatus,
  AbsenceReasonCategory
} from '../types';
import { GOFAMINT_HOF_12_LESSONS, DEFAULT_DEPARTMENTS } from './mockQuarterLessons';

// Realistic Nigerian names for authentic Sunday School testing
const FIRST_NAMES_MALE = [
  'Daniel', 'Samuel', 'Emmanuel', 'Michael', 'David', 'Joseph', 'Oluwaseun', 
  'Adeolu', 'Toluwani', 'Chinedu', 'Femi', 'Kayode', 'Segun', 'Babafemi', 
  'Chukwuemeka', 'Ifeanyi', 'Joshua', 'Victor', 'Stephen', 'Peter'
];

const FIRST_NAMES_FEMALE = [
  'Grace', 'Deborah', 'Esther', 'Mary', 'Blessing', 'Chidinma', 'Folashade', 
  'Oluwakemi', 'Bukola', 'Titilayo', 'Joy', 'Victoria', 'Mercy', 'Abimbola', 
  'Adetola', 'Faith', 'Dorcas', 'Funmilayo', 'Omolara', 'Kehinde'
];

const LAST_NAMES = [
  'Adekunle', 'Adebayo', 'Okafor', 'Balogun', 'Adeleke', 'Ogundimu', 'Nnamdi', 
  'Alabi', 'Okoro', 'Oluwole', 'Afolayan', 'Ogunleye', 'Babalola', 'Nwankwo', 
  'Eze', 'Ojo', 'Fashola', 'Adeniyi', 'Adewale', 'Olayinka'
];

const OCCUPATIONS = [
  'Civil Engineer', 'Chartered Accountant', 'Secondary School Teacher', 
  'Registered Nurse', 'Software Developer', 'Business Administrator', 
  'Fashion Designer', 'Banker', 'Pharmacist', 'University Lecturer', 
  'Legal Practitioner', 'Building Contractor', 'Retail Merchant', 'Medical Doctor'
];

const STREET_ADDRESSES = [
  '14 Adekunle Fajuyi Crescent, GRA, Ikeja, Lagos',
  '27 Olusegun Obasanjo Way, Bodija, Ibadan, Oyo State',
  '8 Herbert Macaulay Street, Yaba, Lagos',
  '45 Ring Road, Challenge, Ibadan, Oyo State',
  '12 Ahmadu Bello Way, Victoria Island, Lagos',
  '31 Ikorodu Road, Fadeyi, Lagos',
  '19 Commercial Avenue, Sabo, Yaba, Lagos',
  '5 Bishop Oluwole Street, Victoria Island, Lagos',
  '22 Akilo Road, Ogba, Ikeja, Lagos',
  '9 Stadium Road, Surulere, Lagos'
];

const PRAYER_REQUESTS = [
  'Divine health, academic success for children, and grace for financial expansion.',
  'Spiritual growth, breakthrough in career promotion, and family peace.',
  'Healing for an aged parent, journey mercies, and fruitful Christian service.',
  'Divine direction in business decisions and salvation of extended family members.',
  'Grace to abide faithful in Christ, fruit of the womb, and wisdom for leadership.',
  'Open doors for employment and supernatural provisions for children school fees.'
];

const NIGERIAN_PHONE_PREFIXES = ['0803', '0802', '0813', '0816', '0703', '0805', '0903', '0814'];

export function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomPhone(): string {
  const prefix = getRandomElement(NIGERIAN_PHONE_PREFIXES);
  const rest = Math.floor(1000000 + Math.random() * 9000000).toString().substring(0, 7);
  return `+234 ${prefix.substring(1)} ${rest.substring(0, 3)} ${rest.substring(3)}`;
}

// 1. Single Realistic Demo General Superintendent Profile
export function createDemoGeneralSuperintendent(): AdminProfile {
  return {
    id: 'GENERAL_SUPERINTENDENT',
    roleType: 'GENERAL_SUPERINTENDENT',
    title: 'General Superintendent',
    profileName: 'Pastor Dr. E.O. Abina',
    username: 'gs_admin',
    
    isApproved: true,
    approvedBy: 'National Executive Council',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 2. Single Realistic Demo General Secretary Profile
export function createDemoGeneralSecretary(): AdminProfile {
  return {
    id: 'GENERAL_SECRETARY',
    roleType: 'GENERAL_SECRETARY',
    title: 'General Secretary',
    profileName: 'Pastor S.O. Olawuyi',
    username: 'gsec_admin',
    
    isApproved: true,
    approvedBy: 'General Superintendent',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 3. Single Realistic Demo Secondary Officer Profile
export function createDemoOfficerProfile(roleType: string, title: string, defaultUsername: string): AdminProfile {
  const isFemale = roleType.includes('ENROLLMENT') || roleType.includes('RECORD');
  const firstName = isFemale ? getRandomElement(FIRST_NAMES_FEMALE) : getRandomElement(FIRST_NAMES_MALE);
  const lastName = getRandomElement(LAST_NAMES);
  const titlePrefix = isFemale ? 'Deaconess' : (roleType.includes('TREASURER') ? 'Elder' : 'Pastor');

  return {
    id: roleType,
    roleType: roleType as any,
    title,
    profileName: `${titlePrefix} ${firstName} ${lastName}`,
    username: defaultUsername,
    
    isApproved: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createRandomDemoAdminProfile(roleType: string = 'TREASURER'): AdminProfile {
  const isFemale = Math.random() > 0.5;
  const firstName = isFemale ? getRandomElement(FIRST_NAMES_FEMALE) : getRandomElement(FIRST_NAMES_MALE);
  const lastName = getRandomElement(LAST_NAMES);
  const title = roleType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  return {
    id: roleType,
    roleType: roleType as any,
    title: `${title} ID`,
    profileName: `${isFemale ? 'Sis.' : 'Bro.'} ${firstName} ${lastName}`,
    username: `${roleType.toLowerCase().replace(/_/g, '')}_admin`,
    
    isApproved: roleType === 'GENERAL_SUPERINTENDENT' || roleType === 'GENERAL_SECRETARY',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 4. Realistic Lesson Generation for 12 or 13 Weeks
export function generateRealisticQuarterLessons(
  weekCount: 12 | 13 = 12,
  theme: string = 'Living as True Disciples of Christ'
): QuarterLesson[] {
  const lessons: QuarterLesson[] = [];
  
  const sampleTopics = [
    { topic: 'The Unconditional Call to Discipleship', ref: 'Matthew 4:18-22; Luke 9:57-62', mv: 'If anyone desires to come after Me, let him deny himself, and take up his cross daily, and follow Me.', mvRef: 'Luke 9:23' },
    { topic: 'The Pattern of Secret & Prevailing Prayer', ref: 'Matthew 6:5-15; James 5:13-18', mv: 'The effective, fervent prayer of a righteous man avails much.', mvRef: 'James 5:16' },
    { topic: 'Integrity and Christian Conduct in Society', ref: 'Psalm 15:1-5; Titus 2:1-10', mv: 'The integrity of the upright will guide them, but the perversity of the unfaithful will destroy them.', mvRef: 'Proverbs 11:3' },
    { topic: 'Tithing, Sacrificial Giving, and Kingdom Stewardship', ref: 'Malachi 3:8-12; 2 Corinthians 9:6-15', mv: 'Bring all the tithes into the storehouse, that there may be food in My house.', mvRef: 'Malachi 3:10' },
    { topic: 'The Indwelling & Power of the Holy Spirit', ref: 'Acts 1:4-8; Acts 2:1-21', mv: 'But you shall receive power when the Holy Spirit has come upon you; and you shall be witnesses to Me.', mvRef: 'Acts 1:8' },
    { topic: 'Building a Strong, Godly and Peaceful Christian Home', ref: 'Ephesians 5:22-33; Ephesians 6:1-4', mv: 'As for me and my house, we will serve the Lord.', mvRef: 'Joshua 24:15' },
    { topic: 'Overcoming Youthful Lusts and Temptations', ref: 'Genesis 39:1-12; 2 Timothy 2:19-22', mv: 'Flee also youthful lusts; but pursue righteousness, faith, love, peace with those who call on the Lord.', mvRef: '2 Timothy 2:22' },
    { topic: 'Faith in Times of Severe Trials & Adversity', ref: 'Hebrews 11:1-6; 1 Peter 1:3-9', mv: 'Looking unto Jesus, the author and finisher of our faith.', mvRef: 'Hebrews 12:2' },
    { topic: 'The Great Commission and Personal Soul Winning', ref: 'Mark 16:15-20; 2 Corinthians 5:17-21', mv: 'Go into all the world and preach the gospel to every creature.', mvRef: 'Mark 16:15' },
    { topic: 'Forgiveness and Christian Reconciliation', ref: 'Matthew 18:21-35; Colossians 3:12-17', mv: 'Bearing with one another, and forgiving one another, if anyone has a complaint against another.', mvRef: 'Colossians 3:13' },
    { topic: 'The Fruit of the Spirit in Daily Living', ref: 'Galatians 5:16-26; John 15:1-8', mv: 'The fruit of the Spirit is love, joy, peace, longsuffering, kindness, goodness, faithfulness.', mvRef: 'Galatians 5:22' },
    { topic: 'The Blessed Hope: Readiness for the Second Coming', ref: '1 Thessalonians 4:13-18; Revelation 22:12-21', mv: 'Behold, I am coming quickly, and My reward is with Me, to give to every one according to his work.', mvRef: 'Revelation 22:12' },
    { topic: 'Walking in the Light of Divine Wisdom', ref: 'Proverbs 3:1-18; James 3:13-18', mv: 'The fear of the Lord is the beginning of wisdom.', mvRef: 'Proverbs 9:10' }
  ];

  for (let w = 1; w <= weekCount; w++) {
    const t = sampleTopics[w - 1] || sampleTopics[0];
    lessons.push({
      weekNumber: w,
      topic: t.topic,
      scriptureReading: t.ref,
      memoryVerse: t.mv,
      memoryVerseRef: t.mvRef,
      aim: `To help students understand and practically apply biblical truth on ${t.topic}.`
    });
  }

  // Always append mandatory Sharing & Admonition Week
  lessons.push({
    weekNumber: weekCount + 1,
    isSharingAdmonitionWeek: true,
    topic: 'Sharing, Admonition & Quarterly Love Feast',
    scriptureReading: 'Hebrews 10:23-25; 1 Thessalonians 5:11-22',
    memoryVerse: 'Let us consider one another in order to stir up love and good works.',
    memoryVerseRef: 'Hebrews 10:24',
    aim: 'Mutual testimonies, spiritual assessment of the quarter, fellowship and encouragement.'
  });

  return lessons;
}

// 5. Single Realistic Demo Sunday School Year
export function createDemoSundaySchoolYear(): SundaySchoolYear {
  const currentYear = new Date().getFullYear();
  const yearName = `${currentYear}–${currentYear + 1}`;
  const quarters = [1, 2, 3, 4].map((qNum) => {
    const qNumber = qNum as 1 | 2 | 3 | 4;
    const themes = [
      'Foundations of Christian Faith & Discipleship',
      'Walking in the Power and Guidance of the Holy Spirit',
      'The Christian Home, Stewardship & Fruitful Living',
      'The Blessed Hope, Holiness & Kingdom Readiness'
    ];

    return {
      id: `Q${qNumber}_${currentYear}`,
      quarterNumber: qNumber,
      quarterName: qNumber === 1 ? 'First Quarter' : qNumber === 2 ? 'Second Quarter' : qNumber === 3 ? 'Third Quarter' : 'Fourth Quarter',
      quarterTheme: themes[qNumber - 1],
      totalLessonWeeks: 12 as const,
      hasSharingAdmonitionWeek: true,
      status: (qNumber === 1 ? 'ACTIVE' : 'UPCOMING') as any,
      lessons: generateRealisticQuarterLessons(12, themes[qNumber - 1]),
      updatedAt: new Date().toISOString()
    };
  });

  return {
    id: `YEAR_${currentYear}`,
    yearName,
    overallTheme: 'Walking in the Light of His Glory and Truth (1 John 1:7)',
    activeQuarterNumber: 1,
    isInitialized: true,
    quarters,
    departments: [...DEFAULT_DEPARTMENTS],
    updatedAt: new Date().toISOString()
  };
}

export const createRandomDemoSundaySchoolYear = createDemoSundaySchoolYear;

// 6. Generate One Realistic Demo Class
export function createDemoClass(department: string = 'Adults Department'): ClassProfile {
  const teacherFirst = getRandomElement(FIRST_NAMES_MALE);
  const teacherLast = getRandomElement(LAST_NAMES);
  const secFirst = getRandomElement(FIRST_NAMES_FEMALE);
  const secLast = getRandomElement(LAST_NAMES);

  const adjectives = ['Grace & Truth', 'Living Waters', 'Ebenezer', 'Mount Zion', 'Faithful Stewards', 'Victory'];
  const className = `${getRandomElement(adjectives)} ${department.replace(' Department', '')} Bible Class`;

  return {
    id: `class_${Date.now()}_${getRandomInt(100, 999)}`,
    className,
    department: department as any,
    secretaryName: `Sis. ${secFirst} ${secLast}`,
    secretaryPhone: generateRandomPhone(),
    teachers: [
      {
        id: `t_${Date.now()}`,
        name: `Bro. ${teacherFirst} ${teacherLast}`,
        phone: generateRandomPhone(),
        isHeadTeacher: true
      }
    ],
    
    quarterTitle: 'Quarter 1: Sunday School Curriculum',
    year: new Date().getFullYear(),
    currencySymbol: '₦',
    isSetupComplete: true,
    approvalStatus: 'PENDING_APPROVAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 7. Generate Single Realistic Random Visitor
export function createRandomDemoVisitor(existingCount: number = 0): Member {
  const isFemale = Math.random() > 0.5;
  const firstName = isFemale ? getRandomElement(FIRST_NAMES_FEMALE) : getRandomElement(FIRST_NAMES_MALE);
  const lastName = getRandomElement(LAST_NAMES);
  const birthYear = getRandomInt(1975, 2005);
  const birthMonth = String(getRandomInt(1, 12)).padStart(2, '0');
  const birthDay = String(getRandomInt(1, 28)).padStart(2, '0');

  return {
    id: `vis_demo_${Date.now()}_${getRandomInt(1000, 9999)}`,
    fullName: `${firstName} ${lastName}`,
    phone: generateRandomPhone(),
    address: getRandomElement(STREET_ADDRESSES),
    occupation: getRandomElement(OCCUPATIONS),
    gender: isFemale ? 'FEMALE' : 'MALE',
    dateOfBirth: `${birthYear}-${birthMonth}-${birthDay}`,
    ageGroup: birthYear > 1995 ? 'Young Adult (18–30)' : 'Adult (31–55)',
    memberType: 'VISITOR',
    status: 'ACTIVE',
    isBornAgain: Math.random() > 0.3,
    isWaterBaptized: Math.random() > 0.5,
    isHolyGhostBaptized: Math.random() > 0.6,
    nextOfKinName: `${isFemale ? 'Mr.' : 'Mrs.'} ${lastName}`,
    nextOfKinPhone: generateRandomPhone(),
    nextOfKinRelationship: isFemale ? 'Spouse' : 'Brother',
    prayerRequests: getRandomElement(PRAYER_REQUESTS),
    notes: 'First-time visitor to Sunday School. Warmly welcomed.',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 8. Generate Single Realistic Random Student
export function createRandomDemoStudent(existingCount: number = 0): Member {
  const isFemale = Math.random() > 0.5;
  const firstName = isFemale ? getRandomElement(FIRST_NAMES_FEMALE) : getRandomElement(FIRST_NAMES_MALE);
  const lastName = getRandomElement(LAST_NAMES);
  const birthYear = getRandomInt(1970, 2002);
  const birthMonth = String(getRandomInt(1, 12)).padStart(2, '0');
  const birthDay = String(getRandomInt(1, 28)).padStart(2, '0');

  return {
    id: `stud_demo_${Date.now()}_${getRandomInt(1000, 9999)}`,
    fullName: `${firstName} ${lastName}`,
    phone: generateRandomPhone(),
    address: getRandomElement(STREET_ADDRESSES),
    occupation: getRandomElement(OCCUPATIONS),
    gender: isFemale ? 'FEMALE' : 'MALE',
    dateOfBirth: `${birthYear}-${birthMonth}-${birthDay}`,
    ageGroup: birthYear > 1995 ? 'Youth' : 'Adult',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: Math.random() > 0.2,
    isHolyGhostBaptized: Math.random() > 0.3,
    nextOfKinName: `${isFemale ? 'Bro.' : 'Sis.'} ${lastName}`,
    nextOfKinPhone: generateRandomPhone(),
    nextOfKinRelationship: 'Family',
    prayerRequests: getRandomElement(PRAYER_REQUESTS),
    notes: 'Committed Sunday School learner with active participation.',
    firstLessonWeek: 1,
    evangelismReferralCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 9. Generate Randomized Weekly Attendance, Score, and Offering for a specific week
export function generateRandomWeeklyDataForMembers(
  members: Member[],
  weekNumber: number
): {
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  absenceLogs: AbsenceLogRecord[];
} {
  const grades: WeeklyGradeRecord[] = [];
  const absenceLogs: AbsenceLogRecord[] = [];
  let totalOffering = 0;

  const attendanceRate = 0.70 + Math.random() * 0.25;

  for (const m of members) {
    const isPresent = Math.random() < attendanceRate;
    const isExempt = !isPresent && Math.random() < 0.15;
    const attendance: AttendanceStatus = isPresent ? 'PRESENT' : (isExempt ? 'EXEMPT' : 'ABSENT');

    let punctuality = 0;
    let memoryVerse = 0;
    let classParticipation = 0;
    let lessonTotal = 0;
    const joinedPrayerMeeting = isPresent && Math.random() > 0.3;
    const postedStatusInsight = isPresent && Math.random() > 0.4;
    const invitedSomeone = isPresent && Math.random() > 0.6;

    if (isPresent) {
      punctuality = getRandomInt(10, 15);
      memoryVerse = getRandomInt(10, 15);
      classParticipation = getRandomInt(12, 20);
      lessonTotal = punctuality + memoryVerse + classParticipation;
      totalOffering += getRandomInt(200, 1500);
    } else if (attendance === 'ABSENT') {
      const reasons: AbsenceReasonCategory[] = ['ILLNESS', 'TRAVEL', 'WORK_SCHOOL', 'PERSONAL', 'FAMILY_EMERGENCY'];
      const chosenReason: AbsenceReasonCategory = getRandomElement(reasons);

      absenceLogs.push({
        id: `abs_${m.id}_w${weekNumber}_${Date.now()}`,
        memberId: m.id,
        weekNumber,
        consecutiveWeeksAbsent: getRandomInt(1, 3),
        urgencyLevel: 'YELLOW',
        contactMethod: 'PHONE_CALL',
        reasonCategory: chosenReason,
        notes: `Followed up via phone: member reported ${(chosenReason || 'ILLNESS').toLowerCase().replace('_', ' ')}. Assured next Sunday attendance.`,
        loggedAt: new Date().toISOString()
      });
    }

    grades.push({
      id: `${m.id}_week_${weekNumber}`,
      memberId: m.id,
      weekNumber,
      attendance,
      punctuality,
      memoryVerse,
      classParticipation,
      lessonTotal,
      joinedPrayerMeeting,
      postedStatusInsight,
      invitedSomeone,
      notes: isPresent ? 'Punctual and engaged' : undefined,
      updatedAt: new Date().toISOString()
    });
  }

  const offerings: WeeklyOfferingRecord[] = [
    {
      id: `week_${weekNumber}`,
      weekNumber,
      amount: totalOffering > 0 ? totalOffering : getRandomInt(4500, 18500),
      notes: `Sunday School weekly class collection for Week ${weekNumber}`,
      recordedBy: 'Class Secretary',
      updatedAt: new Date().toISOString()
    }
  ];

  return { grades, offerings, absenceLogs };
}

// 10. Generate Single Realistic Random Worker
export function createRandomDemoWorker(department: string = 'Sunday School'): WorkerProfile {
  const isFemale = Math.random() > 0.5;
  const firstName = isFemale ? getRandomElement(FIRST_NAMES_FEMALE) : getRandomElement(FIRST_NAMES_MALE);
  const lastName = getRandomElement(LAST_NAMES);
  const title = isFemale ? (Math.random() > 0.4 ? 'Sis.' : 'Deaconess') : (Math.random() > 0.5 ? 'Bro.' : 'Elder');
  const token = `GFM-W-${getRandomInt(100, 999)}-${getRandomInt(10, 99)}`;

  const categories = [
    'Sunday School Teacher', 
    'Choir Member', 
    'Usher', 
    'Technical / Sound Operator', 
    'Intercessor / Prayer Warrior', 
    'Evangelism Worker'
  ];

  return {
    id: `worker_${Date.now()}_${getRandomInt(100, 999)}`,
    fullName: `${title} ${firstName} ${lastName}`,
    phone: generateRandomPhone(),
    whatsappNumber: generateRandomPhone(),
    address: getRandomElement(STREET_ADDRESSES),
    department,
    categories: [getRandomElement(categories)],
    qrCodeToken: token,
    status: 'ACTIVE',
    gender: isFemale ? 'FEMALE' : 'MALE',
    joinedDate: '2024-01-15',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 11. Generate Random Sunday Clock-In Attendance for a Worker
export function createRandomWorkerClockIn(workerId: string, workerName: string, department: string = 'Sunday School'): WorkerAttendanceRecord {
  const isOnTime = Math.random() > 0.25;
  const hour = isOnTime ? '07' : '08';
  const minute = isOnTime ? String(getRandomInt(30, 58)).padStart(2, '0') : String(getRandomInt(16, 45)).padStart(2, '0');
  const timeStr = `${hour}:${minute}:${String(getRandomInt(10, 59)).padStart(2, '0')} AM`;
  const today = new Date().toISOString().split('T')[0];

  return {
    id: `${workerId}_${today}`,
    workerId,
    workerName,
    department,
    serviceDate: today,
    serviceName: 'Sunday Morning Service',
    clockInTime: timeStr,
    timestamp: Date.now(),
    status: isOnTime ? 'PRESENT' : 'LATE',
    isLate: !isOnTime,
    method: 'QR_SCAN',
    notes: isOnTime ? 'Punctual arrival' : 'Arrived after 8:15 AM threshold',
    createdAt: new Date().toISOString()
  };
}

// 12. Generate Random Saturday Prep Attendance for Workers
export function createRandomWorkerPrepAttendance(
  workers: WorkerProfile[], 
  prepDate: string
): WorkerPrepAttendanceRecord[] {
  const records: WorkerPrepAttendanceRecord[] = [];

  for (const w of workers) {
    const isPresent = Math.random() > 0.2;
    records.push({
      id: `${w.id}_${prepDate}`,
      workerId: w.id,
      workerName: w.fullName,
      department: w.department,
      prepDate,
      sessionTitle: 'Saturday Preparatory Class',
      status: isPresent ? 'PRESENT' : 'ABSENT',
      syllabusPrepared: isPresent && Math.random() > 0.1,
      markedBy: 'Workers Coordinator',
      notes: isPresent ? 'Participated actively in preview discussions' : 'Off-station engagement',
      updatedAt: new Date().toISOString()
    });
  }

  return records;
}
