import React from "react";
import useNavigateToIndex from "./hooks/useNavigateToIndex";

function Logo(props) {
    const navigateToIndex = useNavigateToIndex();
    return (
        <div
            onClick={() => navigateToIndex()}
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
