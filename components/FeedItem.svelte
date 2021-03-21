<script>
  import AddFeedback from './AddFeedback.svelte';
  import Feedback from './Feedback.svelte';

  export let db;
  export let item;
  let feedback;

  let isExpanded = false;

  $: {
    if (db && (item && item.id)) {
      db.collection('feedback').doc(item.id).onSnapshot((doc) => {
        const feedbackItem = doc.data();
        feedback = feedbackItem && feedbackItem.feedback || null;
      });
    }
  }
</script>

<li
  class="w-full flex flex-col p-4 bg-white shadow cursor-pointer hover:border hover:border-black rounded-lg"
  role="button"
  aria-expanded={isExpanded}
  on:click={() => (isExpanded = !isExpanded)}
>
  <div class="flex items-center cursor-pointer" class:mb-4={isExpanded}>
    <h3 class="mr-2">{item.headline}</h3>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -256 1792 1792"
      width="20px"
      class="transform ease-out duration-200 text-green-500"
      class:rotate-180={isExpanded}
      ><path
        fill="currentColor"
        d="M1679.339 301.56q0 53-37 90l-651 651q-38 38-91 38-54 0-90-38l-651-651q-38-36-38-90 0-53 38-91l74-75q39-37 91-37 53 0 90 37l486 486 486-486q37-37 90-37 52 0 91 37l75 75q37 39 37 91z"
      /></svg
    >
  </div>
  {#if isExpanded}
    <p class="mb-8">{item.description}</p>
    <div class="grid grid-cols-3 gap-4">
      <Feedback {feedback} />
      <AddFeedback id={item.id} {db} />
    </div>
  {/if}
</li>
