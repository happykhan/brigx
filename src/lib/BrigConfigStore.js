import { writable } from 'svelte/store';

export let config = writable({upperThreshold: 90, lowerThreshold: 50, count: 0});


function updateConfig(event) {
    console.log(event.target.value)
    config.update(n => {
        n[key] = value;
        return n;
    });
}