// src/components/DownloadMenu.jsx
import React, { useMemo, useState } from "react";
import { Button, Spinner } from "react-bootstrap";
import html2pdf from "html2pdf.js";

/**
 * DownloadButton (file name kept as DownloadMenu.jsx)
 * - Single button to export fixed sections you pass in `selections`.
 */
export default function DownloadButton({
  selections = [],
  filename = "export",
  options = {},
  buttonLabel = "Télécharger en PDF",
  variant = "primary",
  size = "sm",
}) {
  const [working, setWorking] = useState(false);

  const defaultOpts = useMemo(
    () => ({
      margin: [10, 10, 10, 10],
      filename: `${filename}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollY: 0,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        before: ".pdf-pagebreak",
      },
      ...options,
    }),
    [filename, options]
  );

  // Build a renderable staging container and clone sections into it
  const buildStaging = async () => {
    const staging = document.createElement("div");
    staging.setAttribute("id", "download-staging");

    // Keep it renderable to layout engine (NOT display:none / visibility:hidden).
    // Use opacity + pointer-events to keep it invisible and non-interactive.
    staging.style.position = "fixed";
    staging.style.left = "0";
    staging.style.top = "0";
    staging.style.width = "794px"; // ~A4 width @96dpi
    staging.style.background = "#fff";
    staging.style.padding = "0";
    staging.style.opacity = "0";
    staging.style.pointerEvents = "none";
    staging.style.zIndex = "-1";

    const style = document.createElement("style");
    style.innerHTML = `
      .pdf-pagebreak { page-break-before: always; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      /* Force ALL Bootstrap accordions to be open in the clone */
      .accordion .collapse { display: block !important; height: auto !important; visibility: visible !important; }
      .accordion-button::after { display: none !important; }

      /* Neutralize sticky to avoid clipping in snapshots */
      [style*="position: sticky"], .sticky-top { position: static !important; top: auto !important; }
    `;
    staging.appendChild(style);

    selections.forEach((sel, idx) => {
      const src = document.querySelector(sel.selector);
      if (!src) return;

      const wrapper = document.createElement("div");

      const h = document.createElement("h3");
      h.textContent = sel.label;
      h.style.margin = "12px 0 8px";

      // Deep clone the section
      const clone = src.cloneNode(true);

      // --- CRUCIAL FIXES: make the clone visible ---
      // If your tab wrappers have inline display:none, remove/override it.
      if (clone.getAttribute("style")) {
        clone.style.removeProperty("display");
        clone.style.removeProperty("visibility");
      }
      clone.style.display = "block";
      clone.style.visibility = "visible";

      // Also ensure any immediate children accidentally styled with display:none are shown.
      clone.querySelectorAll('[style*="display: none"]').forEach((n) => {
        n.style.removeProperty("display");
      });

      // Remove elements explicitly marked as "no export"
      clone.querySelectorAll("[data-noexport='true']").forEach((n) => n.remove());

      wrapper.appendChild(h);
      wrapper.appendChild(clone);
      staging.appendChild(wrapper);

      if (idx < selections.length - 1) {
        const br = document.createElement("div");
        br.className = "pdf-pagebreak";
        staging.appendChild(br);
      }
    });

    document.body.appendChild(staging);

    // Allow layout to flush before capture
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 0));

    return staging;
  };

  const downloadPDF = async () => {
    if (!selections.length) return;
    setWorking(true);
    let staging;
    try {
      staging = await buildStaging();

      const hasContent = staging.querySelector("*");
      const hasHeight = staging.scrollHeight > 0;
      if (!hasContent || !hasHeight) {
        staging.remove();
        setWorking(false);
        alert("Aucune section trouvée pour l’export. Vérifiez les sélecteurs/IDs.");
        return;
      }

      const hcOpts = {
        ...defaultOpts.html2canvas,
        windowWidth: staging.scrollWidth || 1200,
        windowHeight:
          staging.scrollHeight ||
          document.documentElement.scrollHeight ||
          2000,
      };

      await html2pdf()
        .set({ ...defaultOpts, html2canvas: hcOpts })
        .from(staging)
        .save();
    } catch (e) {
      console.error("Export PDF error:", e);
      alert("Échec de la génération du PDF.");
    } finally {
      if (staging && staging.parentNode) staging.parentNode.removeChild(staging);
      setWorking(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={working || !selections.length}
      onClick={downloadPDF}
    >
      {working ? <Spinner size="sm" animation="border" /> : buttonLabel}
    </Button>
  );
}
