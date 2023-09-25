<script>
    import { ringStore, addIndex, minusIndex} from './BrigRingStore.js';
    import { addNewRing } from './BrigRingStore.js';
    import { removeRing, addDataFiletoRing } from './BrigRingStore.js';
    import { updateRingSetting } from './BrigRingStore.js';    
    import { setReference, DataPool, addFiles } from './BrigDataPool.js';

    let rings; 
    let currentRingIndex = 0;
    let currentRing; 
    let dataFiles = [];
    let refFile;  

    ringStore.subscribe(value => {
        rings = value[0];
        currentRingIndex = value[1];
        currentRing = rings[currentRingIndex]; 
    });

    DataPool.subscribe(value => {
        dataFiles = value[0];
        refFile = value[1];
    });

    let settingChanger = (event) => {
        console.log(event.target.id);
        console.log(event.target.value);
        console.log(currentRingIndex);
        if (Number.isInteger(event.target.value)){ 
            updateRingSetting(currentRingIndex, event.target.id, event.target.value, 'int');
        } else {
            updateRingSetting(currentRingIndex, event.target.id, event.target.value, 'string');
        }
        console.log('current', rings[currentRingIndex])
    }

    $: if (refFile && refFile[0]) {
        console.log(refFile[0].name);
        setReference(refFile[0]);
    }

    $: if (dataFiles.length > 0 ) {
        addFiles(dataFiles);
        // dataFiles.forEach(element => {
        //     addDataFiletoRing(currentRingIndex, element.name);
        //     console.log(element.name);
        // });
    }



</script>
<h1>This is BRIGX</h1>
<button class="btn" onclick="my_modal_3.showModal()">Global options</button>
<p>
    <label class="label" for="ref-file-input">
        <span class="label-text">Choose a reference file</span>
    </label>
    <input bind:files={refFile} type="file" id="ref-file-input" class="file-input file-input-bordered w-full max-w-xs" /><br>
    {refFile ? refFile.name : 'No reference selected'}

    <label class="label" for="data-file-input">
        <span class="label-text">Choose query files</span>
    </label>
    <input bind:files={dataFiles} type="file" id="data-file-input" class="file-input file-input-bordered w-full max-w-xs" multiple />
</p>
<p>
    <button class="btn btn-primary" on:click={addNewRing}>Add new ring</button>
    <button class="btn btn-primary" on:click={removeRing}>Remove current ring</button>
</p>
<p>
    <button class="btn btn-ghost" on:click={minusIndex}>Previous</button>Ring {currentRingIndex + 1} / {rings.length} <input type="text" id='ringName' placeholder="Type ring label here" value={currentRing.ringName} class="input w-full max-w-xs" on:change={settingChanger} /><br><button class="btn btn-ghost" on:click={addIndex}>Next</button>
</p>
<ul>
    {#if currentRing.entries.length > 0}
        {#each currentRing.entries as entry}
            <li>{entry}</li>
        {/each}
    {:else}
        <li>No entries</li>
    {/if} 

</ul>

<button class="btn btn-ghost">Add custom features</button>
<p>
    Upper threshold {currentRing.upperThreshold}% <input id='upperThreshold' type="range" min="0" max="100" value={currentRing.upperThreshold} class="range" on:input={settingChanger} />
    Minimum threshold {currentRing.lowerThreshold}% <input id='lowerThreshold' type="range" min="0" max="100" value="{currentRing.lowerThreshold}" class="range" on:input={settingChanger} />
</p>
<div class="form-control w-full max-w-xs">
    <label class="label" for="featureSize">
        <span class="label-text">Feature size</span>
    </label> 
    <input type="number" id="featureSize" value={currentRing.featureSize} class="input input-bordered w-full max-w-xs" on:change={settingChanger}/> 
</div>

<h3>Setting summary</h3>

<ul>
    {#each rings as ring}
            <li>{ring.ringName}, {ring.upperThreshold}, {ring.lowerThreshold}, {ring.featureSize}</li>
    {/each}
</ul>

<h3>Data pool</h3>
<ul>
    {refFile ? `Reference: ${refFile.name}` : 'No reference selected'}
    {#if dataFiles.length > 0}
        {#each dataFiles as dataFile}
            <li>{dataFile.name}</li>
        {/each}
    {:else}
        <li>Empty pool</li>
    {/if} 
</ul>
