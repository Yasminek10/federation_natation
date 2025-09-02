import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { FaUsers, FaTrophy, FaUpload } from "react-icons/fa";

export default function CoachDashboard({ user }) {


  return (
    <section className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      {/* Header */}
      <div className="text-center py-10">
        <h1 className="text-3xl font-bold text-gray-800">Tableau de bord Coach</h1>
        <p className="text-gray-500 mt-2">Accédez rapidement à vos fonctionnalités</p>
      </div>

    </section>
  );
}
