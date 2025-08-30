import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import EditMinimaModal from "../components/EditMinimaModal";
import { Modal, Button, Alert } from "react-bootstrap";


export default function Minimas() {
  // --- State utilisateur ---
  const [user, setUser] = useState(null);

  // --- State pour les données ---
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedCategorie, setSelectedCategorie] = useState("Tous");
  const [selectedGenre, setSelectedGenre] = useState("Tous");

  // --- Modal pour modification ---
  const [showModal, setShowModal] = useState(false);
  const [selectedMinima, setSelectedMinima] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  // --- Ouvrir le modal ---
  const handleEditClick = (minima) => {
    setSelectedMinima({
      min_id: minima.min_id, // maintenant il est bien défini
      epreuve: minima.epreuve,
      temps: minima.temps,
      categorie: minima.categorie,
    });
    console.log(minima);
    setShowModal(true);
  };

  // --- Sauvegarde depuis le modal ---
  const handleSave = async (updatedMinima) => {
    // demander confirmation avant envoi
    const ok = window.confirm(
      `Confirmer la modification de ${updatedMinima.epreuve} à ${updatedMinima.temps} ?`
    );
    if (!ok) return; // si "Annuler", on sort

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

      // Mise à jour du state local
      setData((prev) =>
        prev.map((m) =>
          m.min_id === updatedMinima.min_id ? { ...m, temps: data.temp_min } : m
        )
      );
      setShowModal(false);
      setShowSuccess(true); // ✅ afficher modal succès
    } catch (err) {
      alert("Erreur : " + err.message);
    }
  };

  // --- Récupération du user depuis localStorage ---
  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setUser(savedUser);
    console.log("Contenu de user :", savedUser);
  }, []);

  // --- Fetch des données depuis l'API Flask ---
  useEffect(() => {
    fetch("http://localhost:5000/api/minimas/")
      .then((res) => res.json())
      .then((json) => {
        const mapped = json.map((item, index) => ({
          min_id: item.min_id,
          categorie: item.categorie,
          epreuve: item.epreuve,
          temps: item.temp_min || item.tps_min,
        }));
        setData(mapped);
      })
      .catch((err) => console.error(err));
  }, []);

  // --- Extraire catégories et genres uniques ---
  const categories = ["Tous", ...new Set(data.map((item) => item.categorie))];
  const genres = [
    "Tous",
    ...new Set(
      data.map((item) => {
        const parts = item.epreuve.split("_");
        return parts[parts.length - 2]; // récupère le genre avant "_Classement"
      })
    ),
  ];

  // --- Appliquer filtres ---
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

  // --- Grouper par catégorie pour affichage ---
  const grouped = filteredData.reduce((acc, item) => {
    acc[item.categorie] = acc[item.categorie] || [];
    acc[item.categorie].push(item); // déjà normalisé avec id et temps
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

        {/* --- Tableau des minimas --- */}
        {Object.keys(grouped).map((categorie) => (
          <div key={categorie} className="mb-5">
            <h3 className="mb-3">{categorie}</h3>
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
              className="btn btn-sm btn-primary edit-btn"
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
          </div>
        ))}

        {/* ✅ Modal séparé */}
        <EditMinimaModal
          show={showModal}
          handleClose={() => setShowModal(false)}
          minima={selectedMinima}
          onSave={handleSave}
        />
        {/* ✅ Modal de succès */}
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
