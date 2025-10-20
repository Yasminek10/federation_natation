import React, { useState, useEffect } from "react";
import { Button, Form, Spinner, Alert } from "react-bootstrap";

export default function BilanCoach() {
  const [champs, setChamps] = useState([]);
  const [cats, setCats] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [champPublicId, setChampPublicId] = useState("");
  const [catPublicId, setCatPublicId] = useState("");
  const [clubPublicId, setClubPublicId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Charger championnats et clubs
  useEffect(() => {
    const loadData = async () => {
      try {
        const [chRes, clRes] = await Promise.all([
          fetch("http://localhost:5000/api/bilan/options", { credentials: "include" }),
          fetch("http://localhost:5000/api/bilan/clubs", { credentials: "include" }),
        ]);
        const chData = await chRes.json();
        const clData = await clRes.json();
        setChamps(chData.championnats || []);
        setClubs(clData.clubs || []);
      } catch (err) {
        setError("Erreur de chargement des données.");
      }
    };
    loadData();
  }, []);

  const handleChampChange = async (id) => {
    setChampPublicId(id);
    setCats([]);
    setCatPublicId("");
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(
        `http://localhost:5000/api/bilan/categories?champ_id=${encodeURIComponent(id)}`,
        { credentials: "include" }
      );
      const d = await r.json();
      setCats(d.categories || []);
    } catch {
      setError("Erreur de chargement des catégories.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!champPublicId || !catPublicId || !clubPublicId) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    const q = new URLSearchParams({
      champ_id: champPublicId,
      categorie_id: catPublicId,
      club_id: clubPublicId,
    });
    window.open(`http://localhost:5000/api/bilan/generate?${q}`, "_blank");
  };

  return (
    <div className="p-3">
      <h4>Bilan du Coach</h4>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form className="d-grid gap-3">
        <Form.Group>
          <Form.Label>Championnat</Form.Label>
          <Form.Select
            value={champPublicId}
            onChange={(e) => handleChampChange(e.target.value)}
          >
            <option value="">— choisir —</option>
            {champs.map((c) => (
              <option key={c.public_id} value={c.public_id}>
                {c.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group>
          <Form.Label>Catégorie</Form.Label>
          <Form.Select
            value={catPublicId}
            onChange={(e) => setCatPublicId(e.target.value)}
            disabled={!champPublicId || loading}
          >
            <option value="">— choisir —</option>
            {cats.map((c) => (
              <option key={c.public_id} value={c.public_id}>
                {c.nom}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group>
          <Form.Label>Club</Form.Label>
          <Form.Select
            value={clubPublicId}
            onChange={(e) => setClubPublicId(e.target.value)}
          >
            <option value="">— choisir —</option>
            {clubs.map((c) => (
              <option key={c.public_id} value={c.public_id}>
                {c.nom}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Button
          onClick={handleDownload}
          disabled={loading || !champPublicId || !catPublicId || !clubPublicId}
        >
          {loading ? <Spinner size="sm" /> : "Télécharger le Bilan PDF"}
        </Button>
      </Form>
    </div>
  );
}
