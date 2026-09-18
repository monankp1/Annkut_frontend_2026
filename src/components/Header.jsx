import React, { useState } from "react";
import {
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  Button,
} from "reactstrap";
import { useNavigate } from "react-router-dom";
import api from "../api/annkut";
import {
  getSevak,
  hasMandalScope,
  canAssignBook,
  postLabel,
  parivarCode,
} from "../api/session";

function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggle = () => setIsOpen(!isOpen);

  // May be absent for a moment on a cold reload, so nothing here may assume it.
  const sevak = getSevak();
  // Reading a mandal's sevaks needs scope. Handling its books needs a
  // permission on top — a Sant or Sah Nirdeshak has the scope but cannot issue
  // or take back anything, so the books screen would be inert for them.
  const scoped = hasMandalScope(sevak);
  const handlesBooks = canAssignBook(sevak);
  const post = postLabel(sevak);
  const sevakId = sevak?.sevak_id || null;
  // The family code, shown in brackets after the title. A sant belongs to no
  // parivar, so there is nothing to bracket.
  const parivar = parivarCode(sevak);

  const handleLogout = async () => {
    await api.logout();
    navigate("/", { replace: true });
  };

  return (
    <div>
      <Navbar
        style={{ background: "#ED3237", marginBottom: "7px", zIndex: 1000 }}
      >
        <NavbarBrand style={{ color: "#ffffffff" }} href="/home">
          Annkut Sevak 2026{parivar ? ` (${parivar})` : ""}
        </NavbarBrand>

        <NavbarToggler style={{ background: "#ffffff" }} onClick={toggle} />

        <Collapse isOpen={isOpen} navbar>
          <Nav className="me-auto" navbar>
            <NavItem style={{ margin: "5px" }}>
              <Button color="warning" onClick={() => navigate("/home")}>
                Annkut Seva
              </Button>
            </NavItem>

            {/* Needs a mandal in scope; the server answers 403 for anyone
                else, so there would be nothing to show. */}
            {scoped && (
              <NavItem style={{ margin: "5px" }}>
                <Button
                  color="primary"
                  onClick={() => navigate("/annkut-sevak-list")}
                >
                  Annkut Sevak list
                </Button>
              </NavItem>
            )}

            {/* Books need book.assign on top of scope — admin and sanchalak. */}
            {handlesBooks && (
              <NavItem style={{ margin: "5px" }}>
                <Button
                  color="secondary"
                  onClick={() => navigate("/receipt-books")}
                >
                  Manage Receipt Books
                </Button>
              </NavItem>
            )}
            {sevakId === "ADMIN26" && (
              <NavItem style={{ margin: "5px" }}>
                <Button color="info" onClick={() => navigate("/book-lookup")}>
                  Find a Book
                </Button>
              </NavItem>
            )}

            <NavItem style={{ margin: "5px" }}>
              <Button
                color="light"
                onClick={() => navigate("/change-password")}
              >
                Change Password
              </Button>
            </NavItem>

            <NavItem style={{ margin: "5px" }}>
              <Button
                style={{
                  background: "#ffffff",
                  color: "black",
                  fontWeight: "bold",
                }}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </NavItem>

            {sevak && (
              <NavItem
                style={{
                  margin: "5px",
                  color: "#ffffff",
                  fontSize: 13,
                  alignSelf: "center",
                }}
              >
                {sevak.name} · {sevak.sevak_id}
                {post ? ` · ${post}` : ""}
                {/* null for sants and some senior karyakars */}
                {sevak.mandal?.name ? ` · ${sevak.mandal.name}` : ""}
              </NavItem>
            )}
          </Nav>
        </Collapse>
      </Navbar>
    </div>
  );
}

export default Header;
