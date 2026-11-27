"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAYSTYLES = void 0;
exports.normalizePlayStyles = normalizePlayStyles;
exports.style = style;
exports.styleName = styleName;
exports.PLAYSTYLES = {
    pingedPass: { name: "Pinged Pass", effect: "Pass speed +18%" },
    incisivePass: { name: "Incisive Pass", effect: "Passing error chance -25%" },
    finesseShot: { name: "Finesse Shot", effect: "Shot angular error -30%" },
    powerShot: { name: "Power Shot", effect: "Shot speed +15%" },
    bruiser: { name: "Bruiser", effect: "Physical duel strength +4 (10 percentage points before caps)" },
    intercept: { name: "Intercept", effect: "Interception reach +5 and chance +10 percentage points" },
    anticipate: { name: "Anticipate", effect: "Tackle chance +8 percentage points" },
    pressProven: { name: "Press Proven", effect: "Resist tackles and physical duels by 6 percentage points" },
    firstTouch: { name: "First Touch", effect: "Reception chance +8 percentage points" },
    quickStep: { name: "Quick Step", effect: "Ball carrying speed +10%" },
    longReach: { name: "Long Reach", effect: "Goalkeeper save chance +8 percentage points" },
};
function normalizePlayStyles(raw) {
    if (!Array.isArray(raw))
        return [];
    const result = new Map();
    for (const v of raw) {
        if (typeof v !== "string")
            continue;
        const key = v.replace(/\+$/, "");
        if (!Object.prototype.hasOwnProperty.call(exports.PLAYSTYLES, key))
            continue;
        if (!result.has(key) || v.endsWith("+"))
            result.set(key, v);
    }
    return [...result.values()].slice(0, 6);
}
function style(p, key) { return p.playStyles?.includes(`${key}+`) ? 1.5 : p.playStyles?.includes(key) ? 1 : 0; }
function styleName(s) { return exports.PLAYSTYLES[s.replace(/\+$/, "")].name + (s.endsWith("+") ? "+" : ""); }
