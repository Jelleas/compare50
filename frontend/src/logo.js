import React from "react";
import { useNavigate } from "react-router-dom";

function Logo(props) {
    const navigate = useNavigate();
    return (
        <div
            onClick={() => navigate("/")}
            style={{
                fontWeight: "bold",
                width: "100%",
                height: props.height,
                lineHeight: props.height,
                textAlign: "center",
                cursor: "pointer",
            }}
        >
            compare50
        </div>
    );
}

export default Logo;
