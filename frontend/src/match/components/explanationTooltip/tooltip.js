import React, { useCallback, useEffect } from "react";
import ReactTooltip from "react-tooltip";
import "./tooltip.css";

import ExplanationsView from "./explanation";

const ExplanationTooltipContext = React.createContext((region) => {
    return { "data-tip": "", "data-for": "", "data-place": "" };
});

function ExplanationTooltip({ similarities, files, id, children }) {
    const tooltip = (
        <ReactTooltip
            place="left"
            type="dark"
            effect="solid"
            id={id}
            clickable={true}
            delayHide={300}
            getContent={(region) => {
                if (region === null) {
                    // TODO regions without explanation should not have a tooltip
                    return "";
                }

                region = JSON.parse(region);
                const explanations = similarities.getExplanations(region);

                // If there are no explanations, show nothing
                // This can happen if one pass with explanations shows the tooltip,
                // and a following pass has no explanations, but the tooltip still exists
                if (explanations.length === 0) {
                    return "";
                }

                const file = files.find((file) => file.id === region.fileId);

                return (
                    <ExplanationsView
                        explanations={explanations}
                        file={file}
                        similarities={similarities}
                    />
                );
            }}
        ></ReactTooltip>
    );

    // https://www.npmjs.com/package/react-tooltip
    // Use ReactTooltip.rebuild() to rebind the tooltip to new content
    useEffect(() => {
        if (similarities.pass !== undefined) ReactTooltip.rebuild();
    }, [similarities.pass]);

    const getToolTipProps = useCallback(
        (region) => {
            return {
                "data-tip": JSON.stringify(region),
                "data-for": id,
                "data-place": "left",
            };
        },
        [id]
    );

    return (
        <ExplanationTooltipContext.Provider value={getToolTipProps}>
            {tooltip}
            {children}
        </ExplanationTooltipContext.Provider>
    );
}

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

export default ExplanationTooltip;
export { ExplanationTooltipContext };
