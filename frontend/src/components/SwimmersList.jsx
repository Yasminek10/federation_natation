import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Form,
  Badge,
  Card,
  Dropdown,
  Pagination,
} from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
// liste des nageurs d'un club avec recherche, filtre, pagination
export default function SwimmersList() {
  const navigate = useNavigate();
  const [swimmers, setSwimmers] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const { public_id } = useParams();
  //const { clubId } = useParams();

useEffect(() => {
  console.log("public_id reçu du router:", public_id);
  if (!public_id) return;

  fetch(`http://localhost:5000/api/clubs/${public_id}/nageurs`)
    .then((res) => {
      console.log("URL appelée:", res.url);
      return res.json();
    })
    .then((data) => setSwimmers(data))
    .catch((err) => console.error("Erreur fetch swimmers:", err));
}, [public_id]);


  // ✅ Filtrage
  const filteredSwimmers = useMemo(() => {
    return swimmers.filter(
      (s) =>
        (s.nom.toLowerCase().includes(search.toLowerCase()) ||
          s.prenom.toLowerCase().includes(search.toLowerCase())) &&
        (categoryFilter === "Toutes" || s.categorie === categoryFilter)
    );
  }, [search, swimmers, categoryFilter]);

  // ✅ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSwimmers.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredSwimmers.length / itemsPerPage);

  return (
    <div className="container pb-4">
      {/* BARRE DE RECHERCHE + FILTRE */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h5 className="fw-bold mb-0">Liste des nageurs</h5>

        <div className="d-flex gap-2">
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

      {/* TABLEAU */}
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
                <tr key={s.public_id}>
                  <td
                    className="fw-semibold"
                    style={{ cursor: "pointer", color: "#0e3e84" }}
                    onClick={() => navigate(`/nageurs/${s.public_id}`)}
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
        {totalPages > 1 && (
          <Pagination className="justify-content-center my-3 flex-wrap">
            <Pagination.Prev
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              ←
            </Pagination.Prev>

            {[...Array(totalPages)].map((_, index) => {
              const page = index + 1;
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <Pagination.Item
                    key={page}
                    active={page === currentPage}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Pagination.Item>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <Pagination.Ellipsis key={page} disabled />;
              }
              return null;
            })}

            <Pagination.Next
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              →
            </Pagination.Next>
          </Pagination>
        )}
      </Card>
    </div>
  );
}
