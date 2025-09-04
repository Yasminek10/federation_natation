import React, { useState, useEffect, useRef } from "react";
import { Table, Button, Form, Spinner, Alert } from "react-bootstrap";
import { FaPlus } from "react-icons/fa";
import SearchableDropdown from "../components/SearchableDropdown";

/**
 * Upload + prévisualisation OCR
 * - POST /api/ocrx/analyze  (file + epreuve_id + categorie_id)
 * - POST /api/ocrx/recalc   (rows + epreuve_id + categorie_id)
 * - Tableau éditable + cumul par club en live
 */

const analyzeEndpoint = "http://localhost:5000/api/ocrx/analyze";
const recalcEndpoint  = "http://localhost:5000/api/ocrx/recalc";

// helper pour lire un ID quelle que soit la clé
const pickId = (obj, keys) => {
  if (!obj) return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      const n = Number(obj[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};

export default function OCRUploader() {
  // --------- États principaux ----------
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [clubTotals, setClubTotals] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showFileInput, setShowFileInput] = useState(true);

  // --------- Listes & sélections ----------
  const [epreuvesList, setEpreuvesList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  const [selectedEpreuve, setSelectedEpreuve] = useState(null);
  const [selectedCategorie, setSelectedCategorie] = useState(null);

  // IDs normalisés
  const selectedEpreuveId   = pickId(selectedEpreuve,  ["id", "epreuve_id", "epreuveId"]);
  const selectedCategorieId = pickId(selectedCategorie, ["id", "categorie_id", "categorieId"]);

  // Labels d’affichage
  const epreuveLabel = selectedEpreuve
    ? ((selectedEpreuve.legs_count === 4 || selectedEpreuve.legs_count === 10)
        ? `${selectedEpreuve.legs_count}_x_${selectedEpreuve.distance}M ${selectedEpreuve.nage} ${selectedEpreuve.genre}`
        : `${selectedEpreuve.distance}M ${selectedEpreuve.nage} ${selectedEpreuve.genre}`)
    : "Choisir épreuve";

  const categorieLabel = selectedCategorie ? selectedCategorie.nom : "Choisir une catégorie";

  // --------- Debounce pour /recalc ----------
  const recalcTimer = useRef(null);
  const DEBOUNCE_MS = 300;

  // --------- Initial fetch ----------
  useEffect(() => {
    fetch("http://localhost:5000/api/epreuves")
      .then((r) => r.json())
      .then(setEpreuvesList)
      .catch(() => setEpreuvesList([]));

    fetch("http://localhost:5000/api/categories")
      .then((r) => r.json())
      .then(setCategoriesList)
      .catch(() => setCategoriesList([]));
  }, []);

  // --------- Handlers upload / analyse ----------
  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setError("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (!selectedEpreuveId || !selectedCategorieId) {
      setError("Veuillez choisir l'épreuve et la catégorie.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("epreuve_id", String(selectedEpreuveId));
      formData.append("categorie_id", String(selectedCategorieId));

      const res = await fetch(analyzeEndpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());

      const { rows: rws, club_totals } = await res.json();
      const finalRows = Array.isArray(rws) ? rws : [];

      // ⬇️ Toujours remplacer le tableau (pas de concaténation)
      setRows(finalRows);
      setClubTotals(club_totals || []);
      setShowFileInput(false);
      setFile(null);
    } catch (e) {
      setError(e.message || "Échec de l'analyse");
    } finally {
      setUploading(false);
    }
  };

  const handleAddAnotherImage = () => {
    // ⬇️ Pas de confirm, on réaffiche juste l’input pour une nouvelle photo
    setShowFileInput(true);
    setError("");
    setFile(null);
  };

  // --------- Recalcul serveur après édition ----------
  const recalc = async (rowsDraft) => {
    if (!selectedEpreuveId || !selectedCategorieId) return;
    try {
      const res = await fetch(recalcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsDraft,
          epreuve_id: selectedEpreuveId,
          categorie_id: selectedCategorieId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { rows: rws, club_totals } = await res.json();
      setRows(rws || []);
      setClubTotals(club_totals || []);
    } catch (e) {
      setError(e.message || "Recalcul échoué");
    }
  };

  const updateRow = (index, field, value) => {
    const draft = [...rows];
    draft[index] = {
      ...draft[index],
      [field]: field === "nationalite" ? String(value).toUpperCase() : value,
    };
    if (field === "points") {
      draft[index].points = Number.isFinite(Number(value)) ? Number(value) : 0;
    }
    setRows(draft);

    if (recalcTimer.current) clearTimeout(recalcTimer.current);
    recalcTimer.current = setTimeout(() => recalc(draft), DEBOUNCE_MS);
  };

  const addRowAfter = (idx) => {
    const draft = [...rows];
    draft.splice(idx + 1, 0, {
      place: (draft[idx]?.place || 0) + 1,
      nom: "",
      prenom: "",
      club_name: "ACADEMIE DE NATATION",
      nationalite: "TUN",
      temps: "",
      points: 0,
      matched_nageur_id: null,
      match_score: 0,
      eligible_points: true,
      non_tunisien: false,
      found_in_db: false,
    });
    setRows(draft);
    if (recalcTimer.current) clearTimeout(recalcTimer.current);
    recalcTimer.current = setTimeout(() => recalc(draft), DEBOUNCE_MS);
  };

  const analyzeDisabled =
    !file || uploading || !selectedEpreuveId || !selectedCategorieId;

  // --------- Rendu ----------
  return (
    <div className="container p-4" style={{ maxWidth: 1100 }}>
      <h3 className="mb-3 text-dark fw-bold">Résultats OCR Natation</h3>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <SearchableDropdown
          title={categorieLabel}
          items={categoriesList}
          onSelect={(c) => setSelectedCategorie(c)}
          formatItem={(c) => c.nom}
        />

        <SearchableDropdown
          title={epreuveLabel}
          items={epreuvesList}
          onSelect={(e) => setSelectedEpreuve(e)}
          formatItem={(e) =>
            (e.legs_count === 4 || e.legs_count === 10)
              ? `${e.legs_count}_x_${e.distance}M ${e.nage} ${e.genre}`
              : `${e.distance}M ${e.nage} ${e.genre}`
          }
        />

        {showFileInput && (
          <>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ maxWidth: 320 }}
            />
            <Button
              variant="primary"
              onClick={handleAnalyze}
              disabled={analyzeDisabled}
            >
              {uploading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Analyse en cours…
                </>
              ) : (
                "Analyser"
              )}
            </Button>
          </>
        )}

        {!showFileInput && (
          <Button variant="secondary" onClick={handleAddAnotherImage}>
            Ajouter une autre image
          </Button>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {rows.length > 0 && (
        <>
          <Table bordered hover responsive className="mt-3 text-center align-middle">
            <thead style={{ backgroundColor: "#2c3e50", color: "white" }}>
              <tr>
                <th style={{ width: 70 }}>Rang</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Club</th>
                <th style={{ width: 90 }}>Nat.</th>
                <th style={{ width: 120 }}>Temps</th>
                <th style={{ width: 110 }}>Points</th>
                <th style={{ width: 80 }}>Match</th>
                <th style={{ width: 80 }}>Elig.</th>
                <th style={{ width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r?.non_tunisien ? "table-warning" : ""}>
                  <td className="fw-bold">{r.place ?? i + 1}</td>

                  <td>
                    <Form.Control
                      value={r.nom || ""}
                      onChange={(e) => updateRow(i, "nom", e.target.value)}
                    />
                  </td>

                  <td>
                    <Form.Control
                      value={r.prenom || ""}
                      onChange={(e) => updateRow(i, "prenom", e.target.value)}
                    />
                  </td>

                  <td>
                    <Form.Control
                      value={r.club_name || ""}
                      onChange={(e) => updateRow(i, "club_name", e.target.value)}
                    />
                  </td>

                  <td>
                    <Form.Control
                      value={r.nationalite || "TUN"}
                      onChange={(e) => updateRow(i, "nationalite", e.target.value)}
                    />
                  </td>

                  <td>
                    <Form.Control
                      value={r.temps || ""}
                      onChange={(e) => updateRow(i, "temps", e.target.value)}
                    />
                  </td>

                  <td>
                    <Form.Control
                      type="number"
                      value={Number.isFinite(Number(r.points)) ? Number(r.points) : 0}
                      onChange={(e) => updateRow(i, "points", e.target.value)}
                    />
                  </td>

                  <td className={r?.found_in_db ? "text-success" : "text-danger"}>
                    {r?.match_score ?? 0}%
                  </td>

                  <td>{r?.eligible_points ? "Oui" : "Non"}</td>

                  <td>
                    <Button variant="success" size="sm" onClick={() => addRowAfter(i)}>
                      <FaPlus />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {clubTotals.length > 0 && (
            <div className="mt-3">
              <h5>Cumul par club (éligibles)</h5>
              <Table bordered size="sm" className="text-center">
                <thead>
                  <tr>
                    <th>Club</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {clubTotals.map((c, idx) => (
                    <tr key={idx}>
                      <td>{c.club_name}</td>
                      <td className="fw-bold">{c.points}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
