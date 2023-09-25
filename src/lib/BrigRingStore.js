import { writable } from 'svelte/store';
import { addNotification } from './BrigLog';

const ringDefault = { ringName: '', upperThreshold: 90, lowerThreshold: 50, featureSize: 20, entries: [] };
export let ringStore = writable([[ringDefault], 0]);

export const addIndex = () => {
    ringStore.update( (currentData) => {
        console.log('ADD RING', currentData[1], currentData[0].length)
        if (currentData[1] < currentData[0].length -1) {
            currentData[1] = currentData[1] + 1;
            console.log('NEXT RING', currentData[1], currentData[0].length)
            addNotification(`Switched to Ring ${currentData[1] + 1}`);
        } else { 
            console.log('NO RING', currentData[1], currentData[0].length)
            addNotification(`ERROR: No ring ${currentData[1] + 2}`);
        }
        return currentData
    })
}

export const minusIndex = () => {
    ringStore.update( (currentData) => {
        if (currentData[1] > 0) {
            currentData[1] = currentData[1] - 1;
            console.log('PREV RING', currentData[1], currentData[0].length)
            addNotification(`Switched to Ring ${currentData[1]}`);
        } else {
            addNotification(`ERROR: No ring ${currentData[1]}`);
        }
        return currentData
    })
}

export const updateRingSetting = (ringIndex, key, value, type) => {
    ringStore.update( (currentData) => {
        console.log('UPDATE RING SETTING', ringIndex, key, value);
        console.log(currentData);
        console.log(currentData[0][ringIndex][key])
        if (type === 'int') {
            currentData[0][ringIndex][key] = parseInt(value);
        } else {
            currentData[0][ringIndex][key] = value.toString();
        }
        return [currentData[0], currentData[1]];
    });
}

export const addDataFiletoRing = (ringIndex, fileName) => {
    ringStore.update( (currentData) => {
        console.log('ADD DATA FILE TO RING', ringIndex, fileName);
        currentData[0][ringIndex].entries = [ ...currentData[0][ringIndex].entries, fileName];
        return [currentData[0], currentData[1]];
    });
}


export const addNewRing = () => {
    ringStore.update( (currentData) => {
        addNotification('New ring added');
        return [[...currentData[0], {...ringDefault}], currentData[1] + 1];
    });
}

export const removeRing = () => {
    ringStore.update( (currentData) => {
        const currentRingIndex = currentData[1];
        console.log(currentRingIndex);
        if (currentData[0].length === 1) {
            addNotification('ERROR: Cannot remove the last ring');
            return currentData;
        } else {
            // Remove ring at index currentRingIndex
            currentData[0].splice(currentRingIndex, 1);
            console.log(currentData);
           addNotification(`Current ring ${currentRingIndex + 1} removed`);
           if (currentRingIndex > currentData[0].length - 1) {
                currentData[1] = currentData[0].length - 1;
           }
           return currentData;
        }
    });
}


