import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY  = "wj_trades_v3";
const EQUITY_KEY   = "wj_init_equity";
const SESSIONS     = ["Asia", "London", "New York", "London+NY", "Pre-Market"];
const TRENDS       = ["Bullish", "Bearish", "Sideways"];
const POSITIONS    = ["Long", "Short"];
const TIMEFRAMES   = ["M1","M5","M15","M30","H1","H4","D1","W1"];
const RESULTS      = ["Win","Lose","Break Even"];
const MONTHS_ID    = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAYS_ID      = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const BLANK_FORM   = { date:"", session:"London", time:"", pair:"", trend:"Bullish", position:"Long", tf:"H1", playbook:"", duration:"", pnl:"", result:"Win", plan:"", evalNote:"" };

const SAMPLE_TRADES = [
  { id:"s1", date:"2025-04-07", session:"London",   time:"09:15", pair:"XAUUSD", trend:"Bullish", position:"Long",  tf:"H1",  playbook:"OB Retest",          duration:"3h 20m", pnl:250,  result:"Win",  plan:"Buy dip on OB zone",          evalNote:"Perfect entry, TP hit." },
  { id:"s2", date:"2025-04-08", session:"New York", time:"14:30", pair:"EURUSD", trend:"Bearish", position:"Short", tf:"H4",  playbook:"BOS + CHoCH",         duration:"1h 45m", pnl:-120, result:"Lose", plan:"Short on CHoCH confirmation", evalNote:"SL hit by spike, reassess." },
  { id:"s3", date:"2025-04-09", session:"London",   time:"10:00", pair:"XAUUSD", trend:"Bullish", position:"Long",  tf:"H1",  playbook:"FVG Fill",             duration:"2h 10m", pnl:380,  result:"Win",  plan:"FVG mitigation",              evalNote:"Held overnight, great R." },
  { id:"s4", date:"2025-04-10", session:"Asia",     time:"05:30", pair:"GBPUSD", trend:"Bearish", position:"Short", tf:"M15", playbook:"Liquidity Sweep",      duration:"45m",    pnl:-85,  result:"Lose", plan:"Sell liquidity sweep",        evalNote:"NY session reversed fast." },
  { id:"s5", date:"2025-04-14", session:"New York", time:"15:00", pair:"XAUUSD", trend:"Bullish", position:"Long",  tf:"H4",  playbook:"Weekly High Retrace",  duration:"5h",     pnl:520,  result:"Win",  plan:"Weekly high retest",          evalNote:"Best trade of the month." },
  { id:"s6", date:"2025-04-16", session:"London",   time:"09:45", pair:"BTCUSD", trend:"Bullish", position:"Long",  tf:"H1",  playbook:"OB Retest",            duration:"2h",     pnl:430,  result:"Win",  plan:"Crypto OB on H1",             evalNote:"Confluence with weekly bias." },
  { id:"s7", date:"2025-04-17", session:"Asia",     time:"04:00", pair:"USDJPY", trend:"Bearish", position:"Short", tf:"H4",  playbook:"Trend Continuation",   duration:"6h",     pnl:195,  result:"Win",  plan:"Short after rejection",       evalNote:"Clean move, patience paid." },
  { id:"s8", date:"2025-04-22", session:"London",   time:"11:00", pair:"XAUUSD", trend:"Bearish", position:"Short", tf:"H1",  playbook:"FVG Fill",             duration:"1h 30m", pnl:-210, result:"Lose", plan:"Bearish FVG fill",            evalNote:"Gold reversed aggressively." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today  = () => new Date().toISOString().split("T")[0];
const fmtUSD = (n, showSign = false) => {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
  if (!showSign) return `$${abs}`;
  return `${n >= 0 ? "+" : "-"}$${abs}`;
};
const pct = (n, base) => ((n / base) * 100).toFixed(2) + "%";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:        "#080d1a",
  card:      "#0d1526",
  surface:   "#111d34",
  border:    "rgba(255,255,255,0.07)",
  border2:   "rgba(255,255,255,0.12)",
  green:     "#00d68f",
  greenDim:  "rgba(0,214,143,0.12)",
  red:       "#ff4d4d",
  redDim:    "rgba(255,77,77,0.12)",
  amber:     "#f5a623",
  blue:      "#4f9cf9",
  blueDim:   "rgba(79,156,249,0.12)",
  purple:    "#a78bfa",
  gray:      "#4b5679",
  muted:     "#8892a4",
  text:      "#dde3f0",
  textBright:"#f4f7ff",
};

// ─── Statistics ───────────────────────────────────────────────────────────────
function calcStats(trades, initEquity) {
  const n = trades.length;
  if (!n) return { n:0, wins:0, losses:0, be:0, wr:"0.0", totalPnl:0, avgWin:0, avgLoss:0, rr:"—", equity:initEquity, pf:"—", maxDD:0, maxDDPct:"0.0", streak:0, streakType:"—", bestTrade:0, worstTrade:0 };
  const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
  const wins   = sorted.filter(t => t.result === "Win");
  const losses = sorted.filter(t => t.result === "Lose");
  const be     = sorted.filter(t => t.result === "Break Even");
  const totalPnl = sorted.reduce((s,t) => s + (t.pnl||0), 0);
  const avgWin   = wins.length   ? wins.reduce((s,t)=>s+t.pnl,0)/wins.length   : 0;
  const avgLoss  = losses.length ? Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length) : 0;
  const grossW   = wins.reduce((s,t)=>s+t.pnl,0);
  const grossL   = Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
  let peak = initEquity, eq = initEquity, maxDD = 0;
  sorted.forEach(t => { eq+=(t.pnl||0); if(eq>peak)peak=eq; const dd=peak-eq; if(dd>maxDD)maxDD=dd; });
  let streak = 0, streakType = "—";
  for (let i = sorted.length-1; i >= 0; i--) {
    const r = sorted[i].result;
    if (r==="Break Even") break;
    if (streak===0) { streakType=r; streak=1; } else if (r===streakType) streak++; else break;
  }
  return {
    n, wins:wins.length, losses:losses.length, be:be.length,
    wr:(wins.length/n*100).toFixed(1),
    totalPnl:parseFloat(totalPnl.toFixed(2)),
    avgWin:parseFloat(avgWin.toFixed(2)),
    avgLoss:parseFloat(avgLoss.toFixed(2)),
    rr: avgLoss ? (avgWin/avgLoss).toFixed(2) : "∞",
    equity:parseFloat((initEquity+totalPnl).toFixed(2)),
    pf: grossL ? (grossW/grossL).toFixed(2) : grossW>0?"∞":"—",
    maxDD:parseFloat(maxDD.toFixed(2)), maxDDPct:(maxDD/initEquity*100).toFixed(1),
    streak, streakType,
    bestTrade:  Math.max(...sorted.map(t=>t.pnl||0)),
    worstTrade: Math.min(...sorted.map(t=>t.pnl||0)),
  };
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const inputSt = {
  background:"#111d34", border:"1px solid rgba(255,255,255,0.09)",
  borderRadius:7, padding:"8px 11px", color:"#dde3f0",
  fontSize:12, fontFamily:"'DM Mono','Fira Code',monospace", width:"100%", outline:"none",
};
const btnPri = {
  background:"linear-gradient(135deg,#00d68f,#4f9cf9)",
  border:"none", borderRadius:8, padding:"10px 20px",
  color:"#fff", fontSize:12, fontWeight:700, letterSpacing:"0.8px",
  textTransform:"uppercase", cursor:"pointer", fontFamily:"'DM Mono','Fira Code',monospace",
};
const btnSec = {
  background:"transparent", border:"1px solid rgba(255,255,255,0.09)",
  borderRadius:8, padding:"10px 20px", color:"#8892a4",
  fontSize:12, cursor:"pointer", fontFamily:"'DM Mono','Fira Code',monospace",
};
const btnDng = {
  background:"rgba(255,77,77,0.12)", border:"1px solid rgba(255,77,77,0.25)",
  borderRadius:8, padding:"10px 20px", color:"#ff4d4d",
  fontSize:12, cursor:"pointer", fontFamily:"'DM Mono','Fira Code',monospace",
};
const thSt = {
  background:"#111d34", color:"#4b5679", fontSize:10,
  letterSpacing:"0.7px", textTransform:"uppercase",
  padding:"10px 12px", textAlign:"left",
  borderBottom:"1px solid rgba(255,255,255,0.07)",
  fontFamily:"'DM Mono','Fira Code',monospace",
};
const tdSt = { padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.04)", color:"#8892a4" };

// ─── Sub-components ───────────────────────────────────────────────────────────
function Badge({ type }) {
  const map = {
    Win:         { bg:"rgba(0,214,143,0.15)",  color:C.green },
    Lose:        { bg:"rgba(255,77,77,0.15)",   color:C.red   },
    "Break Even":{ bg:"rgba(75,86,121,0.3)",    color:C.muted },
    Long:        { bg:"rgba(79,156,249,0.15)",  color:C.blue  },
    Short:       { bg:"rgba(245,166,35,0.15)",  color:C.amber },
  };
  const s = map[type] || { bg:"rgba(255,255,255,0.08)", color:C.muted };
  return <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, letterSpacing:"0.4px", background:s.bg, color:s.color }}>{type}</span>;
}

function MetricCard({ label, value, sub, color, accent, onClick }) {
  return (
    <div onClick={onClick} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px", borderLeft:accent?`3px solid ${accent}`:undefined, cursor:onClick?"pointer":"default" }}>
      <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.9px", textTransform:"uppercase", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:color||C.textBright, letterSpacing:"-0.5px", lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.gray, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1a2540", border:`1px solid ${C.border2}`, borderRadius:8, padding:"8px 12px", fontSize:11 }}>
      <div style={{ color:C.muted, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||C.green, fontWeight:600 }}>
          {p.name}: {typeof p.value==="number" ? fmtUSD(p.value, p.value!==0) : p.value}
        </div>
      ))}
    </div>
  );
}

function Toast({ msg, type }) {
  return (
    <div style={{ position:"fixed", top:16, right:16, zIndex:9999, background:type==="error"?C.red:C.green, color:"#fff", borderRadius:8, padding:"10px 18px", fontSize:12, fontWeight:700, letterSpacing:"0.5px", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", animation:"slideIn .2s ease" }}>
      {msg}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <div style={{ fontSize:10, color:"#4b5679", letterSpacing:"0.8px", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Editable Equity Modal ────────────────────────────────────────────────────
function EquityModal({ current, onSave, onClose }) {
  const [val, setVal] = useState(String(current));
  const parsed = parseFloat(val);
  const valid  = !isNaN(parsed) && parsed > 0;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:14, padding:"28px 32px", width:380, boxShadow:"0 24px 64px rgba(0,0,0,0.6)", animation:"fadeUp .2s ease" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:C.textBright, marginBottom:4 }}>✏️ Edit Initial Equity</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6 }}>Ubah modal awal. Semua perhitungan equity curve & % gain akan otomatis menyesuaikan.</div>
        <FormField label="Initial Equity ($)">
          <input autoFocus type="number" min="1" step="100" value={val} onChange={e=>setVal(e.target.value)}
            style={{ ...inputSt, marginBottom:6, fontSize:20, fontWeight:700, color:valid?C.green:C.red }} />
        </FormField>
        {!valid && <div style={{ fontSize:11, color:C.red, marginBottom:8 }}>Masukkan angka valid (&gt; 0)</div>}
        <div style={{ fontSize:12, color:C.muted, marginBottom:20, marginTop:8 }}>
          Initial equity baru: <span style={{ color:valid?C.textBright:C.muted, fontWeight:600 }}>{valid?fmtUSD(parsed):"—"}</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...btnPri, flex:1, opacity:valid?1:0.4 }} disabled={!valid} onClick={()=>valid&&onSave(parsed)}>Simpan</button>
          <button style={{ ...btnSec, flex:1 }} onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Trade Detail Drawer ──────────────────────────────────────────────────────
function TradeDrawer({ trade, initEquity, onClose, onDelete, onEdit }) {
  if (!trade) return null;
  const gainPct = ((trade.pnl / initEquity) * 100).toFixed(2);
  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:150 }} onClick={onClose} />
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:360, background:C.card, borderLeft:`1px solid ${C.border2}`, zIndex:151, overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:14, animation:"slideIn .25s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:C.textBright, letterSpacing:"-0.5px" }}>{trade.pair}</div>
            <div style={{ display:"flex", gap:6, marginTop:7 }}><Badge type={trade.position} /><Badge type={trade.result} /></div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:20, padding:4 }}>✕</button>
        </div>

        <div style={{ background:trade.pnl>=0?C.greenDim:C.redDim, border:`1px solid ${trade.pnl>=0?"rgba(0,214,143,0.2)":"rgba(255,77,77,0.2)"}`, borderRadius:10, padding:"16px 18px", textAlign:"center" }}>
          <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase", marginBottom:4 }}>Net PnL</div>
          <div style={{ fontSize:34, fontWeight:700, color:trade.pnl>=0?C.green:C.red, letterSpacing:"-1px" }}>{fmtUSD(trade.pnl, true)}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{trade.pnl>=0?"+":""}{gainPct}% of initial equity</div>
        </div>

        {[
          ["Date",       trade.date      || "—"],
          ["Session",    trade.session   || "—"],
          ["Entry Time", trade.time      || "—"],
          ["Timeframe",  trade.tf],
          ["Trend",      trade.trend],
          ["Duration",   trade.duration  || "—"],
          ["Playbook",   trade.playbook  || "—"],
        ].map(([label, value]) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:10, color:C.muted, letterSpacing:"0.5px", textTransform:"uppercase" }}>{label}</span>
            <span style={{ fontSize:12, color:C.text, fontWeight:500 }}>{value}</span>
          </div>
        ))}

        {trade.plan && (
          <div>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase", marginBottom:6 }}>Trade Plan</div>
            <div style={{ fontSize:12, color:C.text, background:C.surface, borderRadius:8, padding:"10px 12px", lineHeight:1.7 }}>{trade.plan}</div>
          </div>
        )}
        {trade.evalNote && (
          <div>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase", marginBottom:6 }}>Evaluasi</div>
            <div style={{ fontSize:12, color:C.text, background:C.surface, borderRadius:8, padding:"10px 12px", lineHeight:1.7 }}>{trade.evalNote}</div>
          </div>
        )}

        <div style={{ display:"flex", gap:8, marginTop:"auto", paddingTop:8 }}>
          <button style={{ ...btnPri, flex:1, fontSize:11 }} onClick={()=>onEdit(trade)}>✏️ Edit</button>
          <button style={{ ...btnDng, flex:1, fontSize:11 }} onClick={()=>{ onDelete(trade.id); onClose(); }}>🗑 Hapus</button>
        </div>
      </div>
    </>
  );
}

// ─── Edit Trade Modal ─────────────────────────────────────────────────────────
function EditModal({ trade, onSave, onClose }) {
  const [form, setForm] = useState({ ...trade, pnl:String(trade.pnl) });
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const save = () => {
    const pnlNum = parseFloat(form.pnl);
    if (!form.pair.trim()) return;
    onSave({ ...form, pair:form.pair.toUpperCase().trim(), pnl:isNaN(pnlNum)?0:pnlNum });
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:210, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:14, padding:24, width:"100%", maxWidth:620, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.7)", animation:"fadeUp .2s ease" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:14, fontWeight:700, color:C.textBright, marginBottom:20 }}>✏️ Edit Trade — {trade.pair}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:12 }}>
          <FormField label="Date"><input type="date" style={inputSt} value={form.date} onChange={set("date")} /></FormField>
          <FormField label="Session"><select style={inputSt} value={form.session} onChange={set("session")}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></FormField>
          <FormField label="Entry Time"><input type="time" style={inputSt} value={form.time} onChange={set("time")} /></FormField>
          <FormField label="Pair"><input type="text" style={inputSt} value={form.pair} onChange={set("pair")} /></FormField>
          <FormField label="Trend"><select style={inputSt} value={form.trend} onChange={set("trend")}>{TRENDS.map(t=><option key={t}>{t}</option>)}</select></FormField>
          <FormField label="Position"><select style={inputSt} value={form.position} onChange={set("position")}>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></FormField>
          <FormField label="Timeframe"><select style={inputSt} value={form.tf} onChange={set("tf")}>{TIMEFRAMES.map(t=><option key={t}>{t}</option>)}</select></FormField>
          <FormField label="Playbook"><input type="text" style={inputSt} value={form.playbook} onChange={set("playbook")} /></FormField>
          <FormField label="Duration"><input type="text" style={inputSt} value={form.duration} onChange={set("duration")} /></FormField>
          <FormField label="PnL ($)"><input type="number" style={{ ...inputSt, color:parseFloat(form.pnl)>=0?C.green:C.red, fontWeight:700 }} step="0.01" value={form.pnl} onChange={set("pnl")} /></FormField>
          <FormField label="Result"><select style={inputSt} value={form.result} onChange={set("result")}>{RESULTS.map(r=><option key={r}>{r}</option>)}</select></FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:18 }}>
          <FormField label="Trade Plan"><textarea style={{ ...inputSt, minHeight:70, resize:"vertical" }} value={form.plan} onChange={set("plan")} /></FormField>
          <FormField label="Evaluasi"><textarea style={{ ...inputSt, minHeight:70, resize:"vertical" }} value={form.evalNote} onChange={set("evalNote")} /></FormField>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...btnPri, flex:1 }} onClick={save}>Simpan Perubahan</button>
          <button style={{ ...btnSec, flex:1 }} onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TradingJournal() {
  const [trades,      setTrades]      = useState(() => { try { const s=localStorage.getItem(STORAGE_KEY); return s?JSON.parse(s):SAMPLE_TRADES; } catch { return SAMPLE_TRADES; } });
  const [initEquity,  setInitEquity]  = useState(() => { try { return parseFloat(localStorage.getItem(EQUITY_KEY))||10000; } catch { return 10000; } });
  const [tab,         setTab]         = useState("dashboard");
  const [toast,       setToast]       = useState(null);
  const [showEqModal, setShowEqModal] = useState(false);
  const [drawer,      setDrawer]      = useState(null);
  const [editTrade,   setEditTrade]   = useState(null);
  const [form,        setForm]        = useState({ ...BLANK_FORM, date:today() });
  const [filterPair,       setFilterPair]      = useState("");
  const [filterResult,     setFilterResult]    = useState("");
  const [filterPosition,   setFilterPosition]  = useState("");
  const [sortKey,     setSortKey]     = useState("date");
  const [sortDir,     setSortDir]     = useState("desc");
  const [calMonth,    setCalMonth]    = useState(new Date().getMonth());
  const [calYear,     setCalYear]     = useState(new Date().getFullYear());
  const [calDetail,   setCalDetail]   = useState(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(trades)); }, [trades]);
  useEffect(() => { localStorage.setItem(EQUITY_KEY, String(initEquity)); }, [initEquity]);

  const showToast = useCallback((msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const stats = useMemo(() => calcStats(trades, initEquity), [trades, initEquity]);

  const equityCurve = useMemo(() => {
    const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
    let eq = initEquity;
    return [
      { name:"Start", equity:initEquity, pnl:0 },
      ...sorted.map((t,i) => { eq+=(t.pnl||0); return { name:`#${i+1}`, equity:parseFloat(eq.toFixed(2)), pnl:t.pnl, pair:t.pair }; })
    ];
  }, [trades, initEquity]);

  const pnlBars = useMemo(() =>
    [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-30).map((t,i)=>({ name:`#${i+1}`, pnl:t.pnl, pair:t.pair, result:t.result })),
    [trades]);

  const winLosePie = useMemo(() => [
    { name:"Win",  value:stats.wins,   color:C.green },
    { name:"Lose", value:stats.losses, color:C.red   },
    { name:"BE",   value:stats.be,     color:C.gray  },
  ].filter(d=>d.value>0), [stats]);

  const pairBars = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      if (!map[t.pair]) map[t.pair]={ pair:t.pair, pnl:0, count:0 };
      map[t.pair].pnl+=(t.pnl||0); map[t.pair].count++;
    });
    return Object.values(map).sort((a,b)=>b.pnl-a.pnl).map(d=>({ ...d, pnl:parseFloat(d.pnl.toFixed(2)) }));
  }, [trades]);

  const pairs = useMemo(() => [...new Set(trades.map(t=>t.pair))], [trades]);

  const equityMap = useMemo(() => {
    const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
    let eq = initEquity; const m = {};
    sorted.forEach(t => { eq+=(t.pnl||0); m[t.id]=parseFloat(eq.toFixed(2)); });
    return m;
  }, [trades, initEquity]);

  const filteredTrades = useMemo(() => {
    let list = trades.filter(t =>
      (!filterPair     || t.pair     === filterPair)    &&
      (!filterResult   || t.result   === filterResult)  &&
      (!filterPosition || t.position === filterPosition)
    );
    return list.sort((a,b) => {
      let va = sortKey==="pnl" ? a.pnl : sortKey==="date" ? new Date(a.date||0) : a[sortKey];
      let vb = sortKey==="pnl" ? b.pnl : sortKey==="date" ? new Date(b.date||0) : b[sortKey];
      if (va<vb) return sortDir==="asc"?-1:1;
      if (va>vb) return sortDir==="asc"?1:-1;
      return 0;
    });
  }, [trades, filterPair, filterResult, filterPosition, sortKey, sortDir]);

  const toggleSort = key => {
    if (sortKey===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const dayMap = useMemo(() => {
    const m = {};
    trades.forEach(t => {
      if (!t.date) return;
      if (!m[t.date]) m[t.date]={ wins:0, losses:0, pnl:0, trades:[] };
      if (t.result==="Win")  m[t.date].wins++;
      if (t.result==="Lose") m[t.date].losses++;
      m[t.date].pnl+=(t.pnl||0);
      m[t.date].trades.push(t);
    });
    return m;
  }, [trades]);

  // Handlers
  const addTrade = () => {
    if (!form.pair.trim()) { showToast("Pair wajib diisi!", "error"); return; }
    const t = { ...form, id:uid(), pair:form.pair.toUpperCase().trim(), pnl:parseFloat(form.pnl)||0 };
    setTrades(prev=>[...prev,t]);
    setForm({ ...BLANK_FORM, date:today() });
    showToast("Trade berhasil ditambahkan! ✓");
    setTab("log");
  };
  const deleteTrade = id => {
    if (!window.confirm("Hapus trade ini?")) return;
    setTrades(prev=>prev.filter(t=>t.id!==id));
    showToast("Trade dihapus.", "error");
  };
  const saveEdit = updated => {
    setTrades(prev=>prev.map(t=>t.id===updated.id?updated:t));
    setEditTrade(null); setDrawer(updated);
    showToast("Trade diperbarui. ✓");
  };
  const resetAll = () => {
    if (!window.confirm("Reset semua trade? Data tidak bisa dikembalikan.")) return;
    setTrades([]); showToast("Data direset.", "error");
  };

  const SortTh = ({ col, label }) => (
    <th style={{ ...thSt, cursor:"pointer", userSelect:"none" }} onClick={()=>toggleSort(col)}>
      {label} {sortKey===col?(sortDir==="asc"?"↑":"↓"):<span style={{opacity:0.3}}>↕</span>}
    </th>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'DM Mono','Fira Code','Courier New',monospace", color:C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=time]::-webkit-calendar-picker-indicator { filter:invert(0.6); cursor:pointer; }
        select option { background:#111d34; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:4px; }
        input:focus, select:focus, textarea:focus { border-color:rgba(0,214,143,0.4) !important; }
        button:active { transform:scale(0.97); }
        tr:hover td { background:rgba(255,255,255,0.02); }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {showEqModal && <EquityModal current={initEquity} onSave={v=>{setInitEquity(v);setShowEqModal(false);showToast(`Initial equity → ${fmtUSD(v)} ✓`);}} onClose={()=>setShowEqModal(false)} />}
      {drawer && !editTrade && <TradeDrawer trade={drawer} initEquity={initEquity} onClose={()=>setDrawer(null)} onDelete={deleteTrade} onEdit={t=>setEditTrade(t)} />}
      {editTrade && <EditModal trade={editTrade} onSave={saveEdit} onClose={()=>setEditTrade(null)} />}

      {/* Header */}
      <header style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:34, height:34, borderRadius:8, background:"linear-gradient(135deg,#00d68f,#4f9cf9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>📈</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:C.textBright, letterSpacing:"0.3px" }}>TRADING JOURNAL</div>
            <div style={{ fontSize:10, color:C.gray, letterSpacing:"1.2px", textTransform:"uppercase" }}>@wijdan_finance</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {/* Equity — clickable to edit */}
          <button onClick={()=>setShowEqModal(true)} title="Klik untuk edit initial equity"
            style={{ background:"rgba(0,214,143,0.1)", border:"1px solid rgba(0,214,143,0.25)", borderRadius:7, padding:"6px 14px", fontSize:12, color:C.green, fontWeight:700, letterSpacing:"0.4px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" }}>
            <span style={{ fontSize:9, opacity:0.7, textTransform:"uppercase", letterSpacing:"1px" }}>Equity</span>
            {fmtUSD(stats.equity)}
            <span style={{ fontSize:9, background:"rgba(0,214,143,0.15)", border:"1px solid rgba(0,214,143,0.3)", borderRadius:3, padding:"1px 5px", letterSpacing:"0.5px" }}>EDIT</span>
          </button>
          <div style={{ fontSize:11, color:C.gray }}>Init: <span style={{ color:C.muted }}>{fmtUSD(initEquity)}</span></div>
          <button style={{ ...btnSec, padding:"6px 12px", fontSize:11 }} onClick={resetAll}>Reset</button>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", gap:2, overflowX:"auto" }}>
        {[
          { id:"dashboard", label:"Dashboard" },
          { id:"log",       label:`Log (${trades.length})` },
          { id:"add",       label:"+ Add" },
          { id:"calendar",  label:"Calendar" },
          { id:"stats",     label:"Analytics" },
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"12px 16px", background:"none", border:"none", cursor:"pointer", color:tab===t.id?C.green:C.gray, borderBottom:`2px solid ${tab===t.id?C.green:"transparent"}`, fontSize:11, fontWeight:500, letterSpacing:"0.8px", textTransform:"uppercase", transition:"all .15s", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ padding:24 }}>

        {/* ════ DASHBOARD ════ */}
        {tab==="dashboard" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:12 }}>
              <MetricCard label="Total Trades"  value={stats.n}              sub={`${stats.wins}W / ${stats.losses}L / ${stats.be}BE`} />
              <MetricCard label="Win Rate"       value={`${stats.wr}%`}      color={parseFloat(stats.wr)>=50?C.green:C.red} sub={`${stats.wins} wins`} accent={parseFloat(stats.wr)>=50?C.green:C.red} />
              <MetricCard label="Total PnL"      value={fmtUSD(Math.abs(stats.totalPnl))} color={stats.totalPnl>=0?C.green:C.red} sub={`${stats.totalPnl>=0?"+":"-"}${pct(Math.abs(stats.totalPnl),initEquity)}`} accent={stats.totalPnl>=0?C.green:C.red} />
              <MetricCard label="Current Equity" value={fmtUSD(stats.equity)} sub={`Init ${fmtUSD(initEquity)}`} onClick={()=>setShowEqModal(true)} />
              <MetricCard label="Profit Factor"  value={stats.pf}             color={parseFloat(stats.pf)>=1?C.green:C.red} />
              <MetricCard label="Risk : Reward"  value={`1 : ${stats.rr}`} />
              <MetricCard label="Max Drawdown"   value={fmtUSD(stats.maxDD)} color={C.red} sub={`${stats.maxDDPct}% of equity`} />
              <MetricCard label="Streak"         value={`${stats.streak}×`}  color={stats.streakType==="Win"?C.green:stats.streakType==="Lose"?C.red:C.gray} sub={stats.streakType} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>Equity Curve</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={equityCurve}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00d68f" stopOpacity={0.18}/>
                        <stop offset="95%" stopColor="#00d68f" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:C.gray }} />
                    <YAxis tick={{ fontSize:10, fill:C.gray }} tickFormatter={v=>"$"+v.toLocaleString()} width={72} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine y={initEquity} stroke={C.gray} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="equity" stroke={C.green} strokeWidth={2} fill="url(#eqGrad)" dot={{ r:3, fill:C.green, strokeWidth:0 }} activeDot={{ r:5 }} name="Equity" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>Win / Lose</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={winLosePie} cx="50%" cy="50%" innerRadius={52} outerRadius={76} dataKey="value" paddingAngle={4} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {winLosePie.map((d,i)=><Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:12 }}>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>PnL per Trade (last 30)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={pnlBars} barCategoryGap="18%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fontSize:9, fill:C.gray }} />
                    <YAxis tick={{ fontSize:9, fill:C.gray }} tickFormatter={v=>"$"+v} width={55} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine y={0} stroke={C.gray} strokeDasharray="4 4" />
                    <Bar dataKey="pnl" name="PnL" radius={[3,3,0,0]}>
                      {pnlBars.map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>Net PnL by Pair</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={pairBars} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:9, fill:C.gray }} tickFormatter={v=>"$"+v} />
                    <YAxis type="category" dataKey="pair" tick={{ fontSize:9, fill:C.gray }} width={55} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="pnl" name="Net PnL" radius={[0,3,3,0]}>
                      {pairBars.map((d,i)=><Cell key={i} fill={d.pnl>=0?C.green:C.red} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ════ TRADE LOG ════ */}
        {tab==="log" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12, alignItems:"center" }}>
              {[
                { val:filterPair,     set:setFilterPair,     opts:["","..."],             labels:["All Pairs","All Pairs",...pairs],                       extra:pairs },
                { val:filterResult,   set:setFilterResult,   opts:["","Win","Lose","Break Even"], labels:["All Results","Win","Lose","Break Even"] },
                { val:filterPosition, set:setFilterPosition, opts:["","Long","Short"],    labels:["All Positions","Long","Short"] },
              ].map((f,i)=>{
                const opts = i===0 ? ["", ...pairs] : f.opts;
                const labels = i===0 ? ["All Pairs", ...pairs] : f.labels;
                return (
                  <select key={i} value={f.val} onChange={e=>f.set(e.target.value)} style={{ ...inputSt, width:"auto", fontSize:11 }}>
                    {opts.map((o,j)=><option key={j} value={o}>{labels[j]}</option>)}
                  </select>
                );
              })}
              <span style={{ fontSize:11, color:C.gray, marginLeft:"auto" }}>{filteredTrades.length} trades</span>
            </div>

            {filteredTrades.length===0 ? (
              <div style={{ textAlign:"center", padding:"4rem", color:C.gray, fontSize:13 }}>Tidak ada trade yang cocok.</div>
            ) : (
              <div style={{ overflowX:"auto", borderRadius:10, border:`1px solid ${C.border}` }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:700 }}>
                  <thead>
                    <tr>
                      <SortTh col="date"  label="Date" />
                      <th style={thSt}>Pair</th>
                      <th style={thSt}>Pos</th>
                      <th style={thSt}>TF</th>
                      <th style={thSt}>Playbook</th>
                      <SortTh col="pnl" label="PnL" />
                      <th style={thSt}>% Gain</th>
                      <th style={thSt}>Equity</th>
                      <th style={thSt}>Result</th>
                      <th style={thSt}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map(t => {
                      const gainPct = ((t.pnl/initEquity)*100).toFixed(2);
                      return (
                        <tr key={t.id} style={{ cursor:"pointer" }} onClick={()=>setDrawer(t)}>
                          <td style={{ ...tdSt, color:C.muted }}>{t.date||"—"}</td>
                          <td style={{ ...tdSt, fontWeight:700, color:C.textBright }}>{t.pair}</td>
                          <td style={tdSt}><Badge type={t.position} /></td>
                          <td style={{ ...tdSt, color:C.muted }}>{t.tf}</td>
                          <td style={{ ...tdSt, color:C.muted, fontSize:11 }}>{t.playbook||"—"}</td>
                          <td style={{ ...tdSt, fontWeight:700, color:t.pnl>=0?C.green:C.red }}>{fmtUSD(t.pnl,true)}</td>
                          <td style={{ ...tdSt, color:t.pnl>=0?C.green:C.red }}>{t.pnl>=0?"+":""}{gainPct}%</td>
                          <td style={tdSt}>{fmtUSD(equityMap[t.id]||0)}</td>
                          <td style={tdSt}><Badge type={t.result} /></td>
                          <td style={tdSt} onClick={e=>e.stopPropagation()}>
                            <button style={{ background:"none", border:"none", cursor:"pointer", color:C.gray, fontSize:14, padding:"2px 6px" }} onClick={()=>deleteTrade(t.id)} title="Hapus">🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════ ADD TRADE ════ */}
        {tab==="add" && (
          <div style={{ maxWidth:680, animation:"fadeUp .3s ease" }}>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.textBright, marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:18 }}>📝</span> Tambah Trade Baru
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:12, marginBottom:14 }}>
                <FormField label="Date"><input type="date" style={inputSt} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} /></FormField>
                <FormField label="Session"><select style={inputSt} value={form.session} onChange={e=>setForm(p=>({...p,session:e.target.value}))}>{SESSIONS.map(s=><option key={s}>{s}</option>)}</select></FormField>
                <FormField label="Entry Time"><input type="time" style={inputSt} value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))} /></FormField>
                <FormField label="Pair / Instrument"><input type="text" style={inputSt} placeholder="e.g. XAUUSD" value={form.pair} onChange={e=>setForm(p=>({...p,pair:e.target.value}))} /></FormField>
                <FormField label="Trend"><select style={inputSt} value={form.trend} onChange={e=>setForm(p=>({...p,trend:e.target.value}))}>{TRENDS.map(t=><option key={t}>{t}</option>)}</select></FormField>
                <FormField label="Position"><select style={inputSt} value={form.position} onChange={e=>setForm(p=>({...p,position:e.target.value}))}>{POSITIONS.map(t=><option key={t}>{t}</option>)}</select></FormField>
                <FormField label="Timeframe"><select style={inputSt} value={form.tf} onChange={e=>setForm(p=>({...p,tf:e.target.value}))}>{TIMEFRAMES.map(t=><option key={t}>{t}</option>)}</select></FormField>
                <FormField label="Playbook / Setup"><input type="text" style={inputSt} placeholder="e.g. OB Retest, BOS" value={form.playbook} onChange={e=>setForm(p=>({...p,playbook:e.target.value}))} /></FormField>
                <FormField label="Duration"><input type="text" style={inputSt} placeholder="e.g. 2h 30m" value={form.duration} onChange={e=>setForm(p=>({...p,duration:e.target.value}))} /></FormField>
                <FormField label="PnL ($)">
                  <input type="number" style={{ ...inputSt, color:parseFloat(form.pnl)>=0?C.green:C.red, fontWeight:700 }} placeholder="0.00" step="0.01" value={form.pnl} onChange={e=>setForm(p=>({...p,pnl:e.target.value}))} />
                </FormField>
                <FormField label="Result"><select style={inputSt} value={form.result} onChange={e=>setForm(p=>({...p,result:e.target.value}))}>{RESULTS.map(r=><option key={r}>{r}</option>)}</select></FormField>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                <FormField label="Trade Plan"><textarea style={{ ...inputSt, minHeight:80, resize:"vertical" }} placeholder="Rencana sebelum entry..." value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))} /></FormField>
                <FormField label="Evaluasi"><textarea style={{ ...inputSt, minHeight:80, resize:"vertical" }} placeholder="Apa yang terjadi?" value={form.evalNote} onChange={e=>setForm(p=>({...p,evalNote:e.target.value}))} /></FormField>
              </div>
              {/* Preview */}
              {form.pair && (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ color:C.textBright, fontWeight:700 }}>{form.pair.toUpperCase()}</span>
                  <Badge type={form.position} />
                  <span style={{ color:C.muted }}>{form.tf} · {form.session}</span>
                  <span style={{ color:parseFloat(form.pnl)>=0?C.green:C.red, fontWeight:700, marginLeft:"auto" }}>{fmtUSD(parseFloat(form.pnl)||0,true)}</span>
                  <Badge type={form.result} />
                </div>
              )}
              <button style={btnPri} onClick={addTrade}>SIMPAN TRADE</button>
            </div>
          </div>
        )}

        {/* ════ CALENDAR ════ */}
        {tab==="calendar" && (
          <div style={{ maxWidth:520, animation:"fadeUp .3s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <button style={{ ...btnSec, padding:"6px 14px" }} onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);setCalDetail(null);}}>‹</button>
              <span style={{ fontSize:14, fontWeight:700, color:C.textBright, letterSpacing:"1px" }}>{MONTHS_ID[calMonth].toUpperCase()} {calYear}</span>
              <button style={{ ...btnSec, padding:"6px 14px" }} onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);setCalDetail(null);}}>›</button>
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:10 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
                {DAYS_ID.map(d=><div key={d} style={{ fontSize:10, color:C.gray, textAlign:"center", padding:"4px 0", letterSpacing:"0.4px" }}>{d}</div>)}
                {(() => {
                  const first=new Date(calYear,calMonth,1), last=new Date(calYear,calMonth+1,0);
                  const cells=[];
                  for(let i=0;i<first.getDay();i++) cells.push(<div key={"e"+i} />);
                  for(let d=1;d<=last.getDate();d++){
                    const key=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                    const info=dayMap[key];
                    const type=info?(info.pnl>0?"win":info.pnl<0?"lose":"be"):"none";
                    const bg={win:C.green,lose:C.red,be:C.gray,none:C.surface}[type];
                    const fg={win:"#fff",lose:"#fff",be:"#fff",none:C.gray}[type];
                    cells.push(
                      <div key={key} onClick={()=>setCalDetail(info?{key,...info}:null)} title={info?`${info.trades.length} trade | ${fmtUSD(info.pnl,true)}`:"No trade"}
                        style={{ aspectRatio:"1", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, cursor:info?"pointer":"default", background:bg, color:fg, border:`1px solid rgba(255,255,255,0.04)`, transition:"transform .12s" }}
                        onMouseEnter={e=>{if(info)e.currentTarget.style.transform="scale(1.12)";}}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                        {d}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>
            <div style={{ display:"flex", gap:14, marginBottom:12, flexWrap:"wrap" }}>
              {[{c:C.green,l:"Profit"},{c:C.red,l:"Loss"},{c:C.gray,l:"Break Even"},{c:C.surface,l:"No Trade",b:`1px solid ${C.border}`}].map((x,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:C.gray }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:x.c, border:x.b }} />{x.l}
                </div>
              ))}
            </div>
            {calDetail && (
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:16, animation:"fadeUp .2s ease" }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:10, letterSpacing:"0.6px", textTransform:"uppercase" }}>
                  {calDetail.key} · {calDetail.trades.length} trade(s) · <span style={{ color:calDetail.pnl>=0?C.green:C.red }}>{fmtUSD(calDetail.pnl,true)}</span>
                </div>
                {calDetail.trades.map(t=>(
                  <div key={t.id} onClick={()=>{setDrawer(t);setCalDetail(null);}} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12, cursor:"pointer" }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontWeight:700, color:C.textBright }}>{t.pair}</span>
                      <Badge type={t.position} /><span style={{ color:C.muted }}>{t.tf}</span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontWeight:700, color:t.pnl>=0?C.green:C.red }}>{fmtUSD(t.pnl,true)}</span>
                      <Badge type={t.result} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ ANALYTICS ════ */}
        {tab==="stats" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:16 }}>
              <MetricCard label="Best Trade"   value={fmtUSD(stats.bestTrade,  true)} color={C.green} />
              <MetricCard label="Worst Trade"  value={fmtUSD(stats.worstTrade, true)} color={C.red}   />
              <MetricCard label="Avg Win"      value={`+${fmtUSD(stats.avgWin)}`}     color={C.green} />
              <MetricCard label="Avg Loss"     value={`-${fmtUSD(stats.avgLoss)}`}    color={C.red}   />
              <MetricCard label="Max Drawdown" value={fmtUSD(stats.maxDD)}            color={C.red}   sub={`${stats.maxDDPct}% of equity`} />
              <MetricCard label="Profit Factor" value={stats.pf}                      color={parseFloat(stats.pf)>=1?C.green:C.red} />
            </div>

            {/* Playbook breakdown */}
            {(() => {
              const map = {};
              trades.forEach(t => {
                const k=t.playbook||"No Playbook";
                if(!map[k]) map[k]={name:k,wins:0,losses:0,pnl:0};
                if(t.result==="Win") map[k].wins++;
                else if(t.result==="Lose") map[k].losses++;
                map[k].pnl+=(t.pnl||0);
              });
              const rows=Object.values(map).sort((a,b)=>b.pnl-a.pnl);
              return (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px", marginBottom:12 }}>
                  <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", textTransform:"uppercase", marginBottom:14 }}>Playbook Breakdown</div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead><tr>{["Playbook","Trades","Wins","Losses","Win Rate","Net PnL"].map(h=><th key={h} style={thSt}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map(r=>(
                        <tr key={r.name}>
                          <td style={{ ...tdSt, fontWeight:600, color:C.textBright }}>{r.name}</td>
                          <td style={tdSt}>{r.wins+r.losses}</td>
                          <td style={{ ...tdSt, color:C.green }}>{r.wins}</td>
                          <td style={{ ...tdSt, color:C.red }}>{r.losses}</td>
                          <td style={{ ...tdSt, color:(r.wins/(r.wins+r.losses||1)*100)>=50?C.green:C.red }}>{(r.wins/(r.wins+r.losses||1)*100).toFixed(0)}%</td>
                          <td style={{ ...tdSt, fontWeight:700, color:r.pnl>=0?C.green:C.red }}>{fmtUSD(r.pnl,true)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Session breakdown */}
            {(() => {
              const map = {};
              trades.forEach(t => {
                const k=t.session||"Unknown";
                if(!map[k]) map[k]={name:k,wins:0,losses:0,pnl:0};
                if(t.result==="Win") map[k].wins++;
                else if(t.result==="Lose") map[k].losses++;
                map[k].pnl+=(t.pnl||0);
              });
              const rows=Object.values(map).sort((a,b)=>b.pnl-a.pnl);
              return (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
                  <div style={{ fontSize:10, color:C.muted, letterSpacing:"1px", textTransform:"uppercase", marginBottom:14 }}>Session Breakdown</div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead><tr>{["Session","Trades","Win Rate","Net PnL"].map(h=><th key={h} style={thSt}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map(r=>(
                        <tr key={r.name}>
                          <td style={{ ...tdSt, fontWeight:600, color:C.textBright }}>{r.name}</td>
                          <td style={tdSt}>{r.wins+r.losses}</td>
                          <td style={{ ...tdSt, color:(r.wins/(r.wins+r.losses||1)*100)>=50?C.green:C.red }}>{(r.wins/(r.wins+r.losses||1)*100).toFixed(0)}%</td>
                          <td style={{ ...tdSt, fontWeight:700, color:r.pnl>=0?C.green:C.red }}>{fmtUSD(r.pnl,true)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
