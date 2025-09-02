import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Container,
  Dropdown,
  Form,
  InputGroup,
  Pagination,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";

// Assure-toi d'avoir importé Bootstrap CSS (dans src/index.js) :
// import 'bootstrap/dist/css/bootstrap.min.css';

const API = {
  list: (params) =>
    fetch(`http://localhost:5000/api/swimmers/approvals?${params.toString()}`, {
      credentials: "include",
    }).then((r) => r.json()),
  patchOne: (id, eligible) =>
    fetch(`http://localhost:5000/api/swimmers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ eligible_points: !!eligible }),
    }),
  bulk: (updates) =>
    fetch(`http://localhost:5000/api/swimmers/approvals/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ updates }),
    }).then((r) => r.json()),
};

const PAGE_SIZE = 50;
const CURRENT_YEAR = new Date().getFullYear();

export default function EligibilityPage() {
  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'error'|'success', text:string}

  // filtres
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [clubId, setClubId] = useState(null);
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [page, setPage] = useState(1);

  // sélection (bulk)
  const [selected, setSelected] = useState(new Set()); // Set<number>

  // debounce recherche
  const searchRef = useRef(null);
  const scheduleSearch = (val) => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setPage(1);
      setSearch(val);
    }, 350);
  };

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({
        search,
        only_pending: onlyPending ? "1" : "0",
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (clubId) params.set("club_id", String(clubId));
      if (yearMin !== "") params.set("year_min", String(yearMin));
      if (yearMax !== "") params.set("year_max", String(yearMax));

      const data = await API.list(params);
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setSelected(new Set()); // reset selection sur nouveau chargement
    } catch (e) {
      setMsg({ type: "error", text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, onlyPending, clubId, yearMin, yearMax, page]);

  const uniqueClubs = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.club_id) map.set(r.club_id, r.club || `Club ${r.club_id}`);
    });
    return Array.from(map.entries()) // [ [id, name], ...]
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onToggleOne = async (id, val) => {
    // optimistic update
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, eligible_points: !!val } : r)));
    try {
      const res = await API.patchOne(id, val);
      if (!res.ok) throw new Error("Erreur sauvegarde");
      setMsg({ type: "success", text: "Mise à jour enregistrée." });
    } catch (e) {
      // rollback
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, eligible_points: !val } : r)));
      setMsg({ type: "error", text: "Échec de la mise à jour" });
    }
  };

  const toggleSelectAllOnPage = (checked) => {
    const next = new Set(selected);
    if (checked) rows.forEach((r) => next.add(r.id));
    else rows.forEach((r) => next.delete(r.id));
    setSelected(next);
  };

  const toggleSelectOne = (id, checked) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const bulkUpdate = async (eligible) => {
    if (selected.size === 0) return;
    // optimistic update
    const ids = Array.from(selected);
    setRows((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, eligible_points: eligible } : r)));
    try {
      const resp = await API.bulk(ids.map((id) => ({ id, eligible_points: eligible })));
      if (resp.status !== "ok") throw new Error("Erreur bulk");
      setMsg({ type: "success", text: `${resp.updated ?? ids.length} nageur(s) mis à jour.` });
      setSelected(new Set());
    } catch (e) {
      // en cas d'échec, recharger la page pour resync
      setMsg({ type: "error", text: "Échec de la mise à jour groupée" });
      load();
    }
  };

  const clearFilters = () => {
    setSearch("");
    setOnlyPending(false);
    setClubId(null);
    setYearMin("");
    setYearMax("");
    setPage(1);
  };

  // tri client rapide (nom puis prénom)
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const an = `${a.nom || ""} ${a.prenom || ""}`.toLocaleLowerCase();
      const bn = `${b.nom || ""} ${b.prenom || ""}`.toLocaleLowerCase();
      return an.localeCompare(bn);
    });
  }, [rows]);

  const selectedCount = selected.size;

  return (
    <Container fluid="md" className="py-4">
      <Row className="align-items-center mb-3 g-2">
        <Col>
          <h2 className="h4 mb-0">Éligibilité des points</h2>
          <div className="text-muted small">Gérer l'autorisation de points pour les nageurs non tunisiens.</div>
        </Col>
        <Col xs="12" md="auto" className="d-flex gap-2 justify-content-md-end mt-2 mt-md-0">
          <Button variant="outline-secondary" onClick={clearFilters}>Réinitialiser</Button>
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? (<><Spinner size="sm" animation="border" className="me-2"/>Actualisation…</>) : "Actualiser"}
          </Button>
        </Col>
      </Row>

      {/* Filtres */}
      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Row className="g-3 align-items-start">
            <Col md={4}>
              <Form.Label>Rechercher (nom/prénom)</Form.Label>
              <InputGroup>
                <Form.Control
                  type="search"
                  placeholder="Ex: Ahmed, Ben Ali…"
                  defaultValue={search}
                  onChange={(e) => scheduleSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Label>Club (page courante)</Form.Label>
              <Form.Select
                value={clubId || ""}
                onChange={(e) => { setPage(1); setClubId(e.target.value ? Number(e.target.value) : null); }}
              >
                <option value="">Tous les clubs</option>
                {uniqueClubs.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </Form.Select>
              <Form.Text muted className="mt-1">La liste se base sur la page chargée.</Form.Text>
            </Col>
            <Col md={2}>
              <Form.Label>Année min.</Form.Label>
              <Form.Control
                type="number"
                min={1900}
                max={CURRENT_YEAR}
                placeholder="ex: 2006"
                value={yearMin}
                onChange={(e) => { setPage(1); setYearMin(e.target.value.replace(/[^0-9]/g, "")); }}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Année max.</Form.Label>
              <Form.Control
                type="number"
                min={1900}
                max={CURRENT_YEAR}
                placeholder="ex: 2010"
                value={yearMax}
                onChange={(e) => { setPage(1); setYearMax(e.target.value.replace(/[^0-9]/g, "")); }}
              />
            </Col>
            <Col md={3}>
              <Form.Check
                type="switch"
                id="only-pending"
                label="Seulement à approuver."
                checked={onlyPending}
                onChange={(e) => { setPage(1); setOnlyPending(e.target.checked); }}
              />
            </Col>
          </Row>
          <div className="mt-2 small text-muted">{total} résultat(s)</div>
          {selectedCount > 0 && (
            <div className="small">
              <Badge bg="primary" className="me-1">{selectedCount}</Badge> sélectionné(s)
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Actions groupées */}
      <Row className="mb-2">
        <Col className="d-flex gap-2">
          <ButtonGroup>
            <Button
              variant="outline-primary"
              disabled={!isAdmin || selected.size === 0}
              onClick={() => bulkUpdate(true)}
            >
              Autoriser (sélection)
            </Button>
            <Button
              variant="outline-danger"
              disabled={!isAdmin || selected.size === 0}
              onClick={() => bulkUpdate(false)}
            >
              Refuser (sélection)
            </Button>
          </ButtonGroup>
        </Col>
      </Row>

      {/* Table */}
      <div className="table-responsive">
        <Table hover bordered className="align-middle" style={{ minWidth: 760 }}>
          <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th style={{ width: 46 }} className="text-center">
                <Form.Check
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                  onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                  disabled={!isAdmin || rows.length === 0}
                />
              </th>
              <th>Nageur</th>
              <th>Club</th>
              <th style={{ width: 90 }}>Année</th>
              <th>Nationalité</th>
              <th style={{ width: 170 }} className="text-center">Éligible points</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id}>
                <td className="text-center">
                  <Form.Check
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => toggleSelectOne(r.id, e.target.checked)}
                    aria-label={`Sélectionner ${r.nom} ${r.prenom}`}
                    disabled={!isAdmin}
                  />
                </td>
                <td className="fw-semibold">{r.nom} {r.prenom}</td>
                <td>{r.club}</td>
                <td>{r.birth_year ?? "—"}</td>
                <td>
                  {r.nationalite ? (
                    <Badge bg="secondary">{r.nationalite}</Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="text-center">
                  <Form.Check
                    type="switch"
                    id={`eligible-${r.id}`}
                    checked={!!r.eligible_points}
                    onChange={(e) => onToggleOne(r.id, e.target.checked)}
                    label={r.eligible_points ? "Autorisé" : "Refusé"}
                    disabled={!isAdmin}
                  />
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">Aucun nageur.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="d-flex justify-content-center mt-3">
          <Pagination className="mb-0">
            <Pagination.Prev
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            <Pagination.Item active>{page}</Pagination.Item>
            <Pagination.Next
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            />
          </Pagination>
          <div className="ms-3 small text-muted align-self-center">Page {page} / {pages}</div>
        </div>
      )}

      {/* Messages */}
      {msg && (
        <Row className="mt-3">
          <Col>
            <Alert variant={msg.type === "error" ? "danger" : "success"} onClose={() => setMsg(null)} dismissible>
              {msg.text}
            </Alert>
          </Col>
        </Row>
      )}
    </Container>
  );
}
