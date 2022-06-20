import { useState } from "react";

function useSettings() {
    const [settings, setSettings] = useState({
        isSoftWrapped: true,
        isWhiteSpaceHidden: true,
        isIgnoredHidden: false,
    });

    const setSetting = (key, value) =>
        setSettings((settings) => {
            const newSettings = { ...settings };
            newSettings[key] = value;
            setSettings(newSettings);
        });

    return [settings, setSetting];
}

export default useSettings;
