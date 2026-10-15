import React, { useState } from "react";
import {
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink,
  NavbarText,
  Button,
} from "reactstrap";
import { useNavigate } from "react-router-dom";

function Header(props) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggle = () => setIsOpen(!isOpen);

  const handleLogout = () => {
    localStorage.removeItem("sevakDetails");
    navigate("/");
  };
  const handleSevakView = () => {
    navigate("/annkut-sevak-list");
    // props.setSevakView(!props.sevakView);
  };

  const handleView = () => {
    navigate("/home");
    // props.setSevakView(!props.sevakView);
  };

  const sevakDetails = JSON.parse(localStorage.getItem("sevakDetails"));
  const role = sevakDetails.role;

  return (
    <div>
      <Navbar
        style={{ background: "#ED3237", marginBottom: "7px", zIndex: 1000 }}
      >
        <NavbarBrand style={{ color: "#ffffff" }} href="/">
          Annkut 2026
        </NavbarBrand>
        <NavbarToggler style={{ background: "#ffffff" }} onClick={toggle} />
        <Collapse isOpen={isOpen} navbar>
          <Nav className="me-auto" navbar>
            {role !== "Annkut Sevak" && (
              <div>
                <NavItem style={{ margin: "5px" }}>
                  <Button color="warning" onClick={handleView}>
                    Annkut Seva
                  </Button>
                </NavItem>
                <NavItem style={{ margin: "5px" }}>
                  <Button color="primary" onClick={handleSevakView}>
                    Annkut Sevak list
                  </Button>
                </NavItem>
                {/* 🔥 NEW NavItem for Receipt Books page */}
                <NavItem style={{ margin: "5px" }}>
                  <Button
                    color="success"
                    onClick={() => navigate("/receipt-books")}
                  >
                    Receipt Books
                  </Button>
                </NavItem>
              </div>
            )}

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
          </Nav>
        </Collapse>
      </Navbar>
    </div>
  );
}

export default Header;
