import React, { useRef, useEffect } from "react";

function StatusBar({ file, filepath, percentage, height }) {
    const filepathRef = useRef(null);

    useEffect(() => {
        filepathRef.current.scrollLeft = filepathRef.current.scrollWidth;
    });

    return (
        <div
            className="row-box"
            style={{
                fontWeight: "bold",
                height: height,
                lineHeight: height,
            }}
        >
            <div
                ref={filepathRef}
                className="row fill"
                style={{
                    overflowY: "hidden",
                    overflowX: "auto",
                    marginRight: "5px",
                    paddingLeft: ".5em",
                }}
            >
                {filepath}
            </div>
            <div
                className="row auto"
                style={{
                    width: "4em",
                    textAlign: "center",
                }}
            >
                {`${percentage}%`}
            </div>
            <div
                className="row auto"
                style={{
                    width: "10em",
                    textAlign: "center",
                }}
            >
                {file}
            </div>
        </div>
    );
}

export default StatusBar;
