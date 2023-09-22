<script>
    import "$lib/app.css";
    import Feature from '../lib/Feature.svelte';
    import { ringStore, ringDefault } from '../lib/RingStore.js';

    let currentRingIndex =  1; 
    let currentRing = ringDefault;
    let allRings = [ringDefault] ;
    ringStore.subscribe((data) => {
        // Find current ring
        currentRing = data.filter((ring) => ring.id === currentRingIndex)[0];
        allRings = data;
    });    

    let updateCurrentRingName = (event) => {
        currentRing['ringName'] = event.target.value.toString();
        ringStore.update( (currentData) => {
            let otherRings = currentData.filter((ring) => ring.id != currentRingIndex)
            console.log(currentData); 
            return [...otherRings, currentRing];
        });
    }

    let updateCurrentRingSetting = (event) => {
        currentRing[event.target.id] = parseInt(event.target.value);
        ringStore.update( (currentData) => {
            let otherRings = currentData.filter((ring) => ring.id != currentRingIndex)
            console.log(currentData); 
            return [...otherRings, currentRing];
        });
    }

    let addNewRing = () => {
        ringStore.update( (currentData) => {
            let newRing = ringDefault;
            newRing.id = currentData.length + 1;
            return [...currentData, newRing];
        });
    }

    let removeCurrentRing = () => {
        ringStore.update( (currentData) => {
            let otherRings = currentData.filter((ring) => ring.id != currentRingIndex)
            return [...otherRings];
        });

    }

    let nextRing = () => {
        if (currentRingIndex < allRings.length) {
            currentRingIndex = currentRingIndex + 1;
            currentRing = allRings.filter((ring) => ring.id === currentRingIndex)[0];
        }
    }    

    let prevRing = () => {
        if (currentRingIndex > 0) {
            currentRingIndex = currentRingIndex - 1;
            currentRing = allRings.filter((ring) => ring.id === currentRingIndex)[0];
        }
    }        

</script>

<div data-theme="light" class="grid grid-cols-2 gap-4 px-10 pt-6 max-w-screen-xl sm:grid-cols-2 ">
    <div>
        <article class="prose">
            <h1>This is BRIGX</h1>
            <button class="btn" onclick="my_modal_3.showModal()">Global options</button>
            <p>
                <label class="label" for="ref-file-input">
                    <span class="label-text">Choose a reference file</span>
                </label>
                <input type="file" id="ref-file-input" class="file-input file-input-bordered w-full max-w-xs" multiple />
                <button class="btn btn-neutral">Set reference</button>

                <label class="label" for="ref-file-input">
                    <span class="label-text">Choose query files</span>
                </label>
                <input type="file" id="ref-file-input" class="file-input file-input-bordered w-full max-w-xs" multiple />
                <button class="btn btn-neutral">Add files</button>
            </p>
            <p>
                <button class="btn btn-primary" on:click={addNewRing}>Add new ring</button>
                <button class="btn btn-primary" on:click={removeCurrentRing}>Remove current ring</button>
            </p>
            <p>
                <button class="btn btn-ghost" on:click={prevRing}>Previous</button>Ring {currentRing.id} <input type="text" id='ringName' placeholder="Type ring label here" class="input w-full max-w-xs" on:input={updateCurrentRingName} /><button class="btn btn-ghost" on:click={nextRing}>Next</button>
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
                Upper threshold {currentRing.upperThreshold}(%) <input id='upperThreshold' type="range" min="0" max="100" value="90" class="range" on:input={updateCurrentRingSetting} on:change={updateCurrentRingSetting}/>
                Minimum threshold {currentRing.lowerThreshold}(%) <input id='lowerThreshold' type="range" min="0" max="100" value="50" class="range" on:input={updateCurrentRingSetting} on:change={updateCurrentRingSetting}/> 
            </p>
            <div class="form-control w-full max-w-xs">
                <label class="label" for="featureSize">
                    <span class="label-text">Feature size</span>
                </label>
                <input type="number" id="featureSize" placeholder={currentRing.featureSize} class="input input-bordered w-full max-w-xs" on:input={updateCurrentRingSetting}/>
            </div>

        </article>
    </div>
    <div>
        <article class="prose">
            <Feature />
        </article>
    </div>
    <dialog id="my_modal_3" class="modal">
        <div class="modal-box">
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 class="font-bold text-lg">Global options</h3>
          <p class="py-4">Press ESC key or click on ✕ button to close</p>
        </div>
    </dialog>    
</div>

