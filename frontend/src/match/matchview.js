import React, { useEffect, useState, useRef } from "react";

import "./matchview.css";

import SideBar from "./components/sidebar";
import SplitView from "./components/splitview";

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

    document.body.style.overscrollBehavior = "none";

    const [height, setHeight] = useState(300);

    const fooRef = useRef();

    return (
        <SettingsContext.Provider value={[settings, setSetting]}>
            <div id="foo">
                <div
                    ref={fooRef}
                    id="foo3"
                    style={{
                        width: "100%",
                        position: "absolute",
                        zIndex: -1,
                        background: "red",
                        height:
                            fooRef.current === undefined
                                ? "300px"
                                : fooRef.current.style.height,
                    }}
                ></div>
                <div
                    className="row-box"
                    style={{
                        height: "100vh",
                        position: "absolute",
                        zIndex: 0,
                    }}
                >
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
                            setHeight={fooRef}
                        />
                    </div>
                </div>
            </div>
        </SettingsContext.Provider>
    );
}

export default MatchView;
