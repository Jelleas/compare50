import React from 'react';
import ReactDOM from 'react-dom';
import * as serviceWorker from './serviceWorker';

// https://blog.logrocket.com/multiple-entry-points-in-create-react-app-without-ejecting/
let BuildTarget = null;
if (process.env.REACT_APP_BUILD_TARGET === "home") {
    BuildTarget = require("./home/home").default;
}
else if (process.env.REACT_APP_BUILD_TARGET === "match") {
    BuildTarget = require("./match/matchview").default;
}
else {
    throw new Error(`Env var REACT_APP_BUILD_TARGET is not set to either 'home' or 'match'`);
}

ReactDOM.render(
    <React.StrictMode>
        <BuildTarget />
    </React.StrictMode>,
    document.getElementById("root")
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
