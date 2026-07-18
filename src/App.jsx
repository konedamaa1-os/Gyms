import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Utilities
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");

const CARD_TIERS = [
  { key: "Bronze", color: "#C25E28", light: "rgba(224, 144, 102, 0.15)", bg: "linear-gradient(135deg, #FFF9F5 0%, #F3D9C9 50%, #C25E28 100%)", price: 15000, duration: 1, desc: "Accès standard aux équipements de musculation & cardio." },
  { key: "Argent", color: "#475569", light: "rgba(71, 85, 105, 0.15)", bg: "linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 50%, #64748B 100%)", price: 40000, duration: 3, desc: "Accès complet + cours collectifs inclus + 1 séance coach / mois." },
  { key: "Or", color: "#859F10", light: "rgba(133, 159, 16, 0.15)", bg: "linear-gradient(135deg, #FCFFE6 0%, #E6F3A8 50%, #859F10 100%)", price: 150000, duration: 12, desc: "Espace VIP + cours illimités + suivi diététique + coach privé 24/7." },
];

const ROLES = ["Coach", "Secretaire", "Comptable", "Gardien", "Agent d'entretien"];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LEVEL_ROLES = ["Administrateur", "Secretaire", "Comptable"];

// Default seeds matching employee IDs
const USERS_SEED = [
  { id: "usr-admin", username: "admin", password: "admin123", role: "Administrateur", label: "Super Admin" }
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
  const [view, setView] = useState("public"); // "public" | "login" | "dashboard"
  const [user, setUser] = useState(null); // Currently logged-in user: { username, role, label }
  const [tab, setTab] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [tx, setTx] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]); // Dynamic Login Accounts (levels) State
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
          { data: usersData, error: usersErr }
        ] = await Promise.all([
          supabase.from("members").select("*"),
          supabase.from("staff").select("*"),
          supabase.from("schedule").select("*"),
          supabase.from("tx").select("*"),
          supabase.from("tickets").select("*"),
          supabase.from("users").select("*")
        ]);

        if (membersErr) console.error("Error loading members:", membersErr);
        if (staffErr) console.error("Error loading staff:", staffErr);
        if (scheduleErr) console.error("Error loading schedule:", scheduleErr);
        if (txErr) console.error("Error loading tx:", txErr);
        if (ticketsErr) console.error("Error loading tickets:", ticketsErr);
        if (usersErr) console.error("Error loading users:", usersErr);

        setMembers(membersData || []);
        setStaff(staffData || []);
        setSchedule(scheduleData || []);
        setTx(txData || []);
        setTickets(ticketsData || []);
        setUsers(usersData && usersData.length > 0 ? usersData : USERS_SEED);
      } catch (err) {
        console.error("Failed to load from Supabase:", err);
        setMembers([]);
        setStaff([]);
        setSchedule([]);
        setTx([]);
        setTickets([]);
        setUsers(USERS_SEED);
      }
      setView("public");
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
    { key: "planning", label: "Emploi du temps", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> },
    { key: "accueil", label: "Accueil / Tickets", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"></path><line x1="12" y1="5" x2="12" y2="19"></line></svg> },
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
      return TABS.filter(t => t.key === "membres" || t.key === "accueil" || t.key === "planning");
    }
    if (user.role === "Comptable") {
      return TABS.filter(t => t.key === "finances" || t.key === "personnel");
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
    <div style={S.app}>
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
          color: #94A3B8;
          padding: 13px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          width: 100%;
          margin-bottom: 5px;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #FFF;
        }
        .tab-btn-active {
          background: #6366F1 !important;
          color: #FFFFFF !important;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
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
          .no-print { display: none !important; }
          .print-only {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            background: white;
            color: black;
            font-family: 'JetBrains Mono', monospace;
            padding: 8px;
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
        <PublicLanding setView={setView} schedule={schedule} />
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
          {/* Sidebar Navigation - Deep Dark Slate-800 for high quality split design */}
          <div style={S.sidebar} className="no-print">
            <div style={S.brand}>
              <div className="disp" style={S.brandTitle}>
                FORGE<span style={{ color: "#6366F1" }}>.</span>GYM
              </div>
              <div style={S.brandSub}>GESTION DE SALLE</div>
            </div>

            {/* Profile widget bar */}
            <div style={S.sidebarProfile}>
              <div style={S.profileAvatar}>{user.username.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#FFF" }}>{user.label}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{user.role}</div>
              </div>
            </div>

            {/* Quick Start Guide Button (Matches requested brown style) */}
            <button className="btn-brown-guide" onClick={() => setShowGuide(true)}>
              <span>🚀</span> Guide de démarrage
            </button>
            
            <nav style={S.nav}>
              {getFilteredTabs().map((tItem) => (
                <button
                  key={tItem.key}
                  onClick={() => setTab(tItem.key)}
                  className={`tab-btn ${tab === tItem.key ? "tab-btn-active" : ""}`}
                >
                  {tItem.icon}
                  {tItem.label}
                </button>
              ))}
            </nav>

            <button
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "#F43F5E",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                marginBottom: 16,
                fontWeight: 600
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Se déconnecter
            </button>
            
            <div style={S.sideFooter}>
              <div style={S.soldeLabel}>Solde de Caisse</div>
              <div className="mono" style={{ ...S.soldeVal, color: solde >= 0 ? "#10B981" : "#EF4444" }}>
                {fmt(solde)} F
              </div>
            </div>
          </div>

          {/* Main Panel Content */}
          <div style={S.main}>
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
              />
            )}
            
            {tab === "membres" && (
              <Membres
                members={members}
                setMembers={setMembers}
                setTx={setTx}
                triggerToast={triggerToast}
              />
            )}
            
            {tab === "planning" && (
              <Planning
                schedule={schedule}
                setSchedule={setSchedule}
                staff={staff}
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
          <p style={S.guideText}>Bienvenue sur <strong>FORGE.GYM</strong>, la plateforme SaaS d'élite pour la gestion de votre salle de sport à Abidjan.</p>
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
            <li>Si c'est un ticket visiteur d'une séance (ex: 1 500 F), laissez la case décochée et saisissez le montant.</li>
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
  return (
    <div style={S.loginBg}>
      <div style={S.loginOverlay} />
      <div style={S.loginCard}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="disp" style={{ fontSize: 32, color: "#0F172A" }}>FORGE<span style={{ color: "#6366F1" }}>.</span>GYM</div>
          <p style={{ color: "#64748B", fontSize: 13, marginTop: 6, textTransform: "uppercase", letterSpacing: 1 }}>ESPACE DE GESTION</p>
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
          
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button type="submit" className="btn-glow" style={{ ...S.btnPrimary, flex: 1, height: 42 }}>
              Se connecter
            </button>
            <button type="button" onClick={onCancel} style={{ ...S.btnCancel, flex: 1 }}>
              Annuler
            </button>
          </div>
        </form>

        {/* Demo Credentials Hint */}
        <div style={S.loginHint}>
          <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>Identifiants de Test (Niveaux) :</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {users.slice(0, 4).map(u => (
              <div key={u.id}>&bull; <strong>{u.label}</strong> ({u.role}) : <span className="mono">{u.username}</span> / <span className="mono">{u.password}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PUBLIC LANDING PAGE COMPONENT
// ==========================================
function PublicLanding({ setView, schedule }) {
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

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
          <div style={S.heroBadge}>CLUB DE FITNESS PREMIUM — ABIDJAN</div>
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
            <p style={{ color: "#475569", fontSize: 13.5, lineHeight: 1.5 }}>Profitez de l'accompagnement personnalisé de nos entraîneurs.</p>
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
            {CARD_TIERS.map(c => (
              <div key={c.key} style={S.pricingCard} className="card-glow">
                <div style={S.cardGlassOverlay} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <span className="disp" style={{ color: c.color, fontSize: 22 }}>{c.key}</span>
                  <div style={S.emvChip} />
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", minHeight: 60, lineHeight: 1.5 }}>{c.desc}</p>
                <div style={{ margin: "24px 0", borderBottom: "1px solid #E2E8F0" }} />
                <div style={{ marginBottom: 24 }}>
                  <span className="mono" style={{ fontSize: 36, fontWeight: 800, color: "#0F172A" }}>{fmt(c.price)} F</span>
                  <span style={{ fontSize: 13, color: "#64748B", marginLeft: 6 }}>/ {c.duration} mois</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30, fontSize: 13, color: "#334155" }}>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> Accès libre à la salle de sport</div>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> Vestiaire individuel sécurisé</div>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> {c.duration >= 3 ? "Cours collectifs illimités" : "Cours collectifs sur réservation"}</div>
                  <div style={{ display: "flex", gap: 8 }}><span style={{ color: c.color }}>✓</span> {c.duration >= 12 ? "Espace détente VIP & serviettes" : "Serviette non incluse"}</div>
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
        
        <div style={S.weeklyGrid}>
          {JOURS.map(j => {
            const dayCourses = schedule.filter(s => s.jour === j).sort((a, b) => a.debut.localeCompare(b.debut));
            return (
              <div key={j} style={S.weeklyCol}>
                <div style={S.weeklyColHeader}>{j}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayCourses.length === 0 ? (
                    <div style={{ color: "#94A3B8", fontSize: 11, textAlign: "center", fontStyle: "italic", padding: "12px 0" }}>Aucun cours</div>
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
      </section>

      {/* Public Coaches Section */}
      <section id="coaches" style={{ padding: "80px 40px", background: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, marginBottom: 12, color: "#0F172A" }}>Nos Coachs d'Élite</h2>
          <p style={{ color: "#475569", fontSize: 15, marginBottom: 48 }}>Nos entraîneurs sont là pour vous aider à repousser vos limites.</p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={S.coachProfileCard}>
              <div style={S.coachAvatarPlaceholder}>BT</div>
              <h3 style={{ color: "#0F172A", fontSize: 18, margin: "12px 0 4px 0" }}>Bakary Traoré</h3>
              <p style={{ color: "#6366F1", fontSize: 13, fontWeight: 600 }}>Coach Principal & Musculation</p>
              <p style={{ color: "#64748B", fontSize: 12, marginTop: 8 }}>Plus de 10 ans d'expérience dans le coaching en force et haltérophilie.</p>
            </div>
            <div style={S.coachProfileCard}>
              <div style={S.coachAvatarPlaceholder} style={{ ...S.coachAvatarPlaceholder, background: "#8B5CF6" }}>MK</div>
              <h3 style={{ color: "#0F172A", fontSize: 18, margin: "12px 0 4px 0" }}>Mariam Koné</h3>
              <p style={{ color: "#6366F1", fontSize: 13, fontWeight: 600 }}>Coach Cardio & HIIT</p>
              <p style={{ color: "#64748B", fontSize: 12, marginTop: 8 }}>Spécialiste de la perte de poids rapide et du renforcement cardio-vasculaire.</p>
            </div>
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
            <div>Zone 4, Rue du Canal, Abidjan, Côte d'Ivoire</div>
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
function Dashboard({ members, staff, revenuTotal, depenses, salairesVerses, ticketsAujourdhui, solde, tickets, tx, resetApp }) {
  const activeCoaches = staff.filter(s => s.role === "Coach").length;
  const [periodType, setPeriodType] = useState("jour"); // "jour" or "semaine"
  
  // Custom SVG Bar Chart Calculation
  const totalOutflow = depenses + salairesVerses;
  const maxValue = Math.max(revenuTotal, totalOutflow, 100000);
  const revHeight = (revenuTotal / maxValue) * 130;
  const expHeight = (totalOutflow / maxValue) * 130;

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

  return (
    <div>
      <div style={S.headerRow} className="no-print">
        <div>
          <h1 style={S.pageTitle}>Tableau de Bord</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Vue d'ensemble sur l'établissement (Accès Administrateur)</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={resetApp}
            className="btn-glow"
            style={{
              background: "#FEE2E2",
              border: "1px solid #FCA5A5",
              color: "#EF4444",
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            🗑️ Vider toutes les données
          </button>
          <div className="mono" style={{ fontSize: 13, color: "#64748B", background: "#EEF2F6", padding: "6px 12px", borderRadius: 8 }}>{today()}</div>
        </div>
      </div>
      
      {/* KPI Cards Grid */}
      <div style={S.kpiGrid} className="no-print">
        <StatKpi
          label="Membres Inscrits"
          value={members.length}
          accent="#6366F1"
          subtext={`${members.filter(m => getMemberStatus(m).label === "Actif").length} abonnements actifs`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>}
        />
        <StatKpi
          label="Personnel Actif"
          value={staff.length}
          accent="#0EA5E9"
          subtext={`${activeCoaches} coachs assignés`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>}
        />
        <StatKpi
          label="Passages du Jour"
          value={ticketsAujourdhui.length}
          accent="#F59E0B"
          subtext="Entrées enregistrées aujourd'hui"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
        />
        <StatKpi
          label="Solde de Caisse"
          value={fmt(solde) + " F"}
          accent={solde >= 0 ? "#10B981" : "#EF4444"}
          subtext="Balance comptable nette"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>}
        />
      </div>

      <div style={S.grid2} className="no-print">
        {/* SVG Interactive Chart Card */}
        <CardPanel title="Bilan Financier Global">
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
                {fmt(revenuTotal)} F
              </text>
              <text x="117.5" y="172" textAnchor="middle" fill="#475569" style={{ fontSize: 12, fontWeight: 500 }}>Revenus</text>
              
              {/* Expense bar */}
              <rect x="250" y={150 - expHeight} width="55" height={expHeight} rx="6" fill="url(#expGrad)" />
              <text x="277.5" y={140 - expHeight} textAnchor="middle" fill="#B91C1C" className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                {fmt(totalOutflow)} F
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
            {CARD_TIERS.map(c => {
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

      {/* Passage tracker lists */}
      <CardPanel title="Dernières Entrées de la Journée" className="no-print" style={{ marginTop: 24 }}>
        {ticketsAujourdhui.length === 0 ? (
          <div style={S.empty}>Aucun ticket émis aujourd'hui.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ticketsAujourdhui.slice(-5).reverse().map(t => (
              <div key={t.id} style={S.listRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <span className="mono" style={{ color: "#64748B", background: "#F1F5F9", padding: "4px 8px", borderRadius: 6, fontSize: 12, border: "1px solid #E2E8F0" }}>{t.heure}</span>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>{t.nom}</span>
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
  );
}

// ==========================================
// MEMBRES & LOYALTY CARDS VIEW
// ==========================================
function Membres({ members, setMembers, setTx, triggerToast }) {
  const [form, setForm] = useState({ nom: "", tel: "", carte: "Bronze", expiration: "" });
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("Tous");

  const add = async () => {
    if (!form.nom.trim()) {
      triggerToast("Le nom du membre est obligatoire");
      return;
    }
    
    const selectedTier = CARD_TIERS.find(c => c.key === form.carte);
    
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
      montant: selectedTier.price,
      date: today()
    };

    const { error: txError } = await supabase.from("tx").insert([newTx]);
    if (txError) {
      console.error("Failed to post tx to Supabase:", txError);
    } else {
      setTx(prev => [...prev, newTx]);
    }

    triggerToast(`Membre inscrit avec succès ! Carte ${form.carte} générée.`);
    setForm({ nom: "", tel: "", carte: "Bronze", expiration: "" });
  };

  const remove = async (id) => {
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
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }}>Émettez et filtrez les cartes de fidélité Bronze, Argent, et Or.</p>
      
      <CardPanel title="Nouvelle Inscription">
        <div style={S.formRow}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={S.labelStyle}>Nom Complet</label>
            <input style={S.input} placeholder="Ex: Jean Yao" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={S.labelStyle}>Téléphone</label>
            <input style={S.input} placeholder="Ex: 07 44 55 66 77" value={form.tel} onChange={e => setForm({ ...form, tel: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={S.labelStyle}>Niveau de Carte</label>
            <select style={S.input} value={form.carte} onChange={e => setForm({ ...form, carte: e.target.value })}>
              {CARD_TIERS.map(c => <option key={c.key} value={c.key}>{c.key} ({fmt(c.price)} F)</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 150px" }}>
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
        <div style={{ display: "flex", gap: 6 }}>
          {["Tous", "Bronze", "Argent", "Or"].map(tier => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              style={{
                ...S.btnFilter,
                ...(filterTier === tier ? S.btnFilterActive : {})
              }}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Members Directory Grid */}
      <div style={S.memberGrid}>
        {filteredMembers.length === 0 && <div style={{ color: "#64748B", padding: 30, textAlign: "center", width: "100%", border: "1px dashed #CBD5E1", borderRadius: 12 }}>Aucun membre répertorié.</div>}
        {filteredMembers.map(m => {
          const tier = CARD_TIERS.find(c => c.key === m.carte) || CARD_TIERS[0];
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
                  <span style={{ fontWeight: 700, color: tier.color, fontSize: 13.5 }}>Niveau {m.carte}</span>
                  <button className="btn-secondary" style={S.btnDangerGhost} onClick={() => remove(m.id)}>
                    Retirer le membre
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// WEEKLY SCHEDULE VIEW
// ==========================================
function Planning({ schedule, setSchedule, staff, triggerToast }) {
  const [form, setForm] = useState({ activite: "", coach: "", jour: "Lun", debut: "08:00", fin: "09:00" });

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
    setForm({ activite: "", coach: "", jour: form.jour, debut: "08:00", fin: "09:00" });
  };

  const remove = async (id) => {
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

  const coaches = staff.filter(s => s.role === "Coach");

  return (
    <div>
      <h1 style={S.pageTitle}>Emploi du Temps</h1>
      <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 24 }}>Planification des cours hebdomadaires et assignation des coachs.</p>
      
      <CardPanel title="Planifier un nouveau cours">
        <div style={S.formRow}>
          <div style={{ flex: "1 1 160px" }}>
            <label style={S.labelStyle}>Activité / Cours</label>
            <input style={S.input} placeholder="Ex: Boxe Cardio, Zumba..." value={form.activite} onChange={e => setForm({ ...form, activite: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={S.labelStyle}>Coach Assigné</label>
            <select style={S.input} value={form.coach} onChange={e => setForm({ ...form, coach: e.target.value })}>
              <option value="">Sélectionner un coach</option>
              {coaches.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 100px" }}>
            <label style={S.labelStyle}>Jour</label>
            <select style={S.input} value={form.jour} onChange={e => setForm({ ...form, jour: e.target.value })}>
              {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 80px" }}>
            <label style={S.labelStyle}>Début</label>
            <input style={S.input} type="time" value={form.debut} onChange={e => setForm({ ...form, debut: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 80px" }}>
            <label style={S.labelStyle}>Fin</label>
            <input style={S.input} type="time" value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn-glow" style={{ ...S.btnPrimary, height: 38 }} onClick={add}>Planifier</button>
          </div>
        </div>
      </CardPanel>

      <CardPanel title="Planning Hebdomadaire">
        <div style={S.weeklyGrid}>
          {JOURS.map(j => {
            const dayCourses = schedule.filter(s => s.jour === j).sort((a, b) => a.debut.localeCompare(b.debut));
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
                        <div key={c.id} style={{ ...S.courseCard, background: actBg }}>
                          <button style={S.courseDelete} onClick={() => remove(c.id)}>×</button>
                          <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#FFF" }}>
                            {c.debut} - {c.fin}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 6px 0", color: "#FFF", lineHeight: 1.25 }}>
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
      </CardPanel>
    </div>
  );
}

// ==========================================
// ACCUEIL / TICKETS (SECRETAIRE)
// ==========================================
function Accueil({ members, tickets, setTickets, setTx, triggerToast }) {
  const [name, setName] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [montant, setMontant] = useState(1500); // Walk-in default price
  const [lastTicket, setLastTicket] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleMemberSelect = (nom) => {
    setName(nom);
    const exists = members.some(m => m.nom.toLowerCase() === nom.toLowerCase());
    if (exists) {
      setIsMember(true);
      setMontant(0); // Member check-in is free
    } else {
      setIsMember(false);
      setMontant(1500);
    }
  };

  const issue = async () => {
    if (!name.trim()) {
      triggerToast("Entrez un nom pour émettre le ticket");
      return;
    }

    const price = isMember ? 0 : Number(montant);
    const newId = `T-${Math.random().toString(36).substring(3, 8).toUpperCase()}`;
    const t = {
      id: newId,
      nom: name,
      date: today(),
      heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      montant: price,
      isMember,
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
        description: `Ticket Entrée - ${name}`,
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
      setIsMember(false);
      setMontant(1500);
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
            
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", color: "#0F172A" }}>
                <input
                  type="checkbox"
                  checked={isMember}
                  onChange={e => {
                    setIsMember(e.target.checked);
                    if (e.target.checked) setMontant(0);
                    else setMontant(1500);
                  }}
                  style={{ width: 16, height: 16, accentColor: "#6366F1" }}
                />
                Client enregistré en tant que membre
              </label>
            </div>
            
            {!isMember && (
              <div>
                <label style={S.labelStyle}>Frais d'Entrée Unique (F CFA)</label>
                <input
                  style={S.input}
                  type="number"
                  placeholder="F CFA"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                />
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
                  <div style={{ fontSize: 10, color: "#444" }}>Zone 4, Rue du Canal, Abidjan</div>
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
                  <th style={S.th} style={{ textAlign: "right" }}>Frais payés</th>
                </tr>
              </thead>
              <tbody>
                {todayTickets.slice().reverse().map(t => (
                  <tr key={t.id} style={S.tr}>
                    <td style={S.td} className="mono" style={{ color: "#334155" }}>{t.id}</td>
                    <td style={S.td} className="mono" style={{ color: "#334155" }}>{t.heure}</td>
                    <td style={S.td} style={{ fontWeight: 600, color: "#0F172A" }}>{t.nom}</td>
                    <td style={S.td}>
                      <span style={{ ...S.tag, background: t.isMember ? "#D1FAE5" : "#E0F2FE", color: t.isMember ? "#059669" : "#0284C7" }}>
                        {t.isMember ? "Membre" : "Visiteur"}
                      </span>
                    </td>
                    <td style={S.td} className="mono" style={{ textAlign: "right", fontWeight: 700, color: "#0F172A" }}>{fmt(t.montant)} F</td>
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
            <div style={{ fontSize: 10 }}>Zone 4, Rue du Canal, Abidjan</div>
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

// ==========================================
// FINANCES (COMPTABLE)
// ==========================================
function Finances({ tx, setTx, tickets, staff, revenuTotal, depenses, salairesVerses, solde, triggerToast }) {
  const [form, setForm] = useState({ type: "recette", description: "", montant: "" });
  const [filterType, setFilterType] = useState("Tous");
  const [search, setSearch] = useState("");

  const add = async () => {
    if (!form.description.trim() || !form.montant) {
      triggerToast("Tous les champs sont requis");
      return;
    }
    
    const newTxObj = {
      id: uid(),
      type: form.type,
      description: form.description,
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
    setForm({ type: form.type, description: "", montant: "" });
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
              <select style={S.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="recette">Recette (+)</option>
                <option value="depense">Dépense (-)</option>
                <option value="salaire">Salaire (-)</option>
              </select>
            </div>
            <div>
              <label style={S.labelStyle}>Libellé explicatif</label>
              <input style={S.input} placeholder="Ex: Facture d'eau SODECI, Achat matériel..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label style={S.labelStyle}>Montant (F CFA)</label>
              <input style={S.input} type="number" placeholder="F CFA" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} />
            </div>
            <button className="btn-glow" style={{ ...S.btnPrimary, height: 38 }} onClick={add}>Enregistrer la transaction</button>
          </div>
        </CardPanel>

        {/* Global Salary Manager Card */}
        <CardPanel title="RH & Paie Mensuelle" action={<button className="btn-glow" style={S.btnPrimary} onClick={payAllSalaries}>Payer tous les salaires</button>}>
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
                  <th style={S.th} style={{ textAlign: "right" }}>Montant</th>
                  <th style={S.th} style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.slice().reverse().map(t => (
                  <tr key={t.id} style={S.tr}>
                    <td style={S.td} className="mono" style={{ color: "#475569" }}>{t.date}</td>
                    <td style={S.td}>
                      <span style={{
                        ...S.tag,
                        background: t.type === "recette" ? "#D1FAE5" : t.type === "depense" ? "#FEE2E2" : "#FEF3C7",
                        color: t.type === "recette" ? "#059669" : t.type === "depense" ? "#EF4444" : "#D97706"
                      }}>
                        {t.type}
                      </span>
                    </td>
                    <td style={S.td} style={{ fontWeight: 600, color: "#0F172A" }}>{t.description}</td>
                    <td style={S.td} className="mono" style={{ textAlign: "right", fontWeight: 700, color: t.type === "recette" ? "#059669" : "#EF4444" }}>
                      {t.type === "recette" ? "+" : "-"}{fmt(t.montant)} F
                    </td>
                    <td style={S.td}>
                      <button style={S.btnDangerIcon} onClick={() => remove(t.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPanel>
    </div>
  );
}

// ==========================================
// PERSONNEL (STAFF) & ACCOUNTS (ADMIN ONLY)
// ==========================================
function Personnel({ staff, setStaff, tx, setTx, users, setUsers, currentUser, triggerToast }) {
  const isAdmin = currentUser && currentUser.role === "Administrateur";
  const [subTab, setSubTab] = useState("staff"); // "staff" or "users"
  
  // Modal State for adding/modifying staff member
  const [showModal, setShowModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  
  // Staff form fields
  const [form, setForm] = useState({ nom: "", role: "Coach", tel: "", salaire: "" });
  const [giveAccess, setGiveAccess] = useState(false);
  const [accessUsername, setAccessUsername] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  
  // User Accounts forms
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "Secretaire", label: "" });
  const [editingUserId, setEditingUserId] = useState(null);

  // --- STAFF ACTIONS ---
  const startAddStaff = () => {
    setForm({ nom: "", role: "Coach", tel: "", salaire: "" });
    setGiveAccess(false);
    setAccessUsername("");
    setAccessPassword("");
    setEditingStaffId(null);
    setShowModal(true);
  };

  const startEditStaff = (s) => {
    const userAccount = users.find(u => u.id === s.id);
    setForm({ nom: s.nom, role: s.role, tel: s.tel || "", salaire: s.salaire });
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
                      <select style={S.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
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
                        {/* Only comptable or admin pays wages */}
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
                    <th style={S.th} style={{ textAlign: "right", width: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={S.tr}>
                      <td style={S.td} style={{ fontWeight: 600, color: "#0F172A" }}>{u.label}</td>
                      <td style={S.td} className="mono" style={{ color: "#334155" }}>{u.username}</td>
                      <td style={S.td} className="mono" style={{ color: "#334155" }}>{u.password}</td>
                      <td style={S.td}>
                        <span style={{
                          ...S.tag,
                          background: u.role === "Administrateur" ? "#F5F3FF" : u.role === "Comptable" ? "#FEF3C7" : "#E0F2FE",
                          color: u.role === "Administrateur" ? "#6366F1" : u.role === "Comptable" ? "#D97706" : "#0284C7"
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={S.td} style={{ textAlign: "right" }}>
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
    background: "#0F172A", // Deep Navy-900 (SaaS typical sidebars)
    borderRight: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    padding: "28px 20px",
    flexShrink: 0,
  },
  brand: {
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 26,
    color: "#FFF",
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
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "10px 14px",
    marginBottom: 12,
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
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
    paddingTop: 20,
  },
  soldeLabel: {
    fontSize: 10,
    color: "#94A3B8",
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
    padding: "5px 12px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
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
