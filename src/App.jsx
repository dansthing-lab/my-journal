import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const firebaseConfig = {
  apiKey: "AIzaSyD8n57Try9rPq4MqjkxN4bgNxvhCsQUE9Y",
  authDomain: "mytrading-journal-65b78.firebaseapp.com",
  projectId: "mytrading-journal-65b78",
  storageBucket: "mytrading-journal-65b78.firebasestorage.app",
  messagingSenderId: "270111404918",
  appId: "1:270111404918:web:0673982d9c95dcbf830057",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tradesCol = collection(db, "trades");

const SESSIONS = [
  { id: "Asia",    label: "Asia",    icon: "🌏", color: "#f59e0b", hours: "00:00–09:00 WIB" },
  { id: "London",  label: "London",  icon: "🇬🇧", color: "#60a5fa", hours: "14:00–23:00 WIB" },
  { id: "NewYork", label: "New York",icon: "🗽", color: "#a78bfa", hours: "19:00–04:00 WIB" },
  { id: "Other",   label: "Lainnya", icon: "⏱", color: "#64748b", hours: "" },
];

const EMPTY_FORM = {
  pair: "", type: "Perp", direction: "Open Long", orderType: "Limit",
  orderPrice: "", qty: "", tp: "", sl: "", status: "Pending", pnl: "", note: "", session: "Asia",
};

const DATE_FILTERS = ["Semua", "Hari Ini", "Minggu Ini", "Bulan Ini", "Bulan Lalu"];

function SessionBadge({ session }) {
  const s = SESSIONS.find(x => x.id === session) || SESSIONS[3];
  return (
    <span style={{ fontSize: 10, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}40`, borderRadius: 6, padding: "1px 7px", fontWeight: 700, letterSpacing: 0.5 }}>
      {s.icon} {s.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    Pending:   { bg: "#1a2a1a", color: "#4ade80", border: "#166534" },
    Filled:    { bg: "#1a1a2e", color: "#60a5fa", border: "#1d4ed8" },
    Cancelled: { bg: "#2a1a1a", color: "#f87171", border: "#991b1b" },
    "TP Hit":  { bg: "#0f2a1a", color: "#34d399", border: "#065f46" },
    "SL Hit":  { bg: "#2a0f0f", color: "#fca5a5", border: "#7f1d1d" },
  };
  const s = map[status] || map.Pending;
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: "monospace" }}>{status}</span>;
}

function RRBadge({ tp, sl, price }) {
  if (!tp || !sl || !price) return null;
  const reward = Math.abs(tp - price);
  const risk = Math.abs(price - sl);
  const rr = risk > 0 ? (reward / risk).toFixed(2) : "—";
  const color = parseFloat(rr) >= 2 ? "#34d399" : parseFloat(rr) >= 1 ? "#fbbf24" : "#f87171";
  return <span style={{ color, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>R:R {rr}</span>;
}

const inputStyle = {
  width: "100%", background: "#0a0a0f", border: "1px solid #1e1e35", borderRadius: 8,
  padding: "9px 11px", color: "#e2e8f0", fontFamily: "'DM Mono', 'Fira Code', monospace",
  fontSize: 13, boxSizing: "border-box", outline: "none",
};
const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer" };
const labelStyle = { fontSize: 10, color: "#475569", marginBottom: 5, letterSpacing: 1, display: "block" };

function filterByDate(trades, dateFilter) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return trades.filter(t => {
    const d = new Date(t.date);
    if (dateFilter === "Semua") return true;
    if (dateFilter === "Hari Ini") return t.date === today;
    if (dateFilter === "Minggu Ini") return d >= startOfWeek;
    if (dateFilter === "Bulan Ini") return d >= startOfMonth;
    if (dateFilter === "Bulan Lalu") return d >= startOfLastMonth && d <= endOfLastMonth;
    return true;
  });
}

// ── KALENDER PAGE ──────────────────────────────────────────────
function CalendarPage({ trades, pnlColor }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const dayNames = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1); setSelectedDay(null); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1); setSelectedDay(null); };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Build daily PnL map
  const dailyMap = {};
  trades.forEach(t => {
    if (!dailyMap[t.date]) dailyMap[t.date] = { pnl: 0, trades: [], tp: 0, sl: 0 };
    dailyMap[t.date].trades.push(t);
    if (t.pnl !== null && t.pnl !== undefined) dailyMap[t.date].pnl += t.pnl;
    if (t.status === "TP Hit") dailyMap[t.date].tp++;
    if (t.status === "SL Hit") dailyMap[t.date].sl++;
  });

  const selectedKey = selectedDay ? `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}` : null;
  const selectedData = selectedKey ? dailyMap[selectedKey] : null;

  // Monthly summary
  const monthTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const monthClosed = monthTrades.filter(t => t.status === "TP Hit" || t.status === "SL Hit");
  const monthPnl = monthClosed.reduce((s, t) => s + (t.pnl || 0), 0);
  const monthWins = monthClosed.filter(t => t.status === "TP Hit").length;
  const monthWinRate = monthClosed.length > 0 ? ((monthWins / monthClosed.length) * 100).toFixed(0) : "—";

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Month nav */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ background: "#1e1e35", border: "none", borderRadius: 8, padding: "6px 12px", color: "#e2e8f0", cursor: "pointer", fontSize: 14 }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{monthNames[viewMonth]}</div>
            <div style={{ fontSize: 11, color: "#475569" }}>{viewYear}</div>
          </div>
          <button onClick={nextMonth} style={{ background: "#1e1e35", border: "none", borderRadius: 8, padding: "6px 12px", color: "#e2e8f0", cursor: "pointer", fontSize: 14 }}>›</button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
          {dayNames.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, color: "#475569", fontWeight: 700, padding: "4px 0" }}>{d}</div>)}
        </div>

        {/* Calendar cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const key = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const data = dailyMap[key];
            const isToday = key === new Date().toISOString().slice(0,10);
            const isSelected = day === selectedDay;
            let bg = "#12121f", border = "#1e1e35", dotColor = null;
            if (data) {
              const hasClosed = data.tp > 0 || data.sl > 0;
              if (hasClosed) {
                if (data.pnl > 0) { bg = "rgba(52,211,153,0.12)"; border = "#065f46"; dotColor = "#34d399"; }
                else if (data.pnl < 0) { bg = "rgba(248,113,113,0.12)"; border = "#7f1d1d"; dotColor = "#f87171"; }
                else { bg = "rgba(100,116,139,0.12)"; border = "#334155"; dotColor = "#64748b"; }
              } else if (data.trades.length > 0) {
                bg = "rgba(99,102,241,0.1)"; border = "#2d2d4a"; dotColor = "#6366f1";
              }
            }
            return (
              <div key={i} onClick={() => setSelectedDay(isSelected ? null : day)} style={{
                background: isSelected ? "#6366f1" : bg,
                border: `1px solid ${isSelected ? "#6366f1" : isToday ? "#6366f1" : border}`,
                borderRadius: 8, padding: "6px 4px", textAlign: "center", cursor: data ? "pointer" : "default",
                minHeight: 38, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isSelected ? "#fff" : isToday ? "#a5b4fc" : "#e2e8f0" }}>{day}</div>
                {dotColor && !isSelected && <div style={{ width: 4, height: 4, borderRadius: "50%", background: dotColor, marginTop: 2 }} />}
                {data && isSelected && <div style={{ fontSize: 8, color: "#fff", marginTop: 1 }}>{data.trades.length}T</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div style={{ background: "#0f0f1a", border: "1px solid #2d2d4a", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#6366f1", letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>
            {selectedDay} {monthNames[viewMonth]} {viewYear}
          </div>
          {selectedData ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: "#475569" }}>TRADE</div><div style={{ fontSize: 18, fontWeight: 800, color: "#a78bfa" }}>{selectedData.trades.length}</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: "#475569" }}>W/L</div><div style={{ fontSize: 18, fontWeight: 800 }}><span style={{ color: "#34d399" }}>{selectedData.tp}</span><span style={{ color: "#475569" }}>/</span><span style={{ color: "#f87171" }}>{selectedData.sl}</span></div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: "#475569" }}>PnL</div><div style={{ fontSize: 14, fontWeight: 800, color: pnlColor(selectedData.pnl) }}>{selectedData.pnl >= 0 ? "+" : ""}{selectedData.pnl.toFixed(2)}</div></div>
              </div>
              {selectedData.trades.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #1e1e35" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{t.pair}</span>
                    {t.session && <SessionBadge session={t.session} />}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <StatusBadge status={t.status} />
                    {t.pnl !== null && t.pnl !== undefined && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: pnlColor(t.pnl), marginTop: 2 }}>{t.pnl >= 0 ? "+" : ""}{t.pnl} USDT</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#334155", fontSize: 12, padding: "16px 0" }}>Tidak ada trade di hari ini</div>
          )}
        </div>
      )}

      {/* Monthly summary */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 10 }}>RINGKASAN {monthNames[viewMonth].toUpperCase()}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { label: "Total Trade", value: monthTrades.length, color: "#a78bfa" },
            { label: "Win Rate", value: monthWinRate === "—" ? "—" : `${monthWinRate}%`, color: parseFloat(monthWinRate) >= 50 ? "#34d399" : "#f87171" },
            { label: "Net P/L", value: `${monthPnl >= 0 ? "+" : ""}${monthPnl.toFixed(1)}`, color: pnlColor(monthPnl) },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "0 4px" }}>
        {[["#34d399","Profit"],["#f87171","Loss"],["#6366f1","Pending/Filled"],["#64748b","Breakeven"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── STATISTICS PAGE ────────────────────────────────────────────
function StatisticsPage({ trades, pnlColor }) {
  const closed = trades.filter(t => t.status === "TP Hit" || t.status === "SL Hit");
  const wins   = trades.filter(t => t.status === "TP Hit");
  const losses = trades.filter(t => t.status === "SL Hit");
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : 0;
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);

  const sortedClosed = [...closed].sort((a, b) => new Date(a.date) - new Date(b.date));
  let cumulative = 0;
  const equityCurve = sortedClosed.map(t => { cumulative += (t.pnl || 0); return { date: t.date.slice(5), pnl: parseFloat(cumulative.toFixed(2)) }; });

  const pairMap = {};
  closed.forEach(t => { if (!pairMap[t.pair]) pairMap[t.pair] = 0; pairMap[t.pair] += (t.pnl || 0); });
  const pairData = Object.entries(pairMap).map(([pair, pnl]) => ({ pair, pnl: parseFloat(pnl.toFixed(2)) })).sort((a, b) => b.pnl - a.pnl);

  const dailyMap = {};
  closed.forEach(t => { if (!dailyMap[t.date]) dailyMap[t.date] = 0; dailyMap[t.date] += (t.pnl || 0); });
  const dailyData = Object.entries(dailyMap).map(([date, pnl]) => ({ date: date.slice(5), pnl: parseFloat(pnl.toFixed(2)) })).sort((a, b) => a.date.localeCompare(b.date));

  // Session analysis
  const sessionMap = {};
  SESSIONS.forEach(s => { sessionMap[s.id] = { win: 0, loss: 0, pnl: 0, total: 0 }; });
  closed.forEach(t => {
    const sid = t.session || "Other";
    if (!sessionMap[sid]) sessionMap[sid] = { win: 0, loss: 0, pnl: 0, total: 0 };
    sessionMap[sid].total++;
    sessionMap[sid].pnl += (t.pnl || 0);
    if (t.status === "TP Hit") sessionMap[sid].win++;
    else sessionMap[sid].loss++;
  });

  const rrTrades = trades.filter(t => t.tp && t.sl && t.orderPrice);
  const avgRR = rrTrades.length > 0 ? (rrTrades.reduce((s, t) => { const reward = Math.abs(t.tp - t.orderPrice); const risk = Math.abs(t.orderPrice - t.sl); return s + (risk > 0 ? reward / risk : 0); }, 0) / rrTrades.length).toFixed(2) : "—";

  const cardStyle = { background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 14, padding: "16px" };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "WIN RATE", value: `${winRate}%`, color: parseFloat(winRate) >= 50 ? "#34d399" : "#f87171" },
          { label: "NET P/L", value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} USDT`, color: pnlColor(totalPnl) },
          { label: "TOTAL TRADE", value: trades.length, color: "#a78bfa" },
          { label: "AVG R:R", value: avgRR, color: "#fbbf24" },
          { label: "BEST TRADE", value: wins.length > 0 ? `+${Math.max(...wins.map(t => t.pnl||0)).toFixed(2)}` : "—", color: "#34d399" },
          { label: "WORST TRADE", value: losses.length > 0 ? `${Math.min(...losses.map(t => t.pnl||0)).toFixed(2)}` : "—", color: "#f87171" },
        ].map(s => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Session Analysis */}
      <div style={cardStyle}>
        <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>PERFORMA PER SESSION</div>
        {SESSIONS.filter(s => sessionMap[s.id]?.total > 0).length === 0 ? (
          <div style={{ fontSize: 12, color: "#334155", textAlign: "center", padding: "12px 0" }}>Belum ada data session</div>
        ) : (
          SESSIONS.map(s => {
            const d = sessionMap[s.id];
            if (!d || d.total === 0) return null;
            const wr = d.total > 0 ? ((d.win / d.total) * 100).toFixed(0) : 0;
            return (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{d.total} trade</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pnlColor(d.pnl) }}>{d.pnl >= 0 ? "+" : ""}{d.pnl.toFixed(2)} USDT</span>
                    <span style={{ fontSize: 10, color: "#475569", marginLeft: 8 }}>{wr}% WR</span>
                  </div>
                </div>
                <div style={{ height: 4, background: "#1e1e35", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${wr}%`, background: s.color, borderRadius: 4, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {equityCurve.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>EQUITY CURVE</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={equityCurve}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#94a3b8" }} formatter={(v) => [`${v >= 0 ? "+" : ""}${v} USDT`, "PnL"]} />
              <Line type="monotone" dataKey="pnl" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {dailyData.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>PnL HARIAN</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#12121f", border: "1px solid #1e1e35", borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v >= 0 ? "+" : ""}${v} USDT`, "PnL"]} />
              <Bar dataKey="pnl" radius={[4,4,0,0]}>{dailyData.map((e,i) => <Cell key={i} fill={e.pnl >= 0 ? "#34d399" : "#f87171"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {pairData.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>PERFORMA PER PAIR</div>
          {pairData.map(p => (
            <div key={p.pair} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{p.pair}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 80, height: 4, background: "#1e1e35", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(Math.abs(p.pnl)/Math.max(...pairData.map(x=>Math.abs(x.pnl)))*100,100)}%`, background: p.pnl >= 0 ? "#34d399" : "#f87171", borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: pnlColor(p.pnl), minWidth: 70, textAlign: "right" }}>{p.pnl >= 0 ? "+" : ""}{p.pnl} USDT</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {closed.length === 0 && <div style={{ textAlign: "center", color: "#334155", padding: "40px 0", fontSize: 13 }}>Belum ada closed trade.</div>}
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────
export default function TradingJournal() {
  const [trades, setTrades]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [formError, setFormError]       = useState("");
  const [editId, setEditId]             = useState(null);
  const [editData, setEditData]         = useState({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [sessionFilter, setSessionFilter] = useState("All");
  const [dateFilter, setDateFilter]     = useState("Semua");
  const [expandedId, setExpandedId]     = useState(null);
  const [dbError, setDbError]           = useState("");
  const [page, setPage]                 = useState("journal");

  useEffect(() => {
    const q = query(tradesCol, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      (snap) => { setTrades(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); setDbError(""); },
      (err)  => { console.error(err); setDbError("Gagal terhubung ke database."); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const pnlColor = (v) => v > 0 ? "#34d399" : v < 0 ? "#f87171" : "#9ca3af";

  const dateTrades = filterByDate(trades, dateFilter);
  const sessionTrades = sessionFilter === "All" ? dateTrades : dateTrades.filter(t => (t.session || "Other") === sessionFilter);
  const closedTrades = sessionTrades.filter(t => t.status === "TP Hit" || t.status === "SL Hit");
  const winTrades    = sessionTrades.filter(t => t.status === "TP Hit");
  const lossTrades   = sessionTrades.filter(t => t.status === "SL Hit");
  const winRate      = closedTrades.length > 0 ? ((winTrades.length / closedTrades.length) * 100).toFixed(1) : null;
  const stats = {
    total: sessionTrades.length, pending: sessionTrades.filter(t => t.status === "Pending").length,
    tp: winTrades.length, sl: lossTrades.length,
    totalPnl: sessionTrades.reduce((s, t) => s + (t.pnl || 0), 0),
    totalProfit: winTrades.reduce((s, t) => s + (t.pnl || 0), 0),
    totalLoss: lossTrades.reduce((s, t) => s + (t.pnl || 0), 0),
    winRate, closedCount: closedTrades.length,
  };
  const filteredTrades = statusFilter === "All" ? sessionTrades : sessionTrades.filter(t => t.status === statusFilter);
  const fc = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddTrade = async () => {
    if (!form.pair.trim()) { setFormError("Pair wajib diisi"); return; }
    if (!form.orderPrice)  { setFormError("Entry Price wajib diisi"); return; }
    if (!form.qty)         { setFormError("Qty wajib diisi"); return; }
    setFormError("");
    const now = new Date();
    try {
      await addDoc(tradesCol, {
        createdAt: now.toISOString(), date: now.toISOString().slice(0,10), time: now.toTimeString().slice(0,5),
        pair: form.pair.toUpperCase().trim(), type: form.type, direction: form.direction, orderType: form.orderType,
        orderPrice: parseFloat(form.orderPrice), qty: parseFloat(form.qty),
        tp: form.tp ? parseFloat(form.tp) : null, sl: form.sl ? parseFloat(form.sl) : null,
        status: form.status, pnl: form.pnl ? parseFloat(form.pnl) : null,
        note: form.note, session: form.session,
      });
      setForm(EMPTY_FORM); setShowForm(false);
    } catch (e) { setFormError("Gagal simpan. Cek koneksi internet."); }
  };

  const startEdit = (trade) => { setEditId(trade.id); setEditData({ ...trade }); };
  const saveEdit = async () => {
    try {
      await updateDoc(doc(db, "trades", editId), {
        pair: editData.pair, orderPrice: parseFloat(editData.orderPrice)||0, qty: parseFloat(editData.qty)||0,
        tp: editData.tp ? parseFloat(editData.tp) : null, sl: editData.sl ? parseFloat(editData.sl) : null,
        status: editData.status, pnl: editData.pnl !== "" && editData.pnl !== null ? parseFloat(editData.pnl) : null,
        note: editData.note || "", session: editData.session || "Other",
      });
      setEditId(null);
    } catch (e) { alert("Gagal update."); }
  };
  const deleteTrade = async (id) => { try { await deleteDoc(doc(db, "trades", id)); } catch(e) { alert("Gagal hapus."); } };

  const navBtn = (id, label, icon) => (
    <button onClick={() => setPage(id)} style={{
      flex: 1, background: "none", border: "none", padding: "8px 0",
      color: page === id ? "#6366f1" : "#475569", fontFamily: "inherit",
      fontSize: 9, fontWeight: 700, cursor: "pointer", letterSpacing: 1,
      borderTop: page === id ? "2px solid #6366f1" : "2px solid transparent",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'DM Mono','Fira Code',monospace", paddingBottom: 70 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0f0f1a 0%,#12121f 100%)", borderBottom: "1px solid #1e1e35", padding: "20px 20px 14px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6366f1", letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>◈ TRADING JOURNAL</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -1, color: "#f1f5f9" }}>Catatan Harian</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: dbError ? "#f87171" : "#34d399", boxShadow: dbError ? "none" : "0 0 6px #34d399", animation: dbError ? "none" : "pulse 2s infinite" }} />
              <span style={{ fontSize: 9, color: dbError ? "#f87171" : "#34d399", letterSpacing: 1 }}>{dbError ? "OFFLINE" : "LIVE"}</span>
            </div>
            {page === "journal" && (
              <button onClick={() => { setShowForm(v => !v); setFormError(""); }} style={{ background: showForm ? "#1e1e35" : "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, padding: "9px 14px", color: showForm ? "#94a3b8" : "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 11, cursor: "pointer", letterSpacing: 1, boxShadow: showForm ? "none" : "0 4px 20px rgba(99,102,241,0.4)" }}>
                {showForm ? "✕ Tutup" : "+ Order"}
              </button>
            )}
          </div>
        </div>
        {dbError && <div style={{ marginTop: 10, padding: "8px 14px", background: "rgba(248,113,113,0.1)", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 12, color: "#f87171" }}>⚠ {dbError}</div>}
      </div>

      {/* JOURNAL PAGE */}
      {page === "journal" && (
        <>
          {showForm && (
            <div style={{ margin: "12px 16px 0", background: "#0f0f1a", border: "1px solid #2d2d4a", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 11, color: "#6366f1", letterSpacing: 2, marginBottom: 16, fontWeight: 700 }}>✦ INPUT ORDER BARU</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={labelStyle}>PAIR *</label><input placeholder="cth: BTCUSDT" value={form.pair} onChange={e => fc("pair", e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>DIRECTION</label><select value={form.direction} onChange={e => fc("direction", e.target.value)} style={selectStyle}><option>Open Long</option><option>Open Short</option></select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={labelStyle}>ENTRY PRICE *</label><input placeholder="0.00" type="number" value={form.orderPrice} onChange={e => fc("orderPrice", e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>QTY *</label><input placeholder="0" type="number" value={form.qty} onChange={e => fc("qty", e.target.value)} style={inputStyle} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={labelStyle}>TAKE PROFIT</label><input placeholder="0.00" type="number" value={form.tp} onChange={e => fc("tp", e.target.value)} style={{ ...inputStyle, color: "#34d399" }} /></div>
                <div><label style={labelStyle}>STOP LOSS</label><input placeholder="0.00" type="number" value={form.sl} onChange={e => fc("sl", e.target.value)} style={{ ...inputStyle, color: "#f87171" }} /></div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>SESSION</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {SESSIONS.map(s => (
                    <button key={s.id} onClick={() => fc("session", s.id)} style={{ background: form.session === s.id ? `${s.color}20` : "#0a0a0f", border: `1px solid ${form.session === s.id ? s.color : "#1e1e35"}`, borderRadius: 8, padding: "8px 4px", cursor: "pointer", textAlign: "center" }}>
                      <div style={{ fontSize: 14 }}>{s.icon}</div>
                      <div style={{ fontSize: 9, color: form.session === s.id ? s.color : "#475569", fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                      {s.hours && <div style={{ fontSize: 8, color: "#334155", marginTop: 1 }}>{s.hours}</div>}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={labelStyle}>ORDER TYPE</label><select value={form.orderType} onChange={e => fc("orderType", e.target.value)} style={selectStyle}><option>Limit</option><option>Market</option></select></div>
                <div><label style={labelStyle}>STATUS</label><select value={form.status} onChange={e => fc("status", e.target.value)} style={selectStyle}>{["Pending","Filled","TP Hit","SL Hit","Cancelled"].map(s => <option key={s}>{s}</option>)}</select></div>
              </div>
              {(form.status === "TP Hit" || form.status === "SL Hit") && (
                <div style={{ marginBottom: 10 }}><label style={labelStyle}>PnL (USDT)</label><input placeholder="cth: -10.50" type="number" value={form.pnl} onChange={e => fc("pnl", e.target.value)} style={{ ...inputStyle, color: parseFloat(form.pnl) < 0 ? "#f87171" : "#34d399" }} /></div>
              )}
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>CATATAN</label><textarea placeholder="Setup, alasan entry, dll..." value={form.note} onChange={e => fc("note", e.target.value)} rows={2} style={{ ...inputStyle, resize: "none" }} /></div>
              {form.orderPrice && form.tp && form.sl && (
                <div style={{ marginBottom: 14, padding: "8px 12px", background: "#12121f", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>Preview R:R</span>
                  <RRBadge tp={parseFloat(form.tp)} sl={parseFloat(form.sl)} price={parseFloat(form.orderPrice)} />
                </div>
              )}
              {formError && <div style={{ marginBottom: 10, fontSize: 12, color: "#f87171" }}>⚠ {formError}</div>}
              <button onClick={handleAddTrade} style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, padding: "12px", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}>✦ SIMPAN ORDER</button>
            </div>
          )}

          {/* Date Filter */}
          <div style={{ display: "flex", gap: 6, padding: "14px 16px 0", overflowX: "auto" }}>
            {DATE_FILTERS.map(f => (
              <button key={f} onClick={() => setDateFilter(f)} style={{ background: dateFilter === f ? "rgba(99,102,241,0.2)" : "#12121f", border: `1px solid ${dateFilter === f ? "#6366f1" : "#1e1e35"}`, borderRadius: 20, padding: "4px 12px", color: dateFilter === f ? "#a5b4fc" : "#64748b", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{f}</button>
            ))}
          </div>

          {/* Session Filter */}
          <div style={{ display: "flex", gap: 6, padding: "8px 16px 0", overflowX: "auto" }}>
            <button onClick={() => setSessionFilter("All")} style={{ background: sessionFilter === "All" ? "rgba(99,102,241,0.2)" : "#12121f", border: `1px solid ${sessionFilter === "All" ? "#6366f1" : "#1e1e35"}`, borderRadius: 20, padding: "4px 12px", color: sessionFilter === "All" ? "#a5b4fc" : "#64748b", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>🌐 Semua</button>
            {SESSIONS.map(s => (
              <button key={s.id} onClick={() => setSessionFilter(s.id)} style={{ background: sessionFilter === s.id ? `${s.color}20` : "#12121f", border: `1px solid ${sessionFilter === s.id ? s.color : "#1e1e35"}`, borderRadius: 20, padding: "4px 12px", color: sessionFilter === s.id ? s.color : "#64748b", fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{s.icon} {s.label}</button>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, padding: "10px 16px 0" }}>
            {[{ label:"Total",value:stats.total,color:"#a78bfa"},{ label:"Pending",value:stats.pending,color:"#fbbf24"},{ label:"TP Hit",value:stats.tp,color:"#34d399"},{ label:"SL Hit",value:stats.sl,color:"#f87171"}].map(s => (
              <div key={s.label} style={{ background:"#12121f",border:"1px solid #1e1e35",borderRadius:12,padding:"10px 8px",textAlign:"center" }}>
                <div style={{ fontSize:18,fontWeight:800,color:s.color }}>{s.value}</div>
                <div style={{ fontSize:9,color:"#64748b",letterSpacing:1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Win Rate + PnL */}
          <div style={{ padding:"8px 16px 0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
            <div style={{ background:"#0f0f1a",border:"1px solid #1e1e35",borderRadius:14,padding:"14px 16px" }}>
              <div style={{ fontSize:10,color:"#475569",letterSpacing:2,marginBottom:4 }}>WIN RATE</div>
              {stats.winRate !== null ? (
                <>
                  <div style={{ fontSize:26,fontWeight:900,lineHeight:1,marginBottom:6,color:parseFloat(stats.winRate)>=50?"#34d399":"#f87171" }}>{stats.winRate}%</div>
                  <div style={{ fontSize:10,color:"#475569" }}>{stats.tp}W / {stats.sl}L</div>
                  <div style={{ marginTop:8,height:4,background:"#1e1e35",borderRadius:4,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${stats.winRate}%`,background:parseFloat(stats.winRate)>=50?"linear-gradient(90deg,#34d399,#6ee7b7)":"linear-gradient(90deg,#f87171,#fca5a5)",borderRadius:4,transition:"width 0.6s ease" }} />
                  </div>
                </>
              ) : <div style={{ fontSize:12,color:"#334155",marginTop:4 }}>Belum ada closed</div>}
            </div>
            <div style={{ background:"#0f0f1a",border:"1px solid #1e1e35",borderRadius:14,padding:"14px 16px" }}>
              <div style={{ fontSize:10,color:"#475569",letterSpacing:2,marginBottom:4 }}>NET P/L</div>
              <div style={{ fontSize:20,fontWeight:900,lineHeight:1,marginBottom:6,color:pnlColor(stats.totalPnl) }}>
                {stats.totalPnl>=0?"+":""}{stats.totalPnl.toFixed(2)}<span style={{ fontSize:10,color:"#475569",fontWeight:400,marginLeft:4 }}>USDT</span>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:10 }}><span style={{ color:"#475569" }}>Profit</span><span style={{ color:"#34d399",fontWeight:700 }}>+{stats.totalProfit.toFixed(2)}</span></div>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:10 }}><span style={{ color:"#475569" }}>Loss</span><span style={{ color:"#f87171",fontWeight:700 }}>{stats.totalLoss.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div style={{ display:"flex",gap:6,padding:"12px 16px 8px",overflowX:"auto" }}>
            {["All","Pending","Filled","TP Hit","SL Hit","Cancelled"].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{ background:statusFilter===f?"#6366f1":"#12121f",border:`1px solid ${statusFilter===f?"#6366f1":"#1e1e35"}`,borderRadius:20,padding:"4px 12px",color:statusFilter===f?"#fff":"#64748b",fontFamily:"inherit",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>{f}</button>
            ))}
          </div>

          {loading && <div style={{ textAlign:"center",color:"#475569",padding:"40px 0",fontSize:13 }}>⏳ Memuat data...</div>}

          {!loading && (
            <div style={{ padding:"0 16px",display:"flex",flexDirection:"column",gap:10 }}>
              {filteredTrades.length === 0 && <div style={{ textAlign:"center",color:"#334155",padding:"40px 0",fontSize:13 }}>Tidak ada trade di periode ini.</div>}
              {filteredTrades.map(trade => (
                <div key={trade.id} style={{ background:"#0f0f1a",border:"1px solid #1e1e35",borderRadius:14,overflow:"hidden" }}>
                  {editId === trade.id ? (
                    <div style={{ padding:16 }}>
                      <div style={{ fontSize:11,color:"#6366f1",marginBottom:12,letterSpacing:2 }}>EDIT ORDER</div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                        {[["pair","Pair"],["orderPrice","Entry Price"],["qty","Qty"],["tp","Take Profit"],["sl","Stop Loss"],["pnl","PnL (USDT)"]].map(([k,label]) => (
                          <div key={k}><div style={{ fontSize:10,color:"#475569",marginBottom:4 }}>{label}</div><input value={editData[k]??""} onChange={e => setEditData(d=>({...d,[k]:e.target.value}))} style={inputStyle} /></div>
                        ))}
                      </div>
                      <div style={{ marginTop:8 }}>
                        <div style={{ fontSize:10,color:"#475569",marginBottom:4 }}>Session</div>
                        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6 }}>
                          {SESSIONS.map(s => (
                            <button key={s.id} onClick={() => setEditData(d=>({...d,session:s.id}))} style={{ background:editData.session===s.id?`${s.color}20`:"#0a0a0f",border:`1px solid ${editData.session===s.id?s.color:"#1e1e35"}`,borderRadius:8,padding:"6px 4px",cursor:"pointer",textAlign:"center" }}>
                              <div style={{ fontSize:12 }}>{s.icon}</div>
                              <div style={{ fontSize:8,color:editData.session===s.id?s.color:"#475569",fontWeight:700 }}>{s.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop:8 }}><div style={{ fontSize:10,color:"#475569",marginBottom:4 }}>Status</div><select value={editData.status} onChange={e=>setEditData(d=>({...d,status:e.target.value}))} style={selectStyle}>{["Pending","Filled","TP Hit","SL Hit","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></div>
                      <div style={{ marginTop:8 }}><div style={{ fontSize:10,color:"#475569",marginBottom:4 }}>Catatan</div><textarea value={editData.note||""} onChange={e=>setEditData(d=>({...d,note:e.target.value}))} rows={2} style={{ ...inputStyle,resize:"none" }} /></div>
                      <div style={{ display:"flex",gap:8,marginTop:12 }}>
                        <button onClick={saveEdit} style={{ flex:1,background:"#6366f1",border:"none",borderRadius:8,padding:"10px",color:"#fff",fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer" }}>Simpan</button>
                        <button onClick={()=>setEditId(null)} style={{ flex:1,background:"#1e1e35",border:"none",borderRadius:8,padding:"10px",color:"#94a3b8",fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer" }}>Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={()=>setExpandedId(expandedId===trade.id?null:trade.id)} style={{ cursor:"pointer" }}>
                      <div style={{ padding:"14px 16px 10px" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                          <div>
                            <span style={{ fontSize:16,fontWeight:800,color:"#f1f5f9",letterSpacing:-0.5 }}>{trade.pair}</span>
                            <span style={{ fontSize:10,color:"#475569",marginLeft:8 }}>{trade.date} {trade.time}</span>
                          </div>
                          <StatusBadge status={trade.status} />
                        </div>
                        {trade.session && <div style={{ marginBottom:6 }}><SessionBadge session={trade.session} /></div>}
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4 }}>
                          <div><div style={{ fontSize:9,color:"#475569",letterSpacing:1 }}>ENTRY</div><div style={{ fontSize:14,fontWeight:700,color:"#e2e8f0" }}>{trade.orderPrice}</div></div>
                          <div><div style={{ fontSize:9,color:"#475569",letterSpacing:1 }}>TP / SL</div><div style={{ fontSize:12 }}><span style={{ color:"#34d399",fontWeight:700 }}>{trade.tp??"—"}</span><span style={{ color:"#475569" }}> / </span><span style={{ color:"#f87171",fontWeight:700 }}>{trade.sl??"—"}</span></div></div>
                          <div style={{ textAlign:"right" }}>
                            {trade.pnl!==null&&trade.pnl!==undefined?(
                              <><div style={{ fontSize:9,color:"#475569",letterSpacing:1 }}>PnL</div><div style={{ fontSize:14,fontWeight:800,color:pnlColor(trade.pnl) }}>{trade.pnl>=0?"+":""}{trade.pnl} USDT</div></>
                            ):<RRBadge tp={trade.tp} sl={trade.sl} price={trade.orderPrice} />}
                          </div>
                        </div>
                        {expandedId===trade.id&&(
                          <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #1e1e35" }}>
                            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                              <span style={{ fontSize:11,color:"#6366f1",background:"rgba(99,102,241,0.1)",padding:"2px 8px",borderRadius:6 }}>{trade.type}</span>
                              <span style={{ fontSize:11,color:"#60a5fa",background:"rgba(96,165,250,0.1)",padding:"2px 8px",borderRadius:6 }}>{trade.direction}</span>
                              <span style={{ fontSize:11,color:"#94a3b8",background:"#12121f",padding:"2px 8px",borderRadius:6 }}>Qty: {trade.qty}</span>
                              <span style={{ fontSize:11,color:"#94a3b8",background:"#12121f",padding:"2px 8px",borderRadius:6 }}>{trade.orderType}</span>
                            </div>
                            {trade.note&&<div style={{ fontSize:12,color:"#64748b",fontStyle:"italic",marginBottom:8 }}>"{trade.note}"</div>}
                            <div style={{ display:"flex",gap:8 }}>
                              <button onClick={e=>{e.stopPropagation();startEdit(trade);}} style={{ flex:1,background:"#1e1e35",border:"none",borderRadius:8,padding:"8px",color:"#a78bfa",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer" }}>✏️ Edit</button>
                              <button onClick={e=>{e.stopPropagation();deleteTrade(trade.id);}} style={{ background:"#1e1e35",border:"none",borderRadius:8,padding:"8px 14px",color:"#f87171",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer" }}>✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {page === "calendar" && <CalendarPage trades={trades} pnlColor={pnlColor} />}
      {page === "stats"    && <StatisticsPage trades={trades} pnlColor={pnlColor} />}

      {/* Bottom Nav */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0f0f1a",borderTop:"1px solid #1e1e35",display:"flex",zIndex:100 }}>
        {navBtn("journal","JURNAL","📋")}
        {navBtn("calendar","KALENDER","📅")}
        {navBtn("stats","STATISTIK","📊")}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
