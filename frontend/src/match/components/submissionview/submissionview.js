import React, { useState, useRef, useCallback, useEffect } from "react";

import File from "../file";
import StatusBar from "./statusbar";
import ExplanationTooltip from "../explanationTooltip";
import TrackedVisibility from "./trackedvisibility";
import useScroll from "./useScroll";

function throttle(callbackFn, limit) {
    let wait = false;
    return function () {
        if (!wait) {
            callbackFn.call();
            wait = true;
            setTimeout(function () {
                wait = false;
            }, limit);
        }
    };
}

function SubmissionView({
    submission,
    files,
    isInteractionBlocked,
    setIsInteractionBlocked,
    similarities,
    dispatchSimilarities,
    settings,
    toolTipPlace,
    setHeight,
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
        ref.current,
        similarities,
        () => setIsInteractionBlocked(true),
        () => setIsInteractionBlocked(false)
    );

    // useEffect(() => {
    //     const listener = (event) => {
    //         var body = document.body,
    //             html = document.documentElement;

    //         var height = Math.max(
    //             body.scrollHeight,
    //             body.offsetHeight,
    //             html.clientHeight,
    //             html.scrollHeight,
    //             html.offsetHeight
    //         );

    //         console.log(
    //             window.pageYOffset,
    //             window.innerHeight,
    //             height,
    //             event.target
    //         );
    //         if (window.pageYOffset + window.innerHeight !== height) {
    //             ref.current.style.overflow = "hidden";
    //         } else {
    //             ref.current.style.overflow = "scroll";
    //         }
    //         console.log(ref.current.style.overflow);
    //     };
    //     document.addEventListener("scroll", listener);

    //     return () => document.removeEventListener("scroll", listener);
    // }, [ref.current]);

    return (
        <ExplanationTooltip
            similarities={similarities}
            files={files}
            id={`submission_${submission.id}_tooltip`}
            place={toolTipPlace}
        >
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
                    style={{
                        overflow: "scroll",
                        overscrollBehavior: "auto",
                    }}
                    onScroll={throttle((event) => {
                        console.log(ref.current.scrollTop);
                        const el = document.querySelector("#foo2");
                        setHeight(Math.max(0, 300 - ref.current.scrollTop * 2));
                        el.style.height = `${300 - ref.current.scrollTop}px`;
                        console.log(el.style.height);
                    }, 20)}
                >
                    <div
                        id="foo2"
                        className="row auto"
                        style={{ height: "300px" }}
                    ></div>
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
                                    settings={settings}
                                    updateCoverage={(coverage) => {
                                        fileCoverages[file.id] = coverage;
                                        setFileCoverages(fileCoverages);
                                    }}
                                    scrollTo={scrollToCallback}
                                    isInteractionBlocked={isInteractionBlocked}
                                />
                            </TrackedVisibility>
                        ))}
                        <div style={{ height: "75vh" }}></div>
                    </div>
                </div>
            </div>
        </ExplanationTooltip>
    );
}

SubmissionView.defaultProps = {
    toolTipPlace: "left",
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

            setMaxItem(newMaxItem);
        },
        [setMaxItem]
    );

    return [maxItem, update];
}

export default SubmissionView;
