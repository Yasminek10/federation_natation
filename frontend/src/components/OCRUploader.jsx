import React, { useState, useEffect } from "react";
import { Table, Button, Form, Spinner, Alert } from "react-bootstrap";
import { FaPlus } from "react-icons/fa";
import Navbar from "../components/Navbar";
import SearchableDropdown from "../components/SearchableDropdown";

export default function OCRUploader({ user }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [validated, setValidated] = useState(false);
  const [appendMode, setAppendMode] = useState(false);
  const [showFileInput, setShowFileInput] = useState(true);

  const [epreuve, setEpreuve] = useState("Choisir épreuve");
  const [championnat, setChampionnat] = useState("Choisir championnat");
  const [epreuvesList, setEpreuvesList] = useState([]);
  const [championnatsList, setChampionnatsList] = useState([]);

  // Valeur fixe pour genre
  const genre = "Dames"; // ou "Messieurs" selon ton besoin

  // --- Fetch epreuves et championnats ---
  useEffect(() => {
    fetch("http://localhost:5000/api/epreuves")
      .then((res) => res.json())
      .then((data) => setEpreuvesList(data))
      .catch(() => setEpreuvesList([]));

    fetch("http://localhost:5000/api/championnats")
      .then((res) => res.json())
      .then((data) => setChampionnatsList(data))
      .catch(() => setChampionnatsList([]));
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setError("");
    setValidated(false);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("epreuve", epreuve);
      formData.append("genre", genre); // valeur fixe
      formData.append("championnat", championnat);

      const res = await fetch("http://localhost:5000/api/ocr/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Erreur serveur");
      }

      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map((r) => ({
            club: String(r.club ?? ""),
            nationalite: String(r.nationalite ?? "TUN"),
            points: Number.isFinite(Number(r.points)) ? Number(r.points) : 0,
          }))
        : [];

      if (appendMode) {
        setRows((prevRows) => [...prevRows, ...normalized]);
      } else {
        setRows(normalized);
      }

      setShowFileInput(false); // masquer le champ après analyse
      setFile(null);
    } catch (e) {
      setError(e.message || "Échec de l'analyse");
    } finally {
      setUploading(false);
    }
  };

  const handleAddAnotherImage = () => {
    const append = window.confirm(
      "Voulez-vous ajouter cette image aux données existantes ? Cliquez OK pour ajouter, Annuler pour remplacer."
    );
    setAppendMode(append);
    setShowFileInput(true);
    setValidated(false);
    setError("");
    setFile(null);
  };

  const addRowAfter = (index) => {
    const newRows = [...rows];
    newRows.splice(index + 1, 0, {
      club: "Nouveau Club",
      nationalite: "TUN",
      points: 0,
    });
    setRows(newRows);
  };

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    if (field === "points") {
      newRows[index].points = Number.isFinite(Number(value)) ? Number(value) : 0;
    } else {
      newRows[index][field] = value;
    }
    setRows(newRows);
  };

  const handleValidate = () => {
    setValidated(true);
    console.log("Données validées :", rows);
  };

  return (
    <div className="container p-4" style={{ maxWidth: 1000 }}>
      <Navbar user={user} />
      <h3 className="mb-3 text-dark fw-bold">Résultats OCR Natation</h3>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <SearchableDropdown
          title={epreuve}
          items={epreuvesList}
          onSelect={(e) =>
            setEpreuve(
              e.legs_count
                ? `${e.legs_count}*${e.distance / e.legs_count}M ${e.nage} ${e.genre}`
                : `${e.distance}M ${e.nage} ${e.genre}`
            )
          }
          formatItem={(e) =>
            e.legs_count
              ? `${e.legs_count}*${e.distance / e.legs_count}M ${e.nage} ${e.genre}`
              : `${e.distance}M ${e.nage} ${e.genre}`
          }
        />

        <SearchableDropdown
          title={championnat}
          items={championnatsList}
          onSelect={(c) => setChampionnat(c.nom)}
          formatItem={(c) => `${c.nom} (${c.saison})`}
        />

        {showFileInput && (
          <>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ maxWidth: 300 }}
            />
            <Button
              variant="primary"
              onClick={handleAnalyze}
              disabled={!file || uploading || epreuve.includes("Choisir")}
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

      {rows.length > 0 && !validated && (
        <Button className="mb-3" onClick={handleValidate} variant="success">
          Valider les modifications
        </Button>
      )}

      {validated && (
        <Alert variant="success" className="mb-3">
          Données validées ! Vous pouvez uploader une nouvelle image.
        </Alert>
      )}

      {rows.length > 0 && (
        <Table bordered hover responsive className="mt-3 text-center align-middle">
          <thead style={{ backgroundColor: "#2c3e50", color: "white" }}>
            <tr>
              <th style={{ width: 70 }}>Rang</th>
              <th>Club</th>
              <th style={{ width: 120 }}>Nationalité</th>
              <th style={{ width: 120 }}>Points</th>
              <th style={{ width: 70 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="fw-bold">{index + 1}</td>
                <td>
                  <Form.Control
                    type="text"
                    value={row.club}
                    onChange={(e) => updateRow(index, "club", e.target.value)}
                    className="text-center"
                  />
                </td>
                <td>
                  <Form.Control
                    type="text"
                    value={row.nationalite}
                    onChange={(e) => updateRow(index, "nationalite", e.target.value)}
                    className="text-center"
                  />
                </td>
                <td>
                  <Form.Control
                    type="number"
                    value={row.points}
                    onChange={(e) => updateRow(index, "points", e.target.value)}
                    className="text-center"
                  />
                </td>
                <td>
                  <Button variant="success" size="sm" onClick={() => addRowAfter(index)}>
                    <FaPlus />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
