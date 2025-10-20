//list des nageurs avec recherche, filtre, pagination
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Form, Pagination } from "react-bootstrap";
import axios from "axios";
import Navbar_Home from "./Navbar_Home";
export default function TousNageurs({ user }) {
  const [nageurs, setNageurs] = useState([]);
  const [filteredNageurs, setFilteredNageurs] = useState([]);
  const navigate = useNavigate();

  // Filtres
  const [searchName, setSearchName] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedClub, setSelectedClub] = useState("");
  const [selectedNationalite, setSelectedNationalite] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [nageursPerPage] = useState(12);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/nageurs/")
      .then((res) => {
        setNageurs(res.data);
        setFilteredNageurs(res.data);
      })
      .catch((err) => console.error(err));
  }, []);

  // Options uniques
  const categories = [...new Set(nageurs.map((n) => n.categorie))];
  const genres = [...new Set(nageurs.map((n) => n.genre))];
  const clubs = [...new Set(nageurs.map((n) => n.club_nom).filter(Boolean))];
  const nationalites = [
    ...new Set(nageurs.map((n) => n.nationalite).filter(Boolean)),
  ];

  // Filtrage
  useEffect(() => {
    let filtered = nageurs;

    if (searchName) {
      filtered = filtered.filter((n) =>
        `${n.prenom} ${n.nom}`.toLowerCase().includes(searchName.toLowerCase())
      );
    }
    if (selectedCategorie) {
      filtered = filtered.filter((n) => n.categorie === selectedCategorie);
    }
    if (selectedGenre) {
      filtered = filtered.filter((n) => n.genre === selectedGenre);
    }
    if (selectedClub) {
      filtered = filtered.filter((n) => n.club_nom === selectedClub);
    }
    if (selectedNationalite) {
      filtered = filtered.filter((n) => n.nationalite === selectedNationalite);
    }

    setFilteredNageurs(filtered);
    setCurrentPage(1);
  }, [
    searchName,
    selectedCategorie,
    selectedGenre,
    selectedClub,
    selectedNationalite,
    nageurs,
  ]);

  // Pagination
  const indexOfLast = currentPage * nageursPerPage;
  const indexOfFirst = indexOfLast - nageursPerPage;
  const currentNageurs = filteredNageurs.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredNageurs.length / nageursPerPage);

  const renderPagination = () => {
    let items = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <Pagination.Item
            key={i}
            active={i === currentPage}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </Pagination.Item>
        );
      }
    } else {
      const startPage = Math.max(2, currentPage - 2);
      const endPage = Math.min(totalPages - 1, currentPage + 2);

      items.push(
        <Pagination.Item
          key={1}
          active={currentPage === 1}
          onClick={() => setCurrentPage(1)}
        >
          1
        </Pagination.Item>
      );

      if (startPage > 2)
        items.push(<Pagination.Ellipsis key="start" disabled />);

      for (let i = startPage; i <= endPage; i++) {
        items.push(
          <Pagination.Item
            key={i}
            active={i === currentPage}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </Pagination.Item>
        );
      }

      if (endPage < totalPages - 1)
        items.push(<Pagination.Ellipsis key="end" disabled />);

      items.push(
        <Pagination.Item
          key={totalPages}
          active={currentPage === totalPages}
          onClick={() => setCurrentPage(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    return (
      <Pagination className="justify-content-center mt-3">
        <Pagination.First
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        />
        <Pagination.Prev
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
        />
        {items}
        <Pagination.Next
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
        />
        <Pagination.Last
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        />
      </Pagination>
    );
  };

  return (
    <div>
      <Navbar_Home user={user} />
      <Container
        className="container p-4"
        style={{ maxWidth: 1000, marginTop: "10px" }}
      >
        {/* 🔹 Barre de filtres horizontale */}
        <Card className="shadow-sm border-0 rounded-4 p-3 mb-4">
          <Row className="g-3 align-items-end">
            <Col md={3}>
              <Form.Label>Nom</Form.Label>
              <Form.Control
                type="text"
                placeholder="Rechercher..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Club</Form.Label>
              <Form.Select
                value={selectedClub}
                onChange={(e) => setSelectedClub(e.target.value)}
              >
                <option value="">Tous</option>
                {clubs.map((c, i) => (
                  <option key={i}>{c}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label>Catégorie</Form.Label>
              <Form.Select
                value={selectedCategorie}
                onChange={(e) => setSelectedCategorie(e.target.value)}
              >
                <option value="">Toutes</option>
                {categories.map((cat, i) => (
                  <option key={i}>{cat}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label>Genre</Form.Label>
              <Form.Select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                <option value="">Tous</option>
                {genres.map((g, i) => (
                  <option key={i}>{g}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label>Nationalité</Form.Label>
              <Form.Select
                value={selectedNationalite}
                onChange={(e) => setSelectedNationalite(e.target.value)}
              >
                <option value="">Toutes</option>
                {nationalites.map((nat, i) => (
                  <option key={i}>{nat}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Card>

        {/* Liste des nageurs */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4>Liste des Nageurs</h4>
          <span className="text-muted">
            {filteredNageurs.length} nageurs trouvés
          </span>
        </div>

        <Row xs={1} sm={2} md={4} className="g-4">
          {currentNageurs.map((n) => (
            <Col key={n.public_id}>
              <Card className="shadow-sm border-0 rounded-4 h-100 p-2">
                <Card.Body>
                  <Card.Title
                    className="fw-bold text-uppercase"
                    style={{ cursor: "pointer", color: "#0e3e84" }}
                    onClick={() => navigate(`/nageurs/${n.public_id}`)}
                  >
                    {n.prenom} {n.nom}
                  </Card.Title>

                  <p>
                    <strong>Date Naissance:</strong> {n.birth_year}
                  </p>
                  <p>
                    <strong>Catégorie:</strong>{" "}
                    <span className="badge bg-light text-dark">
                      {n.categorie}
                    </span>
                  </p>
                  <p>
                    <strong>Club:</strong>{" "}
                    <span className="text-primary">{n.club_nom || "-"}</span>
                  </p>
                  <p>
                    <strong>Éligible:</strong>{" "}
                    {n.eligible ? (
                      <span className="badge bg-success">Oui</span>
                    ) : (
                      <span className="badge bg-danger">Non</span>
                    )}
                  </p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Pagination */}
        <div className="mt-4">{renderPagination()}</div>
      </Container>
    </div>
  );
}
