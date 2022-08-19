import React, { useState } from "react";
import Split from "react-split";

import SubmissionView from "../submissionview";

import "../../matchview.css";

function SplitView({ settings, similarities, dispatchSimilarities }) {
    const [isInteractionBlocked, setIsInteractionBlocked] = useState(false);
    const match = similarities.match;

    const splitSizes = match.submissions.map(
        () => 100 / match.submissions.length
    );

    return (
        <Split
            sizes={splitSizes}
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
            {match.submissions.map((sub, i) => (
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
                        settings={settings}
                        toolTipPlace={i === 0 ? "right" : "left"}
                    />
                </div>
            ))}
        </Split>
    );
}

export default SplitView;
