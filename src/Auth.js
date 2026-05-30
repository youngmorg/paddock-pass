import { useState } from "react";
import { supabase } from "./supabase";

const DARK = {
  bg:         "#0C0C0E",
  bgCard:     "#111113",
  border:     "#1E1E22",
  border2:    "#2A2A2E",
  text:       "#E8E6E1",
  textMid:    "#888",
  textDim:    "#555",
};

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const T = DARK;
  const inpSty = { width:"100%", background:T.bgCard, border:`1px solid ${T.border2}`, borderRadius:6, padding:"9px 11px", color:T.text, fontSize:13, boxSizing:"border-box" };

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log("login result:", JSON.stringify({data, error}));
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!username) { setError("Username is required"); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: null } });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").update({ username }).eq("id", data.user.id);
      setMessage("Account created! Check your email to confirm, then log in.");
      setMode("login");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      
      {/* Logo */}
      <div style={{ marginBottom:32, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
        <svg width="72" height="72" viewBox="200 30 280 280" xmlns="http://www.w3.org/2000/svg">
          <rect x="200" y="30" width="280" height="280" rx="64" fill="#111111"/>
          <text x="340" y="208" fontFamily="system-ui,-apple-system,Helvetica,sans-serif" fontSize="148" fontWeight="800" fill="#ffffff" textAnchor="middle" letterSpacing="-10">PP</text>
          <g transform="translate(424, 254)">
            <circle cx="0" cy="0" r="37" fill="#1a1a1a"/>
            <circle cx="0" cy="0" r="37" fill="none" stroke="#272727" strokeWidth="8"/>
            <circle cx="0" cy="0" r="29" fill="#141414"/>
            <path d="M -20 -20 A 28 28 0 0 1 20 -20" fill="none" stroke="#E040FB" strokeWidth="5" strokeLinecap="round"/>
            <path d="M 20 -20 A 28 28 0 0 1 20 20" fill="none" stroke="#E040FB" strokeWidth="5" strokeLinecap="round"/>
            <path d="M 20 20 A 28 28 0 0 1 -20 20" fill="none" stroke="#E040FB" strokeWidth="5" strokeLinecap="round"/>
            <path d="M -20 20 A 28 28 0 0 1 -20 -20" fill="none" stroke="#E040FB" strokeWidth="5" strokeLinecap="round"/>
            <circle cx="0" cy="0" r="20" fill="#0e0e0e"/>
            <circle cx="0" cy="0" r="18.5" fill="#9a9a9a"/>
            <g fill="#5a5a5a">
              {[0,40,80,120,160,200,240,280,320].map(a => (
                <polygon key={a} points="0,-5.5 -1.8,-5 -0.8,-18 0.8,-18 1.8,-5" transform={`rotate(${a})`}/>
              ))}
            </g>
            <circle cx="0" cy="0" r="6" fill="#3a3a3a" stroke="#4a4a4a" strokeWidth="1"/>
            <circle cx="0" cy="0" r="3.5" fill="#292929"/>
            <circle cx="0" cy="0" r="1.5" fill="#555"/>
          </g>
        </svg>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:T.text, textAlign:"center", letterSpacing:-0.5 }}>Paddock Pass</div>
          <div style={{ fontSize:12, color:T.textDim, textAlign:"center", marginTop:2 }}>Your motorsport calendar</div>
        </div>
      </div>

      {/* Card */}
      <div style={{ width:"100%", maxWidth:380, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:"28px 24px" }}>
        
        {/* Tabs */}
        <div style={{ display:"flex", background:T.bg, borderRadius:8, padding:3, marginBottom:24 }}>
          {["login","signup"].map(m => (
            <button key={m} onClick={()=>{ setMode(m); setError(""); setMessage(""); }} style={{ flex:1, padding:"7px 0", borderRadius:6, border:"none", background:mode===m?"#1E1E22":"transparent", color:mode===m?T.text:T.textDim, fontSize:13, fontWeight:mode===m?600:400, cursor:"pointer" }}>
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {mode === "signup" && (
            <div>
              <div style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>Username</div>
              <input style={inpSty} placeholder="e.g. morganraynal" value={username} onChange={e=>setUsername(e.target.value)} />
            </div>
          )}
          <div>
            <div style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>Email</div>
            <input style={inpSty} type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:11, color:T.textDim, marginBottom:4 }}>Password</div>
            <input style={inpSty} type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleSignup())} />
          </div>

          {error && <div style={{ fontSize:12, color:"#E8502A", padding:"8px 10px", background:"#E8502A15", borderRadius:6 }}>{error}</div>}
          {message && <div style={{ fontSize:12, color:"#3DAA4E", padding:"8px 10px", background:"#3DAA4E15", borderRadius:6 }}>{message}</div>}

          <button
            onClick={mode==="login"?handleLogin:handleSignup}
            disabled={loading}
            style={{ marginTop:4, padding:"10px", borderRadius:7, border:"none", background:"linear-gradient(135deg,#E8502A,#B02010)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", opacity:loading?0.7:1 }}>
            {loading ? "..." : mode==="login" ? "Log in" : "Create account"}
          </button>
        </div>
      </div>

      <div style={{ marginTop:16, fontSize:12, color:T.textDim }}>
        BUILT FOR MOTORSPORTS PROFESSIONALS 🏁
      </div>
    </div>
  );
}