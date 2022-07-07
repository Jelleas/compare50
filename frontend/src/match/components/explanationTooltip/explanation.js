import React, { useContext, useState, useEffect } from "react";
import "react-virtualized/styles.css";
import { List, CellMeasurer, CellMeasurerCache } from "react-virtualized";

import useFragments from "../../hooks/useFragments";
import { SettingsContext } from "../../hooks/useSettings";
import { replaceLeadingWhitespace } from "../file/file";

function ExplanationsView({ explanations, file, similarities, lineNumber }) {
    const windowDimensions = useWindowDimensions();

    const explanation = explanations[0];

    const spans = explanation.explanations.map((exp) => exp.span);

    // Find the entire region of this explanation
    const encompassingRegion = spans.reduce((span, region) => {
        return {
            start: Math.min(span.start, region.start),
            end: Math.max(span.end, region.end),
            fileId: span.fileId,
        };
    }, spans[0]);

    // Get all ignored spans that overlap with the region of this explanation
    const overlaps = (region, otherRegion) =>
        !(region.end < otherRegion.start || region.start > otherRegion.end);
    const ignoredSpans = similarities.ignoredSpans
        .filter((span) => span.fileId === file.id)
        .filter((span) => overlaps(span, encompassingRegion));

    // Find all regions of newlines, this will create a fragment for each newline
    const newLineRegions = getNewLineRegions(file, encompassingRegion);

    let fragments = useFragments(
        file,
        spans,
        newLineRegions.concat(ignoredSpans)
    );

    // Filter any fragments that are not in the region of this explanation
    fragments = fragments.filter(
        (frag) =>
            frag.start >= encompassingRegion.start &&
            frag.end <= encompassingRegion.end
    );

    // Assign an explanation to each fragment
    const fragToExp = new Map();
    explanation.explanations.forEach((exp) => {
        fragments.forEach((frag) => {
            if (frag.start >= exp.span.start && frag.end <= exp.span.end) {
                let e = exp;
                if (fragToExp.has(frag)) {
                    const other_exp = fragToExp.get(frag);
                    e = exp.weight > other_exp.weight ? exp : other_exp;
                }
                fragToExp.set(frag, e);
            }
        });
    });

    // Group all fragments on the same line
    const fragmentsPerLine = [[]];
    fragments.forEach((frag) => {
        fragmentsPerLine[fragmentsPerLine.length - 1].push(frag);

        if (frag.text.endsWith("\n")) {
            fragmentsPerLine.push([]);
        }
    });
    if (fragmentsPerLine[fragmentsPerLine.length - 1].length === 0) {
        fragmentsPerLine.pop();
    }

    const cache = new CellMeasurerCache({
        defaultWidth: 15,
        minHeight: 15,
        fixedWidth: true,
    });

    const rowRenderer = ({ key, index, parent, style }) => {
        const frags = fragmentsPerLine[index];

        const line = (
            <CellMeasurer
                cache={cache}
                columnIndex={0}
                key={key}
                parent={parent}
                rowIndex={index}
            >
                {({ registerChild }) => (
                    <Line
                        ref={registerChild}
                        key={key}
                        fragments={frags}
                        explanationMap={fragToExp}
                        similarities={similarities}
                        style={style}
                    />
                )}
            </CellMeasurer>
        );

        return line;
    };

    return (
        <div>
            <p>{explanation.leadingExplanation.text}</p>
            <Legenda />
            <pre className="softwrap">
                <List
                    width={550}
                    height={Math.min(
                        windowDimensions.height - 300,
                        fragmentsPerLine.length * 15
                    )}
                    scrollToIndex={lineNumber - fragments[0].startingLineNumber}
                    scrollToAlignment={"center"}
                    rowCount={fragmentsPerLine.length}
                    rowHeight={cache.rowHeight}
                    rowRenderer={rowRenderer}
                    deferredMeasurementCache={cache}
                ></List>
            </pre>
        </div>
    );
}

function Legenda() {
    const [settings] = useContext(SettingsContext);
    // https://stackoverflow.com/questions/37909134/nbsp-jsx-not-working
    const spacing = "\u00A0\u00A0\u00A0";

    if (!settings.isColorBlind) {
        return (
            <p>
                <span style={{ color: "magenta" }}>
                    █ = very rare
                    {spacing}
                </span>
                <span style={{ color: "red" }}>
                    █ = rare
                    {spacing}
                </span>
                <span style={{ color: "yellow" }}>
                    █ = uncommon
                    {spacing}
                </span>
                <span style={{ color: "green" }}>
                    █ = common
                    {spacing}
                </span>
                <span style={{ color: "#666666" }}>█ = ignored</span>
            </p>
        );
    }

    return (
        <p>
            <span>
                <code>•••</code> = very rare{spacing}
            </span>
            <span>
                <code>••○</code> = rare{spacing}
            </span>
            <span>
                <code>•○○</code> = uncommon{spacing}
            </span>
            <span>
                <code>○○○</code> = common{spacing}
            </span>
        </p>
    );
}

const Line = React.forwardRef(
    ({ fragments, explanationMap, similarities, style }, ref) => {
        const [settings] = useContext(SettingsContext);

        const getColorAndOrbs = (weight) => {
            if (weight >= 0.8) {
                return ["magenta", "•••"];
            }
            if (weight >= 0.67) {
                return ["red", "••○"];
            }
            if (weight >= 0.33) {
                return ["yellow", "•○○"];
            }
            if (weight >= 0) {
                return ["green", "○○○"];
            }
            return ["", "   "];
        };

        // Get the average weight of all explanations
        const explanations = fragments.map((f) => explanationMap.get(f));
        const sumWeight = explanations
            .map((e) => e.weight)
            .reduce((weight, otherWeight) => weight + otherWeight, 0);
        let avgWeight = sumWeight / explanations.length;

        // If all fragments on this line are ignored, set average weight to -1
        if (fragments.every((frag) => similarities.isIgnored(frag))) {
            avgWeight = -1;
        }

        // Get colors and alternatively orbs for those colorblind
        const [color, orbs] = getColorAndOrbs(avgWeight);

        // Generate code elements for each frag
        const codeElems = fragments.map((frag) => {
            const key = `frag_${frag.start}_${frag.end}`;
            const text = settings.isWhiteSpaceHidden
                ? frag.text
                : replaceLeadingWhitespace(frag.text);

            const style = {};
            if (similarities.isIgnored(frag)) {
                if (settings.isIgnoredHidden) {
                    style.visibility = "hidden";
                } else {
                    style.color = "#666666";
                }
            } else if (!settings.isColorBlind) {
                style.color = color;
            }

            return (
                <code key={key} style={style}>
                    {text}
                </code>
            );
        });

        return (
            <span style={style} ref={ref}>
                <code className="unselectable">
                    {settings.isColorBlind && orbs}
                    {formatLineNumber(fragments[0])}{" "}
                </code>
                {codeElems}
            </span>
        );
    }
);

function getWindowDimensions() {
    const { innerWidth: width, innerHeight: height } = window;
    return {
        width,
        height,
    };
}

// https://stackoverflow.com/questions/36862334/get-viewport-window-height-in-reactjs
function useWindowDimensions() {
    const [windowDimensions, setWindowDimensions] = useState(
        getWindowDimensions()
    );

    useEffect(() => {
        function handleResize() {
            setWindowDimensions(getWindowDimensions());
        }

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return windowDimensions;
}

function formatLineNumber(fragment) {
    return fragment.startingLineNumber
        .toString()
        .padStart(fragment.numberOfLinesInFile.toString().length, " ");
}

function getNewLineRegions(file, encompassingRegion) {
    const content = file.content.slice(
        encompassingRegion.start,
        encompassingRegion.end
    );

    const newLineRegions = [];
    [...content].forEach((char, index) => {
        if (char === "\n") {
            const region = {
                start: index + encompassingRegion.start + 1,
                end: index + encompassingRegion.start + 1,
                fileId: encompassingRegion.fileId,
            };
            newLineRegions.push(region);
        }
    });
    return newLineRegions;
}

export default ExplanationsView;
