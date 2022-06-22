import { useMemo } from "react";

function useFragments(file, similarities) {
    const spans = similarities.spans;
    const ignoredSpans = similarities.ignoredSpans;
    return useMemo(() => {
        const fromFile = (span) => span.fileId === file.id;
        const spansFromFile = spans.filter(fromFile);
        const ignoredSpansFromFile = ignoredSpans.filter(fromFile);
        const allSpans = spansFromFile.concat(ignoredSpansFromFile);
        return createFragments(file, allSpans);
    }, [file, spans, ignoredSpans]);
}

class Fragment {
    constructor(
        fileId,
        numberOfLinesInFile,
        start,
        end,
        text,
        startingLineNumber,
        endingLineNumber
    ) {
        this.fileId = fileId;
        this.numberOfLinesInFile = numberOfLinesInFile;
        this.start = start;
        this.end = end;
        this.text = text;
        this.startingLineNumber = startingLineNumber;
        this.endingLineNumber = endingLineNumber;
    }
}

function slice(file, spans) {
    let slicingMarks = [];
    spans.forEach((span) => {
        slicingMarks.push(span.start);
        slicingMarks.push(span.end);
    });

    slicingMarks.push(0);
    slicingMarks.push(file.content.length);

    slicingMarks = Array.from(new Set(slicingMarks));

    slicingMarks.sort((a, b) => a - b);

    const numberOfLinesInFile = (file.content.match(/\n/g) || []).length;

    let fragments = [];
    let lineNr = 1;
    for (let i = 0; i < slicingMarks.length - 1; i++) {
        const start = slicingMarks[i];
        const end = slicingMarks[i + 1];
        const text = file.content.substring(start, end);
        const startingLineNumber = lineNr;
        lineNr += (text.match(/\n/g) || []).length;

        fragments.push(
            new Fragment(
                file.id,
                numberOfLinesInFile,
                slicingMarks[i],
                slicingMarks[i + 1],
                text,
                startingLineNumber,
                lineNr
            )
        );
    }

    return fragments;
}

// Spans of individual spaces (" ") are never relevant for the view,
// but do cause many more fragments to be created.
// For performance reasons, this filters out any spans containing just a space.
function filterIgnoredWhitespaceSpans(file, spans) {
    return spans.filter((span) => {
        if (span.end - span.start === 1 && file.content[span.start] === " ") {
            return false;
        }
        return true;
    });
}

function createFragments(file, spans) {
    return slice(file, filterIgnoredWhitespaceSpans(file, spans));
}

export default useFragments;
