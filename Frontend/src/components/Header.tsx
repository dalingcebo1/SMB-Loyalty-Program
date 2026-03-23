import React from "react";
import { Link } from "react-router-dom";

export const Header: React.FC = () => (
  <header>
    <nav>
      <Link to="/">Home</Link>{" | "}
      <Link to="/services">Services</Link>{" | "}
      <Link to="/order">Book</Link>{" | "}
      <Link to="/account">Account</Link>
    </nav>
  </header>
);
