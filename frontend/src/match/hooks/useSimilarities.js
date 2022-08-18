import { useReducer } from "react";

function useSimilarities(match, pass) {
    const reduce = (state, action) => {
        switch (action.type) {
            case "set":
                const { match, pass } = action.payload;
                return set(match, pass);
            case "setPass":
                return set(state.match, action.payload);
            case "selectNextGroup":
                return { ...state, spanStates: selectNextGroup(wrap(state)) };
            case "selectPreviousGroup":
                return {
                    ...state,
                    spanStates: selectPreviousGroup(wrap(state)),
                };
            case "activate":
                return {
                    ...state,
                    spanStates: activate(wrap(state), action.payload),
                };
            case "select":
                return {
                    ...state,
                    spanStates: select(wrap(state), action.payload),
                };
            default:
                throw new Error(`unknown action type ${action.type}`);
        }
    };

    const set = (match, pass) => {
        const regionMap = initRegionMap(match, pass);
        const ignoredRegionMap = initIgnoredRegionMap(pass);
        const explainers = pass.explainers;

        const explanationMaps = explainers.map((explainer) => {
            return new ExplanationMap(explainer.name, explainer.explanations);
        });

        const spanStates = initSpanStates(regionMap);
        return {
            pass: pass,
            match: match,
            regionMap: regionMap,
            ignoredRegionMap: ignoredRegionMap,
            explanationMaps: explanationMaps,
            spanStates: spanStates,
        };
    };

    const wrap = ({
        pass,
        match,
        regionMap,
        ignoredRegionMap,
        explanationMaps,
        spanStates,
    }) => {
        return new Similarities(
            pass,
            match,
            regionMap,
            ignoredRegionMap,
            explanationMaps,
            spanStates
        );
    };

    const [similaritiesState, dispatch] = useReducer(reduce, {
        pass: pass,
        match: match,
        regionMap: initRegionMap(),
        ignoredRegionMap: initIgnoredRegionMap(),
        explanationMaps: [],
        spanStates: [],
    });

    return [wrap(similaritiesState), dispatch];
}

function initRegionMap(match, pass) {
    if (match == null || pass == null) {
        return new RegionMap([]);
    }

    const files = match.submissions.map((s) => s.files).flat();
    const fileIdsInOrder = files.map((file) => file.id);

    const spans = pass.spans
        .filter((span) => !span.ignored)
        .map((span) => {
            const groupId = pass.groups.find((group) =>
                group.spans.includes(span.id)
            ).id;
            return new Span(
                span.id,
                span.subId,
                span.fileId,
                groupId,
                span.start,
                span.end
            );
        })
        .sort((a, b) => {
            const indexA = fileIdsInOrder.indexOf(a.fileId);
            const indexB = fileIdsInOrder.indexOf(b.fileId);

            if (indexA !== indexB) {
                return indexA > indexB ? 1 : -1;
            }

            return a.start > b.start ? 1 : -1;
        });

    return new RegionMap(spans);
}

function initIgnoredRegionMap(pass) {
    if (pass == null) {
        return new RegionMap([]);
    }

    const ignoredSpans = pass.spans
        .filter((span) => span.ignored)
        .map(
            (span) =>
                new Span(
                    span.id,
                    span.subId,
                    span.fileId,
                    null,
                    span.start,
                    span.end,
                    span.ignored
                )
        );

    return new RegionMap(ignoredSpans);
}

function initSpanStates(regionMap) {
    return regionMap.spans.reduce((acc, span) => {
        acc[span.id] = Span.STATES.INACTIVE;
        return acc;
    }, {});
}

function select(similarities, region) {
    // Grab the span that is selected
    const selectedSpan = similarities.getSpan(region);

    // If this span was selected before, highlight the next span in the other sub
    if (similarities._spanStates[selectedSpan.id] === Span.STATES.HIGHLIGHTED) {
        return reselect(similarities, selectedSpan);
    }

    // Grab all spans in the same group
    const groupedSpans = similarities.spans.filter(
        (span) => span.groupId === selectedSpan.groupId
    );

    // Keep track of whether the first span in the other sub has been found
    let foundFirst = false;

    // Highlight the selected span, and the first in the other sub, select all other grouped spans
    let spanStates = groupedSpans.reduce((acc, span) => {
        if (span === selectedSpan) {
            acc[span.id] = Span.STATES.HIGHLIGHTED;
        } else if (!foundFirst && span.subId !== selectedSpan.subId) {
            acc[span.id] = Span.STATES.HIGHLIGHTED;
            foundFirst = true;
        } else {
            acc[span.id] = Span.STATES.SELECTED;
        }
        return acc;
    }, {});

    // Set all other spans to inactive
    spanStates = similarities.spans.reduce((acc, span) => {
        if (!acc.hasOwnProperty(span.id)) {
            acc[span.id] = Span.STATES.INACTIVE;
        }
        return acc;
    }, spanStates);

    return spanStates;
}

function reselect(similarities, selectedSpan) {
    // Grab all spans from the other submission in the same group
    const groupedSpans = similarities.spans.filter(
        (span) => span.groupId === selectedSpan.groupId
    );

    // Grab all spans from the group in the other submission
    const otherSpans = groupedSpans.filter(
        (span) => span.subId !== selectedSpan.subId
    );

    // Find which span from the other submission was highlighted before
    const highlightedSpan = otherSpans.filter((span) =>
        similarities.isHighlighted(span)
    )[0];

    // Find which span should now be highlighted
    const newIndex =
        (otherSpans.indexOf(highlightedSpan) + 1) % otherSpans.length;
    const newHighlightedSpan = otherSpans[newIndex];

    // Create the state for each span from the other submission
    let spanStates = groupedSpans.reduce((acc, span) => {
        if (span === newHighlightedSpan || span === selectedSpan) {
            acc[span.id] = Span.STATES.HIGHLIGHTED;
        } else {
            acc[span.id] = Span.STATES.SELECTED;
        }
        return acc;
    }, {});

    // Set all other spans to inactive
    spanStates = similarities.spans.reduce((acc, span) => {
        if (!acc.hasOwnProperty(span.id)) {
            acc[span.id] = Span.STATES.INACTIVE;
        }
        return acc;
    }, spanStates);

    return spanStates;
}

function selectNextGroup(similarities) {
    const groupId = similarities.getNextGroupId();

    // If there is no next group, stop
    if (groupId === undefined || groupId === null) {
        return;
    }

    const firstSpanIngroup = similarities.spans.find(
        (span) => span.groupId === groupId
    );
    return select(similarities, firstSpanIngroup);
}

function selectPreviousGroup(similarities) {
    const groupId = similarities.getPreviousGroupId();

    // If there is no previous group, stop
    if (groupId === undefined || groupId === null) {
        return;
    }

    const firstSpanIngroup = similarities.spans.find(
        (span) => span.groupId === groupId
    );
    return select(similarities, firstSpanIngroup);
}

function activate(similarities, region) {
    const selectedSpan = similarities.getSpan(region);

    const groupId = selectedSpan.groupId;

    if (groupId === null) {
        return;
    }

    const spanStates = similarities.spans.reduce((acc, span) => {
        // Don't overwrite a selected span
        if (
            similarities._spanStates[span.id] === Span.STATES.SELECTED ||
            similarities._spanStates[span.id] === Span.STATES.HIGHLIGHTED
        ) {
            acc[span.id] = similarities._spanStates[span.id];
        }
        // Set all spans in group to
        else if (span.groupId === groupId) {
            acc[span.id] = Span.STATES.ACTIVE;
        }
        // Set everything else to inactive
        else {
            acc[span.id] = Span.STATES.INACTIVE;
        }

        return acc;
    }, {});

    return spanStates;
}

/*
 * Similarities of a submission (parts of a file that compare50 identifies).
 * This maps regions of a file to the spans identified by compare50.
 * A region is an object of the form:
 * {fileId: 1, start: 0, end: 10}
 */
class Similarities {
    constructor(
        pass,
        match,
        regionMap,
        ignoredRegionMap,
        explanationMaps,
        spanStates
    ) {
        this.pass = pass;
        this.match = match;

        this.spans = regionMap.spans;
        this._regionMap = regionMap;

        this.ignoredSpans = ignoredRegionMap.spans;
        this._ignoredRegionMap = ignoredRegionMap;

        this.explanationMaps = explanationMaps;

        // An immutable map from spanId to state
        this._spanStates = spanStates;
    }

    isFirstInSpan(region) {
        return this.getSpan(region)?.start === region.start;
    }

    isFirstInHighlightedSpan(region) {
        const spans = this._regionMap.getSpans(region);
        const span = spans.find(
            (span) => this._spanStates[span.id] === Span.STATES.HIGHLIGHTED
        );
        if (span === null) {
            return false;
        }
        return span.start === region.start;
    }

    isHighlighted(region) {
        return this._isState(region, Span.STATES.HIGHLIGHTED);
    }

    isActive(region) {
        return this._isState(region, Span.STATES.ACTIVE);
    }

    isSelected(region) {
        return this._isState(region, Span.STATES.SELECTED);
    }

    isGrouped(region) {
        const span = this.getSpan(region);
        return span !== null && span.groupId !== null;
    }

    isIgnored(region) {
        return this._ignoredRegionMap.getSpans(region).length !== 0;
    }

    getNextGroupId() {
        return this._regionMap.getNextGroupId(this._selectedGroupId());
    }

    getPreviousGroupId() {
        return this._regionMap.getPreviousGroupId(this._selectedGroupId());
    }

    selectedGroupIndex() {
        return this._regionMap.getGroupIndex(this._selectedGroupId());
    }

    nGroups() {
        return this._regionMap.nGroups;
    }

    highlightedSpans() {
        return this.spans.filter(
            (span) => this._spanStates[span.id] === Span.STATES.HIGHLIGHTED
        );
    }

    getExplanations(region) {
        const span = this.getSpan(region);
        if (span === null) {
            return [];
        }

        const explanations = this.explanationMaps.map((expMap) =>
            expMap.getExplanation(span)
        );
        return explanations.filter((exp) => exp !== null);
    }

    getSpan(region) {
        // If the region is already a span, use that
        if (region instanceof Span) {
            return region;
        }

        const spans = this._regionMap.getSpans(region);

        if (spans.length === 0) {
            return null;
        }

        let largestSpan = spans[0];
        spans.forEach((span) => {
            if (span.end - span.start > largestSpan.end - largestSpan.start) {
                largestSpan = span;
            }
        });
        return largestSpan;
    }

    _selectedGroupId() {
        for (let span of this.spans) {
            if (
                this._spanStates[span.id] === Span.STATES.SELECTED ||
                this._spanStates[span.id] === Span.STATES.HIGHLIGHTED
            ) {
                return span.groupId;
            }
        }
        return -1;
    }

    _isState(region, state) {
        const spans = this._regionMap.getSpans(region);
        return spans.some((span) => this._spanStates[span.id] === state);
    }
}

// Immutable map from a region in a file to a span/group
class RegionMap {
    constructor(spans) {
        this.spans = spans;

        // Memoization map, maps a this._key() to a span
        this._map = {};

        this.groupIds = [];
        this.spans.forEach((span) => {
            if (!this.groupIds.includes(span.groupId)) {
                this.groupIds.push(span.groupId);
            }
        });
        this.nGroups = this.groupIds.length;
    }

    getSpans(region) {
        const key = this._key(region);

        // Get spans from memory if possible
        if (this._map[key] !== undefined) {
            return this._map[key];
        }

        const spans = this.spans.filter(
            (span) =>
                span.fileId === region.fileId &&
                span.start <= region.start &&
                span.end >= region.end
        );

        // Memoize span
        this._map[key] = spans;

        return spans;
    }

    getGroupIds(region) {
        return this.getSpans(region).map((span) => span.groupId);
    }

    getGroupIndex(groupId) {
        return this.groupIds.indexOf(groupId);
    }

    getPreviousGroupId(groupId) {
        let groupIndex = this.getGroupIndex(groupId);
        groupIndex -= 1;

        if (groupIndex < 0) {
            groupIndex = this.nGroups - 1;
        }

        return this.groupIds[groupIndex];
    }

    getNextGroupId(groupId) {
        let groupIndex = this.getGroupIndex(groupId);
        groupIndex += 1;

        if (groupIndex >= this.nGroups) {
            groupIndex = 0;
        }

        return this.groupIds[groupIndex];
    }

    _key(region) {
        return `${region.fileId}:${region.start}`;
    }
}

class ExplanationMap {
    constructor(explainer_name, all_explanations) {
        this.name = explainer_name;
        this.all_explanations = all_explanations;
        this._map = {};
    }

    getExplanation(span) {
        const key = this._key(span);
        if (this._map[key] !== undefined) {
            return this._map[key];
        }

        // Explanations are from the same file and
        // explanation's span is a subspan of the matched span
        const explanations = this.all_explanations.filter(
            (exp) =>
                exp.span.fileId === span.fileId &&
                exp.span.end <= span.end &&
                exp.span.start >= span.start
        );

        if (explanations.length === 0) {
            this._map[key] = null;
            return null;
        }

        const explanation = new Explanation(span, explanations);

        this._map[key] = explanation;

        return explanation;
    }

    _key(span) {
        return `${span.fileId}:${span.start}`;
    }
}

class Span {
    static STATES = {
        INACTIVE: 0,
        ACTIVE: 1,
        SELECTED: 2,
        HIGHLIGHTED: 3,
    };

    constructor(id, subId, fileId, groupId, start, end) {
        this.id = id;
        this.subId = subId;
        this.fileId = fileId;
        this.groupId = groupId;
        this.start = start;
        this.end = end;
    }
}

class Explanation {
    constructor(span, explanations) {
        this.span = span;
        this.explanations = explanations;

        const leadingExplanation = explanations.reduce(
            (exp, maxExp) => (exp.weight > maxExp.weight ? exp : maxExp),
            explanations[0]
        );

        this.leadingExplanation = leadingExplanation;

        if (leadingExplanation.weight >= 0.8) {
            this.level = 3;
        } else if (leadingExplanation.weight >= 0.67) {
            this.level = 2;
        } else if (leadingExplanation.weight >= 0.33) {
            this.level = 1;
        } else {
            this.level = 0;
        }
    }
}

export { Span };
export default useSimilarities;
