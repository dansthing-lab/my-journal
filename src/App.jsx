import { useState } from "react";

const INITIAL_TRADES = [
  {
    id: 1,
    date: "2026-03-25",
    time: "09:09",
    pair: "UNIUSDT",
    type: "Perp",
    direction: "Open Long",
    orderType: "Limit",
    orderPrice: 3.54,
    qty: 232,
    tp: 3.740,
    sl: 3.500,
    status: "Cancelled",
    pnl: null,
    note: "",
  },
  {
    id: 2,
    date: "2026-03-25",
    time: "09:09",
    pair: "NEOUSDT",
    type: "Perp",
    direction: "Open Long",
    orderType: "Limit",
    orderPrice: 2.722,
    qty: 175,
    tp: 2.900,
    sl: 2.655,
    status: "Cancelled",
    pnl: null,
    note: "",
  },
  {
    id: 3,
    date: "2026-03-25",
    time: "09:09",
    pair: "TAOUSDT",
    type: "Perp",
    direction: "Open Long",
    orderType: "Limit",
    orderPrice: 275.36,
    qty: 0.6,
    tp: 324.00,
    sl: 260.00,
    status: "Cancelled",
    pnl: null,
    note: "",
  },
  {
    id: 4,
    date: "2026-03-26",
    time: "09:55",
    pair: "WLDUSDT",
    type: "Perp",
    direction: "Open Long",
    orderType: "Limit",
    orderPrice: 0.3089,
    qty: 1370,
    tp: 0.3429,
    sl: 0.3015,
    status: "SL Hit",
    pnl: -10.15,
    note: "Close lose @ SL",
  },
];

const EMPTY_FORM = {
  pair: "",
  type: "Perp",
  direction: "Open Long",
  orderType: "Limit",
  orderPrice: "",
  qty: "",
  tp: "",
  sl: "",
  status: "Pending",
  pnl: "",
  note: "",
};

function StatusBadge({ status }) {
  const map = {
    Pending: { bg: "#1a2a1a", color: "#4ade80", border: "#166534" },
    Filled: { bg: "#1a1a2e", color: "#60a5fa", border: "#1d4ed8" },
    Cancelled: { bg: "#2a1a1a", color: "#f87171", border: "#991b1b" },
    "TP Hit": { bg: "#0f2a1a", color: "#34d399", border: "#065f46" },
    "SL Hit": { bg: "#2a0f0f", color: "#fca5a5", border: "#7f1d1d" },
  };
  const s = map[status] || map.Pending;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 6, padding: "2px 10px", fontSize: 11,
      fontWeight: 700, letterSpacing: 1, fontFamily: "monospace",
    }}>{status}</span>
  );
}

function RRBadge({ tp, sl, price }) {
  if (!tp || !sl || !price) return null;
  const reward = Math.abs(tp - price);
  const risk = Math.abs(price - sl);
  const rr = risk > 0 ? (reward / risk).toFixed(2) : "—";
  const color = parseFloat(rr) >= 2 ? "#34d399" : parseFloat(rr) >= 1 ? "#fbbf24" : "#f87171";
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
      R:R {rr}
    </span>
  );
}

const inputStyle = {
  width: "100%",
  background: "#0a0a0f",
  border: "1px solid #1e1e35",
  borderRadius: 8,
  padding: "9px 11px",
  color: "#e2e8f0",
  fontFamily: "'DM Mono', 'Fira Code', monospace",
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
};

const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer" };
const labelStyle = { fontSize: 10, color: "#475569", marginBottom: 5, letterSpacing: 1, display: "block" };

export default function TradingJournal() {
  const [trades, setTrades] = useState(INITIAL_TRADES);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  const pnlColor = (v) => v > 0 ? "#34d399" : v < 0 ? "#f87171" : "#9ca3af";

  const closedTrades = trades.filter(t => t.status === "TP Hit" || t.status === "SL Hit");
  const winTrades = trades.filter(t => t.status === "TP Hit");
  const lossTrades = trades.filter(t => t.status === "SL Hit");
  const winRate = closedTrades.length > 0 ? ((winTrades.length / closedTrades.length) * 100).toFixed(1) : null;
  const totalProfit = winTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalLoss = lossTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const stats = {
    total: trades.length,
    pending: trades.filter(t => t.status === "Pending").length,
    tp: winTrades.length,
    sl: lossTrades.length,
    totalPnl: trades.reduce((s, t) => s + (t.pnl || 0), 0),
    winRate, totalProfit, totalLoss,
    closedCount: closedTrades.length,
  };

  const filteredTrades = filter === "All" ? trades : trades.filter(t => t.status === filter);
  const fc = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddTrade = () => {
    if (!form.pair.trim()) { setFormError("Pair wajib diisi"); return; }
    if (!form.orderPrice) { setFormError("Entry Price wajib diisi"); return; }
    if (!form.qty) { setFormError("Qty wajib diisi"); return; }
    setFormError("");
    const now = new Date();
    setTrades(prev => [{
      id: Date.now(),
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      pair: form.pair.toUpperCase().trim(),
      type: form.type,
      direction: form.direction,
      orderType: form.orderType,
      orderPrice: parseFloat(form.orderPrice),
      qty: parseFloat(form.qty),
      tp: form.tp ? parseFloat(form.tp) : null,
      sl: form.sl ? parseFloat(form.sl) : null,
      status: form.status,
      pnl: form.pnl ? parseFloat(form.pnl) : null,
      note: form.note,
    }, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const startEdit = (trade) => { setEditId(trade.id); setEditData({ ...trade }); };
  const saveEdit = () => {
    setTrades(prev => prev.map(t => t.id === editId ? {
      ...editData,
      orderPrice: parseFloat(editData.orderPrice) || 0,
      qty: parseFloat(editData.qty) || 0,
      tp: editData.tp ? parseFloat(editData.tp) : null,
      sl: editData.sl ? parseFloat(editData.sl) : null,
      pnl: editData.pnl !== "" && editData.pnl !== null ? parseFloat(editData.pnl) : null,
    } : t));
    setEditId(null);
  };
  const deleteTrade = (id) => setTrades(prev => prev.filter(t => t.id !== id));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e2e8f0",
      fontFamily: "'DM Mono', 'Fira Code', monospace",
      paddingBottom: 60,
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f0f1a 0%, #12121f 100%)",
        borderBottom: "1px solid #1e1e35",
        padding: "24px 20px 18px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6366f1", letterSpacing: 3, fontWeight: 700, marginBottom: 2 }}>
              ◈ TRADING JOURNAL
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1, color: "#f1f5f9" }}>
              Catatan Harian
            </div>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setFormError(""); }}
            style={{
              background: showForm ? "#1e1e35" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: 12, padding: "10px 16px",
              color: showForm ? "#94a3b8" : "#fff", fontFamily: "inherit",
              fontWeight: 700, fontSize: 12, cursor: "pointer", letterSpacing: 1,
              boxShadow: showForm ? "none" : "0 4px 20px rgba(99,102,241,0.4)",
            }}
          >
            {showForm ? "✕ Tutup" : "+ Tambah Order"}
          </button>
        </div>
      </div>

      {/* Add Order Form */}
      {showForm && (
        <div style={{
          margin: "12px 16px 0",
          background: "#0f0f1a",
          border: "1px solid #2d2d4a",
          borderRadius: 16,
          padding: 18,
        }}>
          <div style={{ fontSize: 11, color: "#6366f1", letterSpacing: 2, marginBottom: 16, fontWeight: 700 }}>
            ✦ INPUT ORDER BARU
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>PAIR *</label>
              <input placeholder="cth: BTCUSDT" value={form.pair} onChange={e => fc("pair", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>DIRECTION</label>
              <select value={form.direction} onChange={e => fc("direction", e.target.value)} style={selectStyle}>
                <option>Open Long</option>
                <option>Open Short</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>ENTRY PRICE *</label>
              <input placeholder="0.00" type="number" value={form.orderPrice} onChange={e => fc("orderPrice", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>QTY *</label>
              <input placeholder="0" type="number" value={form.qty} onChange={e => fc("qty", e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>TAKE PROFIT</label>
              <input placeholder="0.00" type="number" value={form.tp} onChange={e => fc("tp", e.target.value)} style={{ ...inputStyle, color: "#34d399" }} />
            </div>
            <div>
              <label style={labelStyle}>STOP LOSS</label>
              <input placeholder="0.00" type="number" value={form.sl} onChange={e => fc("sl", e.target.value)} style={{ ...inputStyle, color: "#f87171" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>ORDER TYPE</label>
              <select value={form.orderType} onChange={e => fc("orderType", e.target.value)} style={selectStyle}>
                <option>Limit</option>
                <option>Market</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>STATUS</label>
              <select value={form.status} onChange={e => fc("status", e.target.value)} style={selectStyle}>
                {["Pending", "Filled", "TP Hit", "SL Hit", "Cancelled"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {(form.status === "TP Hit" || form.status === "SL Hit") && (
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>PnL (USDT)</label>
              <input
                placeholder="cth: -10.50 atau 25.00"
                type="number"
                value={form.pnl}
                onChange={e => fc("pnl", e.target.value)}
                style={{ ...inputStyle, color: parseFloat(form.pnl) < 0 ? "#f87171" : "#34d399" }}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>CATATAN</label>
            <textarea
              placeholder="Setup, alasan entry, dll..."
              value={form.note}
              onChange={e => fc("note", e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>

          {form.orderPrice && form.tp && form.sl && (
            <div style={{
              marginBottom: 14, padding: "8px 12px", background: "#12121f",
              borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11, color: "#475569" }}>Preview R:R</span>
              <RRBadge tp={parseFloat(form.tp)} sl={parseFloat(form.sl)} price={parseFloat(form.orderPrice)} />
            </div>
          )}

          {formError && <div style={{ marginBottom: 10, fontSize: 12, color: "#f87171" }}>⚠ {formError}</div>}

          <button onClick={handleAddTrade} style={{
            width: "100%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", borderRadius: 10, padding: "12px",
            color: "#fff", fontFamily: "inherit", fontWeight: 800,
            fontSize: 13, cursor: "pointer", letterSpacing: 1,
            boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
          }}>
            ✦ SIMPAN ORDER
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "16px 16px 0" }}>
        {[
          { label: "Total", value: stats.total, color: "#a78bfa" },
          { label: "Pending", value: stats.pending, color: "#fbbf24" },
          { label: "TP Hit", value: stats.tp, color: "#34d399" },
          { label: "SL Hit", value: stats.sl, color: "#f87171" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#12121f", border: "1px solid #1e1e35",
            borderRadius: 12, padding: "12px 10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Win Rate + Net P/L */}
      <div style={{ padding: "10px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 4 }}>WIN RATE</div>
          {stats.winRate !== null ? (
            <>
              <div style={{
                fontSize: 28, fontWeight: 900, lineHeight: 1, marginBottom: 6,
                color: parseFloat(stats.winRate) >= 50 ? "#34d399" : "#f87171",
              }}>{stats.winRate}%</div>
              <div style={{ fontSize: 10, color: "#475569" }}>
                {stats.tp}W / {stats.sl}L dari {stats.closedCount} closed
              </div>
              <div style={{ marginTop: 8, height: 4, background: "#1e1e35", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${stats.winRate}%`,
                  background: parseFloat(stats.winRate) >= 50
                    ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                    : "linear-gradient(90deg, #f87171, #fca5a5)",
                  borderRadius: 4, transition: "width 0.6s ease",
                }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>Belum ada closed trade</div>
          )}
        </div>

        <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 4 }}>NET P/L</div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, marginBottom: 6, color: pnlColor(stats.totalPnl) }}>
            {stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(2)}
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 400, marginLeft: 4 }}>USDT</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "#475569" }}>Profit</span>
              <span style={{ color: "#34d399", fontWeight: 700 }}>+{stats.totalProfit.toFixed(2)} USDT</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "#475569" }}>Loss</span>
              <span style={{ color: "#f87171", fontWeight: 700 }}>{stats.totalLoss.toFixed(2)} USDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 8px", overflowX: "auto" }}>
        {["All", "Pending", "Filled", "TP Hit", "SL Hit", "Cancelled"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? "#6366f1" : "#12121f",
            border: `1px solid ${filter === f ? "#6366f1" : "#1e1e35"}`,
            borderRadius: 20, padding: "5px 14px",
            color: filter === f ? "#fff" : "#64748b",
            fontFamily: "inherit", fontSize: 11, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap", letterSpacing: 0.5,
          }}>{f}</button>
        ))}
      </div>

      {/* Trade List */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredTrades.length === 0 && (
          <div style={{ textAlign: "center", color: "#334155", padding: "40px 0", fontSize: 13 }}>
            Belum ada trade. Klik "+ Tambah Order" untuk mulai.
          </div>
        )}

        {filteredTrades.map(trade => (
          <div key={trade.id} style={{
            background: "#0f0f1a", border: "1px solid #1e1e35",
            borderRadius: 14, overflow: "hidden",
          }}>
            {editId === trade.id ? (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: "#6366f1", marginBottom: 12, letterSpacing: 2 }}>EDIT ORDER</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["pair","Pair"],["orderPrice","Entry Price"],["qty","Qty"],["tp","Take Profit"],["sl","Stop Loss"],["pnl","PnL (USDT)"]].map(([k, label]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>{label}</div>
                      <input value={editData[k] ?? ""} onChange={e => setEditData(d => ({ ...d, [k]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Status</div>
                  <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} style={selectStyle}>
                    {["Pending", "Filled", "TP Hit", "SL Hit", "Cancelled"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Catatan</div>
                  <textarea value={editData.note || ""} onChange={e => setEditData(d => ({ ...d, note: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "none" }} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={saveEdit} style={{ flex: 1, background: "#6366f1", border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Simpan</button>
                  <button onClick={() => setEditId(null)} style={{ flex: 1, background: "#1e1e35", border: "none", borderRadius: 8, padding: "10px", color: "#94a3b8", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Batal</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setExpandedId(expandedId === trade.id ? null : trade.id)} style={{ cursor: "pointer" }}>
                <div style={{ padding: "14px 16px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", letterSpacing: -0.5 }}>{trade.pair}</span>
                      <span style={{ fontSize: 10, color: "#475569", marginLeft: 8 }}>{trade.date} {trade.time}</span>
                    </div>
                    <StatusBadge status={trade.status} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                    <div>
                      <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>ENTRY</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{trade.orderPrice}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>TP / SL</div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: "#34d399", fontWeight: 700 }}>{trade.tp ?? "—"}</span>
                        <span style={{ color: "#475569" }}> / </span>
                        <span style={{ color: "#f87171", fontWeight: 700 }}>{trade.sl ?? "—"}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {trade.pnl !== null ? (
                        <>
                          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>PnL</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: pnlColor(trade.pnl) }}>
                            {trade.pnl >= 0 ? "+" : ""}{trade.pnl} USDT
                          </div>
                        </>
                      ) : (
                        <RRBadge tp={trade.tp} sl={trade.sl} price={trade.orderPrice} />
                      )}
                    </div>
                  </div>

                  {expandedId === trade.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e35" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 6 }}>{trade.type}</span>
                        <span style={{ fontSize: 11, color: "#60a5fa", background: "rgba(96,165,250,0.1)", padding: "2px 8px", borderRadius: 6 }}>{trade.direction}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8", background: "#12121f", padding: "2px 8px", borderRadius: 6 }}>Qty: {trade.qty}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8", background: "#12121f", padding: "2px 8px", borderRadius: 6 }}>{trade.orderType}</span>
                      </div>
                      {trade.note && (
                        <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", marginBottom: 8 }}>"{trade.note}"</div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={(e) => { e.stopPropagation(); startEdit(trade); }} style={{ flex: 1, background: "#1e1e35", border: "none", borderRadius: 8, padding: "8px", color: "#a78bfa", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>✏️ Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteTrade(trade.id); }} style={{ background: "#1e1e35", border: "none", borderRadius: 8, padding: "8px 14px", color: "#f87171", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
