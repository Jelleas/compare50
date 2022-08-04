import React, { useState, useRef, useEffect, useMemo, useContext } from "react";
import ReactTooltip from "react-tooltip";

import Graph from "../../../graph/graph";
import Logo from "../../../logo";
import render50 from "../../render50";

import "../../matchview.css";
import "./sidebar.css";
import { SettingsContext } from "../../hooks/useSettings";
import useNavigateToMatch from "../../../hooks/useNavigateToMatch";

function SideBar({ isLoaded, similarities, dispatchSimilarities, graphData }) {
    const style = {
        margin: "auto",
        marginBottom: ".5em",
        marginTop: ".5em",
        width: "90%",
    };

    const match = similarities.match;

    return (
        <>
            <ReactTooltip
                place="right"
                type="dark"
                effect="solid"
                id="sidebar-tooltip"
                multiline={true}
            />
            <div className="column-box" style={{ width: "9em" }}>
                <div className="row auto">
                    <Logo height="2.5em" />
                </div>
                <div className="row auto" style={style}>
                    <MatchNavigation
                        current={match.index()}
                        n={match.numberOfMatches()}
                    />
                </div>
                <div className="row auto" style={style}>
                    <PassNavigation
                        passes={match.passes}
                        currentPass={similarities.pass}
                        setPass={(pass) => {
                            dispatchSimilarities({
                                type: "setPass",
                                payload: pass,
                            });
                        }}
                    />
                </div>
                <div className="row auto" style={style}>
                    <GroupNavigation
                        index={similarities.selectedGroupIndex() + 1}
                        total={similarities.nGroups()}
                        gotoNext={() =>
                            dispatchSimilarities({ type: "selectNextGroup" })
                        }
                        gotoPrevious={() =>
                            dispatchSimilarities({
                                type: "selectPreviousGroup",
                            })
                        }
                    />
                </div>
                <div className="row auto" style={style}>
                    <SettingsMenu />
                </div>
                <div className="row auto" style={style}>
                    <ExportMenu match={match} />
                </div>
                {isLoaded && (
                    <SideGraph
                        graph={graphData}
                        subAId={match.subA.id}
                        subBId={match.subB.id}
                    />
                )}
            </div>
        </>
    );
}

function SideGraph({ graph = null, subAId = -1, subBId = -2 }) {
    const style = {
        margin: "auto",
        marginBottom: ".5em",
        marginTop: ".5em",
        width: "90%",
    };

    const nodeA = graph.nodes.find((node) => node.id === subAId);
    const nodeB = graph.nodes.find((node) => node.id === subBId);

    // color the nodes of this match orange
    nodeA.color = "#ffb74d";
    nodeB.color = "#ffb74d";

    // Compute the distance from every sub to subA and subB using Dijkstra's algorithm
    const distanceMap = useMemo(() => {
        const directDistanceMap = {};
        graph.nodes.forEach((node) => (directDistanceMap[node.id] = []));
        graph.links.forEach(({ nodeAId, nodeBId, value }) => {
            directDistanceMap[nodeAId].push([nodeBId, value]);
            directDistanceMap[nodeBId].push([nodeAId, value]);
        });

        // map of node to distance for which the shortest distance is known
        const distanceMap = {};

        // map of node to distance for which the shortest distance is still unknown
        const potentialDistanceMap = {};
        potentialDistanceMap[subAId] = 0;
        potentialDistanceMap[subBId] = 0;

        // while there's any node to explore
        while (Object.keys(potentialDistanceMap).length > 0) {
            // grab the node with the shortest unknown distance
            const [current, currentDistance] = Object.entries(
                potentialDistanceMap
            ).reduce((a, b) => (a[1] <= b[1] ? a : b));

            // mark it as the shortest distance
            distanceMap[current] = currentDistance;

            // remove node from unknown distances
            delete potentialDistanceMap[current];

            // for every direct connection
            directDistanceMap[current].forEach(([other, otherDistance]) => {
                // if shortest distance is already known, ignore
                if (distanceMap[other] !== undefined) return;

                // update the shortest distance known so far
                const distance = currentDistance + otherDistance;
                if (
                    potentialDistanceMap[other] === undefined ||
                    distance < potentialDistanceMap[other]
                ) {
                    potentialDistanceMap[other] = distance;
                }
            });
        }
        return distanceMap;
    }, [graph, subAId, subBId]);

    const getLink = (id) => {
        const links = graph.links.filter(
            (link) => link.nodeAId === id || link.nodeBId === id
        );
        const minLink = links.reduce((a, b) => {
            const distanceA = Math.max(
                distanceMap[a.nodeAId],
                distanceMap[a.nodeBId]
            );
            const distanceB = Math.max(
                distanceMap[b.nodeAId],
                distanceMap[b.nodeBId]
            );
            return distanceA <= distanceB ? a : b;
        });
        return minLink;
    };

    const [highlighted, setHighlighted] = useState({
        nodes: [nodeA.id, nodeB.id],
        group: nodeA.group,
    });

    return (
        <React.Fragment>
            <div className="row fill" style={style}>
                <Graph
                    graph={graph}
                    slider={false}
                    sliderTip={false}
                    highlighted={highlighted}
                    callbacks={{
                        select: ({ id, group }) => {
                            if (nodeA.id === id || nodeB.id === id) return;
                            window.location.href =
                                "match_" + getLink(id).link_index + ".html";
                        },
                        mouseenter: ({ id, group }) => {
                            const link = getLink(id);
                            setHighlighted({
                                nodes: [link.nodeAId, link.nodeBId],
                                group: group,
                            });
                        },
                    }}
                />
            </div>
            <div className="row auto" style={style}>
                <span
                    className="tooltip-marker"
                    data-tip="This graph shows any known links from the submissions in the match to archives."
                    data-for="sidebar-tooltip"
                >
                    ?
                </span>
            </div>
        </React.Fragment>
    );
}

function MatchNavigation({ current, n }) {
    const navigateToMatch = useNavigateToMatch();

    const prevRef = useRef(null);
    const nextRef = useRef(null);

    useEffect(() => {
        const eventListener = (event) => {
            if (event.key === "]") {
                event.preventDefault();
                nextRef.current.click();
            } else if (event.key === "[") {
                event.preventDefault();
                prevRef.current.click();
            }
        };

        document.addEventListener("keyup", eventListener);

        return () => document.removeEventListener("keyup", eventListener);
    }, []);

    return (
        <div>
            <div
                className="monospace-text"
                style={{
                    textAlign: "center",
                    paddingBottom: ".1em",
                    paddingTop: ".5em",
                    color: "black",
                }}
            >
                {formatFraction(current, n)}
            </div>
            <div
                className="btn-group horizontal"
                data-tip="Go to the previous and next match<br/>Press [ or ]"
                data-for="sidebar-tooltip"
            >
                <span className="btn">
                    <button
                        type="button"
                        style={{ width: "50%" }}
                        onClick={() => navigateToMatch(current - 1)}
                        disabled={current === 1}
                        ref={prevRef}
                    >
                        {"<<"}
                    </button>
                </span>
                <span className="btn">
                    <button
                        type="button"
                        style={{ width: "50%" }}
                        onClick={() => navigateToMatch(current + 1)}
                        disabled={current === n}
                        ref={nextRef}
                    >
                        {">>"}
                    </button>
                </span>
            </div>
        </div>
    );
}

function PassNavigation({ passes, currentPass, setPass }) {
    return (
        <div className="btn-group vertical">
            {passes.map((pass, i) => (
                <PassButton
                    pass={pass}
                    index={i + 1}
                    isSelected={currentPass.name === pass.name}
                    key={`pass_${pass.name}`}
                    setPass={setPass}
                />
            ))}
        </div>
    );
}

function PassButton(props) {
    useEffect(() => {
        const eventListener = (event) => {
            if (event.key === props.index.toString()) {
                event.preventDefault();
                props.setPass(props.pass);
            }
        };

        document.addEventListener("keyup", eventListener);

        return () => document.removeEventListener("keyup", eventListener);
    });

    // https://github.com/wwayne/react-tooltip/issues/231
    useEffect(() => {
        ReactTooltip.rebuild();
    }, []);

    return (
        <span
            className="btn"
            data-tip={`Press ${props.index}`}
            data-for="sidebar-tooltip"
        >
            <button
                className={`monospace-text ${
                    props.isSelected ? " active" : ""
                }`}
                type="button"
                title={props.pass.docs}
                style={{ width: "100%" }}
                onClick={() => {
                    props.setPass(props.pass);
                }}
            >
                {props.pass.name}
            </button>
        </span>
    );
}

function GroupNavigation({ index, total, gotoNext, gotoPrevious }) {
    const prevRef = useRef(null);
    const nextRef = useRef(null);

    useEffect(() => {
        const eventListener = (event) => {
            if (event.key.toLowerCase() === "e") {
                event.preventDefault();
                nextRef.current.click();
            } else if (event.key.toLowerCase() === "q") {
                event.preventDefault();
                prevRef.current.click();
            }
        };

        document.addEventListener("keyup", eventListener);

        return () => document.removeEventListener("keyup", eventListener);
    }, []);

    return (
        <div>
            <div
                className="monospace-text"
                style={{
                    textAlign: "center",
                    paddingBottom: ".1em",
                    color: "black",
                }}
            >
                {formatFraction(index, total)}
            </div>
            <div
                className="btn-group horizontal"
                style={{ width: "100%" }}
                data-tip={`Press Q or E`}
                data-for="sidebar-tooltip"
                data-place="bottom"
            >
                <span className="btn">
                    <button
                        className="btn"
                        ref={prevRef}
                        type="button"
                        style={{ width: "50%" }}
                        onClick={gotoPrevious}
                    >
                        &lt;
                    </button>
                </span>
                <span className="btn">
                    <button
                        className="btn"
                        ref={nextRef}
                        type="button"
                        style={{ width: "50%" }}
                        onClick={gotoNext}
                    >
                        &gt;
                    </button>
                </span>
            </div>
        </div>
    );
}

function ExportMenu(props) {
    const [busy, setBusy] = useState(false);

    const exportPDF = () => {
        // Only enable syntax highlighting if all the same language
        const getExtension = (files) =>
            files.every((file) => file.language === files[0].language)
                ? `.${files[0].language.toLowerCase()}`
                : "";

        // Concatenate all files to one file
        const concatFiles = (files) =>
            files.reduce(
                (prev, next) =>
                    `${prev}/** ${next.name} **/\n\n${next.content}\n\n\n`,
                ""
            );

        setBusy(true);

        const filesA = props.match.filesA();
        const filesB = props.match.filesB();

        new Promise((resolve) => {
            render50(
                concatFiles(filesA),
                concatFiles(filesB),
                "submission_1" + getExtension(filesA),
                "submission_2" + getExtension(filesB),
                resolve
            );
        }).then(() => {
            setBusy(false);
        });
    };

    return (
        <div
            className="btn-group vertical"
            data-tip="Export both submissions side-by-side as PDF"
            data-for="sidebar-tooltip"
        >
            <span className="btn">
                <button
                    className={"export-button" + (busy ? " busy" : "")}
                    type="button"
                    style={{ width: "100%" }}
                    onClick={exportPDF}
                    disabled={busy}
                >
                    {busy ? "Exporting..." : "PDF"}
                </button>
            </span>
        </div>
    );
}

function SettingsMenu() {
    const [settings, setSetting] = useContext(SettingsContext);

    return (
        <React.Fragment>
            <div style={{ marginBottom: ".25em" }}>
                <Switch
                    text="wrap&nbsp;"
                    default={settings.isSoftWrapped}
                    setOption={(val) => setSetting("isSoftWrapped", val)}
                    tooltip="Soft wrap long lines of code"
                />
            </div>
            <div style={{ marginBottom: ".25em" }}>
                <Switch
                    text="hide&nbsp;"
                    default={settings.isIgnoredHidden}
                    setOption={(val) => setSetting("isIgnoredHidden", val)}
                    tooltip="Hide code that was not used in the comparison"
                />
            </div>
            <div style={{ marginBottom: ".25em" }}>
                <Switch
                    text="&nbsp;WS&nbsp;&nbsp;"
                    default={!settings.isWhiteSpaceHidden}
                    setOption={(val) => setSetting("isWhiteSpaceHidden", !val)}
                    tooltip="Show leading whitespace"
                />
            </div>
            <div>
                <Switch
                    text="color"
                    default={settings.isColorBlind}
                    setOption={(val) => setSetting("isColorBlind", val)}
                    tooltip="Switch to color blind mode"
                />
            </div>
        </React.Fragment>
    );
}

function Switch(props) {
    // https://stackoverflow.com/questions/2939914/how-do-i-vertically-align-text-in-a-div
    return (
        <div style={{ display: "table", margin: "auto" }}>
            <label className="switch" style={{ float: "left" }}>
                <input
                    type="checkbox"
                    onChange={(event) => props.setOption(event.target.checked)}
                    defaultChecked={props.default}
                />
                <span className="slider round"></span>
            </label>
            <div
                style={{
                    display: "table-cell",
                    verticalAlign: "middle",
                    paddingLeft: ".5em",
                }}
                data-tip={props.tooltip}
                data-for="sidebar-tooltip"
            >
                <span className="monospace-text">{props.text}</span>
            </div>
        </div>
    );
}

function formatFraction(numerator, denominator) {
    if (numerator === undefined || denominator === undefined) {
        return "0/0";
    }

    let nDigits = Math.max(
        numerator.toString().length,
        denominator.toString().length
    );
    const format = (n) => ("0".repeat(nDigits) + n).slice(-nDigits);
    return `${format(numerator)}/${format(denominator)}`;
}

export default SideBar;
