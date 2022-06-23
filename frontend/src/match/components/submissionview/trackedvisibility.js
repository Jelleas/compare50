import React, { useState, useRef, useEffect } from "react";

function TrackedVisibility({ id, updateVisibility, children }) {
    const [visibilityRef, entry] = useIntersect({
        threshold: Array.from(Array(100).keys(), (i) => i / 100),
    });

    useEffect(() => {
        updateVisibility(id, entry.intersectionRatio);
    }, [id, updateVisibility, entry.intersectionRatio]);

    return <span ref={visibilityRef}>{children}</span>;
}

// https://medium.com/the-non-traditional-developer/how-to-use-an-intersectionobserver-in-a-react-hook-9fb061ac6cb5
const useIntersect = ({ root = null, rootMargin, threshold = 0 }) => {
    const [entry, updateEntry] = useState({});
    const [node, setNode] = useState(null);

    const observer = useRef(
        new window.IntersectionObserver(([entry]) => updateEntry(entry), {
            root,
            rootMargin,
            threshold,
        })
    );

    useEffect(() => {
        const { current: currentObserver } = observer;
        currentObserver.disconnect();

        if (node) {
            currentObserver.observe(node);
        }

        return () => currentObserver.disconnect();
    }, [node]);

    return [setNode, entry];
};

export default TrackedVisibility;
