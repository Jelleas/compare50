import React, { useState, useRef, useCallback } from "react";

import File from "../file";
import StatusBar from "./statusbar";
import TrackedVisibility from "./trackedvisibility";
import useScroll from "./useScroll";

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
        ref.current,
        similarities,
        () => setIsInteractionBlocked(true),
        () => setIsInteractionBlocked(false)
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

export default SubmissionView;
