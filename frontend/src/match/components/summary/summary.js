import React, { useRef, useEffect } from "react";

import { CSSTransition } from "react-transition-group";

import "./summary.css";

function useClickOutsideElement(elem, callback) {
    useEffect(() => {
        const listener = (event) => {
            if (elem === null) {
                return;
            }
            if (!elem.contains(event.target)) {
                callback();
            }
        };
        document.addEventListener("click", listener);
        return () => document.removeEventListener("click", listener);
    });
}

function Summary({ visible, hide }) {
    const contentRef = useRef();
    useClickOutsideElement(contentRef.current, hide);

    return (
        <CSSTransition
            in={visible}
            appear={true}
            timeout={600}
            unmountOnExit
            classNames="summary"
            nodeRef={contentRef}
            style={{ background: "red", height: "300px" }}
        >
            <div ref={contentRef}>{"hello world"}</div>
        </CSSTransition>
    );
}

export default Summary;
