/**
 * EcoTrack - TypeScript Interfaces & Data Models
 */
export const ACTIVITY_META = {
    reusable_bottle: {
        id: 'reusable_bottle',
        label: 'Reusable Bottle',
        unitLabel: 'single-use bottles avoided',
        quantityPlaceholder: 'e.g. 2',
        min: 1,
        step: 1,
        badgeClass: 'badge-bottle',
        icon: '💧',
        descriptionGuide: 'e.g. Refilled stainless steel flask throughout classes'
    },
    public_transport: {
        id: 'public_transport',
        label: 'Public Transport',
        unitLabel: 'kilometers traveled (km)',
        quantityPlaceholder: 'e.g. 8.5',
        min: 0.5,
        step: 0.5,
        badgeClass: 'badge-transport',
        icon: '🚌',
        descriptionGuide: 'e.g. Took the city metro and bus to college campus'
    },
    cycling_walking: {
        id: 'cycling_walking',
        label: 'Cycling or Walking',
        unitLabel: 'kilometers walked/cycled (km)',
        quantityPlaceholder: 'e.g. 3.0',
        min: 0.5,
        step: 0.5,
        badgeClass: 'badge-cycling',
        icon: '🚲',
        descriptionGuide: 'e.g. Walked to library and cycled to local market'
    },
    waste_segregation: {
        id: 'waste_segregation',
        label: 'Waste Segregation',
        unitLabel: 'segregation sessions / bins',
        quantityPlaceholder: 'e.g. 1',
        min: 1,
        step: 1,
        badgeClass: 'badge-waste',
        icon: '♻️',
        descriptionGuide: 'e.g. Separated compostable food scraps and dry recyclables'
    },
    tree_care: {
        id: 'tree_care',
        label: 'Tree-Care Activity',
        unitLabel: 'trees nurtured or planted',
        quantityPlaceholder: 'e.g. 1',
        min: 1,
        step: 1,
        badgeClass: 'badge-tree',
        icon: '🌱',
        descriptionGuide: 'e.g. Watered campus saplings and mulched garden bed'
    }
};
//# sourceMappingURL=types.js.map