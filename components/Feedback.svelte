<script>
  import FeedbackItem from './FeedbackItem.svelte';

  export let feedback;
</script>

<section class="col-span-2 cursor-default">
  <p class="mb-2 font-medium">Feedback</p>
  <ul
    class="flex-1 flex flex-col items-center list-none gap-2 p-2 border border-gray overflow-auto max-h-36 rounded-md"
  >
    {#if feedback}
      {#each feedback as feedbackItem}
        <FeedbackItem {feedbackItem} />
      {/each}
    {:else}
      <li class="w-full">No feedback given</li>
    {/if}
  </ul>
</section>
