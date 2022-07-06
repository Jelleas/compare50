import React, { useContext } from "react";

import useFragments from "../../hooks/useFragments";
import { SettingsContext } from "../../hooks/useSettings";

function ExplanationsView({ explanations, file }) {
    const explanation = explanations[0];

    const spans = explanation.explanations.map((exp) => exp.span);

    const encompassingRegion = spans.reduce((span, region) => {
        return {
            start: Math.min(span.start, region.start),
            end: Math.max(span.end, region.end),
            fileId: span.fileId,
        };
    }, spans[0]);

    const newLineRegions = getNewLineRegions(file, encompassingRegion);

    const fragments = useFragments(file, spans, newLineRegions);

    // First fragment is outside of scope of explanation if the first explanation does not start at 0
    if (encompassingRegion.start !== 0) {
        fragments.shift();
    }

    // Last fragment is outside of scope of explanation if the last explanation does not end at EOF
    if (encompassingRegion.end < file.content.length) {
        fragments.pop();
    }

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

    const startingLineNumber = getStartingLineNumber(file, encompassingRegion);
    const lineElems = fragmentsPerLine.map((frags, i) => (
        <Line
            key={`line_${frags[0].start}_${frags[frags.length - 1].end}`}
            fragments={frags}
            explanationMap={fragToExp}
            lineNumber={startingLineNumber + i}
        />
    ));

    return (
        <div>
            <p>{explanation.leadingExplanation.text}</p>
            <pre>{lineElems}</pre>
        </div>
    );
}

function Line({ lineNumber, fragments, explanationMap }) {
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
        return ["green", "○○○"];
    };

    const explanations = fragments.map((f) => explanationMap.get(f));
    const sumWeight = explanations
        .map((e) => e.weight)
        .reduce((weight, otherWeight) => weight + otherWeight, 0);
    const avgWeight = sumWeight / explanations.length;

    const [color, orbs] = getColorAndOrbs(avgWeight);

    return (
        <>
            <code className="unselectable">
                {settings.isColorBlind && orbs}
                {formatLineNumber(lineNumber, fragments[0])}{" "}
            </code>
            {fragments.map((frag) => (
                <code
                    key={`frag_${frag.start}_${frag.end}`}
                    style={{ color: settings.isColorBlind ? "" : color }}
                >
                    {frag.text}
                </code>
            ))}
        </>
    );
}

function formatLineNumber(lineNumber, fragment) {
    return lineNumber
        .toString()
        .padStart(fragment.numberOfLinesInFile.toString().length, " ");
}

function getStartingLineNumber(file, region) {
    return (file.content.slice(0, region.start).match(/\n/g) || []).length + 1;
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
