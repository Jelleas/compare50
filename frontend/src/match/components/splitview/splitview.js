import React, { useState, useEffect } from "react";
import Split from "react-split";
import ReactTooltip from "react-tooltip";

import SubmissionView from "../submissionview";

import "./tooltip.css";
import "../../matchview.css";

/*
Monkey patch of React Tooltip. 
In production mouseOnToolTip returned false even with :hover set on the element.
Matching with element:hover instead of just :hover fixes the issue.
Also see: https://stackoverflow.com/questions/14795099/pure-javascript-to-check-if-something-has-hover-without-setting-on-mouseover-ou
*/
function mouseOnToolTip() {
    const { show } = this.state;

    if (show && this.tooltipRef) {
        /* old IE or Firefox work around */
        if (!this.tooltipRef.matches) {
            /* old IE work around */
            if (this.tooltipRef.msMatchesSelector) {
                this.tooltipRef.matches = this.tooltipRef.msMatchesSelector;
            } else {
                /* old Firefox work around */
                this.tooltipRef.matches = this.tooltipRef.mozMatchesSelector;
            }
        }
        return this.tooltipRef.matches(
            `${this.tooltipRef.tagName.toLowerCase()}:hover`
        );
    }
    return false;
}
ReactTooltip.prototype.mouseOnToolTip = mouseOnToolTip;

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
                clickable={true}
                delayHide={300}
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
