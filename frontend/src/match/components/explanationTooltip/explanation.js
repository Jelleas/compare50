import React, { useContext } from "react";

import useFragments from "../../hooks/useFragments";
import { SettingsContext } from "../../hooks/useSettings";
import { replaceLeadingWhitespace } from "../file/file";

function ExplanationsView({ explanations, file, similarities }) {
    const explanation = explanations[0];

    const spans = explanation.explanations.map((exp) => exp.span);

    const encompassingRegion = spans.reduce((span, region) => {
        return {
            start: Math.min(span.start, region.start),
            end: Math.max(span.end, region.end),
            fileId: span.fileId,
        };
    }, spans[0]);

    const overlaps = (region, otherRegion) =>
        !(region.end < otherRegion.start || region.start > otherRegion.end);
    const ignoredSpans = similarities.ignoredSpans
        .filter((span) => span.fileId === file.id)
        .filter((span) => overlaps(span, encompassingRegion));

    const newLineRegions = getNewLineRegions(file, encompassingRegion);

    let fragments = useFragments(
        file,
        spans,
        newLineRegions.concat(ignoredSpans)
    );

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

    const lineElems = fragmentsPerLine.map((frags) => (
        <Line
            key={`line_${frags[0].start}_${frags[frags.length - 1].end}`}
            fragments={frags}
            explanationMap={fragToExp}
            similarities={similarities}
        />
    ));

    return (
        <div>
            <p>{explanation.leadingExplanation.text}</p>
            <pre>{lineElems}</pre>
        </div>
    );
}

function Line({ fragments, explanationMap, similarities }) {
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
        <>
            <code className="unselectable">
                {settings.isColorBlind && orbs}
                {formatLineNumber(fragments[0])}{" "}
            </code>
            {codeElems}
        </>
    );
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
