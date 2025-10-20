import React, { useState, useEffect } from "react";
import { Button, Form, Spinner, Alert } from "react-bootstrap";

export default function BilanCoach() {
  const [champs, setChamps] = useState([]);
  const [cats, setCats] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [champId, setChampId] = useState("");
  const [catId, setCatId] = useState("");
  const [clubId, setClubId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nageurs, setNageurs] = useState([]);
  const [selectedNageurs, setSelectedNageurs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");


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
    setChampId(id);
    setCats([]);
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`http://localhost:5000/api/bilan/categories?champ_id=${id}`, { credentials: "include" });
      const d = await r.json();
      setCats(d.categories || []);
    } catch {
      setError("Erreur de chargement des catégories.");
    } finally {
      setLoading(false);
    }
  };

  const loadNageurs = async (champ, cat, club) => {
  if (!champ || !cat || !club) {
    setNageurs([]);
    setSelectedNageurs([]);
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(
      `http://localhost:5000/api/bilan/nageurs_participants?champ_id=${champ}&categorie_id=${cat}&club_id=${club}`,
      { credentials: "include" }
    );
    const data = await res.json();
    const nageursList = data.nageurs || [];
    setNageurs(nageursList);
    setSelectedNageurs(nageursList.map((n) => n.id_nageur)); // par défaut tous cochés
  } catch (err) {
    console.error(err);
    setError("Erreur de chargement des nageurs participants.");
  } finally {
    setLoading(false);
  }
};

  const handleDownload = () => {
  if (!champId || !catId || !clubId) {
    setError("Veuillez remplir tous les champs.");
    return;
  }

  if (selectedNageurs.length === 0) {
    setError("Veuillez sélectionner au moins un nageur.");
    return;
  }

  const q = new URLSearchParams({
    champ_id: champId,
    categorie_id: catId,
    club_id: clubId,
    nageurs: JSON.stringify(selectedNageurs),
  });

  window.open(`http://localhost:5000/api/bilan/generate?${q}`, "_blank");
};

  const filteredNageurs = nageurs.filter((n) =>
  `${n.prenom} ${n.nom}`.toLowerCase().includes(searchTerm.toLowerCase())
);

  return (
    <div className="p-3">
      <h4>Bilan du Coach</h4>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form className="d-grid gap-3">
        <Form.Group>
          <Form.Label>Championnat</Form.Label>
          <Form.Select value={champId} onChange={(e) => handleChampChange(e.target.value)}>
            <option value="">— choisir —</option>
            {champs.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group>
  <Form.Label>Catégorie</Form.Label>
  <Form.Select
    value={catId}
    onChange={(e) => {
      const val = e.target.value;
      setCatId(val);
      if (champId && clubId) loadNageurs(champId, val, clubId);
    }}
    disabled={!champId || loading}
  >
    <option value="">— choisir —</option>
    {cats.map((c) => (
      <option key={c.id} value={c.id}>
        {c.nom}
      </option>
    ))}
  </Form.Select>
</Form.Group>

        <Form.Group>
  <Form.Label>Club</Form.Label>
  <Form.Select
    value={clubId}
    onChange={(e) => {
      const val = e.target.value;
      setClubId(val);
      if (champId && catId) loadNageurs(champId, catId, val); // ✅ utilise 'val' et pas 'clubId'
    }}
  >
    <option value="">— choisir —</option>
    {clubs.map((c) => (
      <option key={c.id} value={c.id}>
        {c.nom}
      </option>
    ))}
  </Form.Select>
</Form.Group>

        {nageurs.length > 0 && (
  <div className="border rounded p-3 mt-3">
    <h6>🏊‍♂️ Nageurs participants ({nageurs.length})</h6>

    <Form.Control
      type="text"
      placeholder="🔍 Rechercher un nageur..."
      className="mb-3"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />

    {filteredNageurs.length > 0 ? (
      filteredNageurs.map((n) => (
        <Form.Check
          key={n.id_nageur}
          type="checkbox"
          id={`nageur-${n.id_nageur}`}
          label={`${n.prenom} ${n.nom}`}
          checked={selectedNageurs.includes(n.id_nageur)}
          onChange={(e) => {
            const checked = e.target.checked;
            setSelectedNageurs((prev) =>
              checked
                ? [...prev, n.id_nageur]
                : prev.filter((id) => id !== n.id_nageur)
            );
          }}
        />
      ))
    ) : (
      <p className="text-muted">Aucun nageur ne correspond à la recherche.</p>
    )}
  </div>
)}

        <Button onClick={handleDownload} disabled={loading || !champId || !catId || !clubId}>
          {loading ? <Spinner size="sm" /> : "Télécharger le Bilan PDF"}
        </Button>
      </Form>
    </div>
  );
}
