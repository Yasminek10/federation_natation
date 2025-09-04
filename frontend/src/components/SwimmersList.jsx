import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Form,
  Badge,
  Card,
  Row,
  Col,
  Button,
  Dropdown,
  Pagination,
} from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import Navbar_Home from "../components/Navbar_Home";

export default function SwimmersList({ user }) {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [swimmers, setSwimmers] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");

  useEffect(() => {
    // Charger les infos club
    fetch(`http://localhost:5000/api/clubs/${clubId}`)
      .then((res) => res.json())
      .then((data) => setClub(data))
      .catch((err) => console.error("Erreur fetch club:", err));

    // Charger les nageurs
    fetch(`http://localhost:5000/api/clubs/${clubId}/nageurs`)
      .then((res) => res.json())
      .then((data) => setSwimmers(data))
      .catch((err) => console.error("Erreur fetch swimmers:", err));
  }, [clubId]);

  // ✅ Filtrage
  const filteredSwimmers = useMemo(() => {
    return swimmers.filter(
      (s) =>
        (s.nom.toLowerCase().includes(search.toLowerCase()) ||
          s.prenom.toLowerCase().includes(search.toLowerCase())) &&
        (categoryFilter === "Toutes" || s.categorie === categoryFilter)
    );
  }, [search, swimmers, categoryFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // nbr de nageurs par page

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSwimmers.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const totalPages = Math.ceil(filteredSwimmers.length / itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  return (
    <div>
      <div>
        {/* HEADER CLUB */}
        <Navbar_Home user={user} />
        {club && (
          <div className="container py-4">
            <Card className="shadow-sm border-0 mb-4 rounded-3">
              <Card.Body
                className="rounded-3"
                style={{
                  background: "#ffffff",
                  background:
                    "linear-gradient(14deg,rgba(255, 255, 255, 1) 0%, rgba(230, 245, 255, 1) 100%)",
                }}
              >
                <Row className="align-items-center">
                  <Col xs="auto">
                    {club.logo ? (
                      <img
                        src={club.logo}
                        alt={club.nom}
                        style={{ width: 90, height: 90 }}
                        className="rounded-circle border shadow-sm"
                      />
                    ) : (
                      <div
                        style={{
                          width: 90,
                          height: 90,
                          borderRadius: "50%",
                          backgroundColor: "#0e3e84dd",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "32px",
                          fontWeight: "bold",
                          color: "white",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        {club.nom.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Col>

                  <Col>
                    <h3 className="fw-bold mb-1" style={{ color: "#0e3e84dd" }}>
                      {club.nom}
                    </h3>
                    <div className="d-flex gap-4 small text-secondary fw-semibold">
                      <i className="bi bi-people-fill"></i> {swimmers.length}{" "}
                      Nageurs
                    </div>
                  </Col>

                  <Col xs="auto">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => navigate(-1)}
                    >
                      ← Retour
                    </Button>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* BARRE DE RECHERCHE + FILTRE */}
        <div className="container mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="fw-bold mb-0">Nageurs</h5>

            <div className="d-flex gap-2">
              {/* Filtre Catégorie */}
              <Dropdown onSelect={(val) => setCategoryFilter(val)}>
                <Dropdown.Toggle variant="outline-primary" size="sm">
                  {categoryFilter}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item eventKey="Toutes">Toutes</Dropdown.Item>
                  {[...new Set(swimmers.map((s) => s.categorie))].map((cat) => (
                    <Dropdown.Item key={cat} eventKey={cat}>
                      {cat}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>

              {/* Recherche */}
              <Form.Control
                type="text"
                placeholder="🔍 Rechercher un nageur..."
                style={{ maxWidth: 250 }}
                size="sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* TABLEAU */}
        <div className="container pb-4">
          <Card className="shadow-sm border-0 rounded-3">
            <Table hover responsive className="align-middle mb-0">
              <thead className="table-primary">
                <tr>
                  <th>Nom Complet</th>
                  <th>Naissance</th>
                  <th>Catégorie</th>
                  <th>Genre</th>
                  <th>Nationalité</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((s) => (
                    <tr key={s.id}>
                    <td
  className="fw-semibold"
  style={{ cursor: "pointer", color: "#0e3e84" }}
  onClick={() => navigate(`/nageurs/${s.id}`)}
>
  {s.nom} {s.prenom}
</td>

                      <td>{s.birth_year}</td>
                      <td>
                        <Badge bg="secondary" pill>
                          {s.categorie || "N/A"}
                        </Badge>
                      </td>
                      <td>{s.genre || "-"}</td>
                      <td>
                        <Badge
                          bg={s.nationalite === "TUN" ? "success" : "dark"}
                          pill
                        >
                          {s.nationalite || "N/A"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-3">
                      Aucun nageur trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>

            {/* Pagination */}
            {/* Pagination améliorée */}
            {totalPages > 1 && (
              <Pagination className="justify-content-center my-3 flex-wrap">
                {/* Bouton Précédent */}
                <Pagination.Prev
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  ←
                </Pagination.Prev>

                {/* Pages */}
                {[...Array(totalPages)].map((_, index) => {
                  const page = index + 1;

                  // ✅ On limite l’affichage à max 5 pages visibles
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <Pagination.Item
                        key={page}
                        active={page === currentPage}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Pagination.Item>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return <Pagination.Ellipsis key={page} disabled />;
                  }
                  return null;
                })}

                {/* Bouton Suivant */}
                <Pagination.Next
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  →
                </Pagination.Next>
              </Pagination>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
