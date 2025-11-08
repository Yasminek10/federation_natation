import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Offcanvas, Dropdown } from "react-bootstrap";
import { FaChartLine } from "react-icons/fa";
import {
  FaBars,
  FaCog,
  FaUpload,
  FaUserPlus,
  FaDatabase,
  FaSignOutAlt,
  FaHome,
} from "react-icons/fa";
import ProfileModal from "./ProfilModal";
import logo from "../assets/logo-ftn.png";

export default function Navbar({ user }) {
  const [showProfile, setShowProfile] = useState(false);
  const [show, setShow] = useState(false); // ✅ fix: state for Offcanvas
  const role = user?.role || "guest";
  const { pathname } = useLocation();

  const displayName =
    user?.name ||
    [user?.prenom, user?.nom].filter(Boolean).join(" ").trim() ||
    user?.email ||
    "Mon compte";

  const initials = (displayName || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const HOME = { title: "Accueil", path: "/home", icon: <FaHome /> };
  const SCRAPING = { title: "Import résultats", path: "/import", icon: <FaDatabase /> };
  const OCR = { title: "Import d'image", path: "/ocr", icon: <FaUpload /> };
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

  const COACH_DASHBOARD = { title: "Coach View", path: "/coach/view", icon: <FaChartLine /> };
  const menu =
    role === "admin"
      ? [HOME, SCRAPING, OCR, RULES, CREATE]
      : role === "coach"
      ? [HOME, SCRAPING, OCR, RULES, COACH_DASHBOARD]
      : [HOME, SCRAPING];

  const isActive = (p) => pathname.startsWith(p);

  const handleLogout = () => {
    localStorage.removeItem("user");
    fetch("http://localhost:5000/api/logout", { method: "POST", credentials: "include" }).finally(
      () => {
        window.location.href = "/login";
      }
    );
  };

  return (
    <>
      <header className="navbar-fixed d-flex justify-content-between align-items-center px-4 bg-white shadow-sm">
        {/* ----- Brand amélioré ----- */}
        <div className="brand d-flex align-items-center">
          <div className="brand-emblem">
            <img src={logo} alt="FTN" className="brand-logo" />
          </div>
          <div className="brand-text ms-3">
            <div className="brand-line-1">Fédération Tunisienne</div>
            <div className="brand-line-2">de Natation</div>
          </div>
        </div>

        {/* Desktop NAV + User menu */}
        <div className="d-none d-lg-flex align-items-center gap-3">
          <nav className="d-flex align-items-center gap-2">
            {menu.map((item, idx) =>
              item.items ? (
                <Dropdown key={idx} align="end">
                  <Dropdown.Toggle
                    as="button"
                    className={`nav-chip nav-chip-toggle ${
                      isActive("/regles") ? "nav-chip-active" : ""
                    }`}
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
                  className={`nav-chip text-decoration-none ${
                    isActive(item.path) ? "nav-chip-active" : ""
                  }`}
                >
                  <span className="align-middle me-1">{item.icon}</span> {item.title}
                </Link>
              )
            )}
          </nav>

          {/* Compte (desktop) */}
          {role !== "guest" && (
            <Dropdown align="end">
              <Dropdown.Toggle
                as="button"
                className="nav-chip user-toggle d-flex align-items-center gap-2"
              >
                <span className="profile-avatar">{initials}</span>
                <span className="d-inline-block">{displayName}</span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item as={Link} to="/account">
                  Profil
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <FaSignOutAlt className="me-2" /> Se déconnecter
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          )}
        </div>

        {/* Mobile button */}
        <button className="btn d-lg-none" onClick={() => setShow(true)}>
          <FaBars size={24} />
        </button>
      </header>

      {/* --- Drawer / Offcanvas --- */}
      <Offcanvas show={show} onHide={() => setShow(false)} className="swim-drawer">
        <Offcanvas.Header closeButton className="drawer-header">
          <Offcanvas.Title className="text-white d-flex align-items-center">
            <img
              src={logo}
              alt="Logo"
              style={{ height: 36 }}
              className="me-2 rounded-circle bg-white p-1"
            />
            <span>Menu</span>
          </Offcanvas.Title>
        </Offcanvas.Header>

        <Offcanvas.Body className="p-0 d-flex flex-column">
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
                      className="drawer-item d-flex align-items-center gap-2 drawer-chip"
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
                  className="drawer-item d-flex align-items-center gap-2 drawer-chip"
                  onClick={() => setShow(false)}
                >
                  <span className="align-middle">{item.icon}</span> {item.title}
                </Link>
              )
            )}
          </nav>

          <hr className="my-2" />

          {role !== "guest" && (
            <div
              className="drawer-profile px-3 py-3 d-flex align-items-center gap-2 drawer-chip clickable"
              role="button"
              onClick={() => {
                setShow(false);
                setShowProfile(true);
              }}
            >
              <div className="profile-avatar">{initials}</div>
              <div>
                <strong>{displayName}</strong>
                <div className="small text-muted">{user?.email}</div>
              </div>
            </div>
          )}

          <div className="flex-grow-1" />
          <div className="px-3 pb-4 drawer-logout">
            <button
              className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={handleLogout}
            >
              <FaSignOutAlt /> Se déconnecter
            </button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Popup profil (mobile) */}
      <ProfileModal
        show={showProfile}
        onClose={() => setShowProfile(false)}
        onUpdated={() => {}}
      />
    </>
  );
}
