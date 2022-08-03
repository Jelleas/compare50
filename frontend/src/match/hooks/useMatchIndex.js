import { useParams } from "react-router-dom";

let useMatchIndex;

if (process.env.REACT_APP_BUILD_TARGET === "bundle") {
    if (process.env.NODE_ENV === "development") {
        useMatchIndex = () => 0;
    } else {
        useMatchIndex = () => {
            const { id } = useParams();
            return parseInt(id);
        };
    }
} else {
    useMatchIndex = () => parseInt(Object.keys(window.COMPARE50.MATCHES)[0]);
}

export default useMatchIndex;
