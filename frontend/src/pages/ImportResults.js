import React, { useMemo, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Form,
  InputGroup,
  Spinner,
  Table,
} from "react-bootstrap";

export default function ImportResults() {
  const [url, setUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState(null);

  // États éligibilité
  const [swimmers, setSwimmers] = useState([]);
  const [conflicts, setConflicts] = useState([]); // keys conflit de nationalités
  const [approvals, setApprovals] = useState({}); // { swimmer_key: bool }

  const swimmersToVerify = useMemo(
    () => (swimmers || []).filter((s) => !!s.needs_approval),
    [swimmers]
  );

  const doPreview = async (e) => {
    e?.preventDefault?.();
    setMsg(null);
    setPreview(null);
    setSwimmers([]);
    setConflicts([]);
    setApprovals({});
    setLoadingPreview(true);

    try {
      const res = await fetch("http://localhost:5000/api/ingest/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, limit: 8 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg({ type: "error", text: data.message || "Erreur de prévisualisation." });
      } else {
        setPreview(data);
        setSwimmers(Array.isArray(data.swimmers_verification) ? data.swimmers_verification : []);
        setConflicts(Array.isArray(data.swimmer_conflicts_keys) ? data.swimmer_conflicts_keys : []);

        // Préremplir uniquement pour non-TUN (needs_approval)
        const init = {};
        (data.swimmers_verification || []).forEach((s) => {
          if (s.needs_approval) {
            const fromDb =
              s.existing && typeof s.existing.eligible_points === "boolean"
                ? s.existing.eligible_points
                : undefined;
            init[s.key] = fromDb !== undefined ? fromDb : false;
          }
        });
        setApprovals(init);
      }
    } catch (err) {
      setMsg({ type: "error", text: String(err) });
    } finally {
      setLoadingPreview(false);
    }
  };

  const doImport = async () => {
    setMsg(null);

    if (!preview) {
      setMsg({ type: "error", text: "Prévisualise et vérifie d’abord les nationalités." });
      return;
    }
    if (conflicts.length > 0) {
      setMsg({ type: "error", text: "Conflit de nationalité détecté : import bloqué." });
      return;
    }

    setLoadingImport(true);
    try {
      const res = await fetch("http://localhost:5000/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, approvals }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg({ type: "error", text: data.message || "Erreur d'import." });
      } else {
        const ins = typeof data?.inserted === "number" ? data.inserted : 0;
        const upd = typeof data?.updated === "number" ? data.updated : 0;
        const unch = typeof data?.unchanged === "number" ? data.unchanged : 0;
        setMsg({ type: "success", text: `Import OK — Ajoutés: ${ins}, Modifiés: ${upd}, Inchangés: ${unch}` });
      }
    } catch (err) {
      setMsg({ type: "error", text: String(err) });
    } finally {
      setLoadingImport(false);
    }
  };

  const isMulti = !!(preview && Array.isArray(preview.events));

  const StatusBadge = ({ status }) => {
    if (status === "new") return <Badge bg="success">Nouveau</Badge>;
    if (status === "updated") return <Badge bg="warning" text="dark">Modifié</Badge>;
    if (status === "unchanged") return <Badge bg="secondary">Inchangé</Badge>;
    return <Badge bg="light" text="dark">—</Badge>;
  };

  const EventHeader = ({ ev }) => {
    if (!ev) return null;
    const dist = ev.distance_par_jambe ?? ev.distance ?? "";
    const main = ev.is_relay
      ? `${ev.nage} ${ev.legs_count}×${dist} m`
      : `${ev.nage} ${dist}${dist ? " m" : ""}`;
    return (
      <div className="text-muted">
        <strong>Épreuve</strong> {main} — {ev.genre}{ev.is_relay ? " (Relais)" : ""}
      </div>
    );
  };

  const CategoryHeader = ({ cec }) => {
    if (!cec) return null;
    return (
      <div className="d-flex align-items-center gap-2 mb-2">
        <div><strong>Catégorie:</strong></div>
        <Badge bg="secondary">{cec.categorie}</Badge>
        {cec.guessed_category ? <Badge bg="light" text="dark">auto</Badge> : null}
        {cec.cec_id ? <Badge bg="info">CEC existant</Badge> : <Badge bg="success">CEC nouveau</Badge>}
      </div>
    );
  };

  const VerificationTable = () => {
    if (swimmersToVerify.length === 0) return null;
    return (
      <Card className="mt-3">
        <Card.Header as="h5">Éligibilité points — vérification nationalité</Card.Header>
        <Card.Body>
          {conflicts.length > 0 && (
            <Alert variant="danger">
              <Alert.Heading>Conflit de nationalité détecté</Alert.Heading>
              <div>{conflicts.length} identité(s) ont des nationalités différentes. Corrige la source avant d’importer.</div>
            </Alert>
          )}
          <div className="table-responsive">
            <Table hover bordered className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Nageur</th>
                  <th>Club</th>
                  <th>Année</th>
                  <th>Nationalité(s)</th>
                  <th className="text-center">Éligible</th>
                </tr>
              </thead>
              <tbody>
                {swimmersToVerify.map((s) => (
                  <tr key={s.key}>
                    <td className="fw-medium">{s.fullname}</td>
                    <td>{s.club || "—"}</td>
                    <td>{s.birth_year ?? "—"}</td>
                    <td>{(s.nations || []).join(", ") || "—"}</td>
                    <td className="text-center">
                      <Form.Check
                        type="switch"
                        id={`eligible-${s.key}`}
                        checked={!!approvals[s.key]}
                        onChange={(e) => setApprovals((a) => ({ ...a, [s.key]: e.target.checked }))}
                        label=""
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    );
  };

  const NonRelayTable = ({ cec }) => {
    if (!cec) return null;
    return (
      <div className="table-responsive mt-2">
        <Table hover bordered size="sm" className="align-middle">
          <thead>
            <tr>
              <th>Statut</th>
              <th>Nom</th>
              <th>Club</th>
              <th>Nation</th>
              <th>Année</th>
              <th>Temps</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {(cec.details || []).map((d, j) => (
              <tr key={j}>
                <td><StatusBadge status={d.row_status} /></td>
                <td className="fw-medium">{d.fullname}</td>
                <td>{d.club || <span className="text-danger">—</span>}</td>
                <td>{d.nation || "—"}</td>
                <td>{d.birth_year ?? "—"}</td>
                <td>{d.time || "—"}</td>
                <td>{d.points_raw || "0"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  const RelayBlock = ({ cec }) => {
    if (!cec) return null;
    return (
      <div className="mt-2 d-grid gap-3">
        {(cec.details || []).map((t, k) => (
          <Card key={k} className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1 small">
                <StatusBadge status={t.row_status} />
                <div className="fw-semibold">Équipe</div>
                <Badge bg="secondary">{t.club || <span className="text-danger">manquant</span>}</Badge>
                <div>Temps: <span className="fw-semibold">{t.time || "—"}</span></div>
                <div>Points: <span className="fw-semibold">{t.points}</span></div>
                {t.error && <Badge bg="danger">{t.error}</Badge>}
              </div>
              <div className="mt-2 small">
                <div className="fw-semibold mb-1">Membres</div>
                <ul className="mb-0">
                  {(t.members || []).map((m, z) => (
                    <li key={z}>
                      {m.fullname} — {m.birth_year ?? "—"}{m.nation ? ` — ${m.nation}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              {t.passages && (
                <div className="mt-2 text-muted small">Passages: {t.passages}</div>
              )}
            </Card.Body>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container my-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h4 mb-0">Importer des résultats (FTN)</h2>
      </div>

      <Card>
        <Card.Header as="h5">Prévisualisation & import</Card.Header>
        <Card.Body>
          <Form onSubmit={doPreview} className="d-flex flex-column flex-md-row gap-2">
            <div className="flex-grow-1">
              <Form.Label htmlFor="url">Adresse de la page résultats</Form.Label>
              <InputGroup>
                <Form.Control
                  id="url"
                  type="url"
                  required
                  placeholder="https://ftnatation.tn/…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </InputGroup>
            </div>
            <div className="d-flex gap-2 align-items-end">
              <Button type="submit" variant="primary" disabled={loadingPreview}>
                {loadingPreview ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Prévisualisation…
                  </>
                ) : "Prévisualiser"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loadingImport || !url || !preview || conflicts.length > 0}
                onClick={doImport}
              >
                {loadingImport ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Import…
                  </>
                ) : "Importer"}
              </Button>
            </div>
          </Form>

          {msg && (
            <div className="mt-3">
              {msg.type === "error" ? (
                <Alert variant="danger">{msg.text}</Alert>
              ) : (
                <Alert variant="success">{msg.text}</Alert>
              )}
            </div>
          )}

          {preview && (
            <div className="mt-4">
              <Card className="mb-3">
                <Card.Body className="small">
                  <div className="d-flex flex-wrap gap-3 align-items-center">
                    <div><strong>Champ.</strong> {preview.championnat?.nom} — {preview.championnat?.saison}</div>
                    <div><strong>Lieu</strong> {preview.championnat?.lieu}</div>
                    <Badge bg="light" text="dark">{preview.championnat?.bassin} m</Badge>
                    <div className="ms-auto text-muted">
                      <strong className="text-dark">Dates</strong> {preview.championnat?.datedeb} → {preview.championnat?.datefin}
                    </div>
                  </div>

                  {preview.delta_summary && (
                    <div className="mt-2 d-flex flex-wrap gap-2">
                      <Badge bg="success">À ajouter: {preview.delta_summary.inserted}</Badge>
                      <Badge bg="warning" text="dark">À modifier: {preview.delta_summary.updated}</Badge>
                      <Badge bg="secondary">Inchangés: {preview.delta_summary.unchanged}</Badge>
                    </div>
                  )}

                  {Array.isArray(preview.categories) && (
                    <div className="mt-2 d-flex flex-wrap gap-2">
                      {(preview.categories || []).map((c) => (
                        <Badge key={c} bg="secondary">{c}</Badge>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>

              <VerificationTable />

              {isMulti ? (
                <Accordion alwaysOpen className="mt-3">
                  {(preview.events || []).map((evBlock, idx) => (
                    <Accordion.Item eventKey={`ev-${idx}`} key={idx}>
                      <Accordion.Header>
                        <div className="d-flex flex-column">
                          <div className="fw-semibold">
                            {evBlock?.epreuve?.nage} • {evBlock?.epreuve?.genre} {evBlock?.epreuve?.is_relay ? "• Relais" : ""}
                          </div>
                          <EventHeader ev={evBlock.epreuve} />
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="d-grid gap-3">
                          {(evBlock.cecs || []).map((cec, i) => (
                            <Card key={i} className="border-0 shadow-sm">
                              <Card.Body>
                                <CategoryHeader cec={cec} />
                                {evBlock.epreuve?.is_relay ? (
                                  <RelayBlock cec={cec} />
                                ) : (
                                  <NonRelayTable cec={cec} />
                                )}
                              </Card.Body>
                            </Card>
                          ))}
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              ) : (
                <Alert variant="info" className="mt-3">
                  Preview multi-épreuves non détecté (mode simple).
                </Alert>
              )}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
