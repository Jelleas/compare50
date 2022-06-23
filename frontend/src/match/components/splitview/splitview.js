import React, { useState, useEffect } from "react";
import Split from "react-split";
import ReactTooltip from "react-tooltip";

import SubmissionView from "../submissionview";

import "../../matchview.css";

function SplitView({ settings, similarities, dispatchSimilarities }) {
    const [isInteractionBlocked, setIsInteractionBlocked] = useState(false);
    const match = similarities.match;

    // https://www.npmjs.com/package/react-tooltip
    // Use ReactTooltip.rebuild() to rebind the tooltip to new content
    useEffect(() => {
        if (similarities.pass !== undefined) ReactTooltip.rebuild();
    }, [similarities.pass]);

    return (
        <>
            <ReactTooltip
                place="left"
                type="info"
                effect="solid"
                id="splitview-tooltip"
            />
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
                            settings={settings}
                        />
                    </div>
                ))}
            </Split>
        </>
    );
}

export default SplitView;
