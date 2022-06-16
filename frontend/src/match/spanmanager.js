import { useReducer } from "react";

function initRegionMap(match, pass) {
    if (match == null || pass == null) {
        return new RegionMap([]);
    }

    const fileIdsInOrder = match
        .filesA()
        .concat(match.filesB())
        .map((file) => file.id);

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
    const firstSpanIngroup = similarities.spans.find(
        (span) => span.groupId === groupId
    );
    return select(similarities, firstSpanIngroup);
}

function selectPreviousGroup(similarities) {
    const groupId = similarities.getPreviousGroupId();
    const firstSpanIngroup = similarities.spans.find(
        (span) => span.groupId === groupId
    );
    return select(similarities, firstSpanIngroup);
}

function useSimilarities() {
    const reduce = (state, action) => {
        switch (action.type) {
            case "set":
                const { match, pass } = action.payload;
                const regionMap = initRegionMap(match, pass);
                const ignoredRegionMap = initIgnoredRegionMap(pass);
                const spanStates = initSpanStates(regionMap);
                return {
                    pass: pass,
                    match: match,
                    regionMap: regionMap,
                    ignoredRegionMap: ignoredRegionMap,
                    spanStates: spanStates,
                };
            case "selectNextGroup":
                return { ...state, spanStates: selectNextGroup(wrap(state)) };
            case "selectPreviousGroup":
                return {
                    ...state,
                    spanStates: selectPreviousGroup(wrap(state)),
                };
            // case 'activate':
            //     return activate(state, action.value);
            case "select":
                return {
                    ...state,
                    spanStates: select(wrap(state), action.payload),
                };
            // case 'reset':
            //     return reset(state);
            default:
                throw new Error(`unknown action type ${action.type}`);
        }
    };

    const wrap = ({ pass, match, regionMap, ignoredRegionMap, spanStates }) => {
        return new Similarities(
            regionMap,
            ignoredRegionMap,
            spanStates,
            () => null
        );
    };

    const [similaritiesState, dispatch] = useReducer(reduce, {
        pass: null,
        match: null,
        regionMap: initRegionMap(),
        ignoredRegionMap: initIgnoredRegionMap(),
        spanStates: [],
    });

    return [wrap(similaritiesState), dispatch];
}

/*
 * A SpanManager that manages the state of spans (parts of a file that compare50 identifies).
 * This manager maps regions of a file to the spans identified by compare50.
 * A region is an object of the form:
 * {fileId: 1, start: 0, end: 10}
 */
class Similarities {
    constructor(regionMap, ignoredRegionMap, spanStates, setSpanStates) {
        this.spans = regionMap.spans;
        this._regionMap = regionMap;

        this.ignoredSpans = ignoredRegionMap.spans;
        this._ignoredRegionMap = ignoredRegionMap;

        // An immutable map from spanId to state
        this._spanStates = spanStates;

        // Change _spanStates (triggers a rerender)
        this._setSpanStates = setSpanStates;
    }

    activate(region) {
        const selectedSpan = this.getSpan(region);

        const groupId = selectedSpan.groupId;

        if (groupId === null) {
            return;
        }

        const spanStates = this.spans.reduce((acc, span) => {
            // Don't overwrite a selected span
            if (
                this._spanStates[span.id] === Span.STATES.SELECTED ||
                this._spanStates[span.id] === Span.STATES.HIGHLIGHTED
            ) {
                acc[span.id] = this._spanStates[span.id];
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

        this._setSpanStates(spanStates);
    }

    isFirstInHighlightedSpan(region) {
        const spans = this._regionMap.getSpans(region);
        const span = spans.find(
            (span) => this._spanStates[span.id] === Span.STATES.HIGHLIGHTED
        );
        if (span === undefined) {
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
        return span !== undefined && span.groupId !== null;
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

    getSpan(region) {
        // If the region is already a span, use that
        if (region instanceof Span) {
            return region;
        }

        const spans = this._regionMap.getSpans(region);

        if (spans.length === 0) {
            return;
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

function useSpanManager(pass, match) {
    // const unselectSpanStates = spanStates => {
    //     Object.keys(spanStates).forEach(spanId => {
    //         if (spanStates[spanId] === Span.STATES.SELECTED || spanStates[spanId] === Span.STATES.HIGHLIGHTED) {
    //             spanStates[spanId] = Span.STATES.INACTIVE;
    //         }
    //     });
    //     return spanStates;
    // }
    // // Memoize the (expensive) mapping from regions to spans on the selected pass
    // const regionMap = useMemo(() => initRegionMap(match, pass), [pass.name]);
    // // Memoize the (expensive) mapping from regions to ignoredSpans on the selected pass
    // const ignoredRegionMap = useMemo(() => initIgnoredRegionMap(pass), [pass.name]);
    // // A map from pass.name => span.id => state
    // const [allSpanStates, setAllSpanStates] = useState({});
    // // Keep track of the last pass
    // const passRef = useRef(pass);
    // // Retrieve the spanStates from the map, otherwise create new
    // let spanStates = allSpanStates[pass.name]
    // if (spanStates === undefined) {
    //     spanStates = initSpanStates(regionMap);
    // }
    // // In case pass changed, unselect everything in the new pass
    // if (passRef.current !== pass) {
    //     passRef.current = pass;
    //     spanStates = unselectSpanStates(spanStates);
    // }
    // // Callback to set the spanStates for the current pass
    // const setSpanStates = spanStates => {
    //     const temp = {}
    //     temp[pass.name] = {...(allSpanStates[pass.name]), ...spanStates}
    //     setAllSpanStates({...allSpanStates, ...temp})
    // };
    // return new SpanManager(regionMap, ignoredRegionMap, spanStates, setSpanStates);
}

export { Span, useSimilarities };
export default useSpanManager;
