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

function Summary({ visible, hide, show }) {
    const ref = useRef();
    useClickOutsideElement(ref.current, hide);

    const tabRef = useRef();

    useEffect(() => {
        tabRef.current.style.position = "absolute";

        if (ref.current === null) {
            return;
        }

        const summaryRect = ref.current.getBoundingClientRect();
        const tabRect = tabRef.current.getBoundingClientRect();
        const summaryMiddle = (summaryRect.left + summaryRect.right) / 2;
        const tabWidth = tabRect.right - tabRect.left;
        tabRef.current.style.left = `${summaryMiddle - tabWidth / 2}px`;
    });

    useEffect(() => {
        const eventListener = (event) => {
            if (event.key.toLowerCase() === "s") {
                event.preventDefault();
                tabRef.current.click();
            }
        };

        document.addEventListener("keyup", eventListener);

        return () => document.removeEventListener("keyup", eventListener);
    }, []);

    return (
        <>
            <CSSTransition
                in={visible}
                timeout={400}
                classNames="summary"
                nodeRef={ref}
                style={{ background: "#EEEEEE" }}
            >
                <div ref={ref} className="summary">
                    <div className="summaryContent"></div>
                </div>
            </CSSTransition>
            <div
                style={{
                    background: "#EEEEEE",
                    border: "solid 1px #EEEEEE",
                    width: "100%",
                    height: "7px",
                    cursor: "pointer",
                }}
                onClick={show}
            >
                <div
                    ref={tabRef}
                    style={{
                        background: "#EEEEEE",
                        border: "solid 1px #EEEEEE",
                        borderRadius: "5px",
                        align: "center",
                    }}
                    data-tip={`Press S`}
                    data-for="sidebar-tooltip"
                    data-place="bottom"
                >
                    {visible ? "⬆" : "⬇"}
                </div>
            </div>
        </>
    );
}

export default Summary;
