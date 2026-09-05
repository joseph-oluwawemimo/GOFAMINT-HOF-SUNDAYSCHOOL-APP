-- ==========================================================
-- THE GOSPEL FAITH MISSION INTL (GOFAMINT_HOF)
-- SUNDAY SCHOOL SECRETARY MANAGEMENT SYSTEM
-- Central Host Database Schema (PostgreSQL & SQLite Compatible)
-- ==========================================================

-- 1. Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(64) PRIMARY KEY,
    class_name VARCHAR(120) NOT NULL UNIQUE, -- Serves as login username / class identifier
    department VARCHAR(64) NOT NULL,        -- e.g. 'Youth', 'Young Adults', 'Men', 'Women'
    secretary_name VARCHAR(120) NOT NULL,
    secretary_phone VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    quarter_title VARCHAR(120) DEFAULT 'Quarter 1',
    year INTEGER DEFAULT 2026,
    currency_symbol VARCHAR(8) DEFAULT '₦',
    is_setup_complete BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Class Teachers (Supports dynamic multiple teachers per class)
CREATE TABLE IF NOT EXISTS class_teachers (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    is_head_teacher BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Members Table (Dual Roster: Student vs Visitor)
CREATE TABLE IF NOT EXISTS members (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(32),
    address TEXT,
    occupation VARCHAR(100),
    member_type VARCHAR(20) NOT NULL CHECK (member_type IN ('STUDENT', 'VISITOR')),
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LEFT_CLASS', 'RELEGATED_VISITOR', 'HIGH_PROBABILITY')),
    prayer_requests TEXT,
    notes TEXT,
    photo_base64 TEXT, -- Base64 encoded portrait photo for local offline operation
    first_lesson_week INTEGER DEFAULT 1 CHECK (first_lesson_week BETWEEN 1 AND 12),
    consecutive_visits INTEGER DEFAULT 0,
    converted_from_visitor_at_lesson INTEGER,
    referred_by_member_id VARCHAR(64) REFERENCES members(id) ON DELETE SET NULL,
    evangelism_referral_count INTEGER DEFAULT 0,
    exit_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Weekly 12-Lesson Attendance and Grading Records
CREATE TABLE IF NOT EXISTS weekly_grades (
    id VARCHAR(128) PRIMARY KEY, -- e.g. 'm1_week_1'
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    member_id VARCHAR(64) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 12),
    attendance VARCHAR(20) NOT NULL CHECK (attendance IN ('PRESENT', 'ABSENT', 'EXEMPT')),
    punctuality INTEGER DEFAULT 0 CHECK (punctuality BETWEEN 0 AND 15),
    memory_verse INTEGER DEFAULT 0 CHECK (memory_verse BETWEEN 0 AND 15),
    class_participation INTEGER DEFAULT 0 CHECK (class_participation BETWEEN 0 AND 20),
    lesson_total INTEGER DEFAULT 0 CHECK (lesson_total BETWEEN 0 AND 50),
    joined_prayer_meeting BOOLEAN DEFAULT FALSE,
    posted_status_insight BOOLEAN DEFAULT FALSE,
    invited_someone BOOLEAN DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_member_week UNIQUE (member_id, week_number)
);

-- 5. Weekly Offering Collections Table
CREATE TABLE IF NOT EXISTS weekly_offerings (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'week_1'
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 12),
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    recorded_by VARCHAR(120),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_class_week_offering UNIQUE (class_id, week_number)
);

-- 6. Absence Log & Pastoral Escalation History Table
CREATE TABLE IF NOT EXISTS absence_logs (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    member_id VARCHAR(64) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 12),
    consecutive_weeks_absent INTEGER NOT NULL,
    urgency_level VARCHAR(20) NOT NULL CHECK (urgency_level IN ('YELLOW', 'ORANGE', 'RED', 'CRITICAL')),
    contact_method VARCHAR(30) NOT NULL CHECK (contact_method IN ('WHATSAPP', 'PHONE_CALL', 'PASTORAL_VISIT', 'IN_PERSON')),
    reason_category VARCHAR(40) CHECK (reason_category IN ('ILLNESS', 'TRAVEL', 'PERSONAL', 'WORK_SCHOOL', 'RELOCATION', 'FAMILY_EMERGENCY', 'OTHER')),
    escalation_decision VARCHAR(40) CHECK (escalation_decision IN ('LEFT_CLASS', 'RELEGATED_VISITOR', 'HIGH_PROBABILITY')),
    exit_note TEXT,
    notes TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Evangelism Referrals & Discipleship Credit Table
CREATE TABLE IF NOT EXISTS evangelism_referrals (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    sponsor_member_id VARCHAR(64) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visitor_member_id VARCHAR(64) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    week_introduced INTEGER NOT NULL CHECK (week_introduced BETWEEN 1 AND 12),
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid offline querying and background sync resolution
CREATE INDEX IF NOT EXISTS idx_members_class_type ON members(class_id, member_type, status);
CREATE INDEX IF NOT EXISTS idx_grades_member_week ON weekly_grades(member_id, week_number);
CREATE INDEX IF NOT EXISTS idx_absence_member ON absence_logs(member_id, week_number);
CREATE INDEX IF NOT EXISTS idx_offerings_class_week ON weekly_offerings(class_id, week_number);
