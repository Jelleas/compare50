import React, { useRef, useEffect, useMemo, useContext } from "react";

import "../../matchview.css";
import "./file.css";
import useFragments from "../../hooks/useFragments";
import { ExplanationTooltipContext } from "../explanationTooltip";
import { SettingsContext } from "../../hooks/useSettings";

function File({
    file,
    similarities,
    dispatchSimilarities,
    updateCoverage,
    scrollTo,
    isInteractionBlocked,
}) {
    const fragments = useFragments(
        file,
        similarities.spans,
        similarities.ignoredSpans
    );

    const coverage = useCoverage(fragments, similarities);

    const [settings] = useContext(SettingsContext);

    const _updateCoverage = updateCoverage;
    useEffect(() => {
        _updateCoverage(coverage);
    }, [coverage, _updateCoverage]);

    const percentage = (
        (coverage.numMatchedChars / coverage.numChars) *
        100
    ).toFixed(0);

    // Keep track of whether a line of code starts on a newline (necessary for line numbers through css)
    let isOnNewline = true;

    const fragmentElems = fragments.map((frag, i) => {
        const id = `frag_${file.id}_${frag.start}`;

        const fragElem = (
            <Fragment
                key={id}
                fragment={frag}
                id={id}
                isOnNewline={isOnNewline}
                isAlertForced={isInSingleLineSpan(
                    frag,
                    fragments,
                    i,
                    similarities
                )}
                scrollTo={scrollTo}
                similarities={similarities}
                dispatchSimilarities={dispatchSimilarities}
                isInteractionBlocked={isInteractionBlocked}
            />
        );
        isOnNewline = frag.text.endsWith("\n");
        return fragElem;
    });

    return (
        <>
            <h4>
                {" "}
                {file.name} <span>{percentage}%</span>
            </h4>

            <div>
                <pre
                    className={
                        (settings.isSoftWrapped ? "softwrap" : "") +
                        " monospace-text"
                    }
                >
                    {fragmentElems}
                </pre>
            </div>
        </>
    );
}

function Fragment({
    fragment,
    similarities,
    dispatchSimilarities,
    isInteractionBlocked,
    isOnNewline,
    isAlertForced,
    id,
    scrollTo,
}) {
    const [settings] = useContext(SettingsContext);

    const getAlertLevel = (explanations) => {
        if (explanations.length === 0) {
            return -1;
        }
        return explanations[0].level;
    };

    const ref = useRef(null);

    const isHighlighted = similarities.isHighlighted(fragment);

    const className = getClassName(
        fragment,
        similarities,
        settings.isIgnoredHidden
    );

    const hasMouseOvers =
        !isInteractionBlocked && similarities.isGrouped(fragment);

    // Break up the fragments into lines (keep the newline)
    // const lines = fragment.text.split(/(?<=\n)/g);
    let lines = fragment.text.split("\n");
    lines = lines
        .map((line, i) => (i !== lines.length - 1 ? line + "\n" : line))
        .filter((line) => line.length > 0);

    const explanations = similarities.getExplanations(fragment);
    const alertLevel = getAlertLevel(explanations);

    const codeSnippets = lines.map((line, lineIndex) => {
        const optionalProps = {};

        // If the code is on a newline, show line number and alert
        if (isOnNewline || lineIndex > 0) {
            const lineNumber = fragment.startingLineNumber + lineIndex;

            optionalProps["lineNumber"] = lineNumber
                .toString()
                .padStart(fragment.numberOfLinesInFile.toString().length, " ");
            optionalProps["alertLevel"] = alertLevel;
            optionalProps["explanationRegion"] = fragment;
        }
        // If this fragment is on one line, and it's the first in a matched span
        else if (isAlertForced) {
            // And the span itself is also on just one line, show alert
            optionalProps["alertLevel"] = alertLevel;
            optionalProps["explanationRegion"] = fragment;
        }

        return (
            <CodeSnippet
                key={`code_${id}_${lineIndex}`}
                line={line}
                {...optionalProps}
            ></CodeSnippet>
        );
    });

    useEffect(() => {
        // If this fragment is highlighted, and it's the first in its span, scroll to it
        if (isHighlighted && similarities.isFirstInHighlightedSpan(fragment)) {
            scrollTo(ref.current);
        }
    });

    return (
        <span
            ref={ref}
            className={className}
            key={id}
            onMouseEnter={
                hasMouseOvers
                    ? () => {
                          dispatchSimilarities({
                              type: "activate",
                              payload: fragment,
                          });
                      }
                    : undefined
            }
            onMouseDown={
                hasMouseOvers
                    ? (event) => {
                          // Prevent text selection when clicking on highlighted fragments
                          if (similarities.isHighlighted(fragment)) {
                              event.preventDefault();
                          }
                      }
                    : undefined
            }
            onMouseUp={
                hasMouseOvers
                    ? () => {
                          dispatchSimilarities({
                              type: "select",
                              payload: fragment,
                          });
                      }
                    : undefined
            }
        >
            {codeSnippets}
        </span>
    );
}

function CodeSnippet({ line, lineNumber, alertLevel, explanationRegion }) {
    const [settings] = useContext(SettingsContext);

    const getToolTipProps = useContext(ExplanationTooltipContext);

    // If starting on a newline, make the leading whitespace visible
    if (!settings.isWhiteSpaceHidden) {
        line = replaceLeadingWhitespace(line);
    }

    if (lineNumber == null && alertLevel == null) {
        return <code>{line}</code>;
    }

    const style = { textAlign: "right", color: "black" };
    let optionalProps = {};
    if (alertLevel != null) {
        const alertColors = {
            "-1": "transparent",
            0: "blue",
            1: "green",
            2: "yellow",
            3: "red",
        };

        if (alertLevel >= 0) {
            style["borderLeft"] = `1ch solid ${alertColors[alertLevel]}`;

            optionalProps = {
                ...optionalProps,
                ...getToolTipProps(explanationRegion),
            };
        }
    }

    return (
        <>
            <code className="unselectable" style={style} {...optionalProps}>
                {lineNumber == null ? "" : ` ${lineNumber} `}
            </code>
            <code>{line}</code>
        </>
    );
}

CodeSnippet.defaultProps = {
    lineNumber: null,
    alertLevel: null,
    explanationRegion: null,
};

function isInSingleLineSpan(fragment, fragments, fragmentIndex, similarities) {
    // If it's a multiline fragment, or not grouped, or not in the front of a group -> false
    if (
        fragment.startingLineNumber !== fragment.endingLineNumber ||
        !similarities.isGrouped(fragment) ||
        !similarities.isFirstInSpan(fragment)
    ) {
        return false;
    }

    const span = similarities.getSpan(fragment);

    // Check the next fragments
    for (let j = fragmentIndex + 1; j < fragments.length; j++) {
        // If frag is not in the same span -> true
        const otherFrag = fragments[j];
        const otherSpan = similarities.getSpan(otherFrag);
        if (span !== otherSpan) {
            return true;
        }

        // If a frag is in the same span and on a next line -> false
        const otherLineNumber = Math.max(
            otherFrag.startingLineNumber,
            otherFrag.endingLineNumber
        );
        if (fragment.startingLineNumber !== otherLineNumber) {
            return false;
        }
    }

    // If there is no other frags before EOF, then it must be single line -> true
    return true;
}

function replaceLeadingWhitespace(line) {
    let newLine = "";

    for (let i = 0; i < line.length; i++) {
        if (line[i] === " ") {
            newLine += ".";
        } else if (line[i] === "\t") {
            newLine += "____";
        } else {
            newLine += line.slice(i);
            break;
        }
    }

    return newLine;
}

function getClassName(fragment, similarities, hideIgnored) {
    const classNames = [];
    if (similarities.isIgnored(fragment)) {
        if (hideIgnored) {
            classNames.push("invisible-span");
        } else {
            classNames.push("ignored-span");
        }
    }

    if (similarities.isHighlighted(fragment)) {
        classNames.push("highlighted-span");
    } else if (similarities.isActive(fragment)) {
        classNames.push("active-span");
    } else if (similarities.isSelected(fragment)) {
        classNames.push("selected-span");
    } else if (similarities.isGrouped(fragment)) {
        classNames.push("grouped-span");
    }

    return classNames.join(" ");
}

function useCoverage(fragments, similarities) {
    const compute = () => {
        let numChars = 0;
        let numMatchedChars = 0;
        fragments
            .filter((frag) => !similarities.isIgnored(frag))
            .forEach((fragment) => {
                const size = fragment.end - fragment.start;
                if (similarities.isGrouped(fragment)) {
                    numMatchedChars += size;
                }
                numChars += size;
            });

        return {
            numMatchedChars: numMatchedChars,
            numChars: numChars,
        };
    };

    return useMemo(compute, [fragments]);
}

export default File;
