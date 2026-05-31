import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const ALL_TAGS = ["oval","road course","street circuit","gt3","hypercar","24hr","open wheel","motorcycle"];

const SERIES_OPTIONS = ["F1","F2","F3","IndyCar","Formula E","WEC","IMSA","ELMS","ALMS","SRO","Nurburgring","24hr","NASCAR","Off-Road","Pikes Peak","MotoGP","GridLife","Car Week","Ferrari Chall.","Cultural","Formula Drift","Personal"];

const EMPTY_EVENT = { year:2026, series:"IMSA", name:"", circuit:"", country:"USA", date:"", end_date:"", intl:false, camp:false, status:"upcoming", url:"", sessions:"", tags:[] };

export default function AdminPanel({ T, onClose }) {
  const [adminTab, setAdminTab] = useState("events");
  const [seriesColors, setSeriesColors] = useState([]);
  const [colorPickerSeries, setColorPickerSeries] = useState(null);

  const COLOR_PALETTE = [
    "#E8002D", "#E8502A", "#FFB800", "#F5E642",
    "#3DAA4E", "#00A859", "#0D7A5F", "#00AAFF",
    "#4A7FC1", "#1B5EA6", "#6B3FA0", "#E84C9B",
    "#B86B1B", "#888888", "#444444", "#CCCCCC",
  ];

  useEffect(() => {
    if (adminTab === "colors") {
      supabase.from("series_colors").select("series, color").order("series")
        .then(({ data }) => { if (data) setSeriesColors(data); });
    }
  }, [adminTab]);

  const saveAdminColor = async (series, color) => {
    await supabase.from("series_colors").upsert({ series, color }, { onConflict: "series" });
    setSeriesColors(prev => prev.map(r => r.series === series ? { ...r, color } : r));
  };
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // event object being edited
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("all");

  const inpSty = { width:"100%", background:T.bgInput, border:`1px solid ${T.border2}`, borderRadius:5, padding:"6px 9px", color:T.text, fontSize:12, boxSizing:"border-box" };
  const labelSty = { fontSize:11, color:T.textDim, marginBottom:3 };

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    const { data } = await supabase.from("master_events").select("*").order("date");
    if (data) setEvents(data);
    setLoading(false);
  };

  const startEdit = (e) => {
    setEditing(e);
    setAdding(false);
    setForm({
      year: e.year, series: e.series, name: e.name, circuit: e.circuit || "", tags: e.tags || [],
      country: e.country || "USA", date: e.date, end_date: e.end_date || "",
      intl: e.intl || false, camp: e.camp || false, status: e.status || "upcoming",
      url: e.url || "", sessions: e.sessions ? JSON.stringify(e.sessions) : ""
    });
  };

  const startAdd = () => {
    setAdding(true);
    setEditing(null);
    setForm(EMPTY_EVENT);
  };

  const cancel = () => { setEditing(null); setAdding(false); setForm(EMPTY_EVENT); };

  const save = async () => {
    if (!form.name || !form.date) return;
    setSaving(true);
    let sessions = null;
    try { if (form.sessions) sessions = JSON.parse(form.sessions); } catch {}

    const payload = {
      year: parseInt(form.year), series: form.series, name: form.name,
      circuit: form.circuit, country: form.country, date: form.date,
      end_date: form.end_date || null, intl: form.intl, camp: form.camp,
      status: form.status, url: form.url || null, sessions
    };

    if (editing) {
      await supabase.from("master_events").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("master_events").upsert(payload, { onConflict: "series,name,date", ignoreDuplicates: false });
    }

    await loadEvents();
    cancel();
    setSaving(false);
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event? This affects all users.")) return;
    await supabase.from("master_events").delete().eq("id", id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const filtered = events.filter(e => {
    if (filterYear !== "all" && e.year !== parseInt(filterYear)) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.series.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:300, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"20px 16px", overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.bgModal, border:`1px solid ${T.border2}`, borderRadius:14, width:"100%", maxWidth:700, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:"18px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:T.text }}>Admin Panel</div>
            <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>Manage master events — changes affect all users</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textDim, fontSize:18, cursor:"pointer" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, padding:"0 20px" }}>
          {[["events","Events"],["colors","Series Colors"]].map(([tab,label]) => (
            <button key={tab} onClick={()=>setAdminTab(tab)} style={{ padding:"10px 16px", background:"none", border:"none", borderBottom:`2px solid ${adminTab===tab?"#E8502A":"transparent"}`, color:adminTab===tab?T.text:T.textDim, fontSize:13, fontWeight:adminTab===tab?600:400, cursor:"pointer" }}>{label}</button>
          ))}
        </div>

        {/* Colors Tab */}
        {adminTab === "colors" && (
          <div style={{ padding:"18px 20px" }}>
            <div style={{ fontSize:12, color:T.textDim, marginBottom:14 }}>Click a color swatch to change it globally for all users (unless they have a personal override).</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {seriesColors.map(({ series, color }) => (
                <div key={series} style={{ display:"flex", alignItems:"center", gap:12, padding:"6px 10px", borderRadius:7, background:T.bgCard, border:`1px solid ${T.border}` }}>
                  <div onClick={()=>setColorPickerSeries(colorPickerSeries===series?null:series)} style={{ width:24, height:24, borderRadius:5, background:color, cursor:"pointer", border:`2px solid ${T.border2}`, flexShrink:0 }} />
                  <span style={{ fontSize:13, color:T.text, flex:1 }}>{series}</span>
                  <span style={{ fontSize:11, color:T.textDim }}>{color}</span>
                </div>
              ))}
            </div>
            {colorPickerSeries && (
              <div style={{ marginTop:16, padding:14, background:T.bgCard, borderRadius:10, border:`1px solid ${T.border2}` }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:10 }}>Editing: {colorPickerSeries}</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:8 }}>
                  {COLOR_PALETTE.map(col => (
                    <div key={col} onClick={()=>{ saveAdminColor(colorPickerSeries, col); setColorPickerSeries(null); }}
                      style={{ aspectRatio:"1/1", borderRadius:5, background:col, cursor:"pointer", border: seriesColors.find(r=>r.series===colorPickerSeries)?.color===col?"3px solid white":"2px solid transparent" }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit / Add form */}
        {adminTab === "events" && (editing || adding) && (
          <div style={{ padding:"18px 20px", borderBottom:`1px solid ${T.border}`, background:T.bg }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:14 }}>{editing ? `Editing: ${editing.name}` : "Add new event"}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <div style={labelSty}>Event name *</div>
                <input style={inpSty} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rolex 24 at Daytona" />
              </div>
              <div>
                <div style={labelSty}>Series</div>
                <select style={inpSty} value={form.series} onChange={e=>setForm(f=>({...f,series:e.target.value}))}>
                  {SERIES_OPTIONS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={labelSty}>Year</div>
                <select style={inpSty} value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))}>
                  {[2026,2027,2028].map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <div style={labelSty}>Circuit / Venue</div>
                <input style={inpSty} value={form.circuit} onChange={e=>setForm(f=>({...f,circuit:e.target.value}))} placeholder="e.g. Daytona International Speedway" />
              </div>
              <div>
                <div style={labelSty}>Country</div>
                <input style={inpSty} value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value}))} />
              </div>
              <div>
                <div style={labelSty}>Start date *</div>
                <input type="date" style={{...inpSty, colorScheme:"dark"}} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
              </div>
              <div>
                <div style={labelSty}>End date</div>
                <input type="date" style={{...inpSty, colorScheme:"dark"}} value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} />
              </div>
              <div>
                <div style={labelSty}>Status</div>
                <select style={inpSty} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="upcoming">Upcoming</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <div style={labelSty}>Official URL</div>
                <input style={inpSty} value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} placeholder="https://..." />
              </div>
              <div style={{ gridColumn:"1/-1", display:"flex", gap:20 }}>
                <label style={{ display:"flex", gap:6, alignItems:"center", fontSize:12, color:T.textMid, cursor:"pointer" }}>
                  <input type="checkbox" checked={form.intl} onChange={e=>setForm(f=>({...f,intl:e.target.checked}))} /> ✈ International
                </label>
                <label style={{ display:"flex", gap:6, alignItems:"center", fontSize:12, color:T.textMid, cursor:"pointer" }}>
                  <input type="checkbox" checked={form.camp} onChange={e=>setForm(f=>({...f,camp:e.target.checked}))} /> ⛺ Campable
                </label>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <div style={labelSty}>Tags</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                  {ALL_TAGS.map(tag => {
                    const active = (form.tags||[]).includes(tag);
                    return (
                      <div key={tag} onClick={()=>setForm(f=>({ ...f, tags: active ? (f.tags||[]).filter(t=>t!==tag) : [...(f.tags||[]), tag] }))}
                        style={{ fontSize:11, padding:"3px 10px", borderRadius:10, border:`1px solid ${active?"#E8502A":"#444"}`, background:active?"#E8502A22":"transparent", color:active?"#E8502A":"#aaa", cursor:"pointer", userSelect:"none" }}>
                        {tag}
                      </div>
                    );
                  })}
                </div>
                <div style={labelSty}>Sessions (JSON) — optional</div>
                <textarea style={{ ...inpSty, height:70, resize:"vertical", fontFamily:"monospace", fontSize:11 }}
                  value={form.sessions} onChange={e=>setForm(f=>({...f,sessions:e.target.value}))}
                  placeholder='[{"label":"Race","date":"2026-01-01","time":"1:00 PM ET"}]' />
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button onClick={cancel} style={{ flex:1, padding:"8px", borderRadius:6, border:`1px solid ${T.border2}`, background:T.bgCard, color:T.textMid, fontSize:12, cursor:"pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex:2, padding:"8px", borderRadius:6, border:"none", background:"linear-gradient(135deg,#E8502A,#B02010)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", opacity:saving?0.7:1 }}>
                {saving ? "Saving..." : editing ? "Save changes" : "Add event"}
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events…" style={{ ...inpSty, width:180 }} />
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} style={{ ...inpSty, width:100 }}>
            <option value="all">All years</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
          <div style={{ marginLeft:"auto" }}>
            <button onClick={startAdd} style={{ padding:"7px 14px", borderRadius:6, border:"1px solid #3DAA4E40", background:"#3DAA4E20", color:"#3DAA4E", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Add event</button>
          </div>
          <div style={{ fontSize:11, color:T.textDim }}>{filtered.length} events</div>
        </div>

        {adminTab === "events" && <div style={{ maxHeight:400, overflowY:"auto" }}>
          {loading ? (
            <div style={{ padding:40, textAlign:"center", color:T.textDim }}>Loading...</div>
          ) : filtered.map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.name}</div>
                <div style={{ fontSize:11, color:T.textDim }}>{e.series} · {e.date}{e.end_date ? ` → ${e.end_date}` : ""} · {e.country}</div>
              </div>
              <span style={{ fontSize:10, padding:"2px 6px", borderRadius:3, background:e.status==="done"?"#3DAA4E20":e.status==="cancelled"?"#E8502A20":"#6A9FD820", color:e.status==="done"?"#3DAA4E":e.status==="cancelled"?"#E8502A":"#6A9FD8" }}>{e.status}</span>
              <button onClick={()=>startEdit(e)} style={{ padding:"4px 10px", borderRadius:5, border:`1px solid ${T.border2}`, background:T.bgCard, color:T.textMid, fontSize:11, cursor:"pointer" }}>Edit</button>
              <button onClick={()=>deleteEvent(e.id)} style={{ padding:"4px 10px", borderRadius:5, border:"1px solid #E8502A40", background:"#E8502A15", color:"#E8502A", fontSize:11, cursor:"pointer" }}>Delete</button>
            </div>
          ))}
        </div>}

      </div>
    </div>
  );
}
