import React, { useEffect, useState } from "react";
import EditMinimaModal from "../components/EditMinimaModal";
import { Modal, Button, Accordion } from "react-bootstrap";
import Navbar from "../components/Navbar"; // ✅ Import Navbar
import "../styles/adminDashboard.css";

export default function Minimas() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedCategorie, setSelectedCategorie] = useState("Tous");
  const [selectedGenre, setSelectedGenre] = useState("Tous");

  const [showModal, setShowModal] = useState(false);
  const [selectedMinima, setSelectedMinima] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // --- Handle Edit
  const handleEditClick = (minima) => {
    setSelectedMinima({
      min_id: minima.min_id,
      epreuve: minima.epreuve,
      temps: minima.temps,
      categorie: minima.categorie,
    });
    setShowModal(true);
  };

  // --- Save changes
  const handleSave = async (updatedMinima) => {
    const ok = window.confirm(
      `Confirmer la modification de ${updatedMinima.epreuve} à ${updatedMinima.temps} ?`
    );
    if (!ok) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/minimas/${updatedMinima.min_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temps: updatedMinima.temps }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");

      setData((prev) =>
        prev.map((m) =>
          m.min_id === updatedMinima.min_id ? { ...m, temps: data.temp_min } : m
        )
      );
      setShowModal(false);
      setShowSuccess(true);
    } catch (err) {
      alert("Erreur : " + err.message);
    }
  };

  // --- Load user
  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setUser(savedUser);
  }, []);

  // --- Load minimas
  useEffect(() => {
    fetch("http://localhost:5000/api/minimas/")
      .then((res) => res.json())
      .then((json) => {
        const mapped = json.map((item) => ({
          min_id: item.min_id,
          categorie: item.categorie,
          epreuve: item.epreuve,
          temps: item.temp_min || item.tps_min,
        }));
        setData(mapped);
      })
      .catch((err) => console.error(err));
  }, []);

  // --- Filtres
  const categories = ["Tous", ...new Set(data.map((item) => item.categorie))];
  const genres = [
    "Tous",
    ...new Set(
      data.map((item) => {
        const parts = item.epreuve.split("_");
        return parts[parts.length - 2];
      })
    ),
  ];

  useEffect(() => {
    let temp = [...data];
    if (selectedCategorie !== "Tous") {
      temp = temp.filter((item) => item.categorie === selectedCategorie);
    }
    if (selectedGenre !== "Tous") {
      temp = temp.filter((item) => {
        const parts = item.epreuve.split("_");
        const genre = parts[parts.length - 2];
        return genre === selectedGenre;
      });
    }
    setFilteredData(temp);
  }, [data, selectedCategorie, selectedGenre]);

  // --- Group data by catégorie
  const grouped = filteredData.reduce((acc, item) => {
    acc[item.categorie] = acc[item.categorie] || [];
    acc[item.categorie].push(item);
    return acc;
  }, {});

  return (
    <div>
      <Navbar user={user} />

      <div className="container p-4" style={{ marginTop: "100px" }}>
        {/* --- Barre de filtres --- */}
        <div className="d-flex gap-3 mb-4 flex-wrap">
          <select
            className="form-select w-auto"
            value={selectedCategorie}
            onChange={(e) => setSelectedCategorie(e.target.value)}
          >
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className="form-select w-auto"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            {genres.map((g, idx) => (
              <option key={idx} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Accordéon par catégorie */}
        <Accordion alwaysOpen>
          {Object.keys(grouped).map((categorie, idx) => (
            <Accordion.Item eventKey={String(idx)} key={idx}>
              <Accordion.Header>{categorie}</Accordion.Header>
              <Accordion.Body>
                <div className="table-responsive">
                  <table className="table swim-table">
                    <thead>
                      <tr>
                        <th>Epreuve</th>
                        <th>Minima</th>
                        {user?.role === "admin" && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[categorie].map((row) => (
                        <tr key={row.min_id}>
                          <td>{row.epreuve}</td>
                          <td>{row.temps || "-"}</td>
                          {user?.role === "admin" && (
                            <td>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleEditClick(row)}
                              >
                                Modifier
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>

        {/* Modal Edit */}
        <EditMinimaModal
          show={showModal}
          handleClose={() => setShowModal(false)}
          minima={selectedMinima}
          onSave={handleSave}
        />

        {/* Modal Succès */}
        <Modal show={showSuccess} onHide={() => setShowSuccess(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Succès</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            ✅ La modification a été enregistrée avec succès !
          </Modal.Body>
          <Modal.Footer>
            <Button variant="success" onClick={() => setShowSuccess(false)}>
              OK
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
}
