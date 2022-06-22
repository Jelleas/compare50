import React, { useRef, useEffect, useMemo } from "react";

import "../../matchview.css";
import "./file.css";
import useFragments from "./useFragments";

function File({
    file,
    similarities,
    dispatchSimilarities,
    updateCoverage,
    scrollTo,
    settings,
    isInteractionBlocked,
}) {
    const fragments = useFragments(
        file,
        similarities.spans,
        similarities.ignoredSpans
    );

    const coverage = useCoverage(fragments, similarities);

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

    const fragmentElems = fragments.map((frag) => {
        const id = `frag_${file.id}_${frag.start}`;

        const fragElem = (
            <Fragment
                key={id}
                fragment={frag}
                id={id}
                isOnNewline={isOnNewline}
                settings={settings}
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
    settings,
    isOnNewline,
    id,
    scrollTo,
}) {
    // Break up the fragments into lines (keep the newline)
    const lines = fragment.text.split(/(?<=\n)/g);

    const ref = useRef(null);

    const isHighlighted = similarities.isHighlighted(fragment);

    const className = getClassName(
        fragment,
        similarities,
        settings.isIgnoredHidden
    );

    const hasMouseOvers =
        !isInteractionBlocked && similarities.isGrouped(fragment);

    const getAlertLevel = (similarities, fragment) => {
        return similarities.isGrouped(fragment) ? 3 : -1;
    };

    const codeSnippets = lines.map((line, lineIndex) => {
        const optionalProps = {};

        // If the code is on a newline, show line number and alert
        if (isOnNewline || lineIndex > 0) {
            const lineNumber = fragment.startingLineNumber + lineIndex;

            optionalProps["lineNumber"] = lineNumber
                .toString()
                .padStart(fragment.numberOfLinesInFile.toString().length, " ");
            optionalProps["alertLevel"] = getAlertLevel(similarities, fragment);
        }
        // If the code is on one line, and it's the first in a matched span, show alert
        else if (lines.length === 1 && similarities.isFirstInSpan(fragment)) {
            optionalProps["alertLevel"] = getAlertLevel(similarities, fragment);
        }

        return (
            <CodeSnippet
                key={`code_${id}_${lineIndex}`}
                line={line}
                settings={settings}
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

function CodeSnippet({ line, settings, lineNumber, alertLevel }) {
    if (lineNumber == null && alertLevel == null) {
        return <code>{line}</code>;
    }

    // If starting on a newline, make the leading whitespace visible
    if (!settings.isWhiteSpaceHidden) {
        line = replaceLeadingWhitespace(line);
    }

    const style = { textAlign: "right" };
    const optionalProps = {};
    if (alertLevel != null) {
        const alertColors = {
            "-1": "transparent",
            0: "green",
            1: "yellow",
            2: "orange",
            3: "red",
        };
        style["borderLeft"] = `1ch solid ${alertColors[alertLevel]}`;

        if (alertLevel >= 0) {
            optionalProps["data-tip"] = "Placeholder info on similarity";
            optionalProps["data-for"] = "splitview-tooltip";
            optionalProps["data-place"] = "left";
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
};

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
