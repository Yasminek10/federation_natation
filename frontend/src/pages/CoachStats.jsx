import React, { useState, useEffect } from "react";
import { Form, Button, Spinner, Alert } from "react-bootstrap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
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

  // 🗓️ Au chargement : définir la période du dernier mois
  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);

    setStart(lastMonth.toISOString().split("T")[0]);
    setEnd(today.toISOString().split("T")[0]);
  }, []);

  // 👥 Charger les nageurs du coach
  useEffect(() => {
    fetch("http://localhost:5000/api/coach/nageurs/mine", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setNageurs(data.nageurs || []))
      .catch((err) => console.error("Erreur chargement nageurs :", err));
  }, []);

  // 🏊‍♂️ Charger les épreuves disponibles
  useEffect(() => {
    fetch("http://localhost:5000/api/coach/epreuves", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setEpreuves(data.epreuves || []))
      .catch((err) => console.error("Erreur chargement épreuves :", err));
  }, []);

  // 🚀 Charger automatiquement les stats au démarrage
  useEffect(() => {
    if (start && end) handleFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  // ⚙️ Fonction de récupération des statistiques
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

  return (
    <div className="container py-4">
      <h3 className="text-center mb-4"> Statistiques du Coach</h3>

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
            <option value="">Toutes les épreuves</option>
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

      {/* === Graphique présence === */}
      {stats?.presences?.length > 0 && (
        <div className="mb-5">
          <h5 className="text-center">Taux de présence (%)</h5>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.presences}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="taux_presence" stroke="#28a745" name="Présence %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* === Graphique performances === */}
{stats?.performances && Object.keys(stats.performances).length > 0 && (
  <div>
    <h5 className="text-center">Évolution des performances (temps en s)</h5>
    {Object.entries(stats.performances)
      .filter(([label]) => !selectedEpreuve || label === selectedEpreuve)
      .map(([label, data]) => {
        // 🔹 Regrouper les données par nageur
        const grouped = {};
        data.forEach((d) => {
          if (!grouped[d.nageur]) grouped[d.nageur] = [];
          grouped[d.nageur].push({ date: d.date, temps: d.temps });
        });

        // 🔹 Fusionner toutes les dates uniques
        const allDates = Array.from(new Set(data.map((d) => d.date))).sort();

        // 🔹 Construire un dataset global : une ligne = une date, colonnes = nageurs
        const mergedData = allDates.map((date) => {
          const row = { date };
          Object.entries(grouped).forEach(([nageur, values]) => {
            const found = values.find((v) => v.date === date);
            row[nageur] = found ? parseFloat(found.temps) : null;
          });
          return row;
        });

        // 🔹 Formateur de date court (JJ/MM)
        const formatDate = (dateStr) => {
          const d = new Date(dateStr);
          if (isNaN(d)) return dateStr; // sécurité
          return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        };

        return (
          <div key={label} className="my-4">
            <h6 className="text-center">{label}</h6>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mergedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis />
                <Tooltip
                  labelFormatter={(label) =>
                    `Date : ${formatDate(label)}`
                  }
                />
                {Object.keys(grouped).map((nageur, idx) => (
                  <Line
                    key={nageur}
                    type="monotone"
                    dataKey={nageur}
                    stroke={`hsl(${(idx * 60) % 360}, 70%, 50%)`}
                    connectNulls
                    dot
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
  </div>
)}

      {/* === Aucun résultat === */}
      {stats &&
        !stats.presences?.length &&
        Object.keys(stats.performances || {}).length === 0 && (
          <p className="text-center text-muted mt-4">Aucune donnée trouvée sur cette période.</p>
        )}
    </div>
  );
}
