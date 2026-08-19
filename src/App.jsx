import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Utilities
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const getWeekRange = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const day = date.getDay() || 7; // Sunday is 7
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const fmtDate = (d) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
  return `${fmtDate(monday)} au ${fmtDate(sunday)}`;
};

const CARD_TIERS_DEFAULT = [
  { key: "Bronze (Mensuel)", color: "#C25E28", light: "rgba(224, 144, 102, 0.15)", bg: "linear-gradient(135deg, #FFF9F5 0%, #F3D9C9 50%, #C25E28 100%)", price: 10000, duration: 1, description: "Accès standard musculation & cardio pour 1 mois." },
  { key: "Argent (Trimestriel)", color: "#475569", light: "rgba(71, 85, 105, 0.15)", bg: "linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 50%, #64748B 100%)", price: 40000, duration: 3, description: "Accès complet, cours collectifs & 1 séance coach / mois pendant 3 mois." },
  { key: "Or (Annuel)", color: "#D97706", light: "rgba(217, 119, 6, 0.15)", bg: "linear-gradient(135deg, #FFFDF5 0%, #FEF3C7 50%, #D97706 100%)", price: 150000, duration: 12, description: "Accès VIP illimité, suivi diététique & coach privé pendant 12 mois." },
  { key: "Séances à la carte (10 entrées)", color: "#8B5CF6", light: "rgba(139, 92, 246, 0.15)", bg: "linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 50%, #8B5CF6 100%)", price: 12000, duration: 3, description: "Pack flexible de 10 entrées individuelles, valable 3 mois." },
  { key: "Ticket Unique (Séance Unique)", color: "#EF4444", light: "rgba(239, 68, 68, 0.15)", bg: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 50%, #EF4444 100%)", price: 1000, duration: 0, description: "Accès d'une journée complète sans engagement aux installations du club." },
];

const ROLES = ["Coach", "Secretaire", "Comptable", "Gardien", "Agent d'entretien"];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LEVEL_ROLES = ["Administrateur", "Secretaire", "Comptable"];

// Default seeds matching employee IDs
const USERS_SEED = [
  { id: "usr-admin", username: "badrafaly@gmail.com", password: "B@dr@f@ly", role: "Administrateur", label: "Super Admin" }
];

const seedMembers = () => [];
const seedStaff = () => [];
const seedSchedule = () => [];
const seedTickets = () => [];
const seedTx = () => [];

const getMemberStatus = (m) => {
  const t = today();
  if (m.expiration < t) return { label: "Expiré", color: "#EF4444", bg: "#FEE2E2" };
  
  const expTime = new Date(m.expiration).getTime();
  const todayTime = new Date(t).getTime();
  const diffDays = (expTime - todayTime) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return { label: "Expire Bientôt", color: "#D97706", bg: "#FEF3C7" };
  
  return { label: "Actif", color: "#059669", bg: "#D1FAE5" };
};

export default function GymApp() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("gyms_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [view, setView] = useState(() => {
    try {
      const savedUser = localStorage.getItem("gyms_user");
      return savedUser ? "dashboard" : "public";
    } catch (e) {
      return "public";
    }
  });
  const [tab, setTab] = useState(() => {
    try {
      const savedUser = localStorage.getItem("gyms_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === "Administrateur") return "dashboard";
        if (parsed.role === "Secretaire") return "membres";
        if (parsed.role === "Comptable") return "finances";
      }
      return "dashboard";
    } catch (e) {
      return "dashboard";
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [tx, setTx] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]); // Dynamic Login Accounts (levels) State
  const [cardTiers, setCardTiers] = useState(CARD_TIERS_DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const [showGuide, setShowGuide] = useState(false); // Quick Start Guide Modal State

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Load from Supabase
  useEffect(() => {
    (async () => {
      try {
        const [
          { data: membersData, error: membersErr },
          { data: staffData, error: staffErr },
          { data: scheduleData, error: scheduleErr },
          { data: txData, error: txErr },
          { data: ticketsData, error: ticketsErr },
          { data: usersData, error: usersErr },
          { data: cardTiersData, error: cardTiersErr }
        ] = await Promise.all([
          supabase.from("members").select("*"),
          supabase.from("staff").select("*"),
          supabase.from("schedule").select("*"),
          supabase.from("tx").select("*"),
          supabase.from("tickets").select("*"),
          supabase.from("users").select("*"),
          supabase.from("card_tiers").select("*")
        ]);

        if (membersErr) console.error("Error loading members:", membersErr);
        if (staffErr) console.error("Error loading staff:", staffErr);
        if (scheduleErr) console.error("Error loading schedule:", scheduleErr);
        if (txErr) console.error("Error loading tx:", txErr);
        if (ticketsErr) console.error("Error loading tickets:", ticketsErr);
        if (usersErr) console.error("Error loading users:", usersErr);
        if (cardTiersErr) console.error("Error loading card tiers:", cardTiersErr);

        setMembers(membersData || []);
        setStaff(staffData || []);
        setSchedule(scheduleData || []);
        setTx(txData || []);
        setTickets(ticketsData || []);
        setUsers(usersData && usersData.length > 0 ? usersData : USERS_SEED);

        const order = { 
          "Bronze (Mensuel)": 1, 
          "Argent (Trimestriel)": 2, 
          "Or (Annuel)": 3, 
          "Séances à la carte (10 entrées)": 4, 
          "Ticket Unique (Séance Unique)": 5 
        };
        const sortedCardTiers = cardTiersData && cardTiersData.length > 0
          ? cardTiersData.sort((a, b) => (order[a.key] || 99) - (order[b.key] || 99))
          : CARD_TIERS_DEFAULT;
        setCardTiers(sortedCardTiers);
      } catch (err) {
        console.error("Failed to load from Supabase:", err);
        setMembers([]);
        setStaff([]);
        setSchedule([]);
        setTx([]);
        setTickets([]);
        setUsers(USERS_SEED);
        setCardTiers(CARD_TIERS_DEFAULT);
      }
      if (!localStorage.getItem("gyms_user")) {
        setView("public");
      }
      setLoaded(true);
    })();
  }, []);

  // Financial Metrics
  const recettesTickets = tickets.reduce((s, t) => s + Number(t.montant || 0), 0);
  const recettesTx = tx.filter(t => t.type === "recette").reduce((s, t) => s + Number(t.montant), 0);
  const depenses = tx.filter(t => t.type === "depense").reduce((s, t) => s + Number(t.montant), 0);
  const salairesVerses = tx.filter(t => t.type === "salaire").reduce((s, t) => s + Number(t.montant), 0);
  
  const revenuTotal = recettesTickets + recettesTx;
  const solde = revenuTotal - depenses - salairesVerses;
  const ticketsAujourdhui = tickets.filter(t => t.date === today());

  const TABS = [
    { key: "dashboard", label: "Tableau de bord", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg> },
    { key: "membres", label: "Membres & Cartes", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg> },
    { key: "accueil", label: "Accueil / Tickets", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"></path><line x1="12" y1="5" x2="12" y2="19"></line></svg> },
    { key: "boutique", label: "Boutique / POS", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> },
    { key: "planning", label: "Emploi du temps", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> },
    { key: "finances", label: "Finances & Ledger", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> },
    { key: "personnel", label: "Personnel", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
  ];

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  // Get tabs filtered by user level/role
  const getFilteredTabs = () => {
    if (!user) return [];
    if (user.role === "Administrateur") return TABS;
    if (user.role === "Secretaire") {
      return TABS.filter(t => t.key === "membres" || t.key === "accueil" || t.key === "boutique" || t.key === "planning");
    }
    if (user.role === "Comptable") {
      return TABS.filter(t => t.key === "boutique" || t.key === "finances" || t.key === "personnel");
    }
    return [];
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const foundUser = users.find(
      (u) => u.username.toLowerCase() === loginForm.username.toLowerCase() && u.password === loginForm.password
    );

    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem("gyms_user", JSON.stringify(foundUser));
      setLoginForm({ username: "", password: "" });
      setLoginError("");
      
      // Auto redirect to their first authorized tab
      if (foundUser.role === "Administrateur") setTab("dashboard");
      else if (foundUser.role === "Secretaire") setTab("membres");
      else if (foundUser.role === "Comptable") setTab("finances");

      setView("dashboard");
      triggerToast(`Bienvenue dans votre espace, ${foundUser.label} !`);
    } else {
      setLoginError("Identifiant ou mot de passe incorrect");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("gyms_user");
    setView("public");
    triggerToast("Déconnexion réussie");
  };

  const resetApp = async () => {
    if (confirm("⚠️ Voulez-vous vraiment EFFACER toutes les données de test (membres, tickets, finances, planning, personnel) sur Supabase pour recommencer à zéro ? Cette action est irréversible !")) {
      try {
        const [
          { error: err1 },
          { error: err2 },
          { error: err3 },
          { error: err4 },
          { error: err5 },
          { error: err6 }
        ] = await Promise.all([
          supabase.from("tickets").delete().neq("id", ""),
          supabase.from("tx").delete().neq("id", ""),
          supabase.from("schedule").delete().neq("id", ""),
          supabase.from("members").delete().neq("id", ""),
          supabase.from("users").delete().neq("id", ""),
          supabase.from("staff").delete().neq("id", "")
        ]);

        if (err1 || err2 || err3 || err4 || err5 || err6) {
          triggerToast("Erreur lors de la réinitialisation sur Supabase");
          console.error({ err1, err2, err3, err4, err5, err6 });
          return;
        }

        // Re-insert Super Admin
        const { error: adminErr } = await supabase.from("users").insert([USERS_SEED[0]]);
        if (adminErr) console.error(adminErr);

        setMembers([]);
        setStaff([]);
        setSchedule([]);
        setTx([]);
        setTickets([]);
        setUsers(USERS_SEED);
        setUser(USERS_SEED[0]);
        setTab("dashboard");
        triggerToast("Toutes les données ont été effacées sur Supabase. Base réinitialisée !");
      } catch (err) {
        console.error(err);
        triggerToast("Échec de la réinitialisation");
      }
    }
  };

  return (
    <div className="app-container" style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
        h1, h2, h3, h4, .disp { font-family: 'Outfit', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        
        input, select { font-family: 'Inter', sans-serif; color: #0F172A; outline: none; }
        input:focus, select:focus {
          border-color: #6366F1 !important;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
        }
        
        button { cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); font-family: 'Inter', sans-serif; }
        ::placeholder { color: #94A3B8; }
        
        /* Webkit Scrollbars Custom styling */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 6px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
        
        /* High-end Animations */
        .btn-glow {
          position: relative;
          overflow: hidden;
        }
        .btn-glow:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.25);
          filter: brightness(1.05);
        }
        .btn-glow:active {
          transform: translateY(0);
        }
        
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          background: transparent;
          border: none;
          color: #475569;
          padding: 13px 16px;
          border-radius: 8px 0 0 8px;
          font-size: 14px;
          font-weight: 500;
          width: 100%;
          margin-bottom: 5px;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          background: #F8FAFC;
          color: #6366F1;
        }
        .tab-btn-active {
          background: rgba(99, 102, 241, 0.08) !important;
          color: #6366F1 !important;
          font-weight: 600;
          border-right: 3px solid #6366F1;
        }

        .card-glow {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-glow:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.06);
        }
        
        /* Floating snackbar toast animation */
        @keyframes slideInUp {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .toast-float {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 10000;
          background: #FFFFFF;
          color: #0F172A;
          border: 1px solid #E2E8F0;
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Printable thermal receipt styling */
        @media print {
          html, body {
            height: 100% !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #FFFFFF !important;
          }
          
          /* Hide all screen elements */
          body * {
            visibility: hidden;
          }
          
          /* Force all containers to collapse to 0 height */
          #root, #root * {
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          
          /* Make only the print-only receipt visible */
          .print-only, .print-only * {
            visibility: visible !important;
            height: auto !important;
          }
          
          .print-only {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            background: white !important;
            color: black !important;
            font-family: 'JetBrains Mono', monospace !important;
            padding: 8px !important;
            box-sizing: border-box !important;
          }
          
          @page {
            margin: 0 !important;
          }
        }

        .btn-brown-guide {
          background: #78350F;
          color: #FFFFFF;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(120, 53, 15, 0.25);
          width: 100%;
          margin-bottom: 14px;
        }
        .btn-brown-guide:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(120, 53, 15, 0.35);
          background: #5B2508;
        }
        .btn-brown-guide:active {
          transform: translateY(0);
        }

        /* Mobile Responsive System */
        .mobile-header {
          display: none;
          background: #0F172A;
          padding: 14px 20px;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          width: 100%;
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        @media (max-width: 1024px) {
          .mobile-header {
            display: flex;
          }
          
          .app-container {
            flex-direction: column !important;
            overflow: auto !important;
          }
          
          .app-sidebar {
            position: fixed !important;
            top: 57px; /* height of mobile header */
            left: 0;
            width: 100% !important;
            height: calc(100vh - 57px) !important;
            z-index: 999;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex !important;
            flex-shrink: 0;
          }
          
          .app-sidebar.open {
            transform: translateX(0);
          }
          
          .app-main {
            padding: 20px 15px !important;
            max-height: none !important;
            overflow-y: visible !important;
            width: 100% !important;
          }
          
          header {
            padding: 12px 15px !important;
          }
          header nav {
            display: none !important;
          }
          
          #hero h1 {
            font-size: 26px !important;
            line-height: 1.3 !important;
          }
          #hero p {
            font-size: 14px !important;
          }
          #tarifs > div {
            padding: 40px 15px !important;
          }
          section {
            padding: 40px 15px !important;
          }
        }
        
        @media (min-width: 1025px) {
          .app-sidebar {
            transform: none !important;
          }
        }
      `}</style>

      {/* Floating Snackbar Toast */}
      {toast && (
        <div style={S.toast} className="toast-float">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" style={{ marginRight: 8, flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 8 12 12 16 14"></polyline></svg>
          {toast}
        </div>
      )}

      {/* Interactive Quick Start Guide Modal */}
      {showGuide && (
        <GuideModal onClose={() => setShowGuide(false)} />
      )}

      {/* View router switcher */}
      {view === "public" && (
        <PublicLanding setView={setView} schedule={schedule} cardTiers={cardTiers} staff={staff} />
      )}
      
      {view === "login" && (
        <LoginScreen
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          loginError={loginError}
          onSubmit={handleLoginSubmit}
          onCancel={() => setView("public")}
          users={users}
        />
      )}
      
      {view === "dashboard" && user && (
        <>
          {/* Mobile Top Header */}
          <div className="mobile-header no-print">
            <div className="disp" style={{ color: "#FFF", fontSize: 20, fontWeight: 800 }}>
              FORGE<span style={{ color: "#6366F1" }}>.</span>GYM
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                background: "transparent",
                border: "none",
                color: "#FFF",
                fontSize: 24,
                padding: 4,
                display: "flex",
                alignItems: "center"
              }}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>

          {/* Sidebar Navigation - Deep Dark Slate-800 for high quality split design */}
          <div className={`app-sidebar ${mobileMenuOpen ? "open" : ""} no-print`} style={S.sidebar}>
            <div style={S.brand}>
              <div className="disp" style={{ ...S.brandTitle, display: "flex", alignItems: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, flexShrink: 0 }}>
                  <path d="M6 12h12" />
                  <path d="M6.5 8v8" strokeWidth="3" />
                  <path d="M4.5 9v6" strokeWidth="4" />
                  <path d="M17.5 8v8" strokeWidth="3" />
                  <path d="M19.5 9v6" strokeWidth="4" />
                </svg>
                FORGE<span style={{ color: "#6366F1" }}>.</span>GYM
              </div>
              <div style={S.brandSub}>GESTION DE SALLE</div>
            </div>

            {/* Quick Start Guide Button (Matches requested brown style) */}
            <div style={{ paddingRight: 20 }}>
              <button className="btn-brown-guide" onClick={() => setShowGuide(true)}>
                <span>🚀</span> Guide de démarrage
              </button>
            </div>
            
            <nav style={S.nav}>
              {getFilteredTabs().map((tItem) => (
                <button
                  key={tItem.key}
                  onClick={() => {
                    setTab(tItem.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`tab-btn ${tab === tItem.key ? "tab-btn-active" : ""}`}
                >
                  {tItem.icon}
                  {tItem.label}
                </button>
              ))}
            </nav>
            
            <div style={S.sideFooter}>
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                <div style={S.soldeLabel}>Solde de Caisse</div>
                <div className="mono" style={{ ...S.soldeVal, color: solde >= 0 ? "#10B981" : "#EF4444", fontSize: 18, marginTop: 4, fontWeight: 800 }}>
                  {fmt(solde)} F
                </div>
              </div>
              
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 12 }}>
                Connecté : <strong style={{ color: "#334155" }}>{user.username}</strong>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "transparent",
                  border: "none",
                  color: "#EF4444",
                  padding: "6px 0",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                Déconnexion
              </button>
            </div>
          </div>

          {/* Main Panel Content */}
          <div className="app-main" style={S.main}>
            {tab === "dashboard" && user.role === "Administrateur" && (
              <Dashboard
                members={members}
                staff={staff}
                revenuTotal={revenuTotal}
                depenses={depenses}
                salairesVerses={salairesVerses}
                ticketsAujourdhui={ticketsAujourdhui}
                solde={solde}
                tickets={tickets}
                tx={tx}
                resetApp={resetApp}
                cardTiers={cardTiers}
                setTab={setTab}
              />
            )}
            
            {tab === "membres" && (
              <Membres
                members={members}
                setMembers={setMembers}
                setTx={setTx}
                triggerToast={triggerToast}
                cardTiers={cardTiers}
                tx={tx}
                currentUser={user}
              />
            )}
            
            {tab === "planning" && (
              <Planning
                schedule={schedule}
                setSchedule={setSchedule}
                staff={staff}
                triggerToast={triggerToast}
                currentUser={user}
              />
            )}
            
            {tab === "boutique" && (
              <Boutique
                setTx={setTx}
                triggerToast={triggerToast}
              />
            )}
            
            {tab === "accueil" && (
              <Accueil
                members={members}
                tickets={tickets}
                setTickets={setTickets}
                setTx={setTx}
                triggerToast={triggerToast}
                currentUser={user}
                cardTiers={cardTiers}
              />
            )}
            
            {tab === "finances" && (
              <Finances
                tx={tx}
                setTx={setTx}
                tickets={tickets}
                staff={staff}
                revenuTotal={revenuTotal}
                depenses={depenses}
                salairesVerses={salairesVerses}
                solde={solde}
                triggerToast={triggerToast}
                currentUser={user}
              />
            )}
            
            {tab === "personnel" && (
              <Personnel
                staff={staff}
                setStaff={setStaff}
                tx={tx}
                setTx={setTx}
                users={users}
                setUsers={setUsers}
                currentUser={user}
                triggerToast={triggerToast}
                cardTiers={cardTiers}
                setCardTiers={setCardTiers}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ==========================================
// INTERACTIVE GUIDE MODAL COMPONENT
// ==========================================
function GuideModal({ onClose }) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "1. Présentation Générale",
      content: (
        <div>
          <p style={S.guideText}>Bienvenue sur <strong>FORGE.GYM</strong>, la plateforme SaaS d'élite pour la gestion de votre salle de sport à Divo.</p>
          <p style={S.guideText}>L'application s'articule autour de 3 rôles métiers majeurs :</p>
          <ul style={S.guideList}>
            <li>🔑 <strong>Administrateur</strong> (accès complet, gestion des salariés et des comptes utilisateurs)</li>
            <li>📝 <strong>Secrétaire</strong> (inscriptions et guichet d'accueil)</li>
            <li>💰 <strong>Comptable</strong> (gestion financière et salaires)</li>
          </ul>
          <p style={S.guideText}>Les sections de ce guide vous expliquent pas à pas les flux clés de l'application.</p>
        </div>
      )
    },
    {
      title: "2. Flux Secrétaire : Membres & Cartes",
      content: (
        <div>
          <p style={S.guideText}><strong>Rôle requis :</strong> Secrétaire ou Administrateur.</p>
          <ol style={S.guideList}>
            <li>Allez sur l'onglet <strong style={{ color: "#6366F1" }}>Membres & Cartes</strong>.</li>
            <li>Remplissez le formulaire d'inscription (Nom, Téléphone, Niveau de Carte).</li>
            <li>Sélectionnez la carte : <strong>Bronze</strong> (15 000 F), <strong>Argent</strong> (40 000 F) ou <strong>Or</strong> (150 000 F).</li>
            <li>Cliquez sur <strong>Enregistrer</strong>.</li>
          </ol>
          <p style={S.guideText}>💡 <em>Magie comptable :</em> Une écriture de recette correspondante au prix de la carte est automatiquement postée dans le grand livre du comptable !</p>
        </div>
      )
    },
    {
      title: "3. Flux Secrétaire : Enregistrement d'Entrée",
      content: (
        <div>
          <p style={S.guideText}><strong>Rôle requis :</strong> Secrétaire ou Administrateur.</p>
          <ol style={S.guideList}>
            <li>Allez sur l'onglet <strong style={{ color: "#6366F1" }}>Accueil / Tickets</strong>.</li>
            <li>Saisissez le nom dans le champ. S'il s'agit d'un membre existant, cochez <strong>\"Client enregistré en tant que membre\"</strong> (tarif : 0 F).</li>
            <li>Si c'est un ticket visiteur d'une séance (ex: 1 000 F), laissez la case décochée et saisissez le montant.</li>
            <li>Cliquez sur <strong>Émettre le Ticket d'Accès</strong>.</li>
            <li>L'imprimante thermique virtuelle s'anime et génère un ticket de caisse professionnel avec QR Code. Cliquez sur <strong>Imprimer</strong> pour l'imprimer réellement.</li>
          </ol>
        </div>
      )
    },
    {
      title: "4. Flux Comptable : Finances & Caisse",
      content: (
        <div>
          <p style={S.guideText}><strong>Rôle requis :</strong> Comptable ou Administrateur.</p>
          <ol style={S.guideList}>
            <li>Allez sur l'onglet <strong style={{ color: "#6366F1" }}>Finances & Ledger</strong>.</li>
            <li>Visualisez le bilan global et l'état des caisses en temps réel.</li>
            <li>Vous pouvez ajouter manuellement des écritures de recettes (+) ou dépenses (-).</li>
            <li>Le tableau répertorie l'historique complet des flux.</li>
          </ol>
        </div>
      )
    },
    {
      title: "5. Flux Administrateur : Personnel & Niveaux",
      content: (
        <div>
          <p style={S.guideText}><strong>Rôle requis :</strong> Administrateur.</p>
          <ol style={S.guideList}>
            <li>Allez sur l'onglet <strong style={{ color: "#6366F1" }}>Personnel</strong>.</li>
            <li><strong>Salariés</strong> : Vous pouvez ajouter, modifier (salaire, poste, tel), ou supprimer les employés.</li>
            <li><strong>Accès de Connexion</strong> : Lors de la création ou de la modification d'un employé, cochez la case *Donner accès* pour lui attribuer directement un identifiant et un mot de passe !</li>
          </ol>
          <p style={S.guideText}>🔒 <em>Sécurité :</em> Le niveau d'accès d'un compte filtre automatiquement les onglets de la sidebar dès sa connexion.</p>
        </div>
      )
    }
  ];

  return (
    <div style={S.guideOverlay}>
      <div style={S.guideCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #E2E8F0", paddingBottom: 12 }}>
          <h2 className="disp" style={{ color: "#0F172A", fontSize: 20 }}>🚀 Guide de démarrage interactif</h2>
          <button style={{ background: "transparent", border: "none", color: "#94A3B8", fontSize: 22 }} onClick={onClose}>&times;</button>
        </div>

        <div style={{ display: "flex", gap: 20, minHeight: 280, flexWrap: "wrap" }}>
          {/* Side Menu */}
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 6, borderRight: "1px solid #E2E8F0", paddingRight: 14 }}>
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                style={{
                  background: activeStep === idx ? "#EEF2F6" : "transparent",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: activeStep === idx ? "#6366F1" : "#475569",
                  fontSize: 13,
                  textAlign: "left",
                  fontWeight: activeStep === idx ? 600 : 500,
                  width: "100%"
                }}
              >
                {s.title}
              </button>
            ))}
          </div>

          {/* Dynamic Content */}
          <div style={{ flex: "2 1 300px", paddingLeft: 6 }}>
            <h3 style={{ color: "#0F172A", fontSize: 16, marginBottom: 14 }}>{steps[activeStep].title}</h3>
            <div>{steps[activeStep].content}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
          <button
            disabled={activeStep === 0}
            onClick={() => setActiveStep(prev => prev - 1)}
            style={{ ...S.btnCancel, padding: "8px 16px", cursor: activeStep === 0 ? "not-allowed" : "pointer", opacity: activeStep === 0 ? 0.4 : 1 }}
          >
            Précédent
          </button>
          {activeStep < steps.length - 1 ? (
            <button
              className="btn-glow"
              style={{ ...S.btnPrimary, background: "#6366F1", color: "#FFF", padding: "8px 20px" }}
              onClick={() => setActiveStep(prev => prev + 1)}
            >
              Suivant
            </button>
          ) : (
            <button
              className="btn-glow"
              style={{ ...S.btnPrimary, background: "#10B981", color: "#FFF", padding: "8px 20px" }}
              onClick={onClose}
            >
              Prêt à forger ! ➔
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// LOGIN SCREEN COMPONENT
// ==========================================
function LoginScreen({ loginForm, setLoginForm, loginError, onSubmit, onCancel, users }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === "Administrateur") {
      setLoginForm({ username: "badrafaly@gmail.com", password: "B@dr@f@ly" });
    } else if (role === "Secretaire") {
      setLoginForm({ username: "secretaire@forgegym.com", password: "password123" });
    } else if (role === "Comptable") {
      setLoginForm({ username: "comptable@forgegym.com", password: "password123" });
    } else {
      setLoginForm({ username: "", password: "" });
    }
  };

  const rolesConfig = [
    {
      key: "Administrateur",
      label: "Je suis Administrateur",
      bg: "rgba(99, 102, 241, 0.15)",
      color: "#6366F1",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    },
    {
      key: "Secretaire",
      label: "Je suis Secrétaire",
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#10B981",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      key: "Comptable",
      label: "Je suis Comptable",
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#F59E0B",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    }
  ];

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "#F8FAFC",
      backgroundImage: "radial-gradient(#E2E8F0 1.5px, transparent 1.5px)",
      backgroundSize: "24px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      position: "relative",
      padding: "40px 24px",
      overflow: "hidden"
    }}>
      {/* Blurred Glows */}
      <div style={{
        position: "absolute",
        width: 400,
        height: 400,
        background: "rgba(99, 102, 241, 0.12)",
        filter: "blur(100px)",
        borderRadius: "50%",
        top: "20%",
        left: "-100px",
        pointerEvents: "none",
        zIndex: 1
      }} />
      <div style={{
        position: "absolute",
        width: 350,
        height: 350,
        background: "rgba(245, 158, 11, 0.1)",
        filter: "blur(90px)",
        borderRadius: "50%",
        top: "-50px",
        left: "40%",
        pointerEvents: "none",
        zIndex: 1
      }} />
      <div style={{
        position: "absolute",
        width: 400,
        height: 400,
        background: "rgba(16, 185, 129, 0.1)",
        filter: "blur(100px)",
        borderRadius: "50%",
        bottom: "10%",
        right: "-100px",
        pointerEvents: "none",
        zIndex: 1
      }} />

      {/* Top Header Logo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 2, marginBottom: 20 }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "#0F172A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 16px rgba(15, 23, 42, 0.15)",
          cursor: "pointer"
        }} onClick={onCancel}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#FFFFFF" }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="disp" style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5 }}>
          FORGE<span style={{ color: "#6366F1" }}>.</span>GYM
        </div>
      </div>

      {selectedRole === null ? (
        /* Profile Chooser Screen */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Bienvenue sur le portail FORGE GYM
            </h2>
            <p style={{ fontSize: 15, color: "#64748B", marginTop: 8 }}>
              Choisis ton profil pour accéder à ton espace de gestion
            </p>
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 900 }}>
            {rolesConfig.map((r, idx) => (
              <div 
                key={r.key}
                onClick={() => handleRoleSelect(r.key)}
                onMouseEnter={() => setHoveredCard(idx)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 24,
                  padding: "48px 32px",
                  width: 260,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: hoveredCard === idx ? "translateY(-8px)" : "translateY(0)",
                  boxShadow: hoveredCard === idx ? "0 20px 40px rgba(15, 23, 42, 0.08)" : "0 4px 12px rgba(0,0,0,0.02)"
                }}
              >
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: r.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 24,
                  transition: "all 0.3s",
                  transform: hoveredCard === idx ? "scale(1.05)" : "scale(1)"
                }}>
                  {r.icon}
                </div>
                <span style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#334155"
                }}>
                  {r.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Credential Form Card */
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 24,
          padding: 36,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.06)",
          zIndex: 2,
          position: "relative"
        }}>
          {/* Back button */}
          <button 
            onClick={() => setSelectedRole(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 24,
              padding: 0
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Retour aux profils
          </button>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{
              background: rolesConfig.find(r => r.key === selectedRole)?.bg,
              color: rolesConfig.find(r => r.key === selectedRole)?.color,
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              padding: "6px 14px",
              borderRadius: 20
            }}>
              Espace {selectedRole}
            </span>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginTop: 12, marginBottom: 0 }}>Connexion</h3>
          </div>

          {loginError && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#EF4444", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {loginError}
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={S.labelStyle}>Identifiant / Nom d'utilisateur</label>
              <input
                style={S.loginInput}
                placeholder="Entrez votre identifiant"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={S.labelStyle}>Mot de passe</label>
              <input
                type="password"
                style={S.loginInput}
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </div>
            
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button type="submit" className="btn-glow" style={{ ...S.btnPrimary, flex: 1, height: 42, background: "#0F172A", color: "#FFFFFF", border: "none" }}>
                Se connecter
              </button>
              <button type="button" onClick={onCancel} style={{ ...S.btnCancel, flex: 1 }}>
                Annuler
              </button>
            </div>
          </form>

          {/* Test Credentials Helper */}
          <div style={{ marginTop: 24, background: "#F8FAFC", borderRadius: 12, padding: "12px 14px", border: "1px solid #F1F5F9", fontSize: 11.5, color: "#64748B", display: "flex", flexDirection: "column", gap: 4 }}>
            <strong style={{ color: "#334155" }}>💡 Identifiants de test (Auto-remplis) :</strong>
            {selectedRole === "Administrateur" && <span>Identifiant : <code>badrafaly@gmail.com</code> / Mdp : <code>B@dr@f@ly</code></span>}
            {selectedRole === "Secretaire" && <span>Identifiant : <code>secretaire@forgegym.com</code> / Mdp : <code>password123</code></span>}
            {selectedRole === "Comptable" && <span>Identifiant : <code>comptable@forgegym.com</code> / Mdp : <code>password123</code></span>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, zIndex: 2, marginTop: 20 }}>
        © 2026 FORGE.GYM. Tous droits réservés. <span style={{ margin: "0 8px" }}>•</span> Mentions légales <span style={{ margin: "0 8px" }}>•</span> Politique de confidentialité
      </div>
    </div>
  );
}

// ==========================================
// PUBLIC LANDING PAGE COMPONENT
// ==========================================
function PublicLanding({ setView, schedule, cardTiers, staff }) {
  const [displayMode, setDisplayMode] = useState("table"); // "table" by default, or "grid"
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "jour", direction: "ascending" });
  const [selectedDay, setSelectedDay] = useState("Tous");

  const DAY_ORDER = { "Lun": 1, "Mar": 2, "Mer": 3, "Jeu": 4, "Ven": 5, "Sam": 6, "Dim": 7 };

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return <span style={{ color: "#94A3B8", marginLeft: 4, fontSize: 10 }}>↕</span>;
    return sortConfig.direction === "ascending" ? 
      <span style={{ color: "#6366F1", marginLeft: 4, fontSize: 10 }}>▲</span> : 
      <span style={{ color: "#6366F1", marginLeft: 4, fontSize: 10 }}>▼</span>;
  };

  const dbCoaches = (staff || []).filter(s => s.role && s.role.toLowerCase().includes("coach"));
  const coachesList = dbCoaches.length > 0 ? dbCoaches : [
    { id: "c1", nom: "Bakary Traoré", role: "Coach Principal & Musculation", desc: "Plus de 10 ans d'expérience dans le coaching en force et haltérophilie." },
    { id: "c2", nom: "Mariam Koné", role: "Coach Cardio & HIIT", desc: "Spécialiste de la perte de poids rapide et du renforcement cardio-vasculaire." }
  ];

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const processedSchedule = [...schedule]
    .filter(c => {
      const matchesDay = selectedDay === "Tous" || c.jour === selectedDay;
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        c.activite.toLowerCase().includes(query) || 
        (c.coach && c.coach.toLowerCase().includes(query)) ||
        c.jour.toLowerCase().includes(query) ||
        c.debut.includes(query) ||
        c.fin.includes(query);
      return matchesDay && matchesSearch;
    })
    .sort((a, b) => {
      let aVal = a[sortConfig.key] || "";
      let bVal = b[sortConfig.key] || "";

      if (sortConfig.key === "jour") {
        aVal = DAY_ORDER[a.jour] || 99;
        bVal = DAY_ORDER[b.jour] || 99;
      }

      if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
      
      // Secondary sort
      if (sortConfig.key !== "debut") {
        return (a.debut || "").localeCompare(b.debut || "");
      }
      return 0;
    });

  return (
    <div style={S.landingWrapper}>
      {/* Navigation Header */}
      <header style={S.landingHeader}>
        <div className="disp" style={{ fontSize: 24, color: "#0F172A", display: "flex", alignItems: "center" }}>
          FORGE<span style={{ color: "#6366F1" }}>.</span>GYM
        </div>
        <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span style={S.landingNavLink} onClick={() => scrollToId("hero")}>Accueil</span>
          <span style={S.landingNavLink} onClick={() => scrollToId("tarifs")}>Tarifs</span>
          <span style={S.landingNavLink} onClick={() => scrollToId("planning")}>Planning</span>
          <span style={S.landingNavLink} onClick={() => scrollToId("coaches")}>Équipe</span>
        </nav>
        <button className="btn-glow" style={S.landingCta} onClick={() => setView("login")}>
          Espace Gestion ➔
        </button>
      </header>

      {/* Hero Section */}
      <section id="hero" style={S.heroSection}>
        <div style={S.heroOverlay} />
        <div style={S.heroContent}>
          <div style={S.heroBadge}>CLUB DE RÉFÉRENCE — DIVO</div>
          <h1 style={S.heroTitle}>
            FORGEZ VOTRE CORPS<br />
            <span style={{ color: "#6366F1" }}>DOMINEZ VOTRE ESPRIT</span>
          </h1>
          <p style={S.heroSubtitle}>
            Entraînez-vous dans le club le plus exclusif de la ville. Équipements haut de gamme de dernière génération, coachs certifiés à l'international et suivi nutritionnel d'élite.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
            <button className="btn-glow" style={S.heroBtnPrimary} onClick={() => scrollToId("tarifs")}>Découvrir nos Tarifs</button>
            <button style={S.heroBtnSecondary} onClick={() => scrollToId("planning")}>Consulter le Planning</button>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section style={{ padding: "80px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, marginBottom: 12, color: "#0F172A" }}>Pourquoi nous choisir ?</h2>
        <p style={{ textAlign: "center", color: "#475569", fontSize: 15, marginBottom: 48 }}>Des services exclusifs conçus pour vous propulser vers vos objectifs.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          <div style={S.featCard}>
            <div style={S.featIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg></div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: "#0F172A" }}>Accès 24h/24 & 7j/7</h3>
            <p style={{ color: "#475569", fontSize: 13.5, lineHeight: 1.5 }}>Entraînez-vous quand vous le souhaitez, de jour comme de nuit, sans aucune restriction.</p>
          </div>
          <div style={S.featCard}>
            <div style={S.featIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: "#0F172A" }}>Équipe de Coaching</h3>
            <p style={{ color: "#475569", fontSize: 13.5, lineHeight: 1.5 }}>Profitez de l'accompagnement personnalisé de nos entraîneur.</p>
          </div>
          <div style={S.featCard}>
            <div style={S.featIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: "#0F172A" }}>Équipement Pro</h3>
            <p style={{ color: "#475569", fontSize: 13.5, lineHeight: 1.5 }}>Des machines de force guidée, haltères libres et espaces cardio de dernière génération.</p>
          </div>
          <div style={S.featCard}>
            <div style={S.featIcon}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: "#0F172A" }}>Espace Récupération</h3>
            <p style={{ color: "#475569", fontSize: 13.5, lineHeight: 1.5 }}>Un sauna, jacuzzi et service de serviettes fraîches après vos séances.</p>
          </div>
        </div>
      </section>

      {/* Pricing / Cards Showcase */}
      <section id="tarifs" style={{ padding: "80px 40px", background: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 32, marginBottom: 12, color: "#0F172A" }}>Nos Offres & Abonnements</h2>
          <p style={{ textAlign: "center", color: "#475569", fontSize: 15, marginBottom: 48 }}>Choisissez la formule qui correspond à votre rythme.</p>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28, justifyContent: "center" }}>
            {cardTiers.map(c => (
              <div key={c.key} style={S.pricingCard} className="card-glow">
                <div style={S.cardGlassOverlay} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <span className="disp" style={{ color: c.color, fontSize: 22 }}>{c.key}</span>
                  <div style={S.emvChip} />
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", minHeight: 60, lineHeight: 1.5 }}>{c.description}</p>
                <div style={{ margin: "24px 0", borderBottom: "1px solid #E2E8F0" }} />
                <div style={{ marginBottom: 24 }}>
                  <span className="mono" style={{ fontSize: 36, fontWeight: 800, color: "#0F172A" }}>{fmt(c.price)} F</span>
                  <span style={{ fontSize: 13, color: "#64748B", marginLeft: 6 }}>
                    {c.key.includes("Ticket") ? "par entrée" : c.key.includes("carte") ? " / 10 séances" : c.duration === 1 ? "/ mois" : c.duration === 12 ? "/ an" : `/ ${c.duration} mois`}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30, fontSize: 13, color: "#334155" }}>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> {c.key.includes("Ticket") ? "Accès libre salle (1 jour)" : "Accès libre salle de sport"}</div>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> {c.key.includes("carte") ? "Valable pendant 3 mois" : "Vestiaire individuel sécurisé"}</div>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> {c.key.includes("Ticket") ? "Sans aucun engagement" : c.key.includes("carte") ? "Consommez à votre rythme" : c.duration >= 3 ? "Cours collectifs illimités" : "Cours collectifs sur réservation"}</div>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> {c.key.includes("Ticket") || c.key.includes("carte") ? "Accès musculation & cardio" : c.duration >= 12 ? "Espace détente VIP & serviettes" : "Serviette non incluse"}</div>
                </div>
                <button
                  style={{
                    background: "transparent",
                    border: `1px solid ${c.color}`,
                    color: c.color,
                    padding: "12px 0",
                    borderRadius: 10,
                    width: "100%",
                    fontSize: 14,
                    fontWeight: 700
                  }}
                  className="btn-glow"
                  onClick={() => setView("login")}
                >
                  Choisir cette carte ➔
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Public Schedule Section */}
      <section id="planning" style={{ padding: "80px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, marginBottom: 12, color: "#0F172A" }}>Planning Général des Cours</h2>
        <p style={{ textAlign: "center", color: "#475569", fontSize: 15, marginBottom: 48 }}>Planifiez votre semaine en fonction de notre programme de cours.</p>
        
        {/* Data Grid Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {/* Search bar */}
          <div style={{ flex: "1 1 300px", maxWidth: 400 }}>
            <input 
              style={{ ...S.input, margin: 0, paddingLeft: 12 }} 
              placeholder="🔍 Rechercher un cours, un coach, un jour..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Toggle buttons */}
          <div style={{ display: "flex", background: "#F1F5F9", padding: 4, borderRadius: 10, border: "1px solid #E2E8F0" }}>
            <button
              onClick={() => setDisplayMode("table")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: 8,
                background: displayMode === "table" ? "#FFFFFF" : "transparent",
                color: displayMode === "table" ? "#4F46E5" : "#64748B",
                fontWeight: displayMode === "table" ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: displayMode === "table" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s"
              }}
            >
              📊 Tableau (Data Grid)
            </button>
            <button
              onClick={() => setDisplayMode("grid")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: 8,
                background: displayMode === "grid" ? "#FFFFFF" : "transparent",
                color: displayMode === "grid" ? "#4F46E5" : "#64748B",
                fontWeight: displayMode === "grid" ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: displayMode === "grid" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s"
              }}
            >
              📅 Calendrier
            </button>
          </div>
        </div>

        {/* Day selection tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", justifyContent: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: 16 }}>
          {["Tous", ...JOURS].map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              style={{
                ...S.btnFilter,
                padding: "8px 16px",
                fontSize: 13,
                borderRadius: 8,
                ...(selectedDay === d ? S.btnFilterActive : {})
              }}
            >
              {d === "Tous" ? "Toute la semaine" : d}
            </button>
          ))}
        </div>

        {displayMode === "table" ? (
          /* Data Grid Table view */
          processedSchedule.length === 0 ? (
            <div style={{ color: "#64748B", padding: "40px 20px", textAlign: "center", border: "1px dashed #CBD5E1", borderRadius: 12, fontSize: 14, background: "#F8FAFC" }}>
              Aucun cours correspondant à votre recherche.
            </div>
          ) : (
            <div style={{ overflowX: "auto", background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: "8px 16px", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("activite")}>
                      Activité / Cours {renderSortIndicator("activite")}
                    </th>
                    <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("coach")}>
                      Coach {renderSortIndicator("coach")}
                    </th>
                    <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("jour")}>
                      Jour {renderSortIndicator("jour")}
                    </th>
                    <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("debut")}>
                      Horaires {renderSortIndicator("debut")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedSchedule.map(c => (
                    <tr key={c.id} style={S.tr}>
                      <td style={{ ...S.td, fontWeight: 700, color: "#0F172A" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            display: "inline-block",
                            background: c.activite.toLowerCase().includes("muscu") || c.activite.toLowerCase().includes("streng") ? "#10B981" : 
                                       c.activite.toLowerCase().includes("cardio") || c.activite.toLowerCase().includes("hiit") ? "#EF4444" : 
                                       c.activite.toLowerCase().includes("yoga") || c.activite.toLowerCase().includes("stret") ? "#8B5CF6" : "#3B82F6"
                          }} />
                          {c.activite}
                        </div>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          <span style={{ fontWeight: 500 }}>{c.coach || "Aucun coach"}</span>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          ...S.tag,
                          background: c.jour === "Lun" ? "#EFF6FF" : 
                                      c.jour === "Mar" ? "#ECFDF5" : 
                                      c.jour === "Mer" ? "#FDF2F8" : 
                                      c.jour === "Jeu" ? "#FEF3C7" : 
                                      c.jour === "Ven" ? "#F5F3FF" : 
                                      c.jour === "Sam" ? "#FFF1F2" : "#F8FAFC",
                          color: c.jour === "Lun" ? "#1E40AF" : 
                                 c.jour === "Mar" ? "#065F46" : 
                                 c.jour === "Mer" ? "#9D174D" : 
                                 c.jour === "Jeu" ? "#92400E" : 
                                 c.jour === "Ven" ? "#5B21B6" : 
                                 c.jour === "Sam" ? "#9F1239" : "#64748B"
                        }}>
                          {c.jour === "Lun" ? "Lundi" : 
                           c.jour === "Mar" ? "Mardi" : 
                           c.jour === "Mer" ? "Mercredi" : 
                           c.jour === "Jeu" ? "Jeudi" : 
                           c.jour === "Ven" ? "Vendredi" : 
                           c.jour === "Sam" ? "Samedi" : "Dimanche"}
                        </span>
                      </td>
                      <td className="mono" style={{ ...S.td, fontWeight: 600, color: "#475569" }}>
                        {c.debut} - {c.fin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Calendar Grid view */
          selectedDay === "Tous" ? (
            <div style={S.weeklyGrid}>
              {JOURS.map(j => {
                const dayCourses = processedSchedule.filter(s => s.jour === j);
                return (
                  <div key={j} style={S.weeklyCol}>
                    <div style={S.weeklyColHeader}>{j}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {dayCourses.length === 0 ? (
                        <div style={{ color: "#94A3B8", fontSize: 11, textAlign: "center", fontStyle: "italic", padding: "12px 0" }}>Aucun cours</div>
                      ) : (
                        dayCourses.map(c => {
                          let actBg = "linear-gradient(135deg, #3B82F6, #1D4ED8)";
                          const act = c.activite ? c.activite.toLowerCase() : "";
                          if (act.includes("muscu") || act.includes("streng")) {
                            actBg = "linear-gradient(135deg, #10B981, #059669)";
                          } else if (act.includes("cardio") || act.includes("hiit")) {
                            actBg = "linear-gradient(135deg, #EF4444, #B91C1C)";
                          } else if (act.includes("yoga") || act.includes("stret")) {
                            actBg = "linear-gradient(135deg, #8B5CF6, #6D28D9)";
                          }

                          return (
                            <div key={c.id} style={{ ...S.courseCard, background: actBg, padding: "8px 10px" }}>
                              <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#FFF" }}>
                                {c.debut} - {c.fin}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, margin: "2px 0 4px 0", color: "#FFF", lineHeight: 1.25 }}>
                                {c.activite}
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", gap: 5 }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                {c.coach || "Aucun coach"}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 650, margin: "0 auto", padding: "10px 0" }}>
              {(() => {
                const dayCourses = processedSchedule.filter(s => s.jour === selectedDay);
                if (dayCourses.length === 0) {
                  return (
                    <div style={{ color: "#64748B", padding: "40px 20px", textAlign: "center", border: "1px dashed #CBD5E1", borderRadius: 12, fontSize: 14, background: "#F8FAFC" }}>
                      Aucun cours de planifié pour le <strong>{selectedDay === "Lun" ? "Lundi" : selectedDay === "Mar" ? "Mardi" : selectedDay === "Mer" ? "Mercredi" : selectedDay === "Jeu" ? "Jeudi" : selectedDay === "Ven" ? "Vendredi" : selectedDay === "Sam" ? "Samedi" : "Dimanche"}</strong>.
                    </div>
                  );
                }
                return dayCourses.map(c => {
                  const isMuscu = c.activite.toLowerCase().includes("muscu") || c.activite.toLowerCase().includes("streng");
                  const isCardio = c.activite.toLowerCase().includes("cardio") || c.activite.toLowerCase().includes("hiit");
                  const borderCol = isMuscu ? "#10B981" : isCardio ? "#EF4444" : "#8B5CF6";
                  
                  return (
                    <div 
                      key={c.id} 
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 12,
                        padding: "16px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
                        border: "1px solid #E2E8F0",
                        borderLeft: `5px solid ${borderCol}`
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                        <div className="mono" style={{ 
                          background: "#F1F5F9", 
                          padding: "8px 12px", 
                          borderRadius: 8, 
                          fontWeight: 700, 
                          color: "#334155", 
                          fontSize: 13.5
                        }}>
                          {c.debut} - {c.fin}
                        </div>
                        <div>
                          <h4 style={{ color: "#0F172A", fontSize: 16, fontWeight: 700, margin: 0 }}>{c.activite}</h4>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, color: "#64748B", fontSize: 12.5 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            <span>Coach : <strong>{c.coach || "Aucun coach"}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )
        )}
      </section>

      {/* Public Coaches Section */}
      <section id="coaches" style={{ padding: "80px 40px", background: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, marginBottom: 12, color: "#0F172A" }}>Nos Coachs d'Élite</h2>
          <p style={{ color: "#475569", fontSize: 15, marginBottom: 48 }}>Nos entraîneurs sont là pour vous aider à repousser vos limites.</p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {coachesList.map((s, index) => {
              const colors = ["#6366F1", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B"];
              const bg = colors[index % colors.length];
              return (
                <div key={s.id || index} style={S.coachProfileCard}>
                  <div style={{ ...S.coachAvatarPlaceholder, background: bg }}>
                    {getInitials(s.nom)}
                  </div>
                  <h3 style={{ color: "#0F172A", fontSize: 18, margin: "12px 0 4px 0" }}>{s.nom}</h3>
                  <p style={{ color: "#6366F1", fontSize: 13, fontWeight: 600 }}>{s.role}</p>
                  <p style={{ color: "#64748B", fontSize: 12, marginTop: 8 }}>
                    {s.desc || (s.tel ? `Contact : ${s.tel}` : "Entraîneur certifié FORGE.GYM dédié à votre progression.")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer style={S.landingFooter}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
          <div>
            <div className="disp" style={{ fontSize: 20, color: "#0F172A" }}>FORGE.GYM</div>
            <p style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>Le temple de la force et de la santé</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#64748B" }}>
            <div>Divo, Côte d'Ivoire</div>
            <div style={{ marginTop: 4 }}>Contact: info@forgegym.ci | Tel: +225 07 00 00 00 00</div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 24, paddingTop: 18, textAlign: "center", fontSize: 11, color: "#94A3B8" }}>
          &copy; {new Date().getFullYear()} FORGE.GYM. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}

// ==========================================
// CARD PANEL WRAPPER
// ==========================================
function CardPanel({ title, children, action }) {
  return (
    <div style={S.cardPanel}>
      <div style={S.cardHead}>
        <h3 className="disp" style={S.cardTitle}>{title}</h3>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ==========================================
// STATS KPI CARD
// ==========================================
function StatKpi({ label, value, accent, subtext, icon }) {
  return (
    <div style={{ ...S.statCard, borderBottom: `3px solid ${accent || "transparent"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={S.statLabel}>{label}</span>
        <span style={{ color: accent || "#64748B", opacity: 0.85 }}>{icon}</span>
      </div>
      <div className="mono" style={S.statVal}>{value}</div>
      {subtext && <div style={S.statSub}>{subtext}</div>}
    </div>
  );
}

// ==========================================
// DASHBOARD VIEW
// ==========================================
function Dashboard({ members, staff, revenuTotal, depenses, salairesVerses, ticketsAujourdhui, solde, tickets, tx, resetApp, cardTiers, setTab }) {
  const activeCoaches = staff.filter(s => s.role === "Coach").length;
  const [periodType, setPeriodType] = useState("jour"); // "jour" or "semaine"
  const [revenuePeriod, setRevenuePeriod] = useState("today"); // "today" | "week" | "month" | "year" | "all"
  const [searchTerm, setSearchTerm] = useState("");

  const isInPeriod = (dateStr) => {
    if (!dateStr) return false;
    const now = new Date();
    const d = new Date(dateStr);
    const t = today();
    switch (revenuePeriod) {
      case "today":
        return dateStr === t;
      case "week": {
        const day = now.getDay() || 7;
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        if (day !== 1) {
          startOfWeek.setDate(now.getDate() - (day - 1));
        }
        const comp = new Date(dateStr);
        comp.setHours(0,0,0,0);
        return comp >= startOfWeek;
      }
      case "month": {
        const [y, m] = dateStr.split("-");
        return Number(y) === now.getFullYear() && Number(m) === (now.getMonth() + 1);
      }
      case "year": {
        const [y] = dateStr.split("-");
        return Number(y) === now.getFullYear();
      }
      case "all":
      default:
        return true;
    }
  };

  const filteredTickets = tickets.filter(t => isInPeriod(t.date));
  const recettesTicketsPeriod = filteredTickets.reduce((s, t) => s + Number(t.montant || 0), 0);
  const recettesTxPeriod = tx.filter(t => t.type === "recette" && isInPeriod(t.date)).reduce((s, t) => s + Number(t.montant || 0), 0);
  const periodRevenuTotal = recettesTicketsPeriod + recettesTxPeriod;

  const depensesPeriod = tx.filter(t => t.type === "depense" && isInPeriod(t.date)).reduce((s, t) => s + Number(t.montant || 0), 0);
  const salairesPeriod = tx.filter(t => t.type === "salaire" && isInPeriod(t.date)).reduce((s, t) => s + Number(t.montant || 0), 0);
  const periodTotalOutflow = depensesPeriod + salairesPeriod;

  // Custom SVG Bar Chart Calculation (updates dynamically with the selected period)
  const maxValue = Math.max(periodRevenuTotal, periodTotalOutflow, 100000);
  const revHeight = (periodRevenuTotal / maxValue) * 130;
  const expHeight = (periodTotalOutflow / maxValue) * 130;

  // --- CUMULATIVE REVENUES BY PERIOD CALCULATIONS ---
  // Combine all income sources: visitor tickets and miscellaneous revenues (like subscriptions)
  const getAggregatedRevenues = () => {
    const allIncomes = [
      ...tickets.map(t => ({ date: t.date, montant: Number(t.montant) })),
      ...tx.filter(t => t.type === "recette").map(t => ({ date: t.date, montant: Number(t.montant) }))
    ];

    if (periodType === "jour") {
      // Group by YYYY-MM-DD
      const groups = {};
      allIncomes.forEach(i => {
        const d = i.date || today();
        groups[d] = (groups[d] || 0) + i.montant;
      });
      return Object.keys(groups).map(k => ({
        label: k,
        total: groups[k],
        count: allIncomes.filter(i => i.date === k).length
      })).sort((a, b) => b.label.localeCompare(a.label));
    } else {
      // Group by Week Range
      const groups = {};
      allIncomes.forEach(i => {
        const d = i.date || today();
        const weekLabel = getWeekRange(d);
        groups[weekLabel] = (groups[weekLabel] || 0) + i.montant;
      });
      return Object.keys(groups).map(k => ({
        label: k,
        total: groups[k],
        count: allIncomes.filter(i => getWeekRange(i.date) === k).length
      })).sort((a, b) => b.label.localeCompare(a.label));
    }
  };

  const periodData = getAggregatedRevenues();
  // Find highest total to calculate relative progress bar
  const maxPeriodTotal = periodData.length > 0 ? Math.max(...periodData.map(p => p.total), 1) : 1;

  // Search filtering on entries list
  const filteredTicketsList = tickets.filter(t => 
    t.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.heure.includes(searchTerm) ||
    (t.date && t.date.includes(searchTerm)) ||
    (t.montant > 0 ? "visiteur" : "membre").includes(searchTerm.toLowerCase())
  );

  const displayTickets = searchTerm 
    ? filteredTicketsList.slice(-15).reverse() 
    : tickets.slice(-10).reverse();

  return (
    <div>
      {/* Top Header Row with Search & Button */}
      <div style={S.headerRow} className="no-print">
        <div>
          <h1 style={S.pageTitle}>Tableau de bord</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Vue d'ensemble sur l'établissement (Accès Administrateur)</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search bar */}
          <div style={{ position: "relative", width: 220 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #CBD5E1",
                borderRadius: 10,
                padding: "10px 12px 10px 34px",
                fontSize: 13.5,
                background: "#FFFFFF",
                color: "#0F172A",
              }}
            />
          </div>
          {/* Action button */}
          <button
            onClick={() => setTab("accueil")}
            className="btn-glow"
            style={{
              ...S.btnPrimary,
              background: "#6366F1",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 13.5
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Enregistrer une entrée
          </button>
        </div>
      </div>
      
      {/* Grouped KPI Card Panels Grid (Matches look of screenshot) */}
      <div style={S.grid2} className="no-print">
        {/* Panel 1: Comptabilité & Caisse */}
        <div style={{ ...S.cardPanel, marginBottom: 0 }}>
          <div style={{ ...S.cardHead, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="disp" style={{ ...S.cardTitle, margin: 0 }}>Comptabilité & Caisse</h3>
            <select 
              className="form-control" 
              style={{ width: "auto", marginBottom: 0, padding: "4px 8px", fontSize: "13px", borderRadius: 8, border: "1px solid #CBD5E1" }}
              value={revenuePeriod}
              onChange={(e) => setRevenuePeriod(e.target.value)}
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois-ci</option>
              <option value="year">Cette année</option>
              <option value="all">Tout le temps</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            {/* Green Card: Recettes */}
            <div style={{ padding: "20px", backgroundColor: "#DEF7EC", borderRadius: "12px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: "22px", fontWeight: "800", color: "#03543F" }}>{fmt(periodRevenuTotal)} F</div>
              <div style={{ color: "#046C4E", fontSize: 12, marginTop: 6, fontWeight: 500 }}>
                {revenuePeriod === 'today' ? 'Recette du jour' :
                 revenuePeriod === 'week' ? 'Recette de la semaine' :
                 revenuePeriod === 'month' ? 'Recette du mois' :
                 revenuePeriod === 'year' ? 'Recette de l\'année' : 'Total encaissé'}
              </div>
            </div>
            {/* Red Card: Total Dépenses */}
            <div style={{ padding: "20px", backgroundColor: "#FDE8E8", borderRadius: "12px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: "22px", fontWeight: "800", color: "#9B1C1C" }}>{fmt(periodTotalOutflow)} F</div>
              <div style={{ color: "#9B1C1C", fontSize: 12, marginTop: 6, fontWeight: 500 }}>Total Impayés / Charges</div>
            </div>
          </div>
        </div>

        {/* Panel 2: Statistiques */}
        <div style={{ ...S.cardPanel, marginBottom: 0 }}>
          <div style={S.cardHead}>
            <h3 className="disp" style={{ ...S.cardTitle, margin: 0 }}>Statistiques</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            {/* Blue Card: Membres Actifs */}
            <div style={{ padding: "20px", backgroundColor: "#EBF5FF", borderRadius: "12px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: "24px", fontWeight: "800", color: "#1E40AF" }}>{members.filter(m => getMemberStatus(m).label === "Actif").length}</div>
              <div style={{ color: "#1E40AF", fontSize: 12, marginTop: 6, fontWeight: 500 }}>Membres Actifs</div>
            </div>
            {/* Yellow Card: Passages */}
            <div style={{ padding: "20px", backgroundColor: "#FEF9C3", borderRadius: "12px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: "24px", fontWeight: "800", color: "#854D0E" }}>{tickets.filter(t => isInPeriod(t.date)).length}</div>
              <div style={{ color: "#854D0E", fontSize: 12, marginTop: 6, fontWeight: 500 }}>
                {revenuePeriod === 'today' ? 'Passages du jour' :
                 revenuePeriod === 'week' ? 'Passages de la semaine' :
                 revenuePeriod === 'month' ? 'Passages du mois' :
                 revenuePeriod === 'year' ? 'Passages de l\'année' : 'Total Passages'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Cards Grid */}
      <div style={{ ...S.grid2, marginTop: 24 }} className="no-print">
        {/* SVG Interactive Chart Card */}
        <CardPanel title="Bilan Financier de la Période">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0" }}>
            <svg viewBox="0 0 400 200" style={{ width: "100%", maxHeight: 180, background: "transparent" }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" />
                  <stop offset="100%" stopColor="#B91C1C" />
                </linearGradient>
              </defs>
              {/* Dashed grids */}
              <line x1="40" y1="20" x2="360" y2="20" stroke="rgba(0,0,0,0.05)" strokeDasharray="3" />
              <line x1="40" y1="85" x2="360" y2="85" stroke="rgba(0,0,0,0.05)" strokeDasharray="3" />
              <line x1="40" y1="150" x2="360" y2="150" stroke="rgba(0,0,0,0.1)" />
              
              {/* Revenue bar */}
              <rect x="90" y={150 - revHeight} width="55" height={revHeight} rx="6" fill="url(#revGrad)" />
              <text x="117.5" y={140 - revHeight} textAnchor="middle" fill="#059669" className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                {fmt(periodRevenuTotal)} F
              </text>
              <text x="117.5" y="172" textAnchor="middle" fill="#475569" style={{ fontSize: 12, fontWeight: 500 }}>Revenus</text>
              
              {/* Expense bar */}
              <rect x="250" y={150 - expHeight} width="55" height={expHeight} rx="6" fill="url(#expGrad)" />
              <text x="277.5" y={140 - expHeight} textAnchor="middle" fill="#B91C1C" className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                {fmt(periodTotalOutflow)} F
              </text>
              <text x="277.5" y="172" textAnchor="middle" fill="#475569" style={{ fontSize: 12, fontWeight: 500 }}>Dépenses</text>
            </svg>
            <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#64748B", marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center" }}><span style={{ display: "inline-block", width: 8, height: 8, background: "#10B981", borderRadius: "50%", marginRight: 6 }} />Revenus (Inscriptions + Tickets)</div>
              <div style={{ display: "flex", alignItems: "center" }}><span style={{ display: "inline-block", width: 8, height: 8, background: "#EF4444", borderRadius: "50%", marginRight: 6 }} />Dépenses (Charges + Salaires)</div>
            </div>
          </div>
        </CardPanel>

        {/* Loyalty cards tier distribution */}
        <CardPanel title="Répartition des Cartes">
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "10px 0" }}>
            {cardTiers.map(c => {
              const count = members.filter(m => m.carte === c.key).length;
              const percent = members.length > 0 ? (count / members.length) * 100 : 0;
              return (
                <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>{c.key}</span>
                    </div>
                    <span className="mono" style={{ color: c.color, fontWeight: 700 }}>{count} ({Math.round(percent)}%)</span>
                  </div>
                  <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                    <div style={{ width: `${percent}%`, height: "100%", background: c.color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardPanel>
      </div>

      {/* --- CUMULATIVE REVENUES ANALYTICS CARD PANEL --- */}
      <CardPanel
        title="Analyse de Caisse : Recettes par Période"
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setPeriodType("jour")}
              style={{
                ...S.btnFilter,
                padding: "5px 12px",
                fontSize: 12,
                ...(periodType === "jour" ? S.btnFilterActive : {})
              }}
            >
              📅 Par Jour
            </button>
            <button
              onClick={() => setPeriodType("semaine")}
              style={{
                ...S.btnFilter,
                padding: "5px 12px",
                fontSize: 12,
                ...(periodType === "semaine" ? S.btnFilterActive : {})
              }}
            >
              🗓️ Par Semaine
            </button>
          </div>
        }
      >
        {periodData.length === 0 ? (
          <div style={S.empty}>Aucune recette enregistrée dans la base.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
            {periodData.map((p, idx) => {
              const relPercent = (p.total / maxPeriodTotal) * 100;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 13.5 }}>{p.label}</div>
                      <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{p.count} transaction{p.count > 1 ? "s" : ""} comptabilisée{p.count > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="mono" style={{ color: "#059669", fontWeight: 700, fontSize: 14 }}>+{fmt(p.total)} F</span>
                    </div>
                  </div>
                  {/* Dynamic horizontal graphic representation of relative performance */}
                  <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                    <div style={{ width: `${relPercent}%`, height: "100%", background: "linear-gradient(90deg, #10B981, #6366F1)", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardPanel>

      {/* Bottom list section for recent entries */}
      <div style={{ marginTop: 24 }}>
        <CardPanel title={searchTerm ? "Résultats de la recherche" : "Dernières Entrées enregistrées"}>
          {displayTickets.length === 0 ? (
            <div style={S.empty}>Aucun passage trouvé.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {displayTickets.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <span className="mono" style={{ color: "#64748B", background: "#F1F5F9", padding: "4px 8px", borderRadius: 6, fontSize: 12, border: "1px solid #E2E8F0" }}>{t.heure}</span>
                    <div>
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>{t.nom}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 10 }}>Date : {t.date}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ ...S.tag, background: t.montant > 0 ? "#E0F2FE" : "#F5F3FF", color: t.montant > 0 ? "#0284C7" : "#6366F1" }}>
                      {t.montant > 0 ? "Visiteur" : "Membre"}
                    </span>
                    <span className="mono" style={{ fontWeight: 700, color: "#0F172A" }}>{fmt(t.montant)} F</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardPanel>
      </div>
    </div>
  );
}

// ==========================================
// MEMBRES & LOYALTY CARDS VIEW
// ==========================================
function Membres({ members, setMembers, setTx, triggerToast, cardTiers, tx, currentUser }) {
  const isAdmin = currentUser && currentUser.role === "Administrateur";
  const [activeReceipt, setActiveReceipt] = useState(null);
  
  const printMemberReceipt = (m) => {
    setActiveReceipt(m);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const [form, setForm] = useState({ 
    nom: "", 
    tel: "", 
    carte: cardTiers[0]?.key || "Bronze (Mensuel)", 
    montant: cardTiers[0]?.price.toString() || "10000",
    expiration: "" 
  });
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("Tous");

  useEffect(() => {
    if (cardTiers && cardTiers.length > 0) {
      const activeTier = cardTiers.find(c => c.key === form.carte) || cardTiers[0];
      setForm(prev => ({
        ...prev,
        carte: activeTier.key,
        montant: prev.montant || activeTier.price.toString()
      }));
    }
  }, [cardTiers]);

  const add = async () => {
    if (!form.nom.trim()) {
      triggerToast("Le nom du membre est obligatoire");
      return;
    }
    
    const selectedTier = cardTiers.find(c => c.key === form.carte) || cardTiers[0];
    const pricePaid = form.montant ? Number(form.montant) : selectedTier.price;
    
    // Auto-calculate expiration date if blank
    let expDate = form.expiration;
    if (!expDate) {
      const exp = new Date();
      exp.setMonth(exp.getMonth() + selectedTier.duration);
      expDate = exp.toISOString().slice(0, 10);
    }
    
    const newId = uid();
    const newMember = {
      id: newId,
      nom: form.nom,
      tel: form.tel,
      carte: form.carte,
      inscription: today(),
      expiration: expDate,
    };

    const { error: memberError } = await supabase.from("members").insert([newMember]);
    if (memberError) {
      triggerToast("Erreur lors de l'inscription sur Supabase");
      console.error(memberError);
      return;
    }

    setMembers([...members, newMember]);
    
    // Auto post subscription transaction to accountant ledger
    const newTx = {
      id: uid(),
      type: "recette",
      description: `Adhésion ${form.carte} - ${form.nom}`,
      montant: pricePaid,
      date: today()
    };

    const { error: txError } = await supabase.from("tx").insert([newTx]);
    if (txError) {
      console.error("Failed to post tx to Supabase:", txError);
    } else {
      setTx(prev => [...prev, newTx]);
    }

    triggerToast(`Membre inscrit avec succès ! Carte ${form.carte} générée.`);
    setForm({ 
      nom: "", 
      tel: "", 
      carte: cardTiers[0]?.key || "Bronze (Mensuel)", 
      montant: cardTiers[0]?.price.toString() || "10000",
      expiration: "" 
    });
    printMemberReceipt(newMember);
  };

  const remove = async (id) => {
    if (!isAdmin) {
      triggerToast("Action non autorisée. Seul l'Administrateur peut supprimer un membre.");
      return;
    }
    if (confirm("Voulez-vous vraiment retirer ce membre ?")) {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) {
        triggerToast("Erreur lors de la suppression sur Supabase");
        console.error(error);
        return;
      }
      setMembers(members.filter(m => m.id !== id));
      triggerToast("Membre retiré");
    }
  };

  const filteredMembers = members.filter(m => {
    const matchSearch = m.nom.toLowerCase().includes(search.toLowerCase()) || m.tel.includes(search);
    const matchFilter = filterTier === "Tous" || m.carte === filterTier;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <h1 style={S.pageTitle}>Gestion des Membres</h1>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }}>Enregistrez les membres, émettez des abonnements (mensuels, annuels) ou des packs de séances à la carte.</p>
      
      <CardPanel title="Nouvelle Inscription">
        <div style={S.formRow}>
          <div style={{ flex: "1 1 180px" }}>
            <label style={S.labelStyle}>Nom Complet</label>
            <input style={S.input} placeholder="Ex: Jean Yao" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={S.labelStyle}>Téléphone</label>
            <input style={S.input} placeholder="Ex: 07 44 55 66 77" value={form.tel} onChange={e => setForm({ ...form, tel: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={S.labelStyle}>Niveau de Carte</label>
            <select 
              style={S.input} 
              value={form.carte} 
              onChange={e => {
                const tier = cardTiers.find(c => c.key === e.target.value);
                setForm({ 
                  ...form, 
                  carte: e.target.value, 
                  montant: tier ? tier.price.toString() : "" 
                });
              }}
            >
              {cardTiers.map(c => <option key={c.key} value={c.key}>{c.key} ({fmt(c.price)} F)</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 110px" }}>
            <label style={S.labelStyle}>Montant payé (F)</label>
            <input style={S.input} type="number" placeholder="Tarif appliqué" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={S.labelStyle}>Date d'Expiration (Auto si vide)</label>
            <input style={S.input} type="date" value={form.expiration} onChange={e => setForm({ ...form, expiration: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn-glow" style={{ ...S.btnPrimary, height: 38 }} onClick={add}>Enregistrer</button>
          </div>
        </div>
      </CardPanel>

      {/* Filter and Search Section */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...S.input, flex: 1, minWidth: 220 }}
          placeholder="Rechercher par nom ou téléphone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Tous", ...cardTiers.map(c => c.key)].map(tier => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              style={{
                ...S.btnFilter,
                ...(filterTier === tier ? S.btnFilterActive : {})
              }}
            >
              {tier.split(" (")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Members Directory Grid */}
      <div style={S.memberGrid}>
        {filteredMembers.length === 0 && <div style={{ color: "#64748B", padding: 30, textAlign: "center", width: "100%", border: "1px dashed #CBD5E1", borderRadius: 12 }}>Aucun membre répertorié.</div>}
        {filteredMembers.map(m => {
          const tier = cardTiers.find(c => c.key === m.carte) || cardTiers[0];
          const status = getMemberStatus(m);
          
          return (
            <div key={m.id} style={S.memberOuter}>
              {/* Virtual Glowing Loyalty Card */}
              <div style={{ ...S.loyaltyCard, background: tier.bg, borderColor: tier.color }} className="card-glow">
                {/* Diagonal Glass Reflection */}
                <div style={S.cardGlassOverlay} />
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 2 }}>
                  <div>
                    <div className="disp" style={{ fontSize: 19, color: "#0F172A", letterSpacing: 0.5 }}>FORGE.GYM</div>
                    <div style={{ fontSize: 9, color: "rgba(15,23,42,0.6)", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 }}>LOYALTY MEMBER</div>
                  </div>
                  {/* EMV Gold Chip Mockup */}
                  <div style={S.emvChip} />
                </div>
                
                <div style={{ position: "relative", zIndex: 2 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{m.nom}</div>
                  <div style={{ fontSize: 11, color: "rgba(15,23,42,0.8)", marginTop: 2 }}>{m.tel || "SANS CONTACT"}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", zIndex: 2 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "rgba(15,23,42,0.55)", letterSpacing: 0.5 }}>EXPIRATION</div>
                    <div className="mono" style={{ fontSize: 12, color: "#0F172A", fontWeight: 700 }}>{m.expiration}</div>
                  </div>
                  {/* Simulated barcode */}
                  <div style={S.cardBarcode}>
                    {[1, 2.5, 1, 3, 1.5, 2, 4, 1, 2, 1, 3].map((w, idx) => (
                      <div key={idx} style={{ width: w, background: "#0F172A", opacity: 0.75 }} />
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Metadata and Controls Card */}
              <div style={S.memberMeta}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ ...S.tag, background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>Inscrit: {m.inscription}</span>
                </div>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: tier.color, fontSize: 13.5 }}>Niveau {m.carte.split(" (")[0]}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button 
                      className="btn-secondary no-print" 
                      style={{ padding: "5px 10px", fontSize: 12, background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#334155" }} 
                      onClick={() => printMemberReceipt(m)}
                    >
                      🖨️ Reçu
                    </button>
                    {isAdmin && (
                      <button className="btn-secondary no-print" style={{ ...S.btnDangerGhost, padding: "5px 10px", fontSize: 12 }} onClick={() => remove(m.id)}>
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden print template for subscription receipt */}
      {activeReceipt && (
        <div className="print-only" style={{ display: "none" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: "bold" }}>FORGE.GYM</div>
            <div style={{ fontSize: 10 }}>Divo, Côte d'Ivoire</div>
            <div style={{ fontSize: 10 }}>Tel: +225 07 00 00 00 00</div>
            <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold" }}>REÇU D'INSCRIPTION</div>
          </div>
          
          <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            <div>RÉF : R-{activeReceipt.id.substring(0, 8).toUpperCase()}</div>
            <div>DATE INSCRIPTION : {activeReceipt.inscription}</div>
            <div>DATE EXPIRATION : {activeReceipt.expiration}</div>
            <div>ABONNEMENT : {activeReceipt.carte}</div>
            <div style={{ borderBottom: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
              <span>MEMBRE :</span>
              <span>{activeReceipt.nom}</span>
            </div>
            {activeReceipt.tel && (
              <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>TEL :</span>
                <span>{activeReceipt.tel}</span>
              </div>
            )}
            <div style={{ borderBottom: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
              <span>MONTANT PAYÉ :</span>
              <span>{(() => {
                const memberTx = (tx || []).find(t => t.type === "recette" && t.description.includes(activeReceipt.nom));
                if (memberTx) return fmt(memberTx.montant);
                const tier = cardTiers.find(c => c.key === activeReceipt.carte);
                return fmt(tier ? tier.price : 0);
              })()} F CFA</span>
            </div>
          </div>
          <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }} />
          <div style={{ textAlign: "center", fontSize: 10 }}>
            MERCI POUR VOTRE FIDÉLITÉ !
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// WEEKLY SCHEDULE VIEW
// ==========================================
function Planning({ schedule, setSchedule, staff, triggerToast, currentUser }) {
  const isAdmin = currentUser && currentUser.role === "Administrateur";
  const [selectedDay, setSelectedDay] = useState("Tous");
  const [displayMode, setDisplayMode] = useState("table"); // "table" (Data Grid) by default, or "grid"
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "jour", direction: "ascending" });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDay]);

  const PREDEFINED_ACTIVITIES = [
    "Musculation / Force",
    "Cardio / HIIT",
    "Zumba / Fitness",
    "Boxe Cardio",
    "Yoga / Stretching",
    "Pilates / Gym douce",
    "Autre (Saisie libre)"
  ];

  const DAY_ORDER = { "Lun": 1, "Mar": 2, "Mer": 3, "Jeu": 4, "Ven": 5, "Sam": 6, "Dim": 7 };

  const [form, setForm] = useState({ 
    activite: "Musculation / Force", 
    coach: "", 
    jour: "Lun", 
    debut: "08:00", 
    fin: "09:00" 
  });
  const [selectedPreset, setSelectedPreset] = useState("Musculation / Force");
  const [customActivite, setCustomActivite] = useState("");

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    if (preset === "Autre (Saisie libre)") {
      setForm(prev => ({ ...prev, activite: customActivite }));
    } else {
      setForm(prev => ({ ...prev, activite: preset }));
    }
  };

  const handleCustomActiviteChange = (text) => {
    setCustomActivite(text);
    setForm(prev => ({ ...prev, activite: text }));
  };

  const add = async () => {
    if (!form.activite.trim()) {
      triggerToast("L'activité est obligatoire");
      return;
    }
    if (form.debut >= form.fin) {
      triggerToast("L'heure de début doit précéder l'heure de fin");
      return;
    }
    
    const newCourse = { id: uid(), ...form };
    const { error } = await supabase.from("schedule").insert([newCourse]);
    if (error) {
      triggerToast("Erreur lors de la planification sur Supabase");
      console.error(error);
      return;
    }

    setSchedule([...schedule, newCourse]);
    triggerToast("Cours planifié");
    
    const nextDefaultPreset = PREDEFINED_ACTIVITIES[0];
    setSelectedPreset(nextDefaultPreset);
    setCustomActivite("");
    setForm({ 
      activite: nextDefaultPreset, 
      coach: "", 
      jour: form.jour, 
      debut: "08:00", 
      fin: "09:00" 
    });
  };

  const remove = async (id) => {
    if (!isAdmin) {
      triggerToast("Action non autorisée. Seul l'Administrateur peut supprimer un cours.");
      return;
    }
    if (confirm("Supprimer ce cours ?")) {
      const { error } = await supabase.from("schedule").delete().eq("id", id);
      if (error) {
        triggerToast("Erreur lors de la suppression sur Supabase");
        console.error(error);
        return;
      }
      setSchedule(schedule.filter(s => s.id !== id));
      triggerToast("Cours supprimé");
    }
  };

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return <span style={{ color: "#94A3B8", marginLeft: 4, fontSize: 10 }}>↕</span>;
    return sortConfig.direction === "ascending" ? 
      <span style={{ color: "#6366F1", marginLeft: 4, fontSize: 10 }}>▲</span> : 
      <span style={{ color: "#6366F1", marginLeft: 4, fontSize: 10 }}>▼</span>;
  };

  const coaches = staff.filter(s => s.role && s.role.toLowerCase().includes("coach"));

  // Apply sorting and filtering to schedule
  const processedSchedule = [...schedule]
    .filter(c => {
      const matchesDay = selectedDay === "Tous" || c.jour === selectedDay;
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        c.activite.toLowerCase().includes(query) || 
        (c.coach && c.coach.toLowerCase().includes(query)) ||
        c.jour.toLowerCase().includes(query) ||
        c.debut.includes(query) ||
        c.fin.includes(query);
      return matchesDay && matchesSearch;
    })
    .sort((a, b) => {
      let aVal = a[sortConfig.key] || "";
      let bVal = b[sortConfig.key] || "";

      if (sortConfig.key === "jour") {
        aVal = DAY_ORDER[a.jour] || 99;
        bVal = DAY_ORDER[b.jour] || 99;
      }

      if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
      
      // Secondary sort
      if (sortConfig.key !== "debut") {
        return (a.debut || "").localeCompare(b.debut || "");
      }
      return 0;
    });

  const itemsPerPage = 6;
  const totalPages = Math.ceil(processedSchedule.length / itemsPerPage);
  const paginatedSchedule = processedSchedule.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <h1 style={S.pageTitle}>Emploi du Temps</h1>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }}>Planification des cours hebdomadaires et assignation des coachs.</p>
      
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", width: "100%" }}>
        
        {/* Left column: Planifier un nouveau cours */}
        <div style={{ flex: "1 1 320px", maxWidth: 400 }}>
          <CardPanel title="Planifier un nouveau cours">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={S.labelStyle}>Activité / Cours</label>
                <select 
                  style={S.input} 
                  value={selectedPreset} 
                  onChange={e => handlePresetChange(e.target.value)}
                >
                  {PREDEFINED_ACTIVITIES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                {selectedPreset === "Autre (Saisie libre)" && (
                  <input 
                    style={{ ...S.input, marginTop: 4 }} 
                    placeholder="Nom du cours personnalisé..." 
                    value={customActivite} 
                    onChange={e => handleCustomActiviteChange(e.target.value)} 
                  />
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={S.labelStyle}>Coach Assigné</label>
                <select style={S.input} value={form.coach} onChange={e => setForm({ ...form, coach: e.target.value })}>
                  <option value="">Sélectionner un coach</option>
                  {coaches.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={S.labelStyle}>Jour</label>
                <select style={S.input} value={form.jour} onChange={e => setForm({ ...form, jour: e.target.value })}>
                  {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={S.labelStyle}>Début</label>
                  <input style={S.input} type="time" value={form.debut} onChange={e => setForm({ ...form, debut: e.target.value })} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={S.labelStyle}>Fin</label>
                  <input style={S.input} type="time" value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} />
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <button 
                  className="btn-glow" 
                  style={{
                    background: "#E27722",
                    color: "#FFF",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px 20px",
                    fontWeight: "bold",
                    fontSize: 14,
                    cursor: "pointer",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(226, 119, 34, 0.2)",
                    transition: "all 0.2s"
                  }} 
                  onClick={add}
                >
                  Ajouter
                </button>
              </div>

            </div>
          </CardPanel>
        </div>

        {/* Right column: Planning Hebdomadaire */}
        <div style={{ flex: "2 1 600px", minWidth: 320 }}>
          <CardPanel title="Planning Hebdomadaire">
            {/* Grid Controls (Search + View Toggles) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              {/* Search bar */}
              <div style={{ flex: "1 1 200px", maxWidth: 300 }}>
                <input 
                  style={{ ...S.input, margin: 0, paddingLeft: 12 }} 
                  placeholder="🔍 Rechercher un cours, un coach, un jour..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Toggle buttons */}
              <div style={{ display: "flex", background: "#F1F5F9", padding: 4, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                <button
                  onClick={() => setDisplayMode("table")}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: 8,
                    background: displayMode === "table" ? "#FFFFFF" : "transparent",
                    color: displayMode === "table" ? "#4F46E5" : "#64748B",
                    fontWeight: displayMode === "table" ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: displayMode === "table" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  📊 Tableau (Data Grid)
                </button>
                <button
                  onClick={() => setDisplayMode("grid")}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: 8,
                    background: displayMode === "grid" ? "#FFFFFF" : "transparent",
                    color: displayMode === "grid" ? "#4F46E5" : "#64748B",
                    fontWeight: displayMode === "grid" ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: displayMode === "grid" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  📅 Calendrier
                </button>
              </div>
            </div>

            {/* Day selection tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", justifyContent: "flex-start", borderBottom: "1px solid #E2E8F0", paddingBottom: 16 }}>
              {["Tous", ...JOURS].map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  style={{
                    ...S.btnFilter,
                    padding: "8px 16px",
                    fontSize: 13,
                    borderRadius: 8,
                    ...(selectedDay === d ? S.btnFilterActive : {})
                  }}
                >
                  {d === "Tous" ? "Toute la semaine" : d}
                </button>
              ))}
            </div>

            {displayMode === "table" ? (
              /* Data Grid View */
              paginatedSchedule.length === 0 ? (
                <div style={{ color: "#64748B", padding: "40px 20px", textAlign: "center", border: "1px dashed #CBD5E1", borderRadius: 12, fontSize: 14, background: "#F8FAFC" }}>
                  Aucun cours correspondant aux critères de recherche.
                </div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("activite")}>
                            Activité / Cours {renderSortIndicator("activite")}
                          </th>
                          <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("coach")}>
                            Coach {renderSortIndicator("coach")}
                          </th>
                          <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("jour")}>
                            Jour {renderSortIndicator("jour")}
                          </th>
                          <th style={{ ...S.th, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("debut")}>
                            Horaires {renderSortIndicator("debut")}
                          </th>
                          <th style={{ ...S.th, width: 60 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSchedule.map(c => (
                          <tr key={c.id} style={S.tr}>
                            <td style={{ ...S.td, fontWeight: 700, color: "#0F172A" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  display: "inline-block",
                                  background: c.activite.toLowerCase().includes("muscu") || c.activite.toLowerCase().includes("streng") ? "#10B981" : 
                                             c.activite.toLowerCase().includes("cardio") || c.activite.toLowerCase().includes("hiit") ? "#EF4444" : 
                                             c.activite.toLowerCase().includes("yoga") || c.activite.toLowerCase().includes("stret") ? "#8B5CF6" : "#3B82F6"
                                }} />
                                {c.activite}
                              </div>
                            </td>
                            <td style={S.td}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                <span style={{ fontWeight: 500 }}>{c.coach || "Aucun coach"}</span>
                              </div>
                            </td>
                            <td style={S.td}>
                              <span style={{
                                ...S.tag,
                                background: c.jour === "Lun" ? "#EFF6FF" : 
                                            c.jour === "Mar" ? "#ECFDF5" : 
                                            c.jour === "Mer" ? "#FDF2F8" : 
                                            c.jour === "Jeu" ? "#FEF3C7" : 
                                            c.jour === "Ven" ? "#F5F3FF" : 
                                            c.jour === "Sam" ? "#FFF1F2" : "#F8FAFC",
                                color: c.jour === "Lun" ? "#1E40AF" : 
                                       c.jour === "Mar" ? "#065F46" : 
                                       c.jour === "Mer" ? "#9D174D" : 
                                       c.jour === "Jeu" ? "#92400E" : 
                                       c.jour === "Ven" ? "#5B21B6" : 
                                       c.jour === "Sam" ? "#9F1239" : "#64748B"
                              }}>
                                {c.jour === "Lun" ? "Lundi" : 
                                 c.jour === "Mar" ? "Mardi" : 
                                 c.jour === "Mer" ? "Mercredi" : 
                                 c.jour === "Jeu" ? "Jeudi" : 
                                 c.jour === "Ven" ? "Vendredi" : 
                                 c.jour === "Sam" ? "Samedi" : "Dimanche"}
                              </span>
                            </td>
                            <td className="mono" style={{ ...S.td, fontWeight: 600, color: "#475569" }}>
                              {c.debut} - {c.fin}
                            </td>
                            <td style={S.td}>
                              {isAdmin && (
                                <button 
                                  style={{
                                    background: "#FEE2E2",
                                    border: "none",
                                    color: "#EF4444",
                                    borderRadius: "6px",
                                    padding: "6px 8px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "all 0.2s"
                                  }}
                                  onClick={() => remove(c.id)}
                                  title="Supprimer ce cours"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination Controls */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        color: currentPage === 1 ? "#94A3B8" : "#E27722",
                        fontWeight: 600,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      ‹ Précédent
                    </button>
                    <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>
                      Page {currentPage} / {totalPages || 1}
                    </span>
                    <button
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: (currentPage === totalPages || totalPages === 0) ? "not-allowed" : "pointer",
                        color: (currentPage === totalPages || totalPages === 0) ? "#94A3B8" : "#E27722",
                        fontWeight: 600,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      Suivant ›
                    </button>
                  </div>
                </>
              )
            ) : (
              /* Calendar Grid View */
              selectedDay === "Tous" ? (
                <div style={S.weeklyGrid}>
                  {JOURS.map(j => {
                    const dayCourses = processedSchedule.filter(s => s.jour === j);
                    return (
                      <div key={j} style={S.weeklyCol}>
                        <div style={S.weeklyColHeader}>{j}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {dayCourses.length === 0 ? (
                            <div style={{ color: "#94A3B8", fontSize: 11, textAlign: "center", fontStyle: "italic", padding: "16px 0" }}>Aucun cours</div>
                          ) : (
                            dayCourses.map(c => {
                              let actBg = "linear-gradient(135deg, #3B82F6, #1D4ED8)";
                              if (c.activite.toLowerCase().includes("muscu") || c.activite.toLowerCase().includes("streng")) {
                                actBg = "linear-gradient(135deg, #10B981, #059669)";
                              } else if (c.activite.toLowerCase().includes("cardio") || c.activite.toLowerCase().includes("hiit")) {
                                actBg = "linear-gradient(135deg, #EF4444, #B91C1C)";
                              } else if (c.activite.toLowerCase().includes("yoga") || c.activite.toLowerCase().includes("stret")) {
                                actBg = "linear-gradient(135deg, #8B5CF6, #6D28D9)";
                              }

                              return (
                                <div key={c.id} style={{ ...S.courseCard, background: actBg, padding: "12px 14px" }}>
                                  {isAdmin && (
                                    <button 
                                      style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        background: "rgba(255,255,255,0.2)",
                                        border: "none",
                                        color: "#FFF",
                                        borderRadius: "6px",
                                        width: 20,
                                        height: 20,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                      onClick={() => remove(c.id)}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                  )}
                                  <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "#FFF" }}>
                                    {c.debut} - {c.fin}
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 6px 0", color: "#FFF", lineHeight: 1.25 }}>
                                    {c.activite}
                                  </div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", gap: 5 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{c.coach || "Aucun coach"}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 650, margin: "0 auto", padding: "10px 0" }}>
                  {(() => {
                    const dayCourses = processedSchedule.filter(s => s.jour === selectedDay);
                    if (dayCourses.length === 0) {
                      return (
                        <div style={{ color: "#64748B", padding: "40px 20px", textAlign: "center", border: "1px dashed #CBD5E1", borderRadius: 12, fontSize: 14, background: "#F8FAFC" }}>
                          Aucun cours de planifié pour le <strong>{selectedDay === "Lun" ? "Lundi" : selectedDay === "Mar" ? "Mardi" : selectedDay === "Mer" ? "Mercredi" : selectedDay === "Jeu" ? "Jeudi" : selectedDay === "Ven" ? "Vendredi" : selectedDay === "Sam" ? "Samedi" : "Dimanche"}</strong>.
                        </div>
                      );
                    }
                    return dayCourses.map(c => {
                      const isMuscu = c.activite.toLowerCase().includes("muscu") || c.activite.toLowerCase().includes("streng");
                      const isCardio = c.activite.toLowerCase().includes("cardio") || c.activite.toLowerCase().includes("hiit");
                      const borderCol = isMuscu ? "#10B981" : isCardio ? "#EF4444" : "#8B5CF6";
                      
                      return (
                        <div 
                          key={c.id} 
                          style={{
                            background: "#FFFFFF",
                            borderRadius: 12,
                            padding: "16px 20px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
                            border: "1px solid #E2E8F0",
                            borderLeft: `5px solid ${borderCol}`
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                            <div className="mono" style={{ 
                              background: "#F1F5F9", 
                              padding: "8px 12px", 
                              borderRadius: 8, 
                              fontWeight: 700, 
                              color: "#334155", 
                              fontSize: 13.5
                            }}>
                              {c.debut} - {c.fin}
                            </div>
                            <div>
                              <h4 style={{ color: "#0F172A", fontSize: 16, fontWeight: 700, margin: 0 }}>{c.activite}</h4>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, color: "#64748B", fontSize: 12.5 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                <span>Coach : <strong>{c.coach || "Aucun coach"}</strong></span>
                              </div>
                            </div>
                          </div>
                          
                          {isAdmin && (
                            <button 
                              style={{
                                background: "#FEE2E2",
                                border: "none",
                                color: "#EF4444",
                                borderRadius: "8px",
                                padding: "8px 10px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s"
                              }}
                              onClick={() => remove(c.id)}
                              title="Supprimer ce cours"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )
            )}
          </CardPanel>
        </div>
      </div>

    </div>
  );
}

// ==========================================
// BOUTIQUE / POS (POINT OF SALE) VIEW
// ==========================================
function Boutique({ setTx, triggerToast }) {
  const [cart, setCart] = useState([]);
  const [activeSaleReceipt, setActiveSaleReceipt] = useState(null);
  const [customItem, setCustomItem] = useState({ name: "", price: "" });
  const [showCustomModal, setShowCustomModal] = useState(false);

  const PRODUCTS_DEFAULT = [
    { id: "p1", name: "Bouteille d'eau (500 ml)", price: 500, emoji: "💧", category: "Rafraîchissement" },
    { id: "p2", name: "Boisson Énergisante", price: 1500, emoji: "⚡", category: "Rafraîchissement" },
    { id: "p3", name: "Shake de Protéines", price: 2000, emoji: "🥛", category: "Rafraîchissement" },
    { id: "p4", name: "Jus de Fruits Naturel", price: 1000, emoji: "🧃", category: "Rafraîchissement" },
    { id: "p5", name: "Serviette de sport", price: 3000, emoji: "🧼", category: "Accessoire" },
    { id: "p6", name: "Gants de musculation", price: 5000, emoji: "🥊", category: "Accessoire" },
    { id: "p7", name: "Shaker FORGE", price: 4000, emoji: "🥤", category: "Accessoire" },
    { id: "p8", name: "Cadenas de vestiaire", price: 1500, emoji: "🔒", category: "Accessoire" },
    { id: "p9", name: "T-shirt FORGE", price: 7000, emoji: "👕", category: "Accessoire" },
  ];

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    triggerToast(`${product.name} ajouté au panier`);
  };

  const addCustomItem = (e) => {
    e.preventDefault();
    if (!customItem.name.trim() || !customItem.price) {
      triggerToast("Tous les champs sont requis");
      return;
    }
    const priceNum = Number(customItem.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      triggerToast("Le prix doit être positif");
      return;
    }

    const newItem = {
      id: "custom-" + uid().substring(0, 5),
      name: customItem.name,
      price: priceNum,
      emoji: "🏷️",
      category: "Personnalisé"
    };

    addToCart(newItem);
    setCustomItem({ name: "", price: "" });
    setShowCustomModal(false);
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const checkout = async () => {
    if (cart.length === 0) {
      triggerToast("Le panier est vide");
      return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const saleId = "B-" + uid().substring(0, 6).toUpperCase();
    const itemsDescription = cart.map(item => `${item.name} x${item.qty}`).join(", ");
    
    const newTx = {
      id: uid(),
      type: "recette",
      description: `Vente Boutique [${saleId}] : ${itemsDescription}`,
      montant: total,
      date: today()
    };

    const { error: txError } = await supabase.from("tx").insert([newTx]);
    if (txError) {
      console.error("Failed to post shop sale tx to Supabase:", txError);
      triggerToast("Erreur lors de l'enregistrement de la transaction");
      return;
    }

    setTx(prev => [...prev, newTx]);
    triggerToast(`Vente enregistrée ! Total : ${fmt(total)} F CFA`);

    const receiptData = {
      id: saleId,
      date: today(),
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      items: [...cart],
      total: total
    };
    
    setCart([]);
    setActiveSaleReceipt(receiptData);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const totalCart = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div>
      <h1 style={S.pageTitle} className="no-print">Boutique & Rafraîchissements</h1>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }} className="no-print">
        Gérez les ventes d'accessoires et de boissons aux membres. Validez le panier pour émettre le reçu thermique.
      </p>

      <div style={S.grid2} className="no-print">
        {/* Products Catalogue */}
        <CardPanel title="Catalogue Produits" action={<button className="btn-secondary" style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 12 }} onClick={() => setShowCustomModal(true)}>➕ Produit Libre</button>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
            {PRODUCTS_DEFAULT.map(p => (
              <div 
                key={p.id} 
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: 12,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s"
                }}
                className="card-glow"
                onClick={() => addToCart(p)}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{p.emoji}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", height: 34, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.2 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, textTransform: "uppercase", fontWeight: 600 }}>{p.category}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#6366F1", marginTop: 6 }}>{fmt(p.price)} F</div>
              </div>
            ))}

            {/* Special + Produit Libre card */}
            <div 
              style={{
                background: "linear-gradient(135deg, #EEF2F6, #E2E8F0)",
                border: "2px dashed #CBD5E1",
                borderRadius: 12,
                padding: 12,
                textAlign: "center",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 120,
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              className="card-glow"
              onClick={() => setShowCustomModal(true)}
            >
              <div style={{ fontSize: 32, marginBottom: 6 }}>➕</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
                Produit Libre
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Saisie libre</div>
            </div>
          </div>
        </CardPanel>

        {/* Shopping Cart */}
        <CardPanel title={`Panier (${cart.reduce((s, i) => s + i.qty, 0)} articles)`}>
          {cart.length === 0 ? (
            <div style={S.empty}>Le panier est vide. Cliquez sur un produit pour l'ajouter.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {item.emoji} {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{fmt(item.price)} F &bull; Total: {fmt(item.price * item.qty)} F</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button 
                        style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #CBD5E1", background: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }} 
                        onClick={() => updateQty(item.id, -1)}
                      >
                        -
                      </button>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                      <button 
                        style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #CBD5E1", background: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }} 
                        onClick={() => updateQty(item.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, borderTop: "2px solid #F1F5F9", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>Total à payer :</span>
                  <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>{fmt(totalCart)} F CFA</span>
                </div>
                <button 
                  className="btn-glow" 
                  style={{ ...S.btnPrimary, width: "100%", height: 42, fontSize: 14 }} 
                  onClick={checkout}
                >
                  🛒 Enregistrer & Imprimer Reçu
                </button>
              </div>
            </div>
          )}
        </CardPanel>
      </div>

      {/* Predefined Custom Product Modal */}
      {showCustomModal && (
        <div style={S.modalOverlay} className="no-print">
          <div style={{ ...S.modalContent, width: "90%", maxWidth: 400 }}>
            <h3 style={{ color: "#0F172A", fontSize: 18, marginBottom: 16 }}>Ajouter un Produit Libre</h3>
            <form onSubmit={addCustomItem} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={S.labelStyle}>Désignation / Nom</label>
                <input 
                  style={S.input} 
                  placeholder="Ex: Claquettes de douche" 
                  value={customItem.name} 
                  onChange={e => setCustomItem({ ...customItem, name: e.target.value })} 
                  required 
                />
              </div>
              <div>
                <label style={S.labelStyle}>Prix Unitaire (F CFA)</label>
                <input 
                  style={S.input} 
                  type="number" 
                  placeholder="Ex: 2500" 
                  value={customItem.price} 
                  onChange={e => setCustomItem({ ...customItem, price: e.target.value })} 
                  required 
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" style={S.btnGhost} onClick={() => setShowCustomModal(false)}>Annuler</button>
                <button type="submit" className="btn-glow" style={S.btnPrimary}>Ajouter au Panier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal receipt for Shop sale */}
      {activeSaleReceipt && (
        <div className="print-only" style={{ display: "none" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: "bold" }}>FORGE.GYM</div>
            <div style={{ fontSize: 10 }}>Divo, Côte d'Ivoire</div>
            <div style={{ fontSize: 10 }}>Tel: +225 07 00 00 00 00</div>
            <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold" }}>TICKET BOUTIQUE</div>
          </div>

          <div style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>
            <div>TICKET : {activeSaleReceipt.id}</div>
            <div>DATE   : {activeSaleReceipt.date}</div>
            <div>HEURE  : {activeSaleReceipt.time}</div>
          </div>
          
          <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />
          
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", paddingBottom: 4 }}>Art.</th>
                <th style={{ textAlign: "center", paddingBottom: 4, width: 40 }}>Qté</th>
                <th style={{ textAlign: "right", paddingBottom: 4 }}>Prix</th>
              </tr>
            </thead>
            <tbody>
              {activeSaleReceipt.items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ paddingTop: 4, paddingBottom: 4 }}>{item.name}</td>
                  <td style={{ textAlign: "center", paddingTop: 4, paddingBottom: 4 }}>{item.qty}</td>
                  <td style={{ textAlign: "right", paddingTop: 4, paddingBottom: 4 }}>{fmt(item.price * item.qty)} F</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderBottom: "1px dashed #000", margin: "8px 0" }} />
          
          <div style={{ fontSize: 13, fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
            <span>NET A PAYER :</span>
            <span>{fmt(activeSaleReceipt.total)} F CFA</span>
          </div>

          <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }} />
          <div style={{ textAlign: "center", fontSize: 9 }}>
            MERCI POUR VOTRE VISITE ! A BIENTÔT.
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ACCUEIL / TICKETS (SECRETAIRE)
// ==========================================
function Accueil({ members, tickets, setTickets, setTx, triggerToast, currentUser, cardTiers = [] }) {
  const ticketTier = cardTiers?.find(t => 
    t.duration === 0 ||
    t.key?.toLowerCase().includes("ticket unique") || 
    t.key?.toLowerCase().includes("ticket") ||
    (t.key?.toLowerCase().includes("séance") && !t.key?.toLowerCase().includes("carte"))
  );
  const ticketPrice = ticketTier ? Number(ticketTier.price) : 1000;

  const [name, setName] = useState("");
  const [montant, setMontant] = useState(ticketPrice || 1000); // Walk-in default price: 1000 F CFA
  const [lastTicket, setLastTicket] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setMontant(ticketPrice);
  }, [ticketPrice]);

  const isAdmin = currentUser && currentUser.role === "Administrateur";

  const matchedMember = members.find(m => m.nom.toLowerCase() === name.trim().toLowerCase());
  const isActiveMember = matchedMember && matchedMember.expiration >= today();

  const handleMemberSelect = (nom) => {
    setName(nom);
    const m = members.find(member => member.nom.toLowerCase() === nom.trim().toLowerCase());
    if (m) {
      const active = m.expiration >= today();
      if (active) {
        setMontant(0);
      } else {
        setMontant(ticketPrice);
      }
    } else {
      setMontant(ticketPrice);
    }
  };

  const issue = async () => {
    if (!name.trim()) {
      triggerToast("Entrez un nom pour émettre le ticket");
      return;
    }

    const price = isActiveMember ? 0 : Number(montant);
    const newId = `T-${Math.random().toString(36).substring(3, 8).toUpperCase()}`;
    const t = {
      id: newId,
      nom: name.trim(),
      date: today(),
      heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      montant: price,
      isMember: !!isActiveMember,
    };

    setIsPrinting(true);
    
    const { error: ticketErr } = await supabase.from("tickets").insert([t]);
    if (ticketErr) {
      triggerToast("Erreur lors de la création du ticket sur Supabase");
      console.error(ticketErr);
      setIsPrinting(false);
      return;
    }

    if (price > 0) {
      const newTx = {
        id: uid(),
        type: "recette",
        description: `Ticket Entrée - ${name.trim()}`,
        montant: price,
        date: today()
      };
      const { error: txErr } = await supabase.from("tx").insert([newTx]);
      if (txErr) {
        console.error("Failed to post visitor tx to Supabase:", txErr);
      } else {
        setTx(prev => [...prev, newTx]);
      }
    }

    // Animate printing delay
    setTimeout(() => {
      setTickets(prev => [...prev, t]);
      setLastTicket(t);
      
      triggerToast(`Ticket émis avec succès (${newId})`);
      setIsPrinting(false);
      setName("");
      setMontant(ticketPrice);
    }, 1000);
  };

  const handlePrintAction = () => {
    window.print();
  };

  const todayTickets = tickets.filter(t => t.date === today());

  return (
    <div>
      <h1 style={S.pageTitle} className="no-print">Guichet & Accueil</h1>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }} className="no-print">Enregistrez les passages des membres ou émettez des tickets d'entrée payants pour les visiteurs.</p>
      
      <div style={S.grid2} className="no-print">
        {/* Entrance Desk */}
        <CardPanel title="Émettre un Ticket d'Accès">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.labelStyle}>Rechercher membre ou saisir nom visiteur</label>
              <input
                style={S.input}
                list="members-search"
                placeholder="Ex: Yao Koffi..."
                value={name}
                onChange={e => handleMemberSelect(e.target.value)}
              />
              <datalist id="members-search">
                {members.map(m => <option key={m.id} value={m.nom}>{m.carte} - Exp: {m.expiration}</option>)}
              </datalist>
            </div>
            
            {name.trim() !== "" && (
              <div style={{ marginTop: 4, marginBottom: 4 }}>
                {matchedMember ? (
                  isActiveMember ? (
                    <div style={{ background: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
                      ✅ Membre Actif ({matchedMember.carte})<br/>
                      <span style={{ fontSize: 11, fontWeight: "normal" }}>Expiration : {matchedMember.expiration} &bull; Accès gratuit (0 F)</span>
                    </div>
                  ) : (
                    <div style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
                      ⚠️ Abonnement Expiré ! ({matchedMember.carte})<br/>
                      <span style={{ fontSize: 11, fontWeight: "normal" }}>Expiré le : {matchedMember.expiration} &bull; Séance payante ({fmt(ticketPrice)} F)</span>
                    </div>
                  )
                ) : (
                  <div style={{ background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
                    👤 Visiteur Externe<br/>
                    <span style={{ fontSize: 11, fontWeight: "normal" }}>Tarif visiteur standard applicable ({fmt(ticketPrice)} F)</span>
                  </div>
                )}
              </div>
            )}
            
            {!isActiveMember && (
              <div>
                <label style={S.labelStyle}>Frais d'Entrée Unique (F CFA)</label>
                <input
                  style={S.input}
                  type="number"
                  placeholder="F CFA"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                  disabled={!isAdmin}
                />
                {!isAdmin && (
                  <span style={{ fontSize: 11, color: "#64748B", marginTop: 4, display: "block" }}>
                    * Seul l'Administrateur peut modifier le tarif visiteur.
                  </span>
                )}
              </div>
            )}

            <button
              className="btn-glow"
              style={{ ...S.btnPrimary, width: "100%", height: 42, display: "flex", justifyContent: "center", alignItems: "center" }}
              onClick={issue}
              disabled={isPrinting}
            >
              {isPrinting ? "Génération du ticket..." : "Émettre le Ticket d'Accès"}
            </button>
          </div>
        </CardPanel>

        {/* Thermal Receipt Visualizer */}
        <CardPanel title="Aperçu du Reçu de Caisse" action={lastTicket && <button className="btn-secondary" style={S.btnGhost} onClick={handlePrintAction}>Imprimer</button>}>
          <div style={S.printerSlot}>
            {!lastTicket && !isPrinting && <div style={S.empty}>Aucun ticket émis dans cette session.</div>}
            
            {isPrinting && (
              <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={S.spinner} />
                <span className="mono" style={{ fontSize: 12, color: "#64748B" }}>Édition du ticket...</span>
              </div>
            )}

            {lastTicket && !isPrinting && (
              <div style={S.ticketPaper} className="animate-ticket printable-receipt">
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <div className="disp" style={{ fontSize: 18, color: "#000", fontWeight: 800 }}>FORGE.GYM</div>
                  <div style={{ fontSize: 10, color: "#444" }}>Divo, Côte d'Ivoire</div>
                  <div style={{ fontSize: 10, color: "#444" }}>Tel: +225 07 00 00 00 00</div>
                  <div style={{ borderBottom: "1px dashed #444", margin: "10px 0" }} />
                  <div className="disp" style={{ fontSize: 12, color: "#000", fontWeight: 700 }}>ACCÈS SEANCE</div>
                </div>
                
                <div className="mono" style={{ fontSize: 11, color: "#000", lineHeight: 1.6, marginBottom: 14 }}>
                  <div>RÉF : {lastTicket.id}</div>
                  <div>DATE : {lastTicket.date}</div>
                  <div>HEURE : {lastTicket.heure}</div>
                  <div>TYPE : {lastTicket.isMember ? "MEMBRE ADHERENT" : "VISITEUR PASS"}</div>
                  <div style={{ borderBottom: "1px dashed #444", margin: "8px 0" }} />
                  <div style={{ fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                    <span>CLIENT :</span>
                    <span>{lastTicket.nom}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" , marginTop: 4 }}>
                    <span>MONTANT :</span>
                    <span>{fmt(lastTicket.montant)} F</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  {/* Custom QR Code */}
                  <svg width="60" height="60" viewBox="0 0 21 21" style={{ background: "#fff", padding: 2 }}>
                    <path d="M0 0h7v7H0zm1 1v5h5V1zm1 1h3v3H2z" fill="#000" />
                    <path d="M14 0h7v7h-7zm1 1v5h5V1zm1 1h3v3h-2z" fill="#000" />
                    <path d="M0 14h7v7H0zm1 1v5h5v-5zm1 1h3v3H2z" fill="#000" />
                    <path d="M9 1h1v2H9zm2 0h1v1h-1zm1 2h1v3h-1zm-3 2h2v1H9zm4-4h1v1h-1zm3 8h2v1h-2zm-5 1h1v2h-1zm3 1h2v1h-2zm-5 3h1v1H9zm3 2h1v1h-1zm2-3h1v2h-1zm1 2h2v1h-2zm1-3h1v1h-1zm-6 2h1v1h-1z" fill="#000" />
                  </svg>
                  <div className="mono" style={{ fontSize: 8, color: "#222", textAlign: "center", marginTop: 4 }}>
                    BONNE SÉANCE D'ENTRAÎNEMENT !
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardPanel>
      </div>

      {/* Daily Passages Table */}
      <CardPanel title={`Registre des entrées du jour (${todayTickets.length})`} className="no-print">
        {todayTickets.length === 0 ? (
          <div style={S.empty}>Aucun passage aujourd'hui.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Code Ticket</th>
                  <th style={S.th}>Heure</th>
                  <th style={S.th}>Nom du client</th>
                  <th style={S.th}>Catégorie</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Frais payés</th>
                </tr>
              </thead>
              <tbody>
                {todayTickets.slice().reverse().map(t => (
                  <tr key={t.id} style={S.tr}>
                    <td className="mono" style={{ ...S.td, color: "#334155" }}>{t.id}</td>
                    <td className="mono" style={{ ...S.td, color: "#334155" }}>{t.heure}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: "#0F172A" }}>{t.nom}</td>
                    <td style={S.td}>
                      <span style={{ ...S.tag, background: t.isMember ? "#D1FAE5" : "#E0F2FE", color: t.isMember ? "#059669" : "#0284C7" }}>
                        {t.isMember ? "Membre" : "Visiteur"}
                      </span>
                    </td>
                    <td className="mono" style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#0F172A" }}>{fmt(t.montant)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPanel>
      
      {/* Hidden print template */}
      {lastTicket && (
        <div className="print-only" style={{ display: "none" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: "bold" }}>FORGE.GYM</div>
            <div style={{ fontSize: 10 }}>Divo, Côte d'Ivoire</div>
            <div style={{ fontSize: 10 }}>Tel: +225 07 00 00 00 00</div>
            <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold" }}>TICKET ENTRÉE</div>
          </div>
          
          <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            <div>RÉF : {lastTicket.id}</div>
            <div>DATE : {lastTicket.date}</div>
            <div>HEURE : {lastTicket.heure}</div>
            <div>TYPE : {lastTicket.isMember ? "MEMBRE ACCÈS" : "VISITEUR PASS"}</div>
            <div style={{ borderBottom: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
              <span>CLIENT :</span>
              <span>{lastTicket.nom}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
              <span>MONTANT :</span>
              <span>{fmt(lastTicket.montant)} F CFA</span>
            </div>
          </div>
          <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }} />
          <div style={{ textAlign: "center", fontSize: 10 }}>
            BONNE SEANCE ! CONSERVEZ CE RECU.
          </div>
        </div>
      )}
    </div>
  );
}

const parseWithdrawalDescription = (desc) => {
  if (!desc || !desc.startsWith("[RETRAIT CAISSE]")) return null;
  try {
    const parts = desc.replace("[RETRAIT CAISSE] ", "").split(" | ");
    const getVal = (part, label) => {
      const prefix = label + ": ";
      const found = parts.find(p => p.startsWith(prefix));
      return found ? found.substring(prefix.length) : "";
    };
    return {
      motif: getVal(parts, "Motif"),
      beneficiaire: getVal(parts, "Bénéficiaire"),
      validePar: getVal(parts, "Validé par"),
      justificatif: getVal(parts, "Réf"),
      mode: getVal(parts, "Mode")
    };
  } catch (e) {
    return null;
  }
};

// ==========================================
// FINANCES (COMPTABLE)
// ==========================================
function Finances({ tx, setTx, tickets, staff, revenuTotal, depenses, salairesVerses, solde, triggerToast, currentUser }) {
  const isAdmin = currentUser && currentUser.role === "Administrateur";
  
  const PREDEFINED_DESCRIPTIONS = {
    recette: [
      "Vente de boissons / suppléments",
      "Frais d'inscription",
      "Dons / Sponsoring",
      "Location d'espace / d'équipement",
      "Autre (Saisie libre)"
    ],
    depense: [
      "Facture d'électricité CIE",
      "Facture d'eau SODECI",
      "Loyer mensuel du local",
      "Achat boissons / produits",
      "Frais d'entretien / ménage",
      "Achat matériel / équipement de sport",
      "Frais de communication / marketing",
      "Autre (Saisie libre)"
    ],
    salaire: [
      "Paiement de salaire mensuel",
      "Avance sur salaire",
      "Prime de performance / bonus",
      "Autre (Saisie libre)"
    ]
  };

  const [form, setForm] = useState({ 
    type: "recette", 
    description: "Vente de boissons / suppléments", 
    montant: "" 
  });
  const [selectedPreset, setSelectedPreset] = useState("Vente de boissons / suppléments");
  const [customDescription, setCustomDescription] = useState("");
  const [filterType, setFilterType] = useState("Tous");
  const [search, setSearch] = useState("");

  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    beneficiaire: "",
    validePar: currentUser?.label || currentUser?.username || "Comptable",
    justificatif: "",
    mode: "Espèces"
  });
  const [activeWithdrawalReceipt, setActiveWithdrawalReceipt] = useState(null);

  const handleTypeChange = (newType) => {
    if (newType !== "depense") {
      setIsWithdrawal(false);
    }
    const defaultPreset = PREDEFINED_DESCRIPTIONS[newType][0];
    setSelectedPreset(defaultPreset);
    setCustomDescription("");
    setForm(prev => ({
      ...prev,
      type: newType,
      description: defaultPreset === "Autre (Saisie libre)" ? "" : defaultPreset
    }));
  };

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    if (preset === "Autre (Saisie libre)") {
      setForm(prev => ({ ...prev, description: customDescription }));
    } else {
      setForm(prev => ({ ...prev, description: preset }));
    }
  };

  const handleCustomDescriptionChange = (text) => {
    setCustomDescription(text);
    setForm(prev => ({ ...prev, description: text }));
  };

  const add = async () => {
    if (form.type === "depense" && isWithdrawal) {
      if (!form.description.trim() || !form.montant || !withdrawalForm.beneficiaire.trim() || !withdrawalForm.validePar.trim()) {
        triggerToast("Le motif, montant, bénéficiaire et validateur sont requis.");
        return;
      }
    } else {
      if (!form.description.trim() || !form.montant) {
        triggerToast("Tous les champs sont requis");
        return;
      }
    }

    if (form.type === "salaire" && !isAdmin) {
      triggerToast("Seul l'Administrateur est autorisé à verser les salaires.");
      return;
    }

    const finalDescription = (form.type === "depense" && isWithdrawal)
      ? `[RETRAIT CAISSE] Motif: ${form.description} | Bénéficiaire: ${withdrawalForm.beneficiaire.trim()} | Validé par: ${withdrawalForm.validePar.trim()} | Réf: ${withdrawalForm.justificatif.trim() || "Aucun"} | Mode: ${withdrawalForm.mode}`
      : form.description;
    
    const newTxObj = {
      id: uid(),
      type: form.type,
      description: finalDescription,
      montant: Number(form.montant),
      date: today()
    };

    const { error } = await supabase.from("tx").insert([newTxObj]);
    if (error) {
      triggerToast("Erreur lors de l'enregistrement sur Supabase");
      console.error(error);
      return;
    }
    
    setTx([...tx, newTxObj]);
    triggerToast("Opération comptable enregistrée");

    if (form.type === "depense" && isWithdrawal) {
      const printTx = {
        id: newTxObj.id,
        date: newTxObj.date,
        montant: newTxObj.montant,
        motif: form.description,
        beneficiaire: withdrawalForm.beneficiaire.trim(),
        validePar: withdrawalForm.validePar.trim(),
        justificatif: withdrawalForm.justificatif.trim() || "Aucun",
        mode: withdrawalForm.mode
      };
      setActiveWithdrawalReceipt(printTx);
      setTimeout(() => {
        window.print();
      }, 150);

      setWithdrawalForm(prev => ({
        ...prev,
        beneficiaire: "",
        justificatif: ""
      }));
    }
    
    const nextDefaultPreset = PREDEFINED_DESCRIPTIONS[form.type][0];
    setSelectedPreset(nextDefaultPreset);
    setCustomDescription("");
    setForm({ 
      type: form.type, 
      description: nextDefaultPreset === "Autre (Saisie libre)" ? "" : nextDefaultPreset, 
      montant: "" 
    });
  };

  const remove = async (id) => {
    if (confirm("Voulez-vous supprimer cette transaction ?")) {
      const { error } = await supabase.from("tx").delete().eq("id", id);
      if (error) {
        triggerToast("Erreur lors de la suppression sur Supabase");
        console.error(error);
        return;
      }
      setTx(tx.filter(t => t.id !== id));
      triggerToast("Transaction supprimée");
    }
  };

  // Pay All Salaries Workflow
  const currentMonth = today().slice(0, 7);
  const getUnpaidStaff = () => {
    return staff.filter(s => {
      const isPaid = tx.some(t => t.type === "salaire" && t.staffId === s.id && t.date.slice(0, 7) === currentMonth);
      return !isPaid;
    });
  };

  const payAllSalaries = async () => {
    if (!isAdmin) {
      triggerToast("Seul l'Administrateur est autorisé à verser les salaires.");
      return;
    }
    const unpaid = getUnpaidStaff();
    if (unpaid.length === 0) {
      triggerToast("Tous les salaires de ce mois sont déjà réglés !");
      return;
    }

    if (confirm(`Payer les salaires de ${unpaid.length} employés pour un montant total de ${fmt(unpaid.reduce((s, e) => s + e.salaire, 0))} F ?`)) {
      const entries = unpaid.map(s => ({
        id: uid(),
        type: "salaire",
        description: `Salaire - ${s.nom} (${s.role}) - ${currentMonth}`,
        montant: Number(s.salaire),
        date: today(),
        staffId: s.id
      }));

      const { error } = await supabase.from("tx").insert(entries);
      if (error) {
        triggerToast("Erreur lors du versement des salaires sur Supabase");
        console.error(error);
        return;
      }

      setTx(prev => [...prev, ...entries]);
      triggerToast(`${unpaid.length} salaires versés en lot.`);
    }
  };

  const filteredTx = tx.filter(t => {
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "Tous" || t.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div>
      <h1 style={S.pageTitle}>Comptabilité & Finances</h1>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }}>Visualisez l'état des caisses, enregistrez les écritures et réglez les salaires.</p>
      
      {/* Finance Grid Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ ...S.statCard, borderLeft: "4px solid #10B981", background: "#FFFFFF" }}>
          <div style={S.statLabel}>Revenus Totaux</div>
          <div className="mono" style={{ ...S.statVal, color: "#059669" }}>+{fmt(revenuTotal)} F</div>
          <div style={S.statSub}>{fmt(tickets.reduce((s, t) => s + t.montant, 0))} F en tickets guichet</div>
        </div>
        <div style={{ ...S.statCard, borderLeft: "4px solid #EF4444", background: "#FFFFFF" }}>
          <div style={S.statLabel}>Frais & Charges</div>
          <div className="mono" style={{ ...S.statVal, color: "#DC2626" }}>-{fmt(depenses)} F</div>
          <div style={S.statSub}>Opérations diverses débitées</div>
        </div>
        <div style={{ ...S.statCard, borderLeft: "4px solid #F59E0B", background: "#FFFFFF" }}>
          <div style={S.statLabel}>Masse Salariale Versée</div>
          <div className="mono" style={{ ...S.statVal, color: "#D97706" }}>-{fmt(salairesVerses)} F</div>
          <div style={S.statSub}>Salaires réglés ce mois</div>
        </div>
      </div>

      <div style={S.grid2}>
        {/* Entry Forms */}
        <CardPanel title="Nouvelle transaction">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={S.labelStyle}>Type d'écriture</label>
              <select style={S.input} value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                <option value="recette">Recette (+)</option>
                <option value="depense">Dépense (-)</option>
                {isAdmin && <option value="salaire">Salaire (-)</option>}
              </select>
            </div>

            {form.type === "depense" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
                <input 
                  type="checkbox" 
                  id="isWithdrawalCheckbox" 
                  checked={isWithdrawal} 
                  onChange={e => setIsWithdrawal(e.target.checked)} 
                  style={{ cursor: "pointer", width: 16, height: 16 }}
                />
                <label htmlFor="isWithdrawalCheckbox" style={{ fontSize: 13, fontWeight: 600, color: "#4F46E5", cursor: "pointer" }}>
                  Enregistrer comme Retrait de Caisse
                </label>
              </div>
            )}

            <div>
              <label style={S.labelStyle}>{isWithdrawal ? "Motif du retrait" : "Libellé explicatif"}</label>
              <select 
                style={{ ...S.input, marginBottom: selectedPreset === "Autre (Saisie libre)" ? 10 : 0 }} 
                value={selectedPreset} 
                onChange={e => handlePresetChange(e.target.value)}
              >
                {(PREDEFINED_DESCRIPTIONS[form.type] || []).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {selectedPreset === "Autre (Saisie libre)" && (
                <input 
                  style={S.input} 
                  placeholder={isWithdrawal ? "Saisir un motif personnalisé..." : "Saisir un libellé personnalisé..."}
                  value={customDescription} 
                  onChange={e => handleCustomDescriptionChange(e.target.value)} 
                />
              )}
            </div>

            {form.type === "depense" && isWithdrawal && (
              <>
                <div>
                  <label style={S.labelStyle}>Bénéficiaire (Qui reçoit les fonds) *</label>
                  <input 
                    style={S.input} 
                    placeholder="Ex: Yao Koffi..." 
                    value={withdrawalForm.beneficiaire} 
                    onChange={e => setWithdrawalForm({ ...withdrawalForm, beneficiaire: e.target.value })} 
                  />
                </div>
                <div>
                  <label style={S.labelStyle}>Validé par (Nom du responsable) *</label>
                  <input 
                    style={S.input} 
                    placeholder="Ex: Super Admin..." 
                    value={withdrawalForm.validePar} 
                    onChange={e => setWithdrawalForm({ ...withdrawalForm, validePar: e.target.value })} 
                  />
                </div>
                <div>
                  <label style={S.labelStyle}>Mode de Retrait</label>
                  <select 
                    style={S.input} 
                    value={withdrawalForm.mode} 
                    onChange={e => setWithdrawalForm({ ...withdrawalForm, mode: e.target.value })}
                  >
                    <option value="Espèces">Espèces (Caisse)</option>
                    <option value="Mobile Money">Mobile Money (Wave/Orange)</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label style={S.labelStyle}>Réf. Pièce Justificative (Optionnel)</label>
                  <input 
                    style={S.input} 
                    placeholder="Ex: FAC-2026-0045, reçu..." 
                    value={withdrawalForm.justificatif} 
                    onChange={e => setWithdrawalForm({ ...withdrawalForm, justificatif: e.target.value })} 
                  />
                </div>
              </>
            )}

            <div>
              <label style={S.labelStyle}>Montant (F CFA)</label>
              <input style={S.input} type="number" placeholder="F CFA" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} />
            </div>
            <button className="btn-glow" style={{ ...S.btnPrimary, height: 38 }} onClick={add}>
              {isWithdrawal ? "Valider & Imprimer le Bon" : "Enregistrer la transaction"}
            </button>
          </div>
        </CardPanel>

        {/* Global Salary Manager Card */}
        <CardPanel 
          title="RH & Paie Mensuelle" 
          action={isAdmin ? <button className="btn-glow" style={S.btnPrimary} onClick={payAllSalaries}>Payer tous les salaires</button> : null}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>
              RH en attente de salaire ce mois ({currentMonth}) : 
              <span className="mono" style={{ color: "#6366F1", marginLeft: 6, fontWeight: "bold" }}>
                {getUnpaidStaff().length} / {staff.length} employés
              </span>
            </div>
            {staff.map(s => {
              const isPaid = tx.some(t => t.type === "salaire" && t.staffId === s.id && t.date.slice(0, 7) === currentMonth);
              return (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A" }}>{s.nom}</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{s.role} &bull; <span className="mono">{fmt(s.salaire)} F</span></div>
                  </div>
                  <div>
                    {isPaid ? (
                      <span style={{ ...S.tag, background: "#D1FAE5", color: "#059669" }}>PAYÉ</span>
                    ) : (
                      <span style={{ ...S.tag, background: "#FEE2E2", color: "#EF4444" }}>EN ATTENTE</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardPanel>
      </div>

      {/* Ledger Table */}
      <CardPanel title="Grand Livre Comptable">
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...S.input, flex: 1, minWidth: 220 }}
            placeholder="Filtrer les écritures..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {["Tous", "recette", "depense", "salaire"].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  ...S.btnFilter,
                  textTransform: "capitalize",
                  ...(filterType === type ? S.btnFilterActive : {})
                }}
              >
                {type === "Tous" ? "Toutes" : type + "s"}
              </button>
            ))}
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <div style={S.empty}>Aucune transaction enregistrée.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>Écriture</th>
                  <th style={S.th}>Libellé / Détails</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Montant</th>
                  <th style={{ ...S.th, width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.slice().reverse().map(t => (
                  <tr key={t.id} style={S.tr}>
                    <td className="mono" style={{ ...S.td, color: "#475569" }}>{t.date}</td>
                    <td style={S.td}>
                      <span style={{
                        ...S.tag,
                        background: t.type === "recette" ? "#D1FAE5" : t.type === "depense" ? "#FEE2E2" : "#FEF3C7",
                        color: t.type === "recette" ? "#059669" : t.type === "depense" ? "#EF4444" : "#D97706"
                      }}>
                        {t.type}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: "#0F172A" }}>
                      {(() => {
                        const w = parseWithdrawalDescription(t.description);
                        if (w) {
                          return (
                            <div>
                              <div style={{ fontWeight: 600, color: "#B91C1C" }}>⚠️ Retrait : {w.motif}</div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                Bénéficiaire: <strong>{w.beneficiaire}</strong> &bull; Validé par: {w.validePar}
                                {w.justificatif !== "Aucun" && ` &bull; Réf: ${w.justificatif}`}
                                {` &bull; Mode: ${w.mode}`}
                              </div>
                            </div>
                          );
                        }
                        return <span style={{ fontWeight: 600 }}>{t.description}</span>;
                      })()}
                    </td>
                    <td className="mono" style={{ ...S.td, textAlign: "right", fontWeight: 700, color: t.type === "recette" ? "#059669" : "#EF4444" }}>
                      {t.type === "recette" ? "+" : "-"}{fmt(t.montant)} F
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                        {(() => {
                          const w = parseWithdrawalDescription(t.description);
                          if (w) {
                            return (
                              <button 
                                className="btn-secondary no-print" 
                                style={{ ...S.btnGhost, padding: "2px 6px", fontSize: 11, color: "#4F46E5", border: "1px solid #E2E8F0" }}
                                onClick={() => {
                                  setActiveWithdrawalReceipt({
                                    id: t.id,
                                    date: t.date,
                                    montant: t.montant,
                                    motif: w.motif,
                                    beneficiaire: w.beneficiaire,
                                    validePar: w.validePar,
                                    justificatif: w.justificatif,
                                    mode: w.mode
                                  });
                                  setTimeout(() => {
                                    window.print();
                                  }, 150);
                                }}
                                title="Réimprimer le Bon de Caisse"
                              >
                                🖨️ Bon
                              </button>
                            );
                          }
                          return null;
                        })()}
                        {isAdmin && (
                          <button style={S.btnDangerIcon} onClick={() => remove(t.id)}>×</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPanel>

      {/* Hidden print template for cash withdrawal voucher */}
      {activeWithdrawalReceipt && (
        <div className="print-only" style={{ display: "none" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: "bold" }}>FORGE.GYM</div>
            <div style={{ fontSize: 10 }}>Divo, Côte d'Ivoire</div>
            <div style={{ fontSize: 10 }}>Tel: +225 07 00 00 00 00</div>
            <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold" }}>BON DE DÉCAISSEMENT CAISSE</div>
          </div>
          
          <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            <div>RÉF CAISSE : BD-{activeWithdrawalReceipt.id.substring(0, 8).toUpperCase()}</div>
            <div>DATE DU RETRAIT : {activeWithdrawalReceipt.date}</div>
            <div>MODE DE PAIEMENT : {activeWithdrawalReceipt.mode}</div>
            {activeWithdrawalReceipt.justificatif && activeWithdrawalReceipt.justificatif !== "Aucun" && (
              <div>RÉF PIÈCE JUSTIF. : {activeWithdrawalReceipt.justificatif}</div>
            )}
            <div style={{ borderBottom: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontSize: 14, fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
              <span>MOTIF :</span>
              <span>{activeWithdrawalReceipt.motif}</span>
            </div>
            <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>BÉNÉFICIAIRE :</span>
              <span style={{ fontWeight: "bold" }}>{activeWithdrawalReceipt.beneficiaire}</span>
            </div>
            <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>VALIDATEUR :</span>
              <span>{activeWithdrawalReceipt.validePar}</span>
            </div>
            <div style={{ borderBottom: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontSize: 16, fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
              <span>MONTANT DÉBITÉ :</span>
              <span>{fmt(activeWithdrawalReceipt.montant)} F CFA</span>
            </div>
          </div>
          
          <div style={{ borderBottom: "1px dashed #000", margin: "15px 0" }} />
          
          {/* Signature lines */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 10, height: 70 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "45%" }}>
              <div style={{ borderBottom: "1px solid #000", paddingBottom: 2, fontWeight: "bold", textAlign: "center" }}>Signature Bénéficiaire</div>
              <div style={{ height: 40 }}></div>
              <div style={{ fontSize: 8, color: "#666", textAlign: "center" }}>(Précédée de "Lu et approuvé")</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "45%" }}>
              <div style={{ borderBottom: "1px solid #000", paddingBottom: 2, fontWeight: "bold", textAlign: "center" }}>Signature Caissier / Validateur</div>
              <div style={{ height: 40 }}></div>
              <div style={{ fontSize: 8, color: "#666", textAlign: "center" }}>(Signature & Cachet)</div>
            </div>
          </div>
          
          <div style={{ borderBottom: "1px dashed #000", margin: "15px 0 10px 0" }} />
          <div style={{ textAlign: "center", fontSize: 9, color: "#333", marginTop: 10 }}>
            Forge.Gym &copy; {new Date().getFullYear()} - Document comptable officiel
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// PERSONNEL (STAFF) & ACCOUNTS (ADMIN ONLY)
// ==========================================
function Personnel({ staff, setStaff, tx, setTx, users, setUsers, currentUser, triggerToast, cardTiers, setCardTiers }) {
  const isAdmin = currentUser && currentUser.role === "Administrateur";
  const [subTab, setSubTab] = useState("staff"); // "staff", "users" or "tarifs"
  
  // Card Tiers editing form state
  const [editingTierKey, setEditingTierKey] = useState(null);
  const [tierForm, setTierForm] = useState({ price: "", duration: "", description: "" });

  const startEditTier = (tier) => {
    setEditingTierKey(tier.key);
    setTierForm({
      price: tier.price.toString(),
      duration: tier.duration.toString(),
      description: tier.description
    });
  };

  const saveCardTier = async () => {
    if (!tierForm.price || !tierForm.duration || !tierForm.description.trim()) {
      triggerToast("Tous les champs sont obligatoires");
      return;
    }

    const priceNum = Number(tierForm.price);
    const durationNum = Number(tierForm.duration);

    if (isNaN(priceNum) || priceNum <= 0) {
      triggerToast("Le prix doit être un nombre positif");
      return;
    }

    if (isNaN(durationNum) || durationNum < 0) {
      triggerToast("La durée doit être un nombre de mois positif ou nul (0)");
      return;
    }

    // Update in Supabase
    const { error } = await supabase
      .from("card_tiers")
      .update({
        price: priceNum,
        duration: durationNum,
        description: tierForm.description
      })
      .eq("key", editingTierKey);

    if (error) {
      console.error("Error updating card tier on Supabase:", error);
      triggerToast("Erreur lors de la modification sur Supabase");
      return;
    }

    // Update in local state
    setCardTiers(prev => prev.map(t => t.key === editingTierKey ? {
      ...t,
      price: priceNum,
      duration: durationNum,
      description: tierForm.description
    } : t));

    triggerToast(`Tarif de la carte ${editingTierKey} mis à jour !`);
    setEditingTierKey(null);
    setTierForm({ price: "", duration: "", description: "" });
  };
  
  // Modal State for adding/modifying staff member
  const [showModal, setShowModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  
  // Staff form fields
  const [form, setForm] = useState({ nom: "", role: "Coach", tel: "", salaire: "" });
  const [customRoleActive, setCustomRoleActive] = useState(false);
  const [giveAccess, setGiveAccess] = useState(false);
  const [accessUsername, setAccessUsername] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  
  // User Accounts forms
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "Secretaire", label: "" });
  const [editingUserId, setEditingUserId] = useState(null);

  // --- STAFF ACTIONS ---
  const startAddStaff = () => {
    setForm({ nom: "", role: "Coach", tel: "", salaire: "" });
    setCustomRoleActive(false);
    setGiveAccess(false);
    setAccessUsername("");
    setAccessPassword("");
    setEditingStaffId(null);
    setShowModal(true);
  };

  const startEditStaff = (s) => {
    const userAccount = users.find(u => u.id === s.id);
    const isCustom = s.role && !ROLES.includes(s.role);
    setForm({ nom: s.nom, role: s.role, tel: s.tel || "", salaire: s.salaire });
    setCustomRoleActive(isCustom);
    setEditingStaffId(s.id);

    if (userAccount) {
      setGiveAccess(true);
      setAccessUsername(userAccount.username);
      setAccessPassword(userAccount.password);
    } else {
      setGiveAccess(false);
      setAccessUsername("");
      setAccessPassword("");
    }
    setShowModal(true);
  };

  const saveStaff = async () => {
    if (!form.nom.trim() || !form.salaire) {
      triggerToast("Le nom et le salaire sont obligatoires");
      return;
    }

    if (giveAccess && (!accessUsername.trim() || !accessPassword.trim())) {
      triggerToast("Veuillez saisir un identifiant et un mot de passe pour l'accès de connexion");
      return;
    }

    // Check username duplicates if access is requested
    if (giveAccess) {
      const exists = users.some(u => u.username.toLowerCase() === accessUsername.toLowerCase() && u.id !== (editingStaffId || ""));
      if (exists) {
        triggerToast("Cet identifiant de connexion est déjà utilisé");
        return;
      }
    }

    let staffId = editingStaffId;
    
    if (editingStaffId) {
      // Modify existing staff member
      const updatedStaff = { nom: form.nom, role: form.role, tel: form.tel, salaire: Number(form.salaire) };
      const { error } = await supabase.from("staff").update(updatedStaff).eq("id", editingStaffId);
      if (error) {
        triggerToast("Erreur lors de la modification sur Supabase");
        console.error(error);
        return;
      }
      setStaff(prev => prev.map(s => s.id === editingStaffId ? { ...s, ...updatedStaff } : s));
      triggerToast(`Profil de ${form.nom} mis à jour !`);
    } else {
      // Create new staff member
      staffId = uid();
      const newStaff = {
        id: staffId,
        nom: form.nom,
        role: form.role,
        tel: form.tel,
        salaire: Number(form.salaire),
      };
      const { error } = await supabase.from("staff").insert([newStaff]);
      if (error) {
        triggerToast("Erreur lors de la création sur Supabase");
        console.error(error);
        return;
      }
      setStaff([...staff, newStaff]);
      triggerToast(`Employé ${form.nom} inscrit avec succès.`);
    }

    // Dynamic Access Login management linked directly inside Staff form
    if (giveAccess) {
      let targetRole = "Secretaire";
      if (form.role === "Comptable") targetRole = "Comptable";
      if (form.role === "Secretaire") targetRole = "Secretaire";
      
      const userObj = {
        id: staffId,
        username: accessUsername,
        password: accessPassword,
        role: targetRole,
        label: form.nom
      };
      
      const { error } = await supabase.from("users").upsert([userObj]);
      if (error) {
        console.error("Failed to upsert user on Supabase:", error);
      } else {
        setUsers(prev => {
          const otherUsers = prev.filter(u => u.id !== staffId);
          return [...otherUsers, userObj];
        });
        triggerToast(`Accès de connexion (${accessUsername}) configuré pour ${form.nom}`);
      }
    } else {
      const { error } = await supabase.from("users").delete().eq("id", staffId);
      if (error) {
        console.error("Failed to delete user on Supabase:", error);
      } else {
        setUsers(prev => prev.filter(u => u.id !== staffId));
      }
    }

    // Reset Form & Close Modal
    setForm({ nom: "", role: "Coach", tel: "", salaire: "" });
    setCustomRoleActive(false);
    setGiveAccess(false);
    setAccessUsername("");
    setAccessPassword("");
    setEditingStaffId(null);
    setShowModal(false);
  };

  const removeStaff = async (id) => {
    if (confirm("Voulez-vous supprimer cet employé ? (Cela supprimera aussi son compte d'accès)")) {
      const { error: staffErr } = await supabase.from("staff").delete().eq("id", id);
      const { error: userErr } = await supabase.from("users").delete().eq("id", id);
      if (staffErr || userErr) {
        triggerToast("Erreur lors de la suppression sur Supabase");
        console.error({ staffErr, userErr });
        return;
      }
      setStaff(staff.filter(s => s.id !== id));
      setUsers(users.filter(u => u.id !== id));
      triggerToast("Employé supprimé et accès de connexion supprimé");
    }
  };

  const payOne = async (s) => {
    const currentMonth = today().slice(0, 7);
    const isPaid = tx.some(t => t.type === "salaire" && t.staffId === s.id && t.date.slice(0, 7) === currentMonth);
    
    if (isPaid) {
      triggerToast(`Salaire de ${s.nom} déjà versé pour ce mois.`);
      return;
    }

    const newTx = {
      id: uid(),
      type: "salaire",
      description: `Salaire - ${s.nom} (${s.role}) - ${currentMonth}`,
      montant: Number(s.salaire),
      date: today(),
      staffId: s.id
    };

    const { error } = await supabase.from("tx").insert([newTx]);
    if (error) {
      triggerToast("Erreur lors du versement sur Supabase");
      console.error(error);
      return;
    }

    setTx(prev => [...prev, newTx]);
    triggerToast(`Salaire versé pour ${s.nom} (${fmt(s.salaire)} F)`);
  };

  // --- USER ACCOUNTS ACTIONS ---
  const saveUserAccount = async () => {
    if (!userForm.username.trim() || !userForm.password.trim() || !userForm.label.trim()) {
      triggerToast("Tous les champs du compte utilisateur sont obligatoires");
      return;
    }

    const exists = users.some(u => u.username.toLowerCase() === userForm.username.toLowerCase() && u.id !== editingUserId);
    if (exists) {
      triggerToast("Ce nom d'utilisateur est déjà utilisé");
      return;
    }

    if (editingUserId) {
      const updatedUser = { username: userForm.username, password: userForm.password, role: userForm.role, label: userForm.label };
      const { error } = await supabase.from("users").update(updatedUser).eq("id", editingUserId);
      if (error) {
        triggerToast("Erreur lors de la modification du compte sur Supabase");
        console.error(error);
        return;
      }
      setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...updatedUser } : u));
      triggerToast(`Compte de ${userForm.label} modifié avec succès`);
      setEditingUserId(null);
    } else {
      const newUserId = uid();
      const newUserObj = {
        id: newUserId,
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        label: userForm.label
      };
      const { error } = await supabase.from("users").insert([newUserObj]);
      if (error) {
        triggerToast("Erreur lors de la création du compte sur Supabase");
        console.error(error);
        return;
      }
      setUsers([...users, newUserObj]);
      triggerToast(`Nouveau compte ${userForm.label} créé !`);
    }
    setUserForm({ username: "", password: "", role: "Secretaire", label: "" });
  };

  const startEditUser = (u) => {
    setUserForm({ username: u.username, password: u.password, role: u.role, label: u.label });
    setEditingUserId(u.id);
  };

  const removeUserAccount = async (id) => {
    if (currentUser && currentUser.id === id) {
      triggerToast("Vous ne pouvez pas supprimer votre propre compte actif !");
      return;
    }
    if (confirm("Voulez-vous supprimer ce compte de connexion ?")) {
      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) {
        triggerToast("Erreur lors de la suppression du compte sur Supabase");
        console.error(error);
        return;
      }
      setUsers(users.filter(u => u.id !== id));
      triggerToast("Compte utilisateur supprimé");
    }
  };

  const currentMonth = today().slice(0, 7);

  return (
    <div>
      <h1 style={S.pageTitle}>Gestion du Personnel & Comptes</h1>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }}>Inscrivez et modifiez les salariés, et gérez les comptes d'accès avec leurs niveaux de droits.</p>

      {/* Sub tabs selector visible for Administrator */}
      {isAdmin && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: 12, marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setSubTab("staff")}
              style={{
                background: subTab === "staff" ? "#EEF2F6" : "transparent",
                border: subTab === "staff" ? "1px solid #6366F1" : "1px solid transparent",
                color: subTab === "staff" ? "#6366F1" : "#475569",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600
              }}
            >
              📋 Effectif du Personnel ({staff.length})
            </button>
            <button
              onClick={() => setSubTab("users")}
              style={{
                background: subTab === "users" ? "#EEF2F6" : "transparent",
                border: subTab === "users" ? "1px solid #6366F1" : "1px solid transparent",
                color: subTab === "users" ? "#6366F1" : "#475569",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600
              }}
            >
              🔒 Comptes Utilisateurs & Niveaux ({users.length})
            </button>
            <button
              onClick={() => setSubTab("tarifs")}
              style={{
                background: subTab === "tarifs" ? "#EEF2F6" : "transparent",
                border: subTab === "tarifs" ? "1px solid #6366F1" : "1px solid transparent",
                color: subTab === "tarifs" ? "#6366F1" : "#475569",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600
              }}
            >
              💳 Tarifs des Cartes ({cardTiers.length})
            </button>
          </div>

          {subTab === "staff" && (
            <button className="btn-glow" style={{ ...S.btnPrimary, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13 }} onClick={startAddStaff}>
              <span>➕</span> Ajouter un employé
            </button>
          )}
        </div>
      )}

      {/* --- STAFF SECTION VIEW --- */}
      {(!isAdmin || subTab === "staff") && (
        <>
          {/* Form Modal popup for adding and editing staff members */}
          {showModal && isAdmin && (
            <div style={S.guideOverlay}>
              <div style={{ ...S.guideCard, maxWidth: 580 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #E2E8F0", paddingBottom: 12 }}>
                  <h2 className="disp" style={{ color: "#0F172A", fontSize: 20 }}>
                    {editingStaffId ? "📝 Modifier les informations de l'employé" : "👤 Inscrire un nouvel employé"}
                  </h2>
                  <button style={{ background: "transparent", border: "none", color: "#94A3B8", fontSize: 22 }} onClick={() => setShowModal(false)}>&times;</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={S.labelStyle}>Nom Complet</label>
                    <input style={S.input} placeholder="Ex: Assetou Coulibaly" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                  </div>
                  
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px" }}>
                      <label style={S.labelStyle}>Poste / Rôle</label>
                      {!customRoleActive ? (
                        <select
                          style={S.input}
                          value={form.role}
                          onChange={e => {
                            if (e.target.value === "Autre") {
                              setCustomRoleActive(true);
                              setForm({ ...form, role: "" });
                            } else {
                              setForm({ ...form, role: e.target.value });
                            }
                          }}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                          <option value="Autre">✍️ Autre (Saisir...)</option>
                        </select>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            style={{ ...S.input, flex: 1 }}
                            placeholder="Saisir le poste..."
                            value={form.role}
                            onChange={e => setForm({ ...form, role: e.target.value })}
                          />
                          <button
                            type="button"
                            style={{ ...S.btnCancel, padding: "0 10px", height: 38 }}
                            onClick={() => {
                              setCustomRoleActive(false);
                              setForm({ ...form, role: "Coach" });
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: "1 1 200px" }}>
                      <label style={S.labelStyle}>Téléphone</label>
                      <input style={S.input} placeholder="Ex: 01 02 03 04 05" value={form.tel} onChange={e => setForm({ ...form, tel: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label style={S.labelStyle}>Salaire Mensuel (F CFA)</label>
                    <input style={S.input} type="number" placeholder="Salaire" value={form.salaire} onChange={e => setForm({ ...form, salaire: e.target.value })} />
                  </div>

                  {/* Direct access credentials inside modal */}
                  <div style={{ padding: 14, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", color: "#0F172A", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={giveAccess}
                        onChange={e => setGiveAccess(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "#6366F1" }}
                      />
                      Donner un accès direct de connexion (Login / Mot de passe)
                    </label>
                    
                    {giveAccess && (
                      <div style={{ ...S.formRow, marginTop: 14 }}>
                        <div style={{ flex: "1 1 200px" }}>
                          <label style={S.labelStyle}>Identifiant (Login)</label>
                          <input style={S.input} placeholder="Ex: assetou_c" value={accessUsername} onChange={e => setAccessUsername(e.target.value)} />
                        </div>
                        <div style={{ flex: "1 1 200px" }}>
                          <label style={S.labelStyle}>Mot de passe</label>
                          <input style={S.input} placeholder="Mot de passe" value={accessPassword} onChange={e => setAccessPassword(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
                    <button style={S.btnCancel} onClick={() => setShowModal(false)}>
                      Annuler
                    </button>
                    <button className="btn-glow" style={S.btnPrimary} onClick={saveStaff}>
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <CardPanel title={`Registre de l'effectif (${staff.length})`}>
            {staff.length === 0 ? (
              <div style={S.empty}>Aucun membre de personnel répertorié.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {staff.map(s => {
                  const isPaid = tx.some(t => t.type === "salaire" && t.staffId === s.id && t.date.slice(0, 7) === currentMonth);
                  // Check active login access
                  const userAccount = users.find(u => u.id === s.id);
                  
                  return (
                    <div key={s.id} style={S.staffCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>{s.nom}</div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{s.tel || "Sans numéro"}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <span style={{ ...S.tag, background: "#E0F2FE", color: "#0284C7" }}>{s.role}</span>
                          {userAccount ? (
                            <span style={{ ...S.tag, fontSize: 9, background: "#D1FAE5", color: "#059669" }} title={`Login: ${userAccount.username}`}>🔑 {userAccount.username}</span>
                          ) : (
                            <span style={{ ...S.tag, fontSize: 9, background: "#F1F5F9", color: "#64748B" }}>PAS D'ACCÈS</span>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 12.5, color: "#475569" }}>
                          Salaire : <span className="mono" style={{ color: "#0F172A", fontWeight: 700 }}>{fmt(s.salaire)} F</span>
                        </div>
                        {isPaid ? (
                          <span style={{ ...S.tag, background: "#D1FAE5", color: "#059669" }}>PAYÉ</span>
                        ) : (
                          <span style={{ ...S.tag, background: "#FEE2E2", color: "#EF4444" }}>EN ATTENTE</span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        {/* Only super admin pays wages */}
                        {isAdmin && (
                          <button
                            className="btn-secondary"
                            style={{
                              ...S.btnPay,
                              background: isPaid ? "#F1F5F9" : "#ECFDF5",
                              color: isPaid ? "#94A3B8" : "#059669",
                              cursor: isPaid ? "not-allowed" : "pointer",
                              border: isPaid ? "1px solid #E2E8F0" : "1px solid #A7F3D0"
                            }}
                            onClick={() => payOne(s)}
                            disabled={isPaid}
                          >
                            Payer le salaire
                          </button>
                        )}
                        
                        {/* Admin can edit/delete employees */}
                        {isAdmin && (
                          <>
                            <button
                              className="btn-secondary"
                              style={{ ...S.btnPay, background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#334155" }}
                              onClick={() => startEditStaff(s)}
                            >
                              Modifier
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ ...S.btnDangerGhost, padding: "6px 10px" }}
                              onClick={() => removeStaff(s.id)}
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardPanel>
        </>
      )}

      {/* --- ACCOUNT LEVELS SECTION VIEW (ADMIN ONLY) --- */}
      {isAdmin && subTab === "users" && (
        <>
          {/* Create & Edit Login Account Form */}
          <CardPanel title={editingUserId ? "📝 Modifier un compte utilisateur" : "🔑 Créer un nouveau compte & niveau d'accès"}>
            <div style={S.formRow}>
              <div style={{ flex: "1 1 180px" }}>
                <label style={S.labelStyle}>Nom d'Affichage (Label)</label>
                <input style={S.input} placeholder="Ex: Secrétaire Jour" value={userForm.label} onChange={e => setUserForm({ ...userForm, label: e.target.value })} />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={S.labelStyle}>Identifiant (Login)</label>
                <input style={S.input} placeholder="Ex: sec_jour" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={S.labelStyle}>Mot de passe</label>
                <input style={S.input} type="text" placeholder="Entrez le mot de passe" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={S.labelStyle}>Niveau de droits / Rôle</label>
                <select style={S.input} value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                  {LEVEL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <button className="btn-glow" style={{ ...S.btnPrimary, height: 38 }} onClick={saveUserAccount}>
                  {editingUserId ? "Enregistrer" : "Créer le compte"}
                </button>
                {editingUserId && (
                  <button style={S.btnCancel} onClick={() => {
                    setUserForm({ username: "", password: "", role: "Secretaire", label: "" });
                    setEditingUserId(null);
                  }}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </CardPanel>

          {/* Accounts List Table */}
          <CardPanel title="Registre des comptes & droits d'accès configurés">
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Utilisateur (Label)</th>
                    <th style={S.th}>Identifiant</th>
                    <th style={S.th}>Mot de passe</th>
                    <th style={S.th}>Niveau / Droits</th>
                    <th style={{ ...S.th, textAlign: "right", width: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={S.tr}>
                      <td style={{ ...S.td, fontWeight: 600, color: "#0F172A" }}>{u.label}</td>
                      <td className="mono" style={{ ...S.td, color: "#334155" }}>{u.username}</td>
                      <td className="mono" style={{ ...S.td, color: "#334155" }}>{u.password}</td>
                      <td style={S.td}>
                        <span style={{
                          ...S.tag,
                          background: u.role === "Administrateur" ? "#F5F3FF" : u.role === "Comptable" ? "#FEF3C7" : "#E0F2FE",
                          color: u.role === "Administrateur" ? "#6366F1" : u.role === "Comptable" ? "#D97706" : "#0284C7"
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ ...S.td, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn-secondary"
                            style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#334155", padding: "4px 10px", fontSize: 12, borderRadius: 6 }}
                            onClick={() => startEditUser(u)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ ...S.btnDangerGhost, padding: "4px 10px", fontSize: 12, borderRadius: 6 }}
                            onClick={() => removeUserAccount(u.id)}
                            disabled={currentUser && currentUser.id === u.id}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardPanel>
        </>
      )}

      {/* --- CARD TIERS PRICES SECTION VIEW (ADMIN ONLY) --- */}
      {isAdmin && subTab === "tarifs" && (
        <>
          {/* Edit Card Tier Form */}
          {editingTierKey && (
            <CardPanel title={`📝 Modifier les tarifs de la carte : ${editingTierKey}`}>
              <div style={S.formRow}>
                <div style={{ flex: "1 1 150px" }}>
                  <label style={S.labelStyle}>Prix de l'Abonnement (F CFA)</label>
                  <input
                    style={S.input}
                    type="number"
                    placeholder="Prix"
                    value={tierForm.price}
                    onChange={e => setTierForm({ ...tierForm, price: e.target.value })}
                  />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <label style={S.labelStyle}>Durée (mois)</label>
                  <input
                    style={S.input}
                    type="number"
                    placeholder="Durée en mois"
                    value={tierForm.duration}
                    onChange={e => setTierForm({ ...tierForm, duration: e.target.value })}
                  />
                </div>
                <div style={{ flex: "1 1 300px" }}>
                  <label style={S.labelStyle}>Description / Détails de l'offre</label>
                  <input
                    style={S.input}
                    placeholder="Description des prestations incluses..."
                    value={tierForm.description}
                    onChange={e => setTierForm({ ...tierForm, description: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <button className="btn-glow" style={{ ...S.btnPrimary, height: 38 }} onClick={saveCardTier}>
                    Enregistrer
                  </button>
                  <button
                    style={S.btnCancel}
                    onClick={() => {
                      setEditingTierKey(null);
                      setTierForm({ price: "", duration: "", description: "" });
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </CardPanel>
          )}

          {/* Card Tiers List Table */}
          <CardPanel title="Tarifs en vigueur pour les abonnements">
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Type de Carte</th>
                    <th style={S.th}>Prix Actuel</th>
                    <th style={S.th}>Durée (mois)</th>
                    <th style={S.th}>Description des services</th>
                    <th style={{ ...S.th, textAlign: "right", width: 150 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cardTiers.map(c => (
                    <tr key={c.key} style={S.tr}>
                      <td style={{ ...S.td, fontWeight: 600, color: c.color }}>{c.key}</td>
                      <td className="mono" style={{ ...S.td, fontWeight: 700, color: "#0F172A" }}>
                        {fmt(c.price)} F
                      </td>
                      <td className="mono" style={{ ...S.td, color: "#334155" }}>{c.duration}</td>
                      <td style={{ ...S.td, fontSize: 13, color: "#475569" }}>{c.description}</td>
                      <td style={{ ...S.td, textAlign: "right" }}>
                        <button
                          className="btn-secondary"
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #CBD5E1",
                            color: "#334155",
                            padding: "4px 10px",
                            fontSize: 12,
                            borderRadius: 6
                          }}
                          onClick={() => startEditTier(c)}
                        >
                          Modifier le prix
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardPanel>
        </>
      )}
    </div>
  );
}

// ==========================================
// STYLING ARCHITECTURE (PREMIUM BRIGHT SLATE THEME)
// ==========================================
const S = {
  app: {
    display: "flex",
    minHeight: "100vh",
    background: "#F8FAFC", // Clean bright slate-50
    color: "#334155", // Charcoal-600
    overflow: "hidden",
  },
  sidebar: {
    width: 260,
    background: "#FFFFFF", // Light theme sidebar
    borderRight: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    padding: "28px 0 28px 20px",
    flexShrink: 0,
  },
  brand: {
    marginBottom: 20,
    paddingRight: 20,
  },
  brandTitle: {
    fontSize: 26,
    color: "#0F172A",
    fontWeight: 800,
  },
  brandSub: {
    fontSize: 9.5,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
    fontWeight: 600,
  },
  sidebarProfile: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "10px 14px",
    marginBottom: 12,
    marginRight: 20,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#6366F1",
    color: "#FFF",
    fontWeight: 800,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
  },
  sideFooter: {
    borderTop: "1px solid #E2E8F0",
    paddingTop: 20,
    paddingRight: 20,
  },
  soldeLabel: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    fontWeight: 600,
  },
  soldeVal: {
    fontSize: 22,
    fontWeight: 800,
  },
  main: {
    flex: 1,
    padding: "36px 44px",
    overflowY: "auto",
    maxHeight: "100vh",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 30,
    color: "#0F172A", // Dark Slate header
    fontWeight: 800,
  },
  toast: {
    display: "flex",
    alignItems: "center",
    padding: "12px 18px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 600,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: "18px 22px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 600,
  },
  statVal: {
    fontSize: 26,
    fontWeight: 800,
    margin: "6px 0",
    letterSpacing: "-0.01em",
    color: "#0F172A",
  },
  statSub: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: 500,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 24,
    marginBottom: 24,
  },
  cardPanel: {
    background: "#FFFFFF", // Clean pure white panel card
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 4px 18px rgba(0, 0, 0, 0.02)",
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottom: "1px solid #F1F5F9",
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: 700,
  },
  formRow: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  labelStyle: {
    display: "block",
    fontSize: 11.5,
    color: "#475569",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.6,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13.5,
    background: "#FFFFFF",
    color: "#0F172A",
    transition: "all 0.2s ease",
  },
  btnPrimary: {
    background: "#6366F1", // Modern bright violet accent
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    padding: "10px 22px",
    fontSize: 13.5,
    fontWeight: 700,
    boxShadow: "0 4px 14px rgba(99,102,241,0.25)",
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid #6366F1",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 12.5,
    color: "#6366F1",
  },
  btnFilter: {
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    padding: "7px 16px",
    fontSize: 13,
    color: "#475569",
    fontWeight: 500,
  },
  btnFilterActive: {
    background: "#EEF2F6",
    border: "1px solid #6366F1",
    color: "#6366F1",
    fontWeight: 600,
  },
  listRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #F1F5F9",
    fontSize: 13.5,
  },
  empty: {
    color: "#94A3B8",
    fontSize: 13.5,
    textAlign: "center",
    padding: "24px 0",
  },
  tag: {
    fontSize: 10.5,
    padding: "4px 10px",
    borderRadius: 6,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  memberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 20,
    marginTop: 20,
  },
  memberOuter: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 4px 15px rgba(0,0,0,0.01)",
  },
  loyaltyCard: {
    height: 190,
    borderRadius: 14,
    padding: 22,
    margin: 12,
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    position: "relative",
    overflow: "hidden",
  },
  cardGlassOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.05) 100%)",
    zIndex: 1,
    pointerEvents: "none",
  },
  emvChip: {
    width: 32,
    height: 25,
    borderRadius: 6,
    background: "linear-gradient(135deg, #ECC94B, #D69E2E)",
    border: "1px solid rgba(255,255,255,0.3)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
  },
  cardBarcode: {
    display: "flex",
    gap: 1.5,
    height: 20,
    alignItems: "stretch",
  },
  memberMeta: {
    padding: "4px 18px 18px 18px",
  },
  btnDangerGhost: {
    background: "transparent",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    color: "#EF4444",
    fontWeight: 500,
  },
  weeklyGrid: {
    display: "flex",
    gap: 14,
    overflowX: "auto",
    paddingBottom: 10,
  },
  weeklyCol: {
    flex: "1 0 160px",
    minWidth: 160,
    background: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    border: "1px solid #E2E8F0",
  },
  weeklyColHeader: {
    textAlign: "center",
    fontWeight: 700,
    color: "#6366F1",
    fontSize: 13,
    paddingBottom: 8,
    borderBottom: "1px solid #E2E8F0",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  courseCard: {
    borderRadius: 10,
    padding: "10px 12px",
    position: "relative",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  courseDelete: {
    position: "absolute",
    top: 5,
    right: 5,
    background: "rgba(0,0,0,0.15)",
    border: "none",
    color: "#FFF",
    borderRadius: "50%",
    width: 14,
    height: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: "bold",
  },
  printerSlot: {
    borderTop: "3px solid #0F172A",
    borderRadius: "4px 4px 0 0",
    paddingTop: 14,
    background: "#F1F5F9",
    minHeight: 180,
  },
  spinner: {
    width: 24,
    height: 24,
    border: "3px solid #E2E8F0",
    borderTop: "3px solid #6366F1",
    borderRadius: "50%",
    animation: "slideInUp 0.6s linear infinite",
  },
  ticketPaper: {
    background: "#FAF9F5",
    color: "#111",
    padding: "18px",
    width: "100%",
    maxWidth: 260,
    margin: "0 auto",
    boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    border: "1px solid #E2E2DC",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13.5,
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#64748B",
    borderBottom: "1px solid #E2E8F0",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    borderBottom: "1px solid #F1F5F9",
    transition: "background 0.2s ease",
  },
  td: {
    padding: "12px 10px",
    color: "#334155",
  },
  btnDangerIcon: {
    background: "transparent",
    border: "none",
    color: "#EF4444",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
  },
  staffCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
  },
  btnPay: {
    flex: 1,
    borderRadius: 6,
    padding: "7px 12px",
    fontSize: 12.5,
    fontWeight: 600,
  },
  
  // ==========================================
  // LANDING PAGE CUSTOM STYLES (BRIGHT METALLIC)
  // ==========================================
  landingWrapper: {
    minHeight: "100vh",
    width: "100%",
    background: "#F8FAFC",
    color: "#334155",
    overflowY: "auto",
  },
  landingHeader: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(248, 250, 252, 0.85)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #E2E8F0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 40px",
  },
  landingNavLink: {
    color: "#475569",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    transition: "color 0.2s ease",
    ":hover": {
      color: "#6366F1"
    }
  },
  landingCta: {
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid #6366F1",
    color: "#6366F1",
    padding: "8px 18px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 700,
  },
  heroSection: {
    position: "relative",
    padding: "120px 40px 100px 40px",
    textAlign: "center",
    minHeight: "75vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "1px solid #E2E8F0",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at center, rgba(99, 102, 241, 0.04) 0%, rgba(248, 250, 252, 0) 70%)",
    pointerEvents: "none",
  },
  heroContent: {
    maxWidth: 800,
    position: "relative",
    zIndex: 2,
  },
  heroBadge: {
    display: "inline-block",
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    color: "#6366F1",
    padding: "8px 18px",
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: "52px",
    lineHeight: 1.15,
    fontWeight: 800,
    color: "#0F172A",
    marginBottom: 24,
  },
  heroSubtitle: {
    fontSize: 16.5,
    lineHeight: 1.6,
    color: "#475569",
    marginBottom: 32,
    fontWeight: 400,
  },
  heroBtnPrimary: {
    background: "#6366F1",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    padding: "14px 28px",
    fontSize: 14.5,
    fontWeight: 700,
    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.2)",
  },
  heroBtnSecondary: {
    background: "transparent",
    border: "1px solid #CBD5E1",
    color: "#334155",
    borderRadius: 10,
    padding: "14px 28px",
    fontSize: 14.5,
    fontWeight: 600,
  },
  featCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
  },
  featIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "rgba(99, 102, 241, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  pricingCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
    position: "relative",
    overflow: "hidden",
  },
  coachProfileCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 24,
    width: 280,
    textAlign: "center",
  },
  coachAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "#6366F1",
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
  },
  landingFooter: {
    background: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    padding: "48px 40px 24px 40px",
    marginTop: 80,
  },
  
  // ==========================================
  // LOGIN CUSTOM STYLES (CLEAN COLD SLATE)
  // ==========================================
  loginBg: {
    minHeight: "100vh",
    width: "100%",
    background: "#F8FAFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    padding: 24,
  },
  loginOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at center, rgba(99, 102, 241, 0.05) 0%, rgba(248, 250, 252, 0) 80%)",
    pointerEvents: "none",
  },
  loginCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: 32,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
    position: "relative",
    zIndex: 2,
  },
  loginInput: {
    width: "100%",
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 14,
    background: "#FFFFFF",
    color: "#0f172a",
    marginTop: 6,
  },
  btnCancel: {
    background: "transparent",
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 13.5,
    color: "#475569",
    fontWeight: 600,
  },
  loginHint: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: 14,
    fontSize: 12.5,
    color: "#475569",
    marginTop: 24,
    lineHeight: 1.6,
  },

  // ==========================================
  // GUIDE MODAL CUSTOM STYLES
  // ==========================================
  guideOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 11000,
    padding: 20,
  },
  guideCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: 30,
    width: "100%",
    maxWidth: 780,
    boxShadow: "0 20px 48px rgba(0,0,0,0.1)",
  },
  guideText: {
    fontSize: 14.5,
    color: "#334155",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  guideList: {
    paddingLeft: 20,
    marginBottom: 16,
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.7,
  },
};
