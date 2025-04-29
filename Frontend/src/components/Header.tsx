import React from "react";
import { Link } from "react-router-dom";

export const Header: React.FC = () => (
  <header>
    <nav>
      <Link to="/">Home</Link>{" | "}
      <Link to="/services">Services</Link>{" | "}
      <Link to="/cart">Cart</Link>{" | "}
      <Link to="/staff">Staff</Link>
    </nav>
  </header>
);
