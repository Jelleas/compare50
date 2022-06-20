import React, { useState } from "react";

import "./matchview.css";

import SideBar from "./components/sidebar";
import SplitView from "./components/splitview";

import useSimilarities from "./hooks/useSimilarities";
import useSettings from "./hooks/useSettings";

import API from "../api";

function MatchView() {
    const getData = () => {
        setIsLoaded(null);
        Promise.all([API.getMatch(), API.getGraph()]).then(([match, graph]) => {
            setGraph(graph);
            dispatchSimilarities({
                type: "set",
                payload: { match: match, pass: match.passes[0] },
            });
            setIsLoaded(true);
        });
    };

    const [settings, setSetting] = useSettings();

    const [isLoaded, setIsLoaded] = useState(false);

    const [graphData, setGraph] = useState({});

    const placeHolderMatch = API.placeHolderMatch();
    const [similarities, dispatchSimilarities] = useSimilarities(
        placeHolderMatch,
        placeHolderMatch.passes[0]
    );

    if (isLoaded === false) {
        getData();
    }

    return (
        <div className="row-box" style={{ height: "100vh" }}>
            <div className="row auto" style={{ width: "9em" }}>
                <div
                    className="column-box"
                    style={{ borderRight: "1px solid #a7adba" }}
                >
                    <div className="row fill">
                        <SideBar
                            isLoaded={isLoaded}
                            settings={settings}
                            setSetting={setSetting}
                            similarities={similarities}
                            dispatchSimilarities={dispatchSimilarities}
                            graphData={graphData}
                        />
                    </div>
                </div>
            </div>
            <div className="row fill">
                <SplitView
                    settings={settings}
                    similarities={similarities}
                    dispatchSimilarities={dispatchSimilarities}
                />
            </div>
        </div>
    );
}

export default MatchView;
