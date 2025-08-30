import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";

function EditMinimaModal({ show, handleClose, minima, onSave }) {
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [milliseconds, setMilliseconds] = useState("");

  // Charger les valeurs quand on ouvre le modal
  useEffect(() => {
    if (minima && minima.temps) {
      const parts = minima.temps.split(":"); // ex: "1:23.456"
      if (parts.length === 2) {
        const [min, secMilli] = parts;
        const [sec, milli] = secMilli.split(".");
        setMinutes(min);
        setSeconds(sec);
        setMilliseconds(milli || "000");
      } else {
        // fallback si format inattendu
        setMinutes("");
        setSeconds("");
        setMilliseconds("");
      }
    }
  }, [minima]);

  const handleSubmit = () => {
    const formattedTime = `${minutes}:${seconds}.${milliseconds}`;
    const updated = { ...minima, temps: formattedTime };
    onSave(updated);
    handleClose();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Modifier le Temps</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col>
              <Form.Group>
                <Form.Label>Minutes</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Secondes</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Millisecondes</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  max="999"
                  value={milliseconds}
                  onChange={(e) => setMilliseconds(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          Enregistrer
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default EditMinimaModal;
