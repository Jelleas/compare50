import React, { useState } from "react";

import "./matchview.css";

import SideBar from "./components/sidebar";
import SplitView from "./components/splitview";

import useSimilarities from "./hooks/useSimilarities";
import useSettings, { SettingsContext } from "./hooks/useSettings";

import API from "../api";
import { useParams } from "react-router-dom";

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

    let { id } = useParams();
    id = id.match(/\d/g).join("");

    const placeHolderMatch = API.placeHolderMatch();
    const [similarities, dispatchSimilarities] = useSimilarities(
        placeHolderMatch,
        placeHolderMatch.passes[0]
    );

    if (isLoaded === false) {
        getData();
    }

    return (
        <SettingsContext.Provider value={[settings, setSetting]}>
            <div className="row-box" style={{ height: "100vh" }}>
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
                    <SplitView
                        similarities={similarities}
                        dispatchSimilarities={dispatchSimilarities}
                    />
                </div>
            </div>
        </SettingsContext.Provider>
    );
}

export default MatchView;
