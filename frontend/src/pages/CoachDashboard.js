import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { FaUsers, FaTrophy, FaUpload } from "react-icons/fa";

export default function CoachDashboard({ user }) {
  const features = [
    { title: "Mes Athlètes", icon: <FaUsers />, path: "/athletes", color: "text-blue-600" },
    { title: "Résultats", icon: <FaTrophy />, path: "/results", color: "text-yellow-500" },
    { title: "OCR Uploader", icon: <FaUpload />, path: "/coach/ocr-uploader", color: "text-green-600" },
  ];

  return (
    <section className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      {/* Header */}
      <div className="text-center py-10">
        <h1 className="text-3xl font-bold text-gray-800">Tableau de bord Coach</h1>
        <p className="text-gray-500 mt-2">Accédez rapidement à vos fonctionnalités</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto px-6">
        {features.map((f, i) => (
          <Link to={f.path} key={i} className="group">
            <div className="bg-white shadow-md rounded-2xl p-8 flex flex-col items-center justify-center 
              hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-200">
              
              <div className={`text-5xl mb-4 ${f.color} group-hover:scale-110 transition-transform`}>
                {f.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                {f.title}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
