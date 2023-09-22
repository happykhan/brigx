import { writable } from 'svelte/store';

export let ringDefault = { id: 1, ringName: '', upperThreshold: 90, lowerThreshold: 50, featureSize: 20, entries: [] };
export let ringStore = writable(ringDefault);


