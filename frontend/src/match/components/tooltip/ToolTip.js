import React, { useState, useEffect } from "react";
import ReactTooltip from "react-tooltip";
import "./tooltip.css";

const ToolTipContext = React.createContext({
    tooltip: null,
    id: null,
    setContent: null,
});

function ToolTip({ similarities, id, children }) {
    const [content, setContent] = useState(null);

    const tooltip = (
        <ReactTooltip
            place="left"
            type="info"
            effect="solid"
            id={id}
            clickable={true}
            delayHide={300}
            getContent={(region) => {
                if (region === null) {
                    // TODO regions without explanation should not have a tooltip
                    return "";
                }
                return similarities.getExplanations(JSON.parse(region))[0]
                    .leadingExplanation.text;
            }}
        >
            {content}
        </ReactTooltip>
    );

    // https://www.npmjs.com/package/react-tooltip
    // Use ReactTooltip.rebuild() to rebind the tooltip to new content
    useEffect(() => {
        if (similarities.pass !== undefined) ReactTooltip.rebuild();
    }, [similarities.pass]);

    return (
        <ToolTipContext.Provider
            value={{
                tooltip: tooltip,
                id: id,
                setContent: setContent,
            }}
        >
            {tooltip}
            {children}
        </ToolTipContext.Provider>
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

export default ToolTip;
export { ToolTipContext };
