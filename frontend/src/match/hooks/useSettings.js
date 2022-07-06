import React, { useState } from "react";

function getDefaultSettings() {
    return {
        isSoftWrapped: true,
        isWhiteSpaceHidden: true,
        isIgnoredHidden: false,
        isColorBlind: false,
    };
}

const SettingsContext = React.createContext([
    getDefaultSettings(),
    (setting, val) => {},
]);

function useSettings() {
    const [settings, setSettings] = useState(getDefaultSettings());

    const setSetting = (key, value) =>
        setSettings((settings) => {
            const newSettings = { ...settings };
            newSettings[key] = value;
            setSettings(newSettings);
        });

    return [settings, setSetting];
}

export default useSettings;
export { SettingsContext };
