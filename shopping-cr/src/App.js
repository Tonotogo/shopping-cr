import { useState, useEffect } from "react";

// ─── Groq API (100% FREE) ────────────────────────────────────────────────────
// Get your free key at: https://console.groq.com → API Keys
const GROQ_KEY = process.env.REACT_APP_GROQ_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // free, fast, smart

async function callGroq(systemPrompt, userPrompt) {
  if (!GROQ_KEY) throw new Error("Groq API key not configured. See README.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Groq error ${res.status}`);
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty response from Groq");
  return text;
}

const SYSTEM = `You are an Amazon USA product expert. Always respond with ONLY valid JSON — no markdown fences, no explanation, just raw JSON.

For product searches use exactly:
{"productos":[{"nombre":"Full product name","marca":"Brand","emoji":"emoji","descripcion":"Short description in Spanish 1-2 sentences","caracteristicas":["feature1","feature2","feature3","feature4"],"precio_usd_base":99.99,"calificacion":4.5,"num_resenas":12000,"imagen_query":"brand model keywords","categoria":"category"}]}

For single product links use exactly:
{"nombre":"Full product name","marca":"Brand","emoji":"emoji","descripcion":"Short description in Spanish","caracteristicas":["f1","f2","f3","f4"],"precio_usd_base":99.99,"calificacion":4.5,"num_resenas":1000,"imagen_query":"brand model keywords","categoria":"category"}

Use realistic current Amazon.com USD prices. No markdown. No backticks. Pure JSON only.`;

function extractJSON(text) {
  const attempts = [
    () => JSON.parse(text.trim()),
    () => JSON.parse(text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/im, "").trim()),
    () => { const s = text.indexOf("{"), e = text.lastIndexOf("}"); return JSON.parse(text.slice(s, e + 1)); },
  ];
  for (const fn of attempts) { try { return fn(); } catch {} }
  throw new Error("Could not parse response as JSON");
}

async function searchTop5(query, margin, fee) {
  const text = await callGroq(SYSTEM,
    `Find the 5 best value products on Amazon.com for: "${query}". Return exactly 5 products in the productos array with realistic USD prices.`
  );
  const parsed = extractJSON(text);
  const list = parsed.productos || (Array.isArray(parsed) ? parsed : null);
  if (!list) throw new Error("Invalid response structure");
  return list.slice(0, 5).map(p => applyPricing(p, margin, fee));
}

async function analyzeLink(url, margin, fee) {
  const text = await callGroq(SYSTEM, `Analyze this Amazon product URL and extract all product details: ${url}`);
  return applyPricing(extractJSON(text), margin, fee);
}

function applyPricing(p, margin, fee) {
  const priceUSD = +(p.precio_usd_base * (1 + margin / 100)).toFixed(2);
  return { ...p, priceUSD, total: +(priceUSD + (Number(fee) || 0)).toFixed(2) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = n => "$" + Number(n).toFixed(2);
const copy = t => navigator.clipboard.writeText(t);

function buildWA(p, fee, deadline) {
  const total = p.priceUSD + (Number(fee) || 0);
  return [
    `${p.emoji} *${p.nombre}*`, "",
    p.descripcion, "",
    "📌 *Características:*",
    ...(p.caracteristicas || []).map(c => `   ✅ ${c}`),
    "",
    `💵 *Precio: ${fmt(p.priceUSD)}*`,
    Number(fee) > 0 ? `🚚 *Servicio: ${fmt(Number(fee))}*` : null,
    Number(fee) > 0 ? `💳 *Total: ${fmt(total)}*` : null,
    deadline ? `⏰ *Fecha límite: ${deadline}*` : null,
    "",
    "📲 *Responde con tu nombre y cantidad para apartar.*",
    "🇨🇷 _Servicio de compras en el extranjero · Costa Rica_",
  ].filter(l => l !== null).join("\n");
}

// ─── UI Components ────────────────────────────────────────────────────────────
function Img({ query, size = 82 }) {
  const [i, setI] = useState(0);
  const srcs = [
    `https://source.unsplash.com/featured/${size}x${size}/?${encodeURIComponent(query)}`,
    `https://loremflickr.com/${size}/${size}/${encodeURIComponent((query || "product").split(" ").slice(0, 2).join(","))}`,
  ];
  if (i >= srcs.length) return (
    <div style={{ width: size, height: size, borderRadius: 10, background: "#f0f2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, flexShrink: 0 }}>📦</div>
  );
  return <img src={srcs[i]} alt={query} width={size} height={size}
    style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "2px solid #f0f2ff" }}
    onError={() => setI(x => x + 1)} />;
}

function ErrBox({ msg }) {
  return (
    <div style={{ background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: 10, padding: 12, marginTop: 10 }}>
      <p style={{ color: "#c53030", fontWeight: 700, fontSize: 13 }}>⚠️ Error</p>
      <p style={{ color: "#742a2a", fontSize: 12, marginTop: 4, wordBreak: "break-all" }}>{msg}</p>
    </div>
  );
}

function Loader({ text = "Searching Amazon.com..." }) {
  return (
    <div style={{ background: "white", borderRadius: 14, padding: 40, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{ width: 34, height: 34, border: "3px solid #f0f2ff", borderTopColor: "#6c63ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#555", fontWeight: 600 }}>{text}</p>
      <p style={{ fontSize: 12, color: "#aaa" }}>Powered by Groq — usually under 5 seconds</p>
    </div>
  );
}

const RANK_COLORS = ["#f1c40f", "#95a5a6", "#cd7f32", "#6c63ff", "#3498db"];

function ProductCard({ p, index, fee, deadline, onAdd }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const color = RANK_COLORS[index] || "#6c63ff";

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", borderLeft: `4px solid ${color}`, animation: `fadeIn 0.35s ease ${index * 70}ms both` }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, color: "white", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>#{index + 1}</div>
          <Img query={p.imagen_query || p.nombre || "product"} size={82} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ flex: 1, marginRight: 8 }}>
              <span style={{ display: "inline-block", background: "#f0f2ff", color: "#6c63ff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, marginBottom: 4 }}>{p.marca}</span>
              <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.3 }}>{p.nombre}</h3>
            </div>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{p.emoji}</span>
          </div>
          <div style={{ margin: "3px 0 7px", fontSize: 12 }}>
            <span style={{ color: "#f39c12" }}>{"★".repeat(Math.round(p.calificacion || 4))}{"☆".repeat(5 - Math.round(p.calificacion || 4))}</span>
            <span style={{ color: "#aaa", marginLeft: 5 }}>{p.calificacion} · {(p.num_resenas || 0).toLocaleString()} reviews</span>
          </div>
          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, marginBottom: 8 }}>{p.descripcion}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8f9ff", borderRadius: 8, padding: "8px 12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>Amazon base</div>
              <div style={{ fontSize: 12, color: "#bbb", textDecoration: "line-through" }}>{fmt(p.precio_usd_base)}</div>
            </div>
            <span style={{ color: "#ddd" }}>›</span>
            <div style={{ background: "#e8fdf1", borderRadius: 6, padding: "3px 8px" }}>
              <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>Your price</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e", fontFamily: "'Sora',sans-serif" }}>{fmt(p.priceUSD)}</div>
            </div>
            {Number(fee) > 0 && <>
              <span style={{ color: "#ddd" }}>+</span>
              <div>
                <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>Service</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e67e22" }}>{fmt(Number(fee))}</div>
              </div>
              <span style={{ color: "#ddd" }}>=</span>
              <div style={{ background: "#f0f2ff", borderRadius: 6, padding: "3px 8px" }}>
                <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>Total</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#6c63ff", fontFamily: "'Sora',sans-serif" }}>{fmt(p.total)}</div>
              </div>
            </>}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f2ff" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>✅ Características</p>
          <ul style={{ paddingLeft: 16 }}>{(p.caracteristicas || []).map((c, i) => <li key={i} style={{ fontSize: 13, color: "#555", marginBottom: 3 }}>{c}</li>)}</ul>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "#25D366", fontWeight: 700, marginBottom: 6 }}>📱 Mensaje WhatsApp</p>
            <div style={{ background: "#e5ddd5", borderRadius: 10, padding: 10 }}>
              <pre style={{ background: "white", borderRadius: 8, padding: 10, fontSize: 12, fontFamily: "inherit", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#1a1a2e" }}>{buildWA(p, fee, deadline)}</pre>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={() => setExpanded(e => !e)} style={btnGhost}>{expanded ? "▲ Ocultar" : "▼ Detalles + WhatsApp"}</button>
        <button onClick={() => { copy(buildWA(p, fee, deadline)); setCopied(true); setTimeout(() => setCopied(false), 2500); }} style={btnWA}>{copied ? "✅ ¡Copiado!" : "📋 Copiar WhatsApp"}</button>
        <button onClick={() => onAdd(p)} style={btnSec}>📋 Agregar a Pedidos</button>
      </div>
    </div>
  );
}

// ─── Panels ───────────────────────────────────────────────────────────────────
function Top5Panel({ margin, fee, deadline, onAdd }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");

  async function search() {
    if (!query.trim()) return;
    setLoading(true); setError(""); setResults([]); setLabel(query);
    try { setResults(await searchTop5(query, margin, fee)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <label style={lbl}>🔍 ¿Qué producto buscás?</label>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 10 }}>
          Categoría, marca o modelo. Ej: <em>"audífonos Sony"</em>, <em>"iPhone 16"</em>, <em>"Nespresso"</em>
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={inp} placeholder='"laptop gaming" · "tenis Nike" · "cafetera"'
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()} />
          <button onClick={search} disabled={loading} style={{ ...btnPri, opacity: loading ? 0.6 : 1 }}>
            {loading ? "⏳" : "🔍 Top 5"}
          </button>
        </div>
        {error && <ErrBox msg={error} />}
      </div>
      {loading && <Loader />}
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontFamily: "'Sora',sans-serif", color: "#1a1a2e", fontSize: 14 }}>🏆 Top 5: <em style={{ color: "#6c63ff" }}>{label}</em></h3>
            <span style={bdg}>{results.length} productos</span>
          </div>
          {results.map((p, i) => <ProductCard key={i} p={p} index={i} fee={fee} deadline={deadline} onAdd={onAdd} />)}
        </div>
      )}
    </div>
  );
}

function LinkPanel({ margin, fee, deadline, onAdd }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");

  async function analyze() {
    if (!url.trim()) return;
    setLoading(true); setError(""); setProduct(null);
    try { setProduct(await analyzeLink(url, margin, fee)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <label style={lbl}>🔗 Link de Amazon USA</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={inp} placeholder="https://www.amazon.com/dp/..." value={url} onChange={e => setUrl(e.target.value)} />
          <button onClick={analyze} disabled={loading} style={{ ...btnPri, opacity: loading ? 0.6 : 1 }}>{loading ? "⏳" : "🔍 Analizar"}</button>
        </div>
        {error && <ErrBox msg={error} />}
      </div>
      {loading && <Loader text="Analizando producto..." />}
      {product && <ProductCard p={product} index={0} fee={fee} deadline={deadline} onAdd={onAdd} />}
    </div>
  );
}

function OrdersPanel({ products, setProducts }) {
  const [form, setForm] = useState({});
  const SC = { Pendiente: "#f39c12", Confirmado: "#27ae60", Entregado: "#3498db" };
  const SN = { Pendiente: "Confirmado", Confirmado: "Entregado", Entregado: "Pendiente" };
  const sf = (pid, k, v) => setForm(p => ({ ...p, [pid]: { ...(p[pid] || {}), [k]: v } }));

  function addOrder(pid) {
    const f = form[pid] || {};
    if (!f.nombre?.trim()) return;
    setProducts(p => p.map(x => x.id === pid
      ? { ...x, pedidos: [...x.pedidos, { id: Date.now(), nombre: f.nombre, cantidad: Number(f.cantidad) || 1, telefono: f.telefono || "", estado: "Pendiente" }] }
      : x));
    setForm(p => ({ ...p, [pid]: {} }));
  }

  function nextStatus(pid, oid) {
    setProducts(p => p.map(x => x.id === pid
      ? { ...x, pedidos: x.pedidos.map(o => o.id === oid ? { ...o, estado: SN[o.estado] } : o) }
      : x));
  }

  function exportSummary(pr) {
    copy([
      `📦 RESUMEN DE PEDIDOS`, `${pr.emoji} ${pr.nombre}`,
      `Precio: ${fmt(pr.priceUSD)}${Number(pr.total) !== Number(pr.priceUSD) ? ` | Total: ${fmt(pr.total)}` : ""}`, ``,
      ...pr.pedidos.map((o, i) => `${i + 1}. ${o.nombre} | Cant: ${o.cantidad} | Tel: ${o.telefono || "N/A"} | ${o.estado}`),
      ``, `Pedidos: ${pr.pedidos.length} | Unidades: ${pr.pedidos.reduce((s, o) => s + o.cantidad, 0)}`,
      `Total cobrar: ${fmt(pr.pedidos.reduce((s, o) => s + pr.priceUSD * o.cantidad, 0))}`,
    ].join("\n"));
    alert("✅ ¡Resumen copiado!");
  }

  if (!products.length) return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 52 }}>📋</span>
      <h3 style={{ color: "#555", fontFamily: "'Sora',sans-serif" }}>Sin productos activos</h3>
      <p style={{ fontSize: 13, maxWidth: 300, lineHeight: 1.6 }}>Buscá un producto y tocá "Agregar a Pedidos".</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {products.map(pr => (
        <div key={pr.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>{pr.emoji}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontFamily: "'Sora',sans-serif" }}>{pr.nombre}</h3>
                <span style={{ fontSize: 11, color: "#888" }}>{fmt(pr.priceUSD)}{Number(pr.total) !== Number(pr.priceUSD) ? ` · Total: ${fmt(pr.total)}` : ""}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={bdg}>{pr.pedidos.length} pedidos</span>
              <button onClick={() => exportSummary(pr)} style={btnSec}>📋 Exportar</button>
              <button onClick={() => setProducts(p => p.filter(x => x.id !== pr.id))} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
          </div>

          <div style={{ background: "#f8f9ff", borderRadius: 9, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 8 }}>➕ Registrar pedido</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr auto", gap: 8, alignItems: "end" }}>
              {[["Nombre", "text", "Cliente", "nombre"], ["Cant.", "number", "1", "cantidad"], ["Teléfono", "text", "8888-8888", "telefono"]].map(([l, t, ph, k]) => (
                <div key={k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", display: "block", marginBottom: 3 }}>{l}</label>
                  <input type={t} placeholder={ph} value={(form[pr.id] || {})[k] || ""} onChange={e => sf(pr.id, k, e.target.value)}
                    style={{ ...inp, padding: "7px 10px", fontSize: 13 }} />
                </div>
              ))}
              <button onClick={() => addOrder(pr.id)} style={btnPri}>Agregar</button>
            </div>
          </div>

          {pr.pedidos.length === 0
            ? <p style={{ color: "#ccc", fontSize: 13, textAlign: "center", padding: "6px 0" }}>Sin pedidos aún.</p>
            : <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 400 }}>
                  <thead><tr>{["#", "Cliente", "Cant.", "Teléfono", "Total USD", "Estado"].map(h => <th key={h} style={{ textAlign: "left", padding: "7px 8px", color: "#aaa", fontSize: 10, fontWeight: 700, textTransform: "uppercase", borderBottom: "2px solid #f0f2ff" }}>{h}</th>)}</tr></thead>
                  <tbody>{pr.pedidos.map((o, i) => (
                    <tr key={o.id}>
                      <td style={{ padding: "8px", color: "#aaa" }}>{i + 1}</td>
                      <td style={{ padding: "8px", fontWeight: 600 }}>{o.nombre}</td>
                      <td style={{ padding: "8px" }}>{o.cantidad}</td>
                      <td style={{ padding: "8px" }}>{o.telefono || "—"}</td>
                      <td style={{ padding: "8px", fontWeight: 700, color: "#27ae60" }}>{fmt(pr.priceUSD * o.cantidad)}</td>
                      <td style={{ padding: "8px" }}>
                        <button onClick={() => nextStatus(pr.id, o.id)} style={{ background: SC[o.estado], color: "white", border: "none", borderRadius: 20, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{o.estado}</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
          }
        </div>
      ))}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const card    = { background: "white", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" };
const lbl     = { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 };
const inp     = { width: "100%", border: "2px solid #e8ecf4", borderRadius: 9, padding: "9px 12px", fontSize: 14, fontFamily: "inherit", outline: "none" };
const btnPri  = { background: "linear-gradient(135deg,#6c63ff,#4834d4)", color: "white", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const btnWA   = { background: "linear-gradient(135deg,#25D366,#128C7E)", color: "white", border: "none", borderRadius: 7, padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const btnSec  = { background: "#f0f2ff", color: "#6c63ff", border: "2px solid #e0e0ff", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" };
const btnGhost= { background: "transparent", color: "#888", border: "1px solid #e8ecf4", borderRadius: 7, padding: "5px 11px", fontSize: 12, cursor: "pointer" };
const bdg     = { background: "#e8f4fd", color: "#2980b9", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 };

// ─── PWA Install Banner ───────────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); setPrompt(e); setShow(true); });
  }, []);
  if (!show) return null;
  return (
    <div style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", color: "white", padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
      <span>📲 <strong>Instalá la app</strong> en tu celular para acceso rápido</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={async () => { prompt.prompt(); const { outcome } = await prompt.userChoice; if (outcome === "accepted") setShow(false); }} style={{ background: "white", color: "#128C7E", border: "none", borderRadius: 7, padding: "5px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Instalar</button>
        <button onClick={() => setShow(false)} style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "none", borderRadius: 7, padding: "5px 9px", cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const TABS = ["🔍 Buscar Top 5", "🔗 Por Link", "📋 Pedidos"];

export default function App() {
  const [tab, setTab]         = useState(0);
  const [margin, setMargin]   = useState(20);
  const [fee, setFee]         = useState("");
  const [deadline, setDeadline] = useState("");
  const [orders, setOrders]   = useState([]);

  function addToOrders(product) {
    if (orders.find(p => p.nombre === product.nombre)) { alert("⚠️ Ya está en pedidos."); return; }
    setOrders(prev => [...prev, { ...product, id: Date.now(), pedidos: [] }]);
    alert(`✅ "${product.nombre}" agregado a Pedidos.`);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#f0f2ff;min-height:100vh}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus{border-color:#6c63ff!important}
        em{font-style:italic}
        @media(max-width:580px){
          .sg{grid-template-columns:1fr 1fr!important}
          .sg>div:last-child{grid-column:1/-1}
        }
      `}</style>

      <InstallBanner />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)", padding: "22px 20px 0", color: "white" }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800 }}>🛍️ Shopping Agent CR</div>
        <div style={{ fontSize: 13, color: "#a0aec0", marginTop: 3 }}>Compras en el extranjero · Costa Rica 🇨🇷 · Precios en USD</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {[["#25D366","🤖 IA Groq (gratis)"],["#3498db","🇺🇸 Amazon USA"],["#e67e22","💵 USD"],["#8e44ad","📲 PWA"]].map(([bg,l])=>(
            <span key={l} style={{ background: bg, color: "white", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{l}</span>
          ))}
        </div>

        {/* Settings */}
        <div className="sg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
          {[["💰 Margen %","number",margin,e=>setMargin(Number(e.target.value))],
            ["🚚 Servicio $","number",fee,e=>setFee(e.target.value)],
            ["⏰ Fecha límite","date",deadline,e=>setDeadline(e.target.value)]
          ].map(([l,t,v,fn])=>(
            <div key={l}>
              <label style={{ fontSize: 10, color: "#a0aec0", fontWeight: 700, display: "block", marginBottom: 4 }}>{l}</label>
              <input type={t} value={v} onChange={fn} step={t==="number"?"any":undefined}
                style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "white", outline: "none" }} />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", marginTop: 14, overflowX: "auto" }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{ padding: "12px 18px", fontSize: 13, fontFamily: "'Sora',sans-serif", fontWeight: 600, color: tab===i?"#25D366":"#6b7280", background: "transparent", border: "none", borderBottom: `3px solid ${tab===i?"#25D366":"transparent"}`, cursor: "pointer", whiteSpace: "nowrap" }}>
              {t}{i===2&&orders.length>0&&<span style={{ background:"#e74c3c",color:"white",fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:10,marginLeft:5 }}>{orders.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: "20px auto", padding: "0 14px 40px" }}>
        {tab===0 && <Top5Panel margin={margin} fee={fee} deadline={deadline} onAdd={addToOrders} />}
        {tab===1 && <LinkPanel margin={margin} fee={fee} deadline={deadline} onAdd={addToOrders} />}
        {tab===2 && <OrdersPanel products={orders} setProducts={setOrders} />}
      </div>
    </>
  );
}
