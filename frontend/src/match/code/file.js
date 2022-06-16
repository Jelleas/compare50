import React, { useState, useRef, useEffect, useMemo } from "react";
import createFragments from "./fragmentslicer";

import "../matchview.css";
import "./file.css";

function File({
    file,
    updateFileVisibility,
    similarities,
    dispatchSimilarities,
    updateCoverage,
    scrollTo,
    hideIgnored,
    showWhiteSpace,
    interactionBlocked,
    softWrap,
}) {
    const [visibilityRef, entry] = useIntersect({
        threshold: Array.from(Array(100).keys(), (i) => i / 100),
    });

    const _updateFileVisibility = updateFileVisibility;
    useEffect(() => {
        _updateFileVisibility(file.name, entry.intersectionRatio);
    }, [file.name, _updateFileVisibility, entry.intersectionRatio]);

    const fragments = useFragments(
        file,
        similarities.spans,
        similarities.ignoredSpans
    );

    const coverage = useCoverage(fragments, similarities);
    const percentage = (
        (coverage.numMatchedChars / coverage.numChars) *
        100
    ).toFixed(0);

    const _updateCoverage = updateCoverage;
    useEffect(() => {
        _updateCoverage(coverage);
    }, [coverage, _updateCoverage]);

    // Keep track of whether a line of code starts on a newline (necessary for line numbers through css)
    let onNewline = true;

    const fragmentElems = fragments.map((frag) => {
        const id = `frag_${file.id}_${frag.start}`;
        const fragElem = (
            <Fragment
                key={id}
                fragment={frag}
                fileId={file.id}
                id={id}
                onNewline={onNewline}
                hideIgnored={hideIgnored}
                showWhiteSpace={showWhiteSpace}
                scrollTo={scrollTo}
                similarities={similarities}
                dispatchSimilarities={dispatchSimilarities}
                interactionBlocked={interactionBlocked}
            />
        );
        onNewline = frag.text.endsWith("\n");
        return fragElem;
    });

    return (
        <>
            <h4>
                {" "}
                {file.name} <span>{percentage}%</span>
            </h4>
            <pre
                ref={visibilityRef}
                className={(softWrap ? "softwrap" : "") + " monospace-text"}
            >
                {fragmentElems}
            </pre>
        </>
    );
}

function Fragment({
    fragment,
    similarities,
    dispatchSimilarities,
    hideIgnored,
    interactionBlocked,
    showWhiteSpace,
    onNewline,
    id,
    scrollTo,
}) {
    // Break up the fragments into lines (keep the newline)
    const lines = fragment.text.split(/(?<=\n)/g);

    const ref = useRef(null);

    const isHighlighted = similarities.isHighlighted(fragment);

    useEffect(() => {
        // If this fragment is highlighted, and it's the first in its span, scroll to it
        if (isHighlighted && similarities.isFirstInHighlightedSpan(fragment)) {
            scrollTo(ref.current);
        }
    });

    let className = getClassName(fragment, similarities, hideIgnored);

    const hasMouseOvers =
        !interactionBlocked && similarities.isGrouped(fragment);

    return (
        <span
            ref={ref}
            className={className}
            key={id}
            onMouseEnter={
                hasMouseOvers
                    ? () => similarities.activate(fragment)
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
            {lines.map((line, lineIndex) => {
                const isNewLine = onNewline || lineIndex > 0;

                // If starting on a newline, make the leading whitespace visible
                if (isNewLine && showWhiteSpace) {
                    line = replaceLeadingWhitespace(line);
                }

                return (
                    <code
                        key={`code_${id}_${lineIndex}`}
                        className={isNewLine ? "newline" : ""}
                    >
                        {line}
                    </code>
                );
            })}
        </span>
    );
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

function getClassName(fragment, spanManager, hideIgnored) {
    const classNames = [];
    if (spanManager.isIgnored(fragment)) {
        if (hideIgnored) {
            classNames.push("invisible-span");
        } else {
            classNames.push("ignored-span");
        }
    }

    if (spanManager.isHighlighted(fragment)) {
        classNames.push("highlighted-span");
    } else if (spanManager.isActive(fragment)) {
        classNames.push("active-span");
    } else if (spanManager.isSelected(fragment)) {
        classNames.push("selected-span");
    } else if (spanManager.isGrouped(fragment)) {
        classNames.push("grouped-span");
    }

    return classNames.join(" ");
}

function useFragments(file, spans, ignoredSpans) {
    return useMemo(() => {
        const fromFile = (span) => span.fileId === file.id;
        const spansFromFile = spans.filter(fromFile);
        const ignoredSpansFromFile = ignoredSpans.filter(fromFile);
        const allSpans = spansFromFile.concat(ignoredSpansFromFile);
        return createFragments(file, allSpans);
    }, [file, spans, ignoredSpans]);
}

function useCoverage(fragments, spanManager) {
    const compute = () => {
        let numChars = 0;
        let numMatchedChars = 0;
        fragments.forEach((fragment) => {
            if (spanManager.isIgnored(fragment)) {
                return;
            }

            const size = fragment.end - fragment.start;
            if (spanManager.isGrouped(fragment)) {
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

// https://medium.com/the-non-traditional-developer/how-to-use-an-intersectionobserver-in-a-react-hook-9fb061ac6cb5
const useIntersect = ({ root = null, rootMargin, threshold = 0 }) => {
    const [entry, updateEntry] = useState({});
    const [node, setNode] = useState(null);

    const observer = useRef(
        new window.IntersectionObserver(([entry]) => updateEntry(entry), {
            root,
            rootMargin,
            threshold,
        })
    );

    useEffect(() => {
        const { current: currentObserver } = observer;
        currentObserver.disconnect();

        if (node) {
            currentObserver.observe(node);
        }

        return () => currentObserver.disconnect();
    }, [node]);

    return [setNode, entry];
};

export default File;
