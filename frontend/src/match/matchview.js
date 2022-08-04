import React, { useCallback, useEffect, useState } from "react";

import "./matchview.css";

import SideBar from "./components/sidebar";
import SplitView from "./components/splitview";
import Summary from "./components/summary";

import useSimilarities from "./hooks/useSimilarities";
import useSettings, { SettingsContext } from "./hooks/useSettings";

import API from "../api";
import useMatchIndex from "./hooks/useMatchIndex";

function MatchView() {
    const index = useMatchIndex();

    const [settings, setSetting] = useSettings();

    const [isLoaded, setIsLoaded] = useState(false);

    const [graphData, setGraph] = useState({});

    const placeHolderMatch = API.placeHolderMatch();
    const [similarities, dispatchSimilarities] = useSimilarities(
        placeHolderMatch,
        placeHolderMatch.passes[0]
    );

    useEffect(() => {
        setIsLoaded(null);
        Promise.all([API.getMatch(index), API.getGraph(index)]).then(
            ([match, graph]) => {
                setGraph(graph);
                dispatchSimilarities({
                    type: "set",
                    payload: { match: match, pass: match.passes[0] },
                });
                setIsLoaded(true);
            }
        );
    }, [index, dispatchSimilarities]);

    const [isSummaryVisible, setIsSummaryVisible] = useState(true);

    return (
        <SettingsContext.Provider value={[settings, setSetting]}>
            <div className="row-box" style={{ height: "calc(100vh - 10px)" }}>
                <div className="row auto" style={{ width: "9em" }}>
                    <div
                        className="column-box"
                        style={{ borderRight: "1px solid #a7adba" }}
                    >
                        <div className="row fill">
                            <SideBar
                                isLoaded={isLoaded}
                                similarities={similarities}
                                dispatchSimilarities={dispatchSimilarities}
                                graphData={graphData}
                            />
                        </div>
                    </div>
                </div>
                <div className="row fill">
                    <Summary
                        visible={isSummaryVisible}
                        hide={() => setIsSummaryVisible(false)}
                        show={() => setIsSummaryVisible(true)}
                    />
                    <SplitView
                        similarities={similarities}
                        dispatchSimilarities={dispatchSimilarities}
                        onScroll={() => setIsSummaryVisible(false)}
                    />
                </div>
            </div>
        </SettingsContext.Provider>
    );
}

export default MatchView;
