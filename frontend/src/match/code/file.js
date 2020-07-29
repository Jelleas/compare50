import React, {useState, useRef, useEffect, useMemo} from 'react';
import createFragments from './fragmentslicer'

import "./file.css";


function File(props) {
    const [visibilityRef, entry] = useIntersect({
        threshold: Array.from(Array(100).keys(), i => i / 100),
    });

    useEffect(() => {
        props.updateFileVisibility(props.file.name, entry.intersectionRatio);
    });

    const spans = props.spanManager.spans.filter(span => span.fileId === props.file.id);

    const fragments = useMemo(() => createFragments(props.file, spans), [props.file, spans]);

    // Keep track of whether a line of code starts on a newline (necessary for line numbers through css)
    let onNewline = true;

    const fragmentElems = fragments.map((frag, i) => {
        const id = `fragment_${props.file.id}_${i}`;
        const fragElem = <Fragment
                            key={id}
                            fragment={frag}
                            fileId={props.file.id}
                            id={id}
                            onNewline={onNewline}
                            scrollTo={props.scrollTo}
                            spanManager={props.spanManager}/>
        onNewline = frag.text.endsWith("\n");
        return fragElem;
    });

    return (
        <>
            <h4> {props.file.name} <span>({props.file.percentage}%)</span></h4>
            <pre ref={visibilityRef} className={props.softWrap ? "softwrap" : ""}>
                {(fragmentElems)}
            </pre>
        </>
    )
}


function Fragment(props) {
    // Break up the fragments into lines (keep the newline)
    const lines = props.fragment.text.split(/(?<=\n)/g);

    const ref = useRef(null);
    const classNameRef = useRef("");

    useEffect(() => {
        // If this fragment was not selected before, but now it is, scroll to it
        if (classNameRef.current !== "selected-match" && ref.current.className === "selected-match") {
            props.scrollTo(ref.current);
        }

        classNameRef.current = ref.current.className;
    })

    let className = "";
    if (props.spanManager.isActive(props.fragment)) {
        className = "active-match";
    }
    else if (props.spanManager.isSelected(props.fragment)) {
        className = "selected-match";
    }
    else if (props.spanManager.isGrouped(props.fragment)) {
        className = "grouped-match";
    }

    return (
        <span
            ref={ref}
            className={className}
            key={props.id}
            onMouseEnter={event => props.spanManager.activate(props.fragment)}
            onMouseUp={event => props.spanManager.select(props.fragment)}
        >
            {lines.map((line, lineIndex) =>
                <code
                    key={`code_${props.id}_${lineIndex}`}
                    className={props.onNewline || lineIndex > 0 ? "newline" : ""}
                >
                    {line}
                </code>
            )}
        </span>
    )
}


// https://medium.com/the-non-traditional-developer/how-to-use-an-intersectionobserver-in-a-react-hook-9fb061ac6cb5
const useIntersect = ({root=null, rootMargin, threshold=0}) => {
    const [entry, updateEntry] = useState({});
    const [node, setNode] = useState(null);

    const observer = useRef(
        new window.IntersectionObserver(([entry]) => updateEntry(entry), {
        root,
        rootMargin,
        threshold
    }));

    useEffect(() => {
        const { current: currentObserver } = observer;
        currentObserver.disconnect();

        if (node) {
            currentObserver.observe(node);
        }

        return () => currentObserver.disconnect();
    }, [node]);

    return [setNode, entry];
};


export default File
