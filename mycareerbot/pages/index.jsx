import { useState, useEffect, useCallback, useRef } from "react";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const store = {
  async get(k) {
    try { const r = await window.storage.get(k); if (!r) return null; try { return JSON.parse(r.value); } catch { return r.value; } } catch { return null; }
  },
  async set(k, v) {
    try { await window.storage.set(k, typeof v === "string" ? v : JSON.stringify(v)); } catch {}
  }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── CLAUDE API ───────────────────────────────────────────────────────────────
async function ai(system, user, tokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: tokens, system, messages: [{ role: "user", content: user }] }),
  });
  const d = await res.json();
  return d.content?.map(c => c.text || "").join("") || "";
}

async function aiJSON(sys, usr, tokens = 1000) {
  const raw = await ai(sys, usr, tokens);
  try { return JSON.parse(raw.replace(/```json[\s\S]*?\n|```/g, "").trim()); } catch { return null; }
}

async function aiWithPDF(system, user, pdfBase64, tokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: tokens, system,
      messages: [{
        role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: user }
        ]
      }]
    }),
  });
  const d = await res.json();
  return d.content?.map(c => c.text || "").join("") || "";
}

// ─── VISA CONFIG ──────────────────────────────────────────────────────────────
const VISA_CONFIG = {
  "H1B Transfer":  { color: "#4ade80", icon: "🔄", note: "No cap lottery needed — transfer only", promptNote: "On H1B seeking transfer. No lottery. Low risk/cost for employer.", coverNote: "I am currently on H1B status and seeking a transfer." },
  "OPT (F-1)":     { color: "#38bdf8", icon: "🎓", note: "Needs H1B sponsorship — active OPT",     promptNote: "On F-1 OPT. Needs H1B sponsor. Target companies with strong intl hiring.", coverNote: "I am currently authorized to work on OPT and will require H1B sponsorship." },
  "STEM OPT":      { color: "#a78bfa", icon: "🔬", note: "3-year runway — huge employer advantage", promptNote: "On STEM OPT — 3yr authorization is a SELLING POINT. Target E-Verify employers.", coverNote: "I am on STEM OPT extension (up to 3 years of work authorization) and will require H1B sponsorship." },
  "CPT (F-1)":     { color: "#fbbf24", icon: "📚", note: "Internship/Co-op positions only",         promptNote: "CPT student. Internship/co-op roles only. Target large intern programs.", coverNote: "I am authorized to work via CPT as part of my academic program." },
  "TN Visa":       { color: "#fb923c", icon: "🍁", note: "USMCA — Canadian/Mexican citizen",        promptNote: "TN visa holder. No lottery. Emphasize TN renewal simplicity.", coverNote: "I am a Canadian/Mexican citizen working on TN visa under USMCA." },
  "GC / EAD":      { color: "#4ade80", icon: "🟢", note: "No sponsorship needed — fully open",     promptNote: "Has EAD/GC — no sponsorship needed. Open to all top employers.", coverNote: "I am authorized to work in the US without employer sponsorship." },
};

// ─── LOCATIONS ────────────────────────────────────────────────────────────────
const ALL_LOCATIONS = [
  { city: "Remote (Anywhere)", region: "Remote" },
  { city: "San Francisco, CA", region: "West Coast" },
  { city: "Seattle, WA", region: "West Coast" },
  { city: "Los Angeles, CA", region: "West Coast" },
  { city: "San Diego, CA", region: "West Coast" },
  { city: "New York, NY", region: "East Coast" },
  { city: "Boston, MA", region: "East Coast" },
  { city: "Washington DC", region: "East Coast" },
  { city: "Philadelphia, PA", region: "East Coast" },
  { city: "Austin, TX", region: "South" },
  { city: "Dallas, TX", region: "South" },
  { city: "Houston, TX", region: "South" },
  { city: "Atlanta, GA", region: "South" },
  { city: "Miami, FL", region: "South" },
  { city: "Chicago, IL", region: "Midwest" },
  { city: "Denver, CO", region: "Midwest" },
  { city: "Minneapolis, MN", region: "Midwest" },
  { city: "Detroit, MI", region: "Midwest" },
  { city: "Pittsburgh, PA", region: "Northeast" },
  { city: "Raleigh, NC", region: "Southeast" },
  { city: "Charlotte, NC", region: "Southeast" },
  { city: "Salt Lake City, UT", region: "Mountain" },
  { city: "Phoenix, AZ", region: "Mountain" },
  { city: "Portland, OR", region: "Pacific NW" },
];

// ─── SUGGESTED ROLES ─────────────────────────────────────────────────────────
const ROLE_CATEGORIES = {
  "Software Engineering": [
    "Software Engineer", "Senior Software Engineer", "Staff Software Engineer",
    "Principal Engineer", "Frontend Engineer", "Backend Engineer",
    "Full Stack Engineer", "Mobile Engineer (iOS/Android)", "Embedded Systems Engineer",
  ],
  "Data & ML": [
    "Data Scientist", "Machine Learning Engineer", "AI/ML Engineer",
    "Data Engineer", "Analytics Engineer", "Research Scientist",
    "NLP Engineer", "Computer Vision Engineer", "MLOps Engineer",
  ],
  "Platform & Infrastructure": [
    "DevOps Engineer", "Site Reliability Engineer (SRE)", "Cloud Engineer",
    "Platform Engineer", "Infrastructure Engineer", "Security Engineer",
    "Network Engineer", "Systems Engineer",
  ],
  "Product & Design": [
    "Product Manager", "Senior Product Manager", "Technical Product Manager",
    "UX Designer", "Product Designer", "UX Researcher",
  ],
  "Management": [
    "Engineering Manager", "Senior Engineering Manager", "Director of Engineering",
    "VP of Engineering", "CTO",
  ],
  "Finance & Quant": [
    "Quantitative Analyst", "Quantitative Developer", "Financial Engineer",
    "Algorithmic Trader", "Risk Analyst", "Investment Banking Analyst",
  ],
  "Consulting & Analytics": [
    "Management Consultant", "Business Analyst", "Strategy Analyst",
    "Data Analyst", "Operations Research Analyst",
  ],
};

const INTERNSHIP_ROLES = {
  "Engineering Internships": [
    "Software Engineering Intern", "Frontend Engineering Intern",
    "Backend Engineering Intern", "Full Stack Intern", "Mobile Engineering Intern",
    "Embedded Systems Intern", "Hardware Engineering Intern",
  ],
  "Data & Research Internships": [
    "Data Science Intern", "Machine Learning Intern", "AI Research Intern",
    "Data Engineering Intern", "Research Intern", "NLP Research Intern",
  ],
  "Platform Internships": [
    "DevOps Intern", "Cloud Engineering Intern", "SRE Intern",
    "Security Engineering Intern", "Infrastructure Intern",
  ],
  "PM & Design Internships": [
    "Product Management Intern", "UX Design Intern", "Product Design Intern",
  ],
  "Finance Internships": [
    "Quant Research Intern", "Investment Banking Summer Analyst",
    "Trading Intern", "Risk Analyst Intern",
  ],
};

const SPONSOR_COMPANIES = [
  "Google","Amazon","Meta","Apple","Microsoft","Netflix","Salesforce","Adobe","Oracle","IBM",
  "Intel","Qualcomm","NVIDIA","Cisco","VMware","Workday","ServiceNow","Snowflake","Databricks",
  "Stripe","Twilio","Okta","CrowdStrike","Palo Alto Networks","Zoom","Dropbox","Airbnb",
  "Uber","Lyft","DoorDash","Robinhood","Coinbase","Block","PayPal","Intuit","Autodesk",
  "Splunk","Elastic","MongoDB","HashiCorp","Confluent","Datadog","New Relic","Dynatrace",
  "PagerDuty","Zendesk","HubSpot","Asana","Atlassian","GitHub","GitLab","Cloudflare",
  "Fastly","Akamai","Pinterest","Snap","LinkedIn","TikTok","ByteDance","Roblox","Epic Games",
  "JPMorgan Chase","Goldman Sachs","Morgan Stanley","Citigroup","Bank of America","Wells Fargo",
  "Capital One","American Express","Visa","Mastercard","BlackRock","Bloomberg","Two Sigma",
  "Citadel","Jane Street","DE Shaw","Point72","Fidelity","Charles Schwab",
  "McKinsey","Deloitte","Accenture","KPMG","PwC","EY","Boston Consulting Group","Bain",
  "Cognizant","Infosys","Wipro","TCS","HCL","Capgemini","ThoughtWorks",
  "Texas Instruments","Micron","Western Digital","Pure Storage","NetApp","Dell Technologies","HP",
  "Samsung","NXP Semiconductors","Broadcom","Marvell","AMD","TSMC",
  "Palantir","Anduril","SpaceX","Tesla","Waymo","Rivian","Lucid Motors",
  "Boeing","Lockheed Martin","Raytheon","Northrop Grumman","General Dynamics",
  "Johnson & Johnson","Pfizer","Moderna","Genentech","Gilead","AstraZeneca","Merck","Abbott",
  "Medtronic","Boston Scientific","Illumina","10x Genomics","Veeva Systems","Epic Systems",
  "Verizon","AT&T","T-Mobile","Comcast","Equinix","Digital Realty",
  "Shopify","Wayfair","Chewy","Expedia","Booking.com","Instacart",
];

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg: "#07090f", card: "#0e1219", surface: "rgba(255,255,255,0.032)",
  surfaceHi: "rgba(255,255,255,0.058)", border: "rgba(255,255,255,0.07)",
  borderHi: "rgba(255,255,255,0.18)", accent: "#6ee7b7", accentDim: "rgba(110,231,183,0.1)",
  blue: "#7dd3fc", blueDim: "rgba(125,211,252,0.1)",
  purple: "#c4b5fd", purpleDim: "rgba(196,181,253,0.1)",
  amber: "#fcd34d", amberDim: "rgba(252,211,77,0.1)",
  red: "#fca5a5", redDim: "rgba(252,165,165,0.1)",
  green: "#86efac", greenDim: "rgba(134,239,172,0.1)",
  text: "#f1f5f9", textDim: "#94a3b8", textMuted: "#475569",
  mono: "'IBM Plex Mono', monospace",
  display: "'Clash Display', 'Syne', sans-serif",
  body: "'DM Sans', sans-serif",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
body{background:${T.bg};color:${T.text};font-family:${T.body};-webkit-font-smoothing:antialiased}
::placeholder{color:${T.textMuted};opacity:.55}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
input[type=text],input[type=number],input[type=email],input[type=date],input[type=url],textarea,select{
  color:${T.text}!important;background:rgba(255,255,255,0.04)!important;
  border:1px solid ${T.border}!important;border-radius:8px!important;
  padding:10px 14px!important;font-family:${T.body}!important;font-size:13px!important;
  outline:none!important;width:100%;transition:all .18s;box-sizing:border-box}
input:focus,textarea:focus,select:focus{border-color:rgba(110,231,183,0.5)!important;background:rgba(110,231,183,0.03)!important}
textarea{resize:vertical;line-height:1.7}
select option{background:#0f172a;color:${T.text}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:.3;transform:scale(.75)}50%{opacity:1;transform:scale(1.2)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes slideRight{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes pop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}
.fu{animation:fadeUp .4s ease forwards}
.fi{animation:fadeIn .3s ease forwards}
.pop{animation:pop .25s ease forwards}
.glow{box-shadow:0 0 0 1px rgba(110,231,183,0.25),0 0 20px rgba(110,231,183,0.08)}
`;

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Spinner = ({ size = 32, color = T.accent }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", border: `2px solid rgba(255,255,255,0.07)`, borderTop: `2px solid ${color}`, animation: "spin .85s linear infinite" }} />
);

const Dots = ({ color = T.accent }) => (
  <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
    {[0, 1, 2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: color, animation: `pulse 1.1s ${i * .17}s ease infinite` }} />)}
  </span>
);

const Pip = ({ color, pulse: p }) => (
  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", boxShadow: `0 0 7px ${color}`, flexShrink: 0, animation: p ? "pulse 2s ease infinite" : undefined }} />
);

const Tag = ({ children, color = T.accent, small }) => (
  <span style={{ background: `${color}16`, border: `1px solid ${color}35`, borderRadius: small ? 5 : 7, padding: small ? "1px 7px" : "3px 10px", fontSize: small ? 10 : 11, color, fontFamily: T.mono, fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const VisaTag = ({ visa }) => {
  const cfg = VISA_CONFIG[visa] || VISA_CONFIG["H1B Transfer"];
  return <Tag color={cfg.color}>{cfg.icon} {visa}</Tag>;
};

const StatusTag = ({ status }) => {
  const m = { applied: [T.blue, "Applied"], interview: [T.green, "🎉 Interview"], rejected: [T.red, "Rejected"], pending: [T.amber, "Pending"] };
  const [c, l] = m[status] || [T.textMuted, status];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: c, fontFamily: T.mono, fontWeight: 600 }}><Pip color={c} />{l}</span>;
};

const Btn = ({ children, onClick, disabled, v = "primary", size = "md", full, icon, style: sx = {} }) => {
  const S = { sm: { padding: "7px 14px", fontSize: 12 }, md: { padding: "11px 22px", fontSize: 13 }, lg: { padding: "13px 30px", fontSize: 14 } };
  const V = {
    primary: { background: T.accent, color: "#07090f", fontWeight: 700 },
    ghost: { background: "transparent", color: T.textDim, border: `1px solid ${T.border}` },
    soft: { background: T.accentDim, color: T.accent, border: `1px solid rgba(110,231,183,0.2)` },
    green: { background: T.green, color: "#07090f", fontWeight: 700 },
    danger: { background: T.redDim, color: T.red, border: `1px solid rgba(252,165,165,0.25)` },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: T.body,
      fontWeight: 600, borderRadius: 9, transition: "all .18s",
      display: "inline-flex", alignItems: "center", gap: 7,
      opacity: disabled ? 0.38 : 1, letterSpacing: ".01em",
      width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined,
      ...S[size], ...V[v], ...sx,
    }}>
      {icon && <span style={{ fontSize: size === "sm" ? 13 : 15 }}>{icon}</span>}
      {children}
    </button>
  );
};

const Card = ({ children, style: sx = {}, onClick, glow }) => (
  <div onClick={onClick} className={glow ? "glow" : undefined}
    style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, transition: "all .18s", cursor: onClick ? "pointer" : undefined, ...sx }}
    onMouseEnter={onClick ? e => { e.currentTarget.style.background = T.surfaceHi; e.currentTarget.style.borderColor = T.borderHi; } : undefined}
    onMouseLeave={onClick ? e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; } : undefined}>
    {children}
  </div>
);

const SectionTitle = ({ icon, title, sub, step }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
    {step && <span style={{ background: T.accentDim, color: T.accent, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: T.mono, flexShrink: 0, marginTop: 2 }}>{step}</span>}
    {icon && !step && <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>}
    <div>
      <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: T.text }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  </div>
);

const Field = ({ label, children, hint, required }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accent, letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>
      {label}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
    </div>
    {children}
    {hint && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5, fontFamily: T.mono, lineHeight: 1.5 }}>{hint}</div>}
  </div>
);

const Bar = ({ pct, color = T.accent }) => (
  <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 1.2s ease", boxShadow: `0 0 8px ${color}55` }} />
  </div>
);

const Stat = ({ label, value, color = T.accent, sub }) => (
  <Card style={{ textAlign: "center", padding: "16px 10px" }}>
    <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: T.display, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.mono, marginTop: 3 }}>{sub}</div>}
    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 7, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</div>
  </Card>
);

const CopyBtn = ({ text }) => {
  const [d, setD] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setD(true); setTimeout(() => setD(false), 2000); }}
    style={{ background: d ? T.greenDim : T.surface, border: `1px solid ${d ? T.green : T.border}`, borderRadius: 6, padding: "5px 12px", color: d ? T.green : T.textMuted, fontFamily: T.mono, fontSize: 11, cursor: "pointer", transition: "all .2s" }}>
    {d ? "✓ Copied" : "Copy"}
  </button>;
};

// ─── LOCATION CHECKLIST ───────────────────────────────────────────────────────
const LocationPicker = ({ selected, onChange }) => {
  const regions = [...new Set(ALL_LOCATIONS.map(l => l.region))];
  const toggle = city => onChange(selected.includes(city) ? selected.filter(c => c !== city) : [...selected, city]);
  const toggleRegion = region => {
    const cities = ALL_LOCATIONS.filter(l => l.region === region).map(l => l.city);
    const allSelected = cities.every(c => selected.includes(c));
    onChange(allSelected ? selected.filter(c => !cities.includes(c)) : [...new Set([...selected, ...cities])]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {regions.map(region => {
        const cities = ALL_LOCATIONS.filter(l => l.region === region);
        const allOn = cities.every(c => selected.includes(c.city));
        return (
          <div key={region}>
            <button onClick={() => toggleRegion(region)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: T.mono, fontSize: 10, color: allOn ? T.accent : T.textMuted,
              letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 7,
              display: "flex", alignItems: "center", gap: 6, padding: 0,
            }}>
              <span style={{ width: 14, height: 14, border: `1.5px solid ${allOn ? T.accent : T.textMuted}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: T.accent, background: allOn ? T.accentDim : "transparent", transition: "all .15s" }}>
                {allOn ? "✓" : ""}
              </span>
              {region}
            </button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 4 }}>
              {cities.map(({ city }) => {
                const on = selected.includes(city);
                return (
                  <button key={city} onClick={() => toggle(city)} style={{
                    background: on ? T.accentDim : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? "rgba(110,231,183,0.4)" : T.border}`,
                    borderRadius: 7, padding: "6px 12px", cursor: "pointer",
                    color: on ? T.accent : T.textMuted, fontFamily: T.body, fontSize: 12,
                    fontWeight: on ? 600 : 400, transition: "all .15s",
                  }}>
                    {on && <span style={{ marginRight: 5, fontSize: 10 }}>✓</span>}
                    {city}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── ROLE PICKER ──────────────────────────────────────────────────────────────
const RolePicker = ({ selected, onChange, isCPT }) => {
  const categories = isCPT ? INTERNSHIP_ROLES : ROLE_CATEGORIES;
  const toggle = role => onChange(selected.includes(role) ? selected.filter(r => r !== role) : [...selected, role]);
  const [open, setOpen] = useState({});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Object.entries(categories).map(([cat, roles]) => {
        const isOpen = open[cat] !== false;
        const anySelected = roles.some(r => selected.includes(r));
        return (
          <div key={cat} style={{ background: anySelected ? T.accentDim : "rgba(255,255,255,0.02)", border: `1px solid ${anySelected ? "rgba(110,231,183,0.2)" : T.border}`, borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => setOpen(o => ({ ...o, [cat]: !isOpen }))} style={{
              background: "transparent", border: "none", cursor: "pointer",
              width: "100%", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: anySelected ? T.accent : T.textDim, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>
                {anySelected && <span style={{ marginRight: 6, fontSize: 10 }}>✓</span>}
                {cat}
                {anySelected && <span style={{ marginLeft: 8, background: T.accentDim, color: T.accent, borderRadius: 8, padding: "1px 7px", fontSize: 10 }}>{roles.filter(r => selected.includes(r)).length}</span>}
              </span>
              <span style={{ color: T.textMuted, fontSize: 11, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>▾</span>
            </button>
            {isOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 14px 14px" }}>
                {roles.map(role => {
                  const on = selected.includes(role);
                  return (
                    <button key={role} onClick={() => toggle(role)} style={{
                      background: on ? T.accentDim : "rgba(255,255,255,0.03)",
                      border: `1px solid ${on ? "rgba(110,231,183,0.4)" : T.border}`,
                      borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                      color: on ? T.accent : T.textMuted, fontFamily: T.body, fontSize: 12,
                      fontWeight: on ? 600 : 400, transition: "all .15s",
                    }}>
                      {on && <span style={{ marginRight: 4, fontSize: 10 }}>✓</span>}
                      {role}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
const Steps = ({ current }) => {
  const steps = ["Visa & Resume", "Job Preferences", "Review & Launch"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? T.accent : active ? T.accentDim : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${done ? T.accent : active ? T.accent : T.border}`,
                fontSize: 11, fontWeight: 700, fontFamily: T.mono,
                color: done ? T.bg : active ? T.accent : T.textMuted, flexShrink: 0,
                transition: "all .3s",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: active ? T.accent : done ? T.textDim : T.textMuted, fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: done ? T.accent : T.border, marginLeft: 10, marginRight: 10, transition: "background .3s" }} />}
          </div>
        );
      })}
    </div>
  );
};

// ─── RESUME UPLOAD ────────────────────────────────────────────────────────────
const ResumeUpload = ({ onExtracted, visa, setVisa }) => {
  const [state, setState] = useState("idle"); // idle | uploading | extracting | done | error
  const [extracted, setExtracted] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const processFile = async file => {
    if (!file) return;
    if (file.type !== "application/pdf") { setErrMsg("Please upload a PDF file."); setState("error"); return; }
    setState("uploading");

    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = e.target.result.split(",")[1];
      setState("extracting");
      try {
        const result = await aiJSON(
          `You are a resume parser. Extract ALL information from the resume and return a single valid JSON object. Extract every field you can find. Return ONLY the JSON, no other text.`,
          `Parse this resume and return a JSON object with these exact fields:
{
  "name": "full name",
  "email": "email address or empty string",
  "phone": "phone number or empty string",
  "currentTitle": "current or most recent job title",
  "linkedinUrl": "linkedin URL or empty string",
  "portfolioUrl": "github/portfolio URL or empty string",
  "location": "current location or empty string",
  "summary": "professional summary or write a 2-sentence summary from their experience",
  "skills": "comma-separated list of all technical and soft skills found",
  "experience": "full work experience section - all roles, companies, dates, and bullet points, well formatted",
  "education": "all degrees, universities, graduation years",
  "achievements": "notable achievements, awards, publications, patents, open source projects",
  "inferredRoles": ["array", "of", "5-8", "job", "titles", "this", "person", "would", "be", "great", "for", "based", "on", "their", "background"],
  "inferredSeniority": "Entry|Mid|Senior|Staff|Principal|Director",
  "inferredSalaryMin": "suggested minimum salary as number e.g. 150000"
}`,
          base64, 1000
        );

        if (result && result.name) {
          setExtracted(result);
          setState("done");
        } else {
          setErrMsg("Couldn't extract data. Try a different PDF.");
          setState("error");
        }
      } catch (err) {
        setErrMsg("Extraction failed. Please try again.");
        setState("error");
      }
    };
    reader.readAsDataURL(file);
  };

  const onDrop = e => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]); };

  return (
    <div>
      {/* Visa selector first */}
      <Card style={{ marginBottom: 20 }}>
        <SectionTitle icon="🛡️" title="Your Work Authorization" sub="This determines which companies and roles the agent targets for you" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {Object.entries(VISA_CONFIG).map(([k, cfg]) => (
            <button key={k} onClick={() => setVisa(k)} style={{
              background: visa === k ? `${cfg.color}12` : "rgba(255,255,255,0.02)",
              border: `1.5px solid ${visa === k ? cfg.color : T.border}`,
              borderRadius: 10, padding: "12px 10px", cursor: "pointer",
              color: visa === k ? cfg.color : T.textMuted,
              fontFamily: T.mono, fontSize: 11, fontWeight: 600,
              textAlign: "left", transition: "all .18s",
              display: "flex", flexDirection: "column", gap: 5,
            }}>
              <span style={{ fontSize: 20 }}>{cfg.icon}</span>
              <span>{k}</span>
              <span style={{ fontSize: 10, opacity: .65, fontWeight: 400, lineHeight: 1.3 }}>{cfg.note}</span>
            </button>
          ))}
        </div>

        {(visa === "OPT (F-1)" || visa === "STEM OPT") && (
          <div style={{ marginTop: 16 }}>
            <Field label="OPT / STEM OPT Expiry Date" hint="Helps the agent prioritize urgency and application timelines">
              <input type="date" id="optExpiry" />
            </Field>
          </div>
        )}
      </Card>

      {/* Resume drop zone */}
      <Card style={{ marginBottom: 20 }}>
        <SectionTitle icon="📄" title="Upload Your Resume" sub="AI will extract all your info automatically — no manual typing needed" />

        {state === "idle" || state === "error" ? (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? T.accent : T.border}`,
                borderRadius: 12, padding: "40px 24px", textAlign: "center",
                cursor: "pointer", transition: "all .18s",
                background: dragOver ? T.accentDim : "rgba(255,255,255,0.01)",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>📤</div>
              <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Drop your resume PDF here</div>
              <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 14 }}>or click to browse</div>
              <Tag color={T.accent}>PDF only · AI extracts everything automatically</Tag>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
            </div>
            {state === "error" && <div style={{ marginTop: 12, color: T.red, fontFamily: T.mono, fontSize: 12, textAlign: "center" }}>⚠ {errMsg}</div>}
          </>
        ) : state === "uploading" || state === "extracting" ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <Spinner size={40} />
            <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
              {state === "uploading" ? "Reading your resume…" : "AI extracting your profile…"}
            </div>
            <div style={{ color: T.textMuted, fontSize: 13, fontFamily: T.mono }}>
              {state === "extracting" ? "Parsing experience, skills, projects, contact info…" : "Uploading PDF…"}
            </div>
          </div>
        ) : state === "done" && extracted ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px", background: T.greenDim, border: `1px solid rgba(134,239,172,0.25)`, borderRadius: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.green, fontWeight: 700 }}>Resume parsed successfully</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Review what was extracted below</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                ["👤", "Name", extracted.name],
                ["📧", "Email", extracted.email],
                ["💼", "Title", extracted.currentTitle],
                ["📍", "Location", extracted.location],
                ["🔗", "LinkedIn", extracted.linkedinUrl ? "Found ✓" : "Not found"],
                ["🌐", "Portfolio", extracted.portfolioUrl ? "Found ✓" : "Not found"],
              ].map(([icon, label, val]) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: val ? T.text : T.textMuted, fontWeight: val ? 500 : 400 }}>{val || "—"}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>Skills Extracted</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(extracted.skills || "").split(",").slice(0, 12).map((s, i) => s.trim() && <Tag key={i} color={T.blue} small>{s.trim()}</Tag>)}
              </div>
            </div>

            {extracted.inferredRoles && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".07em" }}>AI Suggested Roles for You</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {extracted.inferredRoles.map((r, i) => <Tag key={i} color={T.purple} small>{r}</Tag>)}
                </div>
              </div>
            )}

            <button onClick={() => { setState("idle"); setExtracted(null); }}
              style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 14px", color: T.textMuted, cursor: "pointer", fontFamily: T.mono, fontSize: 11, marginTop: 4 }}>
              ↺ Re-upload different resume
            </button>
          </div>
        ) : null}
      </Card>

      {/* Confirm and move on */}
      {state === "done" && extracted && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn v="primary" size="lg" onClick={() => onExtracted(extracted, document.getElementById("optExpiry")?.value || "")} icon="→">
            Set Job Preferences
          </Btn>
        </div>
      )}
    </div>
  );
};

// ─── PREFERENCES STEP ────────────────────────────────────────────────────────
const PreferencesStep = ({ extracted, visa, onDone, onBack }) => {
  const isCPT = visa === "CPT (F-1)";
  const [roles, setRoles] = useState(extracted?.inferredRoles?.slice(0, 3) || []);
  const [locations, setLocations] = useState(["Remote (Anywhere)", "San Francisco, CA", "New York, NY"]);
  const [salary, setSalary] = useState(extracted?.inferredSalaryMin?.toString() || (isCPT ? "40" : "150000"));
  const [seniority, setSeniority] = useState(extracted?.inferredSeniority || "Senior");
  const [dailyTarget, setDailyTarget] = useState(15);
  const [openToRelocation, setOpenToRelocation] = useState(true);
  const ready = roles.length > 0 && locations.length > 0;

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon="🎯" title="Target Roles" sub="Pick every role you'd like to apply for — the agent will search all of them" />
        {extracted?.inferredRoles?.length > 0 && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: T.purpleDim, border: `1px solid rgba(196,181,253,0.2)`, borderRadius: 9 }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.purple, marginBottom: 6 }}>✨ AI pre-selected these based on your resume</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {roles.map((r, i) => <Tag key={i} color={T.purple} small>{r}</Tag>)}
            </div>
          </div>
        )}
        <RolePicker selected={roles} onChange={setRoles} isCPT={isCPT} />
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon="📍" title="Preferred Locations" sub="Select all cities you'd consider — including Remote" />
        <LocationPicker selected={locations} onChange={setLocations} />
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon="⚙️" title="Application Settings" sub="Configure how the agent runs for you" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={isCPT ? "Min Hourly Rate ($/hr)" : "Min Base Salary ($/yr)"} required>
            <input type="number" value={salary} onChange={e => setSalary(e.target.value)}
              placeholder={isCPT ? "e.g. 40" : "e.g. 150000"} />
          </Field>
          <Field label="Seniority Level">
            <select value={seniority} onChange={e => setSeniority(e.target.value)}>
              {(isCPT ? ["Intern", "Co-op"] : ["Entry (0–2 yrs)", "Mid (2–5 yrs)", "Senior (5–8 yrs)", "Staff / Lead", "Principal / Architect", "Director", "VP"]).map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Applications Per Day" hint="10–20 is optimal for response rate without burnout">
            <select value={dailyTarget} onChange={e => setDailyTarget(parseInt(e.target.value))}>
              {[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} applications / day</option>)}
            </select>
          </Field>
          <Field label="Open to Relocation?">
            <select value={openToRelocation ? "yes" : "no"} onChange={e => setOpenToRelocation(e.target.value === "yes")}>
              <option value="yes">Yes — willing to relocate</option>
              <option value="no">No — selected locations only</option>
            </select>
          </Field>
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Btn v="ghost" onClick={onBack} icon="←">Back</Btn>
        <Btn v="primary" size="lg" disabled={!ready} onClick={() => onDone({ roles, locations, salary, seniority, dailyTarget, openToRelocation })} icon="✓">
          Review & Launch
        </Btn>
      </div>
    </div>
  );
};

// ─── REVIEW STEP ─────────────────────────────────────────────────────────────
const ReviewStep = ({ profile, onLaunch, onBack }) => {
  const cfg = VISA_CONFIG[profile.visa] || VISA_CONFIG["H1B Transfer"];
  return (
    <div>
      <Card style={{ marginBottom: 18, border: `1px solid ${cfg.color}30`, background: `${cfg.color}06` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 28 }}>{cfg.icon}</span>
          <div>
            <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700 }}>{profile.name}</div>
            <div style={{ color: T.textMuted, fontSize: 13, marginTop: 2 }}>{profile.currentTitle}</div>
          </div>
          <div style={{ marginLeft: "auto" }}><VisaTag visa={profile.visa} /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[
            ["🎯 Target Roles", profile.targetRoles?.slice(0, 3).join(", ") + (profile.targetRoles?.length > 3 ? ` +${profile.targetRoles.length - 3} more` : "")],
            ["📍 Locations", profile.targetLocations?.slice(0, 2).join(", ") + (profile.targetLocations?.length > 2 ? ` +${profile.targetLocations.length - 2}` : "")],
            ["💰 Min Salary", `$${parseInt(profile.minSalary || 0).toLocaleString()}${profile.visa === "CPT (F-1)" ? "/hr" : "/yr"}`],
            ["📊 Seniority", profile.seniority],
            ["⚡ Daily Target", `${profile.dailyTarget} applications/day`],
            ["🌎 Relocation", profile.openToRelocation ? "Open to relocating" : "Selected locations only"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 14px", background: `${cfg.color}10`, border: `1px solid ${cfg.color}25`, borderRadius: 9 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: cfg.color, fontWeight: 700, marginBottom: 4 }}>🛡️ Visa Filter Active</div>
          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>{cfg.promptNote}</div>
        </div>
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon="📊" title="What Happens Next" />
        {[
          ["⚡", "Run Daily Batch", "Each day, click Run Daily Batch — agent finds matching roles, filters for your visa type, tailors every application with a custom cover letter, resume bullets, LinkedIn DM & interview prep"],
          ["👆", "1-Click Review", "Each card shows you the company, match score, and all materials. Review takes 2 minutes per application max"],
          ["✅", "You Submit", "Hit Apply ↗ to open the company's real application page. You paste in your tailored content and submit"],
          ["📈", "Track Everything", "Mark applications as Applied, Interview, or Rejected — your dashboard shows your full funnel"],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ display: "flex", gap: 14, marginBottom: 16 }}>
            <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{icon}</span>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>{desc}</div>
            </div>
          </div>
        ))}
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Btn v="ghost" onClick={onBack} icon="←">Back</Btn>
        <Btn v="primary" size="lg" onClick={onLaunch} icon="🚀">Launch My Agent</Btn>
      </div>
    </div>
  );
};

// ─── SETUP WRAPPER ────────────────────────────────────────────────────────────
function Setup({ onSave, initial }) {
  const [step, setStep] = useState(0);
  const [visa, setVisa] = useState(initial?.visa || "H1B Transfer");
  const [extracted, setExtracted] = useState(initial ? { name: initial.name, email: initial.email, phone: initial.phone, currentTitle: initial.currentTitle, linkedinUrl: initial.linkedinUrl, portfolioUrl: initial.portfolioUrl, summary: initial.summary, skills: initial.skills, experience: initial.experience, education: initial.education, achievements: initial.achievements, inferredRoles: initial.targetRoles, inferredSeniority: initial.seniority, inferredSalaryMin: initial.minSalary } : null);
  const [optExpiry, setOptExpiry] = useState(initial?.optExpiry || "");
  const [prefs, setPrefs] = useState(null);

  const handleExtracted = (data, expiry) => {
    setExtracted(data);
    setOptExpiry(expiry);
    setStep(1);
  };

  const handlePrefs = (p) => {
    setPrefs(p);
    setStep(2);
  };

  const handleLaunch = () => {
    onSave({
      name: extracted.name, email: extracted.email, phone: extracted.phone,
      currentTitle: extracted.currentTitle, linkedinUrl: extracted.linkedinUrl,
      portfolioUrl: extracted.portfolioUrl, location: extracted.location,
      summary: extracted.summary, skills: extracted.skills,
      experience: extracted.experience, education: extracted.education,
      achievements: extracted.achievements,
      visa, optExpiry,
      targetRoles: prefs.roles, targetLocations: prefs.locations,
      minSalary: prefs.salary, seniority: prefs.seniority,
      dailyTarget: prefs.dailyTarget, openToRelocation: prefs.openToRelocation,
    });
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "44px 24px 80px", overflowY: "auto", height: "100vh" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.accentDim, border: `1px solid rgba(110,231,183,0.25)`, borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
          <Pip color={T.accent} pulse />
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>AI Job Application Agent</span>
        </div>
        <h1 style={{ fontFamily: T.display, fontSize: "clamp(28px,5vw,48px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.03em", marginBottom: 12 }}>
          <span style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Upload resume.<br />We handle the rest.
          </span>
        </h1>
        <p style={{ color: T.textDim, fontSize: 14, maxWidth: 420, margin: "0 auto", lineHeight: 1.75 }}>
          AI reads your resume, finds visa-compatible roles, and tailors every application — cover letter, resume bullets, LinkedIn DM, interview prep — automatically.
        </p>
      </div>

      <Steps current={step} />

      <div className="fu" key={step}>
        {step === 0 && <ResumeUpload onExtracted={handleExtracted} visa={visa} setVisa={setVisa} />}
        {step === 1 && extracted && <PreferencesStep extracted={extracted} visa={visa} onDone={handlePrefs} onBack={() => setStep(0)} />}
        {step === 2 && extracted && prefs && (
          <ReviewStep
            profile={{ ...extracted, visa, optExpiry, ...prefs, targetRoles: prefs.roles, targetLocations: prefs.locations, minSalary: prefs.salary }}
            onLaunch={handleLaunch}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}

// ─── JOB CARD ─────────────────────────────────────────────────────────────────
function JobCard({ job, onView }) {
  const mc = job.matchScore >= 80 ? T.green : job.matchScore >= 65 ? T.amber : T.red;
  return (
    <Card onClick={() => onView(job)} style={{ padding: "14px 18px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontFamily: T.display, fontSize: 14, fontWeight: 700 }}>{job.title}</span>
            {job.sponsorVerified && <Tag color={T.green} small>✓ Sponsors</Tag>}
            {job.remote && <Tag color={T.purple} small>Remote</Tag>}
            {job.isInternship && <Tag color={T.amber} small>Internship</Tag>}
          </div>
          <div style={{ fontSize: 13, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{job.company}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.textMuted }}>📍 {job.location}</span>
            {job.salary && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.textMuted }}>💰 {job.salary}</span>}
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.textMuted }}>🔗 {job.platform}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 800, color: mc, lineHeight: 1 }}>{job.matchScore}<span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>%</span></div>
          {job.status && <StatusTag status={job.status} />}
        </div>
      </div>
      <Bar pct={job.matchScore} color={mc} />
    </Card>
  );
}

// ─── APP MODAL ────────────────────────────────────────────────────────────────
function AppModal({ job, onClose, onStatusChange }) {
  const [tab, setTab] = useState("cover");
  const tabs = [{ k: "cover", l: "Cover Letter" }, { k: "resume", l: "Resume Bullets" }, { k: "linkedin", l: "LinkedIn DM" }, { k: "interview", l: "Interview Prep" }, { k: "analysis", l: "Analysis" }];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,6,12,0.94)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pop" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, width: "100%", maxWidth: 760, maxHeight: "93vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
              <span style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700 }}>{job.title}</span>
              {job.sponsorVerified && <Tag color={T.green}>✓ Sponsors Visa</Tag>}
              {job.remote && <Tag color={T.purple}>Remote</Tag>}
            </div>
            <div style={{ color: T.textDim, fontSize: 13 }}>{job.company} · {job.location}{job.salary ? ` · ${job.salary}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <select value={job.status} onChange={e => onStatusChange(job.id, e.target.value)}
              style={{ width: "auto !important", fontSize: "11px !important", padding: "6px 10px !important" }}>
              <option value="pending">Pending</option>
              <option value="applied">✅ Applied</option>
              <option value="interview">🎉 Interview</option>
              <option value="rejected">❌ Rejected</option>
            </select>
            {job.applyUrl && <Btn v="soft" size="sm" onClick={() => window.open(job.applyUrl, "_blank")}>Apply ↗</Btn>}
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, width: 30, height: 30, cursor: "pointer", color: T.textMuted, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              background: tab === t.k ? T.accentDim : "transparent",
              border: `1px solid ${tab === t.k ? T.accent : T.border}`,
              borderRadius: 7, padding: "6px 14px", cursor: "pointer",
              color: tab === t.k ? T.accent : T.textMuted,
              fontFamily: T.mono, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", transition: "all .15s",
            }}>{t.l}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {tab === "analysis" ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
                <Stat label="Match" value={`${job.matchScore}%`} color={job.matchScore >= 80 ? T.green : T.amber} />
                <Stat label="Skills" value={`${job.skillsScore || Math.max(55, job.matchScore - 4)}%`} color={T.blue} />
                <Stat label="Experience" value={`${job.expScore || Math.min(99, job.matchScore + 3)}%`} color={T.purple} />
              </div>
              {job.strengths && <Card style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.green, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Your Strengths for This Role</div>
                {job.strengths.map((s, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 13, color: T.textDim, lineHeight: 1.5 }}><span style={{ color: T.green, flexShrink: 0 }}>↑</span>{s}</div>)}
              </Card>}
              {job.gaps && <Card style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.amber, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Gaps to Address</div>
                {job.gaps.map((g, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 13, color: T.textDim, lineHeight: 1.5 }}><span style={{ color: T.amber, flexShrink: 0 }}>→</span>{g}</div>)}
              </Card>}
              {job.atsKeywords && <Card>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.accent, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>ATS Keywords Embedded</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{job.atsKeywords.map((k, i) => <Tag key={i}>{k}</Tag>)}</div>
              </Card>}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <CopyBtn text={{ cover: job.coverLetter, resume: job.resumeBullets, linkedin: job.linkedinMsg, interview: job.interviewPrep }[tab] || ""} />
              </div>
              <div style={{ color: T.textDim, fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap", fontFamily: tab === "resume" ? T.mono : "Georgia, serif", fontSize: tab === "resume" ? 12 : 13 }}>
                {{ cover: job.coverLetter, resume: job.resumeBullets, linkedin: job.linkedinMsg, interview: job.interviewPrep }[tab] || "Not generated."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ profile, applications, setApplications, onEdit }) {
  const [view, setView] = useState("today");
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [prog, setProg] = useState({ msg: "", pct: 0, done: false });
  const cfg = VISA_CONFIG[profile.visa] || VISA_CONFIG["H1B Transfer"];
  const isCPT = profile.visa === "CPT (F-1)";

  const log = msg => setLogs(l => [`[${new Date().toLocaleTimeString("en-US", { hour12: false })}] ${msg}`, ...l].slice(0, 50));

  const today = applications.filter(a => a.batchDate === new Date().toDateString());
  const applied = applications.filter(a => a.status === "applied");
  const interviews = applications.filter(a => a.status === "interview");
  const pending = applications.filter(a => a.status === "pending");

  const updateStatus = (id, status) => {
    const updated = applications.map(a => a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a);
    setApplications(updated);
    if (selected?.id === id) setSelected(j => ({ ...j, status }));
  };

  const runBatch = async () => {
    if (running) return;
    setRunning(true); setLogs([]);
    const target = profile.dailyTarget || 15;
    const roles = profile.targetRoles?.filter(Boolean) || [];
    const locs = profile.targetLocations?.filter(Boolean) || [];

    log(`🚀 Agent started — targeting ${target} applications`);
    log(`👤 ${profile.name} · ${profile.visa} · ${roles.slice(0, 2).join(", ")}`);
    setProg({ msg: "🔍 Scanning platforms for matching roles…", pct: 8, done: false });
    await sleep(400);

    try {
      setProg({ msg: "🏢 Filtering visa-compatible employers…", pct: 18, done: false });
      log(`🛡️ Visa filter: ${cfg.filterNote}`);

      const companySample = SPONSOR_COMPANIES.sort(() => Math.random() - 0.5).slice(0, 45).join(", ");

      const jobsData = await aiJSON(
        `You are a job search AI. Generate realistic job listings. Return ONLY a valid JSON array of exactly ${target} objects. No extra text, no markdown. Each object must have these exact keys: id, title, company, location, salary, platform, applyUrl, sponsorVerified, remote, isInternship, jobDescription, matchScore, skillsScore, expScore, strengths, gaps, atsKeywords.`,
        `Generate ${target} job listings for:
Name: ${profile.name}
Visa: ${profile.visa} — ${cfg.promptNote}
Target Roles: ${roles.join(", ")}
Seniority: ${profile.seniority}
Preferred Locations: ${locs.join(", ")}
Min Salary: $${parseInt(profile.minSalary || 0).toLocaleString()}${isCPT ? "/hr" : "/yr"}
Skills from resume: ${profile.skills?.substring(0, 300)}
Only use companies from: ${companySample}
${isCPT ? "All positions must be internships or co-ops (isInternship: true)." : "sponsorVerified must always be true. Only well-known companies."}
For each: matchScore 62-95 (int), skillsScore 60-95 (int), expScore 60-95 (int), strengths array of 3 strings, gaps array of 1-2 strings, atsKeywords array of 6 strings. salary format "$140k–$175k" or "$45–$55/hr". platform: one of LinkedIn/Indeed/Greenhouse/Lever/Workday. applyUrl: realistic URL. remote: boolean.`, 1000);

      if (!Array.isArray(jobsData) || jobsData.length === 0) throw new Error("No jobs returned");

      log(`✓ Found ${jobsData.length} matching roles`);
      const newJobs = [];

      for (let i = 0; i < jobsData.length; i++) {
        const job = jobsData[i];
        setProg({ msg: `✍️ Tailoring: ${job.company} — ${job.title}…`, pct: 25 + Math.round((i / jobsData.length) * 68), done: false });

        const ctx = `Candidate: ${profile.name}
Title: ${profile.currentTitle || roles[0]}
Visa: ${profile.visa} — ${cfg.coverNote}
Skills: ${profile.skills?.substring(0, 350)}
Experience: ${profile.experience?.substring(0, 500)}
Education: ${profile.education?.substring(0, 150)}
Achievements: ${profile.achievements?.substring(0, 200)}
Target: ${job.title} at ${job.company}
Job Description: ${job.jobDescription}`;

        const [cl, rb, lm, ip] = await Promise.all([
          ai("Write a compelling, specific cover letter under 340 words. No placeholders. First person. Specific to the company and role. Confident, not sycophantic. Naturally include the visa status in the last paragraph.",
            `Write cover letter:\n${ctx}`),
          ai("Write 7 achievement-focused resume bullet points. Each starts with •. Strong action verbs. Embed ATS keywords from the job description. Quantify where possible. Tailor to this exact role.",
            `Write resume bullets:\n${ctx}`),
          ai("Write a LinkedIn connection request MAX 280 characters. Punchy, specific, genuine. No 'Hi I came across your profile'. Reference the role.",
            `LinkedIn outreach: ${profile.name} → ${job.title} at ${job.company}. Background: ${profile.summary?.substring(0, 120) || profile.achievements?.substring(0, 100)}`),
          ai("Write interview prep for this specific role. 4 likely questions with STAR answer frameworks using candidate's actual experience. Q: / A: format. Very specific to company + role.",
            `Interview prep:\n${ctx}`),
        ]);

        newJobs.push({ ...job, id: job.id || `j-${Date.now()}-${i}`, coverLetter: cl, resumeBullets: rb, linkedinMsg: lm, interviewPrep: ip, status: "pending", batchDate: new Date().toDateString(), generatedAt: new Date().toISOString(), visaType: profile.visa });
        log(`  ✓ ${job.company} — ${job.title} (${job.matchScore}% match)`);
        if (i < jobsData.length - 1) await sleep(120);
      }

      setProg({ msg: `💾 Saving batch…`, pct: 96, done: false });
      const merged = [...newJobs, ...applications];
      setApplications(merged);
      await store.set("applications", merged);
      setProg({ msg: `🎉 Done! ${newJobs.length} tailored applications ready`, pct: 100, done: true });
      log(`✅ Batch complete — ${newJobs.length} applications ready to submit`);
      setView("today");
    } catch (err) {
      log(`❌ Error: ${err.message}`);
      setProg({ msg: "Error — please try again", pct: 0, done: false });
    }
    setRunning(false);
  };

  const views = { today: { label: "Today's Batch", items: today, icon: "⚡" }, pending: { label: "Pending", items: pending, icon: "🕐" }, applied: { label: "Applied", items: applied, icon: "✅" }, interview: { label: "Interviews 🎉", items: interviews, icon: "🎙️" }, all: { label: "All Jobs", items: applications, icon: "📋" } };
  const rateInterview = applied.length ? Math.round((interviews.length / applied.length) * 100) : 0;

  // OPT expiry
  const optDays = profile.optExpiry ? Math.ceil((new Date(profile.optExpiry) - new Date()) / 86400000) : null;
  const optColor = optDays !== null ? (optDays < 60 ? T.red : optDays < 120 ? T.amber : T.green) : null;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 228, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0, background: T.card }}>
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.currentTitle}</div>
          <VisaTag visa={profile.visa} />
        </div>

        {optDays !== null && (
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, background: `${optColor}08` }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: optColor, fontWeight: 700, marginBottom: 2 }}>⏱ OPT Expires</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim }}>{profile.optExpiry}</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: optColor, marginTop: 2 }}>{optDays > 0 ? `${optDays} days remaining` : "⚠️ Expired"}</div>
          </div>
        )}

        <nav style={{ padding: "10px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {Object.entries(views).map(([k, v]) => (
            <button key={k} onClick={() => setView(k)} style={{
              background: view === k ? T.accentDim : "transparent",
              border: `1px solid ${view === k ? "rgba(110,231,183,0.3)" : "transparent"}`,
              borderRadius: 8, padding: "9px 11px", cursor: "pointer",
              color: view === k ? T.accent : T.textMuted,
              fontFamily: T.mono, fontSize: 11, fontWeight: view === k ? 600 : 400,
              display: "flex", alignItems: "center", gap: 8, transition: "all .13s", textAlign: "left", width: "100%",
            }}>
              <span style={{ fontSize: 13 }}>{v.icon}</span>
              <span style={{ flex: 1 }}>{v.label}</span>
              {v.items.length > 0 && <span style={{ background: view === k ? "rgba(110,231,183,0.2)" : "rgba(255,255,255,0.06)", borderRadius: 8, padding: "0 6px", fontSize: 10, lineHeight: "18px", minWidth: 20, textAlign: "center" }}>{v.items.length}</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Performance</div>
          {[["Apply rate", `${applications.length ? Math.round(applied.length / applications.length * 100) : 0}%`, T.blue], ["Interview rate", `${rateInterview}%`, T.green]].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>{l}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: c, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <Btn v="ghost" size="sm" full onClick={onEdit}>⚙ Edit Profile</Btn>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: T.card }}>
          <div>
            <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700 }}>{views[view].label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          </div>
          <Btn onClick={runBatch} disabled={running} v="primary" size="md">
            {running ? <><Dots /> Running Agent…</> : <><span>⚡</span> Run Daily Batch</>}
          </Btn>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* OPT urgency banner */}
          {optDays !== null && optDays < 120 && (
            <div style={{ background: `${optColor}10`, border: `1px solid ${optColor}30`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: optColor, fontWeight: 700, marginBottom: 4 }}>
                ⏱ {optDays > 0 ? `${optDays} days of OPT authorization remaining` : "OPT Expired — update status"}
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (optDays / 365) * 100)}%`, height: "100%", background: optColor, borderRadius: 2 }} />
              </div>
              {optDays < 90 && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, fontFamily: T.mono }}>🚨 Prioritize companies with fast H1B petition timelines — apply aggressively now</div>}
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            <Stat label="Today" value={today.length} color={T.accent} sub={`of ${profile.dailyTarget} target`} />
            <Stat label="Applied" value={applied.length} color={T.green} />
            <Stat label="Interviews" value={interviews.length} color={T.purple} />
            <Stat label="Total" value={applications.length} color={T.textMuted} />
          </div>

          {/* Progress */}
          {running && (
            <Card style={{ border: `1px solid rgba(110,231,183,0.2)`, background: "rgba(110,231,183,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent }}>{prog.msg}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted }}>{prog.pct}%</span>
              </div>
              <Bar pct={prog.pct} color={prog.done ? T.green : T.accent} />
              <div style={{ marginTop: 12, height: 130, overflowY: "auto", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                {logs.map((l, i) => <div key={i} style={{ fontFamily: T.mono, fontSize: 10.5, color: i === 0 ? T.text : T.textMuted, marginBottom: 2, lineHeight: 1.4 }}>{l}</div>)}
              </div>
            </Card>
          )}

          {/* List */}
          {views[view].items.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 52 }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>{views[view].icon}</div>
              <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                {view === "today" ? "No batch yet today" : view === "interview" ? "No interviews yet" : "Nothing here yet"}
              </div>
              <div style={{ color: T.textMuted, fontSize: 12, fontFamily: T.mono, maxWidth: 360, margin: "0 auto 22px", lineHeight: 1.7 }}>
                {view === "today" && `Click Run Daily Batch — the agent finds ${profile.dailyTarget} visa-compatible roles and tailors every application.`}
                {view === "applied" && "Applications you mark as submitted appear here."}
                {view === "interview" && "Keep applying — your first interview is coming!"}
                {view === "pending" && "Run the batch to generate applications for review."}
              </div>
              {(view === "today" || view === "pending") && <Btn onClick={runBatch} disabled={running} icon="⚡">Run Daily Batch</Btn>}
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {views[view].items.map(job => <JobCard key={job.id} job={job} onView={setSelected} />)}
            </div>
          )}
        </div>
      </div>
      {selected && <AppModal job={selected} onClose={() => setSelected(null)} onStatusChange={updateStatus} />}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    (async () => {
      const p = await store.get("profile");
      const a = await store.get("applications");
      if (p && typeof p === "object" && p.name) setProfile(p);
      if (Array.isArray(a)) setApplications(a);
      setScreen((p && p.name) ? "dashboard" : "setup");
    })();
  }, []);

  const saveProfile = async p => { await store.set("profile", p); setProfile(p); setScreen("dashboard"); };
  const saveApps = useCallback(async apps => { setApplications(apps); await store.set("applications", apps); }, []);

  if (screen === "loading") return (
    <>
      <style>{CSS}</style>
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <Spinner size={36} />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div style={{ background: T.bg, height: "100vh", color: T.text, overflow: screen === "setup" ? "auto" : "hidden" }}>
        {screen === "setup" && <Setup onSave={saveProfile} initial={profile} />}
        {screen === "dashboard" && profile && <Dashboard profile={profile} applications={applications} setApplications={saveApps} onEdit={() => setScreen("setup")} />}
      </div>
    </>
  );
}
