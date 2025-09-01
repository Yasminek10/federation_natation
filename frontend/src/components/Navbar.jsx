// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Offcanvas, Dropdown } from "react-bootstrap";
import {
  FaBars,
  FaCog,
  FaUpload,
  FaUser,
  FaUserPlus,
  FaDatabase,
  FaSignOutAlt,
  FaHome,            // ⬅️ important
} from "react-icons/fa";
import logo from "../assets/logo-ftn.png";

export default function Navbar({ user, onLogout }) {
  const [show, setShow] = useState(false);
  const role = user?.role || "guest";
  const { pathname } = useLocation();

  // Liens
  const HOME = { title: "Accueil", path: "/home", icon: <FaHome /> };
  const SCRAPING = { title: "Import résultats", path: "/import", icon: <FaDatabase /> };
  const OCR = { title: "import d'image", path: "/ocr", icon: <FaUpload /> };
  const ACCOUNT = { title: "Mon compte", path: "/account", icon: <FaUser /> };
  const CREATE = { title: "Créer un compte", path: "/admin/users/create", icon: <FaUserPlus /> };

  const RULES = {
    title: "Règles",
    icon: <FaCog />,
    items: [
      { title: "Max places par catégorie", path: "/regles/max-places" },
      { title: "Minimas", path: "/regles/minimas" },
      { title: "Éligibilité", path: "/regles/eligibilite" },
    ],
  };

  const menu =
    role === "admin"
      ? [HOME, SCRAPING, OCR, RULES, CREATE, ACCOUNT]
      : role === "coach"
      ? [HOME, SCRAPING, OCR, RULES, ACCOUNT]
      : [HOME, SCRAPING];

  const isActive = (p) => pathname.startsWith(p);

  return (
    <>
      {/* Topbar (style conservé) */}
      <header className="navbar-fixed d-flex justify-content-between align-items-center px-4 py-2 bg-white shadow-sm">
        <div className="d-flex align-items-center">
          <img src={logo} alt="FTN" style={{ height: 40 }} />
          <h5 className="m-0 ms-2 fw-bold text-primary">Fédération Tunisienne de Natation</h5>
        </div>

        {/* Desktop */}
        <nav className="d-none d-lg-flex align-items-center gap-3">
          {menu.map((item, idx) =>
            item.items ? (
              <Dropdown key={idx} align="end">
                <Dropdown.Toggle
                  variant="outline-secondary"
                  className={isActive("/regles") ? "border-primary text-primary" : ""}
                >
                  <span className="me-1 align-middle">{RULES.icon}</span> {item.title}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {item.items.map((sub, i) => (
                    <Dropdown.Item as={Link} to={sub.path} key={i}>
                      {sub.title}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Link
                key={idx}
                to={item.path}
                className={`nav-link d-flex align-items-center gap-1 ${
                  isActive(item.path) ? "text-primary fw-semibold" : ""
                }`}
              >
                <span className="align-middle">{item.icon}</span> {item.title}
              </Link>
            )
          )}
        </nav>

        {/* Mobile (Offcanvas – style inchangé) */}
        <button className="btn d-lg-none" onClick={() => setShow(true)}>
          <FaBars size={22} />
        </button>
      </header>

      <Offcanvas show={show} onHide={() => setShow(false)} className="swim-drawer">
        <Offcanvas.Header closeButton className="drawer-header">
          <Offcanvas.Title className="text-white d-flex align-items-center">
            <img src={logo} alt="Logo" style={{ height: 32 }} className="me-2 rounded-circle bg-white p-1" />
            <span>Menu</span>
          </Offcanvas.Title>
        </Offcanvas.Header>

        <Offcanvas.Body className="p-0">
          <nav className="drawer-links">
            {menu.map((item, idx) =>
              item.items ? (
                <div key={idx} className="px-3 py-2">
                  <div className="text-uppercase small text-muted mb-2 d-flex align-items-center gap-2">
                    {RULES.icon} {item.title}
                  </div>
                  {item.items.map((sub, i) => (
                    <Link
                      key={i}
                      to={sub.path}
                      className="drawer-item d-flex align-items-center gap-2"
                      onClick={() => setShow(false)}
                    >
                      {sub.title}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={idx}
                  to={item.path}
                  className="drawer-item d-flex align-items-center gap-2"
                  onClick={() => setShow(false)}
                >
                  <span className="align-middle">{item.icon}</span> {item.title}
                </Link>
              )
            )}
          </nav>

          <hr className="my-2" />

          {/* Profil + Logout (inchangés) */}
          <div className="drawer-profile px-3 py-2">
            <div className="d-flex align-items-center">
              <div className="profile-avatar me-2">{user?.name ? user.name[0].toUpperCase() : "A"}</div>
              <div>
                <strong>{user?.name || "Utilisateur"}</strong>
                <div className="small text-muted">{user?.email || "user@ftn.tn"}</div>
              </div>
            </div>
          </div>

          <div className="px-3 py-2">
            <button
              className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={() => {
                if (onLogout) return onLogout();
                localStorage.removeItem("user");
                window.location.href = "/login";
              }}
            >
              <FaSignOutAlt /> Se déconnecter
            </button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
