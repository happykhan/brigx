<script lang="ts">
    import {fade} from 'svelte/transition';
    import {notifications} from '../lib/BrigLog';
</script>

{#if $notifications}
  <div class="notifications">
        <div class="toast toast-end">
            {#each $notifications as notification}
                {#if notification.startsWith('ERROR')}
                <div class="alert alert-error" transition:fade>
                    <span>{notification}</span>
                </div>
                {:else}
                <div class="alert alert-info" transition:fade>
                    <span>{notification}</span>
                </div>
                {/if}
            {/each}
        </div>    
  </div>
{/if}