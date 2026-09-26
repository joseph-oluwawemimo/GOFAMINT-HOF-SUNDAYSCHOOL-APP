/**
 * WARNING: This file contains demo/seed data for development and testing ONLY.
 * The exports GOFAMINT_HOF_12_LESSONS, PERMITTED_ADMIN_IDS, and AdminIdDefinition
 * are used in production. All other exports (SEED_*, INITIAL_*) are demo data
 * and must NEVER be imported in production startup or initialization code.
 */
import { LessonInfo, Member, WeeklyGradeRecord, WeeklyOfferingRecord, AbsenceLogRecord, ClassProfile } from '../types';

export const GOFAMINT_HOF_12_LESSONS: LessonInfo[] = [
  {
    weekNumber: 1,
    topic: "The Call to Discipleship and Living Faith",
    scriptureReading: "Matthew 4:18-22; Luke 9:23-26",
    memoryVerse: "Then He said to them all, 'If anyone desires to come after Me, let him deny himself, and take up his cross daily, and follow Me.'",
    memoryVerseRef: "Luke 9:23",
    aim: "To comprehend the cost and glory of following Christ as authentic disciples."
  },
  {
    weekNumber: 2,
    topic: "The Power and Practice of Secret Prayer",
    scriptureReading: "Matthew 6:5-15; James 5:16-18",
    memoryVerse: "The effective, fervent prayer of a righteous man avails much.",
    memoryVerseRef: "James 5:16b",
    aim: "To ignite a disciplined, fervent private prayer life that unleashes divine power."
  },
  {
    weekNumber: 3,
    topic: "Walking in Holy Integrity and Truth",
    scriptureReading: "Psalm 15:1-5; Proverbs 11:1-3",
    memoryVerse: "The integrity of the upright will guide them, but the perversity of the unfaithful will destroy them.",
    memoryVerseRef: "Proverbs 11:3",
    aim: "To demonstrate uncompromising Christian ethics in our homes, workplaces, and society."
  },
  {
    weekNumber: 4,
    topic: "Evangelism: The Great Commission in Daily Life",
    scriptureReading: "Mark 16:15-20; 2 Corinthians 5:17-21",
    memoryVerse: "Now then, we are ambassadors for Christ, as though God were pleading through us.",
    memoryVerseRef: "2 Corinthians 5:20a",
    aim: "To equip every believer to winsomely share Christ with neighbors and colleagues."
  },
  {
    weekNumber: 5,
    topic: "Overcoming Temptation through the Word",
    scriptureReading: "Matthew 4:1-11; 1 Corinthians 10:11-14",
    memoryVerse: "Your word I have hidden in my heart, that I might not sin against You.",
    memoryVerseRef: "Psalm 119:11",
    aim: "To apply scripture effectively as the sword of the Spirit during spiritual battles."
  },
  {
    weekNumber: 6,
    topic: "The Fruit of the Holy Spirit in Action",
    scriptureReading: "Galatians 5:16-26; John 15:1-8",
    memoryVerse: "By this My Father is glorified, that you bear much fruit; so you will be My disciples.",
    memoryVerseRef: "John 15:8",
    aim: "To yield daily to the Holy Spirit to manifest Christlike character and love."
  },
  {
    weekNumber: 7,
    topic: "Biblical Stewardship and Sacrificial Giving",
    scriptureReading: "Malachi 3:8-12; 2 Corinthians 9:6-15",
    memoryVerse: "So let each one give as he purposes in his heart, not grudgingly or of necessity; for God loves a cheerful giver.",
    memoryVerseRef: "2 Corinthians 9:7",
    aim: "To practice cheerful, regular giving and honor God with all material resources."
  },
  {
    weekNumber: 8,
    topic: "Building Strong Christian Families and Relationships",
    scriptureReading: "Ephesians 5:21-33, 6:1-4; Colossians 3:18-21",
    memoryVerse: "As for me and my house, we will serve the Lord.",
    memoryVerseRef: "Joshua 24:15c",
    aim: "To nurture godly harmony, mutual submission, and spiritual training at home."
  },
  {
    weekNumber: 9,
    topic: "Enduring Trials and Faith Under Pressure",
    scriptureReading: "James 1:2-12; 1 Peter 1:3-9",
    memoryVerse: "My brethren, count it all joy when you fall into various trials, knowing that the testing of your faith produces patience.",
    memoryVerseRef: "James 1:2-3",
    aim: "To maintain unwavering joy and hope while trusting God's sovereign deliverance."
  },
  {
    weekNumber: 10,
    topic: "The Unity of the Body and Mutual Ministry",
    scriptureReading: "Romans 12:3-13; 1 Corinthians 12:12-27",
    memoryVerse: "For as we have many members in one body, but all the members do not have the same function, so we, being many, are one body in Christ.",
    memoryVerseRef: "Romans 12:4-5a",
    aim: "To deploy our spiritual gifts willingly for the edification of the local assembly."
  },
  {
    weekNumber: 11,
    topic: "The Blessed Hope: The Return of Christ",
    scriptureReading: "1 Thessalonians 4:13-18; Titus 2:11-14",
    memoryVerse: "Looking for the blessed hope and glorious appearing of our great God and Savior Jesus Christ.",
    memoryVerseRef: "Titus 2:13",
    aim: "To live vigilantly with heavenly anticipation and eager readiness for our Lord."
  },
  {
    weekNumber: 12,
    topic: "Quarterly Review, Thanksgiving & Commissioning",
    scriptureReading: "Psalm 103:1-22; Colossians 3:15-17",
    memoryVerse: "And whatever you do in word or deed, do all in the name of the Lord Jesus, giving thanks to God the Father through Him.",
    memoryVerseRef: "Colossians 3:17",
    aim: "To celebrate spiritual growth, honor diligent students, and renew our covenant of service."
  }
];

export const INITIAL_DEFAULT_CLASS = {
  id: 'class_grace_truth',
  className: 'Grace & Truth Adult Bible Class',
  department: 'Adult' as const,
  secretaryName: 'Bro. Emmanuel Adebayo',
  secretaryPhone: '+234 803 123 4567',
  teachers: [
    { id: 't1', name: 'Elder Samuel Adeleke', phone: '+234 802 987 6543', isHeadTeacher: true },
    { id: 't2', name: 'Sis. Rebecca Olawale', phone: '+234 805 444 3322' }
  ],
  
  quarterTitle: 'Quarter 1: The Discipleship Standard',
  year: 2026,
  currencySymbol: '₦',
  isSetupComplete: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const INITIAL_MEMBERS_SEED: Member[] = [
  {
    id: 'm1_olumide',
    fullName: 'Olumide Fashola',
    phone: '+234 803 555 1201',
    address: '14 Alaba Street, Ikeja, Lagos',
    occupation: 'Software Engineer',
    gender: 'MALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: true,
    isHolyGhostBaptized: true,
    nextOfKinName: 'Mrs. Abigail Fashola',
    nextOfKinPhone: '+234 802 111 2233',
    nextOfKinRelationship: 'Wife',
    prayerRequests: 'Pray for upcoming certification exams and family travel mercies.',
    notes: 'Very punctual and active contributor during class discussions. Invited Kehinde Ogundele.',
    firstLessonWeek: 1,
    evangelismReferralCount: 2,
    enrolledDate: '2026-01-04',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm2_folashade',
    fullName: 'Folashade Adeleke',
    phone: '+234 802 777 8899',
    address: '8 Mission Way, Gofamint Layout, Maryland',
    occupation: 'Secondary School Teacher',
    gender: 'FEMALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: true,
    isHolyGhostBaptized: true,
    nextOfKinName: 'Elder Samuel Adeleke',
    nextOfKinPhone: '+234 802 987 6543',
    nextOfKinRelationship: 'Father',
    prayerRequests: 'Spiritual renewal and grace for choir ministry.',
    notes: 'Excels in verbatim memory verse recitation. Daughter of Elder Samuel Adeleke.',
    firstLessonWeek: 1,
    evangelismReferralCount: 2,
    enrolledDate: '2026-01-04',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm3_chinedu',
    fullName: 'Chinedu Okonkwo',
    phone: '+234 809 112 3344',
    address: '22 Airport Road, Ikeja, Lagos',
    occupation: 'Accountant',
    gender: 'MALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: true,
    isHolyGhostBaptized: false,
    nextOfKinName: 'Ngozi Okonkwo',
    nextOfKinPhone: '+234 809 998 8776',
    nextOfKinRelationship: 'Sister',
    prayerRequests: 'Wisdom in business management and Holy Spirit baptism.',
    notes: 'Late joiner starting Lesson 4, newly converted and baptized.',
    firstLessonWeek: 4,
    convertedFromVisitorAtLesson: 4,
    sponsorName: 'Olumide Fashola',
    evangelismReferralCount: 0,
    enrolledDate: '2026-01-25',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm4_ayotunde',
    fullName: 'Dr. Ayotunde Balogun',
    phone: '+234 813 667 8901',
    address: '5 Hospital Road, Maryland, Lagos',
    occupation: 'Medical Doctor',
    gender: 'MALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: true,
    isHolyGhostBaptized: true,
    nextOfKinName: 'Dr. (Mrs) Kemi Balogun',
    nextOfKinPhone: '+234 813 999 0011',
    nextOfKinRelationship: 'Wife',
    prayerRequests: 'Strength during night hospital shift schedules.',
    notes: 'Missed week 5 and 6 due to emergency medical call duty.',
    firstLessonWeek: 1,
    evangelismReferralCount: 1,
    enrolledDate: '2026-01-04',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm5_temitope',
    fullName: 'Temitope Ajayi',
    phone: '+234 806 333 9911',
    address: '17 Commercial Avenue, Yaba, Lagos',
    occupation: 'Graphic Designer',
    gender: 'MALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'STUDENT',
    status: 'HIGH_PROBABILITY',
    isBornAgain: true,
    isWaterBaptized: false,
    isHolyGhostBaptized: false,
    nextOfKinName: 'Mrs. Victoria Ajayi',
    nextOfKinPhone: '+234 806 444 8822',
    nextOfKinRelationship: 'Mother',
    prayerRequests: 'Recovery from malaria fever and job placement.',
    notes: 'Absent for 2 consecutive weeks, logged phone call check-in.',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    enrolledDate: '2026-01-04',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm6_grace_nnamdi',
    fullName: 'Grace Nnamdi',
    phone: '+234 812 555 7788',
    address: '10 Palm Avenue, Mushin, Lagos',
    occupation: 'Fashion Designer',
    gender: 'FEMALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: true,
    isHolyGhostBaptized: true,
    nextOfKinName: 'Emeka Nnamdi',
    nextOfKinPhone: '+234 812 666 8899',
    nextOfKinRelationship: 'Husband',
    prayerRequests: 'Divine fruit of the womb and business breakthrough.',
    notes: 'Consistently early to Sunday School; faithful note-taker.',
    firstLessonWeek: 1,
    evangelismReferralCount: 1,
    enrolledDate: '2026-01-04',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm7_babafemi_ojo',
    fullName: 'Babafemi Ojo',
    phone: '+234 805 777 6655',
    address: '29 Allen Avenue, Ikeja, Lagos',
    occupation: 'Building Contractor',
    gender: 'MALE',
    ageGroup: 'Middle Age (36-50)',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: true,
    isHolyGhostBaptized: true,
    nextOfKinName: 'Mrs. Toyin Ojo',
    nextOfKinPhone: '+234 805 888 1122',
    nextOfKinRelationship: 'Wife',
    prayerRequests: 'Grace for consistent family devotion and financial favor.',
    notes: 'Active contributor during open discussion questions.',
    firstLessonWeek: 1,
    evangelismReferralCount: 1,
    enrolledDate: '2026-01-04',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'm8_bukola_adeniyi',
    fullName: 'Bukola Adeniyi',
    phone: '+234 808 333 4455',
    address: '15 Praise Way, Ogba, Lagos',
    occupation: 'Pharmacist',
    gender: 'FEMALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: true,
    isHolyGhostBaptized: true,
    nextOfKinName: 'Mr. Wale Adeniyi',
    nextOfKinPhone: '+234 808 222 1100',
    nextOfKinRelationship: 'Husband',
    prayerRequests: 'Academic success in post-graduate exams.',
    notes: 'Also sings in the church choir and assists with memory verse drills.',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    enrolledDate: '2026-01-04',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'v1_kehinde',
    fullName: 'Kehinde Ogundele',
    phone: '+234 818 445 6677',
    address: '9 Unity Street, Anthony Village, Lagos',
    occupation: 'Civil Servant',
    gender: 'MALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'VISITOR',
    status: 'ACTIVE',
    isBornAgain: true,
    isWaterBaptized: false,
    isHolyGhostBaptized: false,
    nextOfKinName: 'Taiwo Ogundele',
    nextOfKinPhone: '+234 818 777 6655',
    nextOfKinRelationship: 'Brother',
    prayerRequests: 'Direction for career promotion and spiritual growth.',
    notes: 'Attended Lesson 5 and 6 consecutively! Eligible for conversion prompt.',
    firstLessonWeek: 5,
    consecutiveVisits: 2,
    referredByMemberId: 'm1_olumide',
    sponsorName: 'Olumide Fashola',
    evangelismReferralCount: 0,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'v2_blessing',
    fullName: 'Blessing Udoh',
    phone: '+234 814 223 5566',
    address: '3 Grace Lane, Palmgrove, Lagos',
    occupation: 'Registered Nurse',
    gender: 'FEMALE',
    ageGroup: 'Young Adult (25-35)',
    memberType: 'VISITOR',
    status: 'ACTIVE',
    isBornAgain: false,
    isWaterBaptized: false,
    isHolyGhostBaptized: false,
    nextOfKinName: 'Sunday Udoh',
    nextOfKinPhone: '+234 814 888 9900',
    nextOfKinRelationship: 'Brother',
    prayerRequests: 'Divine settlement and salvation of soul.',
    notes: 'First-time visitor in Lesson 6, warmly welcomed by Sunday School visitors committee.',
    firstLessonWeek: 6,
    consecutiveVisits: 1,
    referredByMemberId: 'm2_folashade',
    sponsorName: 'Folashade Adeleke',
    evangelismReferralCount: 0,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const generateInitialGrades = (): WeeklyGradeRecord[] => {
  const records: WeeklyGradeRecord[] = [];

  // Seed realistic grades for all 12 weeks
  // m1_olumide: Star student, present all 12 weeks
  for (let w = 1; w <= 12; w++) {
    records.push({
      id: `m1_olumide_week_${w}`,
      memberId: 'm1_olumide',
      weekNumber: w,
      attendance: 'PRESENT',
      punctuality: 15,
      memoryVerse: 14 + (w % 2),
      classParticipation: 19 + (w % 2),
      lessonTotal: 48 + (w % 3 === 0 ? 2 : 1),
      joinedPrayerMeeting: true,
      postedStatusInsight: w % 2 === 0,
      invitedSomeone: w === 5 || w === 10,
      updatedAt: new Date().toISOString()
    });
  }

  // m2_folashade: High memory verse scores all 12 weeks
  for (let w = 1; w <= 12; w++) {
    records.push({
      id: `m2_folashade_week_${w}`,
      memberId: 'm2_folashade',
      weekNumber: w,
      attendance: 'PRESENT',
      punctuality: 14,
      memoryVerse: 15,
      classParticipation: 18,
      lessonTotal: 47,
      joinedPrayerMeeting: true,
      postedStatusInsight: true,
      invitedSomeone: w === 6,
      updatedAt: new Date().toISOString()
    });
  }

  // m3_chinedu: Joined at Lesson 4 (Lessons 1-3 EXEMPT, Lessons 4-12 PRESENT)
  for (let w = 1; w <= 3; w++) {
    records.push({
      id: `m3_chinedu_week_${w}`,
      memberId: 'm3_chinedu',
      weekNumber: w,
      attendance: 'EXEMPT',
      punctuality: 0,
      memoryVerse: 0,
      classParticipation: 0,
      lessonTotal: 0,
      joinedPrayerMeeting: false,
      postedStatusInsight: false,
      invitedSomeone: false,
      updatedAt: new Date().toISOString()
    });
  }
  for (let w = 4; w <= 12; w++) {
    records.push({
      id: `m3_chinedu_week_${w}`,
      memberId: 'm3_chinedu',
      weekNumber: w,
      attendance: 'PRESENT',
      punctuality: 13 + (w % 3 === 0 ? 2 : 1),
      memoryVerse: 13 + (w % 2),
      classParticipation: 17,
      lessonTotal: 43 + (w % 2),
      joinedPrayerMeeting: true,
      postedStatusInsight: w % 3 === 0,
      invitedSomeone: false,
      updatedAt: new Date().toISOString()
    });
  }

  // m4_ayotunde: Present weeks 1-4, 7-12; Absent week 5 and 6
  for (let w = 1; w <= 12; w++) {
    if (w === 5 || w === 6) {
      records.push({
        id: `m4_ayotunde_week_${w}`,
        memberId: 'm4_ayotunde',
        weekNumber: w,
        attendance: 'ABSENT',
        punctuality: 0,
        memoryVerse: 0,
        classParticipation: 0,
        lessonTotal: 0,
        joinedPrayerMeeting: false,
        postedStatusInsight: false,
        invitedSomeone: false,
        notes: 'Hospital emergency night shift duty',
        updatedAt: new Date().toISOString()
      });
    } else {
      records.push({
        id: `m4_ayotunde_week_${w}`,
        memberId: 'm4_ayotunde',
        weekNumber: w,
        attendance: 'PRESENT',
        punctuality: 15,
        memoryVerse: 12 + (w % 3),
        classParticipation: 18,
        lessonTotal: 45 + (w % 2),
        joinedPrayerMeeting: true,
        postedStatusInsight: true,
        invitedSomeone: false,
        updatedAt: new Date().toISOString()
      });
    }
  }

  // m5_temitope: Present weeks 1-4, 7-12; Absent weeks 5 and 6 (triggers Orange alert)
  for (let w = 1; w <= 12; w++) {
    if (w === 5 || w === 6) {
      records.push({
        id: `m5_temitope_week_${w}`,
        memberId: 'm5_temitope',
        weekNumber: w,
        attendance: 'ABSENT',
        punctuality: 0,
        memoryVerse: 0,
        classParticipation: 0,
        lessonTotal: 0,
        joinedPrayerMeeting: false,
        postedStatusInsight: false,
        invitedSomeone: false,
        notes: 'Malaria fever convalescence',
        updatedAt: new Date().toISOString()
      });
    } else {
      records.push({
        id: `m5_temitope_week_${w}`,
        memberId: 'm5_temitope',
        weekNumber: w,
        attendance: 'PRESENT',
        punctuality: 12,
        memoryVerse: 11 + (w % 3),
        classParticipation: 15,
        lessonTotal: 38 + (w % 3),
        joinedPrayerMeeting: false,
        postedStatusInsight: false,
        invitedSomeone: false,
        updatedAt: new Date().toISOString()
      });
    }
  }

  // m6_grace_nnamdi: Present all 12 weeks
  for (let w = 1; w <= 12; w++) {
    records.push({
      id: `m6_grace_nnamdi_week_${w}`,
      memberId: 'm6_grace_nnamdi',
      weekNumber: w,
      attendance: 'PRESENT',
      punctuality: 15,
      memoryVerse: 14,
      classParticipation: 17,
      lessonTotal: 46,
      joinedPrayerMeeting: true,
      postedStatusInsight: true,
      invitedSomeone: w === 4,
      updatedAt: new Date().toISOString()
    });
  }

  // m7_babafemi_ojo: Present all 12 weeks
  for (let w = 1; w <= 12; w++) {
    records.push({
      id: `m7_babafemi_ojo_week_${w}`,
      memberId: 'm7_babafemi_ojo',
      weekNumber: w,
      attendance: 'PRESENT',
      punctuality: 13,
      memoryVerse: 12,
      classParticipation: 16,
      lessonTotal: 41,
      joinedPrayerMeeting: true,
      postedStatusInsight: false,
      invitedSomeone: false,
      updatedAt: new Date().toISOString()
    });
  }

  // m8_bukola_adeniyi: Present all 12 weeks
  for (let w = 1; w <= 12; w++) {
    records.push({
      id: `m8_bukola_adeniyi_week_${w}`,
      memberId: 'm8_bukola_adeniyi',
      weekNumber: w,
      attendance: 'PRESENT',
      punctuality: 14,
      memoryVerse: 15,
      classParticipation: 18,
      lessonTotal: 47,
      joinedPrayerMeeting: true,
      postedStatusInsight: true,
      invitedSomeone: false,
      updatedAt: new Date().toISOString()
    });
  }

  // v1_kehinde: Visitor attended week 5 and 6
  records.push({
    id: `v1_kehinde_week_5`,
    memberId: 'v1_kehinde',
    weekNumber: 5,
    attendance: 'PRESENT',
    punctuality: 14,
    memoryVerse: 10,
    classParticipation: 18,
    lessonTotal: 42,
    joinedPrayerMeeting: false,
    postedStatusInsight: false,
    invitedSomeone: false,
    updatedAt: new Date().toISOString()
  });
  records.push({
    id: `v1_kehinde_week_6`,
    memberId: 'v1_kehinde',
    weekNumber: 6,
    attendance: 'PRESENT',
    punctuality: 15,
    memoryVerse: 14,
    classParticipation: 19,
    lessonTotal: 48,
    joinedPrayerMeeting: true,
    postedStatusInsight: false,
    invitedSomeone: false,
    updatedAt: new Date().toISOString()
  });

  // v2_blessing: Visitor attended week 6
  records.push({
    id: `v2_blessing_week_6`,
    memberId: 'v2_blessing',
    weekNumber: 6,
    attendance: 'PRESENT',
    punctuality: 15,
    memoryVerse: 12,
    classParticipation: 16,
    lessonTotal: 43,
    joinedPrayerMeeting: false,
    postedStatusInsight: false,
    invitedSomeone: false,
    updatedAt: new Date().toISOString()
  });

  return records;
};

export const INITIAL_OFFERINGS_SEED: WeeklyOfferingRecord[] = [
  { id: 'week_1', weekNumber: 1, amount: 8500, notes: 'First Sunday of quarter thanksgiving offering', updatedAt: new Date().toISOString() },
  { id: 'week_2', weekNumber: 2, amount: 7200, notes: 'Class offering', updatedAt: new Date().toISOString() },
  { id: 'week_3', weekNumber: 3, amount: 9100, notes: 'Class offering', updatedAt: new Date().toISOString() },
  { id: 'week_4', weekNumber: 4, amount: 11400, notes: 'Evangelism special collection', updatedAt: new Date().toISOString() },
  { id: 'week_5', weekNumber: 5, amount: 8800, notes: 'Class offering', updatedAt: new Date().toISOString() },
  { id: 'week_6', weekNumber: 6, amount: 10500, notes: 'Mid-quarter offering', updatedAt: new Date().toISOString() },
  { id: 'week_7', weekNumber: 7, amount: 9600, notes: 'Class offering', updatedAt: new Date().toISOString() },
  { id: 'week_8', weekNumber: 8, amount: 12000, notes: 'Missions & literature drive offering', updatedAt: new Date().toISOString() },
  { id: 'week_9', weekNumber: 9, amount: 10200, notes: 'Class offering', updatedAt: new Date().toISOString() },
  { id: 'week_10', weekNumber: 10, amount: 11800, notes: 'Special soul winning Sunday offering', updatedAt: new Date().toISOString() },
  { id: 'week_11', weekNumber: 11, amount: 13500, notes: 'Quarter-end review offering', updatedAt: new Date().toISOString() },
  { id: 'week_12', weekNumber: 12, amount: 14800, notes: 'Grand Thanksgiving & Admonition preparation offering', updatedAt: new Date().toISOString() },
];

export const INITIAL_ABSENCE_LOGS_SEED: AbsenceLogRecord[] = [
  {
    id: 'log_m5_w6',
    memberId: 'm5_temitope',
    weekNumber: 6,
    consecutiveWeeksAbsent: 2,
    urgencyLevel: 'ORANGE',
    contactMethod: 'PHONE_CALL',
    reasonCategory: 'ILLNESS',
    escalationDecision: 'HIGH_PROBABILITY',
    notes: 'Secretary spoke with Bro. Temitope. Recovering well from malaria fever, promised to attend next Sunday with testimony.',
    loggedAt: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 'log_m4_w6',
    memberId: 'm4_ayotunde',
    weekNumber: 6,
    consecutiveWeeksAbsent: 2,
    urgencyLevel: 'ORANGE',
    contactMethod: 'WHATSAPP',
    reasonCategory: 'WORK_SCHOOL',
    notes: 'Dr. Ayotunde sent WhatsApp text confirming night emergency hospital duties during Sunday morning. Shared memory verse audio.',
    loggedAt: new Date(Date.now() - 1 * 86400000).toISOString()
  }
];

export const SEED_MEMBERS = INITIAL_MEMBERS_SEED;
export const SEED_GRADES = generateInitialGrades();
export const SEED_OFFERINGS = INITIAL_OFFERINGS_SEED;
export const SEED_CLASS_PROFILE = INITIAL_DEFAULT_CLASS;
export const SEED_ABSENCE_LOGS = INITIAL_ABSENCE_LOGS_SEED;

// -------------------------------------------------------------
// ADMIN ROLES SPECIFICATION (5 PERMITTED ADMINISTRATIVE IDS)
// -------------------------------------------------------------
import { AdminProfile, SundaySchoolYear, QuarterData, QuarterLesson, AdminRoleType } from '../types';

export interface AdminIdDefinition {
  roleType: AdminRoleType;
  title: string;
  defaultUsername: string;
  description: string;
  iconName: string;
}

export const PERMITTED_ADMIN_IDS: AdminIdDefinition[] = [
  {
    roleType: 'GENERAL_SUPERINTENDENT',
    title: 'General Superintendent ID',
    defaultUsername: 'gs_admin',
    description: 'Full system access: Access to every approved class portal, administrative oversight, officer profile approvals, and national Sunday School records.',
    iconName: 'Crown'
  },
  {
    roleType: 'GENERAL_SECRETARY',
    title: 'General Secretary ID',
    defaultUsername: 'gsec_admin',
    description: 'Full system access: Sunday School year & 4-quarter management, curriculum loading & distribution, department management, class approval, and class portals access.',
    iconName: 'FileSpreadsheet'
  },
  {
    roleType: 'TREASURER',
    title: 'Treasurer ID',
    defaultUsername: 'treasurer_admin',
    description: 'Financial access: Weekly Sunday School collections, class offering remittances, financial reports, and collation across all classes.',
    iconName: 'Coins'
  },
  {
    roleType: 'RECORD_OFFICER',
    title: 'Record Officer ID',
    defaultUsername: 'record_admin',
    description: 'Weekly class records & collation: Access records of every approved class week by week (attendance, visitors, performance, offerings) and produce the General Sunday School Weekly Record.',
    iconName: 'ClipboardList'
  },
  {
    roleType: 'ENROLLMENT_OFFICER',
    title: 'Enrollment Officer ID',
    defaultUsername: 'enrollment_admin',
    description: 'Newly enrolled students & census: Access newly enrolled/converted students across all classes, track spiritual milestones, and collate General Enrollment Records.',
    iconName: 'UserCheck'
  },
  {
    roleType: 'ASST_GENERAL_SECRETARY',
    title: 'Assistant General Secretary ID',
    defaultUsername: 'asst_gsec_admin',
    description: 'Administrative & secretarial records: Sunday School secretarial duties, collation assistance, and departmental correspondence.',
    iconName: 'BookCheck'
  }
];

export const ALL_APPROVED_CLASSES_SEED: ClassProfile[] = [
  INITIAL_DEFAULT_CLASS,
  {
    id: 'class_victory_youth',
    className: 'Victory Youth Bible Class',
    department: 'Youth' as const,
    secretaryName: 'Sis. Deborah Adeleke',
    secretaryPhone: '+234 802 334 5566',
    teachers: [
      { id: 't3', name: 'Pastor Stephen Omowaye', phone: '+234 803 998 7766', isHeadTeacher: true },
      { id: 't4', name: 'Bro. Joshua Fashina', phone: '+234 805 112 2334' }
    ],
    
    quarterTitle: 'Quarter 1: Youth Discipleship & Zeal',
    year: 2026,
    currencySymbol: '₦',
    isSetupComplete: true,
    approvalStatus: 'APPROVED',
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'class_good_shepherd_children',
    className: 'Good Shepherd Children Class',
    department: 'Children' as const,
    secretaryName: 'Sis. Grace Alabi',
    secretaryPhone: '+234 813 445 6677',
    teachers: [
      { id: 't5', name: 'Deaconess Mary Oladipo', phone: '+234 802 888 9900', isHeadTeacher: true },
      { id: 't6', name: 'Sis. Dorcas Balogun', phone: '+234 806 777 1122' }
    ],
    
    quarterTitle: 'Quarter 1: Jesus Loves the Children',
    year: 2026,
    currencySymbol: '₦',
    isSetupComplete: true,
    approvalStatus: 'APPROVED',
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'class_living_faith_teens',
    className: 'Living Faith Teens Class',
    department: 'Youth' as const,
    secretaryName: 'Bro. Daniel Ojo',
    secretaryPhone: '+234 818 990 0112',
    teachers: [
      { id: 't7', name: 'Bro. Caleb Olaniyan', phone: '+234 807 665 4433', isHeadTeacher: true },
      { id: 't8', name: 'Sis. Faith Adeyemi', phone: '+234 809 332 1100' }
    ],
    
    quarterTitle: 'Quarter 1: Teens Standing for Christ',
    year: 2026,
    currencySymbol: '₦',
    isSetupComplete: true,
    approvalStatus: 'APPROVED',
    createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'class_emmanuel_believers',
    className: 'Emmanuel Adult Believers Class',
    department: 'Adult' as const,
    secretaryName: 'Bro. Michael Adeleke',
    secretaryPhone: '+234 803 777 4411',
    teachers: [
      { id: 't9', name: 'Elder David Ajayi', phone: '+234 802 667 8899', isHeadTeacher: true },
      { id: 't10', name: 'Pastor Jacob Olorunfemi', phone: '+234 805 223 3445' }
    ],
    
    quarterTitle: 'Quarter 1: Basic Bible Doctrines',
    year: 2026,
    currencySymbol: '₦',
    isSetupComplete: true,
    approvalStatus: 'APPROVED',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_ADMIN_PROFILES: AdminProfile[] = [
  {
    id: 'GENERAL_SUPERINTENDENT',
    roleType: 'GENERAL_SUPERINTENDENT',
    title: 'General Superintendent ID',
    profileName: 'Pastor Dr. E.O. Abina',
    username: 'gs_admin',
    
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'GENERAL_SECRETARY',
    roleType: 'GENERAL_SECRETARY',
    title: 'General Secretary ID',
    profileName: 'Pastor S.O. Omowaye',
    username: 'gsec_admin',
    
    isApproved: true,
    approvedBy: 'GENERAL_SUPERINTENDENT',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'TREASURER',
    roleType: 'TREASURER',
    title: 'Treasurer ID',
    profileName: 'Elder D.A. Oladipo',
    username: 'treasurer_admin',
    
    isApproved: true,
    approvedBy: 'GENERAL_SUPERINTENDENT',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'RECORD_OFFICER',
    roleType: 'RECORD_OFFICER',
    title: 'Record Officer ID',
    profileName: 'Bro. Emmanuel Adebayo',
    username: 'record_admin',
    
    isApproved: true,
    approvedBy: 'GENERAL_SUPERINTENDENT',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ENROLLMENT_OFFICER',
    roleType: 'ENROLLMENT_OFFICER',
    title: 'Enrollment Officer ID',
    profileName: 'Pastor J.K. Ajayi',
    username: 'enrollment_admin',
    
    isApproved: true,
    approvedBy: 'GENERAL_SUPERINTENDENT',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ASST_GENERAL_SECRETARY',
    roleType: 'ASST_GENERAL_SECRETARY',
    title: 'Assistant General Secretary ID',
    profileName: 'Pastor T.A. Olaniyan',
    username: 'asst_gsec_admin',
    
    isApproved: true,
    approvedBy: 'GENERAL_SUPERINTENDENT',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_DEPARTMENTS: string[] = [
  'Adult',
  'Youth',
  'Children'
];

export const FRESH_UNINITIALIZED_YEAR: SundaySchoolYear = {
  id: 'YEAR_FRESH_SETUP',
  yearName: '',
  overallTheme: 'General Faith & Holy Service',
  startDate: '',
  endDate: '',
  activeQuarterNumber: 1,
  isInitialized: false,
  departments: [],
  updatedAt: new Date().toISOString(),
  quarters: [
    {
      id: 'Q1_FRESH',
      quarterNumber: 1,
      quarterName: 'First Quarter',
      quarterTheme: 'General Faith & Holy Service',
      startDate: '',
      endDate: '',
      sharingAdmonitionDate: '',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'UPCOMING',
      isDistributed: false,
      lessons: [],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'Q2_FRESH',
      quarterNumber: 2,
      quarterName: 'Second Quarter',
      quarterTheme: '',
      startDate: '',
      endDate: '',
      sharingAdmonitionDate: '',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'UPCOMING',
      isDistributed: false,
      lessons: [],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'Q3_FRESH',
      quarterNumber: 3,
      quarterName: 'Third Quarter',
      quarterTheme: '',
      startDate: '',
      endDate: '',
      sharingAdmonitionDate: '',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'UPCOMING',
      isDistributed: false,
      lessons: [],
      updatedAt: new Date().toISOString()
    },
    {
      id: 'Q4_FRESH',
      quarterNumber: 4,
      quarterName: 'Fourth Quarter',
      quarterTheme: '',
      startDate: '',
      endDate: '',
      sharingAdmonitionDate: '',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'UPCOMING',
      isDistributed: false,
      lessons: [],
      updatedAt: new Date().toISOString()
    }
  ]
};

export const INITIAL_SUNDAY_SCHOOL_YEAR: SundaySchoolYear = {
  id: 'YEAR_2025_2026',
  yearName: '2025–2026 Sunday School Year',
  overallTheme: 'Walking in Divine Light and Truth (1 John 1:7)',
  startDate: '2025-09-07',
  endDate: '2026-08-30',
  activeQuarterNumber: 1,
  isInitialized: true,
  departments: [...DEFAULT_DEPARTMENTS],
  updatedAt: new Date().toISOString(),
  quarters: [
    {
      id: 'Q1_2025_2026',
      quarterNumber: 1,
      quarterName: 'First Quarter',
      quarterTheme: 'Foundations of Christian Faith & Discipleship',
      startDate: '2025-09-07',
      endDate: '2025-11-23',
      sharingAdmonitionDate: '2025-11-30',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'ACTIVE',
      isDistributed: true,
      distributedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lessons: [
        ...GOFAMINT_HOF_12_LESSONS.map(l => ({
          weekNumber: l.weekNumber,
          topic: l.topic,
          scriptureReading: l.scriptureReading,
          memoryVerse: l.memoryVerse,
          memoryVerseRef: l.memoryVerseRef,
          aim: l.aim
        })),
        {
          weekNumber: 13,
          isSharingAdmonitionWeek: true,
          topic: 'Sharing, Admonition & Quarterly Love Feast',
          scriptureReading: 'Hebrews 10:23-25; 1 Thessalonians 5:11-22',
          memoryVerse: 'Let us consider one another in order to stir up love and good works.',
          memoryVerseRef: 'Hebrews 10:24',
          aim: 'Mutual encouragement, spiritual testimonies, brotherly admonition, and quarterly evaluation.'
        }
      ]
    },
    {
      id: 'Q2_2025_2026',
      quarterNumber: 2,
      quarterName: 'Second Quarter',
      quarterTheme: 'Spiritual Warfare, Prayer, and Holy Living',
      startDate: '2025-12-07',
      endDate: '2026-02-22',
      sharingAdmonitionDate: '2026-03-01',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'UPCOMING',
      isDistributed: false,
      updatedAt: new Date().toISOString(),
      lessons: [
        {
          weekNumber: 13,
          isSharingAdmonitionWeek: true,
          topic: 'Sharing, Admonition & Quarterly Love Feast',
          scriptureReading: 'Hebrews 10:23-25; 1 Thessalonians 5:11-22',
          memoryVerse: 'Let us consider one another in order to stir up love and good works.',
          memoryVerseRef: 'Hebrews 10:24',
          aim: 'Mutual encouragement, spiritual testimonies, and prayer celebration.'
        }
      ]
    },
    {
      id: 'Q3_2025_2026',
      quarterNumber: 3,
      quarterName: 'Third Quarter',
      quarterTheme: 'Kingdom Stewardship & Fruitful Service',
      startDate: '2026-03-08',
      endDate: '2026-05-24',
      sharingAdmonitionDate: '2026-05-31',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'UPCOMING',
      isDistributed: false,
      updatedAt: new Date().toISOString(),
      lessons: [
        {
          weekNumber: 13,
          isSharingAdmonitionWeek: true,
          topic: 'Sharing, Admonition & Quarterly Love Feast',
          scriptureReading: 'Hebrews 10:23-25; 1 Thessalonians 5:11-22',
          memoryVerse: 'Let us consider one another in order to stir up love and good works.',
          memoryVerseRef: 'Hebrews 10:24',
          aim: 'Mutual encouragement and quarterly review.'
        }
      ]
    },
    {
      id: 'Q4_2025_2026',
      quarterNumber: 4,
      quarterName: 'Fourth Quarter',
      quarterTheme: "The Blessed Hope and Christ's Imminent Return",
      startDate: '2026-06-07',
      endDate: '2026-08-23',
      sharingAdmonitionDate: '2026-08-30',
      totalLessonWeeks: 12,
      hasSharingAdmonitionWeek: true,
      status: 'UPCOMING',
      isDistributed: false,
      updatedAt: new Date().toISOString(),
      lessons: [
        {
          weekNumber: 13,
          isSharingAdmonitionWeek: true,
          topic: 'Sharing, Admonition & Quarterly Love Feast',
          scriptureReading: 'Hebrews 10:23-25; 1 Thessalonians 5:11-22',
          memoryVerse: 'Let us consider one another in order to stir up love and good works.',
          memoryVerseRef: 'Hebrews 10:24',
          aim: 'Annual thanksgiving and spiritual commissioning.'
        }
      ]
    }
  ]
};


