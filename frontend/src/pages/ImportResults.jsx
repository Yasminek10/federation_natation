// src/pages/ImportResults.jsx
import React, { useState } from "react";

export default function ImportResults() {
  const [url, setUrl] = useState("");
  const [cecId, setCecId] = useState("");
  const [isRelay, setIsRelay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [aggregate, setAggregate] = useState([]);

  const handleImport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setAggregate([]);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/results/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // si tu utilises des sessions
        body: JSON.stringify({
          url,
          cec_id: Number(cecId),
          is_relay: isRelay,
          double_relay_points: true
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur import");

      setMsg(`${data.message} (cec_id=${cecId})`);

      // Récupère l’agrégat pour affichage
      const r2 = await fetch(`http://127.0.0.1:5000/api/results/cec/${cecId}`, {
        credentials: "include",
      });
      const data2 = await r2.json();
      setAggregate(data2.aggregate || []);
    } catch (err) {
      setMsg("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{maxWidth: 800, margin: "30px auto", padding: 16}}>
      <h2>Importer des résultats depuis un lien</h2>
      <form onSubmit={handleImport} style={{display: "grid", gap: 12}}>
        <label>URL de la page (HTML)</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://ftnatation.tn/..." />

        <label>CEC ID (championnat_epreuve_categorie)</label>
        <input value={cecId} onChange={e => setCecId(e.target.value)} type="number" placeholder="ex: 25015" />

        <label style={{display:"flex", alignItems:"center", gap:8}}>
          <input type="checkbox" checked={isRelay} onChange={e => setIsRelay(e.target.checked)} />
          Épreuve relais
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Import en cours..." : "Importer"}
        </button>
      </form>

      {msg && <p style={{marginTop:12}}>{msg}</p>}

      {aggregate.length > 0 && (
        <>
          <h3 style={{marginTop:24}}>Classement par club</h3>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left", borderBottom:"1px solid #e5e7eb", padding:"8px"}}>Club</th>
                  <th style={{textAlign:"right", borderBottom:"1px solid #e5e7eb", padding:"8px"}}>Points</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.map((row, i) => (
                  <tr key={i}>
                    <td style={{padding:"8px", borderBottom:"1px solid #f1f5f9"}}>{row.club}</td>
                    <td style={{padding:"8px", borderBottom:"1px solid #f1f5f9", textAlign:"right"}}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
