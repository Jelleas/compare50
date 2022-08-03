import { useNavigate } from "react-router-dom";

let useNavigateToIndex;

if (process.env.REACT_APP_BUILD_TARGET === "bundle") {
    useNavigateToIndex = () => {
        const navigate = useNavigate();
        return () => navigate("/");
    };
} else {
    useNavigateToIndex = () => {
        return () => (window.location.href = "index.html");
    };
}

export default useNavigateToIndex;
