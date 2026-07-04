import "./index.css";
import "./storage.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GestionPersonnel from "./GestionPersonnel.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GestionPersonnel />
  </StrictMode>
);
