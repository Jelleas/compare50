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
    const ref = useRef();
    useClickOutsideElement(ref.current, hide);

    const tabRef = useRef();

    useEffect(() => {
        tabRef.current.style.position = "absolute";

        if (ref.current === null) {
            return;
        }

        const rect = ref.current.getBoundingClientRect();
        tabRef.current.style.left = `${(rect.left + rect.right) / 2}px`;
    });

    return (
        <>
            <CSSTransition
                in={visible}
                timeout={600}
                classNames="summary"
                unmountOnExit
                nodeRef={ref}
                style={{ background: "red" }}
            >
                <div ref={ref} className="summary">
                    <div className="summaryContent"></div>
                </div>
            </CSSTransition>
            <div
                style={{
                    border: "solid 1px black",
                    width: "100%",
                    height: "10px",
                }}
            >
                <div ref={tabRef}>Summary</div>
            </div>
        </>
    );
}

export default Summary;
