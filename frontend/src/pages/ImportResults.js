import React, { useState, useMemo } from "react";

export default function ImportResults() {
  const [url, setUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState(null);

  // États éligibilité
  const [swimmers, setSwimmers] = useState([]);
  const [conflicts, setConflicts] = useState([]);     // keys conflit de nationalités
  const [approvals, setApprovals] = useState({});     // { swimmer_key: bool }

  // Afficher seulement les non-TUN à approuver
  const swimmersToVerify = useMemo(
    () => (swimmers || []).filter(s => !!s.needs_approval),
    [swimmers]
  );

  const doPreview = async (e) => {
    e.preventDefault();
    setMsg(null);
    setPreview(null);
    setSwimmers([]);
    setConflicts([]);
    setApprovals({});
    setLoadingPreview(true);
    try {
      const res = await fetch("http://localhost:5000/api/ingest/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, limit: 8 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.message || "Erreur de prévisualisation." });
      } else {
        setPreview(data);
        setSwimmers(Array.isArray(data.swimmers_verification) ? data.swimmers_verification : []);
        setConflicts(Array.isArray(data.swimmer_conflicts_keys) ? data.swimmer_conflicts_keys : []);
        // Préremplir uniquement pour non-TUN (needs_approval)
        const init = {};
        (data.swimmers_verification || []).forEach((s) => {
          if (s.needs_approval) {
            const fromDb =
              s.existing && typeof s.existing.eligible_points === "boolean"
                ? s.existing.eligible_points
                : undefined;
            // si connu en base -> on respecte ; sinon (première insertion non-TUN) -> false par défaut
            init[s.key] = fromDb !== undefined ? fromDb : false;
          }
        });
        setApprovals(init);
      }
    } catch (err) {
      setMsg({ type: "error", text: String(err) });
    } finally {
      setLoadingPreview(false);
    }
  };

  const doImport = async () => {
    setMsg(null);

    if (!preview) {
      setMsg({ type: "error", text: "Prévisualise et vérifie d’abord les nationalités." });
      return;
    }
    if (conflicts.length > 0) {
      setMsg({ type: "error", text: "Conflit de nationalité détecté : import bloqué." });
      return;
    }

    setLoadingImport(true);
    try {
      const res = await fetch("http://localhost:5000/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, approvals }),   // (NEW) on envoie approvals
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.message || "Erreur d'import." });
      } else {
        const inserted = typeof data?.inserted === "number" ? data.inserted : "?";
        setMsg({
          type: "success",
          text: `Import OK: ${inserted} lignes.`,
        });
      }
    } catch (err) {
      setMsg({ type: "error", text: String(err) });
    } finally {
      setLoadingImport(false);
    }
  };

  // Helpers d’affichage
  const EventHeader = ({ ev }) => {
    if (!ev) return null;
    const dist = ev.distance_par_jambe ?? ev.distance ?? "";
    const main = ev.is_relay ? `${ev.nage} ${ev.legs_count}×${dist} m` : `${ev.nage} ${dist}${dist ? " m" : ""}`;
    return (
      <div>
        <b>Épreuve</b> {main} — {ev.genre}
        {ev.is_relay ? " (Relais)" : ""}
      </div>
    );
  };

  const CECBlock = ({ cec, isRelay }) => {
    if (!cec) return null;
    return (
      <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ marginBottom: 8 }}>
          <b>Catégorie:</b> {cec.categorie} {cec.guessed_category ? " (auto)" : ""}{" "}
          {cec.cec_id ? ` (CEC ${cec.cec_id})` : " (CEC nouveau?)"}
        </div>

        {!isRelay && (
          <>
            {(!cec.header_mapping || Object.keys(cec.header_mapping).length === 0) && (
              <div style={{ color: "crimson" }}>Entête non détectée (vérifie la colonne “Club”).</div>
            )}
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
              header_mapping: {JSON.stringify(cec.header_mapping || {})} | header_row_index: {cec.header_row_index ?? "-"}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Nom</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Club</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Nation</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Année</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Temps</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Points</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Nouveaux ?</th>
                </tr>
              </thead>
              <tbody>
                {(cec.details || []).map((d, j) => (
                  <tr key={j}>
                    <td>{d.fullname}</td>
                    <td>{d.club || <span style={{ color: "crimson" }}>—</span>}</td>
                    <td>{d.nation || "—"}</td>
                    <td>{d.birth_year ?? "—"}</td>
                    <td>{d.time || "—"}</td>
                    <td>{d.points_raw || "0"}</td>
                    <td>
                      {d.error ? (
                        <span style={{ color: "crimson" }}>{d.error}</span>
                      ) : (
                        <>
                          {d.would_create_club ? "🆕 club " : ""}
                          {d.would_create_swimmer ? "🆕 nageur" : !d.would_create_club ? "✔︎" : ""}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {isRelay && (
          <>
            {(cec.details || []).map((t, k) => (
              <div key={k} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px dashed #eee" }}>
                <div>
                  <b>Équipe</b> — Club: <b>{t.club || <span style={{ color: "crimson" }}>manquant</span>}</b> — Temps:{" "}
                  {t.time || "—"} — Points: {t.points} {t.would_create_club ? <span>🆕 club</span> : <span>✔︎</span>}
                  {t.error && <span style={{ color: "crimson" }}> — {t.error}</span>}
                </div>
                <div style={{ marginTop: 6 }}>
                  Membres:
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    {(t.members || []).map((m, z) => (
                      <li key={z}>
                        {m.fullname} — {m.birth_year ?? "—"} {m.would_create_swimmer ? " (🆕 nageur)" : " (✔︎)"}
                        {m.nation ? ` — ${m.nation}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                {t.passages && <div style={{ fontSize: 12, color: "#555" }}>Passages: {t.passages}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  const isMulti = !!(preview && Array.isArray(preview.events));

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px" }}>
      <h2>Importer des résultats (FTN) – Preview & Import</h2>

      <form onSubmit={doPreview} style={{ display: "flex", gap: 12 }}>
        <input
          type="url"
          required
          placeholder="http://ftnatation.tn/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button disabled={loadingPreview} type="submit">
          {loadingPreview ? "Prévisualisation…" : "Prévisualiser"}
        </button>
        <button
          type="button"
          disabled={loadingImport || !url || !preview || conflicts.length > 0}  // (NEW) besoin du preview
          onClick={doImport}
          style={{ opacity: loadingImport ? 0.7 : 1 }}
        >
          {loadingImport ? "Import…" : "Importer"}
        </button>
      </form>

      {msg && (
        <p style={{ marginTop: 16, color: msg.type === "error" ? "crimson" : "green" }}>
          {msg.text}
        </p>
      )}

      {preview && (
        <div style={{ marginTop: 24 }}>
          <h3>Aperçu</h3>
          <div style={{ fontSize: 14, color: "#333" }}>
            <div>
              <b>Champ.</b> {preview.championnat?.nom} — {preview.championnat?.saison} —{" "}
              {preview.championnat?.lieu} — {preview.championnat?.bassin}m
            </div>
            <div>
              <b>Dates</b> {preview.championnat?.datedeb} → {preview.championnat?.datefin}
            </div>
            {Array.isArray(preview.categories) && (
              <div>
                <b>Catégories</b> {preview.categories.join(", ")}
              </div>
            )}
            {Array.isArray(preview.conflicts_cec_ids) && preview.conflicts_cec_ids.length > 0 && (
              <div style={{ color: "crimson", marginTop: 6 }}>
                ⚠️ CEC déjà importés (ids): {preview.conflicts_cec_ids.join(", ")}
              </div>
            )}
          </div>

          {/* Panneau d’approbation — uniquement non-TUN */}
          {swimmersToVerify.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, border: "1px solid #bbb", borderRadius: 8 }}>
              <h4>Éligibilité points — vérification nationalité</h4>
              {conflicts.length > 0 && (
                <div style={{ color: "crimson", marginBottom: 8 }}>
                  ⚠️ Conflit de nationalité détecté pour {conflicts.length} identité(s).
                  Corrige la source avant d’importer.
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Nageur</th>
                    <th style={{ textAlign: "left" }}>Club</th>
                    <th style={{ textAlign: "left" }}>Année</th>
                    <th style={{ textAlign: "left" }}>Nationalité(s)</th>
                    <th style={{ textAlign: "left" }}>Éligible points</th>
                  </tr>
                </thead>
                <tbody>
                  {swimmersToVerify.map((s) => (
                    <tr key={s.key}>
                      <td>{s.fullname}</td>
                      <td>{s.club || "—"}</td>
                      <td>{s.birth_year ?? "—"}</td>
                      <td>{(s.nations || []).join(", ") || "—"}</td>
                      <td>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={!!approvals[s.key]}
                            onChange={(e) => setApprovals((a) => ({ ...a, [s.key]: e.target.checked }))}
                          />
                          autoriser
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Multi-épreuves / fallback single */}
          {isMulti ? (
            <div style={{ marginTop: 12 }}>
              {preview.events.map((evBlock, idx) => (
                <div key={idx} style={{ marginTop: 18, padding: 12, border: "1px solid #bbb", borderRadius: 8 }}>
                  <EventHeader ev={evBlock.epreuve} />
                  {(evBlock.cecs || []).map((cec, i) => (
                    <CECBlock key={i} cec={cec} isRelay={!!evBlock.epreuve?.is_relay} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {preview.epreuve && <EventHeader ev={preview.epreuve} />}
              {(preview.cecs || []).map((c, i) => (
                <CECBlock key={i} cec={c} isRelay={!!preview.epreuve?.is_relay} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
