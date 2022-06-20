import React, { useState, useRef, useEffect, useCallback } from "react";

import File from "../file";
import StatusBar from "./statusbar";

function SubmissionView({
    submission,
    files,
    isInteractionBlocked,
    setIsInteractionBlocked,
    similarities,
    dispatchSimilarities,
    settings,
}) {
    const [fileInView, updateFileVisibility] = useMax();

    const [fileCoverages, setFileCoverages] = useState({});

    const numMatchedChars = Object.values(fileCoverages).reduce(
        (acc, { numMatchedChars }) => acc + numMatchedChars,
        0
    );
    const numChars = Object.values(fileCoverages).reduce(
        (acc, { numChars }) => acc + numChars,
        0
    );
    const submissionPercentage = ((numMatchedChars / numChars) * 100).toFixed(
        0
    );

    const ref = useRef(null);

    const scrollToCallback = useScroll(
        ref,
        similarities,
        setIsInteractionBlocked
    );

    return (
        <div className="column-box">
            <div className="row auto">
                <StatusBar
                    filepath={submission.name}
                    percentage={submissionPercentage}
                    file={fileInView}
                    height={"2.5em"}
                />
            </div>
            <div
                ref={ref}
                className="scrollable-side row fill"
                style={{ overflow: "scroll" }}
            >
                <div style={{ paddingLeft: ".5em" }}>
                    {files.map((file) => (
                        <TrackedVisibility
                            key={file.name}
                            id={file.name}
                            updateVisibility={updateFileVisibility}
                        >
                            <File
                                key={file.name}
                                file={file}
                                similarities={similarities}
                                dispatchSimilarities={dispatchSimilarities}
                                softWrap={settings.isSoftWrapped}
                                hideIgnored={settings.isIgnoredHidden}
                                showWhiteSpace={!settings.isWhiteSpaceHidden}
                                updateCoverage={(coverage) => {
                                    fileCoverages[file.id] = coverage;
                                    setFileCoverages(fileCoverages);
                                }}
                                scrollTo={scrollToCallback}
                                interactionBlocked={isInteractionBlocked}
                            />
                        </TrackedVisibility>
                    ))}
                    <div style={{ height: "75vh" }}></div>
                </div>
            </div>
        </div>
    );
}

function TrackedVisibility({ id, updateVisibility, children }) {
    const [visibilityRef, entry] = useIntersect({
        threshold: Array.from(Array(100).keys(), (i) => i / 100),
    });

    const _updateFileVisibility = updateVisibility;
    useEffect(() => {
        _updateFileVisibility(id, entry.intersectionRatio);
    }, [id, _updateFileVisibility, entry.intersectionRatio]);

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

function useMax() {
    const [maxItem, setMaxItem] = useState(undefined);

    const values = useRef({});

    // Callback for when the value of an item changes
    const update = useCallback(
        (item, value) => {
            values.current[item] = value;

            // Find the item with the highest value
            let newMaxItem = item;
            let newMaxValue = 0;
            Object.entries(values.current).forEach(([item, value]) => {
                if (value > newMaxValue) {
                    newMaxItem = item;
                    newMaxValue = value;
                }
            });

            // If the item with the highest value is different from the last, update maxItem
            if (newMaxItem !== maxItem) {
                setMaxItem(newMaxItem);
            }
        },
        [maxItem]
    );

    return [maxItem, update];
}

function useScroll(scrollableRef, similarities, setInteractionBlocked) {
    const didScroll = useRef(false);

    const highlightedSpans = similarities
        .highlightedSpans()
        .map((span) => span.id);
    const prevHighlightedSpans = useRef(highlightedSpans);

    const highlightChanged =
        highlightedSpans.length !== prevHighlightedSpans.current.length ||
        highlightedSpans.some((s, i) => s !== prevHighlightedSpans.current[i]);

    // In case the highlighted spans changed, re-enable scrolling
    if (highlightChanged) {
        didScroll.current = false;
        prevHighlightedSpans.current = highlightedSpans;
    }

    const scrollToCallback = useCallback(
        (domElement) => {
            if (didScroll.current) {
                return;
            }
            didScroll.current = true;
            scrollTo(domElement, scrollableRef.current, setInteractionBlocked);
        },
        [scrollableRef, setInteractionBlocked]
    );

    return scrollToCallback;
}

function findPos(domElement) {
    let obj = domElement;
    let curtop = 0;
    if (obj.offsetParent) {
        do {
            curtop += obj.offsetTop;
            obj = obj.offsetParent;
        } while (obj);
    }
    return curtop;
}

// Custom implementation/hack of element.scrollIntoView();
// Because safari does not support smooth scrolling @ July 27 2018
// Update @ July 29 2020, still no smooth scrolling in Safari
// Feel free to replace once it does:
//     this.dom_element.scrollIntoView({"behavior":"smooth"});
// Also see: https://github.com/iamdustan/smoothscroll
// Credits: https://gist.github.com/andjosh/6764939
function scrollTo(
    domElement,
    scrollable = document,
    setInteractionBlock = (block) => {},
    offset = 200
) {
    let easeInOutQuad = (t, b, c, d) => {
        t /= d / 2;
        if (t < 1) return (c / 2) * t * t + b;
        t--;
        return (-c / 2) * (t * (t - 2) - 1) + b;
    };

    let to = findPos(domElement) - offset;

    let start = scrollable.scrollTop;
    let change = to - start;
    let duration = Math.min(300, Math.max(Math.abs(change), 40));
    let currentTime = 0;
    let increment = 20;

    let animateScroll = () => {
        currentTime += increment;
        let val = easeInOutQuad(currentTime, start, change, duration);

        scrollable.scrollTop = val;
        if (currentTime < duration) {
            setTimeout(animateScroll, increment);
        } else {
            setInteractionBlock(false);
        }
    };

    setInteractionBlock(true);
    animateScroll();
}

export default SubmissionView;
