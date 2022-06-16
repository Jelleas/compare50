import React, { useState, useEffect } from "react";
import Split from "react-split";
import ReactTooltip from "react-tooltip";

import "../index.css";
import "../split.css";
import API from "../api";
import Graph from "../graph/graph";
import MatchTable from "./matchtable";
import Logo from "../logo";

function HomeView() {
    // graph model of all matches, see getGraph() in api.js
    const [graph, setGraph] = useState(null);

    // currently selected node and its group {"id":<str>, "group":<int>}
    const [selected, setSelected] = useState(null);

    // currently highlighted nodes and their group {"group":<int>, "nodes":[<str>]}
    const [highlighted, setHighlighted] = useState(null);

    // minimum score to be displayed on screen, <int>
    const [cutoff, setCutoff] = useState(null);

    // force rerender functions for both the table and graph
    const [_tableUpdateFlag, _setTableUpdateFlag] = useState(false);
    const forceUpdateTable = () => _setTableUpdateFlag(!_tableUpdateFlag);
    const [_graphUpdateFlag, _setGraphUpdateFlag] = useState(false);
    const forceUpdateGraph = () => _setGraphUpdateFlag(!_graphUpdateFlag);

    const graphCallbacks = {
        loaded: forceUpdateTable,

        mouseenter: (event) => {
            const nodeId = event.id;
            const group = event.group;
            setHighlighted({
                group: group,
                nodes: [nodeId],
            });
        },

        mouseleave: () => setHighlighted(null),

        select: (event) => {
            const nodeId = event.id;
            const group = event.group;
            setSelected({
                id: nodeId,
                group: group,
            });
        },

        deselect: () => setSelected(null),

        cutoff: setCutoff,
    };

    const tableCallbacks = {
        mouseenter: (event) => {
            setHighlighted({
                group: event.group,
                nodes: [event.submissionA, event.submissionB],
            });
        },

        mouseleave: () => setHighlighted(null),
    };

    // asynchronously pull the graph data once this component has mounted
    useEffect(() => {
        API.getGraph().then(setGraph);
    }, []);

    // render an empty div if graph hasn't loaded yet
    if (graph === null) {
        return <div></div>;
    }

    return (
        <>
            <ReactTooltip />
            <Split
                sizes={graph.nodes.length > 50 ? [55, 45] : [60, 40]}
                gutterSize={10}
                gutterAlign="center"
                snapOffset={30}
                dragInterval={1}
                direction="horizontal"
                cursor="col-resize"
                style={{
                    height: "100%",
                }}
                onDrag={forceUpdateGraph}
            >
                <div
                    style={{
                        height: "100%",
                        margin: 0,
                        float: "left",
                        overflow: "auto",
                    }}
                >
                    <div
                        style={{
                            marginTop: "20px",
                        }}
                    >
                        <Logo />
                    </div>
                    <MatchTable
                        callbacks={tableCallbacks}
                        graph={graph}
                        highlighted={highlighted}
                        selected={selected}
                        cutoff={cutoff}
                    />
                </div>
                <div
                    style={{
                        height: "100%",
                        margin: 0,
                        float: "left",
                        background: "#ffffff",
                    }}
                >
                    <Graph
                        callbacks={graphCallbacks}
                        graph={graph}
                        highlighted={highlighted}
                        selected={selected}
                        cutoff={cutoff}
                        slider={true}
                        sliderTip={true}
                    />
                </div>
            </Split>
        </>
    );
}

export default HomeView;
