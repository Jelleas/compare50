import { useRef, useCallback } from "react";

function useScroll(
    scrollableDomElement,
    similarities,
    onScrollStart,
    onScrollEnd
) {
    const didScroll = useRef(false);

    const highlightedSpans = similarities
        .highlightedSpans()
        .map((span) => span.id);
    const prevHighlightedSpans = useRef(highlightedSpans);

    const highlightChanged =
        highlightedSpans.length !== prevHighlightedSpans.current.length ||
        highlightedSpans.some((s, i) => s !== prevHighlightedSpans.current[i]);

    // In case the highlighted spans changed, re-enable scrolling
    if (highlightChanged) {
        didScroll.current = false;
        prevHighlightedSpans.current = highlightedSpans;
    }

    const scrollToCallback = useCallback(
        (domElement) => {
            if (didScroll.current) {
                return;
            }
            didScroll.current = true;
            scrollTo(
                domElement,
                scrollableDomElement,
                onScrollStart,
                onScrollEnd
            );
        },
        [scrollableDomElement, onScrollStart, onScrollEnd]
    );

    return scrollToCallback;
}

function findPos(domElement) {
    let obj = domElement;
    let curtop = 0;
    if (obj.offsetParent) {
        do {
            curtop += obj.offsetTop;
            obj = obj.offsetParent;
        } while (obj);
    }
    return curtop;
}

// Custom implementation/hack of element.scrollIntoView();
// Because safari does not support smooth scrolling @ July 27 2018
// Update @ July 29 2020, still no smooth scrolling in Safari
// Update @ June 20 2022, still no smooth scrolling in Safari
// Feel free to replace once it does:
//     this.dom_element.scrollIntoView({"behavior":"smooth"});
// Also see: https://github.com/iamdustan/smoothscroll
// Credits: https://gist.github.com/andjosh/6764939
function scrollTo(
    domElement,
    scrollable = document,
    onScrollStart,
    onScrollEnd,
    offset = 200
) {
    let easeInOutQuad = (t, b, c, d) => {
        t /= d / 2;
        if (t < 1) return (c / 2) * t * t + b;
        t--;
        return (-c / 2) * (t * (t - 2) - 1) + b;
    };

    let to = findPos(domElement) - offset;

    let start = scrollable.scrollTop;
    let change = to - start;
    let duration = Math.min(300, Math.max(Math.abs(change), 40));
    let currentTime = 0;
    let increment = 20;

    let animateScroll = () => {
        currentTime += increment;
        let val = easeInOutQuad(currentTime, start, change, duration);

        scrollable.scrollTop = val;
        if (currentTime < duration) {
            setTimeout(animateScroll, increment);
        } else {
            onScrollEnd();
        }
    };

    onScrollStart();
    animateScroll();
}

export default useScroll;
