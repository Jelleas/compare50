import { useNavigate } from "react-router-dom";

let useNavigateToMatch;

if (process.env.REACT_APP_BUILD_TARGET === "bundle") {
    useNavigateToMatch = () => {
        const navigate = useNavigate();
        return (index) => navigate(`/match/${index}`);
    };
} else {
    useNavigateToMatch = () => {
        return (index) => (window.location.href = `match_${index}.html`);
    };
}

export default useNavigateToMatch;
