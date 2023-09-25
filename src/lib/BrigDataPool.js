import { writable } from 'svelte/store';
import { addNotification } from './BrigLog';

export let DataPool = writable([[], null]);

export const setReference = (reference) => {
    DataPool.update((pool) => {
        console.log(pool)
        pool[1] = reference;
        console.log(pool)
        addNotification('Reference set to ' + reference.name);
        return pool;
    });
}

export const addFiles = (files) => {
    DataPool.update((pool) => {
        addNotification(`Adding ${files.length} files to the pool`);
        for (let i = 0; i < files.length; i++) {
            pool[0].find((f) => f.name === files[i].name) ? addNotification(`ERROR: ${files[i].name} already in the pool`) : pool[0].push(files[i]);
        }        
        return [pool[0], pool[1]];
    });
}

export const removeFile = (fileName) => {
    DataPool.update((pool) => {
        pool[0] = pool[0].filter((f) => f.name !== fileName);
        return [pool[0], pool[1]];
    });
}