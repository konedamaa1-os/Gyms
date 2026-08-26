-- Drop existing tables if they exist (clean setup)
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS tx CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS staff CASCADE;

-- 1. Create Staff Table
CREATE TABLE staff (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    role TEXT,
    tel TEXT,
    salaire NUMERIC DEFAULT 0
);

-- 2. Create Users Table (Authentication profiles)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    label TEXT
);

-- 3. Create Members Table
CREATE TABLE members (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    prenoms TEXT DEFAULT '',
    tel TEXT,
    whatsapp TEXT DEFAULT '',
    sexe TEXT DEFAULT 'Homme',
    "dateNaissance" TEXT DEFAULT '',
    profession TEXT DEFAULT '',
    quartier TEXT DEFAULT '',
    lieu TEXT DEFAULT 'Divo',
    "urgenceNom" TEXT DEFAULT '',
    "urgenceTel" TEXT DEFAULT '',
    "urgenceLien" TEXT DEFAULT '',
    carte TEXT,
    inscription TEXT,
    expiration TEXT,
    objectifs JSONB DEFAULT '[]'::jsonb,
    q1 TEXT DEFAULT 'Non',
    q2 TEXT DEFAULT 'Non',
    q3 TEXT DEFAULT 'Non',
    q4 TEXT DEFAULT 'Non',
    q5 TEXT DEFAULT 'Non',
    q6 TEXT DEFAULT 'Non',
    q7 TEXT DEFAULT 'Non',
    remarques TEXT DEFAULT ''
);

-- 4. Create Schedule Table (Classes/Emploi du temps)
CREATE TABLE schedule (
    id TEXT PRIMARY KEY,
    activite TEXT NOT NULL,
    coach TEXT,
    jour TEXT,
    debut TEXT,
    fin TEXT
);

-- 5. Create Transactions Table (Ledger/Finances)
CREATE TABLE tx (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'recette', 'depense', 'salaire'
    description TEXT,
    montant NUMERIC DEFAULT 0,
    date TEXT,
    "staffId" TEXT -- Linked to staff member
);

-- 6. Create Tickets Table (Daily entrances)
CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    tel TEXT,
    date TEXT,
    heure TEXT,
    montant NUMERIC DEFAULT 0,
    "isMember" BOOLEAN DEFAULT FALSE,
    "isDgGuest" BOOLEAN DEFAULT FALSE,
    "startDate" TEXT,
    "endDate" TEXT,
    "dgPeriod" TEXT,
    "dgNote" TEXT,
    timestamp NUMERIC
);

-- --- SEED DATA ---
-- Default Super Admin account
INSERT INTO users (id, username, password, role, label)
VALUES ('usr-admin', 'badrafaly@gmail.com', 'B@dr@f@ly', 'Administrateur', 'Super Admin')
ON CONFLICT (username) DO NOTHING;
