import React, {useState, useReducer} from 'react';

import './matchview.css';
import SideBar from './sidebar';
import SplitView from './code/splitview';

import API from '../api';
import useSpanManager from './spanmanager';

function useSettings() {
    const reduce = (state, action) => {
        switch(action.type) {
            case 'newMatch':
                const match = action.value;
                return {
                    ...state,
                    "passes": match.passes,
                    "currentPass": match.passes[0],
                    "isDataLoaded": true,
                    "currentMatch": match.index(),
                    "nMatches": match.numberOfMatches()
                }
            case 'load':
                return {
                    ...state,
                    "isDataLoaded": null
                }
            case 'newSetting':
                return {
                    ...state,
                    ...action.value
                }
            default:
                throw new Error(`unknown action type ${action.type}`);
        }
    }

    const [settings, dispatch] = useReducer(reduce, {
        "currentPass": {
            "name": "",
            "docs": "",
            "score": "",
            "spans": [],
            "groups": []
        },
        "passes": [],
        "nMatches": 50,
        "currentMatch": 1,
        "isSoftWrapped": true,
        "isWhiteSpaceHidden": true,
        "isIgnoredHidden": false,
        "isDataLoaded": false
    });

    return [settings, dispatch]
}


function MatchView() {
    const getData = function() {
        dispatchSettings({type: 'load'})

        Promise.all([
            API.getMatch(),
            API.getGraph()
        ])
        .then(([match, graph]) => {
            setGraph(graph);
            setMatch(match);
            dispatchSettings({type: 'newMatch', value: match});
        });
    }

    const [settings, dispatchSettings] = useSettings()

    const [match, setMatch] = useState(API.placeHolderMatch());

    const [graphData, setGraph] = useState({});

    if (settings.isDataLoaded === false) {
        getData();
    }

    const spanManager = useSpanManager(settings.currentPass, match);

    return (
        <div className="row-box" style={{"height":"100vh"}}>
            <div className="row auto" style={{"width":"9em"}}>
                <div className="column-box" style={{"borderRight": "1px solid #a7adba"}}>
                    <div className="row fill">
                        <SideBar settings={settings} dispatchSettings={dispatchSettings} match={match} spanManager={spanManager} graphData={graphData}/>
                    </div>
                </div>
            </div>
            <div className="row fill">
                <SplitView topHeight="2.5em" settings={settings} match={match} spanManager={spanManager}/>
            </div>
        </div>
    );
}


export default MatchView;
