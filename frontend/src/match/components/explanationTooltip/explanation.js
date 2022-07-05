import React from "react";

import useFragments from "../../hooks/useFragments";

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

    const fragments = useFragments(file, spans, []);

    // First fragment is outside of scope of explanation if the first explanation does not start at 0
    if (encompassingRegion.start !== 0) {
        fragments.shift();
    }

    // Last fragment is outside of scope of explanation if the last explanation does not end at EOF
    if (encompassingRegion.end < file.content.length) {
        fragments.pop();
    }

    // Assign a weight to each fragment
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

    const getColor = (exp) => {
        if (exp.weight >= 0.67) {
            return "red";
        }
        if (exp.weight >= 0.33) {
            return "yellow";
        }
        return "green";
    };

    return (
        <div>
            <p>{explanation.leadingExplanation.text}</p>
            <pre>
                {fragments.map((frag) => (
                    <code
                        key={`frag_${frag.start}_${frag.end}`}
                        style={{ color: getColor(fragToExp.get(frag)) }}
                    >
                        {frag.text}
                    </code>
                ))}
            </pre>
        </div>
    );
}

export default ExplanationsView;
