import React, { useEffect, useMemo, useState } from "react";

export default function EligibilityPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // filtres
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const p = new URLSearchParams({
        search, only_pending: onlyPending ? "1" : "0",
        page: String(page), page_size: String(pageSize),
      });
      const res = await fetch(`/api/swimmers/approvals?${p.toString()}`, { credentials: "include" });
      const data = await res.json();
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setMsg({ type: "error", text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, onlyPending, page]);

  const toggle = async (id, val) => {
    // optimistic update
    setRows(rs => rs.map(r => r.id === id ? { ...r, eligible_points: val } : r));
    try {
      const res = await fetch(`/api/swimmers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eligible_points: !!val }),
      });
      if (!res.ok) throw new Error("Erreur sauvegarde");
    } catch (e) {
      // rollback
      setRows(rs => rs.map(r => r.id === id ? { ...r, eligible_points: !val } : r));
      setMsg({ type: "error", text: "Échec de la mise à jour" });
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "30px auto", padding: 16 }}>
      <h2>Éligibilité & nationalités</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="Rechercher nom/prénom…"
          value={search}
          onChange={e => { setPage(1); setSearch(e.target.value); }}
          style={{ padding: 8, flex: 1 }}
        />
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={onlyPending} onChange={e => { setPage(1); setOnlyPending(e.target.checked); }} />
          seulement à approuver
        </label>
        <button onClick={load} disabled={loading}>{loading ? "Chargement…" : "Actualiser"}</button>
      </div>

      {msg && <div style={{ color: msg.type === "error" ? "crimson" : "green", marginBottom: 8 }}>{msg.text}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Nageur</th>
            <th style={{ textAlign: "left" }}>Club</th>
            <th style={{ textAlign: "left" }}>Année</th>
            <th style={{ textAlign: "left" }}>Nationalité</th>
            <th style={{ textAlign: "left" }}>Éligible points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.nom} {r.prenom}</td>
              <td>{r.club}</td>
              <td>{r.birth_year ?? "—"}</td>
              <td>{r.nationalite || "—"}</td>
              <td>
                <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={!!r.eligible_points} onChange={e => toggle(r.id, e.target.checked)} />
                  autoriser
                </label>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr><td colSpan={5} style={{ color: "#666", padding: 12 }}>Aucun nageur.</td></tr>
          )}
        </tbody>
      </table>

      {total > pageSize && (
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button disabled={page<=1} onClick={() => setPage(p => p-1)}>←</button>
          <div>Page {page} / {Math.ceil(total/pageSize)}</div>
          <button disabled={page>=Math.ceil(total/pageSize)} onClick={() => setPage(p => p+1)}>→</button>
        </div>
      )}
    </div>
  );
}
