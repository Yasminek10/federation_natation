import React, { useEffect, useState } from "react";
import { Form, Table, Button, Spinner, Alert } from "react-bootstrap";

export default function CoachSwimmers() {
  const [clubs, setClubs] = useState([]);
  const [selectedClub, setSelectedClub] = useState("");
  const [nageurs, setNageurs] = useState([]);
  const [selectedNageurs, setSelectedNageurs] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategorie, setSelectedCategorie] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ======================================================
  // 🔹 Fonction principale : chargement des nageurs
  // ======================================================
  const fetchNageurs = async (clubId, categorieId = "", search = "") => {
    if (!clubId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/coach/clubs/${clubId}/nageurs_filtres?` +
          new URLSearchParams({
            categorie_id: categorieId,
            search: search,
          })
      );
      const data = await res.json();
      const newNageurs = data.nageurs || [];

      setNageurs(newNageurs);

      //  Conserver la sélection précédente
      setSelectedNageurs((prev) => {
        const updated = new Set(prev);
        newNageurs
          .filter((n) => n.selected)
          .forEach((n) => updated.add(n.id_nageur));
        return updated;
      });
    } catch (err) {
      console.error("Erreur chargement nageurs", err);
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // 🔹 useEffect : chargement initial
  // ======================================================
  useEffect(() => {
    // Charger les clubs
    fetch(`http://localhost:5000/api/coach/clubs`)
      .then((res) => res.json())
      .then((data) => setClubs(data.clubs || []))
      .catch(() => setClubs([]));

    // Charger les catégories
    fetch("http://localhost:5000/api/coach/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]));

    // Charger les nageurs du coach
    fetch("http://localhost:5000/api/coach/nageurs/mine", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.nageurs && data.nageurs.length > 0) {
          setSelectedClub(data.club_id);
          setNageurs(data.nageurs);
          setSelectedNageurs(
            new Set(
              data.nageurs.filter((n) => n.selected).map((n) => n.id_nageur)
            )
          );
        }
      })
      .catch((err) => console.error("Erreur chargement nageurs du coach", err));
  }, []);

  // ======================================================
  // 🔹 Handlers
  // ======================================================
  const handleClubChange = async (e) => {
    const clubId = e.target.value;
    setSelectedClub(clubId);
    setSelectedCategorie("");
    setSearchTerm("");
    await fetchNageurs(clubId);
  };

  const handleCategorieChange = async (e) => {
    const catId = e.target.value;
    setSelectedCategorie(catId);
    await fetchNageurs(selectedClub, catId, searchTerm);
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      fetchNageurs(selectedClub, selectedCategorie, term);
    }, 300);
  };

  const toggleNageur = (id) => {
    const newSet = new Set(selectedNageurs);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedNageurs(newSet);
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`http://localhost:5000/api/coach/nageurs/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nageur_ids: Array.from(selectedNageurs) }),
      });
      const data = await res.json();
      setMessage(data.message || "Changements enregistrés.");
    } catch {
      setMessage("Erreur lors de la sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // 🔹 Rendu JSX
  // ======================================================
  return (
    <div className="container py-4">
      <h3 className="mb-4">Mes Nageurs</h3>
      {message && <Alert className="mt-3">{message}</Alert>}
      {/* Sélection du club */}
      <Form.Group className="mb-3">
        <Form.Label>Choisir un club :</Form.Label>
        <Form.Select value={selectedClub} onChange={handleClubChange}>
          <option value="">-- Sélectionner un club --</option>
          {clubs.map((c) => (
            <option key={c.id_club} value={c.id_club}>
              {c.nom}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {/* Filtres + bouton sauvegarder */}
      {selectedClub && (
        <div className="d-flex flex-wrap align-items-end justify-content-between mb-4 gap-3">
          <div className="d-flex flex-wrap gap-3">
            <div>
              <Form.Label>Catégorie :</Form.Label>
              <Form.Select
                value={selectedCategorie}
                onChange={handleCategorieChange}
              >
                <option value="">Toutes</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nom}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div>
              <Form.Label>Recherche :</Form.Label>
              <Form.Control
                type="text"
                placeholder="Nom ou prénom..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          <div>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={loading}
              style={{ marginTop: "8px" }}
            >
              {loading ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </div>
        </div>
      )}

      {/* Table des nageurs */}
      {loading ? (
        <Spinner animation="border" />
      ) : nageurs.length > 0 ? (
        <>
          <Table bordered hover responsive>
            <thead className="table-light">
              <tr>
                <th style={{ width: "50px" }}>
                  <Form.Check
                    type="checkbox"
                    checked={
                      nageurs.length > 0 &&
                      selectedNageurs.size === nageurs.length
                    }
                    onChange={() => {
                      if (selectedNageurs.size === nageurs.length) {
                        setSelectedNageurs(new Set());
                      } else {
                        setSelectedNageurs(
                          new Set(nageurs.map((n) => n.id_nageur))
                        );
                      }
                    }}
                  />
                </th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Année</th>
                <th>Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {nageurs.map((n) => (
                <tr key={n.id_nageur}>
                  <td>
                    <Form.Check
                      type="checkbox"
                      checked={selectedNageurs.has(n.id_nageur)}
                      onChange={() => toggleNageur(n.id_nageur)}
                    />
                  </td>
                  <td>{n.nom}</td>
                  <td>{n.prenom}</td>
                  <td>{n.birth_year}</td>
                  <td>{n.categorie || "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        selectedClub && <Alert variant="info">Aucun nageur trouvé.</Alert>
      )}

      
    </div>
  );
}
