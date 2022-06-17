import React, { useState, useReducer } from "react";

import "./matchview.css";
import SideBar from "./sidebar";
import SplitView from "./code/splitview";

import API from "../api";
import useSimilarities from "./similarities";

function useMatchData() {
    const reduce = (state, action) => {
        switch (action.type) {
            case "new":
                const { match, pass } = action.payload;
                return {
                    currentPass: pass,
                    match: match,
                    passes: match.passes,
                    isLoaded: true,
                    currentMatch: match.index(),
                    nMatches: match.numberOfMatches(),
                };
            case "load":
                return { ...state, isLoaded: null };
            case "setPass":
                return { ...state, currentPass: action.payload };
            case "setGroup":
                return { ...state, currentGroup: action.payload };
            default:
                throw new Error(`unknown action type ${action.type}`);
        }
    };

    const [matchData, dispatch] = useReducer(reduce, {
        match: API.placeHolderMatch(),
        currentPass: {
            name: "",
            docs: "",
            score: "",
            spans: [],
            groups: [],
        },
        passes: [],
        nMatches: 50,
        currentMatch: 1,
        isLoaded: false,
    });

    return [matchData, dispatch];
}

function useSettings() {
    const [settings, setSettings] = useState({
        isSoftWrapped: true,
        isWhiteSpaceHidden: true,
        isIgnoredHidden: false,
    });

    const setSetting = (key, value) =>
        setSettings((settings) => {
            const newSettings = { ...settings };
            newSettings[key] = value;
            setSettings(newSettings);
        });

    return [settings, setSetting];
}

function MatchView() {
    const getData = function () {
        dispatchMatchData({ type: "load" });

        Promise.all([API.getMatch(), API.getGraph()]).then(([match, graph]) => {
            setGraph(graph);
            const pass = match.passes[0];
            dispatchMatchData({
                type: "new",
                payload: { match: match, pass: pass },
            });
            dispatchSimilarities({
                type: "set",
                payload: { match: match, pass: pass },
            });
        });
    };

    const [settings, setSetting] = useSettings();

    const [matchData, dispatchMatchData] = useMatchData();

    const [graphData, setGraph] = useState({});

    // const spanManager = useSpanManager(matchData.currentPass, matchData.match);

    const [similarities, dispatchSimilarities] = useSimilarities();

    if (matchData.isLoaded === false) {
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
                            settings={settings}
                            setSetting={setSetting}
                            matchData={matchData}
                            dispatchMatchData={dispatchMatchData}
                            spanManager={similarities}
                            dispatchRegions={dispatchSimilarities}
                            graphData={graphData}
                        />
                    </div>
                </div>
            </div>
            <div className="row fill">
                <SplitView
                    settings={settings}
                    matchData={matchData}
                    similarities={similarities}
                    dispatchSimilarities={dispatchSimilarities}
                    topHeight="2.5em"
                />
            </div>
        </div>
    );
}

export default MatchView;
