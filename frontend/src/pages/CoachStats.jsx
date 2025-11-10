import React, { useState, useEffect } from "react";
import { Form, Button, Spinner, Alert } from "react-bootstrap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function CoachStats() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [nageurs, setNageurs] = useState([]);
  const [epreuves, setEpreuves] = useState([]);
  const [selectedNageur, setSelectedNageur] = useState("");
  const [selectedEpreuve, setSelectedEpreuve] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 🗓️ Charger la période du dernier mois
  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);
    setStart(lastMonth.toISOString().split("T")[0]);
    setEnd(today.toISOString().split("T")[0]);
  }, []);

  // 👥 Charger les nageurs
  useEffect(() => {
    fetch("http://localhost:5000/api/coach/nageurs/mine", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setNageurs(data.nageurs || []))
      .catch((err) => console.error("Erreur chargement nageurs :", err));
  }, []);

  // 🏊‍♂️ Charger les épreuves
  useEffect(() => {
    fetch("http://localhost:5000/api/coach/epreuves", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setEpreuves(data.epreuves || []))
      .catch((err) => console.error("Erreur chargement épreuves :", err));
  }, []);

  // 🚀 Charger les stats
  const handleFetch = async () => {
    if (!start || !end) return;
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ start, end });
      if (selectedNageur) params.append("nageur_id", selectedNageur);
      if (selectedEpreuve) params.append("epreuve_label", selectedEpreuve);

      const res = await fetch(`http://localhost:5000/api/coach/stats?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStats(data);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (start && end) handleFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  // === Helpers ===
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return isNaN(d)
      ? dateStr
      : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };

  // === Rendu ===
  return (
    <div className="container py-4">
      <h3 className="text-center mb-4">Statistiques du Coach</h3>

      {/* === Filtres === */}
      <div className="d-flex flex-wrap justify-content-center gap-3 mb-4">
        <Form.Group>
          <Form.Label>Début :</Form.Label>
          <Form.Control type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Form.Group>

        <Form.Group>
          <Form.Label>Fin :</Form.Label>
          <Form.Control type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Form.Group>

        <Form.Group>
          <Form.Label>Nageur :</Form.Label>
          <Form.Select value={selectedNageur} onChange={(e) => setSelectedNageur(e.target.value)}>
            <option value="">Tous les nageurs</option>
            {nageurs.map((n) => (
              <option key={n.id_nageur} value={n.id_nageur}>
                {n.prenom} {n.nom}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group>
          <Form.Label>Épreuve :</Form.Label>
          <Form.Select
            value={selectedEpreuve}
            onChange={(e) => setSelectedEpreuve(e.target.value)}
          >
            <option value="">Choisir une épreuve</option>
            {epreuves.map((e) => (
              <option key={e.epreuve_id} value={`${e.distance}m ${e.nage} (${e.genre})`}>
                {e.distance}m {e.nage} ({e.genre})
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Button onClick={handleFetch} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Actualiser"}
        </Button>
      </div>

      {message && <Alert>{message}</Alert>}

      {/* === Performances === */}
      {selectedEpreuve ? (
        stats?.performances?.[selectedEpreuve]?.length > 0 ? (
          <div className="mt-4">
            <h5 className="text-center mb-3">Performances — {selectedEpreuve}</h5>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={stats.performances[selectedEpreuve]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis />
                <Tooltip
                  formatter={(val, name, entry) =>
                    `${entry.payload.nageur} : ${val.toFixed(2)} s`
                  }
                  labelFormatter={(label) => `Date : ${formatDate(label)}`}
                />
                <Legend />
                {[...new Set(stats.performances[selectedEpreuve].map((d) => d.nageur))].map(
                  (nageur, i) => (
                    <Line
                      key={nageur}
                      type="monotone"
                      dataKey="temps"
                      data={stats.performances[selectedEpreuve].filter(
                        (d) => d.nageur === nageur
                      )}
                      name={nageur}
                      stroke={`hsl(${i * 60}, 70%, 50%)`}
                      dot
                    />
                  )
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-muted">
            Aucun résultat de test pour cette épreuve sur la période sélectionnée.
          </p>
        )
      ) : (
        <p className="text-center text-muted">
          ⚠️ Veuillez choisir une épreuve pour visualiser les performances.
        </p>
      )}

      {/* === Classement par moyenne === */}
      {stats?.classements && selectedEpreuve && stats.classements[selectedEpreuve] ? (
        <div className="mt-5">
          <h5 className="text-center mb-3">
            Classement par moyenne — {selectedEpreuve}
          </h5>
          <div className="table-responsive">
            <table className="table table-bordered text-center align-middle">
              <thead className="table-light">
                <tr>
                  <th>Rang</th>
                  <th>Nageur</th>
                  <th>Moyenne (s)</th>
                </tr>
              </thead>
              <tbody>
                {stats.classements[selectedEpreuve].map((r, i) => (
                  <tr key={r.nageur}>
                    <td>
                      <strong
                        className={
                          i === 0
                            ? "text-success"
                            : i === 1
                            ? "text-primary"
                            : i === 2
                            ? "text-warning"
                            : ""
                        }
                      >
                        {i + 1}
                      </strong>
                    </td>
                    <td>{r.nageur}</td>
                    <td>{r.moyenne?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedEpreuve && (
        <p className="text-center text-muted mt-3">
          Aucun classement disponible pour cette épreuve.
        </p>
      )}

      {/* === Analyse des absences (tableau + message si vide) === */}
      <div className="mt-5">
        <h5 className="text-center mb-3">Analyse des absences</h5>
        {stats?.absences_detail?.length > 0 ? (
          <div className="table-responsive mt-4">
            <table className="table table-striped text-center align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nageur</th>
                  <th>Présences</th>
                  <th>Absences</th>
                  <th>Taux de présence (%)</th>
                </tr>
              </thead>
              <tbody>
                {stats.absences_detail.map((n) => (
                  <tr key={n.nageur}>
                    <td>{n.nageur}</td>
                    <td>{n.presences}</td>
                    <td>{n.absences}</td>
                    <td>
                      <strong
                        className={
                          n.taux_presence >= 90
                            ? "text-success"
                            : n.taux_presence >= 75
                            ? "text-warning"
                            : "text-danger"
                        }
                      >
                        {n.taux_presence}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted">
            Aucune donnée d’absence sur cette période.
          </p>
        )}
      </div>
    </div>
  );
}
