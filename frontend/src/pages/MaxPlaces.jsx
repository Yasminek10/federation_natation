import React, { useEffect, useState } from "react";
import { Table, Button, Form, Alert, Spinner, Card, Badge } from "react-bootstrap";
import { FaClipboardList, FaSync, FaSave } from "react-icons/fa";

export default function MaxPlacesPage() {
  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("http://localhost:5000/api/maxplaces/max-places", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onChangeCell = (idx, key, value) => {
    setRows((prev) => {
      const out = [...prev];
      const clean = value === "" ? null : Number(value);
      out[idx] = { ...out[idx], [key]: clean };
      return out;
    });
  };

  const saveAll = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setMsg(null);
    try {
      const updates = rows.map((r) => ({
        categorie_id: r.categorie_id,
        max_places_indiv: r.max_places_indiv ?? null,
        max_places_relay: r.max_places_relay ?? null,
      }));
      const res = await fetch("http://localhost:5000/api/maxplaces/max-places", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "ok") throw new Error(data.error || "Échec de l'enregistrement");
      setMsg({ type: "success", text: `Règles enregistrées (${data.updated} catégorie(s) mises à jour).` });
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container rules-page">
      <Card className="rules-card mx-auto">
        <Card.Header className="rules-card-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="header-icon"><FaClipboardList /></div>
            <div>
              <h4 className="m-0 text-white">Max places par catégorie</h4>
              <div className="text-white-50 small">
                Définissez la limite d’athlètes par catégorie — {rows.length} catégorie(s)
              </div>
            </div>
          </div>
          <Badge bg={isAdmin ? "danger" : "secondary"} className="role-badge">
            {isAdmin ? "Mode administrateur" : "Lecture seule"}
          </Badge>
        </Card.Header>

        <Card.Body className="p-0">
          {/* Toolbar */}
          <div className="rules-toolbar d-flex align-items-center gap-2">
            <Button variant="outline-secondary" onClick={load} disabled={loading}>
              {loading ? (<><Spinner size="sm" animation="border" className="me-2" />Chargement…</>)
                       : (<><FaSync className="me-2" />Actualiser</>)}
            </Button>

            {isAdmin && (
              <Button variant="primary" onClick={saveAll} disabled={saving || loading || rows.length === 0}>
                {saving ? (<><Spinner size="sm" animation="border" className="me-2" />Enregistrement…</>)
                        : (<><FaSave className="me-2" />Enregistrer</>)}
              </Button>
            )}

            <div className="ms-auto small text-muted">
              {isAdmin ? "Astuce : laissez vide pour aucune limite." : "Lecture seule."}
            </div>
          </div>

          {msg && (
            <div className="px-3">
              <Alert variant={msg.type === "error" ? "danger" : "success"} onClose={() => setMsg(null)} dismissible>
                {msg.text}
              </Alert>
            </div>
          )}

          {/* TABLEAU SIMPLE (Bootstrap pur) */}
          <div className="table-responsive p-3">
            <Table striped bordered className="align-middle m-0">
              <thead className="table-light">
                <tr>
                  <th>Catégorie</th>
                  <th style={{ width: 220 }}>Max places (individuel)</th>
                  <th style={{ width: 220 }}>Max places (relais)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.categorie_id}>
                    <td className="fw-semibold">{r.categorie}</td>
                    <td>
                      <Form.Control
                        type="number"
                        min={0}
                        value={r.max_places_indiv ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => onChangeCell(idx, "max_places_indiv", e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min={0}
                        value={r.max_places_relay ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => onChangeCell(idx, "max_places_relay", e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-4">Aucune catégorie.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
