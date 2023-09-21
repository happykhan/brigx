<script>
    import "$lib/app.css";
    import Feature from '../lib/Feature.svelte';
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
                <button class="btn btn-primary">Add new ring</button>
                <button class="btn btn-primary">Remove current ring</button>
            </p>
            <p>
                <button class="btn btn-ghost">Previous</button>Ring 1 <input type="text" placeholder="Type ring label here" class="input w-full max-w-xs" /><button class="btn btn-ghost">Next</button>
            </p>
            <ul>
                <li>File 1</li>
            </ul>

            <button class="btn btn-ghost">Add custom features</button>
            <p>
                Upper threshold (%) <input type="range" min="0" max="100" value="90" class="range" /> 
                Minimum threshold (%) <input type="range" min="0" max="100" value="50" class="range" />
            </p>
            <div class="form-control w-full max-w-xs">
                <label class="label" for="feature-size-input">
                    <span class="label-text">Feature size</span>
                </label>
                <input type="number" id="feature-size-input" placeholder="20" class="input input-bordered w-full max-w-xs" />
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

