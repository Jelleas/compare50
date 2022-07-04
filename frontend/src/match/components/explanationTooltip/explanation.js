import React from "react";

function ExplanationsView({ explanations }) {
    return <div>{explanations[0].leadingExplanation.text}</div>;
}

export default ExplanationsView;
