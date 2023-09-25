<script>
    import "$lib/app.css";
    import BrigControl from "../lib/BrigControl.svelte";
    import BrigOptions from "../lib/BrigOptions.svelte";
    import BrigFigure from '../lib/BrigFigure.svelte';
    import BrigMessage from '../lib/BrigMessage.svelte';
</script>

<div data-theme="light" class="grid grid-cols-2 gap-4 px-10 pt-6 max-w-screen-xl sm:grid-cols-2 ">
    <div>
        <BrigMessage />
        <article class="prose">
            <BrigControl />
        </article>
    </div>
    <div>
        <article class="prose">
            <BrigFigure />
        </article>
    </div>
    <BrigOptions />  
</div>

