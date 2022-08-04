import React, { useState } from "react";
import Split from "react-split";

import SubmissionView from "../submissionview";

import "../../matchview.css";

function SplitView({ similarities, dispatchSimilarities, onScroll }) {
    const [isInteractionBlocked, setIsInteractionBlocked] = useState(false);
    const match = similarities.match;

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
            {[match.subA, match.subB].map((sub, i) => (
                <div
                    key={`side_${i}`}
                    style={{ height: "100%", margin: 0, float: "left" }}
                >
                    <SubmissionView
                        submission={sub}
                        files={sub.files}
                        isInteractionBlocked={isInteractionBlocked}
                        setIsInteractionBlocked={setIsInteractionBlocked}
                        similarities={similarities}
                        dispatchSimilarities={dispatchSimilarities}
                        onScroll={onScroll}
                        toolTipPlace={i === 0 ? "right" : "left"}
                    />
                </div>
            ))}
        </Split>
    );
}

export default SplitView;
