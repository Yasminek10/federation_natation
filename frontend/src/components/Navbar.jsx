import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaUsers,
  FaSwimmer,
  FaChartBar,
  FaSignOutAlt,
  FaHome,
  FaEnvelope,
  FaBars,
  FaBuilding,
} from "react-icons/fa";
import { Offcanvas } from "react-bootstrap";
import logo from "../assets/logo-ftn.png";
import ClubsList from "../components/Clubs";

export default function Navbar({ user }) {
  const [show, setShow] = useState(false);
  const defaultLinks = [
    { title: "Accueil", icon: <FaHome />, path: "/home" },
    { title: "Clubs", icon: <FaBuilding />, path: "/clubs" },
  ];

  const roleLinks = {
    admin: [
      { title: "Utilisateurs", icon: <FaUsers />, path: "/admin/users" },
      { title: "Minimas", icon: <FaSwimmer />, path: "/admin/minimas" },
      { title: "Résultats", icon: <FaChartBar />, path: "/admin/results" },
    ],
    coach: [
      { title: "Mes Athlètes", icon: <FaUsers />, path: "/athletes" },
      { title: "Résultats", icon: <FaChartBar />, path: "/results" },
      { title: "Minimas", icon: <FaSwimmer />, path: "/admin/minimas" },
      {
        title: "OCR Uploader",
        icon: <FaSwimmer />,
        path: "/coach/ocr-uploader",
      },
    ],
  };

  // --- Construire la liste finale ---
  const links = [
    ...defaultLinks,
    ...(roleLinks[user?.role] || []), // ajoute les liens spécifiques au rôle
  ];

  return (
    <>
      {/* --- Top Navbar --- */}
      <header className="navbar-fixed d-flex justify-content-between align-items-center px-4 py-2 bg-white shadow-sm">
        <div className="d-flex align-items-center">
          <img
            src={logo}
            alt="Logo"
            className="logo"
            style={{ height: "40px" }}
          />
          <h5 className="m-0 ms-2 fw-bold text-primary">
            Fédération Tunisienne de Natation
          </h5>
        </div>

        {/* Liens visibles uniquement en desktop */}
        <nav className="d-none d-lg-flex align-items-center gap-4">
          {links.map((link, i) => (
            <Link
              key={i}
              to={link.path}
              className="nav-link d-flex align-items-center gap-1"
            >
              {link.icon} {link.title}
            </Link>
          ))}
        </nav>

        {/* Hamburger pour mobile */}
        <button className="btn d-lg-none" onClick={() => setShow(true)}>
          <FaBars size={24} />
        </button>
      </header>

      {/* --- Drawer / Offcanvas --- */}
      <Offcanvas
        show={show}
        onHide={() => setShow(false)}
        className="swim-drawer"
      >
        <Offcanvas.Header closeButton className="drawer-header">
          <Offcanvas.Title className="text-white d-flex align-items-center">
            <img
              src={logo}
              alt="Logo"
              style={{ height: "32px" }}
              className="me-2 rounded-circle bg-white p-1"
            />
            <span>Menu</span>
          </Offcanvas.Title>
        </Offcanvas.Header>

        <Offcanvas.Body className="p-0">
          <nav className="drawer-links">
            {links.map((link, i) => (
              <Link
                key={i}
                to={link.path}
                className="drawer-item d-flex align-items-center gap-2"
              >
                {link.icon} {link.title}
              </Link>
            ))}
          </nav>

          {/* Divider */}
          <hr className="my-2" />

          {/* Profile Section */}
          <div className="drawer-profile px-3 py-2">
            <div className="d-flex align-items-center">
              <div className="profile-avatar me-2">
                {user?.name ? user.name[0].toUpperCase() : "A"}
              </div>
              <div>
                <strong>{user?.name || "Utilisateur"}</strong>
                <div className="small text-muted">
                  {user?.email || "user@ftn.tn"}
                </div>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="px-3 py-2">
            <button className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2">
              <FaSignOutAlt /> Se déconnecter
            </button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
