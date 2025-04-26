import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";  // if using Tailwind, this imports its directives

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
