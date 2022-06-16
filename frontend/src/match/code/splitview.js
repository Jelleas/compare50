import React, { useState, useRef, useEffect, useCallback } from "react";
import Split from "react-split";

import File from "./file";

import "../matchview.css";
import "../../split.css";

function SplitView({
    settings,
    matchData,
    similarities,
    dispatchSimilarities,
    topHeight,
}) {
    const [interactionBlocked, setInteractionBlocked] = useState(false);
    const match = matchData.match;

    return (
        <Split
            sizes={[50, 50]}
            gutterSize={10}
            gutterAlign="center"
            snapOffset={30}
            dragInterval={1}
            direction="horizontal"
            cursor="col-resize"
            style={{
                height: "100%",
            }}
        >
            {[
                [match.filesA(), match.subA],
                [match.filesB(), match.subB],
            ].map(([files, sub], i) => (
                <div
                    key={`side_${i}`}
                    style={{ height: "100%", margin: 0, float: "left" }}
                >
                    <Side
                        submission={sub}
                        files={files}
                        isInteractionBlocked={interactionBlocked}
                        setInteractionBlocked={setInteractionBlocked}
                        similarities={similarities}
                        dispatchSimilarities={dispatchSimilarities}
                        settings={settings}
                        topHeight={topHeight}
                    />
                </div>
            ))}
        </Split>
    );
}

function Side({
    submission,
    files,
    isInteractionBlocked,
    setIsInteractionBlocked,
    similarities,
    dispatchSimilarities,
    settings,
    topHeight,
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
                    height={topHeight}
                />
            </div>
            <div
                ref={ref}
                className="scrollable-side row fill"
                style={{ overflow: "scroll" }}
            >
                <div style={{ paddingLeft: ".5em" }}>
                    {files.map((file, i) => (
                        <File
                            key={file.name}
                            file={file}
                            similarities={similarities}
                            softWrap={settings.isSoftWrapped}
                            hideIgnored={settings.isIgnoredHidden}
                            showWhiteSpace={!settings.isWhiteSpaceHidden}
                            updateFileVisibility={updateFileVisibility}
                            updateCoverage={(coverage) => {
                                fileCoverages[file.id] = coverage;
                                setFileCoverages(fileCoverages);
                            }}
                            scrollTo={scrollToCallback}
                            interactionBlocked={isInteractionBlocked}
                        />
                    ))}
                    <div style={{ height: "75vh" }}></div>
                </div>
            </div>
        </div>
    );
}

function StatusBar(props) {
    const filepathRef = useRef(null);

    useEffect(() => {
        filepathRef.current.scrollLeft = filepathRef.current.scrollWidth;
    });

    return (
        <div
            className="row-box"
            style={{
                fontWeight: "bold",
                height: props.height,
                lineHeight: props.height,
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
                {props.filepath}
            </div>
            <div
                className="row auto"
                style={{
                    width: "4em",
                    textAlign: "center",
                }}
            >
                {`${props.percentage}%`}
            </div>
            <div
                className="row auto"
                style={{
                    width: "10em",
                    textAlign: "center",
                }}
            >
                {props.file}
            </div>
        </div>
    );
}

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

export default SplitView;
